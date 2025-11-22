# STM32 四轮差速遥控小车（smallcar）

基于 **STM32F103C8T6** + **TB6612FNG** 四轮差速驱动 + **PS2 无线手柄** 的遥控小车工程，
并在此基础上集成了 **ESP32-CAM + Web 浏览器 + iStoreOS 路由器** 的远程控制与视频回传链路。

当前工程主要使用 **Keil µVision5 + ARMCC V5** 开发 STM32 固件，并配套完整的上位机链路：

- 底层：四轮差速驱动 + PS2 无线手柄 + 双舵机云台；
- 中间层：ESP32-CAM 作为 **视频 + 控制网关**（WebSocket ⇄ UART）；
- 上层：浏览器 Web 控制面板 + iStoreOS 路由器上的自动部署/更新。

## 项目亮点

- **真实四驱差速底盘 + 云台**：
  - 四轮差速电机控制（左右并联驱动），支持原地旋转、差速转弯；
  - 双舵机云台（Yaw/Pitch），支持步进与摇杆连续微调。

- **本地 PS2 手柄体验**：
  - SELECT 三挡速度（60% / 80% / 100%）；
  - R1/R2 油门，L1/L2 原地左右旋转，方向键 + 左摇杆配合差速转弯。

- **浏览器远程控制 + 实时视频**：
  - Web UI 直接在浏览器里看 ESP32-CAM 视频流；
  - 可视化控制小车运动与云台角度；
  - 一键拍照生成缩略图，支持页面内预览与保存；
  - 控制 ESP32-CAM 补光灯亮/灭，适应弱光环境。

- **简单清晰的远程控制协议**：
  - ESP32-CAM 接收 JSON：`{ type:"control", throttle, steer, yaw, pitch }`；
  - 网关转换为 UART 文本：`C,throttle,steer,yaw,pitch\n` 发给 STM32；
  - STM32 固件在一定超时时间内优先使用远程命令覆盖 PS2。

- **一键部署与自动更新**：
  - 裸机方案：`deploy_istoreos.sh` 一键在 iStoreOS/OpenWrt 上部署 Web（支持 `uninstall` 恢复干净环境）；
  - Docker + CI 方案：在 iStoreOS 上跑一个 Nginx + GitHub Actions Runner 容器，push 到 GitHub 后自动拉取最新 `web/` 并更新页面。

> 如果你只是想“快速玩起来”：
>
> 1. 按 `doc/pins.md` 接好硬件、烧录 STM32 和 ESP32-CAM 固件；
> 2. 选一种 Web 部署方式（裸机脚本或 Docker + CI），打开 `http://<路由器IP>:8090/`；
> 3. 在浏览器里控制小车和云台，看实时视频、拍照和开关补光灯。

更多关于远程控制协议、ESP32-CAM 固件和 iStoreOS 部署细节，详见 `doc/remote_control.md`。

---

## 1. 仓库结构

```text
smallcar/
├─ doc/                        # 文档：协议、键位映射、引脚等
│   ├─ ps2_protocol.md         # PS2 手柄协议与 STM32 接线/时序说明
│   ├─ ps2_keymap.md           # PS2 键位与控制映射 + Data[] 实测
│   ├─ pins.md                 # 引脚定义汇总（电机/PS2/云台）
│   └─ remote_control.md       # ESP32-CAM + Web + STM32 远程控制架构与协议
├─ esp32_cam/                  # ESP32-CAM 摄像头 + WebSocket + UART 网关固件
│   └─ CameraWebServer/...
├─ web/                        # 浏览器端 Web 控制面板（静态 HTML/CSS/JS）
│   ├─ index.html              # 主页面结构（视频预览 + 控制面板）
│   ├─ style.css               # 布局与样式（响应式 + 悬浮控制）
│   └─ main.js                 # WebSocket 控制逻辑 + UI 交互
├─ docker/
│   └─ runner-web/             # 单容器 Nginx + GitHub Actions Runner（iStoreOS 上自动部署 Web）
├─ .github/
│   └─ workflows/              # CI 工作流（在 Docker Runner 内同步 web/ 到 Nginx）
├─ deploy_istoreos.sh          # 裸机方式将 web/ 部署到 iStoreOS/OpenWrt 的脚本（支持 uninstall）
├─ .gitignore                  # Git 忽略规则
├─ README.md                   # 本项目说明（当前文档）
└─ smallcar_keil/              # **当前主工程（Keil µVision5）**
    ├─ main.c                  # 主循环和 PS2 控制逻辑
    ├─ motor.c / motor.h       # 电机驱动（TB6612 + TIM3 PWM）
    ├─ ps2.c / ps2.h           # PS2 手柄 GPIO SPI 驱动与按键/摇杆解析
    ├─ servo.c / servo.h       # 双舵机云台控制（TIM2_CH1/CH2）
    ├─ pins.md                 # 工程目录内的引脚说明（与 doc/pins.md 内容相同）
    ├─ smallcar_keil.uvprojx   # Keil 工程文件（必需）
    ├─ smallcar_keil.uvoptx    # Keil 选项文件
    └─ RTE/Device/...          # CMSIS/Startup/System 文件
```

