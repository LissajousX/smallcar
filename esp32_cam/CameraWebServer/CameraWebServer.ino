#include "esp_camera.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebSocketsServer.h>
#include <ESPmDNS.h>
#include <string.h>
#include <stdlib.h>
#include "esp_ota_ops.h"
#include "esp_task_wdt.h"
#include "esp_partition.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "nvs.h"

//
// WARNING!!! PSRAM IC required for UXGA resolution and high JPEG quality
//            Ensure ESP32 Wrover Module or other board with PSRAM is selected
//            Partial images will be transmitted if image exceeds buffer size
//
//            You must select partition scheme from the board menu that has at least 3MB APP space.
//            Face Recognition is DISABLED for ESP32 and ESP32-S2, because it takes up from 15
//            seconds to process single frame. Face Detection is ENABLED if PSRAM is enabled as well

// ===================
// Select camera model
// ===================
//#define CAMERA_MODEL_WROVER_KIT // Has PSRAM
//#define CAMERA_MODEL_ESP_EYE  // Has PSRAM
//#define CAMERA_MODEL_ESP32S3_EYE // Has PSRAM
//#define CAMERA_MODEL_M5STACK_PSRAM // Has PSRAM
//#define CAMERA_MODEL_M5STACK_V2_PSRAM // M5Camera version B Has PSRAM
//#define CAMERA_MODEL_M5STACK_WIDE // Has PSRAM
//#define CAMERA_MODEL_M5STACK_ESP32CAM // No PSRAM
//#define CAMERA_MODEL_M5STACK_UNITCAM // No PSRAM
//#define CAMERA_MODEL_M5STACK_CAMS3_UNIT  // Has PSRAM
// 摄像头型号在 PlatformIO 的 build_flags 中通过 -D CAMERA_MODEL_AI_THINKER 定义，
// 这里不再重复定义，以避免与其他构建配置冲突。
//#define CAMERA_MODEL_AI_THINKER // Has PSRAM
//#define CAMERA_MODEL_TTGO_T_JOURNAL // No PSRAM
//#define CAMERA_MODEL_XIAO_ESP32S3 // Has PSRAM
// ** Espressif Internal Boards **
//#define CAMERA_MODEL_ESP32_CAM_BOARD
//#define CAMERA_MODEL_ESP32S2_CAM_BOARD
//#define CAMERA_MODEL_ESP32S3_CAM_LCD
//#define CAMERA_MODEL_DFRobot_FireBeetle2_ESP32S3 // Has PSRAM
//#define CAMERA_MODEL_DFRobot_Romeo_ESP32S3 // Has PSRAM

// 如果编译系统（如 PlatformIO 的 build_flags）没有选择摄像头型号，
// 则在 Arduino IDE 等环境下默认使用 AI THINKER 模块。
#if !defined(CAMERA_MODEL_WROVER_KIT) && \
    !defined(CAMERA_MODEL_ESP_EYE) && \
    !defined(CAMERA_MODEL_ESP32S3_EYE) && \
    !defined(CAMERA_MODEL_M5STACK_PSRAM) && \
    !defined(CAMERA_MODEL_M5STACK_V2_PSRAM) && \
    !defined(CAMERA_MODEL_M5STACK_WIDE) && \
    !defined(CAMERA_MODEL_M5STACK_ESP32CAM) && \
    !defined(CAMERA_MODEL_M5STACK_UNITCAM) && \
    !defined(CAMERA_MODEL_M5STACK_CAMS3_UNIT) && \
    !defined(CAMERA_MODEL_AI_THINKER) && \
    !defined(CAMERA_MODEL_TTGO_T_JOURNAL) && \
    !defined(CAMERA_MODEL_XIAO_ESP32S3) && \
    !defined(CAMERA_MODEL_ESP32_CAM_BOARD) && \
    !defined(CAMERA_MODEL_ESP32S2_CAM_BOARD) && \
    !defined(CAMERA_MODEL_ESP32S3_CAM_LCD) && \
    !defined(CAMERA_MODEL_DFRobot_FireBeetle2_ESP32S3) && \
    !defined(CAMERA_MODEL_DFRobot_Romeo_ESP32S3)
