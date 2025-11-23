# ESP32-CAM OTA 二次升级失败排查与解决记录

> 本文记录 smallcar 工程中 ESP32-CAM 在 **烧录后第一次 OTA 成功、第二次 OTA 失败** 的问题排查过程，以及最终的解决方案。
>
> 重点覆盖：
> - ESP32 OTA 与分区/回滚/看门狗的基本原理；
> - 实际故障表现与 `/status` 诊断字段；
> - 多轮尝试（包括错误思路）与最终的工程化做法。

---

## 1. 问题现象概述

### 1.1 环境与前提

- 模块：ESP32-CAM（OV2640 摄像头 + PSRAM）；
- 工程：`esp32_cam/CameraWebServer`（基于官方 CameraWebServer 二次改造）；
- 分区表：自定义双 OTA 应用分区（`app0`/`app1`，详见 `partitions.csv`）；
- OTA 入口：HTTP `POST /ota`，由 Web 前端 `web/` 通过浏览器调用；
- 串口波特率：115200。

### 1.2 典型症状

1. **初次烧录**：
   - 使用 Arduino IDE 将固件烧录到 ESP32-CAM 后，设备正常启动；
   - 视频流、WebSocket 控制、小车驱动功能正常。

2. **第一次 OTA**：
   - 通过 Web UI 选择 `.bin` 文件或从路由器获取最新固件，并向 `/ota` 发起上传；
   - 第一次 OTA 通常 **可以成功**，设备自动重启并运行新的固件版本。

3. **第二次 OTA**：
   - 再次通过 `/ota` 发起升级；
   - 现象是：
     - Web 端显示升级超时或失败；
     - 串口日志多为：

       ```text
       rst:0x8 (TG1WDT_SYS_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
       ...
       ```

     - `/status` 中的 OTA 诊断字段表现为：
       - `ota_last_result` 仍为 0 或 -1；
       - `ota_last_error` 保持在特定检查点值（如 21 或 3），说明程序在调用 `esp_ota_begin()` 附近复位；
       - `ota_last_size` 未增长或只写入很少字节。

简而言之：**第一次 OTA 正常，第二次 OTA 在 `esp_ota_begin` 阶段频繁触发 `TG1WDT_SYS_RESET`，导致升级失败。**

---

## 2. 相关原理：OTA、分区与看门狗

### 2.1 双 OTA 分区与回滚机制

ESP32 在使用双 OTA 应用分区（`ota_0`/`ota_1`）时：

- Bootloader 依赖 `otadata` 确定当前启动分区及其状态：
  - `ESP_OTA_IMG_PENDING_VERIFY`：新固件首次启动，尚未标记为“有效”；
  - `ESP_OTA_IMG_VALID`：已验证通过的正式固件；
  - `ESP_OTA_IMG_INVALID`：无效，不应再被启动。
- 正常 OTA 流程：
  1. 旧固件运行于 `app0`；
  2. 通过 OTA 将新固件写入 `app1`；
  3. 调用 `esp_ota_set_boot_partition(app1)`；
  4. 重启后从 `app1` 启动，状态为 `PENDING_VERIFY`；
  5. 程序自检通过后调用 `esp_ota_mark_app_valid_cancel_rollback()`；
  6. 若长时间未标记为 `VALID` 或多次重启失败，Bootloader 可能回滚至旧分区。

本工程中一开始**没有**调用 `esp_ota_mark_app_valid_cancel_rollback()`，这在后期被证明是导致“后续 OTA 不可靠”的一部分原因。

### 2.2 OTA 擦除与 `esp_ota_begin()`

- `esp_ota_begin()` 在传入 `OTA_SIZE_UNKNOWN` 时：
  - 会在目标 OTA 分区上执行必要的 **Flash 擦除**（通常是整分区或按最小擦除扇区对齐）；
  - 擦除时间与分区大小和 Flash 硬件相关，较大的分区会花费数秒甚至更久；
  - 在擦除期间，若其他任务无法及时喂看门狗，可能触发复位。

### 2.3 Task Watchdog 与 TG1WDT

