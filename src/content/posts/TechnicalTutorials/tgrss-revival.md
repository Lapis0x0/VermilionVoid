---
title: 当信息流开始遵循我的语法：TG RSS BOT 搭建教程与开源项目推荐
published: 2025-02-03
description: "本文探讨了信息过载时代的困境，介绍了如何通过Telegram Bot和RSS技术实现信息自动化推送，推荐了多个开源RSS工具，帮助用户重拾信息自主权。"
image: ""
tags: []
category: 技术教程
draft: false
---

「滴——」

手机在晨光中震动，锁屏界面已被信息洪流冲垮：GitHub trending推送了新的AI工具、订阅的Newsletter准时抵达邮箱、关注的Podcaster突然日更三集……你滑动着永无止境的未读红点，突然意识到自己像被困在**API接口里的数据包**——被调度、被解析、却从未真正抵达「已处理」状态。

在这个**信息过载纪元**，我们正经历着两种极端的撕裂：一边是算法用精准的「猜你喜欢」编织数据茧房，一边是散落在43个平台的知识碎片让人患上数字仓鼠症。当Ctrl+S已成为肌肉记忆，1999年诞生的RSS协议却像一位沉默的守夜人，握着锈迹斑斑的钥匙，静候我们重启去中心化的信息管道。

本篇博客就希望借助 **Telegram Bot**，实现RSS信源自动推送，稍稍缓解我们的信息依赖症，将重要信息归集起来集中处理。

# 一、项目搭建流程

**项目地址**

::github{repo="Rongronggg9/RSS-to-Telegram-Bot"}

## 1.在Telegram中新建Bot并获取相关信息

- 在tg中搜索 [`@BotFather`](https://t.me/BotFather)，聊天框发送 `/newbot`，按提示输入机器人名称/机器人用户名。

![image.png](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202502030359567.png)

记录下生成的HTTP API，后面需要用。

- 在tg中搜索`@userinfobot`,点击`start`,记录返回的用户id

![image.png](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202502030400968.png)

- 获取 [Telegraph API](https://telegra.ph/api#createAccount) 获取 access token

https://api.telegra.ph/createAccount?short_name=RSSBot&author_name=Myself&author_url=https://github.com/Rongronggg9/RSS-to-Telegram-Bot

## 2.搭建bot

在 vps 根目录下新建文件夹 `mkdir tgrss` ，并进入文件夹`cd tgrss` ，新建docker compose文件 `nano docker-compose.yml`。

在打开的编辑器中，添加 Docker Compose 配置：

```python
version: '3.9'

services:
  rssbot:
    image: rongronggg9/rss-to-telegram:dev
    container_name: rss-bot
    restart: unless-stopped
    volumes:
      - ./config:/app/config
    environment:
      - TZ=Asia/Shanghai
      - TOKEN=  # 使用 @BotFather 返回的 API Token
      - MANAGER=  # 使用从 @userinfobot 获得的用户id
      - TELEGRAPH_TOKEN= # 使用请求 telegraph API 返回的 Token
```

最后`docker-compose up -d` 启动即可。

回到tg，向我们刚创建的bot发送/start就可以开始使用了。

# 二、开源项目推荐

## 1.Rsshub

::github{repo="DIYgod/RSSHub"}

**“万物皆可 RSS”** 是 RSSHub 的口号，也是它的灵魂。这个由国内开发者维护的开源项目，像一把万能钥匙，能解锁互联网上几乎所有平台的订阅可能——从微博热搜到 B 站 UP 主更新，从 GitHub 仓库动态到豆瓣小组新帖，甚至是淘宝商品降价提醒、机场航班延误播报……**只要你能想到的内容，几乎都能通过 RSSHub 转化为标准的 RSS 订阅源**。

### 为什么选择 RSSHub？

- **破除平台封锁**：许多平台（比如某红书、某音）不提供原生 RSS 支持，RSSHub 通过解析网页或调用 API 强行“投喂”内容；
- **规则丰富灵活**：社区贡献了 1000+ 条路由规则（[官方文档](https://docs.rsshub.app/)堪称 RSS 版“百科全书”），且支持自定义规则；
- **部署自由度高**：你可以直接使用官方公共实例（需注意频率限制），也可自建服务实现“订阅自由”；
- **无缝对接 Bot**：生成的 RSS 链接可直接填入 Telegram Bot，实现“订阅-解析-推送”全链路自动化。

## 2.Follow

::github{repo="RSSNext/Follow"}

新一代高颜值RSS阅读器（我目前正在用的主力阅读器），但目前尚处测试阶段，性能方面似乎存在一定问题

## 3.FreshRSS

::github{repo="FreshRSS/FreshRSS"}

**自建RSS生态的基石**。这款基于PHP/MySQL的阅读器支持Docker一键部署，具有以下核心优势：

- **多协议支持**：除常规RSS外，还能解析JSON Feed、YouTube频道等特殊格式
- **智能过滤**：通过CSS选择器自定义内容清洗规则，过滤广告/干扰元素
- **浏览器插件**：配套的[WebSub](https://github.com/FreshRSS/WebSub)扩展实现"一键订阅"
- **多用户体系**：适合团队共享订阅源，支持OPML批量导入导出

## 4.Miniflux

::github{repo="miniflux/v2"}

**极简主义者的福音**。采用Go语言编写的轻量级阅读器（内存占用<20MB），特别适合：

- **开发者**：提供RESTful API，可与Huginn/Automate等自动化工具联动
- **隐私控**：默认关闭图片代理，支持基于规则的文章永久存档
- **键盘党**：全快捷键操作（按`?`唤出快捷键列表）
- **PWA应用**：支持离线阅读，安卓/iOS均可添加至主屏幕

```
<BASH>

# 典型Docker部署命令docker run -d --name miniflux -p 8080:8080 \  -e DATABASE_URL="postgres://user:password@host/dbname?sslmode=disable" \  miniflux/miniflux:latest

```

# 三、结论

RSS技术栈的复兴绝非偶然——在算法推荐肆虐的今天，这套始于1999年的协议仍然是最优雅的**信息自主权解决方案**。借助RSS，我们既能享受算法带来的效率红利，又能避免陷入"信息茧房"的陷阱。建议从RSSHub+Follow的轻量级组合开始，逐步构建自己的数字巴别塔。当你的订阅源开始流淌经过精心筛选的知识时，或许会突然理解《黑客帝国》中墨菲斯那句台词的含义：

> *"You take the blue pill... the story ends. You take the red pill... you stay in Wonderland."*
>