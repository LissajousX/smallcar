#!/bin/bash

CAMERA_SERVER_DIR="/actions-runner/camera"
CAMERA_APP="${CAMERA_SERVER_DIR}/snapshot_app.py"
CAMERA_LOG_DIR="/var/log/camera"
LOG_FILE="${CAMERA_LOG_DIR}/snapshot_app.log"

if [ ! -f "$CAMERA_APP" ]; then
  echo "snapshot_app.py not found at $CAMERA_APP; skip start."
  exit 0
fi

mkdir -p "${CAMERA_SERVER_DIR}"
mkdir -p "${CAMERA_LOG_DIR}"
touch "${LOG_FILE}"

# 在启动监督循环前，先尝试清理已有的 snapshot_app.py 进程，避免端口占用
PIDS="$(ps -eo pid,cmd | grep "python3 $CAMERA_APP" | grep -v grep | awk '{print $1}')"
if [ -n "$PIDS" ]; then
  echo "Killing existing snapshot_app.py processes before supervisor start: $PIDS" | tee -a "$LOG_FILE"
  kill $PIDS || true
fi

echo "$(date -Is) [INFO] Starting camera snapshot supervisor via snapshot_start.sh..." >> "$LOG_FILE"

while true; do
  echo "$(date -Is) [INFO] Launching snapshot_app.py..." >> "$LOG_FILE"
  python3 "$CAMERA_APP" \
    --host 127.0.0.1 \
    --port 5001 \
    --snapshot-dir "/data/camera/snapshots" \
    --url-prefix "/snapshots" \
    >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
  echo "$(date -Is) [WARN] snapshot_app.py exited with code $EXIT_CODE, restarting in 5 seconds..." >> "$LOG_FILE"
  sleep 5
done
