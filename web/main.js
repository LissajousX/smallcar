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

  const driveJoystick = document.getElementById("drive-joystick");
  const driveStick = document.getElementById("drive-stick");
  const gimbalJoystick = document.getElementById("gimbal-joystick");
  const gimbalStick = document.getElementById("gimbal-stick");

  const lastPayloadView = document.getElementById("last-payload");

  const statusThrottle = document.getElementById("status-throttle");
  const statusSteer = document.getElementById("status-steer");
  const statusYaw = document.getElementById("status-yaw");
  const statusPitch = document.getElementById("status-pitch");

  const ovStatusThrottle = document.getElementById("ov-status-throttle");
  const ovStatusSteer = document.getElementById("ov-status-steer");
  const ovStatusYaw = document.getElementById("ov-status-yaw");
  const ovStatusPitch = document.getElementById("ov-status-pitch");

  let ws = null;
  let sendTimer = null;
  let videoActive = false; // 当前是否在播放流

  const state = {
    throttle: 0,
    steer: 0,
    yaw: 90,
    pitch: 90,
  };

  const VIDEO_PLACEHOLDER = "placeholder-video.svg";

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

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
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

  // 视频预览加载 / 停止 按钮（单键切换）
  if (videoLoadBtn && videoUrlInput && videoView) {
    // 如果加载失败，回退到占位图
    videoView.addEventListener("error", () => {
      if (!videoView.src.includes(VIDEO_PLACEHOLDER)) {
        videoView.src = VIDEO_PLACEHOLDER;
      }
      videoActive = false;
      videoLoadBtn.textContent = "加载";
    });

    const loadVideo = () => {
      const url = videoUrlInput.value.trim();
      if (!url) {
        videoView.src = VIDEO_PLACEHOLDER;
        videoActive = false;
        videoLoadBtn.textContent = "加载";
        return;
      }
      videoView.src = url;
      videoActive = true;
      videoLoadBtn.textContent = "停止";
    };

    videoLoadBtn.addEventListener("click", () => {
      // 当前是流就停止，当前是占位图就加载
      if (videoActive && !videoView.src.includes(VIDEO_PLACEHOLDER)) {
        videoView.src = VIDEO_PLACEHOLDER;
        videoActive = false;
        videoLoadBtn.textContent = "加载";
      } else {
        loadVideo();
      }
    });

    // 视频未加载（占位图）时，点击视频区域等效于点击“加载”按钮
    videoView.addEventListener("click", () => {
      if (!videoView.src || videoView.src.includes(VIDEO_PLACEHOLDER)) {
        loadVideo();
      }
    });
  }

  // 页面加载与横竖屏切换时，自动把横屏小高度场景下的视频滚动到合适位置
  window.addEventListener("load", scrollVideoIntoViewIfLandscape);
  window.addEventListener("orientationchange", scrollVideoIntoViewIfLandscape);
  window.addEventListener("resize", scrollVideoIntoViewIfLandscape);
})();
