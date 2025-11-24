#!/bin/bash
set -e

# 确保存在非 root 用户 runner，用于运行 GitHub Actions Runner
if ! id runner >/dev/null 2>&1; then
  useradd -m runner
fi

# 确保关键目录存在，并将其所有权交给 runner，方便 CI 步骤读写
mkdir -p /usr/share/nginx/html
if [ -d /var/www ]; then
  mkdir -p /var/www/html
fi

chown -R runner:runner /actions-runner
for d in /usr/share/nginx/html /var/www/html; do
  if [ -d "$d" ]; then
    chown -R runner:runner "$d"
  fi
done

# 启动 nginx（后台守护进程）
/usr/sbin/nginx

SNAPSHOT_SERVER_DIR="/actions-runner/snapshot_server"
SNAPSHOT_APP="${SNAPSHOT_SERVER_DIR}/snapshot_app.py"

if [ -f "$SNAPSHOT_APP" ]; then
  su runner -c "python3 $SNAPSHOT_APP --host 127.0.0.1 --port 5001" &
fi

cd /actions-runner

if [ ! -f ".runner" ]; then
  echo "GitHub Actions runner 尚未配置。"
  echo "请执行以下步骤完成注册："
  echo "  1) docker exec -it <容器名> bash"
  echo "  2) su - runner"
  echo "  3) cd /actions-runner"
  echo "  4) ./config.sh --url <repo_url> --token <runner_token>"
  echo "  5) exit 退出后 docker restart <容器名>"
  echo "当前容器将保持运行以便你进入配置。"
  tail -f /dev/null
else
  # 以非 root 用户 runner 运行 GitHub Actions Runner
  exec su runner -c "/actions-runner/run.sh"
fi
