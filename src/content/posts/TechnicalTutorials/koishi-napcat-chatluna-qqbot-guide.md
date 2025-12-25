---
title: 基于Koishi、Chatluna和NapCat：QQ群聊机器人的部署教程
published: 2025-05-17
description: "本文记录了基于Koishi、Chatluna和NapCat三个项目搭建QQ聊天机器人的全过程"
image: ""
tags: []
category: 技术教程
draft: false
---

今天闲来无事，折腾了下QQ机器人。主要是想实现一个能在QQ群里自动回复、调用AI接口、甚至管理群聊内容的工具。根据之前其他群友的先进经验，我决定采用 **Koishi + Chatluna + NapCat** 这套组合部署一个机器人。虽然过程稍微有点折腾，但配置完成后，整体体验还不错。本文就记录一下这次部署的流程、遇到的问题以及一些踩坑经验，希望能帮到也想尝试自建QQ机器人的朋友。

>我自己走通全部流程大概一共花了五十分钟，如果之前没有接触过Koishi的朋友可能会在插件那里绕一会
# 一、从架构开始说起

如果你之前从来没接触过QQ机器人，或者说只接触过官方的bot，那么一定会对 Koishi + Chatluna + NapCat 这三个项目一头雾水。接下来，我会一个项目一个项目的解释：

* **NapCat**：这是最底层的“信使”。由于QQ官方并没有为普通开发者提供稳定且功能全面的机器人API，我们需要一个工具来模拟QQ客户端的行为，接收和发送消息。NapCat 支持onebot协议，它的核心任务是**打通你的服务器与QQ服务器之间的消息通道**，提供一个标准的API接口（比如符合OneBot标准的接口），供上层应用调用。
* **Koishi**：这是整个机器人的“大脑”和“操作系统”。Koishi 是一个功能强大且高度可扩展的机器人框架。在NapCat帮你接通了QQ消息之后，Koishi就负责处理这些消息。它提供了一个统一的平台，让你能够：
	* **接收和发送消息**：通过连接到NapCat等适配器。
    - **指令处理**：定义各种命令，比如 `/天气 北京`。
    - **插件系统**：这是Koishi的精髓所在。你可以通过安装不同的插件来给机器人增加各种功能，比如签到、玩游戏、搜索图片、管理群成员等等。我们后面要说的Chatluna就是以插件的形式集成进Koishi的。
    - **权限管理**：控制谁可以使用哪些命令。
    - **数据存储**：记录用户信息、插件数据等。 Koishi 的设计理念是“开箱即用，高度可定制”，它屏蔽了不同聊天平台（比如QQ、Discord、Telegram等）的差异，让你可以用一套逻辑来开发跨平台的机器人。

>Koishi的部署确实非常方便，Docker命令一行的事，但配置起来还是稍微有点麻烦的


* **Chatluna**：这是赋予机器人“灵魂”的AI模块，通常作为Koishi的一个插件存在。Chatluna 的主要作用是**对接各种大型语言模型（LLM）**，比如 OpenAI 的 GPT 系列、国内的文心一言、通义千问，或者其他开源/闭源的AI模型。通过Chatluna，你的Koishi机器人就能够：
	* 进行智能对话，理解并回应用户的自然语言。
    - 根据你的指令生成文本、写代码、翻译语言等。
    - 结合其他Koishi插件，实现更复杂的AI应用场景。 你可以把它看作是连接Koishi和AI模型之间的“翻译官”和“调度员”。

**所以，整个工作流程大致是这样的：**
1. **用户在QQ群里发送一条消息。**
2. **NapCat 监听到这条消息**，并将其通过OneBot协议标准推送到Koishi。
3. **Koishi 接收到消息**，进行分析。如果这条消息触发了某个指令或需要AI处理：
    - 如果是一般指令（如查询天气），Koishi会调用相应的插件进行处理。
    - 如果需要AI进行对话或内容生成，Koishi会将请求传递给 **Chatluna 插件**。