#define CAMERA_MODEL_AI_THINKER // Has PSRAM
#endif
#include "camera_pins.h"

#if defined(SMALLCAR_FW_PRODUCT)
#define SMALLCAR_IS_PRODUCT 1
#define SMALLCAR_IS_GEEK 0
#else
#define SMALLCAR_IS_PRODUCT 0
#define SMALLCAR_IS_GEEK 1
#endif

// ===========================
// Enter your WiFi credentials
// ===========================
const char *ssid = "IronMan";
const char *password = "Loveyou3000.";

#define WIFI_NVS_NAMESPACE "wifi_cfg"
#define WIFI_NVS_KEY_SSID "ssid"
#define WIFI_NVS_KEY_PSK "psk"

static const int UART_RX_PIN = 12;
static const int UART_TX_PIN = 13;
static const unsigned long UART_BAUD = 115200;

HardwareSerial &ControlSerial = Serial2;
WebSocketsServer controlWs(8765);
bool wsClientConnected = false;
uint8_t wsClientId = 0xFF;  // 当前占用控制权的客户端编号

volatile int g_battery_mv = -1;
volatile int g_battery_percent = -1;
volatile uint32_t g_battery_ts_ms = 0;
static char battery_line_buf[64];
static size_t battery_line_pos = 0;

void startCameraServer();
void setupLedFlash(int pin);

void handleControlJson(const char *data, size_t len) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, data, len);
  if (err) {
    Serial.print("JSON parse error: ");
    Serial.println(err.c_str());
    return;
  }

  const char *type = doc["type"];
  if (!type || strcmp(type, "control") != 0) {
    return;
  }

  int throttle = doc["throttle"] | 0;
  int steer = doc["steer"] | 0;
  int yaw = doc["yaw"] | -1;
  int pitch = doc["pitch"] | -1;

  throttle = constrain(throttle, -100, 100);
  steer = constrain(steer, -100, 100);

  if (yaw < -1) {
    yaw = -1;
  } else if (yaw > 180) {
    yaw = 180;
  }

  if (pitch < -1) {
    pitch = -1;
  } else if (pitch > 180) {
    pitch = 180;
  }

  char buf[64];
  int n = snprintf(buf, sizeof(buf), "C,%d,%d,%d,%d\n", throttle, steer, yaw, pitch);
  if (n > 0) {
    ControlSerial.write((const uint8_t *)buf, n);
    Serial.print("TX -> STM32: ");
    Serial.write((const uint8_t *)buf, n);
  }
}

void onWsEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      IPAddress ip = controlWs.remoteIP(num);
      Serial.print("WS[");
      Serial.print(num);
      Serial.print("] connected from ");
      Serial.println(ip);
      // 若已有旧连接，占用控制权的新连接会挤掉旧连接
      if (wsClientConnected && wsClientId != num) {
        Serial.print("WS[");
        Serial.print(wsClientId);
        Serial.println("] dropped (replaced by new client)");
        controlWs.disconnect(wsClientId);
      }
      wsClientConnected = true;
      wsClientId = num;
      break;
    }
    case WStype_DISCONNECTED:
      Serial.print("WS[");
      Serial.print(num);
      Serial.println("] disconnected");
      // 只在当前控制客户端断开时，才清除标记
      if (num == wsClientId) {
        wsClientConnected = false;
        wsClientId = 0xFF;
      }
      break;
    case WStype_TEXT:
      if (length > 0) {
        handleControlJson((const char *)payload, length);
      }
      break;
    default:
      break;
  }
}

