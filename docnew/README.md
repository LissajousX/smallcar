# SmallCar 新文档总览（docnew）

本目录是一套**面向新手**的 SmallCar 项目文档。假设你：

- 还不熟悉 ESP32 / STM32 / Web 前端
- 希望“照着步骤做”就能先把小车跑起来
- 之后再慢慢深入固件、协议和部署细节

如果你已经会看代码，建议先快速浏览这里的结构，然后按需跳转具体文档。

---

## 文档导航

按阅读顺序推荐：

1. **[`getting_started.md`](./getting_started.md)**  
   从零开始装好小车、刷好固件、连上网页控制台的完整步骤。

2. **[`architecture.md`](./architecture.md)**  
   整个系统长什么样：硬件、两块 MCU、Wi‑Fi / Web、数据流向。

3. **[`esp32_firmware.md`](./esp32_firmware.md)**  
   ESP32‑CAM 固件的功能、编译和刷写（PlatformIO），以及 product / geek 两种模式。

4. **[`stm32_firmware.md`](./stm32_firmware.md)**  
   STM32 主控固件的职责、Keil 工程结构、串口控制协议、电池采集等。

5. **[`web_frontend.md`](./web_frontend.md)**  
   Web 前端项目结构、开发调试、路由器/iStoreOS 部署、小车前端访问方式。

6. **[`ota_and_update.md`](./ota_and_update.md)**  
   ESP32 OTA 升级、通过路由器一键升级 product / geek 固件、未来 STM32 OTA 设计思路。

7. **[`troubleshooting.md`](./troubleshooting.md)**  
   常见问题：连不上车、没有视频、控制延迟大、`version.txt` 404、电池数值怪异、OTA 失败等。

---

## 适合哪些读者？

- **完全新手**：按 `getting_started.md` 一步步来，不需要先看一堆概念。
- **想改代码的开发者**：
  - 看 `architecture.md` 了解整体结构；
  - 再按需要查 `esp32_firmware.md`、`stm32_firmware.md`、`web_frontend.md`。
- **部署/运维同学**：
  - 重点看 `web_frontend.md` 和 `ota_and_update.md`，了解路由器端服务与 OTA 升级流程。

---

## 与旧文档的关系

仓库原本的 `doc/` 目录中已经有一些专题文档，例如：

- `remote_control.md`：远程控制协议与部署
- `esp32_cam_ota.md`：ESP32‑CAM OTA 升级细节
- `battery_warning.md`：电量预警设计草案
- `pins.md`：硬件引脚说明

这些文档偏“备忘录 / 设计记录”，对新人不够连贯。

`docnew/` 的目标是：

- 提供**从 0 到能跑**的一条清晰路径；
- 用尽量少的前置知识解释核心概念；
- 在需要深入时，再指向旧文档或源码位置。

你可以把 `docnew/` 当作“新手入口”和“主线手册”，原有 `doc/` 则更像是“附录”和“设计文档”。

---

## 快速开始

如果你刚拿到一套 SmallCar：

1. 打开 [`getting_started.md`](./getting_started.md)。  
2. 跟着“硬件准备 → 刷写固件 → 配网 → 打开控制台”的顺序一步步做。  
3. 碰到任何术语（如 *product 固件*、*runner‑web*、*iStoreOS*）不理解，可以在 `architecture.md` 或对应专题文档里查。

---

## 贡献与反馈

如果你在跟文档操作的过程中遇到：

- 步骤不清楚或容易踩坑；
- 某些命令/路径已过期；
- 有更简单的实践经验；

欢迎在仓库提 Issue 或 PR，直接修改 `docnew/` 下对应文档，并补充你遇到的现象和环境信息（操作系统、固件版本等）。
