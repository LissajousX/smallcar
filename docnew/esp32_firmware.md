# ESP32‑CAM 固件说明

本篇介绍 `esp32_cam/CameraWebServer` 目录下的 ESP32‑CAM 固件：它的功能、主要源码结构、如何构建与刷写，以及 product / geek 两种模式的差异。

---

## 1. 功能概览

ESP32‑CAM 固件在 SmallCar 中承担：

- 提供 Wi‑Fi（AP + STA）和 mDNS 名称（例如 `smallcar-XXXX.local`）；
- 运行 HTTP 服务器：
  - 提供控制面板页面 `/` 与资源文件；
  - 提供配网向导页面 `/setup.html`；
  - 暴露控制/状态/电池等 REST 接口；
  - 提供视频流端点 `/stream`；
- 运行 WebSocket 服务器，用于浏览器与 STM32 之间的控制通道；
- 充当 STM32 的“网络代理”：把 WebSocket 控制 JSON 翻译为 UART 文本协议，把 STM32 的状态转为 JSON 提供给前端；
- 负责自身固件 OTA 升级（`/ota`）。

---

## 2. 目录结构与关键文件

- `CameraWebServer.ino`
  - 程序入口；
  - Wi‑Fi / mDNS 初始化；
  - WebSocket 控制逻辑与串口中继；
  - 电池状态缓存与主循环；
  - 宏控制：`SMALLCAR_FW_PRODUCT` 等。

- `app_httpd.cpp`
  - 基于 ESP-IDF/Arduino HTTP Server 的 URI handler 实现；
  - `/`、`/status`、`/control`、`/battery` 等接口；
  - `/wifi_state`、`/wifi_scan`、`/wifi_config` 等配网相关接口；
  - `/version.txt`、前端静态资源（HTML/CSS/JS/SVG）等；
  - 注册 product/geek 不同的路由集。

- `tools/embed_product_frontend.py`
  - 把 `web/` 目录下的前端文件 gzip 压缩并生成 C 数组（`camera_index_product.h`）；
  - 在打包前临时修改 `config.js` 的 profile 为 `product`；
  - 供 product 固件构建前运行，使产品版前端内嵌在固件中。

- `platformio.ini`
  - 定义了构建环境：
    - `esp32cam`（geek）
    - `esp32cam_product`（product）
  - 指定芯片、分区、编译宏等。

---

## 3. product vs geek 模式

### 3.1 编译环境区分

- **geek**：
  - PlatformIO 环境：`esp32cam`；
  - 前端 profile：`config.js` 中的 `geek`；
  - UI 功能更丰富，暴露更多调试/路由器相关选项。

- **product**：
  - PlatformIO 环境：`esp32cam_product`；
  - 使用 `embed_product_frontend.py` 将前端内嵌到固件；
  - UI 更简洁：隐藏录像、高级设置部分图标等；
  - 配有 `setup.html` 配网向导和简化 OTA 按钮。

### 3.2 宏与条件编译

在 `CameraWebServer.ino` / `app_httpd.cpp` 中通常有类似：

- `SMALLCAR_IS_PRODUCT` / `SMALLCAR_IS_GEEK`；
- 根据宏决定：
  - 默认 WebSocket / 视频地址推导方式；
  - 是否编译路由器相关的功能（如上传截图到路由器）；
  - 注册哪些 URI handler（某些接口仅在 geek 模式中可用）。

---

## 4. 如何构建与刷写

### 4.1 前提

- 已安装 PlatformIO（VS Code 插件或命令行）；
- 已安装 ESP32‑CAM 所需 USB‑TTL 驱动；
- `esp32_cam/CameraWebServer` 目录下 PlatformIO 工程能正常打开。

### 4.2 product 固件构建流程

推荐流程（用于量产/用户体验）：

1. 在项目根目录执行产品前端打包脚本：

   ```bash
   cd esp32_cam/CameraWebServer
   python tools/embed_product_frontend.py
   ```

   该脚本会：

   - 读取 `web/` 下的前端文件；
   - 根据 `config.js` 的 `product` profile 生成内嵌资源；
   - 输出 `camera_index_product.h` 供后续编译使用；
   - 将 `version.txt` 也一起打包进固件，在 `/version.txt` 端点提供。