- ESP-IDF 的 **Task Watchdog (TWDT)**：
  - 监控某些关键任务是否在限定时间内调用 `esp_task_wdt_reset()`；
  - 未及时喂狗会触发 **Timer Group 1 Watchdog (TG1WDT)**；
  - 日志通常类似：`task_wdt: Task watchdog got triggered.` 或 `task_wdt: esp_task_wdt_reset(705): task not found`。

- 硬件 **TG1WDT**：
  - 底层定时器看门狗，真正导致 `rst:0x8 (TG1WDT_SYS_RESET)` 的源头；
  - 即使关闭了 Task Watchdog，上层长时间阻塞仍可能触发 TG1WDT。

在 OTA 中，`esp_ota_begin()` 做的大规模 Flash 擦除 + 摄像头/网络负载，很容易成为“长时间阻塞”的源头。

---

## 3. 增加 OTA 诊断：NVS 与 `/status`

### 3.1 NVS 持久化 OTA 过程

为在 **没有串口日志** 的情况下也能分析 OTA 出错位置，本工程在 `app_httpd.cpp` 中引入了 NVS 诊断：

- NVS 命名空间：`"ota_diag"`；
- 关键键值：
  - `result`：0=未完成/进行中，1=成功，-1=失败；
  - `error`：
    - `1`：进入 OTA handler；
    - `2`：找到 OTA 分区；
    - `21`：大小检查通过；
    - `3`：`esp_ota_begin()` 调用完成，其返回值写在 `size` 字段中；
    - 其它：ESP-IDF 的 `esp_err_t` 错误码（如 `ESP_ERR_INVALID_SIZE` 等）。
  - `size`：用于保存已写入的固件字节数，或在部分阶段暂存返回值；
  - `ts`：最近一次 OTA 结束的时间戳（毫秒）。

对应的保存函数类似：

```cpp
static void ota_diag_save_to_nvs(int result, int error, int size) {
  // 更新内存变量并写入 NVS
}
```

### 3.2 `/status` JSON 暴露 OTA 信息

`/status` 接口在原有摄像头状态基础上，增加了：

- `ota_running_label` / `ota_next_label` 等分区信息；
- `ota_last_result` / `ota_last_error` / `ota_last_size` / `ota_last_ts` 等诊断字段。

通过这些字段，可以快速判断：

- OTA 是否曾进入 handler；
- 是否成功找到 OTA 分区；
- 是否卡在 `esp_ota_begin` 或 `esp_ota_write`；
- 大致写入了多少字节后失败。

在本问题中，多次观察到：

- `ota_last_error` 长期停留在 `21` 或 `3`；
- `ota_last_size` 基本为 0；

这意味着：

- OTA 通过了大小检查（`21`），进入调用 `esp_ota_begin()`；
- 但在 `esp_ota_begin` 的擦除阶段，被看门狗复位，**来不及写入任何固件数据**。

---

## 4. 回滚保护问题：`esp_ota_mark_app_valid_cancel_rollback()`

最初版本的固件中，OTA 成功后没有在新固件启动时显式标记为 `VALID`：

- 新固件启动时 OTA 状态为 `ESP_OTA_IMG_PENDING_VERIFY`；
- 若不调用 `esp_ota_mark_app_valid_cancel_rollback()`：
  - 系统会认为当前固件“待验证”，可能限制再次 OTA 或在出现异常时回滚；
  - 某些情况下会出现“第二次 OTA 总是失败”的表象。

**修正措施**：在 `CameraWebServer.ino::setup()` 中加入：

```cpp
const esp_partition_t *running = esp_ota_get_running_partition();
esp_ota_img_states_t ota_state;
if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
  if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
    Serial.println("OTA: marking current app as valid (was pending verify)");
    esp_ota_mark_app_valid_cancel_rollback();
  } else {
    Serial.printf("OTA: current app state: %d\n", ota_state);
  }
}
```

效果：

- 每次成功 OTA 并启动新固件后，会在 `setup()` 中将当前固件标记为 `VALID`；
- 避免后续 OTA 因回滚保护机制产生额外干扰。

在修复这一问题后，**二次 OTA 仍然失败**，但可以确认回滚保护不再是主因，焦点转向看门狗与 Flash 擦除时序。

