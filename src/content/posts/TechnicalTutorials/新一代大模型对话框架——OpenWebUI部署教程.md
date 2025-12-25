---
title: 新一代大模型对话框架——OpenWebUI部署教程
published: 2024-08-28
description: "前言 在之前的博客里，我曾对当时最为流行的两个 AI 对话网页项目 ——ChatGPT-Next-web 与 Lobechat 进行了总结。诚然，这两个项目在部署方面极为便捷（能够一键通过 Vercel 启动或借助 Docker 进行部署），无需担忧托管问题，且社区教程文档丰富详实。市面上还有诸如"
image: ""
tags: []
category: 技术教程
draft: false
---

# 前言

在之前的博客里，我曾对当时最为流行的两个 AI 对话网页项目 ——ChatGPT-Next-web 与 Lobechat 进行了总结。诚然，这两个项目在部署方面极为便捷（能够一键通过 Vercel 启动或借助 Docker 进行部署），无需担忧托管问题，且社区教程文档丰富详实。市面上还有诸如 Chatbox 这般成熟的闭源 AI 对话工具……但终究各有各的缺点：

Next-web 和 Lobechat 终究只是纯前端工具，Nextweb 简洁美观，却在自定义程度上有所欠缺，功能也相对简单；Lobechat 则显得过于臃肿，卡顿现象频发，并且官方近来在商业化进程方面较为激进，还删去了 WebRTC 的同步功能。Chatbox 虽强大，但也存在各种小问题，其同步方式也较为原始。

那么，有没有一款全平台支持，页面好看美观，自定义程度高，社区支持完善的AI对话开源项目呢？

答案是肯定的，它就是我们的——[OpenWebUI](https://github.com/open-webui/open-webui)！

![https://github.com/open-webui/open-webui/blob/main/demo.gif?raw=true](https://github.com/open-webui/open-webui/blob/main/demo.gif?raw=true)

伟大，无需多言。

优点：

* 全平台支持（web也是全平台，同步也方便）
* 页面仿ChatGPT原版设计，好看简洁美观
* 自定义程度高（自定义模型、Tool、Function）
* 社区完善，支持各类插件提示词一键导入

缺点：

* 最大的缺点就是部署在本地对于vps的性能和空间的要求相对较高，剩余内存>2G，硬盘空间>10G
* 似乎不能编辑对话记录

# 部署教程

## 1.准备工作

* 一台安装了Docker Compose的VPS
* 推荐安装1Panel或者宝塔面板，方便编辑Docker Compose文件和设置反代

## 2.开始

* 使用SSH连接到服务器
* 创建一个文件夹，用于存放docker compose文件

```jsx
mkdir openwebui
cd openwebui
# 创建docker-compose.yml文件
touch docker-compose.yml
```

实际上这些动作直接用1panel等面板也都是一样的，总之创建一个文件夹然后创建docker-compose.yml并编辑即可。

## 3.配置docker-compose.yml（完全版）

这是官方的完整版镜像，包含预绑定模型：

* docker-compose.yml的文件内容如下：

```jsx
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:${WEBUI_DOCKER_TAG-main}
    container_name: open-webui
    volumes:
      - ./data:/app/backend/data
    ports:
      - 8080:8080
    environment:
      - 'WEBUI_SECRET_KEY=123456789'
      # openai 配置
      - 'OPENAI_API_BASE_URL=https://api.openai.com/v1'
      - 'OPENAI_API_KEY=sk-xxxx'
      # 启用openai画图
      - 'ENABLE_IMAGE_GENERATION=true'
      - 'IMAGE_GENERATION_ENGINE=openai'
      # 开启注册登录功能
      - 'WEBUI_AUTH=true'
      - 'ENABLE_SIGNUP=true'
      - 'DEFAULT_USER_ROLE=pending' # 由于我自己没有分享需求，所以注册用户直接选择pending，需要管理员手动激活
      # 模型白名单
      - 'ENABLE_MODEL_FILTER=true'
      - 'MODEL_FILTER_LIST=gpt-3.5-turbo;gpt-4o'
      - 'WEBUI_NAME=OiChat'
      # 默认模型
      - 'DEFAULT_MODELS=gpt-4o' 
    restart: unless-stopped
```

## 4.配置docker-compose.yml（精简版）

在2025年，官方文档已提供 **slim 镜像** 标签（main-slim），该版本移除了预绑定模型，首次使用相关功能时才会按需下载或走外部服务，更适合低带宽/小盘 VPS。

* docker-compose.yml的文件内容如下：

```jsx
version: "3.9"

services:
  openwebui:
    image: ghcr.io/open-webui/open-webui:main-slim
    container_name: openwebui
    ports:
      - "3000:8080"               # 外部访问 http://<服务器IP或域名>:3000
    volumes:
      - open-webui:/app/backend/data  # 持久化应用数据（用户、会话、设置等）
    environment:
      # —— 关键：将 RAG 嵌入引擎改为 OpenAI/兼容，从而不使用本地 embedding ——
      RAG_EMBEDDING_ENGINE: "openai"
      OPENAI_API_BASE_URL: "https://api.openai.com/v1"   # 兼容服务改成其 /v1
      OPENAI_API_KEY: "${OPENAI_API_KEY}"

      # （可选）若你仅自用，且首次启动就想关闭登录认证：
      # WEBUI_AUTH: "False"       # 建议公网部署保持默认（开启登录）

      # （可选）指定公网访问地址（分享链接、回调等场景更准确）
      # WEBUI_URL: "https://your.domain.com"

      # （可选）首次启动时若想在“设置”里更容易改参数，可暂时关闭持久化配置
      # ENABLE_PERSISTENT_CONFIG: "False"

    restart: always

    # （可选）若你的 VPS 有 NVIDIA GPU，并希望运行带 CUDA 的镜像：
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - capabilities: ["gpu"]
    #           driver: "nvidia"
    # image: ghcr.io/open-webui/open-webui:cuda

volumes:
  open-webui:

# ==================== 可选方案：Ollama 作为外部 embedding ====================
# 若你打算改用 Ollama 做向量化（同机或远端），将上面 environment 改成下列两行：
#
#   RAG_EMBEDDING_ENGINE: "ollama"
#   OLLAMA_BASE_URL: "http://<你的-ollama-主机>:11434"
#
# 注：此时无需 OPENAI_API_KEY；确保 Ollama 里已拉取相应的 embedding 模型（如 nomic-embed-text）。

```

* 文件修改完保存即可，然后启动服务 (确保在 docker-compose.yml 所在目录下执行)：

```jsx
docker-compose up -d
```

之后服务器会自动拉取镜像并启动docker服务，镜像比较大（2个g左右，小水管会比较痛苦），等服务启动后就可以访问了

* 访问 Open-WebUI 服务，地址为：[http://你的服务器IP:8080](http://yourip:8080)

## 3.反向代理

1p直接新建网站-反向代理-代理 [http://127.0.0.1:8080](http://127.0.0.1:8080),然后绑定一下域名证书开启SSL即可（不开也行），宝塔也差不多一个路子。

## 4.后续更新

```jsx
# 进入之前创建的文件夹
cd openwebui

# 拉取最新镜像
docker-compose pull

# 重启
docker compose up -d
```
