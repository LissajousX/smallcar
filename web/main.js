(function () {
  const wsUrlInput = document.getElementById("ws-url");
  const wsBtn = document.getElementById("ws-connect-btn");
  const wsStatus = document.getElementById("ws-status");
  const appTitleEl = document.getElementById("app-title");
  const batteryText = document.getElementById("battery-text");
  const batteryIcon = document.getElementById("battery-icon");

  const throttleInput = document.getElementById("throttle");
  const steerInput = document.getElementById("steer");
  const yawInput = document.getElementById("yaw");
  const pitchInput = document.getElementById("pitch");
  const gimbalEnable = document.getElementById("gimbal-enable");

  const throttleValue = document.getElementById("throttle-value");
  const steerValue = document.getElementById("steer-value");
  const yawValue = document.getElementById("yaw-value");
  const pitchValue = document.getElementById("pitch-value");

  const btnStop = document.getElementById("btn-stop");
  const btnCenterSteer = document.getElementById("btn-center-steer");
  const btnCenterGimbal = document.getElementById("btn-center-gimbal");

  const btnSpeedGear = document.getElementById("btn-speed-gear");
  const speedGearLabel = document.getElementById("speed-gear-label");

  const btnForward = document.getElementById("btn-forward");
  const btnBackward = document.getElementById("btn-backward");
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");

  const btnDriveNW = document.getElementById("btn-drive-nw");
  const btnDriveNE = document.getElementById("btn-drive-ne");
  const btnDriveSW = document.getElementById("btn-drive-sw");
  const btnDriveSE = document.getElementById("btn-drive-se");

  const btnGimbalUp = document.getElementById("btn-gimbal-up");
  const btnGimbalDown = document.getElementById("btn-gimbal-down");
  const btnGimbalLeft = document.getElementById("btn-gimbal-left");
  const btnGimbalRight = document.getElementById("btn-gimbal-right");

  // 覆盖在视频上的简化控制按钮（横屏低高度时使用）
  const ovDriveForward = document.getElementById("ov-drive-forward");
  const ovDriveBackward = document.getElementById("ov-drive-backward");
  const ovDriveLeft = document.getElementById("ov-drive-left");
  const ovDriveRight = document.getElementById("ov-drive-right");
  const ovDriveStop = document.getElementById("ov-drive-stop");
  const ovDriveNW = document.getElementById("ov-drive-nw");
  const ovDriveNE = document.getElementById("ov-drive-ne");
  const ovDriveSW = document.getElementById("ov-drive-sw");
  const ovDriveSE = document.getElementById("ov-drive-se");

  const ovSpeedGear = document.getElementById("ov-speed-gear");
  const ovSpeedLabel = document.getElementById("ov-speed-label");

  const ovGimbalUp = document.getElementById("ov-gimbal-up");
  const ovGimbalDown = document.getElementById("ov-gimbal-down");
  const ovGimbalLeft = document.getElementById("ov-gimbal-left");
  const ovGimbalRight = document.getElementById("ov-gimbal-right");
  const ovGimbalCenter = document.getElementById("ov-gimbal-center");

  const videoUrlInput = document.getElementById("video-url");
  const videoLoadBtn = document.getElementById("video-load-btn");
  const videoView = document.getElementById("video-view");
  const snapshotBtn = document.getElementById("video-snapshot-btn");
  const recordBtn = document.getElementById("video-record-btn");
  const lightBtn = document.getElementById("video-light-btn");

  // 摄像头高级设置
  const camPresetSelect = document.getElementById("cam-preset");
  const camBrightnessInput = document.getElementById("cam-brightness");
  const camContrastInput = document.getElementById("cam-contrast");
  const camSaturationInput = document.getElementById("cam-saturation");
  const camBrightnessValue = document.getElementById("cam-brightness-value");
  const camContrastValue = document.getElementById("cam-contrast-value");
  const camSaturationValue = document.getElementById("cam-saturation-value");
  const camPresetDesc = document.getElementById("cam-preset-desc");
  const camHmirrorInput = document.getElementById("cam-hmirror");
  const camVflipInput = document.getElementById("cam-vflip");
  const camAwbInput = document.getElementById("cam-awb");
  const camAgcInput = document.getElementById("cam-agc");
  const camAecInput = document.getElementById("cam-aec");
  const camWbModeSelect = document.getElementById("cam-wb-mode");
  const camAeLevelInput = document.getElementById("cam-ae-level");
  const camAeLevelValue = document.getElementById("cam-ae-level-value");
  const camLightInput = document.getElementById("cam-light");
  const camLightValue = document.getElementById("cam-light-value");
  const camAdvancedApplyBtn = document.getElementById("cam-advanced-apply");
  const camAdvancedApplyStatus = document.getElementById("cam-advanced-apply-status");
  const otaFileInput = document.getElementById("ota-file");
  const otaUploadBtn = document.getElementById("ota-upload-btn");
  const otaFetchLatestBtn = document.getElementById("ota-fetch-latest-btn");
  const otaOpenRepoBtn = document.getElementById("ota-open-repo-btn");
  const otaFwTypeSelect = document.getElementById("ota-fw-type");
  const otaStatus = document.getElementById("ota-status");
  const routerBaseInput = document.getElementById("router-base");

  const driveJoystick = document.getElementById("drive-joystick");
  const driveStick = document.getElementById("drive-stick");
  const gimbalJoystick = document.getElementById("gimbal-joystick");
  const gimbalStick = document.getElementById("gimbal-stick");

  const lastPayloadView = document.getElementById("last-payload");
  const snapshotThumb = document.getElementById("snapshot-thumb");
  const snapshotModal = document.getElementById("snapshot-modal");
  const snapshotModalImg = document.getElementById("snapshot-modal-img");
  const snapshotModalClose = document.getElementById("snapshot-modal-close");
  const videoModal = document.getElementById("video-modal");
  const videoModalPlayer = document.getElementById("video-modal-player");
  const videoModalClose = document.getElementById("video-modal-close");
  const camAdvancedModal = document.getElementById("cam-advanced-modal");
  const camAdvancedClose = document.getElementById("cam-advanced-close");
  const camAdvancedBtn = document.getElementById("video-advanced-btn");
  const videoLightSlider = document.getElementById("video-light-slider");
  const videoLightLevelInput = document.getElementById("video-light-level");
  const videoPlayOverlay = document.getElementById("video-play-overlay");
  const videoPlayBtn = document.getElementById("video-play-btn");
  const videoPlayControls = document.getElementById("video-play-controls");
  const videoPlayToggle = document.getElementById("video-play-toggle");
  const videoBox = document.querySelector(".panel-video .video-box");
  const videoRecordTimer = document.getElementById("video-record-timer");

  const statusThrottle = document.getElementById("status-throttle");
  const statusSteer = document.getElementById("status-steer");
  const statusYaw = document.getElementById("status-yaw");
  const statusPitch = document.getElementById("status-pitch");
  const statusFwBuild = document.getElementById("status-fw-build");
  const snapshotUploadStatus = document.getElementById("snapshot-upload-status");
  const snapshotHealthStatus = document.getElementById("snapshot-health-status");
  const videoHealthStatus = document.getElementById("video-health-status");
  const openSetupBtn = document.getElementById("btn-open-setup");

  const ovStatusThrottle = document.getElementById("ov-status-throttle");
  const ovStatusSteer = document.getElementById("ov-status-steer");
  const ovStatusYaw = document.getElementById("ov-status-yaw");
  const ovStatusPitch = document.getElementById("ov-status-pitch");

  let ws = null;
  let sendTimer = null;
  let videoActive = false; // 当前是否在播放流（router_stream）
  let videoPaused = false; // 当前是否处于“暂停”状态（画面冻结）
  let videoRecording = false; // 当前是否在录像中（router 侧）
  let videoRecordStartTime = null;
  let videoRecordTimerId = null;
  let lightOn = false; // 补光灯当前状态
  let lightLevel = 125; // 补光灯亮度（0-255），默认 125
  let cameraStatusLoaded = false; // 是否已成功从 ESP32-CAM 加载过一次状态

  const state = {
    throttle: 0,
    steer: 0,
    yaw: 90,
    pitch: 90,
  };

  const lastMedia = {
    type: "photo", // "photo" | "video"
    src: "",
    videoUrl: "",
  };

  const VIDEO_PLACEHOLDER = "placeholder-video.svg";
  const DEFAULT_ROUTER_BASE_FALLBACK = "http://192.168.31.1:8099";

  const APP_CONFIG = (function () {
    const globalCfg = window.SMALLCAR_CONFIG || {};
    const profiles = globalCfg.profiles || {};
    const activeName =
      globalCfg.activeProfile && profiles[globalCfg.activeProfile]
        ? globalCfg.activeProfile
        : Object.keys(profiles)[0] || null;
    const active = activeName ? profiles[activeName] : globalCfg;

    function get(key, fallback) {
      if (active && typeof active[key] === "string" && active[key]) {
        return active[key];
      }
      if (typeof globalCfg[key] === "string" && globalCfg[key]) {
        return globalCfg[key];
      }
      return fallback;
    }

    return { profileName: activeName, get };
  })();

  const APP_MODE = (function () {
    const mode = APP_CONFIG.get("mode", APP_CONFIG.profileName || "geek");
    const name = mode === "product" ? "product" : "geek";
    return {
      name,
      isProduct: name === "product",
      isGeek: name !== "product",
    };
  })();

  const DEFAULT_ROUTER_BASE = APP_CONFIG.get(
    "defaultRouterBase",
    DEFAULT_ROUTER_BASE_FALLBACK,
  );

  let SNAPSHOT_DEFAULT_HOST = "192.168.31.1";
  let SNAPSHOT_DEFAULT_PORT = 8099;
  try {
    const u = new URL(DEFAULT_ROUTER_BASE);
    if (u.hostname) {
      SNAPSHOT_DEFAULT_HOST = u.hostname;
    }
    if (u.port) {
      const p = parseInt(u.port, 10);
      if (!Number.isNaN(p) && p > 0 && p < 65536) {
        SNAPSHOT_DEFAULT_PORT = p;
      }
    }
  } catch (e) {}

  if (wsUrlInput) {
    let defWs = wsUrlInput.value || "";
    if (APP_MODE.isProduct) {
      try {
        const loc = window.location || {};
        const proto = loc.protocol === "https:" ? "wss:" : "ws:";
        const host = loc.hostname || "smallcar.local";
        defWs = `${proto}//${host}:8765/ws_control`;
      } catch (e) {}
    } else {
      defWs = APP_CONFIG.get("defaultWsUrl", wsUrlInput.value || defWs);
    }
    if (!wsUrlInput.value && defWs) {
      wsUrlInput.value = defWs;
    }
  }

  if (videoUrlInput) {
    let defVideo = videoUrlInput.value || "";
    if (APP_MODE.isProduct) {
      try {
        const loc = window.location || {};
        const host = loc.hostname || "smallcar.local";
        defVideo = `http://${host}:81/stream`;
      } catch (e) {}
    } else {
      defVideo = APP_CONFIG.get("defaultVideoUrl", videoUrlInput.value || defVideo);
    }
    if (!videoUrlInput.value && defVideo) {
      videoUrlInput.value = defVideo;
    }
  }

  if (routerBaseInput) {
    const defRouter = routerBaseInput.value || DEFAULT_ROUTER_BASE;
    if (defRouter) {
      routerBaseInput.value = defRouter;
    }
  }

  if (APP_MODE.isProduct) {
    // 产品模式下隐藏与路由器强相关的配置和状态图标，但保留 WS / 视频地址和 OTA 控件，方便调试
    if (routerBaseInput && routerBaseInput.parentElement) {
      routerBaseInput.parentElement.style.display = "none";
    }

    if (recordBtn) {
      recordBtn.style.display = "none";
    }
    if (videoRecordTimer) {
      videoRecordTimer.style.display = "none";
    }

    if (snapshotUploadStatus) {
      snapshotUploadStatus.style.display = "none";
    }

    try {
      const serviceIcons = document.querySelector(".status-service-icons");
      if (serviceIcons) {
        serviceIcons.style.display = "none";
      }
    } catch (e) {}
  } else {
    if (openSetupBtn) {
      openSetupBtn.style.display = "none";
    }
  }

  const DRIVE_SPEED = 80;
  const DRIVE_STEER_FULL = 100;
  const DRIVE_STEER_DIAG = 60;
  const GIMBAL_STEP = 3;

  // 与 STM32 固件 main.c 中的角度限制保持一致
  // YAW_MIN_ANGLE 15, YAW_MAX_ANGLE 165, PITCH_MIN_ANGLE 15, PITCH_MAX_ANGLE 150
  const YAW_MIN = 15;
  const YAW_MAX = 165;
  const PITCH_MIN = 15;
  const PITCH_MAX = 150;

  const SPEED_LEVELS = [60, 80, 100];
  const SPEED_LABELS = ["低", "中", "高"];
  let speedGearIndex = 1;
  const DRIVE_STEER_SPIN = 100;

  const keyDirectionMap = {
    KeyQ: "FL", // 前进左转（斜前左）
    KeyW: "F",  // 前进
    KeyE: "FR", // 前进右转（斜前右）
    KeyA: "SL", // 原地左转
    KeyD: "SR", // 原地右转
    KeyZ: "BL", // 后退左转（斜后左）
    KeyS: "STOP",  // 停止
    KeyX: "B",     // 后退
    KeyC: "BR", // 后退右转（斜后右）
  };

  function isTouchDevice() {
    return (
      "ontouchstart" in window ||
      (navigator && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0))
    );
  }

  function applyAppVersion(raw) {
    if (!raw) return;
    const version = String(raw).trim();
    if (!version) return;
    const baseTitle = "SmallCar \u8fdc\u7a0b\u63a7\u5236\u9762\u677f";
    const baseHeader = "SmallCar \u8fdc\u7a0b\u63a7\u5236";
    document.title = `${baseTitle} ${version}`;
    if (appTitleEl) {
      appTitleEl.textContent = `${baseHeader} ${version}`;
    }
  }

  async function loadAppVersion() {
    if (typeof fetch !== "function") {
      return;
    }
    try {
      const resp = await fetch("version.txt", { cache: "no-store" });
      if (!resp.ok) {
        return;
      }
      const text = await resp.text();
      applyAppVersion(text);
    } catch (e) {}
  }

  function resetOtaControls() {
    if (otaFileInput) {
      otaFileInput.value = "";
    }
    if (otaStatus) {
      otaStatus.textContent =
        "可以手动选择编译生成的 .bin 文件，或直接从路由器提供的最新固件一键升级。";
      otaStatus.style.color = "";
    }
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function getPresetDesc(value) {
    if (value === "low") {
      return "流畅：320×240，压缩率高，延迟低，适合弱网络/远距离。";
    }
    if (value === "high") {
      return "清晰：800×600 左右，压缩率低，画质最好，对带宽/性能要求较高。";
    }
    return "平衡：640×480，中等码率，适合大多数场景。";
  }

  function guessPresetFromStatus(data) {
    if (!data || typeof data.framesize !== "number" || typeof data.quality !== "number") {
      return "normal";
    }
    const fs = data.framesize;
    const q = data.quality;
    // 基于 ESP32-CAM 的典型配置粗略推断：QVGA/低码率=流畅，SVGA/高码率=清晰，其余视为平衡
    if (fs <= 5 && q >= 16) {
      return "low";
    }
    if (fs >= 10 && q <= 12) {
      return "high";
    }
    return "normal";
  }

  function getRouterBase() {
    if (routerBaseInput) {
      const raw = routerBaseInput.value.trim();
      if (raw) {
        try {
          const u = new URL(raw);
          if (u.protocol === "http:" || u.protocol === "https:") {
            // 去掉末尾多余的 /
            return u.origin + u.pathname.replace(/\/+$/, "");
          }
        } catch (e) {
          // 忽略非法地址，回退到默认值
        }
      }
    }
    return DEFAULT_ROUTER_BASE;
  }

  function formatFwBuildCompact(buildStr) {
    if (typeof buildStr !== "string" || !buildStr) {
      return buildStr;
    }
    const parts = buildStr.trim().split(/\s+/);
    if (parts.length < 4) {
      return buildStr;
    }
    const monthMap = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    };
    const mon = monthMap[parts[0]];
    if (!mon) {
      return buildStr;
    }
    const day = parts[1].padStart(2, "0");
    const year = parts[2];
    const timeParts = parts[3].split(":");
    const hhmm =
      timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}` : parts[3];
    return `${year}-${mon}-${day} ${hhmm}`;
  }

  function buildCameraBaseFromVideoUrl() {
    if (!videoUrlInput) return null;
    const url = videoUrlInput.value.trim();
    if (!url) return null;
    try {
      const u = new URL(url, window.location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return null;
      }
      // ESP32-CAM 的 /capture、/control、/status 等接口一般在 HTTP 主端口
      return `${u.protocol}//${u.hostname}`;
    } catch (e) {
      return null;
    }
  }

  function updateCameraAdvancedLabels() {
    if (camBrightnessInput && camBrightnessValue) {
      camBrightnessValue.textContent = String(camBrightnessInput.value);
    }
    if (camContrastInput && camContrastValue) {
      camContrastValue.textContent = String(camContrastInput.value);
    }
    if (camSaturationInput && camSaturationValue) {
      camSaturationValue.textContent = String(camSaturationInput.value);
    }
    if (camAeLevelInput && camAeLevelValue) {
      camAeLevelValue.textContent = String(camAeLevelInput.value);
    }
    if (camLightInput && camLightValue) {
      camLightValue.textContent = String(camLightInput.value);
    }
  }

  function updateCamPresetDesc() {
    if (camPresetSelect && camPresetDesc) {
      const value = camPresetSelect.value || "normal";
      camPresetDesc.textContent = getPresetDesc(value);
    }
  }

  function setCamAdvancedApplyStatus(state) {
    if (!camAdvancedApplyStatus) {
      return;
    }

    camAdvancedApplyStatus.classList.remove(
      "cam-advanced-apply-status--idle",
      "cam-advanced-apply-status--applying",
      "cam-advanced-apply-status--applied",
    );

    let text = "尚未应用";
    let cls = "cam-advanced-apply-status--idle";
    if (state === "applying") {
      text = "正在应用到摄像头...";
      cls = "cam-advanced-apply-status--applying";
    } else if (state === "applied") {
      text = "已应用到摄像头";
      cls = "cam-advanced-apply-status--applied";
    }

    camAdvancedApplyStatus.textContent = text;
    camAdvancedApplyStatus.classList.add(cls);
  }

  async function loadCameraStatus() {
    const base = buildCameraBaseFromVideoUrl();
    if (!base || !window.fetch) {
      return;
    }
    try {
      const resp = await fetch(`${base}/status?t=${Date.now()}`, { mode: "cors" });
      if (!resp.ok) {
        return;
      }
      const data = await resp.json();
      if (camPresetSelect && typeof data.framesize === "number" && typeof data.quality === "number") {
        camPresetSelect.value = guessPresetFromStatus(data);
        updateCamPresetDesc();
      }
      if (camBrightnessInput && typeof data.brightness === "number") {
        camBrightnessInput.value = String(data.brightness);
      }
      if (camContrastInput && typeof data.contrast === "number") {
        camContrastInput.value = String(data.contrast);
      }
      if (camSaturationInput && typeof data.saturation === "number") {
        camSaturationInput.value = String(data.saturation);
      }
      if (camHmirrorInput && typeof data.hmirror === "number") {
        camHmirrorInput.checked = !!data.hmirror;
      }
      if (camVflipInput && typeof data.vflip === "number") {
        camVflipInput.checked = !!data.vflip;
      }
      if (camAwbInput && typeof data.awb === "number") {
        camAwbInput.checked = !!data.awb;
      }
      if (camAgcInput && typeof data.agc === "number") {
        camAgcInput.checked = !!data.agc;
      }
      if (camAecInput && typeof data.aec === "number") {
        camAecInput.checked = !!data.aec;
      }
      if (camWbModeSelect && typeof data.wb_mode === "number") {
        camWbModeSelect.value = String(data.wb_mode);
      }
      if (camAeLevelInput && typeof data.ae_level === "number") {
        camAeLevelInput.value = String(data.ae_level);
      }
      if (statusFwBuild) {
        const hasVersion =
          typeof data.fw_version === "string" && data.fw_version.length > 0;
        const hasBuild =
          typeof data.fw_build === "string" && data.fw_build.length > 0;
        const compactBuild = hasBuild
          ? formatFwBuildCompact(data.fw_build)
          : "";
        if (hasVersion && compactBuild) {
          statusFwBuild.textContent = `${data.fw_version} ${compactBuild}`;
        } else if (hasVersion) {
          statusFwBuild.textContent = data.fw_version;
        } else if (compactBuild) {
          statusFwBuild.textContent = compactBuild;
        } else {
          statusFwBuild.textContent = "--";
        }
      }
      if (typeof data.led_intensity === "number" && data.led_intensity > 0) {
        // 只用 /status 判断当前灯是否处于亮的状态，亮度值始终以前端默认 125 为起点
        lightOn = true;
        if (lightBtn) {
          lightBtn.classList.add("active");
        }
        if (videoLightSlider) {
          videoLightSlider.classList.add("visible");
        }
      }
      cameraStatusLoaded = true;
      updateCameraAdvancedLabels();
    } catch (e) {
      // 忽略状态获取失败，不影响其他功能
    }
  }

  function applyCameraAdvancedSettings() {
    const base = buildCameraBaseFromVideoUrl();
    if (!base) {
      alert("请先填写有效的视频流地址，例如 http://192.168.31.140:81/stream");
      return;
    }

    if (camAdvancedApplyStatus) {
      setCamAdvancedApplyStatus("applying");
    }

    const urls = [];
    if (camPresetSelect && camPresetSelect.value) {
      urls.push(`${base}/control?var=preset&val=${encodeURIComponent(camPresetSelect.value)}`);
    }
    if (camBrightnessInput) {
      urls.push(`${base}/control?var=brightness&val=${encodeURIComponent(camBrightnessInput.value)}`);
    }
    if (camContrastInput) {
      urls.push(`${base}/control?var=contrast&val=${encodeURIComponent(camContrastInput.value)}`);
    }
    if (camSaturationInput) {
      urls.push(`${base}/control?var=saturation&val=${encodeURIComponent(camSaturationInput.value)}`);
    }
    if (cameraStatusLoaded && camHmirrorInput) {
      urls.push(`${base}/control?var=hmirror&val=${camHmirrorInput.checked ? 1 : 0}`);
    }
    if (cameraStatusLoaded && camVflipInput) {
      urls.push(`${base}/control?var=vflip&val=${camVflipInput.checked ? 1 : 0}`);
    }
    if (camAwbInput) {
      urls.push(`${base}/control?var=awb&val=${camAwbInput.checked ? 1 : 0}`);
    }
    if (camAgcInput) {
      urls.push(`${base}/control?var=agc&val=${camAgcInput.checked ? 1 : 0}`);
    }
    if (camAecInput) {
      urls.push(`${base}/control?var=aec&val=${camAecInput.checked ? 1 : 0}`);
    }
    if (camWbModeSelect && camWbModeSelect.value !== "") {
      urls.push(`${base}/control?var=wb_mode&val=${encodeURIComponent(camWbModeSelect.value)}`);
    }
    if (camAeLevelInput) {
      urls.push(`${base}/control?var=ae_level&val=${encodeURIComponent(camAeLevelInput.value)}`);
    }
    if (camLightInput) {
      // 高级设置中的补光灯亮度只作为“下次开灯的默认亮度”，不在此处直接控制 LED
      lightLevel = parseInt(camLightInput.value, 10) || 0;
      if (videoLightLevelInput) {
        videoLightLevelInput.value = String(lightLevel);
      }
      if (camLightValue) {
        camLightValue.textContent = String(lightLevel);
      }
    }

    if (urls.length === 0) {
      if (camAdvancedApplyStatus) {
        setCamAdvancedApplyStatus("applied");
      }
      return;
    }

    urls.forEach((u) => {
      try {
        fetch(u, { mode: "no-cors" }).catch(() => {});
      } catch (e) {
        // 忽略浏览器环境不支持 fetch 的情况
      }
    });

    if (camAdvancedApplyStatus) {
      setCamAdvancedApplyStatus("applied");
    }
  }

  function applyDefaultPresetForProduct() {
    if (!APP_MODE.isProduct) {
      return;
    }
    const base = buildCameraBaseFromVideoUrl();
    if (!base || typeof fetch !== "function") {
      return;
    }
    try {
      const url = `${base}/control?var=preset&val=normal`;
      fetch(url, { mode: "no-cors" }).catch(() => {});
    } catch (e) {}
  }

  function isApHost() {
    try {
      const host = window.location && window.location.hostname;
      return host === "192.168.4.1";
    } catch (e) {
      return false;
    }
  }

  async function maybeShowWifiSetupHintOnAp() {
    if (!APP_MODE.isProduct || !isApHost() || !openSetupBtn) {
      return;
    }
    if (typeof fetch !== "function") {
      alert("当前小车通过自带热点工作，如需配置家庭 Wi‑Fi，请点击“Wifi配网”按钮。");
      return;
    }
    try {
      const resp = await fetch("/wifi_state", { cache: "no-store" });
      if (!resp.ok) {
        alert("当前小车可能尚未成功接入家庭 Wi‑Fi，如需配置，请点击“Wifi配网”按钮。");
        return;
      }
      const data = await resp.json();
      const staConfigured = !!data.sta_configured;
      const staConnected = !!data.sta_connected;
      if (!staConfigured || !staConnected) {
        alert("当前小车尚未成功接入家庭 Wi‑Fi，如需配置，请点击的“Wifi配网”按钮。");
      }
    } catch (e) {}
  }

  function setStatus(text, cls) {
    // 只用彩色圆点显示状态，把文字放在提示中
    wsStatus.textContent = "";
    wsStatus.title = text;
    wsStatus.className = `status ${cls}`;
  }

  function setSnapshotUploadStatus(state, hint) {
    if (!snapshotUploadStatus) {
      return;
    }

    snapshotUploadStatus.classList.remove(
      "snapshot-upload-icon--idle",
      "snapshot-upload-icon--uploading",
      "snapshot-upload-icon--ok",
      "snapshot-upload-icon--error",
    );

    let cls = "snapshot-upload-icon--idle";
    if (state === "uploading") {
      cls = "snapshot-upload-icon--uploading";
    } else if (state === "ok") {
      cls = "snapshot-upload-icon--ok";
    } else if (state === "error") {
      cls = "snapshot-upload-icon--error";
    }

    snapshotUploadStatus.classList.add(cls);
    if (typeof hint === "string" && hint) {
      snapshotUploadStatus.title = hint;
    }
  }

  function setSnapshotHealthStatus(state, hint) {
    if (!snapshotHealthStatus) {
      return;
    }

    snapshotHealthStatus.classList.remove(
      "snapshot-health-icon--unknown",
      "snapshot-health-icon--ok",
      "snapshot-health-icon--error",
    );

    let cls = "snapshot-health-icon--unknown";
    if (state === "ok") {
      cls = "snapshot-health-icon--ok";
    } else if (state === "error") {
      cls = "snapshot-health-icon--error";
    }

    snapshotHealthStatus.textContent = "";
    snapshotHealthStatus.classList.add("snapshot-health-icon", cls);
    if (typeof hint === "string" && hint) {
      snapshotHealthStatus.title = hint;
    }
  }

  function setVideoHealthStatus(state, hint) {
    if (!videoHealthStatus) {
      return;
    }

    videoHealthStatus.classList.remove(
      "video-health-icon--unknown",
      "video-health-icon--ok",
      "video-health-icon--error",
    );

    let cls = "video-health-icon--unknown";
    if (state === "ok") {
      cls = "video-health-icon--ok";
    } else if (state === "error") {
      cls = "video-health-icon--error";
    }

    videoHealthStatus.textContent = "";
    videoHealthStatus.classList.add("video-health-icon", cls);
    if (typeof hint === "string" && hint) {
      videoHealthStatus.title = hint;
    }
  }

  function computeBatteryPercentFromMv(mv) {
    const FULL_MV = 12300;
    const EMPTY_MV = 10500;

    if (typeof mv !== "number" || !Number.isFinite(mv)) {
      return null;
    }

    if (mv <= EMPTY_MV) {
      return 0;
    }
    if (mv >= FULL_MV) {
      return 100;
    }

    const p = Math.floor(((mv - EMPTY_MV) * 100) / (FULL_MV - EMPTY_MV));
    if (p < 0) {
      return 0;
    }
    if (p > 100) {
      return 100;
    }
    return p;
  }

  function setBatteryIndicator(state) {
    if (!batteryIcon || !batteryText) {
      return;
    }

    let percent = null;
    let mv = null;
    let ok = false;

    if (state && typeof state.mv === "number" && state.mv >= 0) {
      mv = state.mv;
    }
    if (state && state.ok) {
      ok = true;
    }

    batteryIcon.classList.remove(
      "battery-icon--unknown",
      "battery-icon--ok",
      "battery-icon--low",
      "battery-icon--error",
    );

    let cls = "battery-icon--unknown";
    let text = "--%";
    let title = "电池电量未知";

    if (!state) {
      // 保持默认未知
    } else if (!ok) {
      cls = "battery-icon--error";
      text = "--%";
      title = "无法获取电池电量";
    } else {
      if (mv != null) {
        percent = computeBatteryPercentFromMv(mv);
      } else if (state && typeof state.percent === "number" && state.percent >= 0) {
        // 兼容旧固件：没有 mv 时退回使用固件自带百分比
        percent = state.percent;
      }

      if (percent != null) {
        text = `${percent}%`;
        if (percent <= 20) {
          cls = "battery-icon--low";
        } else {
          cls = "battery-icon--ok";
        }
        if (mv != null) {
          title = `电压 ${mv} mV，约 ${percent}%`;
        } else {
          title = `电量约 ${percent}%`;
        }
      }
    }

    let fillPercent = 0;
    if (state && ok && percent != null) {
      const p = Math.max(0, Math.min(percent, 100));
      fillPercent = p;
    }
    batteryIcon.style.setProperty("--battery-fill", `${fillPercent}%`);

    batteryIcon.classList.add("battery-icon", cls);
    batteryText.textContent = text;
    batteryText.title = title;
    batteryIcon.title = title;
  }

  let snapshotHealthTimer = null;
  let videoHealthTimer = null;
  let batteryPollTimer = null;

  function startSnapshotHealthPolling() {
    if (typeof fetch !== "function") {
      return;
    }

    const poll = async () => {
      const routerBase = getRouterBase();
      if (!routerBase) {
        return;
      }
      try {
        const resp = await fetch(`${routerBase}/snapshot_health?t=${Date.now()}`, {
          mode: "cors",
          cache: "no-store",
        });
        if (!resp.ok) {
          setSnapshotHealthStatus("error", `快照服务异常(${resp.status})`);
          return;
        }
        let data = null;
        try {
          data = await resp.json();
        } catch (e) {
        }
        if (data && data.ok) {
          setSnapshotHealthStatus("ok", "快照服务正常");
        } else {
          setSnapshotHealthStatus("error", "快照服务返回异常");
        }
      } catch (e) {
        setSnapshotHealthStatus("error", "无法连接快照服务");
      }
    };

    poll();
    if (snapshotHealthTimer) {
      clearInterval(snapshotHealthTimer);
    }
    snapshotHealthTimer = setInterval(poll, 15000);
  }

  function startVideoHealthPolling() {
    if (typeof fetch !== "function") {
      return;
    }

    const poll = async () => {
      const routerBase = getRouterBase();
      if (!routerBase) {
        return;
      }
      try {
        const resp = await fetch(`${routerBase}/video_health?t=${Date.now()}`, {
          mode: "cors",
          cache: "no-store",
        });
        if (!resp.ok) {
          setVideoHealthStatus("error", `视频服务异常(${resp.status})`);
          return;
        }
        let data = null;
        try {
          data = await resp.json();
        } catch (e) {
        }
        if (data && data.ok) {
          setVideoHealthStatus("ok", "视频服务正常");
        } else {
          setVideoHealthStatus("error", "视频服务返回异常");
        }
      } catch (e) {
        setVideoHealthStatus("error", "无法连接视频服务");
      }
    };

    poll();
    if (videoHealthTimer) {
      clearInterval(videoHealthTimer);
    }
    videoHealthTimer = setInterval(poll, 15000);
  }

  function startBatteryPolling() {
    if (typeof fetch !== "function") {
      return;
    }

    const poll = async () => {
      const base = buildCameraBaseFromVideoUrl();
      if (!base) {
        setBatteryIndicator(null);
        return;
      }
      try {
        const resp = await fetch(`${base}/battery?t=${Date.now()}`, {
          mode: "cors",
          cache: "no-store",
        });
        if (!resp.ok) {
          setBatteryIndicator({ ok: false });
          return;
        }
        let data = null;
        try {
          data = await resp.json();
        } catch (e) {}

        if (!data) {
          setBatteryIndicator({ ok: false });
          return;
        }

        setBatteryIndicator({
          ok: !!data.ok,
          mv: typeof data.mv === "number" ? data.mv : -1,
          percent: typeof data.percent === "number" ? data.percent : -1,
          age_ms: typeof data.age_ms === "number" ? data.age_ms : 0,
        });
      } catch (e) {
        setBatteryIndicator({ ok: false });
      }
    };

    poll();
    if (batteryPollTimer) {
      clearInterval(batteryPollTimer);
    }
    batteryPollTimer = setInterval(poll, 60000);
  }

  async function triggerSnapshotToRouter() {
    const base = buildCameraBaseFromVideoUrl();
    if (!base || typeof fetch !== "function") {
      return;
    }

    setSnapshotUploadStatus("uploading", "上传中...");

    let host = SNAPSHOT_DEFAULT_HOST;
    let port = SNAPSHOT_DEFAULT_PORT;

    try {
      const routerBase = getRouterBase();
      const u = new URL(routerBase);
      if (u.hostname) {
        host = u.hostname;
      }
      if (u.port) {
        const p = parseInt(u.port, 10);
        if (!Number.isNaN(p) && p > 0 && p < 65536) {
          port = p;
        }
      }
    } catch (e) {
    }

    const params = new URLSearchParams();
    params.set("host", host);
    params.set("port", String(port));
    params.set("path", "/upload_snapshot");

    const url = `${base}/snapshot_to_router?${params.toString()}`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        mode: "cors",
      });
      if (!resp.ok) {
        setSnapshotUploadStatus("error", `上传失败(${resp.status})`);
        return;
      }
      let data = null;
      try {
        data = await resp.json();
      } catch (e) {
      }
      if (data && data.ok) {
        if (typeof data.bytes === "number") {
          setSnapshotUploadStatus("ok", `已上传 (${data.bytes}B)`);
        } else {
          setSnapshotUploadStatus("ok", "已上传");
        }
        if (snapshotThumb) {
          // 记录当前缩略图对应的是照片
          lastMedia.type = "photo";
          lastMedia.src = snapshotThumb.src || "";
          lastMedia.videoUrl = "";
        }
      } else {
        setSnapshotUploadStatus("error", "上传失败（路由器未确认保存）");
      }
    } catch (e) {
      setSnapshotUploadStatus("error", "上传失败");
    }
  }

  async function triggerVideoRecordToRouter() {
    if (typeof fetch !== "function") {
      return;
    }

    const streamUrl = videoUrlInput ? videoUrlInput.value.trim() : "";
    if (!streamUrl) {
      return;
    }

    setSnapshotUploadStatus("uploading", "视频录制中...");

    const routerBase = getRouterBase();
    const url = `${routerBase}/record_video`;

    const payload = {
      stream_url: streamUrl,
      duration: 5, // 先固定录制 5 秒，后续可做成可配置
    };

    try {
      const resp = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        setSnapshotUploadStatus("error", `视频录制失败(${resp.status})`);
        return;
      }
      let data = null;
      try {
        data = await resp.json();
      } catch (e) {
      }
      if (data && data.ok) {
        setSnapshotUploadStatus("ok", "视频录制完成");

        // 期望后端返回绝对 URL：data.thumb（缩略图）、data.video（视频文件）
        if (data.thumb && typeof data.thumb === "string") {
          if (snapshotThumb) {
            snapshotThumb.src = data.thumb;
          }
          lastMedia.type = "video";
          lastMedia.src = data.thumb;
          if (typeof data.video === "string" && data.video) {
            lastMedia.videoUrl = data.video;
          } else if (typeof data.path === "string" && data.path) {
            lastMedia.videoUrl = data.path;
          } else {
            lastMedia.videoUrl = "";
          }
        } else if (typeof data.video === "string" && data.video) {
          // 没有单独缩略图时，至少记录视频 URL，缩略图仍使用占位图
          lastMedia.type = "video";
          lastMedia.videoUrl = data.video;
        }
      } else {
        setSnapshotUploadStatus("error", "视频录制失败（路由器未确认保存）");
      }
    } catch (e) {
      setSnapshotUploadStatus("error", "视频录制失败");
    }
  }

  const keyToButton = {
    KeyQ: btnDriveNW,
    KeyW: btnForward,
    KeyE: btnDriveNE,
    KeyA: btnLeft,
    KeyS: btnStop,
    KeyD: btnRight,
    KeyZ: btnDriveSW,
    KeyX: btnBackward,
    KeyC: btnDriveSE,
    ArrowUp: btnGimbalUp,
    ArrowDown: btnGimbalDown,
    ArrowLeft: btnGimbalLeft,
    ArrowRight: btnGimbalRight,
    Space: btnCenterGimbal,
    Digit1: btnSpeedGear,
    Digit2: btnSpeedGear,
    Digit3: btnSpeedGear,
  };

  function setKeyActive(code, active) {
    const btn = keyToButton[code];
    if (!btn) {
      return;
    }
    if (active) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  function updateLabels() {
    throttleValue.textContent = state.throttle;
    steerValue.textContent = state.steer;
    yawValue.textContent = state.yaw;
    pitchValue.textContent = state.pitch;

    if (statusThrottle) statusThrottle.textContent = state.throttle;
    if (statusSteer) statusSteer.textContent = state.steer;
    if (statusYaw) statusYaw.textContent = state.yaw;
    if (statusPitch) statusPitch.textContent = state.pitch;

    if (ovStatusThrottle) ovStatusThrottle.textContent = state.throttle;
    if (ovStatusSteer) ovStatusSteer.textContent = state.steer;
    if (ovStatusYaw) ovStatusYaw.textContent = state.yaw;
    if (ovStatusPitch) ovStatusPitch.textContent = state.pitch;
  }

  function getCurrentSpeed() {
    if (speedGearIndex < 0 || speedGearIndex >= SPEED_LEVELS.length) {
      return SPEED_LEVELS[1];
    }
    return SPEED_LEVELS[speedGearIndex];
  }

  function updateSpeedGearLabel() {
    const idx = speedGearIndex;
    const label = SPEED_LABELS[idx] || SPEED_LABELS[1];
    if (speedGearLabel) {
      speedGearLabel.textContent = label;
    }
    if (ovSpeedLabel) {
      ovSpeedLabel.textContent = label;
    }
  }

  function setSpeedGear(index) {
    if (index < 0) {
      index = 0;
    } else if (index >= SPEED_LEVELS.length) {
      index = SPEED_LEVELS.length - 1;
    }
    speedGearIndex = index;
    updateSpeedGearLabel();
  }

  // 横屏小高度时，自动把视频面板滚动到合适位置
  function scrollVideoIntoViewIfLandscape() {
    // 仅在横屏且高度较小时启用，阈值与 CSS 中的 max-height 一致
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if (!isLandscape || window.innerHeight > 520) {
      return;
    }

    const totalHeight =
      document.documentElement.scrollHeight ||
      document.body.scrollHeight ||
      0;
    const targetTop = Math.max(0, totalHeight - window.innerHeight);
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }

  // 根据视频容器高度动态调整右侧补光灯亮度条的长度
  function updateLightSliderSize() {
    if (!videoLightLevelInput) {
      return;
    }
    const box = videoView && videoView.parentElement;
    if (!box) {
      return;
    }
    const rect = box.getBoundingClientRect();
    const h = rect.height || 0;
    if (!h) {
      return;
    }
    // 按视频高度的约 45% 计算亮度条长度，并限制在 80~160 像素之间
    const length = clamp(Math.round(h * 0.45), 80, 160);
    videoLightLevelInput.style.width = `${length}px`;
  }

  // 停止/暂停视频流时，同步重置补光灯前端状态（按钮高亮与亮度条可见性）
  function resetLightUI() {
    lightOn = false;
    if (lightBtn) {
      lightBtn.classList.remove("active");
    }
    if (videoLightSlider) {
      videoLightSlider.classList.remove("visible");
    }
  }

  function setDrive(throttle, steer) {
    state.throttle = clamp(throttle, -100, 100);
    state.steer = clamp(steer, -100, 100);
    throttleInput.value = String(state.throttle);
    steerInput.value = String(state.steer);
    updateLabels();
    sendOnce();
  }

  function centerGimbal() {
    state.yaw = 90;
    state.pitch = 90;
    yawInput.value = "90";
    pitchInput.value = "90";
    updateLabels();
    sendOnce();
  }

  function stopDrive() {
    setDrive(0, 0);
  }

  function applyDirection(dir) {
    const v = getCurrentSpeed();
    switch (dir) {
      case "F":
        setDrive(v, 0);
        break;
      case "B":
        setDrive(-v, 0);
        break;
      case "SL":
        // 原地左转：throttle=0, steer<0
        setDrive(0, -DRIVE_STEER_SPIN);
        break;
      case "SR":
        // 原地右转：throttle=0, steer>0
        setDrive(0, DRIVE_STEER_SPIN);
        break;
      case "FL":
        // 前进左转（斜前左）
        setDrive(v, -DRIVE_STEER_DIAG);
        break;
      case "FR":
        // 前进右转（斜前右）
        setDrive(v, DRIVE_STEER_DIAG);
        break;
      case "BL":
        // 后退左转（斜后左）
        setDrive(-v, -DRIVE_STEER_DIAG);
        break;
      case "BR":
        // 后退右转（斜后右）
        setDrive(-v, DRIVE_STEER_DIAG);
        break;
      case "STOP":
      default:
        stopDrive();
        break;
    }
  }

  function adjustGimbal(dYaw, dPitch) {
    state.yaw = clamp(state.yaw + dYaw, YAW_MIN, YAW_MAX);
    state.pitch = clamp(state.pitch + dPitch, PITCH_MIN, PITCH_MAX);
    yawInput.value = String(state.yaw);
    pitchInput.value = String(state.pitch);
    updateLabels();
  }

  function bindGimbalButton(el, dYaw, dPitch) {
    if (!el) {
      return;
    }

    let holdTimer = null;

    const step = () => {
      adjustGimbal(dYaw, dPitch);
    };

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      step();
      if (holdTimer) {
        clearInterval(holdTimer);
      }
      holdTimer = setInterval(step, 80);
    });

    const endHandler = (e) => {
      e.preventDefault();
      if (holdTimer) {
        clearInterval(holdTimer);
        holdTimer = null;
      }
    };

    el.addEventListener("pointerup", endHandler);
    el.addEventListener("pointercancel", endHandler);
    el.addEventListener("pointerleave", endHandler);
  }

  function buildPayload() {
    return {
      type: "control",
      throttle: state.throttle,
      steer: state.steer,
      yaw: state.yaw,
      pitch: state.pitch,
    };
  }

  function sendOnce() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload = buildPayload();
    const json = JSON.stringify(payload);
    ws.send(json);
    if (lastPayloadView) {
      const cmd = `C,${payload.throttle},${payload.steer},${payload.yaw},${payload.pitch}`;
      lastPayloadView.textContent = cmd;
    }
  }

  function startSending() {
    if (sendTimer) {
      clearInterval(sendTimer);
    }
    const interval = 100; // 固定发送周期，单位 ms，适当放缓以减轻网络压力
    sendTimer = setInterval(sendOnce, interval);
  }

  function stopSending() {
    if (sendTimer) {
      clearInterval(sendTimer);
      sendTimer = null;
    }
  }

  function connect() {
    const url = wsUrlInput.value.trim();
    if (!url) {
      alert("请先填写 WebSocket 地址");
      return;
    }

    if (ws) {
      ws.close();
      ws = null;
    }

    try {
      ws = new WebSocket(url);
    } catch (e) {
      alert("无法创建 WebSocket：" + e.message);
      return;
    }

    setStatus("连接中...", "status-disconnected");
    wsBtn.textContent = "断开";

    ws.onopen = function () {
      setStatus("已连接", "status-connected");
      startSending();
    };

    ws.onclose = function () {
      setStatus("未连接", "status-disconnected");
      wsBtn.textContent = "连接";
      stopSending();
    };

    ws.onerror = function () {
      setStatus("错误", "status-error");
    };
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    setStatus("未连接", "status-disconnected");
    wsBtn.textContent = "连接";
    stopSending();
  }

  function setupJoystick(area, stick, onChange) {
    if (!area || !stick) {
      return;
    }

    let active = false;
    let pointerId = null;

    function getGeom() {
      const rect = area.getBoundingClientRect();
      const radius = area.clientWidth / 2;
      const stickRadius = stick.clientWidth / 2;
      return { rect, radius, stickRadius };
    }

    function setStick(dx, dy) {
      const g = getGeom();
      const center = g.radius;
      const x = center + dx - g.stickRadius;
      const y = center + dy - g.stickRadius;
      stick.style.left = `${x}px`;
      stick.style.top = `${y}px`;
    }

    function resetStick() {
      const g = getGeom();
      setStick(0, 0);
      onChange(0, 0);
    }

    function handleMove(clientX, clientY) {
      const g = getGeom();
      const centerX = g.rect.left + g.radius;
      const centerY = g.rect.top + g.radius;
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const maxDist = g.radius - g.stickRadius;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist > maxDist) {
        const s = maxDist / dist;
        dx *= s;
        dy *= s;
      }
      const normX = dx / maxDist;
      const normY = dy / maxDist;
      setStick(dx, dy);
      onChange(normX, normY);
    }

    area.addEventListener("pointerdown", (e) => {
      active = true;
      pointerId = e.pointerId;
      area.setPointerCapture(pointerId);
      handleMove(e.clientX, e.clientY);
    });

    area.addEventListener("pointermove", (e) => {
      if (!active || e.pointerId !== pointerId) {
        return;
      }
      handleMove(e.clientX, e.clientY);
    });

    function endPointer(e) {
      if (!active || e.pointerId !== pointerId) {
        return;
      }
      active = false;
      area.releasePointerCapture(pointerId);
      resetStick();
    }

    area.addEventListener("pointerup", endPointer);
    area.addEventListener("pointercancel", endPointer);

    // 初始归中
    window.addEventListener("load", resetStick);
  }

  // 事件绑定
  throttleInput.addEventListener("input", () => {
    state.throttle = parseInt(throttleInput.value, 10) || 0;
    updateLabels();
  });

  steerInput.addEventListener("input", () => {
    state.steer = parseInt(steerInput.value, 10) || 0;
    updateLabels();
  });

  yawInput.addEventListener("input", () => {
    state.yaw = parseInt(yawInput.value, 10) || 0;
    updateLabels();
  });

  pitchInput.addEventListener("input", () => {
    state.pitch = parseInt(pitchInput.value, 10) || 0;
    updateLabels();
  });

  if (camBrightnessInput) {
    camBrightnessInput.addEventListener("input", () => {
      updateCameraAdvancedLabels();
    });
  }

  if (camContrastInput) {
    camContrastInput.addEventListener("input", () => {
      updateCameraAdvancedLabels();
    });
  }

  if (camSaturationInput) {
    camSaturationInput.addEventListener("input", () => {
      updateCameraAdvancedLabels();
    });
  }

  if (camPresetSelect) {
    camPresetSelect.addEventListener("change", () => {
      updateCamPresetDesc();
    });
  }

  if (camAeLevelInput) {
    camAeLevelInput.addEventListener("input", () => {
      updateCameraAdvancedLabels();
    });
  }

  if (camLightInput) {
    camLightInput.addEventListener("input", () => {
      lightLevel = parseInt(camLightInput.value, 10) || 0;
      if (videoLightLevelInput) {
        videoLightLevelInput.value = String(lightLevel);
      }
      updateCameraAdvancedLabels();
    });
  }

  if (videoLightLevelInput) {
    videoLightLevelInput.addEventListener("input", () => {
      lightLevel = parseInt(videoLightLevelInput.value, 10) || 0;
      if (camLightInput) {
        camLightInput.value = String(lightLevel);
      }
      if (camLightValue) {
        camLightValue.textContent = String(lightLevel);
      }
      const base = buildCameraBaseFromVideoUrl();
      if (!base) {
        return;
      }
      const url = `${base}/control?var=led_intensity&val=${encodeURIComponent(lightLevel)}`;
      try {
        fetch(url, { mode: "no-cors" }).catch(() => {});
      } catch (e) {
        // 忽略浏览器环境不支持 fetch 的情况
      }
    });
  }

  btnStop.addEventListener("click", () => {
    state.throttle = 0;
    state.steer = 0;
    throttleInput.value = "0";
    steerInput.value = "0";
    updateLabels();
    sendOnce();
  });

  if (btnCenterSteer) {
    btnCenterSteer.addEventListener("click", () => {
      state.steer = 0;
      steerInput.value = "0";
      updateLabels();
      sendOnce();
    });
  }

  btnCenterGimbal.addEventListener("click", () => {
    centerGimbal();
  });

  if (btnGimbalUp && btnGimbalDown && btnGimbalLeft && btnGimbalRight) {
    bindGimbalButton(btnGimbalUp, 0, GIMBAL_STEP);
    bindGimbalButton(btnGimbalDown, 0, -GIMBAL_STEP);
    bindGimbalButton(btnGimbalLeft, -GIMBAL_STEP, 0);
    bindGimbalButton(btnGimbalRight, GIMBAL_STEP, 0);
  }

  // 覆盖在视频上的云台控制按钮
  if (ovGimbalUp && ovGimbalDown && ovGimbalLeft && ovGimbalRight && ovGimbalCenter) {
    bindGimbalButton(ovGimbalUp, 0, GIMBAL_STEP);
    bindGimbalButton(ovGimbalDown, 0, -GIMBAL_STEP);
    bindGimbalButton(ovGimbalLeft, -GIMBAL_STEP, 0);
    bindGimbalButton(ovGimbalRight, GIMBAL_STEP, 0);
    ovGimbalCenter.addEventListener("click", () => centerGimbal());
  }

  function adjustThrottle(delta) {
    state.throttle = clamp(state.throttle + delta, -100, 100);
    throttleInput.value = String(state.throttle);
    updateLabels();
    sendOnce();
  }

  function adjustSteer(delta) {
    state.steer = clamp(state.steer + delta, -100, 100);
    steerInput.value = String(state.steer);
    updateLabels();
    sendOnce();
  }

  if (btnForward && btnBackward && btnLeft && btnRight && btnStop) {
    const bindDirectionButton = (el, dir) => {
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (dir === "STOP") {
          stopDrive();
        } else {
          applyDirection(dir);
        }
      });

      const endHandler = (e) => {
        e.preventDefault();
        if (dir !== "STOP") {
          stopDrive();
        }
      };

      el.addEventListener("pointerup", endHandler);
      el.addEventListener("pointercancel", endHandler);
      el.addEventListener("pointerleave", endHandler);
    };

    bindDirectionButton(btnForward, "F");
    bindDirectionButton(btnBackward, "B");
    bindDirectionButton(btnLeft, "SL");
    bindDirectionButton(btnRight, "SR");
    bindDirectionButton(btnDriveNW, "FL");
    bindDirectionButton(btnDriveNE, "FR");
    bindDirectionButton(btnDriveSW, "BL");
    bindDirectionButton(btnDriveSE, "BR");
    bindDirectionButton(btnStop, "STOP");

    // 覆盖在视频上的小车控制（仅在横屏低高度时可见），支持 8 个方向
    if (ovDriveForward) bindDirectionButton(ovDriveForward, "F");
    if (ovDriveBackward) bindDirectionButton(ovDriveBackward, "B");
    if (ovDriveLeft) bindDirectionButton(ovDriveLeft, "SL");
    if (ovDriveRight) bindDirectionButton(ovDriveRight, "SR");
    if (ovDriveStop) bindDirectionButton(ovDriveStop, "STOP");
    if (ovDriveNW) bindDirectionButton(ovDriveNW, "FL");
    if (ovDriveNE) bindDirectionButton(ovDriveNE, "FR");
    if (ovDriveSW) bindDirectionButton(ovDriveSW, "BL");
    if (ovDriveSE) bindDirectionButton(ovDriveSE, "BR");
  }

  let gimbalKeyTimer = null;
  let gimbalKeyCode = null;

  function startGimbalKeyRepeat(code) {
    if (gimbalKeyTimer && gimbalKeyCode === code) {
      return;
    }
    stopGimbalKeyRepeat();

    const stepOnce = () => {
      switch (code) {
        case "ArrowUp":
          // 云台抬头
          adjustGimbal(0, GIMBAL_STEP);
          break;
        case "ArrowDown":
          // 云台低头
          adjustGimbal(0, -GIMBAL_STEP);
          break;
        case "ArrowLeft":
          // 云台向左
          adjustGimbal(-GIMBAL_STEP, 0);
          break;
        case "ArrowRight":
          // 云台向右
          adjustGimbal(GIMBAL_STEP, 0);
          break;
        default:
          break;
      }
    };

    // 先执行一次，保持原来的“点按一步”的感觉
    stepOnce();
    gimbalKeyCode = code;
    gimbalKeyTimer = setInterval(stepOnce, 80);
  }

  function stopGimbalKeyRepeat(code) {
    if (code && code !== gimbalKeyCode) {
      return;
    }
    if (gimbalKeyTimer) {
      clearInterval(gimbalKeyTimer);
      gimbalKeyTimer = null;
    }
    gimbalKeyCode = null;
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) {
      // 依靠我们自己的定时器实现持续移动，忽略浏览器的 key repeat
      return;
    }

    const target = e.target || document.activeElement;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      // 正在输入文本时，不触发全局快捷键，避免抢占输入
      return;
    }

    const code = e.code || e.key;

    setKeyActive(code, true);

    // 方向键用于云台控制（支持长按）
    if (
      code === "ArrowUp" ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight"
    ) {
      e.preventDefault();
      startGimbalKeyRepeat(code);
      return;
    }

    // 空格：只做云台回中
    if (code === "Space" || e.key === " ") {
      e.preventDefault();
      centerGimbal();
      return;
    }

    // 数字键 1/2/3：直接切换挡位
    if (code === "Digit1" || code === "Digit2" || code === "Digit3") {
      e.preventDefault();
      const idx =
        code === "Digit1" ? 0 : code === "Digit2" ? 1 : 2;
      setSpeedGear(idx);
      return;
    }

    const dir = keyDirectionMap[code] || keyDirectionMap[e.key];
    if (!dir) {
      return;
    }

    e.preventDefault();

    if (dir === "STOP") {
      // S 键：只停车，不动云台
      stopDrive();
    } else {
      applyDirection(dir);
    }
  });

  window.addEventListener("keyup", (e) => {
    const target = e.target || document.activeElement;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      // 文本输入控件内的按键松开也不参与全局快捷键逻辑
      return;
    }

    const code = e.code || e.key;

    setKeyActive(code, false);

    // 方向键用于云台控制，松开时停止持续移动
    if (
      code === "ArrowUp" ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight"
    ) {
      stopGimbalKeyRepeat(code);
      return;
    }

    // 空格、数字、[ ] 不走小车 stop 逻辑
    if (
      code === "Space" ||
      code === "Digit1" ||
      code === "Digit2" ||
      code === "Digit3" ||
      code === "BracketLeft" ||
      code === "BracketRight"
    ) {
      return;
    }

    const dir = keyDirectionMap[code] || keyDirectionMap[e.key];
    if (!dir) {
      return;
    }
    e.preventDefault();
    if (dir !== "STOP") {
      stopDrive();
    }
  });

  if (btnSpeedGear) {
    btnSpeedGear.addEventListener("click", () => {
      setSpeedGear((speedGearIndex + 1) % SPEED_LEVELS.length);
    });
  }

  if (ovSpeedGear) {
    ovSpeedGear.addEventListener("click", () => {
      setSpeedGear((speedGearIndex + 1) % SPEED_LEVELS.length);
    });
  }

  updateSpeedGearLabel();

  // 触屏设备上，禁止在按钮类控件上长按弹出复制/菜单
  if (isTouchDevice()) {
    window.addEventListener("contextmenu", (e) => {
      const target = e.target;
      if (
        target &&
        typeof target.closest === "function" &&
        target.closest("button, .direction-btn, .overlay-btn, .gamepad-btn")
      ) {
        e.preventDefault();
      }
    });
  }

  if (openSetupBtn) {
    openSetupBtn.addEventListener("click", () => {
      try {
        window.location.href = "setup.html";
      } catch (e) {}
    });
  }

  wsBtn.addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      disconnect();
    } else {
      connect();
    }
  });

  function updateVideoRecordTimer() {
    if (!videoRecordStartTime || !videoRecording || !videoRecordTimer) {
      if (videoRecordTimer) {
        videoRecordTimer.classList.remove("visible");
        videoRecordTimer.textContent = "";
      }
      if (videoRecordTimerId) {
        clearInterval(videoRecordTimerId);
        videoRecordTimerId = null;
      }
      return;
    }

    const elapsedSec = Math.floor((Date.now() - videoRecordStartTime) / 1000);
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const ss = String(elapsedSec % 60).padStart(2, "0");

    videoRecordTimer.textContent = `REC ${mm}:${ss}`;
    videoRecordTimer.classList.add("visible");
  }

  async function stopRecordingIfNeeded(options) {
    if (!videoRecording) {
      return;
    }

    if (!options) {
      options = { showError: false };
    }

    const routerBase = getRouterBase();
    if (!routerBase || typeof fetch !== "function") {
      videoRecording = false;
      if (recordBtn) {
        recordBtn.classList.remove("recording");
      }
      return;
    }

    try {
      const resp = await fetch(`${routerBase}/record_stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        if (options && options.showError) {
          alert(`停止录像失败 (${resp.status})`);
        }
        return;
      }
      let data = null;
      try {
        data = await resp.json();
      } catch (e) {}

      if (data && data.ok && data.video && data.thumb) {
        lastMedia.type = "video";
        lastMedia.videoUrl = data.video;
        lastMedia.thumbUrl = data.thumb;

        if (snapshotThumb) {
          snapshotThumb.src = data.thumb;
        }

        setSnapshotUploadStatus("ok", "视频录制完成");
      } else if (options && options.showError) {
        setSnapshotUploadStatus("error", "视频录制结果异常");
      }
    } catch (e) {
      if (options && options.showError) {
        setSnapshotUploadStatus("error", "停止录像时网络异常");
      }
      return;
    } finally {
      videoRecording = false;
      if (recordBtn) {
        recordBtn.classList.remove("recording");
      }
      if (videoBox) {
        videoBox.classList.remove("recording");
      }
      videoRecordStartTime = null;
      if (videoRecordTimer) {
        videoRecordTimer.classList.remove("visible");
        videoRecordTimer.textContent = "";
      }
      if (videoRecordTimerId) {
        clearInterval(videoRecordTimerId);
        videoRecordTimerId = null;
      }
    }
  }

  const stopVideo = async () => {
    await stopRecordingIfNeeded({ showError: false });

    if (!APP_MODE.isProduct) {
      const routerBase = getRouterBase();
      // 优先通知路由器停止拉流
      if (routerBase && typeof fetch === "function") {
        try {
          await fetch(`${routerBase}/stop_stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            mode: "cors",
          }).catch(() => {});
        } catch (e) {}
      }
    }

    videoView.src = VIDEO_PLACEHOLDER;
    videoActive = false;
    videoPaused = false;
    videoLoadBtn.textContent = "加载";
    if (videoPlayOverlay) {
      videoPlayOverlay.classList.remove("hidden");
    }
    if (videoPlayControls) {
      videoPlayControls.classList.remove("visible");
    }
    if (videoPlayToggle) {
      videoPlayToggle.classList.remove("playing");
    }
    resetLightUI();
  };

  const pauseVideo = async () => {
    if (!videoActive || !videoView || !videoUrlInput) {
      return;
    }

    // 停止录像，但保留当前画面
    await stopRecordingIfNeeded({ showError: false });

    // geek 模式下同时通知路由器停止拉流，避免后台继续占用带宽
    if (!APP_MODE.isProduct) {
      const routerBase = getRouterBase();
      if (routerBase && typeof fetch === "function") {
        try {
          await fetch(`${routerBase}/stop_stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            mode: "cors",
          }).catch(() => {});
        } catch (e) {}
      }
    }

    // 基于当前视频地址推导 /capture，获取一帧静止图像用于“冻结”画面
    let frozenSrc = videoView.src;
    const url = videoUrlInput.value.trim();
    if (url) {
      try {
        const u = new URL(url, window.location.href);
        if (u.protocol === "http:" || u.protocol === "https:") {
          const captureUrl = `${u.protocol}//${u.hostname}/capture`;
          frozenSrc = `${captureUrl}?t=${Date.now()}`;
        }
      } catch (e) {}
    }

    videoView.src = frozenSrc;
    videoActive = false;
    videoPaused = true;
    videoLoadBtn.textContent = "加载";
    if (videoPlayToggle) {
      videoPlayToggle.classList.remove("playing");
    }
  };

  const loadVideo = async () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
      await stopVideo();
      return;
    }

    if (APP_MODE.isProduct) {
      const tsUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      videoView.src = tsUrl;
      videoActive = true;
      videoPaused = false;
      videoLoadBtn.textContent = "停止";
      if (videoPlayOverlay) {
        videoPlayOverlay.classList.add("hidden");
      }
      if (videoPlayControls) {
        videoPlayControls.classList.add("visible");
      }
      if (videoPlayToggle) {
        videoPlayToggle.classList.add("playing");
      }
      return;
    }

    const routerBase = getRouterBase();
    if (!routerBase || typeof fetch !== "function") {
      alert("请先填写路由器地址，例如 http://192.168.31.1:8099");
      return;
    }

    try {
      const resp = await fetch(`${routerBase}/start_stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        body: JSON.stringify({ stream_url: url }),
      });
      if (!resp.ok) {
        alert(`无法在路由器上启动视频流 (${resp.status})`);
        await stopVideo();
        return;
      }
    } catch (e) {
      alert("无法连接视频服务，请检查路由器地址和网络");
      await stopVideo();
      return;
    }

    videoView.src = `${routerBase}/router_stream`;
    videoActive = true;
    videoPaused = false;
    videoLoadBtn.textContent = "停止";
    if (videoPlayOverlay) {
      videoPlayOverlay.classList.add("hidden");
    }
    if (videoPlayControls) {
      videoPlayControls.classList.add("visible");
    }
    if (videoPlayToggle) {
      videoPlayToggle.classList.add("playing");
    }
  };

  videoLoadBtn.addEventListener("click", () => {
    if (videoActive && !videoView.src.includes(VIDEO_PLACEHOLDER)) {
      stopVideo();
    } else {
      loadVideo();
    }
  });

  if (videoPlayBtn) {
    videoPlayBtn.addEventListener("click", () => {
      if (!videoActive) {
        loadVideo();
      }
    });
  }

  if (videoPlayToggle) {
    videoPlayToggle.addEventListener("click", () => {
      if (videoActive) {
        pauseVideo();
      } else {
        loadVideo();
      }
    });
  }

  if (snapshotBtn) {
    snapshotBtn.addEventListener("click", () => {
      const url = videoUrlInput.value.trim();
      if (!url) {
        alert("请先填写有效的视频流地址，例如 http://192.168.31.140:81/stream");
        return;
      }

      if (!videoActive) {
        alert("请先加载视频流，再拍照");
        return;
      }

      let captureUrl = null;
      try {
        const u = new URL(url, window.location.href);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          throw new Error("invalid protocol");
        }
        // ESP32-CAM 默认 /capture 在 HTTP 主端口（通常是 80），与 :81/stream 分开
        captureUrl = `${u.protocol}//${u.hostname}/capture`;
      } catch (e) {
        alert("视频流地址格式不正确，请检查，例如 http://192.168.31.140:81/stream");
        return;
      }

      const tsUrl = `${captureUrl}?t=${Date.now()}`;

      if (snapshotThumb) {
        snapshotThumb.src = tsUrl;
      }

      if (APP_MODE.isGeek) {
        triggerSnapshotToRouter();
      }
    });
  }

  if (recordBtn) {
    recordBtn.addEventListener("click", async () => {
      const url = videoUrlInput.value.trim();
      if (!url) {
        alert("请先填写有效的视频流地址，例如 http://192.168.31.140:81/stream");
        return;
      }

      if (!videoActive) {
        alert("请先加载视频流，再开始录像");
        return;
      }

      if (!APP_MODE.isGeek) {
        // 产品模式不提供录像功能
        return;
      }

      const routerBase = getRouterBase();
      if (!routerBase || typeof fetch !== "function") {
        alert("请先填写路由器地址，例如 http://192.168.31.1:8099");
        return;
      }

      if (!videoRecording) {
        // 开始录像
        try {
          const resp = await fetch(`${routerBase}/record_start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            mode: "cors",
            body: JSON.stringify({}),
          });
          if (!resp.ok) {
            alert(`开启录像失败 (${resp.status})`);
            return;
          }
        } catch (e) {
          alert("无法连接视频服务，请检查路由器地址和网络");
          return;
        }

        videoRecording = true;
        recordBtn.classList.add("recording");
        if (videoBox) {
          videoBox.classList.add("recording");
        }
        videoRecordStartTime = Date.now();
        if (videoRecordTimerId) {
          clearInterval(videoRecordTimerId);
        }
        updateVideoRecordTimer();
        videoRecordTimerId = setInterval(updateVideoRecordTimer, 1000);
        setSnapshotUploadStatus("uploading", "视频录制中...");
      } else {
        // 停止录像
        await stopRecordingIfNeeded({ showError: true });
      }
    });
  }

  // 点击当前状态中的缩略图，在当前页面弹出预览（照片或视频）
    if (snapshotThumb && snapshotModal && snapshotModalImg) {
      snapshotThumb.addEventListener("click", () => {
        const src = snapshotThumb.src || "";
        if (!src || src.includes(VIDEO_PLACEHOLDER)) {
          return;
        }

        if (
          lastMedia.type === "video" &&
          videoModal &&
          videoModalPlayer &&
          lastMedia.videoUrl
        ) {
          videoModalPlayer.src = lastMedia.videoUrl;
          try {
            videoModalPlayer.currentTime = 0;
            videoModalPlayer.play().catch(() => {});
          } catch (e) {
          }
          videoModal.classList.add("visible");
          return;
        }

        snapshotModalImg.src = src;
        snapshotModal.classList.add("visible");
      });

      // 点击遮罩空白处关闭预览（点击内容区域不关闭）
      snapshotModal.addEventListener("click", (e) => {
        if (e.target === snapshotModal) {
          snapshotModal.classList.remove("visible");
        }
      });
    }

    // 右上角关闭按钮关闭照片预览
    if (snapshotModal && snapshotModalClose) {
      snapshotModalClose.addEventListener("click", () => {
        snapshotModal.classList.remove("visible");
      });
    }

    if (videoModal && videoModalClose && videoModalPlayer) {
      const closeVideoModal = () => {
        videoModal.classList.remove("visible");
        try {
          videoModalPlayer.pause();
          videoModalPlayer.currentTime = 0;
          videoModalPlayer.removeAttribute("src");
          videoModalPlayer.load();
        } catch (e) {
        }
      };

      // 视频预览遮罩点击关闭
      videoModal.addEventListener("click", (e) => {
        if (e.target === videoModal) {
          closeVideoModal();
        }
      });

      // 视频预览右上角关闭按钮
      videoModalClose.addEventListener("click", (e) => {
        e.stopPropagation();
        closeVideoModal();
      });
    }

    if (camAdvancedModal && camAdvancedBtn) {
      camAdvancedBtn.addEventListener("click", () => {
        if (camAdvancedApplyStatus) {
          setCamAdvancedApplyStatus("idle");
        }
        loadCameraStatus();
        camAdvancedModal.classList.add("visible");
      });

      camAdvancedModal.addEventListener("click", (e) => {
        if (e.target === camAdvancedModal) {
          camAdvancedModal.classList.remove("visible");
          resetOtaControls();
          if (camAdvancedApplyStatus) {
            setCamAdvancedApplyStatus("idle");
          }
        }
      });
    }

    if (camAdvancedModal && camAdvancedClose) {
      camAdvancedClose.addEventListener("click", () => {
        camAdvancedModal.classList.remove("visible");
        resetOtaControls();
        if (camAdvancedApplyStatus) {
          setCamAdvancedApplyStatus("idle");
        }
      });
    }

    // OTA 升级：本地文件升级 & 从路由器一键升级
    if (otaFileInput && otaUploadBtn && otaStatus && videoUrlInput) {
      otaUploadBtn.addEventListener("click", async () => {
        const file = otaFileInput.files && otaFileInput.files[0];
        if (!file) {
          otaStatus.textContent = "请先选择编译生成的 .bin 固件文件。";
          otaStatus.style.color = "#f87171";
          return;
        }

        const url = videoUrlInput.value.trim();
        if (!url) {
          otaStatus.textContent = "请先在顶部填写 ESP32-CAM 的视频流地址（用于推导 IP）。";
          otaStatus.style.color = "#f87171";
          return;
        }

        let otaUrl = null;
        try {
          const u = new URL(url, window.location.href);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            throw new Error("invalid protocol");
          }
          otaUrl = `${u.protocol}//${u.hostname}/ota`;
        } catch (e) {
          otaStatus.textContent = "视频流地址格式不正确，例如 http://192.168.31.140:81/stream。";
          otaStatus.style.color = "#f87171";
          return;
        }

        const ok = window.confirm(
          `确定要将本机固件文件 “${file.name}” 刷写到 ESP32-CAM 吗？\n升级过程中请勿断电/刷新页面。`,
        );
        if (!ok) {
          otaStatus.textContent = "已取消本地文件升级。";
          otaStatus.style.color = "";
          return;
        }

        otaStatus.textContent = "正在上传固件并执行升级，请勿断电/刷新页面...";
        otaStatus.style.color = "#facc15";

        try {
          await fetch(otaUrl, {
            method: "POST",
            body: file,
          });
          otaStatus.textContent =
            "升级请求已发送，设备将自动重启，请稍等片刻后重新连接。";
          otaStatus.style.color = "#34d399";
        } catch (e) {
          otaStatus.textContent = "升级请求发送失败，请检查网络连接。";
          otaStatus.style.color = "#f87171";
        }
      });
    }

    if (otaFetchLatestBtn && otaStatus && videoUrlInput) {
      otaFetchLatestBtn.addEventListener("click", async () => {
        const url = videoUrlInput.value.trim();
        if (!url) {
          otaStatus.textContent =
            "请先在顶部填写 ESP32-CAM 的视频流地址（用于推导 IP）。";
          otaStatus.style.color = "#f87171";
          return;
        }

        let otaUrl = null;
        try {
          const u = new URL(url, window.location.href);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            throw new Error("invalid protocol");
          }
          otaUrl = `${u.protocol}//${u.hostname}/ota`;
        } catch (e) {
          otaStatus.textContent =
            "视频流地址格式不正确，例如 http://192.168.31.140:81/stream。";
          otaStatus.style.color = "#f87171";
          return;
        }

        const routerBase = getRouterBase();

        let fwType = "geek";
        if (otaFwTypeSelect && otaFwTypeSelect.value === "product") {
          fwType = "product";
        }

        let firmwareUrl = null;
        if (fwType === "product") {
          firmwareUrl = `${routerBase}/firmware/product/esp32cam-product-latest.bin`;
        } else {
          firmwareUrl = `${routerBase}/firmware/geek/esp32cam-latest.bin`;
        }

        const ok = window.confirm(
          `确定要从 ${firmwareUrl} 获取最新${fwType === "product" ? "产品版" : "极客版"}固件并刷写到当前 ESP32-CAM 吗？\n升级过程中请勿断电/刷新页面。`,
        );
        if (!ok) {
          otaStatus.textContent = "已取消从路由器一键升级。";
          otaStatus.style.color = "";
          return;
        }

        otaStatus.textContent = `正在从路由器获取最新${fwType === "product" ? "产品版" : "极客版"}固件...`;
        otaStatus.style.color = "#facc15";

        let fwBlob;
        try {
          const resp = await fetch(firmwareUrl, { cache: "no-store" });
          if (!resp.ok) {
            throw new Error("bad status " + resp.status);
          }
          fwBlob = await resp.blob();
        } catch (e) {
          otaStatus.textContent =
            fwType === "product"
              ? "从路由器获取最新产品版固件失败，请确认 CI 是否已生成 esp32cam-product-latest.bin。"
              : "从路由器获取最新极客版固件失败，请确认 CI 是否已生成 esp32cam-latest.bin。";
          otaStatus.style.color = "#f87171";
          return;
        }

        otaStatus.textContent =
          "已获取最新固件，正在通过 WiFi 推送到 ESP32-CAM...";
        otaStatus.style.color = "#facc15";

        try {
          await fetch(otaUrl, {
            method: "POST",
            body: fwBlob,
          });
          otaStatus.textContent =
            "升级请求已发送，设备将自动重启，请稍等片刻后重新连接。";
          otaStatus.style.color = "#34d399";
        } catch (e) {
          otaStatus.textContent =
            "从路由器推送固件到 ESP32-CAM 失败，请检查网络连接。";
          otaStatus.style.color = "#f87171";
        }
      });
    }

    if (otaOpenRepoBtn) {
      otaOpenRepoBtn.addEventListener("click", () => {
        const routerBase = getRouterBase();
        window.open(`${routerBase}/firmware/`, "_blank");
      });
    }

    // 开灯按钮：通过 /control?var=led_intensity 切换补光灯
    if (lightBtn) {
      lightBtn.addEventListener("click", () => {
        const url = videoUrlInput.value.trim();
        if (!url) {
          alert("请先填写有效的视频流地址，例如 http://192.168.31.140:81/stream");
          return;
        }

        if (!videoActive) {
          alert("请先加载视频流，再开灯");
          return;
        }

        let controlUrl = null;
        try {
          const u = new URL(url, window.location.href);
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            throw new Error("invalid protocol");
          }
          const val = lightOn ? 0 : lightLevel;
          // /control 运行在 HTTP 主端口（通常 80）
          controlUrl = `${u.protocol}//${u.hostname}/control?var=led_intensity&val=${val}`;
        } catch (e) {
          alert("视频流地址格式不正确，请检查，例如 http://192.168.31.140:81/stream");
          return;
        }

        // 只需触发请求，不关心响应内容
        try {
          fetch(controlUrl, { mode: "no-cors" }).catch(() => {});
        } catch (e) {
          // 忽略浏览器环境中 fetch 不可用等异常
        }

        lightOn = !lightOn;
        if (lightOn) {
          lightBtn.classList.add("active");
          if (videoLightSlider) {
            videoLightSlider.classList.add("visible");
          }
          if (videoLightLevelInput) {
            videoLightLevelInput.value = String(lightLevel);
          }
        } else {
          lightBtn.classList.remove("active");
          if (videoLightSlider) {
            videoLightSlider.classList.remove("visible");
          }
        }
      });
    }

  // 页面加载与横竖屏切换时，自动把横屏小高度场景下的视频滚动到合适位置，并调整补光灯亮度条长度
  window.addEventListener("load", () => {
    scrollVideoIntoViewIfLandscape();
    updateLightSliderSize();
    loadAppVersion();
    if (camAdvancedApplyStatus) {
      setCamAdvancedApplyStatus("idle");
    }
    loadCameraStatus();
    if (APP_MODE.isGeek) {
      startSnapshotHealthPolling();
      startVideoHealthPolling();
    }
    startBatteryPolling();

    if (APP_MODE.isProduct) {
      applyDefaultPresetForProduct();
      maybeShowWifiSetupHintOnAp();
    }
  });
  window.addEventListener("orientationchange", () => {
    scrollVideoIntoViewIfLandscape();
    updateLightSliderSize();
  });
  window.addEventListener("resize", () => {
    scrollVideoIntoViewIfLandscape();
    updateLightSliderSize();
  });

  if (camAdvancedApplyBtn) {
    camAdvancedApplyBtn.addEventListener("click", () => {
      applyCameraAdvancedSettings();
    });
  }
})();
