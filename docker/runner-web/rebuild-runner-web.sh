#!/bin/bash
# Rebuild smallcar-runner-web image, restart container, and clean old dangling images.
# 默认假设仓库路径为 /root/smallcar，可按需修改 REPO_ROOT 和 HOST_PORT。

set -e

IMAGE_NAME="smallcar-runner-web"
CONTAINER_NAME="smallcar-runner-web"
HOST_PORT="8099"   # 对外暴露的端口，前端默认使用 8099，如有不同请自行修改

# 计算仓库根目录（本脚本位于 docker/runner-web/ 下）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

NGINX_CONF_HOST_PATH="${REPO_ROOT}/docker/runner-web/nginx.conf"
NGINX_CONF_CONTAINER_PATH="/etc/nginx/nginx.conf"

echo "[INFO] Repo root: ${REPO_ROOT}"

if [ ! -f "${NGINX_CONF_HOST_PATH}" ]; then
  echo "[ERROR] 未找到 nginx 配置文件: ${NGINX_CONF_HOST_PATH}" >&2
  exit 1
fi

# 停止并删除旧容器（如存在）
if docker ps -a --format '{{.Names}}' | grep -w "${CONTAINER_NAME}" >/dev/null 2>&1; then
  echo "[INFO] Stopping existing container ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}" || true
  echo "[INFO] Removing existing container ${CONTAINER_NAME}..."
  docker rm "${CONTAINER_NAME}" || true
fi

# 构建新镜像
cd "${REPO_ROOT}"
echo "[INFO] Building image ${IMAGE_NAME} from docker/runner-web..."
docker build -t "${IMAGE_NAME}" ./docker/runner-web

# 启动新容器，并把 nginx.conf 以只读方式挂载进容器，方便后续直接改宿主机配置
echo "[INFO] Starting new container ${CONTAINER_NAME} on host port ${HOST_PORT}..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:80" \
  -v "${NGINX_CONF_HOST_PATH}:${NGINX_CONF_CONTAINER_PATH}:ro" \
  "${IMAGE_NAME}"

# 清理旧的悬空镜像（不再被任何容器引用的镜像）
echo "[INFO] Pruning dangling images..."
docker image prune -f

echo "[INFO] Done. Current containers:"
docker ps --filter "name=${CONTAINER_NAME}"
