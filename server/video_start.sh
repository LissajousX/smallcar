#!/bin/bash

CAMERA_SERVER_DIR="/actions-runner/camera"
VIDEO_APP="${CAMERA_SERVER_DIR}/video_app.py"
CAMERA_LOG_DIR="/var/log/camera"
LOG_FILE="${CAMERA_LOG_DIR}/video_app.log"

if [ ! -f "$VIDEO_APP" ]; then
  echo "video_app.py not found at $VIDEO_APP; skip start."
  exit 0
fi

mkdir -p "${CAMERA_SERVER_DIR}"
mkdir -p "${CAMERA_LOG_DIR}"
touch "${LOG_FILE}"

# 在启动监督循环前，先尝试清理已有的 video_app.py 进程，避免端口占用
PIDS="$(ps -eo pid,cmd | grep "python3 $VIDEO_APP" | grep -v grep | awk '{print $1}')"
if [ -n "$PIDS" ]; then
  echo "Killing existing video_app.py processes before supervisor start: $PIDS" | tee -a "$LOG_FILE"
  kill $PIDS || true
fi

echo "$(date -Is) [INFO] Starting camera video recorder supervisor via video_start.sh..." >> "$LOG_FILE"

while true; do
  echo "$(date -Is) [INFO] Launching video_app.py..." >> "$LOG_FILE"
  python3 "$VIDEO_APP" \
    --host 127.0.0.1 \
    --port 5002 \
    --video-dir "/data/camera/videos" \
    --video-url-prefix "/videos" \
    --snapshot-dir "/data/camera/video_thumbs" \
    --snapshot-url-prefix "/video_thumbs" \
    >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
  echo "$(date -Is) [WARN] video_app.py exited with code $EXIT_CODE, restarting in 5 seconds..." >> "$LOG_FILE"
  sleep 5
done
