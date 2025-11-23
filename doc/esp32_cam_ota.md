# ESP32-CAM OTA 固件升级设计与使用说明

> 本文介绍 smallcar 工程中 ESP32-CAM 固件的 OTA（Over-The-Air）升级设计、实现细节与推荐使用方法。
>
> 相关代码路径：`esp32_cam/CameraWebServer/CameraWebServer.ino`、`esp32_cam/CameraWebServer/app_httpd.cpp`、`esp32_cam/CameraWebServer/partitions.csv`。

---

## 1. 分区布局与 OTA 基本原理

### 1.1 分区表

本工程为 ESP32-CAM 使用了 **双 OTA 应用分区布局**，定义在 `esp32_cam/CameraWebServer/partitions.csv`：

```csv
# Name,   Type,  SubType, Offset,   Size,    Flags
# 标准双 OTA 分区布局，支持 HTTP OTA 升级
nvs,      data,  nvs,     0x9000,   0x5000,
otadata,  data,  ota,     0xe000,   0x2000,
app0,     app,   ota_0,   0x10000,  0x1E0000,
app1,     app,   ota_1,   0x1F0000, 0x1E0000,
```

要点：

- **`app0` / `app1`**：两个大小相同的 OTA 应用分区（约 1.9 MB），轮流作为“当前运行固件”和“下次 OTA 写入目标”。
- **`otadata`**：用于保存当前启用的应用分区及 OTA 状态（`ESP_OTA_IMG_VALID`、`PENDING_VERIFY` 等）。
- **`nvs`**：用于保存 OTA 诊断信息和预擦除标志等参数。

ESP32 的 OTA 启动流程（简化）：

1. Bootloader 根据 `otadata` 中记录的“当前启动分区”选择 `app0` 或 `app1` 启动。
2. 新固件 OTA 完成后，通过 `esp_ota_set_boot_partition()` 切换“下一次启动分区”。
3. 下次重启后，新固件第一次运行时，其 OTA 状态通常为 `ESP_OTA_IMG_PENDING_VERIFY`；
4. 程序在验证通过后调用 `esp_ota_mark_app_valid_cancel_rollback()`，将当前固件标记为 `VALID`，避免被回滚或禁止后续 OTA。

本工程已在 `CameraWebServer.ino::setup()` 中实现第 4 步。

---

## 2. HTTP OTA 接口设计

### 2.1 `/ota` 路由

在 `app_httpd.cpp` 中注册了 OTA HTTP 接口：

```cpp
httpd_uri_t ota_uri = {
  .uri = "/ota",
  .method = HTTP_POST,
  .handler = ota_post_handler,
  .user_ctx = NULL
};
```

- **方法**：`POST`
- **Body**：ESP32-CAM 固件二进制 `.bin` 内容（无需特殊 Content-Type）。
- **响应**：
  - 成功：`200 OK` + 文本 `OK`，随后设备延迟 1 秒并 `esp_restart()`；
  - 失败：`500`，并在串口与 NVS 中记录错误原因。

对应 Web 端，`web/main.js` 中通过以下方式推导 `/ota` 地址：

- 从页面输入的 **视频流地址**，例如：`http://192.168.31.140:81/stream`
- 使用 `new URL(url)` 提取协议与主机，构造：`http://192.168.31.140/ota`

### 2.2 OTA 处理流程（`ota_post_handler`）

核心步骤如下（省略错误分支）：

1. **记录 OTA 开始**
   - 将 `s_ota_last_size` 置 0，调用 `ota_diag_save_to_nvs(0, 1, 0)`；
   - 方便在异常重启时，通过 `/status` 知道 OTA 至少进入了 handler。

2. **打印当前运行/目标分区信息**
   - 使用 `esp_ota_get_running_partition()` 和 `esp_ota_get_next_update_partition(NULL)`；
   - 在串口中输出当前运行分区 label/address/size 以及 OTA 目标分区信息。

3. **检查固件大小**
   - 读取 `req->content_len`，和目标分区大小比较：
   - 若超出：`ESP_ERR_INVALID_SIZE`，记录到 NVS 并返回 500。
   - 若通过：调用 `ota_diag_save_to_nvs(0, 21, content_len)`，用 `error=21` 代表“大小检查通过”。

4. **调用 `esp_ota_begin()`**
   - 使用 `ESP_OTA_SIZE_UNKNOWN` 方式启动 OTA，内部会对目标分区做擦除：

     ```cpp
     esp_ota_handle_t ota_handle = 0;
     err = esp_ota_begin(update_partition, OTA_SIZE_UNKNOWN, &ota_handle);
     ota_diag_save_to_nvs(0, 3, err); // error=3: esp_ota_begin 返回值
     ```

