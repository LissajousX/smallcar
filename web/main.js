(function () {
  const wsUrlInput = document.getElementById("ws-url");
  const wsBtn = document.getElementById("ws-connect-btn");
  const wsStatus = document.getElementById("ws-status");

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
  const otaFileInput = document.getElementById("ota-file");
  const otaUploadBtn = document.getElementById("ota-upload-btn");
  const otaFetchLatestBtn = document.getElementById("ota-fetch-latest-btn");
  const otaOpenRepoBtn = document.getElementById("ota-open-repo-btn");
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
  const camAdvancedModal = document.getElementById("cam-advanced-modal");
  const camAdvancedClose = document.getElementById("cam-advanced-close");
  const camAdvancedBtn = document.getElementById("video-advanced-btn");
  const videoLightSlider = document.getElementById("video-light-slider");
  const videoLightLevelInput = document.getElementById("video-light-level");
  const videoPlayOverlay = document.getElementById("video-play-overlay");
  const videoPlayBtn = document.getElementById("video-play-btn");
  const videoPlayControls = document.getElementById("video-play-controls");
  const videoPlayToggle = document.getElementById("video-play-toggle");

  const statusThrottle = document.getElementById("status-throttle");
  const statusSteer = document.getElementById("status-steer");
  const statusYaw = document.getElementById("status-yaw");
  const statusPitch = document.getElementById("status-pitch");
  const statusFwBuild = document.getElementById("status-fw-build");

  const ovStatusThrottle = document.getElementById("ov-status-throttle");
  const ovStatusSteer = document.getElementById("ov-status-steer");
  const ovStatusYaw = document.getElementById("ov-status-yaw");
  const ovStatusPitch = document.getElementById("ov-status-pitch");

  let ws = null;
  let sendTimer = null;
  let videoActive = false; // 当前是否在播放流
  let lightOn = false; // 补光灯当前状态
  let lightLevel = 125; // 补光灯亮度（0-255），默认 125

  const state = {
    throttle: 0,
    steer: 0,
    yaw: 90,
    pitch: 90,
  };

  const VIDEO_PLACEHOLDER = "placeholder-video.svg";
  const DEFAULT_ROUTER_BASE = "http://192.168.31.1:8099";

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
    if (camHmirrorInput) {
      urls.push(`${base}/control?var=hmirror&val=${camHmirrorInput.checked ? 1 : 0}`);
    }
    if (camVflipInput) {
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

    urls.forEach((u) => {
      try {
        fetch(u, { mode: "no-cors" }).catch(() => {});
      } catch (e) {
        // 忽略浏览器环境不支持 fetch 的情况
      }
    });
  }

  function setStatus(text, cls) {
    // 只用彩色圆点显示状态，把文字放在提示中
    wsStatus.textContent = "";
    wsStatus.title = text;
    wsStatus.className = `status ${cls}`;
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

  wsBtn.addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      disconnect();
    } else {
      connect();
    }
  });

  // 初始 UI 状态
  updateLabels();
  updateCameraAdvancedLabels();
  updateCamPresetDesc();

  // 视频预览加载 / 停止 按钮（单键切换）+ 拍照 + 补光灯
  if (videoLoadBtn && videoUrlInput && videoView) {
    const stopVideo = () => {
      videoView.src = VIDEO_PLACEHOLDER;
      videoActive = false;
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
    };

    const loadVideo = () => {
      const url = videoUrlInput.value.trim();
      if (!url) {
        stopVideo();
        return;
      }
      videoView.src = url;
      videoActive = true;
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

    const pauseVideo = () => {
      const url = videoUrlInput.value.trim();
      if (!url) {
        stopVideo();
        return;
      }

      let captureUrl = null;
      try {
        const u = new URL(url, window.location.href);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          throw new Error("invalid protocol");
        }
        captureUrl = `${u.protocol}//${u.hostname}/capture?t=${Date.now()}`;
      } catch (e) {
        stopVideo();
        return;
      }

      videoView.src = captureUrl;
      videoActive = false;
      videoLoadBtn.textContent = "加载";
      if (videoPlayOverlay) {
        videoPlayOverlay.classList.add("hidden");
      }
      if (videoPlayControls) {
        videoPlayControls.classList.add("visible");
      }
      if (videoPlayToggle) {
        videoPlayToggle.classList.remove("playing");
      }
    };

    // 如果加载失败，回退到占位图
    videoView.addEventListener("error", () => {
      stopVideo();
    });

    videoLoadBtn.addEventListener("click", () => {
      // 当前是流就停止，当前是占位图就加载
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

    // 拍照按钮：根据视频流地址推导 ESP32-CAM 的 /capture 地址
    if (snapshotBtn) {
      snapshotBtn.addEventListener("click", () => {
        const url = videoUrlInput.value.trim();
        if (!url) {
          alert("请先填写有效的视频流地址，例如 http://192.168.31.140:81/stream");
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

        // 为避免浏览器缓存，附加时间戳参数
        const tsUrl = `${captureUrl}?t=${Date.now()}`;

        // 仅更新当前状态右侧缩略图预览
        if (snapshotThumb) {
          snapshotThumb.src = tsUrl;
        }
      });
    }

    // 点击当前状态中的缩略图，在当前页面弹出大图预览
    if (snapshotThumb && snapshotModal && snapshotModalImg) {
      snapshotThumb.addEventListener("click", () => {
        const src = snapshotThumb.src || "";
        if (!src || src.includes(VIDEO_PLACEHOLDER)) {
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

    // 右上角关闭按钮关闭预览
    if (snapshotModal && snapshotModalClose) {
      snapshotModalClose.addEventListener("click", () => {
        snapshotModal.classList.remove("visible");
      });
    }

    if (camAdvancedModal && camAdvancedBtn) {
      camAdvancedBtn.addEventListener("click", () => {
        loadCameraStatus();
        camAdvancedModal.classList.add("visible");
      });

      camAdvancedModal.addEventListener("click", (e) => {
        if (e.target === camAdvancedModal) {
          camAdvancedModal.classList.remove("visible");
          resetOtaControls();
        }
      });
    }

    if (camAdvancedModal && camAdvancedClose) {
      camAdvancedClose.addEventListener("click", () => {
        camAdvancedModal.classList.remove("visible");
        resetOtaControls();
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
          // 使用 no-cors，避免从路由器页面跨域访问 ESP32-CAM 时触发 CORS 预检导致 TypeError
          await fetch(otaUrl, {
            method: "POST",
            body: file,
            mode: "no-cors",
          });
          // no-cors 模式下无法读取响应状态/内容，只要不抛异常就认为请求已成功发出
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
        const firmwareUrl = `${routerBase}/firmware/esp32cam-latest.bin`;

        const ok = window.confirm(
          `确定要从 ${firmwareUrl} 获取最新固件并刷写到当前 ESP32-CAM 吗？\n升级过程中请勿断电/刷新页面。`,
        );
        if (!ok) {
          otaStatus.textContent = "已取消从路由器一键升级。";
          otaStatus.style.color = "";
          return;
        }

        otaStatus.textContent = "正在从路由器获取最新固件...";
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
            "从路由器获取最新固件失败，请确认 CI 是否已生成 esp32cam-latest.bin。";
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
            mode: "no-cors",
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
  }

  // 页面加载与横竖屏切换时，自动把横屏小高度场景下的视频滚动到合适位置，并调整补光灯亮度条长度
  window.addEventListener("load", () => {
    scrollVideoIntoViewIfLandscape();
    updateLightSliderSize();
    loadCameraStatus();
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
