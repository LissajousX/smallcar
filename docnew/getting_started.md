# SmallCar 快速上手指南

> 目标：从 0 开始，让你在 **不深入研究源码** 的前提下，把小车跑起来，并通过网页控制。

---

## 1. 项目整体是什么？

SmallCar 由三大部分组成：

- **硬件**：底盘、电机、舵机、3S 锂电池、STM32 最小系统板、ESP32‑CAM 摄像头板。
- **固件**：
  - STM32：负责电机/舵机控制、电池电压采样；
  - ESP32‑CAM：负责 Wi‑Fi、视频流、WebSocket 控制通道和 Web 页面。
- **Web 前端 / 路由器服务**：浏览器控制界面，可以直接连小车，也可以部署在家用路由器上。

建议先把“单车 + 浏览器”跑通，再考虑路由器/iStoreOS 部署。

---

## 2. 准备工作

### 2.1 软件环境

开发者建议安装：

- **Git**：用于克隆本仓库。
- **VS Code**（推荐）+ PlatformIO 插件：编译和刷写 ESP32‑CAM 固件。
- **Python 3**：用于部分脚本（如前端打包到固件）。
- **Keil MDK / 其他支持 STM32F1 的工具链**：编译 STM32 固件（如果你需要自己改 STM32）。

如果你只想先体验，不打算立刻改固件，可以优先刷官方/预编译好的固件，而不是从源码开始构建。

### 2.2 硬件连线（简要）

详细引脚和硬件说明见 `doc/pins.md`。这里只说关键点：

- **电池 → 电源模块 → 5V/3V3**：为电机、STM32、ESP32‑CAM 供电。
- **STM32 ↔ ESP32‑CAM 串口**：
  - 用于控制指令（浏览器 → ESP32 → STM32）；
  - 用于电池电压和其它状态回传（STM32 → ESP32 → 浏览器）。
- **电机 / 舵机**：由 STM32 控制（PWM / GPIO）。

上电前确认：

- 所有 GND 共地；
- 电池分压电路接在 STM32 ADC 输入（本项目当前用 STM32 测电压）。

---

## 3. 获取代码

```bash
git clone https://github.com/yourname/smallcar.git
cd smallcar
```

> 实际仓库地址请以你当前使用的为准。

目录中比较重要的部分：

- `esp32_cam/CameraWebServer/`：ESP32‑CAM 固件（PlatformIO 工程）；
- `smallcar_keil/`：STM32 固件（Keil 工程与源码）；
- `web/`：Web 前端（浏览器控制界面）；
- `doc/`：旧文档（设计记录/备忘录）；
- `docnew/`：你现在正在看的新手友好文档。

---

## 4. 刷写 ESP32‑CAM 固件（推荐 product 模式）

### 4.1 安装 PlatformIO

在 VS Code 中安装 **PlatformIO IDE** 扩展，或直接使用命令行 `pio`。

确保 `esp32_cam/CameraWebServer/platformio.ini` 中已有以下环境（仓库默认提供）：

- `esp32cam`：极客版（geek）
- `esp32cam_product`：产品版（product）

### 4.2 连接 ESP32‑CAM

- 使用 USB‑TTL 转串口模块连接 ESP32‑CAM：
  - `TX ↔ RX`，`RX ↔ TX`，`GND ↔ GND`；
  - 按模块说明拉低 `IO0` 进下载模式（首次烧录时）。
- 选择正确的串口号（Windows 下一般是 COMx）。

### 4.3 编译并烧录 product 固件

在仓库根目录运行（或在 VS Code 的 PlatformIO 终端中）：

```bash
cd esp32_cam/CameraWebServer
pio run -e esp32cam_product          # 编译
pio run -e esp32cam_product -t upload  # 编译并烧录
```

烧录成功后，ESP32‑CAM 会启动一个 Wi‑Fi AP 热点，并提供：

