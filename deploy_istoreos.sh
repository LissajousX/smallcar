#!/bin/sh
# 一键在 iStoreOS/OpenWrt 上部署 SmallCar Web
# 使用方式（在路由器上）：
#   1. 将本项目目录（包含 web/ 和本脚本）拷贝到路由器，例如 /root/smallcar
#   2. SSH 登陆路由器后执行：
#        cd /root/smallcar
#        sh deploy_istoreos.sh
#   3. 部署完成后，访问：http://<路由器IP>:8090/
#   4. 如需卸载 smallcar-web 服务和静态文件：
#        sh deploy_istoreos.sh uninstall

set -e

WEB_SRC_DIR="$(cd "$(dirname "$0")/web" && pwd)"
WEB_DST_DIR="/www/smallcar"
INIT_SCRIPT="/etc/init.d/smallcar-web"
HTTP_PORT="8090"

ACTION="${1:-install}"

if [ "$ACTION" = "uninstall" ] || [ "$ACTION" = "remove" ]; then
  echo "[卸载] 停止 smallcar-web 服务并清理文件..."

  if [ -x "$INIT_SCRIPT" ]; then
    /etc/init.d/smallcar-web stop || true
    /etc/init.d/smallcar-web disable || true
    echo "  - 删除 init 脚本 $INIT_SCRIPT"
    rm -f "$INIT_SCRIPT"
  else
    echo "提示：未找到 $INIT_SCRIPT，可能已经卸载过服务。"
  fi

  if [ -d "$WEB_DST_DIR" ]; then
    echo "  - 删除 Web 目录 $WEB_DST_DIR"
    rm -rf "$WEB_DST_DIR"
  else
    echo "提示：未找到 Web 目录 $WEB_DST_DIR。"
  fi

  echo "卸载完成。"
  exit 0
fi

echo "[1/3] 拷贝 SmallCar Web 静态文件到 $WEB_DST_DIR ..."

if [ ! -d "$WEB_SRC_DIR" ]; then
  echo "错误：未找到 web 源目录：$WEB_SRC_DIR" >&2
  exit 1
fi

mkdir -p "$WEB_DST_DIR"
cp -a "$WEB_SRC_DIR"/. "$WEB_DST_DIR"/

echo "[2/3] 创建 smallcar-web 服务脚本（procd 管理，端口 $HTTP_PORT）..."

if [ ! -x "$INIT_SCRIPT" ]; then
  cat >"$INIT_SCRIPT" <<'EOF'
#!/bin/sh /etc/rc.common

START=95
STOP=10

USE_PROCD=1
PROG=/usr/sbin/uhttpd
PORT="8090"
DOCROOT="/www/smallcar"

start_service() {
  procd_open_instance
  procd_set_param command "$PROG" -f -h "$DOCROOT" -p 0.0.0.0:$PORT
  # 进程异常退出时自动重启
  procd_set_param respawn
  procd_close_instance
}
EOF
  chmod +x "$INIT_SCRIPT"
else
  echo "提示：$INIT_SCRIPT 已存在，保留现有脚本，仅更新静态文件。"
fi

echo "[3/3] 启用 smallcar-web 开机自启并重启服务..."

/etc/init.d/smallcar-web enable || true
/etc/init.d/smallcar-web restart || /etc/init.d/smallcar-web start || true

cat <<EOM

部署完成：
  - Web 根目录：$WEB_DST_DIR
  - 服务名：smallcar-web
  - 访问地址：http://<你的 iStoreOS IP>:$HTTP_PORT/

服务管理快捷命令（在路由器上执行）：
  /etc/init.d/smallcar-web start     # 启动服务
  /etc/init.d/smallcar-web stop      # 停止服务
  /etc/init.d/smallcar-web restart   # 重启服务
  /etc/init.d/smallcar-web enable    # 开机自启
  /etc/init.d/smallcar-web disable   # 取消开机自启

说明：
  - 服务由 procd 管理，进程异常退出时会自动拉起（挂死自动重启）。
  - 使用 uhttpd 单独监听 $HTTP_PORT，不影响系统原有管理界面。
EOM