static void parseBatteryLine(const char *line) {
  if (!line) {
    return;
  }
  if (line[0] != 'B' && line[0] != 'b') {
    return;
  }

  const char *p = line + 1;
  if (*p == ',') {
    ++p;
  }

  char *endptr = NULL;
  long mv = strtol(p, &endptr, 10);
  if (endptr == p) {
    return;
  }

  if (*endptr == ',') {
    ++endptr;
  }

  char *endptr2 = NULL;
  long percent = strtol(endptr, &endptr2, 10);

  if (percent < 0) {
    percent = 0;
  } else if (percent > 100) {
    percent = 100;
  }

  g_battery_mv = (int)mv;
  g_battery_percent = (int)percent;
  g_battery_ts_ms = millis();
}

static void pollBatteryFromUart() {
  while (ControlSerial.available() > 0) {
    int ch = ControlSerial.read();
    if (ch < 0) {
      break;
    }
    char c = (char)ch;

    if (c == '\r') {
      continue;
    }

    if (c == '\n') {
      if (battery_line_pos > 0U) {
        battery_line_buf[battery_line_pos] = '\0';
        parseBatteryLine(battery_line_buf);
        battery_line_pos = 0U;
      }
    } else {
      if (battery_line_pos < (sizeof(battery_line_buf) - 1U)) {
        battery_line_buf[battery_line_pos++] = c;
      } else {
        battery_line_pos = 0U;
      }
    }
  }
}

bool load_sta_config_from_nvs(char *out_ssid, size_t out_ssid_size, char *out_psk, size_t out_psk_size) {
  if (!out_ssid || out_ssid_size == 0 || !out_psk || out_psk_size == 0) {
    return false;
  }
  out_ssid[0] = '\0';
  out_psk[0] = '\0';

  nvs_handle_t h;
  esp_err_t err = nvs_open(WIFI_NVS_NAMESPACE, NVS_READONLY, &h);
  if (err != ESP_OK) {
    return false;
  }

  size_t ssid_len = out_ssid_size;
  err = nvs_get_str(h, WIFI_NVS_KEY_SSID, out_ssid, &ssid_len);
  if (err != ESP_OK || out_ssid[0] == '\0') {
    nvs_close(h);
    out_ssid[0] = '\0';
    out_psk[0] = '\0';
    return false;
  }

  size_t psk_len = out_psk_size;
  err = nvs_get_str(h, WIFI_NVS_KEY_PSK, out_psk, &psk_len);
  if (err != ESP_OK) {
    out_psk[0] = '\0';
  }

  nvs_close(h);
  return true;
}

bool save_sta_config_to_nvs(const char *in_ssid, const char *in_psk) {
  if (!in_ssid || in_ssid[0] == '\0') {
    return false;
  }

  nvs_handle_t h;
  esp_err_t err = nvs_open(WIFI_NVS_NAMESPACE, NVS_READWRITE, &h);
  if (err != ESP_OK) {
    Serial.printf("WiFi NVS open failed: %d\n", (int)err);
    return false;
  }

  const char *psk = in_psk ? in_psk : "";

  esp_err_t err1 = nvs_set_str(h, WIFI_NVS_KEY_SSID, in_ssid);
  esp_err_t err2 = nvs_set_str(h, WIFI_NVS_KEY_PSK, psk);
  if (err1 != ESP_OK || err2 != ESP_OK) {
    Serial.printf("WiFi NVS set_str failed: ssid=%d, psk=%d\n", (int)err1, (int)err2);
    nvs_close(h);
    return false;
  }

  err = nvs_commit(h);
  nvs_close(h);
  if (err != ESP_OK) {
    Serial.printf("WiFi NVS commit failed: %d\n", (int)err);
    return false;
  }

  return true;
}

