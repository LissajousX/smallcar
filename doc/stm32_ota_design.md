# STM32 OTA 设计草案（基于 ESP32 中继）

目标：OTA 仅用于极客版，不影响基础版/普通用户。

## 1. 设计目标与约束

- MCU: STM32F103C8T6，64KB Flash，20KB RAM
- 要求：
  - 支持通过 ESP32 + 串口更新 STM32 应用固件
  - 断电/失败后可通过 SWD 线刷恢复
- 不做：
  - 不 OTA Bootloader 本身
  - 不修改 Option Bytes（不关闭 SWD/JTAG）

## 2. Flash 分区建议

Flash 0x0800_0000 - 0x0800_FFFF (64KB):

- 0x0800_0000 ~ 0x0800_1FFF (8KB): Bootloader
- 0x0800_2000 ~ 0x0800_FFFF (56KB): Application 区

Bootloader 固定编译到起始地址，应用工程链接地址改为 0x08002000 起。

## 3. Bootloader 功能需求

- 上电或复位后，先运行 Bootloader：
  - 从某个标志区域（RAM/备份寄存器/Flash 小段）判断：
    - 是否请求进入 OTA 模式
    - 是否有“未完成/失败的 OTA”
  - 如无 OTA 请求且应用 CRC 有效：
    - 跳转到 0x08002000 运行应用
  - 否则：
    - 进入 OTA 模式，通过 USART1 与 ESP32 通信

- OTA 模式下：
  - 使用简单串口协议：
    - `S` 开始、`D` 数据块、`E` 结束、`X` 取消 等
  - 擦除应用区 Flash
  - 分包接收固件，每包包含：
    - 序号、长度、数据、CRC/校验和
  - 烧写 Flash 并校验
  - 全部写完后重新计算应用区整体 CRC，写入标志区

- Bootloader 自身：
  - 不参与 OTA 更新
  - 尽量小、逻辑简单、测试充分

## 4. ESP32 端 OTA 流程（概念）

- 从 HTTP 服务器/路由器下载 STM32 固件文件，例如：
  - `http://router/firmware/stm32-smallcar-latest.bin`
- 连接到 STM32 的 USART1（同现在的控制通道或单独通道）
- 向 STM32 应用发送“进入 Bootloader”命令：
  - 应用设置标志 → 软复位
- 复位后 Bootloader 进入 OTA 模式，ESP32：
  - 发送 `S` 帧，包含固件大小/CRC 等元信息
  - 循环发送 `D` 帧，每帧 256B/512B 数据
  - 发送 `E` 帧，请求 Bootloader 校验并返回结果
- 成功后：
  - ESP32 可以再请求一次复位或等待 STM32 自动跳转应用

## 5. 失败与恢复策略

- OTA 中途掉电：
  - Bootloader 区未动，仍在 0x08000000
  - 上电后 Bootloader 检测到应用 CRC 无效：
    - 停在 OTA 模式，等待 ESP32 或 PC 重新推送固件
- 若 Bootloader 逻辑 bug 导致无法正常工作：
  - 仍可以通过 SWD 使用 ST-Link：
    - `Full Chip Erase`
    - 重新烧录 Bootloader + 应用

## 6. 实现建议与步骤

1. 先写一个最小 Bootloader：
   - 不连 ESP32，只在串口打印 “Bootloader OK” 并跳转应用
   - 确认可编译、能从 0x08002000 跑应用

2. 加入串口命令：
   - PC 通过串口工具发送简单命令：擦除 + 写入 + 校验
   - 写一个 PC 侧小工具脚本，用 ST-LINK 以外的方式测试完整烧写流程

3. 最后再接入 ESP32：
   - 参考 PC 工具的协议，在 ESP32 上复刻一份
   - 从 HTTP 获取固件，再通过串口推给 STM32 Bootloader

> 注意：OTA 一定只在“极客分支 / 极客构建配置”中打开，产品版保持线刷即可。