---

## 5. 看门狗与 Flash 擦除：多轮尝试

### 5.1 初期尝试：动态添加/移除 Task WDT

一开始尝试在 OTA handler 内部临时移除/添加任务到 Task Watchdog：

- 在进入 `ota_post_handler` 前：`esp_task_wdt_delete(NULL)` 或对特定任务做 `esp_task_wdt_delete`；
- 在 OTA 完成后再恢复。

结果：

- 串口频繁打印：

  ```text
  task_wdt: esp_task_wdt_reset(705): task not found
  ```

- 表明在尝试向已被移除或未注册的任务喂狗，导致 TWDT 内部状态异常；
- 同时在多任务场景（摄像头、Wi-Fi、HTTP 服务器）中，很难准确管理所有需要监控的任务。

结论：**动态增删 WDT 任务在 Arduino 环境下过于脆弱，容易引入新的问题。**

### 5.2 调整 WDT 超时时间（未采用）

曾通过 PlatformIO 尝试调整 `sdkconfig` 相关宏（如 `CONFIG_ESP_TASK_WDT_TIMEOUT_S` 等），理论上可以延长喂狗间隔。

- 但在 Arduino-ESP32 环境下，很多 `sdkconfig` 并不直接生效；
- 同时这只能缓解，而不能解决硬件 TG1WDT 在极端阻塞下被触发的问题。

最终放弃这种途径。

### 5.3 最终方案：完全注销 Task WDT

在充分理解风险后，本工程选择在 `setup()` 中直接调用：

```cpp
esp_task_wdt_deinit();
Serial.println("Task WDT deinitialized");
```

效果：

- 不再出现 `task_wdt:` 相关日志；
- 避免 Task Watchdog 层人为触发 TG1WDT；
- 但底层硬件 TG1WDT **仍然存在**，在极端阻塞时依然可能导致 `rst:0x8 (TG1WDT_SYS_RESET)`。

此时，二次 OTA 的失败点已经收敛到：

- **`esp_ota_begin` 的 Flash 擦除耗时太长**；
- 再叠加摄像头与 Wi-Fi 的负载，导致整体长时间无法让出 CPU，最终触发 TG1WDT。

---

## 6. 预擦除方案：缩短 OTA 擦除时间

### 6.1 引入预擦除任务

为减轻 `esp_ota_begin()` 的压力，引入了一个后台任务 `ota_preerase_task`：

- 在 **OTA 成功后**，通过 NVS 标志 `ota_diag/preerase = 1` 记录“需要预擦除”；
- 下次启动时，如果标志为 1，则创建 `ota_preerase_task` 在后台擦除“当前未使用”的 OTA 分区；
- 擦除完成后清零标志，后续启动不再重复执行。

最初版本：

- 采用 64KB 的擦除块：

  ```cpp
  const size_t chunk = 64 * 1024;
  ```

- 每块擦除后仅 `vTaskDelay(50)`；
- 在摄像头持续输出、Wi-Fi 活跃的情况下，预擦除本身就可能触发 TG1WDT；
- 设备会在多次重启后才最终擦完整个分区，过程中串口会输出大量：

  ```text
  cam_hal: EV-EOF-OVF
  cam_hal: EV-VSYNC-OVF
  rst:0x8 (TG1WDT_SYS_RESET)
  ```

结论：**预擦除本身变成了新的高负载操作，需要进一步温和化。**

### 6.2 优化预擦除实现

最终的预擦除实现（当前版本）：

1. **更小擦除块**：

   ```cpp
   const size_t chunk = 4 * 1024;
   ```

   - 每次只擦 4KB，单次阻塞时间大幅缩短；
   - 减少单次连续占用 CPU 的时间。

2. **保持 `vTaskDelay(50ms)`**：

   - 每块擦除后都 `vTaskDelay(pdMS_TO_TICKS(50))`；
   - 为 Wi-Fi、摄像头和其它任务提供喘息窗口；
   - 配合关闭 Task WDT，有效降低 WDT 被触发概率。

