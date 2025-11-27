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

  function setStatus(text, color) {
    if (!statusMsg) return;
    statusMsg.textContent = text || "";
    if (color) {
      statusMsg.style.color = color;
    } else {
      statusMsg.style.color = "";
    }
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
        nextStepsText.textContent =
          "配网成功后，建议在手机/电脑连接家庭 Wi‑Fi 后，通过 http://smallcar-XXXX.local 或路由器分配的 IP 访问本控制页面。";
      }
    } catch (e) {
      wifiStateText.textContent = "读取网络状态失败。";
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
          nextStepsText.textContent =
            "几秒钟后，请断开当前小车热点，在手机/电脑连接你的家庭 Wi‑Fi，然后通过 http://smallcar-XXXX.local 或路由器分配的 IP 访问本控制页面。";
        }
        loadWifiState();
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

  if (scanBtn) {
    scanBtn.addEventListener("click", () => {
      scanNetworks();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveConfig();
    });
  }

  window.addEventListener("load", () => {
    loadWifiState();
  });
})();
