# 固件 OTA 与升级指南

SmallCar 中涉及多种“升级”：

- ESP32‑CAM 固件 OTA（产品/极客版）；
- 通过路由器从“固件仓库”一键升级；
- 未来可能实现的 STM32 OTA（当前主要通过重新刷写）。

本篇文档尝试把这些升级路径串成一条清晰的主线，方便你理解系统如何更新。

---

## 1. 概念总览

- **车端 MCU**：
  - ESP32‑CAM：支持 HTTP OTA，自升级固件；
  - STM32：当前版本一般通过 ST‑Link 等工具刷写应用固件，OTA 方案仍在设计中。
- **路由器 / 服务器端**：
  - 运行 `runner-web` / Nginx，提供静态前端与固件下载路径；
  - 常见路径：
    - `/firmware/geek/esp32cam-latest.bin`
    - `/firmware/product/esp32cam-product-latest.bin`
- **浏览器端**：
  - 通过 Web 前端的按钮触发：
    - 本地文件升级；
    - 从路由器获取最新固件并 OTA。

---

## 2. ESP32‑CAM OTA 接口

ESP32‑CAM 固件在 `app_httpd.cpp` 中提供 `/ota` 接口：

- 方法：`POST /ota`
- 请求体：完整的固件二进制（.bin 文件）
- 行为：
  - 将固件写入 Flash 对应分区；
  - 校验无误后重启，自此运行新固件。

Web 前端（`main.js`、`setup.js`）会把从本地或路由器获取的固件 blob 直接 POST 到这个接口。

---

## 3. 本地文件升级（主控制面板）

在 `index.html` 的高级设置弹窗中（geek 模式主要使用）：

1. 用户点击“本地文件升级”，选择一个 `.bin` 文件；
2. 前端读取 `video-url` 文本框中的 ESP32 视频流地址：
   - 例如 `http://192.168.31.140:81/stream`；
3. `main.js` 通过该 URL 推导出 OTA 接口地址：

   ```text
   http://192.168.31.140/ota
   ```

4. 前端用 `fetch(otaUrl, { method: "POST", body: file })` 发送固件；
5. 显示升级进度与结果提示。

适用场景：

- 开发者本地编译出新 firmware，希望马上在车上测试；
- 没有配置好路由器/runner‑web，只想简单刷一次。

---

## 4. 从路由器一键升级（主控制面板）

同样在主控制面板的 OTA 区域中：

1. 用户在 `router-base` 文本框中填写或使用默认路由器地址：

   ```text
   http://192.168.31.1:8099
   ```

2. 根据固件类型选择：

   - 极客版：`/firmware/geek/esp32cam-latest.bin`
   - 产品版：`/firmware/product/esp32cam-product-latest.bin`

3. 前端先从路由器下载固件 blob：

   ```js
   const resp = await fetch(firmwareUrl, { cache: "no-store" });
   const fwBlob = await resp.blob();
   ```

4. 再根据视频流地址推导出 `/ota` URL，POST `fwBlob`：

   ```js
   await fetch(otaUrl, { method: "POST", body: fwBlob });
   ```

5. 成功后提示“设备将自动重启，请稍等片刻后重新连接”。

优势：

- 不需要在本地保存固件文件；
- 多台小车可以从同一固件仓库升级，便于统一管理版本。

---

## 5. 在 setup 配网页面中一键升级

`setup.html` 底部新增了简化的 OTA 区域，由 `setup.js` 实现：

- “从路由器一键升级产品固件”
- “从路由器一键升级极客固件”

其逻辑与主控制面板类似：

1. 使用固定的 `DEFAULT_ROUTER_BASE`（例如 `http://192.168.31.1:8099`）；
2. 组合固件 URL：

   - 产品版：`/firmware/product/esp32cam-product-latest.bin`
   - 极客版：`/firmware/geek/esp32cam-latest.bin`

3. 通过 `window.location` 推导当前小车的 `/ota` 地址（通常是 `http://192.168.4.1/ota` 或 STA IP 对应的 `/ota`）；
4. 从路由器拉取固件，再 POST 到 `/ota`；
5. 在页面上的 `setup-ota-status` 中显示进度与结果。

使用建议：

- 出厂或售后场景下，可以在“配网”的同时完成 ESP32 固件更新；
- 用户不需要先打开主控制面板即可升级。

---

## 6. CI / 路由器端固件产物

在仓库的 CI/workflow 中（如 `.github/workflows/`）：

- 当 `web/` 或 `esp32_cam/CameraWebServer/` 有更新时：
  - 触发 product 前端打包脚本；
  - 构建 geek / product 两种固件；
  - 将生成的 `.bin` 文件上传/复制到路由器的 Nginx 根目录下：
    - `firmware/geek/esp32cam-latest.bin`
    - `firmware/product/esp32cam-product-latest.bin`

只要路由器正确暴露了这些路径，前端即可通过“一键升级”按钮访问到最新固件。

---

## 7. STM32 OTA（设计向导）

当前版本的 STM32 固件通常通过 ST‑Link 重新刷写，不走 OTA。

`doc/stm32_ota_design.md` 给出了一套设计方案，核心思想：

1. **Bootloader + 应用分区**：
   - 上电或复位先运行 Bootloader；
   - 检查是否有 OTA 标志或未完成的 OTA；
   - 若无 OTA 请求且应用 CRC 有效，则跳转应用；
   - 否则进入 OTA 模式，通过串口接收固件并烧写 Flash。

2. **ESP32 作为 OTA 主机**：
   - 从路由器下载 STM32 固件文件（例如 `/firmware/stm32-smallcar-latest.bin`）；
   - 通过当前控制串口或独立串口与 Bootloader 通信；
   - 使用简单协议（`S` 开始、`D` 数据、`E` 完成等）分包发送；
   - Bootloader 校验每个分包并更新 Flash。

3. **安全与回滚**：
   - 在 Flash 中存放应用 CRC 和状态标志；
   - 只有在新固件整体 CRC 校验通过后才切换为“有效”；
   - 若升级中断或 CRC 错误，Bootloader 保持在 OTA 模式或回滚到旧版本。

这部分仍属未来工作，实际实现细节请参考原文档与 Bootloader 编程资料。

---

## 8. 实战建议

1. **优先打通 ESP32 OTA 流程**：
   - 保证 `/ota` 接口稳定可用；
   - 确认从路由器一键升级功能正常。

2. **统一管理固件版本**：
   - 在 `version.txt` 中维护前端版本号；
   - 在 CI 或手动构建时给 ESP32 固件加上构建信息；
   - 在 Web 控制台中显示当前版本，方便对比。

3. **为未来 STM32 OTA 留好接口**：
   - 在 ESP32 与 STM32 协议中预留“进入 Bootloader”命令；
   - 设计好路由器端 STM32 固件路径；
   - 考虑断电、安全和回滚策略。

---

## 9. 总结

- ESP32‑CAM 通过 `/ota` 实现自升级，固件可以来自本地文件或路由器固件仓库；
- Web 前端提供多种入口（主控制面板、setup 配网页面）触发 OTA；
- 路由器/iStoreOS 负责托管前端与固件文件，并可扩展截图/录像等服务；
- STM32 OTA 方案仍在演进中，但设计思路已经在文档中给出，可按需实现。