5. **循环接收与写入固件数据**
   - 每次最多读 1024 字节到缓冲区 `buf`；
   - 通过 `esp_ota_write()` 写入 Flash；
   - 遇到 `recv_len<=0` 或 `esp_ota_write` 出错立即终止并记录错误；
   - `s_ota_last_size` 累加已写入字节数；
   - 每 100KB 调用 `ota_diag_save_to_nvs(0, 0, s_ota_last_size)` 更新进度（`result=0` 表示进行中）。

6. **结束 OTA 并切换启动分区**
   - `esp_ota_end(ota_handle)` 完成完整性检查；
   - `esp_ota_set_boot_partition(update_partition)` 设置下一次启动分区；
   - HTTP 响应 `OK`；
   - 记录成功：`ota_diag_save_to_nvs(1, ESP_OK, s_ota_last_size)`；
   - 在 NVS 中设置预擦除标志 `ota_diag/preerase = 1`（见下文）；
   - 延时 1 秒后 `esp_restart()`。

整个过程中，**任何一步失败**都会：

- 在串口输出详细错误码；
- 调用 `ota_diag_save_to_nvs(-1, err, size)` 记录失败状态；
- 返回 HTTP 500 以提醒前端。

---

## 3. OTA 诊断信息与 `/status` 接口

### 3.1 NVS 诊断键值

在 `OTA_NVS_NAMESPACE = "ota_diag"` 下维护以下键：

- `result`（`OTA_NVS_KEY_RESULT`）：
  - `0`：进行中或未完成；
  - `1`：最近一次 OTA 成功；
  - `-1`：最近一次 OTA 失败。
- `error`（`OTA_NVS_KEY_ERROR`）：
  - 非 0 时为 `esp_err_t` 或自定义阶段标志（如 1、2、3、21 等）；
  - 可用于粗略判断失败阶段（进入 handler、找到分区、大小检查通过、`esp_ota_begin` 返回等）。
- `size`（`OTA_NVS_KEY_SIZE`）：
  - 成功时：最终写入的固件字节数；
  - 某些阶段（如 `error=3`）被临时用于记录返回值。
- `ts`（`OTA_NVS_KEY_TS`）：
  - 最近一次 OTA 结束（成功/失败）的时间戳，单位毫秒。
- `preerase`（`OTA_NVS_KEY_PREERASE`）：
  - `0`：默认 / 无需预擦除；
  - `1`：表示 **OTA 刚成功，下一次启动需要对备用应用分区做一次背景预擦除**。

### 3.2 `/status` JSON 字段

`app_httpd.cpp` 中的 `/status` 接口会在 JSON 中附带 OTA 相关字段，例如：

```jsonc
{
  "ota_running_label": "app0",
  "ota_running_addr": 1048576,
  "ota_running_size": 1966080,
  "ota_next_label": "app1",
  "ota_next_addr": 2097152,
  "ota_next_size": 1966080,
  "ota_last_result": 1,
  "ota_last_error": 0,
  "ota_last_size": 1234560,
  "ota_last_ts": 1732345678901
}
```

- `ota_running_*`：当前运行分区信息；
- `ota_next_*`：下一次 OTA 目标分区信息；
- `ota_last_*`：最近一次 OTA 的状态、错误码、写入大小与结束时间。

前端在无串口日志的情况下，可以通过 `/status` 诊断 OTA 是否成功、失败在哪个阶段。

---

## 4. 预擦除任务：一次性擦干净备用 OTA 分区

### 4.1 设计初衷

对于接近 1.9 MB 的大固件，如果每次 OTA 都在 `esp_ota_begin()` 内部执行整分区擦除：

- 擦除时间较长；
- 在摄像头 + Wi-Fi 高负载下容易触发看门狗（尤其是硬件 TG1WDT）。

为此，本工程引入了一个**后台预擦除任务**：

- 只在 OTA 成功后的**下一次启动**执行一次；
- 在空闲时分块擦除备用 OTA 分区，减少下一次 OTA 中 `esp_ota_begin()` 的擦除工作量；
- 避免每次上电都去擦整块 Flash。

### 4.2 NVS 标志位与执行时机

