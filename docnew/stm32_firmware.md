# STM32 固件与控制协议说明

本篇介绍 `smallcar_keil/` 下的 STM32 固件：它在 SmallCar 中的角色、主要代码结构、电池电量计算，以及与 ESP32/前端之间的串口协议。

---

## 1. STM32 在系统中的角色

STM32 是小车的**运动控制核心**，主要负责：

- 接收来自 ESP32 转发的控制指令；
- 驱动电机和云台舵机；
- 采样电池电压并估算电量百分比；
- 处理安全逻辑（如低电蜂鸣）；
- （可选）处理本地输入，例如 PS2 手柄等。

ESP32 更像“网络与多媒体中枢”，而 STM32 是真正“管轮子和舵机”的那块 MCU。

---

## 2. 工程结构概览

`smallcar_keil/` 目录下通常包括：

- Keil MDK 工程文件（`.uvproj` / `.uvprojx`）；
- `main.c`：主循环、控制协议解析、电机/舵机调度、电池上报；
- `battery.c` / `battery.h`：ADC 采样、电压与百分比换算；
- 其他外围驱动文件（电机、舵机、蜂鸣器等）。

> 具体文件名以实际工程为准，可以在 Keil 工程视图中查看。

---

## 3. 控制协议（ESP32 ↔ STM32）

ESP32 与 STM32 通过 UART（如 USART1）使用**简单文本协议**通信。

### 3.1 控制指令（浏览器 → ESP32 → STM32）

1. 浏览器在 `main.js` 中通过 WebSocket 发送 JSON 控制消息：

   ```jsonc
   {
     "type": "control",
     "throttle": 30,
     "steer": -20,
     "yaw": 90,
     "pitch": 90
   }
   ```

2. ESP32 解析后，在 `CameraWebServer.ino` 中构造 UART 命令，例如：

   ```text
   C,30,-20,90,90\n
   ```

3. STM32 `main.c` 中的 UART 接收逻辑解析该行：

   - 校验首字符 `C`；
   - 解析出 `throttle`、`steer`、`yaw`、`pitch`；
   - 应用限幅，计算电机 PWM 占空比与舵机角度。

### 3.2 状态上报（STM32 → ESP32）

STM32 周期性通过 UART 上报电池等状态，例如：

```text
B,<电压mV>,<百分比>\r\n
```

ESP32 解析该行并更新全局变量，供 `/battery` 接口和前端使用。

协议的好处：

- 结构简单、易于调试（串口助手即可观察）；
- JSON ↔ 文本之间的转换逻辑清晰，便于日后扩展（如添加更多状态字段）。

---

## 4. 电池电压与电量算法

### 4.1 ADC 采样

`battery.c` 中典型实现：

- 使用 ADC1 某通道采样电池分压节点；
- 多次采样求平均以降低噪声：

  ```c
  #define BAT_ADC_SAMPLE_TIMES  8U

  static uint16_t Battery_ADC_ReadRaw(void) {
      uint32_t sum = 0U;
      for (i = 0; i < BAT_ADC_SAMPLE_TIMES; i++) {
          // 启动 ADC1 转换并等待 EOC...
          sum += ADC1->DR;
      }
      sum /= BAT_ADC_SAMPLE_TIMES;
      // 裁剪到 0..4095
      return (uint16_t)sum;
  }
  ```

### 4.2 电压换算

电池通过电阻分压接入 ADC，宏定义类似：

```c
#define BAT_VREF_MV       3300U   // 参考电压
#define BAT_DIVIDER_RATIO 5U      // 分压比（实际按硬件计算）
```

换算公式：

```c
raw = Battery_ADC_ReadRaw();            // 0..4095
mv  = raw * BAT_VREF_MV * BAT_DIVIDER_RATIO / 4095U;
```

### 4.3 一阶低通滤波

为减少电池电压/电量显示抖动，代码中会对电压做简单滤波：

