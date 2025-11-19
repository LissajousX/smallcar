# 远程控制架构（ESP32-CAM + UART）

> 本文描述 smallcar 工程中，从网页端经由 ESP32-CAM，到 STM32F103C8T6 小车主控的完整远程控制链路，以及 STM32 侧使用的简单 UART 文本协议。

---

## 1. 总体架构（概览）

当前与规划中的控制链路如下：

```text
浏览器（Web UI）
    ↓ WebSocket / HTTP（局域网）
ESP32-CAM（视频 + 控制网关）
    ↓ UART（3.3V TTL，ASCII 协议行）
STM32F103C8T6（smallcar_keil 固件）
    ↓
电机驱动 TB6612 + 双舵机云台
```

- **浏览器 / Web UI**（待实现）：
  - 显示来自 ESP32-CAM 的视频流；
  - 提供虚拟摇杆 / 按钮，生成油门、转向、云台角度等控制量；
  - 通过 WebSocket 以 JSON 形式把控制命令发给 ESP32-CAM。

- **ESP32-CAM**（待硬件到货后实现）：
  - 运行摄像头 Web 服务器，向浏览器推送视频；
  - 暴露 WebSocket 控制端点，接收 JSON 控制消息；
  - 将 JSON 字段转换为精简的 UART 文本指令行，发送给 STM32。

- **STM32F103C8T6**（已在 `smallcar_keil/main.c` 中实现）：
  - 保留现有 PS2 本地遥控逻辑不变；
  - 在 USART1 上监听 ASCII 串口控制命令；
  - 当存在“最近有效”的远程命令时，覆盖 PS2 对电机和云台的输出。
 
---

## 2. UART 串口命令协议（STM32 侧）

STM32 通过 **USART1（PA9/PA10，115200 8N1）** 接收远程控制指令，约定每一行一条命令，格式如下：

```text
C,<throttle>,<steer>,<yaw>,<pitch>\n
```

- 行首固定为 `C`（Control），大小写不敏感（`c` 也接受）；  
- 字段之间用英文逗号 `,` 分隔，均为 ASCII 十进制整数；  
- 每行以 `\n` 或 `\r\n` 结束。**注意：使用串口调试软件（如 COMTool）时，需要勾选“newline/CRLF”等选项，或手动在结尾发送回车，否则 STM32 不会认为一行命令已经结束，也就不会解析。**

### 2.1 字段含义与取值范围

- **`throttle`**（油门，`int`，`-100 .. 100`）：  
  - `> 0`：前进油门；  
  - `< 0`：后退油门；  
  - `0`：油门为 0（不对速度产生贡献）；  
  - STM32 会再乘以当前 `speed_percent`（60/80/100），效果类似 PS2 挡位控制。

- **`steer`**（转向，`int`，`-100 .. 100`）：  
  - `-100`：最大左转；  
  - `0`：直行；  
  - `+100`：最大右转；  
  - STM32 将其映射到已有的 `k_turn` 差速转向逻辑中。

- **`yaw`**（云台水平角，`int`，`-1` 或 `0 .. 180`）：  
  - `-1`：保持当前 Yaw 角度不变；  
  - `0..180`：目标绝对角度（单位：度）；  
  - 在应用前会夹在 `[YAW_MIN_ANGLE, YAW_MAX_ANGLE]` 范围内。

- **`pitch`**（云台俯仰角，`int`，`-1` 或 `0 .. 180`）：  
  - `-1`：保持当前 Pitch 角度不变；  
  - `0..180`：目标绝对角度；  
  - 在应用前会夹在 `[PITCH_MIN_ANGLE, PITCH_MAX_ANGLE]` 范围内。

### 2.2 示例命令

- 中等油门直行，不改变云台角度：

```text
C,50,0,-1,-1\n
```

- 带一定油门的原地左转（有转向，云台不变）：

```text
C,40,-100,-1,-1\n
```

- 只把云台回到 90/90，不移动小车：

```text
C,0,0,90,90\n
```

---

## 3. STM32 固件行为（概述）

本功能在 `smallcar_keil/main.c` 中实现，核心要点如下。

### 3.1 USART1 配置

- 外设：APB2 总线上的 **USART1**；  
- 引脚（详见 `doc/pins.md`）：  
  - `PA9`：USART1_TX（AF 推挽输出，50 MHz）；  
  - `PA10`：USART1_RX（输入，浮空）；  
- 波特率：72 MHz 系统时钟下 **115200 8N1**（`USART1->BRR = 0x0271`）；  
- 使能接收中断（`RXNEIE`），中断服务函数为 `USART1_IRQHandler`。