1. OTA 成功时（`ota_post_handler` 尾部）：

   ```cpp
   ota_diag_save_to_nvs(1, ESP_OK, s_ota_last_size);
   nvs_handle_t h_flag;
   esp_err_t err_flag = nvs_open(OTA_NVS_NAMESPACE, NVS_READWRITE, &h_flag);
   if (err_flag == ESP_OK) {
     int32_t flag = 1;
     nvs_set_i32(h_flag, OTA_NVS_KEY_PREERASE, flag);
     nvs_commit(h_flag);
     nvs_close(h_flag);
   }
   ```

   将 `preerase` 设置为 1，表示“下次启动需要预擦除”。

2. 开机时（`CameraWebServer.ino::setup()`）：

   ```cpp
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
   }

   if (startPreerase) {
     Serial.println("OTA preerase: flag set, starting background erase task");
     xTaskCreatePinnedToCore(ota_preerase_task, "ota_preerase", 4096, NULL, 1, NULL, 0);
   } else {
     Serial.println("OTA preerase: flag not set, skip");
   }
   ```

   - 若 `preerase==1`：创建 `ota_preerase_task`；
   - 否则：跳过，不做任何擦除。

3. 预擦除任务本身（`ota_preerase_task`）：

   - 选取当前非运行的 OTA 分区作为目标；
   - 按 **4 KB** 分块擦除，并在每块后 `vTaskDelay(50ms)` 让出 CPU：

     ```cpp
     const size_t chunk = 4 * 1024;
     while (offset < target->size) {
       size_t erase_size = chunk;
       if (offset + erase_size > target->size) {
         erase_size = target->size - offset;
       }
       esp_err_t err = esp_partition_erase_range(target, offset, erase_size);
       ...
       offset += erase_size;
       vTaskDelay(pdMS_TO_TICKS(50));
     }
     ```

   - 全部分区擦除完成后，将 `preerase` 清零：

     ```cpp
     nvs_handle_t h_flag;
     esp_err_t err_flag = nvs_open("ota_diag", NVS_READWRITE, &h_flag);
     if (err_flag == ESP_OK) {
       int32_t flag = 0;
       nvs_set_i32(h_flag, "preerase", flag);
       nvs_commit(h_flag);
       nvs_close(h_flag);
     }
     ```

### 4.3 一致性保证

- 如果预擦除任务在中途因为 `TG1WDT_SYS_RESET` 等原因被打断：
  - 任务不会执行到“清零 `preerase`”这一步；
  - 下一次启动仍会看到 `preerase==1`，继续预擦除；
  - 即使只擦除了一部分，今后 OTA 时，`esp_ota_begin()` 会对未擦完的区域再次擦除，**不会影响正确性**。
- 只有当整块备用分区成功擦完，才会把 `preerase` 置为 0，确保不会遗漏“脏块”。

---

## 5. 看门狗配置与注意事项

### 5.1 Task Watchdog 全局关闭

Arduino-ESP32 默认启用了 Task Watchdog（TWDT），在 Flash 擦除时间较长时可能会触发：

- 本工程中在 `setup()` 中调用：

  ```cpp
  esp_task_wdt_deinit();
  Serial.println("Task WDT deinitialized");
  ```

  用于彻底注销 Task Watchdog，避免在 OTA / 预擦除时因任务未及时喂狗而被复位。

### 5.2 硬件 TG1WDT 仍然存在

需要注意：

- `esp_task_wdt_deinit()` 只能关闭 Task Watchdog 这一层；
- 底层的 **Timer Group 1 Watchdog (TG1WDT)** 仍可能在极端长时间阻塞时触发；
- 典型串口日志：`rst:0x8 (TG1WDT_SYS_RESET)`。

为减小触发概率，本工程做了以下实践：

- OTA 与预擦除使用 **较小的擦除块**（4KB）+ 周期性 `vTaskDelay()`；
- 关闭 `Serial.setDebugOutput(true)`，减少摄像头/Wi-Fi 内部 debug 串口输出带来的阻塞；
- 建议在发起 OTA 之前 **关闭视频流预览页面**，减少摄像头与 Wi-Fi 的额外负载。

更加详细的故障分析见专门文档：`doc/esp32_cam_ota_troubleshooting.md`。

---

## 6. Web 端 OTA 使用方法

前端页面位于 `web/` 目录，`index.html` 中的“ESP32-CAM 固件升级”区域提供两种 OTA 方式：

1. **本地文件升级**：上传本机的 `.bin` 固件；
2. **从路由器一键升级**：从 `http://<路由器IP>:8099/firmware/esp32cam-latest.bin` 获取最新固件并推送到当前 ESP32-CAM。

### 6.1 前置条件：正确填写视频流地址

- 在顶部的“视频流地址”输入框中填写：

  ```text
  http://<ESP32_IP>:81/stream
  ```