4. **Chatluna 插件接收到请求后**，会根据配置调用你选定的AI模型（比如Gemini），并将用户的输入发送给AI。
5. **AI模型处理完毕后，返回结果给Chatluna。**
6. **Chatluna 再将AI的回复传递回Koishi。**
7. **Koishi 将最终的回复，通过NapCat发送回QQ群。**
8. **用户在QQ群里看到机器人的回复。**

理解了这个基础架构，我们就能更有条理地进行接下来的安装和配置了。

这套组合的优势在于每一层都相对独立，可以根据需求替换或升级。比如，如果未来出现了更好的QQ协议端，理论上可以替换掉NapCat而无需大规模改动Koishi的配置（只要新的协议端也支持Koishi能理解的适配器标准，如OneBot）。同样，Chatluna也可以灵活配置不同的AI后端。

# 二、部署流程

我是懒狗，所以我只写在vps（建议2c2g以上，最好在环大陆地区）上的部署方法。
## 1.Napcat
### Docker容器配置

首先，在你的 VPS 上新建一个目录用于存放 NapCat 的相关文件。命名随意，我这里用的是 `napcat`：

```bash
mkdir napcat && cd napcat
```

接下来，在该目录下创建一个名为 `docker-compose.yml` 的文件，并写入以下内容：

```yaml
# docker-compose.yml
version: "3"
services:
  napcat:
    environment:
      - NAPCAT_UID=${NAPCAT_UID}
      - NAPCAT_GID=${NAPCAT_GID}
    ports:
      - 3000:3000
      - 3001:3001
      - 6099:6099
    container_name: napcat
    network_mode: bridge
    restart: always
    image: mlikiowa/napcat-docker:latest
```

这段配置的作用是使用 NapCat 官方提供的 Docker 镜像，映射好端口，并确保容器在重启后自动运行。

写好之后，执行以下命令启动容器：

```bash
docker-compose up -d
```

如果网络状况良好，一会儿你就能看到容器启动成功的提示。此时 NapCat 已经在后台运行，等待你通过网页界面进行登录配置。

### NapCat 配置

当容器启动成功后，你应该能在日志中看到类似如下的提示信息：

```
[info] [NapCat] [WebUi] WebUi Local Panel Url: http://127.0.0.1:6099/webui?token=xxxxxxxx
```

这是 NapCat 的本地管理面板地址。**在访问之前，记得开放防火墙的 6099、3000和3001 端口**，并将 `127.0.0.1` 替换为你的 VPS 公网 IP。例如：

```
http://<你的服务器IP>:6099/webui?token=xxxxxxxx
```

在浏览器中打开这个地址，即可进入 NapCat 的 Web 控制台界面。

此外，日志中还会提示你扫码登录的步骤，大致如下：

```
[warn] 请扫描下面的二维码，然后在手Q上授权登录：
[warn] 这里是二维码
二维码解码URL: https://txz.qq.com/p?k=xxxxxxxxxxxxxxxxxxx&f=xxxxxxxxxxxx
[warn] 二维码已保存到 /app/napcat/cache/qrcode.png
```

如果你的控制台不能正常显示二维码，也没关系——你可以复制日志中的 **二维码解码链接（URL）**，粘贴到一个二维码生成网站（如草料二维码），生成图片后扫码即可完成登录。你也可以直接通过 SFTP 等方式访问 `qrcode.png` 所在路径，从本地打开二维码图片进行扫码。

扫码授权成功后，回到 Web 控制台页面，在“基础信息”板块你就能看到你的 QQ 账号信息，说明 NapCat 已成功连接。

![账号信息](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/iShot_2025-05-17_19.39.21.png)

登录成功后回到NapCat控制台，点击左侧的网络配置，再点击左上角的添加配置，新建一个Websocket服务器，格式如下图：

![格式](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202505171941012.png)

其他设置项按图中所示即可，Token建议自行设置一个后妥善保存，后面要用。

## 2.Koishi
### 安装与更新依赖

Koishi 的安装非常简单，只需一条命令即可：

```bash
docker run -p 5140:5140 koishijs/koishi
```

