#!/usr/bin/env bash
# 在 Linux 服务器上以 systemd 安装 gosync。
#
# 事前准备：
#   1) 仓库完整克隆到服务器某目录（需含 .git，供 git push deploy 使用）
#   2) 在该目录放置 .env（S3、AI、可选 WEBHOOK_SECRET、PORT 等）
#   3) 将二进制放到本机路径，或由本脚本从第三个参数复制
#
# 用法：
#   sudo ./install-server.sh /opt/vermilion-void blog:blog /tmp/gosync-linux-amd64
#
# 参数：
#   $1  仓库根目录（绝对路径）
#   $2  运行用户:组，如 blog:blog 或 www-data:www-data
#   $3  可选：已编译的 gosync 二进制路径；省略则要求 /usr/local/bin/gosync 已存在
#
set -euo pipefail

REPO_ROOT="${1:?第一个参数：仓库根目录，如 /opt/vermilion-void}"
RUN_AS="${2:?第二个参数：用户:组，如 blog:blog}"
SRC_BIN="${3:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行" >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT" ]]; then
  echo "目录不存在: $REPO_ROOT" >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/.env" ]]; then
  echo "缺少 $REPO_ROOT/.env" >&2
  exit 1
fi

DEST_BIN="/usr/local/bin/gosync"
if [[ -n "$SRC_BIN" ]]; then
  if [[ ! -f "$SRC_BIN" ]]; then
    echo "找不到二进制: $SRC_BIN" >&2
    exit 1
  fi
  install -m 0755 "$SRC_BIN" "$DEST_BIN"
else
  if [[ ! -x "$DEST_BIN" ]]; then
    echo "未指定源二进制且 $DEST_BIN 不存在。请先上传二进制或传入第三个参数。" >&2
    exit 1
  fi
fi

if [[ "$RUN_AS" == *:* ]]; then
  USER="${RUN_AS%%:*}"
  GROUP="${RUN_AS#*:}"
else
  USER="$RUN_AS"
  GROUP="$RUN_AS"
fi

chown -R "$USER:$GROUP" "$REPO_ROOT" || true

UNIT="/etc/systemd/system/gosync.service"
cat >"$UNIT" <<EOF
[Unit]
Description=VermilionVoid gosync (S3 sync + AI + git push)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
Group=$GROUP
WorkingDirectory=$REPO_ROOT
EnvironmentFile=-$REPO_ROOT/.env
ExecStart=$DEST_BIN
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

chmod 0644 "$UNIT"
systemctl daemon-reload
systemctl enable gosync.service
systemctl restart gosync.service
echo "已安装并启动 gosync.service"
systemctl status gosync.service --no-pager || true
echo ""
echo "查看日志: journalctl -u gosync -f"
echo "健康检查: curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3001/api/sync -H 'Authorization: Bearer <WEBHOOK_SECRET>'"
