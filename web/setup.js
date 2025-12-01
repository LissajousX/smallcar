(function () {
  const wifiStateText = document.getElementById("wifi-state-text");
  const wifiApInfo = document.getElementById("wifi-ap-info");
  const wifiStaInfo = document.getElementById("wifi-sta-info");
  const ssidSelect = document.getElementById("ssid-select");
  const ssidManual = document.getElementById("ssid-manual");
  const pwdInput = document.getElementById("wifi-password");
  const showPwd = document.getElementById("show-password");
  const scanBtn = document.getElementById("btn-scan");
  const saveBtn = document.getElementById("btn-save");
  const statusMsg = document.getElementById("wifi-status-msg");
  const nextSteps = document.getElementById("next-steps");
  const nextStepsText = document.getElementById("next-steps-text");
  const setupOtaBtn = document.getElementById("setup-ota-btn");
  const setupOtaStatus = document.getElementById("setup-ota-status");

  const WIFI_STATE_POLL_TOTAL_MS = 60000;
  const WIFI_STATE_POLL_INTERVAL_MS = 3000;
  const DEFAULT_ROUTER_BASE = "http://192.168.31.1:8099";
  let wifiStatePollTimer = null;
  let wifiStatePollDeadline = 0;
  let lastApSsid = "";
  let lastStaIp = "";

  function setStatus(text, color) {
    if (!statusMsg) return;
    statusMsg.textContent = text || "";
    if (color) {
      statusMsg.style.color = color;
    } else {
      statusMsg.style.color = "";
    }
  }

  function buildAccessHint() {
    const apSsid = lastApSsid;
    const staIp = lastStaIp;

    let mdnsUrl = "";
    if (apSsid && apSsid !== "(未知)") {
      const parts = apSsid.split("-");
      const tail = parts[parts.length - 1].trim();
      if (tail) {
        const suffix = tail.toLowerCase();
        mdnsUrl = `http://smallcar-${suffix}.local/`;
      }
    }

    let ipUrl = "";
    if (staIp && staIp !== "(未获取到 IP)" && staIp !== "") {
      ipUrl = `http://${staIp}/`;
    }

    if (mdnsUrl && ipUrl) {
      return `例如：${mdnsUrl} 或 ${ipUrl}`;
    }
    if (mdnsUrl) {
      return `例如：${mdnsUrl}`;
    }
    if (ipUrl) {
      return `例如：${ipUrl}`;
    }
    return "";
  }

  async function loadWifiState() {
    if (!wifiStateText) return;
    if (typeof fetch !== "function") {
      wifiStateText.textContent = "浏览器不支持 fetch，无法读取网络状态。";
      return;
    }
    try {
      const resp = await fetch("/wifi_state", { cache: "no-store" });
      if (!resp.ok) {
        wifiStateText.textContent = "固件暂未提供 /wifi_state 接口。";
        return;
      }
      const data = await resp.json();
      if (!data || data.ok === false) {
        wifiStateText.textContent = "无法获取网络状态。";
        return;
      }

      const apSsid = data.ap_ssid || "(未知)";
      const apIp = data.ap_ip || "(未知)";
      const staConfigured = !!data.sta_configured;
      const staConnected = !!data.sta_connected;
      const staSsid = data.sta_ssid || "(未配置)";
      const staIp = data.sta_ip || "(未获取到 IP)";

      lastApSsid = apSsid;
      lastStaIp = staIp;

      wifiStateText.textContent = staConnected
        ? "已接入家庭 Wi‑Fi，可通过家庭网络访问小车。"
        : staConfigured
        ? "已配置家庭 Wi‑Fi，正在尝试连接或连接失败。"
        : "尚未配置家庭 Wi‑Fi，仅能通过小车热点访问。";

      if (wifiApInfo) {
        wifiApInfo.textContent = `小车热点：${apSsid}  (IP: ${apIp})`;
      }
      if (wifiStaInfo) {
        wifiStaInfo.textContent = staConfigured
          ? `家庭 Wi‑Fi：${staSsid}  (状态：${staConnected ? "已连接" : "未连接"}，IP: ${staIp})`
          : "家庭 Wi‑Fi：尚未配置";
      }

      if (staConfigured && nextSteps && nextStepsText) {
        nextSteps.style.display = "block";
        const hint = buildAccessHint();
        if (hint) {
          nextStepsText.textContent =
            `配网成功后，建议在手机/电脑连接家庭 Wi‑Fi 后，在浏览器中 ${hint} 访问本控制页面。`;
        } else {
          nextStepsText.textContent =
            "配网成功后，建议在手机/电脑连接家庭 Wi‑Fi 后，通过小车的 mDNS 名称或路由器分配的 IP 访问本控制页面（可参考上方\"当前网络状态\" 中的提示）。";
        }
      }
    } catch (e) {
      wifiStateText.textContent = "读取网络状态失败。";
    }
  }

  function startWifiStatePolling() {
    if (!wifiStateText || typeof fetch !== "function") {
      return;
    }

    if (wifiStatePollTimer) {
      clearTimeout(wifiStatePollTimer);
      wifiStatePollTimer = null;
    }

    wifiStatePollDeadline = Date.now() + WIFI_STATE_POLL_TOTAL_MS;

    const pollOnce = async () => {
      await loadWifiState();
      if (Date.now() < wifiStatePollDeadline) {
        wifiStatePollTimer = setTimeout(pollOnce, WIFI_STATE_POLL_INTERVAL_MS);
      } else {
        wifiStatePollTimer = null;
      }
    };

    pollOnce();
  }

  function buildOtaUrlFromLocation() {
    try {
      const loc = window.location || {};
      if (loc.origin) {
        return loc.origin.replace(/\/+$/, "") + "/ota";
      }
      const protocol = loc.protocol || "http:";
      const host = loc.host || loc.hostname;
      if (host) {
        return `${protocol}//${host}/ota`;
      }
    } catch (e) {}
    return "/ota";
  }

  async function runSetupOtaUpgrade() {
    if (!setupOtaStatus) {
      return;
    }
    if (typeof fetch !== "function") {
      setupOtaStatus.textContent = "当前浏览器不支持固件升级（缺少 fetch）。";
      setupOtaStatus.style.color = "#f87171";
      return;
    }

    const otaUrl = buildOtaUrlFromLocation();
    const routerBase = DEFAULT_ROUTER_BASE;
    const firmwareUrl = `${routerBase}/firmware/product/esp32cam-product-latest.bin`;

    const ok = window.confirm(
      `确定要从 ${firmwareUrl} 获取最新产品版固件并刷写到当前 ESP32-CAM 吗？\n升级过程中请勿断电/刷新页面。`,
    );
    if (!ok) {
      setupOtaStatus.textContent = "已取消从路由器一键升级。";
      setupOtaStatus.style.color = "";
      return;
    }

    setupOtaStatus.textContent = "正在从路由器获取最新产品版固件...";
    setupOtaStatus.style.color = "#facc15";

    let fwBlob;
    try {
      const resp = await fetch(firmwareUrl, { cache: "no-store" });
      if (!resp.ok) {
        throw new Error("bad status " + resp.status);
      }
      fwBlob = await resp.blob();
    } catch (e) {
      setupOtaStatus.textContent =
        "从路由器获取最新产品版固件失败，请确认路由器上已提供 esp32cam-product-latest.bin。";
      setupOtaStatus.style.color = "#f87171";
      return;
    }

    setupOtaStatus.textContent =
      "已获取最新固件，正在通过 WiFi 推送到 ESP32-CAM...";
    setupOtaStatus.style.color = "#facc15";

    try {
      await fetch(otaUrl, {
        method: "POST",
        body: fwBlob,
      });
      setupOtaStatus.textContent =
        "升级请求已发送，设备将自动重启，请稍等片刻后重新连接。";
      setupOtaStatus.style.color = "#34d399";
    } catch (e) {
      setupOtaStatus.textContent =
        "从路由器推送固件到 ESP32-CAM 失败，请检查网络连接。";
      setupOtaStatus.style.color = "#f87171";
    }
  }

  async function scanNetworks() {
    if (!ssidSelect || typeof fetch !== "function") {
      return;
    }
    setStatus("正在扫描附近 Wi‑Fi...", "");
    try {
      const resp = await fetch("/wifi_scan", { cache: "no-store" });
      if (!resp.ok) {
        setStatus("扫描失败：固件暂未实现 /wifi_scan 接口。", "red");
        return;
      }
      const data = await resp.json();
      if (!data || !Array.isArray(data.networks)) {
        setStatus("扫描结果异常。", "red");
        return;
      }
      ssidSelect.innerHTML = "";
      ssidSelect.appendChild(new Option("请选择 Wi‑Fi", ""));
      data.networks.forEach((n) => {
        if (!n || !n.ssid) return;
        const label = n.ssid;
        ssidSelect.appendChild(new Option(label, n.ssid));
      });
      setStatus(`扫描到 ${data.networks.length} 个网络。`, "");
    } catch (e) {
      setStatus("扫描失败：网络错误。", "red");
    }
  }

  async function saveConfig() {
    if (!pwdInput || !ssidSelect || !ssidManual || typeof fetch !== "function") {
      return;
    }
    const ssid = (ssidManual.value || ssidSelect.value || "").trim();
    const password = pwdInput.value;
    if (!ssid) {
      setStatus("请先选择或输入家庭 Wi‑Fi 名称。", "red");
      return;
    }

    setStatus("正在保存并尝试连接家庭 Wi‑Fi...", "");
    saveBtn && (saveBtn.disabled = true);

    try {
      const resp = await fetch("/wifi_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid, password }),
      });
      if (!resp.ok) {
        setStatus("保存失败：固件暂未实现 /wifi_config 接口。", "red");
        return;
      }
      const data = await resp.json().catch(() => ({}));
      if (data && data.ok) {
        setStatus("配置已保存，小车正在尝试连接家庭 Wi‑Fi...", "green");
        if (nextSteps && nextStepsText) {
          nextSteps.style.display = "block";
          const hint = buildAccessHint();
          if (hint) {
            nextStepsText.textContent =
              `几秒钟后，请断开当前小车热点，在手机/电脑连接你的家庭 Wi‑Fi，然后在浏览器中 ${hint} 访问本控制页面。`;
          } else {
            nextStepsText.textContent =
              "几秒钟后，请断开当前小车热点，在手机/电脑连接你的家庭 Wi‑Fi，然后通过小车的 mDNS 名称或路由器分配的 IP 访问本控制页面（可参考上方\"当前网络状态\" 中的提示）。";
          }
        }
        startWifiStatePolling();
      } else {
        setStatus("保存失败：固件返回错误。", "red");
      }
    } catch (e) {
      setStatus("保存失败：网络错误。", "red");
    } finally {
      saveBtn && (saveBtn.disabled = false);
    }
  }

  if (showPwd && pwdInput) {
    showPwd.addEventListener("change", () => {
      pwdInput.type = showPwd.checked ? "text" : "password";
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveConfig();
    });
  }

  if (setupOtaBtn && setupOtaStatus) {
    setupOtaBtn.addEventListener("click", () => {
      runSetupOtaUpgrade();
    });
  }

  window.addEventListener("load", () => {
    loadWifiState();
    // 开机后自动读取一次扫描结果列表，无需用户点击“扫描”按钮
    scanNetworks();
  });
})();