实际开发/编译主要使用 `smallcar_keil` 目录。

---

## Web UI 截图（PC）

下图为当前基于浏览器的 SmallCar 远程控制面板（桌面端）示意：

![SmallCar Web 控制界面（PC）](doc/image/pc.jpg)

---

## 2. 硬件组成

- **主控 MCU**：STM32F103C8T6
- **电机驱动**：TB6612FNG
  - 左侧两轮并联为“左轮”；右侧两轮并联为“右轮”
- **电机**：4× 直流电机
- **遥控器**：PS2 无线手柄（须支持模拟模式）
- **舵机**：2× 9g/12g 舵机（如 SG90/MG90S），组成摄像头云台：
  - 舵机 1：水平 Yaw
  - 舵机 2：俯仰 Pitch
- **电源建议**：
  - 电机电源（TB6612 VM）：如 7.4V/11.1V 电池
  - 逻辑电源（STM32、TB6612 VCC、PS2 接收端）：5V/3.3V
  - 舵机电源：单独 5V ≥2A 模块
  - **所有 GND 共地**

详细引脚定义见 `doc/pins.md`，PS2 键位与控制映射详见 `doc/ps2_keymap.md`。

---

## 3. 引脚概览（简要）

完整表格请看 `doc/pins.md`，这里给一个简要概览：

### 3.1 电机 + TB6612FNG

- STBY：PA3
- 左轮 PWM：PB0（TIM3_CH3）
- 右轮 PWM：PB1（TIM3_CH4）
- 左轮方向：PB12（AIN1）、PB13（AIN2）
- 右轮方向：PB14（BIN1）、PB15（BIN2）

### 3.2 PS2 无线手柄（GPIO SPI）

- ATT/SEL (CS)：PA4
- CLK：PA5
- DATA (DI)：PA6（上拉输入）
- CMD (DO)：PA7

### 3.3 双舵机云台

- 云台水平 Yaw：PA0（TIM2_CH1）
- 云台俯仰 Pitch：PA1（TIM2_CH2）

---

## 4. 开发环境

- IDE：Keil µVision 5
- 编译器：ARMCC V5.06 (ARM-ADS)
- 设备包：`Keil.STM32F1xx_DFP.2.4.0`
- 启动与系统：RTE 内自动生成的 `startup_stm32f10x_md.s`、`system_stm32f10x.c`
- 不使用 HAL，采用寄存器直接配置 GPIO、TIM3、TIM2 等外设。

打开工程：

1. 启动 Keil µVision。
2. 打开 `smallcar_keil/smallcar_keil.uvprojx`。
3. 确认 Target 设备为 `STM32F103C8`。
4. 点击 Build，编译工程；使用 ST-LINK 等下载到目标板。

---

## 5. 控制逻辑说明（当前版本）

> 详细的键位 → 控制映射表请参见 `doc/ps2_keymap.md`，这里给出整体思路和重点。

### 5.1 速度挡位（SELECT 三档）

- 使用 SELECT 作为速度档位切换键：
  - 默认：`speed_percent = 80`（中档，`speed_level = 1`）；
  - 每按一次：在 60% / 80% / 100% 三档之间循环。

### 5.2 小车运动：R1/R2 油门 + L1/L2 原地转 + 左右方向差速

- L1 / L2 原地转（优先级最高）：
  - L1：原地左转（左轮后退、右轮前进）；
  - L2：原地右转（左轮前进、右轮后退）。

- R1 / R2 前进/后退油门：
  - R1：前进，基础速度为 `+speed_percent`；
  - R2：后退，基础速度为 `-speed_percent`；
  - 都不按：小车停止（若未触发原地转）。

- 左右差速转弯（建立在 R1/R2 基础之上）：
  - 左转弯：R1/R2 + 左方向（D-Pad 左 或 左摇杆向左）；
  - 右转弯：R1/R2 + 右方向（D-Pad 右 或 左摇杆向右）；
  - M1 下左摇杆 X 轴偏移用于细腻控制转向强度；
  - 上/下方向键和左摇杆 Y 轴在当前方案中不参与运动控制。

### 5.3 云台控制：彩色键 + 右摇杆 + 回中

- 彩色键步进：
  - 方块：Yaw 向右步进；
  - 圆圈：Yaw 向左步进；
  - 三角：Pitch 低头步进；
  - 叉号：Pitch 抬头步进。