执行完后，打开浏览器，访问 `http://<你的服务器IP>:5140`，即可进入 Koishi 的 Web 控制台。

首次进入时会弹出用户协议，**同意协议后，就可以开始使用这个功能强大、插件生态丰富的机器人框架了。**

> ⚠️ 记得开放防火墙的 **5140 端口**，否则你将无法通过网页访问控制台。

接下来，为了确保系统运行顺畅，你需要更新 Koishi 的所有依赖组件：

1. 在控制台左侧点击「依赖管理」；
2. 然后点击右上角的 **刷新按钮** 和 **更新全部** 按钮；
3. 稍等片刻，待所有依赖安装完成即可。


![更新依赖](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/iShot_2025-05-17_19.44.37.png)

### 将 Koishi 连接到 NapCat

前面我们提到，NapCat 采用了兼容 [OneBot 协议](https://onebot.dev/)，因此在对接 Koishi 时，我们需要使用 Koishi 的 **OneBot 适配器插件**。

在 Koishi 控制台左侧打开「插件市场」，搜索并安装名为 `adapter-onebot` 的插件。安装完成后，系统会自动跳转到插件配置页面，但**此时你可能看不到具体的配置项**。别慌，我们手动来：

1. 回到「插件市场」；    
2. 在「已安装插件」列表中找到 `adapter-onebot`；
3. 点击右侧的「修改」，然后在弹窗中点击「配置」。

你将看到如下配置界面：

![配置](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202505172207532.png)

在这个页面中，我们需要填写以下四个关键字段：

- **selfId**（机器人账号）：填写你在 NapCat 中登录的 QQ 号；
- **token**：填写你在 NapCat 面板中添加网络配置时设置的 Token（注意，不是用于登录控制台的 WebUI Token）；
- **protocol**：选择 `ws`（WebSocket 协议）；
- **endpoint**：填写 NapCat 容器的地址（我直接用外网地址了）加上端口 `3001`，例如：`http://xxx.xxx.xxx.xxx:3001`

> ⚠️ **重点提醒**：此处 **不要填写 `127.0.0.1` 或 `localhost`**，那样只会连接到 Koishi 容器自己，导致连接失败。务必使用 NapCat 容器的实际 IP 地址！

配置填写完成后，点击右上角的「保存配置」并「启用插件」。

如果一切设置正确，此时你可以尝试向机器人的 QQ 号发送 `status`、`help` 等 Koishi 内置命令。如果成功收到回复，说明 Koishi 已顺利与 NapCat 建立连接，基本功能已经就绪！

## 3.配置Chatluna和大模型

此时，我们的机器人已经可以通过 NapCat 接收和发送 QQ 消息，Koishi 这个“大脑”也顺利上线。现在我们需要通过 **Chatluna 插件** 接入大语言模型，让机器人具备对话和理解能力。

Chatluna 的强大之处在于其高度可拓展的架构，支持对接多种主流的大模型服务，包括国内外的 API 接口（如 OpenAI、Claude、Gemini、讯飞、文心一言等），你可以根据自己的需求和预算灵活选择。

安装 Chatluna 插件的流程与前面的 `adapter-onebot` 类似：

1. 打开 Koishi 控制台左侧导航栏，点击「插件市场」；
2. 在搜索框中输入 `chatluna`，回车；
3. 安装 **Chatluna 本体插件（`chatluna`）**；
4. 根据你想使用的大模型平台，选择对应的 **适配器插件**（例如：`chatluna-google-gemini-adapter`）。

如下图，我选择的是 Google 的 Gemini，所以除了安装 Chatluna 本体外，还额外安装了 Gemini 的适配器插件：

![截图](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202505172153492.png)

安装完成后，分别进入这两个插件的配置界面，填写你的 API 密钥、选择或自定义你喜欢的人设（人格设定）、回复风格、上下文长度等参数。

配置完成后记得点击保存。此时，你就可以在 QQ 中与机器人自由对话，享受类 ChatGPT 的智能聊天体验啦！