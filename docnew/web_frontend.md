# Web 前端与路由器部署说明

本篇介绍 `web/` 目录下的浏览器前端，以及它如何与 ESP32‑CAM 和路由器/iStoreOS 协同工作。

---

## 1. 前端的角色

Web 前端是用户最直接接触的部分，主要负责：

- 在浏览器中展示视频画面、电池状态和其他信息；
- 提供驾驶/云台控制界面（按钮、键盘、触摸摇杆等）；
- 与 ESP32‑CAM 建立 WebSocket 控制通道和 HTTP 状态通道；
- 提供 OTA 升级按钮（本地文件、从路由器一键升级）；
- 在路由器模式下，充当小车控制台的“入口网站”。

---

## 2. 目录结构概览

`web/` 目录中的主要文件：

- `index.html`：主控制面板页面；
- `setup.html`：配网向导页面；
- `main.js`：主控制面板逻辑；
- `setup.js`：配网页面逻辑；
- `style.css`：公共样式；
- `config.js`：前端 profile 配置（geek / product）；
- `version.txt`：版本字符串，用于显示前端/固件版本；
- 图标和占位图：`favicon.svg`、`placeholder-video.svg` 等。

---

## 3. config.js 与前端 Profile

`config.js` 定义了不同“运行环境”的默认参数，例如：

- WebSocket / 视频流 / 路由器服务的默认地址；
- 当前激活的 profile 名称：`activeProfile`；
- `profiles.geek`、`profiles.product` 等配置项。

在构建产品固件时，`embed_product_frontend.py` 会临时修改 `config.js` 以激活 `product` profile，使得内嵌前端默认以产品模式运行。

---

## 4. index.html：主控制面板

### 4.1 布局

典型布局包含：

- 顶部标题栏（显示版本与电量等状态）；
- 左侧/中间：视频预览区域，包含播放按钮、亮度调节、录像/截图按钮等；
- 右侧：控制面板（油门、转向、云台、状态数值）；
- 底部或弹窗：
  - **高级设置（geek 模式）**：摄像头画质、白平衡、曝光、补光灯亮度等；
  - **OTA 升级区域**：本地文件升级 + 从路由器一键升级（geek & product）。

### 4.2 与 ESP32 交互

`main.js` 中主要逻辑：

- 解析用户输入（按钮、键盘、触摸摇杆），构造控制 JSON；
- 管理 WebSocket 连接状态，自动重连或反馈错误；
- 解析 `/battery`、`/status` 等接口返回的 JSON，更新 UI 状态；
- 处理 OTA 升级按钮点击事件：
  - 本地文件刷写：读取用户选择的 `.bin` 文件，POST 到 `/ota`；
  - 从路由器一键升级：先从路由器 URL 获取固件，再 POST 到 `/ota`。

### 4.3 product 模式下的 UI 简化

当 `APP_MODE.isProduct` 为真时，`main.js` 会：

- 隐藏录像按钮、服务健康图标等高级元素；
- 隐藏“高级设置”入口弹窗；
- 调整一些默认地址推导逻辑（例如直接从 `window.location` 推导小车 IP）。

这样，最终用户看到的是简洁版控制面板，而极客用户仍可使用 geek 模式获得完整功能。

---

## 5. setup.html：配网向导

`setup.html` 与 `setup.js` 主要用于：

- 显示当前 Wi‑Fi 状态：
  - 小车 AP SSID 与 IP；
  - 是否已配置家庭 Wi‑Fi、是否已连接、STA IP 等；
- 扫描附近 Wi‑Fi 并供用户选择；
- 提交家庭 Wi‑Fi SSID/密码到 ESP32 的 `/wifi_config`；
- 轮询 `/wifi_state`，在配网后提示如何通过 mDNS 或 IP 访问控制面板；
- 在底部提供简化版 OTA 按钮：
  - “从路由器一键升级产品固件”；
  - “从路由器一键升级极客固件”。

这些 OTA 按钮使用与主控制面板类似的逻辑：

1. 从固定 `DEFAULT_ROUTER_BASE`（例如 `http://192.168.31.1:8099`）下载固件：
   - 产品版：`/firmware/product/esp32cam-product-latest.bin`；
   - 极客版：`/firmware/geek/esp32cam-latest.bin`；
2. 再 POST 到当前小车的 `/ota` 接口。

---

## 6. 路由器 / iStoreOS 部署概览

> 具体脚本与配置以仓库中的 `docker/runner-web/`、`.github/workflows/` 以及原 `doc/` 下的文档为准，这里只给出概念级说明。

### 6.1 目标

- 在家用路由器或一台 Linux 服务器上跑一个 Nginx/runner-web 容器；
- 统一提供：
  - Web 控制面板入口（通常是 `http://<路由器IP>:8090/` 或类似端口）；
  - 截图/录像服务；
  - 固件下载目录 `/firmware/...`，给 ESP32 OTA 使用。

### 6.2 静态资源与固件路径

CI 脚本与部署流程通常会：

- 将 `web/` 构建结果复制到 Nginx Web 根目录（如 `/www/smallcar-web/`）；
- 将 ESP32 固件 `.bin` 产物复制到：
  - `firmware/geek/esp32cam-latest.bin`；
  - `firmware/product/esp32cam-product-latest.bin`；
- （可选）提供 STM32 固件下载路径，供未来 OTA 使用。

### 6.3 前端如何找到路由器

- 在 geek 模式下，`config.js` 中的 `defaultRouterBase` 通常指向路由器的 Web 服务地址；
- 前端 `main.js` 使用这个地址调用：
  - `/snapshot_health`、`/video_health` 等服务健康检查；
  - `/firmware/...` 获取固件进行 OTA 升级；
  - `/upload_snapshot`、`/record_video` 等上传/录制接口。

在产品模式下：

- 控制面板更多依赖“小车自身内嵌的前端”；
- 路由器主要作为固件/媒体的“云端仓库”，由 OTA / 上传逻辑按需访问。

---

## 7. 本地开发与调试

### 7.1 本地起一个 HTTP 服务器

在 `web/` 目录中可以用 Python 简单起一个开发服务器：

```bash
cd web
python -m http.server 8000
```

然后在浏览器打开：`http://localhost:8000/`。

此时：

- `main.js` / `config.js` 会根据 profile 决定连接哪个 ESP32；
- 你可以同时连上真实小车进行调试。

### 7.2 典型调试步骤

- 使用浏览器开发者工具查看：
  - Network：
    - `/battery`、`/status`、`/wifi_state`、`/ota` 是否 200；
    - 路由器相关接口是否可达；
  - Console：是否有 JavaScript 错误或 CORS 问题；
- 观察界面上：
  - 电池图标是否更新；
  - 控制按钮是否响应小车动作；
  - OTA 状态提示文案是否符合预期。

---

## 8. 小结

Web 前端是用户体验的关键：

- geek 模式提供完整的调试与高级功能；
- product 模式则更适合一般用户和量产场景；
- 两者共用同一套 `web/` 代码，通过 `config.js` profile 与构建脚本来区分行为。

掌握本篇内容后，你可以：

- 安全地修改 UI 和交互逻辑；
- 搭建自己的路由器端控制台与固件仓库；
- 在不改固件的前提下，通过前端配置提升使用体验。