- 配网向导页面：`http://192.168.4.1/setup.html`
- 控制面板页面：`http://192.168.4.1/`（首次可通过 AP 访问）

> 实际 IP 以固件实现为准，如有变化会在 `esp32_firmware.md` 中说明。

---

## 5. 刷写 STM32 固件

> 如果你使用的是已经刷好固件的成品车，可以先跳过本节。

### 5.1 打开 Keil 工程

- 在 `smallcar_keil/` 目录下找到 MDK 工程文件（`.uvproj` / `.uvprojx`）；
- 用 Keil MDK 打开，确认目标芯片型号与实际板子匹配。

### 5.2 编译并下载

- 在 Keil 中选择合适的构建目标（通常是默认的 SmallCar 应用）；
- 编译 (`Build`)；
- 通过 ST‑Link 等仿真器连接 STM32 板，下载程序到 Flash；
- 复位后保持串口与 ESP32‑CAM 正常连接。

STM32 固件在本项目中主要负责：

- 解析来自 ESP32 的驾驶/云台控制命令；
- 控制电机/舵机；
- 通过 ADC 读取电池电压，换算为大致电量百分比；
- 周期性通过串口把状态发给 ESP32。

更多细节见 [`stm32_firmware.md`](./stm32_firmware.md)。

---

## 6. 配置 Wi‑Fi（setup 页面）

当 ESP32‑CAM product 固件启动后：

1. 手机/电脑连接小车 AP（热点名称通常类似 `SmallCar-XXXX`）；
2. 在浏览器打开：`http://192.168.4.1/setup.html`；
3. 在页面上：
   - 查看“当前网络状态”；
   - 扫描附近 Wi‑Fi 或直接输入家庭 Wi‑Fi SSID 与密码；
   - 点击“保存并连接”；
4. 等待几秒，页面会轮询 `/wifi_state` 并提示：
   - 是否成功连上家庭 Wi‑Fi；
   - 路由器分配给小车的 IP（STA IP）；
   - 推荐用 `smallcar-XXXX.local` 或这个 IP 访问控制页面。

在 setup 页面底部还有：

- “从路由器一键升级产品固件”
- “从路由器一键升级极客固件”

它们会从家庭路由器上的 HTTP 服务拉取最新固件（路径见 [`ota_and_update.md`](./ota_and_update.md)），并通过 ESP32 的 `/ota` 接口刷写。

---

## 7. 打开控制面板

配网成功后，有两种访问方式：

1. **通过家庭 Wi‑Fi + mDNS**：
   - 在手机/电脑同一家庭 Wi‑Fi 下；
   - 浏览器访问 `http://smallcar-XXXX.local/`（XXXX 取决于车的标识）
   - 速度可能略慢，取决于 mDNS 解析情况。

2. **通过家庭 Wi‑Fi + 直接 IP**：
   - 在 setup 页面或路由器管理界面查看小车的 IP；
   - 直接访问 `http://<小车IP>/`；
   - 通常访问速度会比 `.local` 域名更快、更稳定。

控制面板中可以看到：

- 视频流（来自 ESP32‑CAM）；
- 方向/油门/云台控制按钮；
- 电池电量指示；
- （geek 模式下）高级设置、录像、快照等功能。

---

## 8. 下一步阅读

当你已经：

- 会刷 ESP32 / STM32 固件；
- 会通过网页控制小车；

就可以继续阅读：

- [`architecture.md`](./architecture.md)：了解整体架构和数据流；
- [`esp32_firmware.md`](./esp32_firmware.md)：想改 ESP32‑CAM 的 HTTP / WebSocket / 电池等逻辑；
- [`stm32_firmware.md`](./stm32_firmware.md)：想改电机驱动、控制协议、电池算法；
- [`web_frontend.md`](./web_frontend.md)：想改 Web UI、在路由器/iStoreOS 上部署前端；
- [`ota_and_update.md`](./ota_and_update.md)：想搞清楚各种 OTA/升级方式如何协同工作。