- Web 前端会据此推导：
  - `http://<ESP32_IP>/ota`：OTA 上传接口；
  - `http://<ESP32_IP>/capture`：拍照接口；
  - `http://<ESP32_IP>/control?...`：补光灯和摄像头参数控制接口。

### 6.2 本地文件升级流程

1. 打开浏览器 Web 控制面板（一般为 `http://<路由器IP>:8090/`）。
2. 顶部填写正确的 **视频流地址** 并确认能看到实时视频。
3. 在“ESP32-CAM 固件升级”区域：
   - 选择本地 `.bin` 固件文件；
   - 点击“本地文件升级”；
   - 页面会弹出确认对话框，提示不要在升级过程中断电或刷新页面。
4. 点击确认后，前端通过 `fetch(POST /ota)` 上传固件：
   - 若请求成功发送：界面显示“升级请求已发送，设备将自动重启”；
   - ESP32-CAM 完成写入后会自动重启。
5. 几秒后重新加载视频流，并在界面状态栏或 `/status` 中确认：
   - `fw_version` / `fw_build` 已更新；
   - `/status` 中 `ota_last_result=1`，`ota_last_error=0`。

### 6.3 从路由器一键升级

前提：

- 路由器上通过 CI 或其它方式，在 `http://<路由器IP>:8099/firmware/esp32cam-latest.bin` 提供最新固件；
- Web 页面的“固件服务器”输入框（`router-base`）默认为 `http://192.168.31.1:8099`，可根据需要修改。

流程：

1. 确认路由器已启动小车 Web 控制面板（`http://<路由器IP>:8090/`）。
2. 确认顶部“视频流地址”填写的 ESP32-CAM IP 正确。
3. 点击“从路由器一键升级”：
   - 前端先从 `router-base/firmware/esp32cam-latest.bin` 拉取固件；
   - 再将该二进制通过 `POST /ota` 推送给当前 ESP32-CAM；
   - 整个过程不依赖本地 PC 存储固件文件。
4. 升级完成后设备自动重启，同样可通过 `/status` 验证结果。

---

## 7. CI 自动构建与发布 OTA 固件

本工程通过 **iStoreOS 路由器上的 Docker 容器 + GitHub Actions self-hosted runner** 实现了 ESP32-CAM 固件与 Web UI 的自动构建和发布。

相关文件：

- `docker/runner-web/Dockerfile`：构建包含 Nginx + GitHub Actions Runner + PlatformIO 的基础镜像；
- `docker/runner-web/rebuild-runner-web.sh`：在路由器上重建/启动 `smallcar-runner-web` 容器；
- `.github/workflows/deploy-istoreos.yml`：CI 工作流，自动构建 ESP32-CAM 固件并同步到 Nginx 文档根目录。

### 7.1 Docker Runner 容器布局

`smallcar-runner-web` 容器的关键点：

- 基于 `ubuntu:22.04`，安装：
  - `nginx`：对外提供静态 Web 文件和 OTA 固件；
  - `python3 + pip + platformio`：用于在 CI 中编译 ESP32-CAM 固件；
  - `git`、`curl` 等基础工具；
- `WORKDIR=/actions-runner`，下载并解压 GitHub Actions Runner；
- 暴露端口 `80`，由 `rebuild-runner-web.sh` 将宿主机端口 **8099** 映射到容器 `80`：

  ```sh
  docker run -d \
    --name smallcar-runner-web \
    --restart unless-stopped \
    -p 8099:80 \
    -v /mnt/.../webroot:/usr/share/nginx/html \
    -v /mnt/.../actions-runner:/actions-runner \
    ...
  ```

- Nginx 的静态根目录位于容器内 `/usr/share/nginx/html`（兼容 `/var/www/html`），CI 会将：
  - Web 控制页面 `web/` 拷贝到该目录；
  - ESP32-CAM 固件 `.bin` 拷贝到该目录下的 `firmware/` 子目录。

### 7.2 GitHub Actions 工作流：自动构建与发布固件

工作流文件：`.github/workflows/deploy-istoreos.yml`，触发条件：

- push 到 `main` 分支，且改动包含：
  - `web/**`（Web UI）；
  - `esp32_cam/CameraWebServer/**`（ESP32-CAM 固件源代码）；
- 或手动在 GitHub Actions 页面执行 `workflow_dispatch`。

具体步骤：

1. **Checkout 仓库**

   ```yaml
   - uses: actions/checkout@v4
   ```

