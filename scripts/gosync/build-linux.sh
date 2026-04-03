#!/usr/bin/env bash
# 在 macOS/Linux 上生成可在常见 x64 Linux 服务器运行的单文件（无 CGO）。
# Windows 可在 Git Bash / WSL 中执行，或到服务器上直接 go build。
#
# 国内机房：避免自动下载 go1.24+ 工具链（常因网络超时失败），改用系统自带的 go。
# go.mod 已设为 go 1.21，与 apt 的 golang-go 1.21 一致即可编译。
# 勿把「终端提示符 root@...#」整行粘贴进 shell，只粘贴 export 与命令本身。
set -euo pipefail
cd "$(dirname "$0")"

export GOTOOLCHAIN=local

if [[ -z "${GOPROXY:-}" ]]; then
	export GOPROXY=https://goproxy.cn,direct
fi
if [[ -z "${GOSUMDB:-}" ]]; then
	export GOSUMDB=sum.golang.google.cn
fi

mkdir -p dist
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o dist/gosync-linux-amd64 .
echo "OK: dist/gosync-linux-amd64"