3. **一次性执行 + NVS 标志**：

   - OTA 成功 → 设置 `preerase=1`；
   - 开机时若 `preerase==1`：启动 `ota_preerase_task`；
   - 擦完整个备用分区后：`preerase` 清为 0；
   - 若中途复位：不会清零，下一次启动继续预擦除。

4. **关闭冗余串口 debug 输出**：

   - 在 `setup()` 中不再调用 `Serial.setDebugOutput(true)`；
   - 避免摄像头/Wi-Fi 内部 debug log 在关键路径大量刷串口，进一步延长阻塞时间。

配合这些优化后：

- 预擦除不再在每次开机都运行，仅在 OTA 成功后的少数几次启动中参与；
- 即便偶尔触发 TG1WDT，也会在若干次重启后完成整个分区擦除；
- 后续真正执行 OTA 时，`esp_ota_begin()` 需要擦除的内容大幅减少，极大降低二次 OTA 失败的概率。

---

## 7. 最终解决方案汇总

综合上述分析，本工程当前的 OTA 方案包括：

1. **正确处理 OTA 回滚保护**：
   - 在 `setup()` 中调用 `esp_ota_mark_app_valid_cancel_rollback()`；
   - 确保每次成功 OTA 后的新固件被标记为 `VALID`，避免后续 OTA 受到回滚机制干扰。

2. **关闭 Task Watchdog，避免与 OTA 内部擦除冲突**：

   ```cpp
   esp_task_wdt_deinit();
   Serial.println("Task WDT deinitialized");
   ```

3. **引入 NVS 持久化 OTA 诊断信息 + `/status` JSON**：
   - 通过 `ota_last_result` / `ota_last_error` / `ota_last_size` 等字段判断故障阶段；
   - 便于在 Web 端无串口时也能快速定位问题。

4. **设计一次性预擦除任务，减轻 `esp_ota_begin` 负担**：
   - OTA 成功 → `preerase=1`；
   - 开机检查 NVS 标志，有需要时仅在后台擦除备用 OTA 分区；
   - 使用 **4KB 分块 + `vTaskDelay(50ms)`** 方式平滑擦除；
   - 擦除完成后清零标志，避免长期重启风暴。

5. **减少不必要的串口与摄像头负载**：
   - 不使用 `Serial.setDebugOutput(true)`；
   - 建议用户在 OTA 过程中关闭 Web 视频流预览页面，减少摄像头和网络压力。

在实际测试中，这一套组合措施可以：

- 可靠完成连续多次 OTA 升级；
- 遇到极端情况时，通过 `/status` 快速获知失败阶段；
- 将 `TG1WDT_SYS_RESET` 的触发时间集中在少数几次预擦除启动中，而不是每次 OTA 都大概率失败。

---

## 8. 对类似项目的建议

如果你的项目也使用 ESP32-CAM 或大固件 OTA，建议参考：

1. **优先确认分区表与 OTA 回滚逻辑**：
   - 使用标准双 OTA 分区；
   - 在新固件启动后调用 `esp_ota_mark_app_valid_cancel_rollback()`。

2. **为 OTA 增加持久化诊断信息**：
   - 在每个关键阶段写入 NVS，并在 `/status` 类接口中暴露出来；
   - 避免“没有串口、完全猜测”的调试过程。

3. **合理处理看门狗**：
   - 在 Arduino/ESP-IDF 环境下谨慎使用 Task WDT；
   - 避免在同一任务中长时间执行大规模 Flash 擦除而不 `vTaskDelay()`。

4. **采用预擦除或分阶段擦除策略**：
   - 可以在设备空闲时提前擦除备用 OTA 分区的一部分；
   - OTA 时只需对少量页做校验和补充擦除。

5. **评估串口输出和摄像头负载**：
   - 调试阶段可以短时间打开 debug 输出；
   - 正式运行时应关闭多余日志，以减少在关键路径上的阻塞时间。

本工程的实现细节可在以下文件中找到：

- `esp32_cam/CameraWebServer/CameraWebServer.ino`
- `esp32_cam/CameraWebServer/app_httpd.cpp`
- `esp32_cam/CameraWebServer/partitions.csv`

建议结合本说明与源码一起阅读，以便在自己的项目中进行裁剪或扩展。