2. **检测 ESP32 固件是否有改动**（`id: esp32_changes`）：

   - 若当前提交是仓库首个提交，则认为“有改动”；
   - 否则对比 `HEAD^..HEAD` 下 `esp32_cam/CameraWebServer` 是否有修改：

   ```sh
   if git diff --quiet HEAD^ HEAD -- esp32_cam/CameraWebServer; then
     echo "changed=false" >> "$GITHUB_OUTPUT"
   else
     echo "changed=true"  >> "$GITHUB_OUTPUT"
   fi
   ```

3. **使用 PlatformIO 编译 ESP32-CAM 固件**（仅在 `changed == true` 时执行）：

   ```sh
   cd esp32_cam/CameraWebServer
   SHORT_SHA=$(git rev-parse --short HEAD)
   export FW_VERSION="${GITHUB_REF_NAME:-dev}-${SHORT_SHA}"
   pio run -e esp32cam
   ```

   - `platformio.ini` 中的 `build_flags` 会把 `FW_VERSION` 作为宏注入到固件中：

     ```ini
     build_flags =
       -D CAMERA_MODEL_AI_THINKER
       -D FW_VERSION="${sysenv.FW_VERSION}"
     ```

   - 编译产物位于：`esp32_cam/CameraWebServer/.pio/build/esp32cam/firmware.bin`。

4. **同步 Web UI 到 Nginx 文档根目录**：

   - 将 `web/` 内容拷贝到容器内 `/usr/share/nginx/html` 与 `/var/www/html`；
   - *保留* `firmware/` 子目录（不删除其中已有的固件文件）；
   - 执行 `nginx -s reload` 使变更立即生效。

5. **发布固件到 `/firmware`**（仅在 `changed == true` 时执行）：

   - 从 PlatformIO 输出路径复制固件：

     ```sh
     FIRMWARE_SRC="esp32_cam/CameraWebServer/.pio/build/esp32cam/firmware.bin"
     VERSION=$(git rev-parse --short HEAD)
     for ROOT in /usr/share/nginx/html /var/www/html; do
       mkdir -p "$ROOT/firmware"
       cp "$FIRMWARE_SRC" "$ROOT/firmware/esp32cam-${VERSION}.bin"
       cp "$FIRMWARE_SRC" "$ROOT/firmware/esp32cam-latest.bin"
     done
     ```

   - 对外通过路由器端口 **8099** 暴露：

     ```text
     http://<路由器IP>:8099/firmware/esp32cam-latest.bin
     http://<路由器IP>:8099/firmware/esp32cam-<git-short-sha>.bin
     ```

### 7.3 Web 端如何消费 CI 生成的固件

在 Web 控制面板中：

- “固件服务器（可选）”输入框 `router-base` 默认值为：

  ```text
  http://192.168.31.1:8099
  ```

- “从路由器一键升级”按钮会基于 `router-base` 拼出固件 URL：

  ```text
  <router-base>/firmware/esp32cam-latest.bin
  ```

- 前端逻辑：
  1. 从上述 URL 拉取最新固件 Blob；
  2. 再根据“视频流地址”推导当前 ESP32-CAM 的 IP，构造 `http://<ESP32_IP>/ota`；
  3. 通过 `POST /ota` 将 Blob 推送到设备上完成 OTA。

整体链路：**push 到 GitHub → CI 在 Docker Runner 中编译固件 → Nginx 提供 `/firmware/esp32cam-latest.bin` → Web UI 一键 OTA**。

---

## 8. 推荐 OTA 使用建议

- **操作前**：
  - 确认当前 ESP32-CAM 的 IP 地址与视频流地址正确；
  - 尽量关闭视频流预览页面，避免 OTA 期间摄像头与网络负载过高；
  - 若在暗光环境下，注意补光灯可能在视频流结束时被自动关闭。

- **升级过程中**：
  - 不要断电或重启路由器；
  - 不要频繁刷新 Web 控制页或切换网络环境。

- **升级后**：
  - 通过 `/status` 检查 `fw_version` / `fw_build` 与 `ota_last_*` 字段；
  - 如遇到 `TG1WDT_SYS_RESET` 或二次 OTA 失败问题，可参考 `doc/esp32_cam_ota_troubleshooting.md` 进行排查。

---

## 9. 相关文档

- `doc/remote_control.md`：整体远程控制架构、ESP32-CAM 与 STM32 的串口协议。
- `doc/esp32_cam_ota_troubleshooting.md`：本工程中曾出现的“烧录后二次 OTA 失败（TG1WDT_SYS_RESET）”问题的详细定位与解决过程。