static void ota_preerase_task(void *param) {
  const esp_partition_t *running = esp_ota_get_running_partition();
  const esp_partition_t *ota0 = esp_partition_find_first(ESP_PARTITION_TYPE_APP, ESP_PARTITION_SUBTYPE_APP_OTA_0, NULL);
  const esp_partition_t *ota1 = esp_partition_find_first(ESP_PARTITION_TYPE_APP, ESP_PARTITION_SUBTYPE_APP_OTA_1, NULL);
  const esp_partition_t *target = NULL;

  if (ota0 && ota0 != running) {
    target = ota0;
  } else if (ota1 && ota1 != running) {
    target = ota1;
  }

  if (!target) {
    Serial.println("OTA preerase: no inactive OTA partition found");
    vTaskDelete(NULL);
    return;
  }

  Serial.printf("OTA preerase: target '%s' at 0x%lx, size 0x%lx\n",
                target->label,
                (unsigned long)target->address,
                (unsigned long)target->size);

  const size_t chunk = 4 * 1024;
  size_t offset = 0;
  size_t total_erased = 0;

  while (offset < target->size) {
    size_t erase_size = chunk;
    if (offset + erase_size > target->size) {
      erase_size = target->size - offset;
    }

    esp_err_t err = esp_partition_erase_range(target, offset, erase_size);
    if (err != ESP_OK) {
      Serial.printf("OTA preerase: erase error %d at offset 0x%lx, size 0x%lx\n",
                    (int)err,
                    (unsigned long)offset,
                    (unsigned long)erase_size);
      break;
    }

    offset += erase_size;
    total_erased += erase_size;

    if ((offset % (256 * 1024) == 0) || (offset >= target->size)) {
      Serial.printf("OTA preerase: erased %lu / %lu bytes\n",
                    (unsigned long)offset,
                    (unsigned long)target->size);
    }

    vTaskDelay(pdMS_TO_TICKS(50));
  }

  Serial.printf("OTA preerase: finished, erased %lu bytes\n",
                (unsigned long)total_erased);

  // Clear preerase flag in NVS so this task will not run again on future boots
  nvs_handle_t h_flag;
  esp_err_t err_flag = nvs_open("ota_diag", NVS_READWRITE, &h_flag);
  if (err_flag == ESP_OK) {
    int32_t flag = 0;
    nvs_set_i32(h_flag, "preerase", flag);
    nvs_commit(h_flag);
    nvs_close(h_flag);
  } else {
    Serial.printf("OTA preerase: nvs_open for clear flag failed: %d\n", (int)err_flag);
  }

  vTaskDelete(NULL);
}

void setup() {
  Serial.begin(115200);
  Serial.println();

  // Fully disable Task Watchdog to avoid resets during long OTA flash erase
  esp_task_wdt_deinit();
  Serial.println("Task WDT deinitialized");

  ControlSerial.begin(UART_BAUD, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG;  // for streaming
  //config.pixel_format = PIXFORMAT_RGB565; // for face detection/recognition
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 2;  // 强制为 2，避免等待帧缓冲导致卡顿

  // if PSRAM IC present, init with UXGA resolution and higher JPEG quality
  //                      for larger pre-allocated frame buffer.
  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      // Limit the frame size when PSRAM is not available
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    // Best option for face detection/recognition
    config.frame_size = FRAMESIZE_240X240;
#if CONFIG_IDF_TARGET_ESP32S3
    config.fb_count = 2;
#endif
  }

#if defined(CAMERA_MODEL_ESP_EYE)
  pinMode(13, INPUT_PULLUP);
  pinMode(14, INPUT_PULLUP);
#endif

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t *s = esp_camera_sensor_get();
  // initial sensors are flipped vertically and colors are a bit saturated
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);        // flip it back
    s->set_brightness(s, 1);   // up the brightness just a bit
    s->set_saturation(s, -2);  // lower the saturation
  }
  // drop down frame size for higher initial frame rate
  if (config.pixel_format == PIXFORMAT_JPEG) {
    s->set_framesize(s, FRAMESIZE_QVGA);
  }

#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);
#endif

#if defined(CAMERA_MODEL_ESP32S3_EYE)
  s->set_vflip(s, 1);
#endif

// Setup LED FLash if LED pin is defined in camera_pins.h
#if defined(LED_GPIO_NUM)
  setupLedFlash(LED_GPIO_NUM);
