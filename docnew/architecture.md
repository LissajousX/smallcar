# SmallCar 系统架构概览

本篇文档介绍 SmallCar 的整体结构：有哪些硬件、哪些软件模块，它们之间如何协同工作。

---

## 1. 硬件组成

典型一套 SmallCar 包含：

- **底盘与动力**
  - 4 个直流电机（或 2 驱动 2 随动）；
  - TB6612FNG 等电机驱动模块；
  - 2 个 SG90 类舵机（云台俯仰/左右）。

- **控制与感知**
  - **STM32 最小系统板**（主控）：
    - 控制电机/舵机；
    - 读取电池电压；
    - 通过串口与 ESP32 交互。
  - **ESP32‑CAM 模块**：
    - 摄像头采集图像；
    - 提供 Wi‑Fi AP + STA 模式；
    - 启动 HTTP 服务器（Web 页面、REST 接口、视频流）；
    - 提供 WebSocket 控制通道。

- **电源**
  - 3 节 18650 串联（3S 锂电池，满电约 12.6V）；
  - 降压到 5V/3.3V 供给整车；
  - 电池分压电路接入 STM32 ADC，测量电压后换算百分比。

> 详细引脚分配见原 `doc/pins.md`。

---

## 2. 软件与固件模块

### 2.1 STM32 固件（`smallcar_keil/`）

角色：**车体“运动控制大脑”**。

主要职责：

- 通过 UART 接收 ESP32 转发来的控制指令；
- 驱动电机与舵机（PWM / GPIO）；
- 定时采样电池电压并转换为百分比；
- 通过 UART 周期上报电压、百分比等状态给 ESP32；
- 处理本地输入（如 PS2 手柄）和安全逻辑（低电蜂鸣等）。

内部结构（简化）：

- `main.c`：主循环、协议解析、电机/舵机调度、电池上报。
- `battery.c/h`：电池 ADC 采样与电压/百分比换算。
- 其他电机/舵机/蜂鸣器驱动模块。

### 2.2 ESP32‑CAM 固件（`esp32_cam/CameraWebServer/`）

角色：**网络与多媒体中枢**。

主要职责：

- 建立 Wi‑Fi AP + STA：
  - AP：出厂/初始配网使用（如 `SmallCar-XXXX` 热点）；
  - STA：连接家庭路由器，方便通过家里 Wi‑Fi 控制。
- 提供 HTTP 服务：
  - 前端网页（`/`、`/setup.html`、静态资源等）；
  - 控制接口 `/control`、状态接口 `/status`、电池 `/battery` 等；
  - 视频流 `/stream`（通常挂在 :81 端口）。
- 提供 WebSocket 服务：
  - 浏览器通过 WebSocket 发送控制 JSON；
  - ESP32 转换为简单文本协议，通过 UART 发给 STM32。
- 管理 OTA：
  - 提供 `/ota` 接口接收固件二进制并刷写自身；
  - 与路由器端的“固件仓库”协作，一键升级 product / geek 固件。

主要文件：

- `CameraWebServer.ino`：入口、Wi‑Fi / mDNS 配置、WebSocket 处理、串口中继、电池数据缓存等。
- `app_httpd.cpp`：HTTP 服务器与各类 URI handler（控制、状态、电池、前端、视频等）。
- `tools/embed_product_frontend.py`：将 Web 前端资源打包进 product 固件的工具脚本。

### 2.3 Web 前端（`web/`）

角色：**浏览器里的“遥控手柄”和“仪表盘”**。

主要职责：

- 为用户提供：
  - 视频预览；
  - 方向/油门/云台等控制按钮与键盘映射；
  - 电量显示与基础状态；
  - 产品模式下的简化 UI；
  - 极客模式下的高级设置、录像、快照等。
- 通过 WebSocket 与 ESP32 控制通道通信；
- 通过 HTTP 访问 ESP32 `/status`、`/battery` 等接口；
- 在路由器模式下，与 `runner-web` / Nginx 协作提供统一 Web 入口。

关键文件：

- `index.html`：主控制面板；
- `setup.html`：配网向导；
- `main.js`：核心前端逻辑（控制、状态、OTA 等）；
- `setup.js`：配网页面逻辑；
- `config.js`：前端 profile 与默认地址配置。

### 2.4 路由器 / iStoreOS 端

在许多部署方案中：

- 路由器上运行一个 `runner-web` / Nginx 服务：
  - 提供统一的 Web 入口（例如 `http://<路由器IP>:8090/`）；
  - 承载前端静态文件与截图/录像服务；
  - 暴露固件下载路径（例如 `/firmware/geek/esp32cam-latest.bin`）。
