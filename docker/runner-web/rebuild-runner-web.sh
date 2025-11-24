#!/bin/bash
# Rebuild smallcar-runner-web image, restart container, and clean old dangling images.
# 默认假设仓库路径为 /root/smallcar，可按需修改 REPO_ROOT 和 HOST_PORT。

set -e

IMAGE_NAME="smallcar-runner-web"
CONTAINER_NAME="smallcar-runner-web"
HOST_PORT="8099"   # 对外暴露的端口，前端默认使用 8099，如有不同请自行修改

# 持久化挂载目录（放在大容量磁盘 /mnt/sata5-4 上）
HOST_WEBROOT="/mnt/sata5-4/dockerdisk/smallcar/webroot"           # 映射到容器内 /usr/share/nginx/html
HOST_RUNNER_DIR="/mnt/sata5-4/dockerdisk/smallcar/actions-runner" # 映射到容器内 /actions-runner
HOST_NGINX_LOG_DIR="/mnt/sata5-4/dockerdisk/smallcar/log/nginx"  # 映射到容器内 /var/log/nginx，用于持久化访问/错误日志
HOST_CAMERA_LOG_DIR="/mnt/sata5-4/dockerdisk/smallcar/log/camera"  # 映射到容器内 /var/log/camera，用于持久化摄像头相关日志

# 计算仓库根目录（本脚本位于 docker/runner-web/ 下）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 源 nginx.conf（随仓库版本控制）
SOURCE_NGINX_CONF="${REPO_ROOT}/docker/runner-web/nginx.conf"

# 持久化 nginx.conf 和数据的根目录（即便仓库目录被删除，容器仍可使用这些配置和数据）
PERSIST_BASE="/mnt/sata5-4/dockerdisk/smallcar"
HOST_NGINX_CONF_DIR="${PERSIST_BASE}/nginx"
HOST_NGINX_CONF="${HOST_NGINX_CONF_DIR}/nginx.conf"
HOST_DATA_DIR="${PERSIST_BASE}/data"                                # 映射到容器内 /data，用于固件和快照文件
NGINX_CONF_CONTAINER_PATH="/etc/nginx/nginx.conf"

echo "[INFO] Repo root: ${REPO_ROOT}"

if [ ! -f "${SOURCE_NGINX_CONF}" ]; then
  echo "[ERROR] 未找到 nginx 配置文件: ${SOURCE_NGINX_CONF}" >&2
  exit 1
fi

# 确保持久化 nginx 配置目录存在，并将当前仓库中的 nginx.conf 拷贝过去
mkdir -p "${HOST_NGINX_CONF_DIR}"
cp "${SOURCE_NGINX_CONF}" "${HOST_NGINX_CONF}"
echo "[INFO] nginx.conf 已同步到持久化路径: ${HOST_NGINX_CONF}"

# 停止并删除旧容器（如存在）
if docker ps -a --format '{{.Names}}' | grep -w "${CONTAINER_NAME}" >/dev/null 2>&1; then
  echo "[INFO] Stopping existing container ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}" || true
  echo "[INFO] Removing existing container ${CONTAINER_NAME}..."
  docker rm "${CONTAINER_NAME}" || true
fi

# 确保宿主机挂载目录存在
HOST_DIRS="${HOST_WEBROOT} ${HOST_RUNNER_DIR} ${HOST_NGINX_LOG_DIR} ${HOST_CAMERA_LOG_DIR} ${HOST_DATA_DIR}"
for d in $HOST_DIRS; do
  mkdir -p "$d"
done

# 构建新镜像
cd "${REPO_ROOT}"
echo "[INFO] Building image ${IMAGE_NAME} from docker/runner-web..."
docker build -t "${IMAGE_NAME}" ./docker/runner-web

# 启动新容器，并把 nginx.conf 以只读方式挂载进容器，方便后续直接改宿主机配置
echo "[INFO] Starting new container ${CONTAINER_NAME} on host port ${HOST_PORT}..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:8080" \
  -v "${HOST_WEBROOT}:/usr/share/nginx/html" \
  -v "${HOST_RUNNER_DIR}:/actions-runner" \
  -v "${HOST_NGINX_LOG_DIR}:/var/log/nginx" \
  -v "${HOST_CAMERA_LOG_DIR}:/var/log/camera" \
  -v "${HOST_DATA_DIR}:/data" \
  -v "${HOST_NGINX_CONF}:${NGINX_CONF_CONTAINER_PATH}:rw" \
  "${IMAGE_NAME}"

# 清理旧的悬空镜像（不再被任何容器引用的镜像）
echo "[INFO] Pruning dangling images..."
docker image prune -f

echo "[INFO] Done. Current containers:"
docker ps --filter "name=${CONTAINER_NAME}"
