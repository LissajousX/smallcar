#!/bin/bash
set -e

SNAPSHOT_SERVER_DIR="/actions-runner/snapshot_server"
SNAPSHOT_APP="${SNAPSHOT_SERVER_DIR}/snapshot_app.py"
SNAPSHOT_LOG_DIR="/var/log/snapshot"
LOG_FILE="${SNAPSHOT_LOG_DIR}/snapshot_app.log"

if [ ! -f "$SNAPSHOT_APP" ]; then
  echo "snapshot_app.py not found at $SNAPSHOT_APP; skip start."
  exit 0
fi

PIDS="$(ps -eo pid,cmd | grep "python3 $SNAPSHOT_APP" | grep -v grep | awk '{print $1}')"
if [ -n "$PIDS" ]; then
  echo "Killing existing snapshot_app.py processes: $PIDS"
  kill $PIDS || true
fi

mkdir -p "${SNAPSHOT_SERVER_DIR}"

mkdir -p "${SNAPSHOT_LOG_DIR}"
touch "${LOG_FILE}"

echo "Starting snapshot_app.py via snapshot_start.sh..."
nohup python3 "$SNAPSHOT_APP" \
  --host 127.0.0.1 \
  --port 5001 \
  --snapshot-dir "/data/snapshots" \
  --url-prefix "/snapshots" \
  >> "$LOG_FILE" 2>&1 &
