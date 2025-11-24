#!/bin/bash

# 通用服务管理脚本，目前支持 snapshot 服务
# 用法：
#   servicectl.sh snapshot start|stop|restart|status
#
# 设计原则：
# - 在容器内部以 runner 用户运行（可以通过 su runner -c 调用）
# - 与当前的 snapshot_start.sh 兼容，不改变现有 supervisor 行为

set -euo pipefail

SERVICE_NAME="${1:-}"
ACTION="${2:-}"

if [ -z "$SERVICE_NAME" ] || [ -z "$ACTION" ]; then
  echo "Usage: $0 <service> <start|stop|restart|status>" >&2
  exit 1
fi

case "$SERVICE_NAME" in
  snapshot)
    START_SCRIPT="/actions-runner/extensions.d/snapshot_start.sh"
    APP_PATTERN="snapshot_app.py"
    SUPERVISOR_PATTERN="snapshot_start.sh"
    ;;
  video)
    START_SCRIPT="/actions-runner/extensions.d/video_start.sh"
    APP_PATTERN="video_app.py"
    SUPERVISOR_PATTERN="video_start.sh"
    ;;
  *)
    echo "Unknown service: $SERVICE_NAME" >&2
    exit 1
    ;;
 esac

list_pids() {
  local pattern="$1"
  ps -eo pid,cmd | grep "$pattern" | grep -v grep | awk '{print $1}'
}

service_status() {
  local app_pids supervisor_pids
  app_pids="$(list_pids "$APP_PATTERN")" || true
  supervisor_pids="$(list_pids "$SUPERVISOR_PATTERN")" || true

  if [ -z "$app_pids" ] && [ -z "$supervisor_pids" ]; then
    echo "$SERVICE_NAME: stopped"
  else
    echo "$SERVICE_NAME: running"
    if [ -n "$supervisor_pids" ]; then
      echo "  supervisor PIDs: $supervisor_pids"
    fi
    if [ -n "$app_pids" ]; then
      echo "  app PIDs: $app_pids"
    fi
  fi
}

service_stop() {
  local app_pids supervisor_pids
  app_pids="$(list_pids "$APP_PATTERN")" || true
  supervisor_pids="$(list_pids "$SUPERVISOR_PATTERN")" || true

  if [ -z "$app_pids" ] && [ -z "$supervisor_pids" ]; then
    echo "$SERVICE_NAME: already stopped"
    return 0
  fi

  if [ -n "$app_pids" ]; then
    echo "Stopping $SERVICE_NAME app: $app_pids"
    kill $app_pids || true
  fi

  if [ -n "$supervisor_pids" ]; then
    echo "Stopping $SERVICE_NAME supervisor: $supervisor_pids"
    kill $supervisor_pids || true
  fi

  # 等待一小会儿让进程退出
  sleep 1
}

service_start() {
  if [ ! -x "$START_SCRIPT" ]; then
    echo "Start script not found or not executable: $START_SCRIPT" >&2
    exit 1
  fi

  # 避免重复启动，多启动前先停
  service_stop || true

  echo "Starting $SERVICE_NAME via $START_SCRIPT ..."
  # 在后台启动 supervisor
  "$START_SCRIPT" &
}

case "$ACTION" in
  status)
    service_status
    ;;
  stop)
    service_stop
    ;;
  start)
    service_start
    ;;
  restart)
    service_stop
    service_start
    ;;
  *)
    echo "Unknown action: $ACTION (expected start|stop|restart|status)" >&2
    exit 1
    ;;
 esac
