#include "esp_camera.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebSocketsServer.h>
#include <string.h>

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

// ===========================
// Enter your WiFi credentials
// ===========================
const char *ssid = "IronMan";
const char *password = "Loveyou3000.";

static const int UART_RX_PIN = 12;
static const int UART_TX_PIN = 13;
static const unsigned long UART_BAUD = 115200;

HardwareSerial &ControlSerial = Serial2;
WebSocketsServer controlWs(8765);
bool wsClientConnected = false;
uint8_t wsClientId = 0xFF;  // 当前占用控制权的客户端编号

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

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

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

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");

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
  controlWs.loop();
  delay(10);
}