2. 用 PlatformIO 构建并刷写：

   ```bash
   pio run -e esp32cam_product
   pio run -e esp32cam_product -t upload
   ```

3. 烧录成功后，ESP32‑CAM 会启动 AP 与 HTTP 服务器，`/setup.html` 可用于配网。

### 4.3 geek 固件构建流程

适合开发调试：

```bash
cd esp32_cam/CameraWebServer
pio run -e esp32cam
pio run -e esp32cam -t upload
```

geek 模式通常假定前端从路由器或本地 HTTP 服务器加载，而不是全部内嵌在固件中。

### 4.4 刷写注意事项

- 首次烧录需将 ESP32‑CAM 置于下载模式（IO0 拉低等），具体见板卡说明；
- 选对串口号和波特率（PlatformIO 默认 115200 足够）；
- 升级失败或固件错误时，可重新进下载模式强制刷写。

---

## 5. 关键接口与交互

### 5.1 HTTP 接口（示例）

以下路径可能随代码演进有所变化，请以源码 `app_httpd.cpp` 为准：

- `/`：主控制页面（在 product 模式下通常直接内嵌在固件）。
- `/setup.html`：配网向导页面。
- `/status`：返回当前摄像头与连接状态 JSON。
- `/control`：接收参数 `var` / `val` 的控制请求（如画质相关设置）。
- `/battery`：返回电池电压/百分比和时间戳。
- `/wifi_state`、`/wifi_scan`、`/wifi_config`：配网相关接口。
- `/ota`：接收固件二进制并执行 OTA 升级。
- `/version.txt`：返回前端/固件版本字符串。

### 5.2 WebSocket 控制

- 地址通常为：`ws://<车IP>:8765/ws_control`；
- 前端通过 WebSocket 发送 JSON：

  ```jsonc
  {
    "type": "control",
    "throttle": 30,
    "steer": -20,
    "yaw": 90,
    "pitch": 90
  }
  ```

- ESP32 解析后构造 UART 命令（示例）：

  ```text
  C,30,-20,90,90\n
  ```

- STM32 解析该命令并驱动车辆。

### 5.3 串口电池数据

- STM32 周期性发送：`B,<电压mV>,<百分比>\r\n`；
- ESP32 在 `CameraWebServer.ino` 中解析该行：
  - 更新全局 `g_battery_mv`、`g_battery_percent`、`g_battery_ts_ms`；
  - `app_httpd.cpp` 的 `/battery` handler 使用这些值构造 JSON。

---

## 6. 与 Web 前端的关系

- 对于 **product 模式**：
  - 前端（HTML/CSS/JS）被 `embed_product_frontend.py` 内嵌进固件；
  - 访问 `http://<车IP>/` 即可直接看到控制面板；
  - `setup.html` 同样由 ESP32 端提供。

- 对于 **geek 模式**：
  - 前端通常部署在路由器 / 本地电脑上；
  - 控制面板通过配置的 `config.js` 使用路由器地址作为入口；
  - 浏览器端再反向连接小车的 WebSocket 和视频流。

更详细的前端结构与部署方式见 [`web_frontend.md`](./web_frontend.md)。

---

## 7. 调试建议

- 使用串口调试工具观察 ESP32 日志（PlatformIO Monitor 或其它串口终端）。
- 在浏览器的开发者工具中查看 Network / Console：
  - 确认 `/battery`、`/wifi_state`、`/status` 等接口是否正常；
  - 检查 WebSocket 是否连通。
- 若前端访问 `version.txt` 404，优先确认：
  - `web/version.txt` 是否存在；
  - product 模式下是否重新运行了 `embed_product_frontend.py`；
  - `app_httpd.cpp` 中 `/version.txt` handler 是否已注册。

---

## 8. 深入阅读

- 查看 `CameraWebServer.ino` 中的 WebSocket 处理与串口交互逻辑；
- 查看 `app_httpd.cpp` 中各 URI handler 的实现细节；
- 若需调整 product 模式内嵌前端，阅读 `tools/embed_product_frontend.py` 及 `web/` 目录结构。