- 右摇杆微调（M1）：
  - 在模拟模式下（`Data[1] = 0x73`），右摇杆 RX/RY 超过阈值时对 Yaw/Pitch 做连续步进微调，方向为：
    - `RX < 0x70`：Yaw 向右；`RX > 0x90`：Yaw 向左；
    - `RY < 0x70`：Pitch 低头；`RY > 0x90`：Pitch 抬头。

- 云台回中：
  - START：任意模式下，将 Yaw/Pitch 重置为 90° 中位；
  - 右摇杆按下 R3：在 M1 模式下同样触发回中。

### 5.4 串口远程控制（预留接口）

- 主控在 `USART1` 上实现了一个简单的 ASCII 串口控制协议，可被上位机或 ESP32-CAM 网关使用：
  - 一行一条指令：`C,throttle,steer,yaw,pitch`；
  - `throttle/steer` 映射到小车油门/转向；
  - `yaw/pitch` 用于设置云台目标角度（或 `-1` 表示保持不变）。
- 当串口收到**最近的有效指令**时，会覆盖当前 PS2 控制的电机和云台输出；
- 协议与行为细节详见 `doc/remote_control.md`。

---

## 6. 安全行为与上电注意事项

- 上电后，如果 PS2 手柄处于数字模式 M0（`Data[1] = 0x41`），仅使用按键（方向键、L1/L2、R1/R2、彩色键等）控制，小车依然可以运动，但**所有摇杆模拟量（LX/LY/RX/RY）在代码中强制视为中位**，避免劣质手柄模拟值飘移导致乱动。
- 只有在模拟模式 M1（`Data[1] = 0x73`）下，才启用左摇杆 X 软转向、右摇杆云台微调以及 R3 云台回中。
- 方向键优先级高于摇杆，保证在任何时候按 D-Pad 都能立即得到确定动作（紧急停车/转向）。
- 舵机供电建议使用独立 5V 大电流电源并与 STM32 共地，避免舵机大电流干扰 MCU 复位。

---

## 7. 使用步骤（快速上手）

1. 硬件按 `doc/pins.md` 接好：
   - STM32 ↔ TB6612 ↔ 电机
   - STM32 PA4~PA7 ↔ PS2 接收端
   - STM32 PA0/PA1 ↔ 两个舵机
   - 确保所有模块 GND 共地

2. 打开 Keil 工程 `smallcar_keil.uvprojx`，编译并下载到 STM32F103C8T6。

3. 打开 PS2 手柄，切换到 **模拟模式 M1**（`Data[1] = 0x73`，具体可在调试时查看 `Data[1]`). 在数字模式 M0 下，也可以用方向键 + L1/L2/R1/R2 驱动小车，只是摇杆模拟量被忽略。

4. 测试：
   - 使用 SELECT 按键切换速度挡位（60% / 80% / 100%）；
   - 用 R1/R2 测试前进/后退，用 L1/L2 测试原地左右旋转；
   - 用 R1/R2 + 左/右方向键测试差速转弯，在 M1 下松开方向键后，左摇杆 X 可做连续软转向；
   - 用彩色键（方块/圆圈/三角/叉号）步进式控制云台 Yaw/Pitch；
   - 在 M1 下，用右摇杆 RX/RY 做云台连续微调，并用 START 或 R3 测试云台一键回中。

---

## 8. 后续扩展方向（建议）

目前工程已经覆盖：本地 PS2 遥控、ESP32-CAM 网关、浏览器 Web 控制面板，以及在 iStoreOS 上的自动部署流程。后续可以在此基础上继续玩一些进阶方向：

- **高级驾驶与导航算法**：
  - 在 ESP32-CAM 或额外上位机上尝试简单视觉算法（巡线、颜色识别、障碍物检测等）；
  - 基于浏览器/ESP32 给出目标指令，由 STM32 侧实现闭环调速与转向控制（半自动或预设轨迹巡航）。

- **Web UI 与多车管理**：
  - 在 Web 前端增加多车辆选择与状态面板，支持在同一页面切换不同小车；
  - 增加行驶轨迹、传感器数据（如电压、电流、温度等）的可视化图表；
  - 做中英文双语 UI 切换，方便分享给不同用户使用。

- **ESP32-CAM / 网络侧增强**：
  - 为 ESP32-CAM 增加 OTA 固件升级通道（通过 Web 或路由器推送固件）；
  - WebSocket 与 HTTP 接口增加简单鉴权/Token 校验，限制未授权访问；
  - 在 iStoreOS 上叠加反向代理/HTTPS（如 Nginx/OpenResty），用于更安全的远程访问。

