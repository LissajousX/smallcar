#!/bin/bash
set -e

# 启动 nginx（后台守护进程）
/usr/sbin/nginx

cd /actions-runner

if [ ! -f ".runner" ]; then
  echo "GitHub Actions runner 尚未配置。"
  echo "请执行以下步骤完成注册："
  echo "  1) docker exec -it <容器名> bash"
  echo "  2) cd /actions-runner"
  echo "  3) ./config.sh --url <repo_url> --token <runner_token>"
  echo "  4) docker restart <容器名>"
  echo "当前容器将保持运行以便你进入配置。"
  tail -f /dev/null
else
  ./run.sh
fi