#endif
#if SMALLCAR_IS_PRODUCT
  WiFi.mode(WIFI_MODE_APSTA);
  WiFi.setSleep(false);

  uint8_t mac[6];
  if (esp_read_mac(mac, ESP_MAC_WIFI_SOFTAP) != ESP_OK) {
    memset(mac, 0, sizeof(mac));
  }

  char apSsid[32];
  snprintf(apSsid, sizeof(apSsid), "SmallCar-%02X%02X", mac[4], mac[5]);
  const char *apPassword = "smallcar123";

  bool ap_ok = WiFi.softAP(apSsid, apPassword);
  IPAddress apIP = WiFi.softAPIP();

  Serial.print("AP SSID: ");
  Serial.println(apSsid);
  Serial.print("AP IP: ");
  Serial.println(apIP);
  if (!ap_ok) {
    Serial.println("AP start failed");
  }

  char staSsid[33];
  char staPassword[65];
  staSsid[0] = '\0';
  staPassword[0] = '\0';
  bool staConfigured = load_sta_config_from_nvs(staSsid, sizeof(staSsid), staPassword, sizeof(staPassword));

  const char *staSsidToUse = NULL;
  const char *staPasswordToUse = NULL;
  if (staConfigured) {
    staSsidToUse = staSsid;
    staPasswordToUse = staPassword;
  } else {
    staSsidToUse = ssid;
    staPasswordToUse = password;
  }

  if (staSsidToUse && staSsidToUse[0] != '\0') {
    Serial.print("WiFi STA connecting to ");
    Serial.println(staSsidToUse);
    WiFi.begin(staSsidToUse, staPasswordToUse);

    unsigned long startMs = millis();
    Serial.print("WiFi connecting");
    while (WiFi.status() != WL_CONNECTED && (millis() - startMs) < 15000UL) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("");

    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("WiFi STA connected, IP: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("WiFi STA connect failed");
    }
  } else {
    Serial.println("No STA WiFi configured, AP only mode");
  }

  char mdnsName[32];
  snprintf(mdnsName, sizeof(mdnsName), "smallcar-%02X%02X", mac[4], mac[5]);
  if (!MDNS.begin(mdnsName)) {
    Serial.println("mDNS start failed");
  } else {
    MDNS.addService("http", "tcp", 80);
    MDNS.addService("ws", "tcp", 8765);
    Serial.print("mDNS hostname: ");
    Serial.println(mdnsName);
  }
#else
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
#endif

  // 标记当前 OTA 应用为有效，取消回滚保护
  // 如果不调用此函数，系统会认为当前固件处于"待验证"状态，可能阻止后续 OTA
  const esp_partition_t *running = esp_ota_get_running_partition();
  esp_ota_img_states_t ota_state;
  if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
    if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
      Serial.println("OTA: marking current app as valid (was pending verify)");
      esp_ota_mark_app_valid_cancel_rollback();
    } else {
      Serial.printf("OTA: current app state: %d\n", ota_state);
    }
  }

  bool startPreerase = false;
  nvs_handle_t h_flag;
  esp_err_t err_flag = nvs_open("ota_diag", NVS_READWRITE, &h_flag);
  if (err_flag == ESP_OK) {
    int32_t flag = 0;
    esp_err_t get_res = nvs_get_i32(h_flag, "preerase", &flag);
    if (get_res == ESP_OK && flag == 1) {
      startPreerase = true;
    }
    nvs_close(h_flag);
  } else {
    Serial.printf("OTA preerase: nvs_open for read flag failed: %d\n", (int)err_flag);
  }

  if (startPreerase) {
    Serial.println("OTA preerase: flag set, starting background erase task");
    xTaskCreatePinnedToCore(ota_preerase_task, "ota_preerase", 4096, NULL, 1, NULL, 0);
  } else {
    Serial.println("OTA preerase: flag not set, skip");
  }

  startCameraServer();

  controlWs.begin();
  controlWs.onEvent(onWsEvent);

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");
  Serial.print("Control WS: ws://");
  Serial.print(WiFi.localIP());
  Serial.println(":8765/ws_control");
}

void loop() {
  pollBatteryFromUart();
  controlWs.loop();
  delay(10);
}
