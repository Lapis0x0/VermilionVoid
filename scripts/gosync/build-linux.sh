#!/usr/bin/env bash
# 在 macOS/Linux 上生成可在常见 x64 Linux 服务器运行的单文件（无 CGO）。
# Windows 可在 Git Bash / WSL 中执行，或到服务器上直接 go build。
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o dist/gosync-linux-amd64 .
echo "OK: dist/gosync-linux-amd64"