```c
static uint32_t s_battery_mv_filtered = 0U;

uint32_t Battery_GetVoltage_mV(void) {
    uint16_t raw = Battery_ADC_ReadRaw();
    uint32_t mv = ...; // 按上面公式计算

    if (s_battery_mv_filtered == 0U) {
        s_battery_mv_filtered = mv;      // 第一次直接赋值
    } else {
        // 新值占 1/4，旧值占 3/4，平滑变化
        s_battery_mv_filtered = (s_battery_mv_filtered * 3U + mv) / 4U;
    }
    return s_battery_mv_filtered;
}
```

### 4.4 百分比映射

固件中采用简单线性映射：

```c
#define BAT_FULL_MV   12300U   // 12.3V 及以上视为 100%
#define BAT_EMPTY_MV  10500U   // 10.5V 及以下视为 0%

uint8_t Battery_ConvertPercent(uint32_t mv) {
    if (mv <= BAT_EMPTY_MV) return 0U;
    if (mv >= BAT_FULL_MV) return 100U;
    percent = (mv - BAT_EMPTY_MV) * 100U / (BAT_FULL_MV - BAT_EMPTY_MV);
    ...
}
```

注意：

- 这个百分比主要供 **STM32 侧逻辑和蜂鸣器预警** 使用；
- Web 前端通常会基于 `mv` 再做一次映射，以便今后只改前端即可调整电量算法。

---

## 5. 电池状态上报节奏

在 `main.c` 中，常见写法是按循环计数器定期上报：

```c
if ((g_loop_counter % N) == 0U) {
    uint32_t vbat_mv = Battery_GetVoltage_mV();
    uint8_t  soc     = Battery_ConvertPercent(vbat_mv);

    USART1_SendString("B,");
    USART1_SendUInt(vbat_mv);
    USART1_SendString(",");
    USART1_SendUInt((uint32_t)soc);
    USART1_SendString("\r\n");

    // 低电蜂鸣逻辑...
}
```

其中 `N` 与主循环节奏（例如 `delay_ms(20)`）共同决定上报间隔，可以按需要调整为 1 秒、10 秒或 1 分钟一次。

---

## 6. 低电预警与保护

典型流程：

1. 读取当前 `soc`（或 `mv`）；
2. 当 `soc <= LOW_BATTERY_WARN_PERCENT` 时，周期性触发蜂鸣器短鸣；
3. 如需进一步保护，可以在极低电量时限制最高油门，甚至直接禁止驱动电机。

这些逻辑一般也在 `main.c` 中实现，方便集中管理安全相关行为。

---

## 7. 开发与调试建议

- 使用串口调试工具同时观察：
  - ESP32 输出的 UART 数据；
  - STM32 侧调试打印（如已开启）；
- 在 Keil 中使用断点和 Watch 观察：
  - 解析后的 `throttle`、`steer`、`yaw`、`pitch`；
  - 电池电压/百分比变量；
- 若需要修改控制手感（加速/转向灵敏度等），优先修改 STM32 侧逻辑，再在前端适当调整 UI 提示。

---

## 8. 未来：STM32 OTA（设计草案）

仓库中的 `doc/stm32_ota_design.md` 描述了一套 STM32 OTA 设计思路：

- 在 STM32 上增加 Bootloader 分区，用于接收并烧写应用固件；
- ESP32 通过 HTTP 从路由器下载 STM32 固件，再通过串口按自定义协议分包发给 Bootloader；
- 应用与 Bootloader 通过标志位和 CRC 协作，确保断电/失败情况下依然安全。

该设计暂未完全实现，细节请参见原文档。当前版本主要通过 **重新刷写 STM32 应用固件** 来升级。

---

## 9. 总结

STM32 固件是 SmallCar 的“运动与电池管理大脑”，与 ESP32 和 Web 前端通过简单协议协作：

- ESP32 负责联网和媒体；
- STM32 负责控制与采样；
- Web 前端负责展示和交互。

理解 STM32 代码结构和协议后，你可以：

- 调整车的操控风格；
- 改善电量估算和预警逻辑；
- 为未来的拓展（传感器、自动驾驶算法等）打下基础。