### 3.2 接收缓冲与行解析

- 使用一个长度为 `UART_RX_BUF_SIZE = 64` 的字符缓冲接收串口数据；  
- 中断中逐字节写入缓冲；遇到 `\n` 或 `\r` 时视为一行结束：  
  - 在线尾补 `"\0"`，得到 C 风格字符串；  
  - 如果行首是 `C`/`c`，调用 `UART_ParseLine()` 解析。  
- `UART_ParseLine()` 用 `strtol` 依次提取 4 个整数，并对取值做限幅，解析成功后写入全局结构体 `RemoteCmd_t`：

```c
typedef struct
{
    int16_t throttle;   // -100..100
    int16_t steer;      // -100..100
    int16_t yaw;        // -1 or 0..180
    int16_t pitch;      // -1 or 0..180
    uint8_t valid;      // 解析成功后置 1
    uint32_t last_tick; // 记录接收时的主循环计数
} RemoteCmd_t;
```

- 主循环中有一个 `g_loop_counter` 计数器，每次循环 +1；  
- 每成功解析一行时，将 `g_remote_cmd.last_tick` 更新为当前 `g_loop_counter`，并将 `valid` 置 1。

### 3.3 超时与优先级

在主循环中，先按原有 PS2 逻辑计算并下发电机与云台控制，然后再检查是否有 **最近的远程命令**：

- 若 `g_remote_cmd.valid == 1`，且 `g_loop_counter - g_remote_cmd.last_tick <= REMOTE_TIMEOUT_LOOPS`  
  （默认 `REMOTE_TIMEOUT_LOOPS = 50`，对应当前 20ms 延时大约 1 秒超时），则认为远程命令“仍然有效”，进入远程覆盖分支；  
- 否则忽略远程命令，仅保留 PS2 控制效果。

当远程命令有效时：

- 小车运动：  
  - 使用远程的 `throttle` / `steer`，通过现有的 `k_turn` 差速公式计算左右轮命令 `left_cmd/right_cmd`；  
  - 指令范围被夹在 `[-100, 100]` 内，再调用 `Motor_SetLR(left_cmd, right_cmd)` 输出。  

- 云台控制：  
  - 若 `yaw >= 0`，将其夹在 `[YAW_MIN_ANGLE, YAW_MAX_ANGLE]` 内，写入 `yaw_angle`；  
  - 若 `pitch >= 0`，将其夹在 `[PITCH_MIN_ANGLE, PITCH_MAX_ANGLE]` 内，写入 `pitch_angle`；  
  - 最后调用 `Servo_SetYawAngle(yaw_angle)` 与 `Servo_SetPitchAngle(pitch_angle)` 更新两个舵机。  

总结来说：**在有“最近有效”的远程命令时，远程控制会覆盖 PS2 对电机和云台的输出；在超时或未收到远程命令时，则完全按原有 PS2 控制逻辑运行。**

---

## 4. ESP32-CAM 集成规划（简要）

当 ESP32-CAM 模块到货后，它将作为“网络网关 + 视频源”接入到上述架构中，职责大致如下：

- 在 ESP32 上运行摄像头 Web 服务器，为浏览器提供实时视频流（例如 MJPEG 等方式）；  
- 暴露一个 WebSocket 控制端点（例如 `ws://ESP32_IP:PORT/ws_control`）；  
- 接收来自浏览器的 JSON 控制消息，例如：

```jsonc
{
  "type": "control",
  "throttle": -100, // -100..100
  "steer": 0,       // -100..100
  "yaw": -1,        // -1 或 0..180
  "pitch": -1       // -1 或 0..180
}
```

- 将 JSON 中的字段转换为 UART 文本命令 `C,thr,steer,yaw,pitch\n`，通过 USART1 发送给 STM32；  
- 同时继续提供视频流接口，供浏览器页面中的 `<img>` 或其它播放器组件使用。

浏览器侧的 Web UI 只需要：

- 作为静态 HTML/JS 页面部署在任意一台 Linux 主机 / 路由器 / NAS 上；  
- 打开页面后，通过 JavaScript 建立到 ESP32-CAM 的 WebSocket 连接；  
- 根据用户操作（虚拟摇杆、按键等）周期性地发送上述 JSON 控制消息即可。

在这种设计下，STM32 固件始终只需要理解一种非常简单的 UART 协议，不关心网络层和网页实现细节，后续要更换 Web UI 或上位机实现也会比较轻松。
