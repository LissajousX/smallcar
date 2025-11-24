#!/bin/bash
set -e

CAMERA_SERVER_DIR="/actions-runner/camera"
CAMERA_APP="${CAMERA_SERVER_DIR}/snapshot_app.py"
CAMERA_LOG_DIR="/var/log/camera"
LOG_FILE="${CAMERA_LOG_DIR}/snapshot_app.log"

if [ ! -f "$CAMERA_APP" ]; then
  echo "snapshot_app.py not found at $CAMERA_APP; skip start."
  exit 0
fi

PIDS="$(ps -eo pid,cmd | grep "python3 $CAMERA_APP" | grep -v grep | awk '{print $1}')"
if [ -n "$PIDS" ]; then
  echo "Killing existing snapshot_app.py processes: $PIDS"
  kill $PIDS || true
fi

mkdir -p "${CAMERA_SERVER_DIR}"

mkdir -p "${CAMERA_LOG_DIR}"
touch "${LOG_FILE}"

echo "Starting snapshot_app.py via snapshot_start.sh..."
nohup python3 "$CAMERA_APP" \
  --host 127.0.0.1 \
  --port 5001 \
  --snapshot-dir "/data/camera/snapshots" \
  --url-prefix "/snapshots" \
  >> "$LOG_FILE" 2>&1 &