- ESP32‑CAM 的 Web 前端可以直接访问路由器提供的接口，实现：
  - 从路由器一键 OTA 升级固件；
  - 把截图/视频上传到路由器存储。

更多细节见 [`web_frontend.md`](./web_frontend.md) 与 [`ota_and_update.md`](./ota_and_update.md)。

---

## 3. 数据与控制流

### 3.1 从浏览器到电机

1. 用户在浏览器（`index.html`）里操作方向/油门或按键；
2. `main.js` 通过 WebSocket 将控制指令封装为 JSON：
   - 例如 `{ type: "control", throttle: 30, steer: -20, yaw: 90, pitch: 100 }`；
3. ESP32 WebSocket handler 收到后：
   - 解析 JSON，对数值做裁剪和安全校验；
   - 拼出简单的文本协议，如：`C,<throttle>,<steer>,<yaw>,<pitch>\n`；
   - 通过 UART 发给 STM32。
4. STM32 `main.c` 解析该文本命令：
   - 根据不同模式/档位计算每个电机 PWM 占空比；
   - 控制舵机角度；
   - 实际驱动车辆运动。

### 3.2 从电池到浏览器

1. STM32 周期性进行 ADC 采样（`battery.c`）：
   - 读取电池分压电路的电压；
   - 计算电池电压（mV）并进行简单滤波；
   - 基于配置的满电/空电电压估算 SOC（百分比）。
2. STM32 每隔若干秒通过 UART 发一行状态，如：
   - `B,<电压mV>,<百分比>\r\n`
3. ESP32 读取串口数据并解析：
   - 将最近一次的 `mv` 与时间戳缓存在全局变量中；
4. HTTP `/battery` handler 返回 JSON：
   - `{ ok: true, mv: 11800, percent: 65, age_ms: 1234 }`；
5. 前端 `main.js` 定期请求 `/battery`：
   - 使用 `mv` 按配置好的范围（例如 10.5V~12.3V）计算百分比；
   - 更新 UI 中的电池图标和文字。

### 3.3 OTA / 固件升级

以 ESP32‑CAM 为例：

1. 浏览器前端向路由器请求最新固件（产品版/极客版）；
2. 前端拿到固件 blob 后，再通过 HTTP POST 提交给 ESP32 的 `/ota`；
3. ESP32 写入 Flash，升级自身固件并重启；
4. 升级完成后，小车重新连上 Wi‑Fi，用户重新访问控制面板即可。

更详细流程与接口见 [`ota_and_update.md`](./ota_and_update.md)。

---

## 4. product 模式 vs geek 模式

项目支持两套“固件/前端组合”：

- **geek 模式**：
  - 面向开发者和高级用户；
  - 前端功能更全：录像、快照、服务健康状态、各类路由器地址配置等；
  - ESP32 固件可能暴露更多调试接口；
  - 路由器端部署配合更紧密。

- **product 模式**：
  - 面向最终用户或出厂预装场景；
  - UI 更简洁，隐藏部分高级选项（如高级设置面板、录像功能等）；
  - 增加了适合量产/售后使用的功能（如 setup 配网向导、从路由器一键 OTA 产品固件）。

两种模式在代码层面主要通过：

- 编译开关（如 `SMALLCAR_FW_PRODUCT`）；
- 前端 profile 配置（`config.js` 中的 `profiles.product` 与 `profiles.geek`）；
- CI / 部署脚本中将不同产物放到不同路径（如 `firmware/geek/` 与 `firmware/product/`）。

---

## 5. 我应该先看哪部分代码？

- 想改 **Web UI / 控制逻辑**：
  - 从 `web/index.html`、`web/main.js` 和 `web/setup.js` 入手；
- 想改 **ESP32 端 HTTP 接口或电池/配网逻辑**：
  - 看 `esp32_cam/CameraWebServer/CameraWebServer.ino` 和 `app_httpd.cpp`；
- 想改 **底盘运动特性 / 电池算法 / 本地安全保护**：
  - 看 `smallcar_keil/main.c`、`battery.c` 等 STM32 代码；
- 想改 **部署方式 / 路由器服务**：
  - 看 `docker/runner-web/`、Nginx 配置以及 `doc/remote_control.md`、`doc/esp32_cam_ota.md`。

---

## 6. 后续阅读建议

如果你已经大致理解了本篇内容，建议接着看：

- [`esp32_firmware.md`](./esp32_firmware.md) 了解 ESP32‑CAM 固件结构与构建；
- [`stm32_firmware.md`](./stm32_firmware.md) 了解 STM32 端控制逻辑与协议；
- [`web_frontend.md`](./web_frontend.md) 了解 Web 前端与路由器部署；
- [`ota_and_update.md`](./ota_and_update.md) 串联起所有 OTA/升级相关流程。
