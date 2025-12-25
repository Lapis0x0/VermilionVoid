---
title: 仓鼠速递：远程VPS+TG Bot实现离线下载并上传至OneDrive
published: 2025-04-30
description: "本文介绍了一个基于远程 VPS 和 Telegram Bot 实现的自动化下载上传系统——“仓鼠快递”。作者在魔改开源项目 aria2bot 的基础上，集成了 Aria2 和 rclone，实现了从 TG 接收链接、离线下载到自动上传 OneDrive 的完整流程。项目已封装为可即开即用的 Docker 镜像，适合有轻量级文件中转需求的技术用户部署使用。"
image: ""
tags: []
category: 技术教程
draft: false
---
事情是这样的，我有一个基于[onedrive-cf-index-ng](https://github.com/lyc8503/onedrive-cf-index-ng)又自己魔改的公开[在线网盘](https://data.lapis.cafe)，平时会托管一点公开论文、数据集或者其他鸡零狗碎的资料。

但每次上传文件我都得先在本地下好，再手动传到云端，过程繁琐、耗时，还经常卡在 macOS OneDrive 客户端的莫名其妙错误上，令人怀疑人类是否真的配拥有自动化工具。于是我萌生了个念头：干脆做个自己的 TG Bot，让它在远程 VPS 上帮我完成下载和上传的全流程，彻底摆脱手工操作。

最开始我还打算完全自己从零写一个新 bot，但写着写着就意识到，其实市面上已经有不少功能成熟的开源项目。比起造轮子，魔改一个现成的项目更省心高效。最终我选择了 [jw-star/aria2bot](https://github.com/jw-star/aria2bot) 作为基础，它已经实现了 Telegram 控制 Aria2 离线下载的主流程，但原版仅支持将下载好的文件直接发送回 Telegram，对于我这种需要长期归档上云的场景并不适用。

所以我对它进行了一点小魔改：集成了 [rclone](https://rclone.org/) 作为上传工具，并添加了默认自动上传到 OneDrive 的逻辑。除此之外，原项目还需要用户自行配置 Aria2，我干脆一并打包好了 Aria2 + rclone 的完整环境，重新封装了镜像，做到项目开箱即用——部署后即可在 Telegram 上指令发送链接，远程下载+上传全自动跑完。


项目链接：
::github{repo="jw-star/aria2bot"}
::github{repo="Lapis0x0/MistRelay"}

**具体部署方式也可以选择直接看[项目](https://github.com/Lapis0x0/MistRelay)的README**
# 使用方法
## 1.准备工作：你需要什么

* 最好是国外的+大带宽。确保安装了 Docker 和 Docker Compose。
* - **Telegram 账号**：你需要创建一个 Telegram Bot 并获取它的 Token，再拿到你自己的 Telegram User ID。
    - 找 [@BotFather](https://t.me/BotFather) 发送 `/newbot`创建机器人，获取 **BOT_TOKEN**。
    - 找 [@userinfobot](https://t.me/userinfobot) 获取你的 **ADMIN_ID** (纯数字)。
    - 访问 [https://my.telegram.org/apps](https://my.telegram.org/apps) 创建应用，获取 **API_ID** 和 **API_HASH**。
- - **Rclone 配置文件**：由于 VPS 通常没有桌面环境，直接在上面配置 rclone 连接 OneDrive 会比较麻烦（需要浏览器授权）。最佳实践是：
    - 先在你的**本地电脑**上安装并配置好 rclone，完成 OneDrive 的授权。（用 `rclone config`命令，跟着向导走）
	    - Windows: 下载安装包 https://rclone.org/downloads/
	    - macOS: `brew install rclone`
	    - Linux: `curl https://rclone.org/install.sh | sudo bash`
    - 找到本地生成的 `rclone.conf`文件。（Windows 在 `%USERPROFILE%\.config\rclone\`，macOS/Linux 在 `~/.config/rclone/rclone.conf`
    - **这个文件很重要，等下要上传到 VPS。**

## 2.正式配置项目

下载项目到本地：
```bash

git clone https://github.com/Lapis0x0/MistRelay.git

cd MistRelay

```
重命名 `db/config.example.yml` 为 `config.yml` 并设置参数：
```yaml

API_ID: xxxx # Telegram API ID

API_HASH: xxxxxxxx # Telegram API Hash

BOT_TOKEN: xxxx:xxxxxxxxxxxx # Telegram Bot Token

ADMIN_ID: 管理员ID # 管理员的Telegram ID

FORWARD_ID: 文件转发目标id # 可选，文件转发目标ID

  

# 上传设置

UP_TELEGRAM: false # 是否上传到电报

UP_ONEDRIVE: true # 是否启用rclone上传到OneDrive

  

# rclone配置

RCLONE_REMOTE: onedrive # 你在 rclone config 时给 OneDrive 远程配置起的名字（比如 onedrive）。

RCLONE_PATH: /Downloads # 你想让文件上传到 OneDrive 的哪个路径下（比如 /Downloads 或 /Public/Data）。

  

# aria2c设置（Docker集成后可使用默认值）

RPC_SECRET: xxxxxxx # RPC密钥（建议修改为自定义密钥）

RPC_URL: localhost:6800/jsonrpc # 使用Docker部署时必须使用localhost或127.0.0.1。一般保持默认 localhost:6800/jsonrpc 就好，因为 Aria2 和 Bot 都在一个 Docker 网络里。

  

# 代理设置（可选）

PROXY_IP: # 代理IP，不需要则留空

PROXY_PORT: # 代理端口，不需要则留空

  

# 自动删除本地文件设置

AUTO_DELETE_AFTER_UPLOAD: true # 是否在成功上传到 OneDrive 后自动删除 VPS 上的文件，true 是删除，false 是保留。根据自己需求设置。

```
## 3.启动！Unleash the Hamster!

配置完成后，使用 Docker Compose 一键启动所有服务：
```
docker compose up -d --build
```
第一次启动会因为 `--build` 参数而需要一些时间来构建镜像。之后如果修改了代码或 Dockerfile，也需要加上 `--build` 参数重新构建。

想看看仓鼠在忙什么？可以用下面的命令查看实时日志：
```
docker compose logs -f
```
## 4.开始使唤仓鼠

现在，打开 Telegram，找到你创建的机器人：
- 发送 `/start`，你的机器人应该会回应你。
- 直接把 HTTP/HTTPS 链接、磁力链接（magnet: 开头）或者 .torrent 文件发送给它。
- 仓鼠收到任务后，会开始下载，并在下载完成后自动开始上传到你指定的 OneDrive 路径。整个过程，它都会在 Telegram 里向你汇报进度（下载进度、上传进度、完成/失败信息）。
- 你可以使用 `/help` 查看所有可用命令，比如 `/info` 看系统状态，`/path` 切换下载目录（不影响上传路径），`/web` 获取 AriaNg 的 WebUI 地址（如果你需要更精细地管理下载任务）。

![效果](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202504301529135.png)


## 未来计划

- [ ] 支持重命名文件
- [ ] 更清晰、强大的菜单键
- [ ] 支持通过大模型来自动管理文件列表