- **文档与工程化完善**：
  - 补充更细致的电源设计建议、电池选择与实际电流测试结果；
  - 增加云台/摄像头支架等机械结构的参考设计（3D 打印模型或装配示意）；
  - 给出更多 CI/CD 示例（多分支、多环境），方便移植到其它项目。

---

## 附录：ESP32-CAM + Web 远程控制与部署（概览）

 本仓库在原有 STM32 + PS2 遥控小车的基础上，增加了一个 **基于 ESP32-CAM + Web 浏览器的远程控制链路**：

 ```text
 浏览器（Web UI）
     ↓ WebSocket / HTTP（局域网）
 ESP32-CAM（视频 + 控制网关）
     ↓ UART（3.3V TTL，ASCII 文本协议）
 STM32F103C8T6（smallcar_keil 固件）
     ↓
 四轮差速底盘 + 双舵机云台
 ```

 - Web UI（`web/`）负责：
   - 加载 ESP32-CAM 的视频流（例如 `http://<ESP32_IP>:81/stream`）；
   - 提供按键 / 虚拟摇杆 / 云台滑块等控制；
   - 通过 WebSocket 周期性发送 JSON 控制消息给 ESP32-CAM；
   - 支持在页面内拍照预览、控制补光灯，并在横屏手机上显示悬浮控制面板。
 - ESP32-CAM 固件（`esp32_cam/CameraWebServer`）：
   - 运行 HTTP 摄像头服务（`/stream`、`/capture`、`/control?...`）；
   - 暴露 WebSocket 端点 `ws://<ESP32_IP>:8765/ws_control`（单客户端占用控制权）；
   - 将收到的 JSON 控制指令转换为 UART 文本命令 `C,throttle,steer,yaw,pitch\n`，下发给 STM32。
 - STM32 固件（`smallcar_keil/`）：
   - 通过 USART1 接收上述 UART 文本协议，并在最近一段时间内优先使用远程命令覆盖 PS2 控制。

 详细协议与实现细节请参见 `doc/remote_control.md`.

 ### 在 iStoreOS/OpenWrt 上部署与更新 Web 控制面板

 该仓库提供脚本 `deploy_istoreos.sh`，用于在 iStoreOS/OpenWrt 路由器上一键部署 Web 控制面板：

 1. 将仓库（包含 `web/` 与 `deploy_istoreos.sh`）拷贝到路由器，例如：

    ```bash
    # 在 PC 上执行，假设路由器 IP 为 192.168.31.1
    scp -r smallcar root@192.168.31.1:/root/
    ```

 2. SSH 登陆路由器并执行脚本：

    ```sh
    ssh root@192.168.31.1
    cd /root/smallcar
    sh deploy_istoreos.sh
    ```

    脚本会：

    - 将 `web/` 拷贝到 `/www/smallcar`；
    - 创建或复用 `/etc/init.d/smallcar-web` 服务脚本（使用 `uhttpd` + procd）；
    - 启用并启动 `smallcar-web` 服务，实现开机自启与进程挂死自动重启。

 3. 在浏览器访问：

    ```text
    http://<路由器 IP>:8090/
    ```

 #### Web UI 更新流程

 当本地修改了 `web/` 中的 HTML/CSS/JS 后，更新部署只需：

 1. 重新将更新后的仓库（或至少 `web/` 与 `deploy_istoreos.sh`）拷贝到路由器；
  2. 再次在路由器上执行：

    ```sh
    cd /root/smallcar
    sh deploy_istoreos.sh
    ```

    该脚本是幂等的：会覆盖 `/www/smallcar` 中的静态文件并重启 `smallcar-web` 服务，无需手动 stop/start。

    此外，可以通过以下命令手动管理服务：

  ```sh
  /etc/init.d/smallcar-web start      # 启动服务
  /etc/init.d/smallcar-web stop       # 停止服务
  /etc/init.d/smallcar-web restart    # 重启服务
  /etc/init.d/smallcar-web enable     # 开机自启
  /etc/init.d/smallcar-web disable    # 取消开机自启
  ```

 如需**卸载 smallcar-web 服务并清理静态文件**（例如准备切换到 Docker 部署方案），可以在路由器上执行：

 ```sh
 ssh root@192.168.31.1
 cd /root/smallcar
 sh deploy_istoreos.sh uninstall
 ```

 该命令会停止并禁用 `smallcar-web` 服务，删除 `/etc/init.d/smallcar-web` 脚本以及 `/www/smallcar` 目录。

 - 你可以自由地使用、复制、修改、合并、出版、分发本项目代码，甚至用于商业用途；
 - 唯一要求是在所有副本或重要部分中保留原始的版权声明和许可声明；
 - 本项目代码按“现状（AS IS）”提供，不提供任何形式的担保，作者不对任何使用造成的损失负责。

 详细条款请参见仓库根目录的 `LICENSE` 文件（MIT License 原文）。
