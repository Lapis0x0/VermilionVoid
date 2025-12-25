---
title: 「Quartz 4 × Obsidian」：一键发布，构筑属于你的数字花园
published: 2025-06-13
description: "本文介绍如何使用 Quartz 4 搭建 Obsidian 数字花园，并通过 GitHub Action 与 Vercel 实现自动化部署与笔记同步。"
image: ""
tags: []
category: 技术教程
draft: false
---
事情是这样的：

虽然我已经拥有一个基于 Astro + Fuwari 搭建的静态博客，用来发布一些逻辑完备、结构完整的长篇述论文章，但在日常学习与阅读过程中，我也会积累许多零散的短文和未成形的想法。这些内容也许不够“正式”，却往往承载着即时的思考与潜在的价值。

可惜的是，它们往往难以在原有博客中找到合适的容身之所，久而久之便淹没在本地笔记堆里。

因为我日常的写作和学习笔记基本都集中在 Obsidian 中进行，久而久之我就萌生了一个念头：有没有什么办法，能让我**不折腾后端，无需花费精力去维护**，就能把这些 Obsidian 笔记选一部分轻松发布到网上？

说白了，我在寻找一个**适合懒狗的数字花园解决方案**：最好是纯前端的，无需服务器支持；能自动处理 Obsidian 的目录结构和双链语法；部署方式足够轻量，能直接托管在 GitHub Pages & Vercel 上；如果还能有点样式自定义的空间，那就更完美了。

这两天，我发现了**Quartz 4** ——一个专为 Obsidian 用户设计的静态Markdown框架。

它几乎精准满足了我对“懒人发布系统”的全部幻想：不需要后端支持，直接部署在 GitHub Pages；原生支持 Obsidian 的链接语法与文件结构；只要把笔记文件丢进特定文件夹、提交到仓库，它就能自动构建一个美观、可导航、可全文搜索的个人知识库网站。

更重要的是，它有完整的开源社区支持、结构清晰、样式也足够现代，甚至连 SEO 和 PWA 兼容都考虑到了，几乎开箱即用。

这篇文章将记录我部署 Quartz 4 的全过程，分享我如何将它**无缝接入现有工作流**，并进行一系列个性化的魔改与优化。希望能为同样在寻找“低维护成本知识发布方案”的朋友提供一些参考。

[效果预览：](https://note.lapis.cafe/)

![效果预览](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202506131523967.png)

# 一、基本部署流程

## 1. 准备工作

- **GitHub 仓库**
    
    你可以直接 fork 官方模板仓库（[`jackyzha0/quartz`](https://github.com/jackyzha0/quartz)），或者选择社区改良版本（例如 [`sosiristseng/template-quartz`](https://github.com/sosiristseng/template-quartz?utm_source=chatgpt.com)），后者已经预配置好 GitHub Pages 与 Actions，更适合快速部署和后期迁移。
    >我直接fork了官方模板仓库，并结合自己的习惯魔改了之前的外刊GitHub Action工作流
    
- **本地环境**
    
    - Node.js ≥ 20（官方推荐使用 22）＋ npm ≥ 10
        
    - Git
        
    
    在终端中运行以下命令确认版本是否满足要求：
    
    ```bash
    node -v && npm -v
    ```
    
    若版本过低，可前往 [Node 官网](https://nodejs.org/)下载安装，或使用 nvm 进行升级。详细参考：[Quartz 官方文档](https://quartz.jzhao.xyz/build?utm_source=chatgpt.com)。
    

---

## 2. 克隆与本地预览

在终端中执行以下命令：

```bash
git clone https://github.com/你的用户名/quartz.git my-site
cd my-site
npm install          # 安装依赖
npx quartz build --serve  # 本地预览
```

首次运行前，建议在 `content` 文件夹中新建一个 `index.md` 文件，作为首页。示例如下：

```markdown
---
title: 时歌的数字花园   # 浏览器标题与页面 H1
description: 记录金融·科技·随想   # 可选；用于 SEO 与摘要
---

# 欢迎 👋

这里会分享我的公开笔记、研究摘录和碎片想法。
```

预览地址默认为 [http://localhost:8080](http://localhost:8080/)，保存 Markdown 或配置文件后页面会自动热重载。

---

## 3. 个性化配置

编辑根目录下的 `quartz.config.ts`（或 `quartz.config.mjs`，取决于模板版本），主要字段如下：

|字段|作用|
|---|---|
|`siteMetadata` → `name`, `description`|网站标题与简介|
|`baseUrl`|设置未来绑定的自定义域名，如 `https://notes.example.com/`|
|`theme` / `plugins`|控制颜色主题、Graph View、全文搜索等插件开关|
|`defaultPublishStatus`|默认发布状态。设为 `'draft'` 可默认不公开，需在 front-matter 中手动控制是否发布|

修改保存后，刷新本地页面即可查看效果。

# 二、个性化与发布到公网
## 1.使用Github Action来同步远程指定文件夹到本地

在我之前的博客 [《通过 GitHub Action 实现自动推送英文外刊到 Obsidian 中》](https://www.lapis.cafe/posts/technicaltutorials/github-action-obsidian/) 中，我介绍过自己的 Obsidian 笔记库是如何通过腾讯云 COS（兼容 S3 协议）进行同步的。换句话说，我的笔记总是以最新状态存在于一个远程对象存储空间中，理论上可以随时被抓取和发布。

这就为构建自动化发布流程提供了一个天然的切入点：**只要能定期从 COS 中拉取我想发布的部分笔记文件，并写入 Quartz 站点的 `content/` 目录中，再通过 GitHub Pages & Vercel自动部署，我就可以实现无感知的远程发布。**

为此，我设计了一个简单的 GitHub Action 工作流：

- **定时拉取**：每 6 小时触发一次（也支持手动），用 `coscli sync` 将 COS 中的 `0.数字花园/` 目录同步到仓库的 `content/`。
    
- **自动提交**：如果检测到文件变化，则履行 `git add → commit → push`，并打上时间戳备注。
    
- **一键部署**：定期触发 GitHub Pages 与 Vercel 工作流，Quartz 自动重建站点，实现无感知发布。

有了这条流水线，我可以继续在本地 Obsidian 随心所欲地写作，不必刻意区分「写作笔记」和「发布笔记」——只凭一个文件夹路径约定与命名规则，GitHub Action 便会替我完成“拉→编→发”的全部脏活累活。

工作流文件：
```yml
name: 同步COS到Obsidian仓库

on:
  # 每 6 小时自动同步一次（UTC 时间）
  schedule:
    - cron: '0 */6 * * *'
  # 允许手动触发
  workflow_dispatch:

jobs:
  sync-from-cos:
    runs-on: ubuntu-latest

    steps:
      # 1️⃣ 拉取代码
      - name: 检出仓库
        uses: actions/checkout@v4
        with:
          fetch-depth: 1     # 只拉取最新提交即可，速度更快

      # 2️⃣ 安装并配置 coscli（官方 CLI，支持 sync）
      - name: 安装并配置 coscli
        uses: git9527/setup-coscli@v2
        with:
          region:      ${{ secrets.COS_REGION }}      # ap-shanghai 等
          secret-id:   ${{ secrets.COS_SECRET_ID }}
          secret-key:  ${{ secrets.COS_SECRET_KEY }}
          bucket:      ${{ secrets.COS_BUCKET }}      # mybucket-1234567890
          coscli-version: 'v0.12.0-beta'             # 指定具体版本号而非 latest

      # 3️⃣ 从 COS 下载到本地 content/（保持完全一致，但保留 .gitkeep）
      - name: 拉取 COS 文件到 content/
        run: |
          # 自定义的重要文件，需要备份和恢复
          mkdir -p /tmp/content_backup
          if [ -f "content/.gitkeep" ]; then
            cp content/.gitkeep /tmp/content_backup/
          fi
          
          # 清空并重新创建 content 目录
          rm -rf content
          mkdir -p content
          
          # 恢复重要文件
          if [ -f "/tmp/content_backup/.gitkeep" ]; then
            cp /tmp/content_backup/.gitkeep content/
          else
            # 如果不存在，创建一个空的 .gitkeep 文件
            touch content/.gitkeep
          fi
          
          # 执行同步，使用递归模式
          coscli sync \
            --thread-num 8 \
            --recursive \
            cos://${{ secrets.COS_BUCKET }}/0.数字花园/ \
            content/ \
            -e cos.${{ secrets.COS_REGION }}.myqcloud.com
            
          # 确保 .gitkeep 在同步后仍然存在
          if [ ! -f "content/.gitkeep" ]; then
            touch content/.gitkeep
          fi
          
          echo "COS 同步完成 ✅"

      # 4️⃣ 若有变动就提交
      - name: Commit & push if changed
        env:
          TZ: Asia/Shanghai
        run: |
          git config user.name  "COS Sync Bot"
          git config user.email "bot@users.noreply.github.com"

          if [[ -n $(git status --porcelain) ]]; then
            git add -A
            git commit -m "chore: sync notes from COS $(date '+%Y-%m-%d %H:%M:%S')"
            git push
            echo "已检测到变动并推送 🚀"
          else
            echo "没有文件变化，跳过提交 ✔"
          fi

```

具体环境变量如何配置，请参见我之前的博客 [《通过 GitHub Action 实现自动推送英文外刊到 Obsidian 中》](https://www.lapis.cafe/posts/technicaltutorials/github-action-obsidian/) 中的` 二、Github设置的 3.配置安全凭证 (GitHub Secrets)：保护你的 S3 访问密钥`。



## 2. 通过 Vercel 部署 Quartz 到公网

虽然 Quartz 官方默认支持 GitHub Pages 部署，但考虑到我个人博客也托管在 Vercel 上，加之其后台管理简洁、构建速度快，我决定将 Quartz 4 的站点也一并部署到 Vercel 上。

不过需要注意的是，Quartz 4（即 Obsidian/Quartz 静态站点生成器）是基于 Python 的框架，**默认会生成形如 `xxx.html` 的文件**，而不是 `xxx/index.html` 的目录结构。这在 Vercel 上会造成一个小问题：**若直接访问不带 `.html` 后缀的路径，会返回 404**。

为了解决这个问题，我们需要在项目根目录下新增一个 `vercel.json` 文件，手动指定重写规则：

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/$1.html" }
  ]
}
```

这样，访问 `/about` 就会被自动重写为 `/about.html`，从而避免 404 错误。

---

### 部署步骤如下：

1. 登录 [Vercel](https://vercel.com/)，点击 **Add New → Project**。
    
2. 选择刚才已经设置好的 Quartz 仓库。
    
3. 在“Build & Output Settings”中填写以下内容：
    

|字段|值|
|---|---|
|**Framework**|Other|
|**Build Command**|`npx quartz build`|

4. 点击 **Deploy**。Vercel 会自动拉取代码、执行构建，并将 `public/` 文件夹作为静态资源目录进行托管。几分钟后，你就能获得一个形如 `xxx.vercel.app` 的访问链接。
    
5. **绑定自定义域名**：  
    进入 Vercel 项目页 → **Settings → Domains**，添加你的域名，并将 DNS 的 CNAME 记录指向 `cname.vercel-dns.com`。同时，别忘了将 `quartz.config.ts` 中的 `baseUrl` 字段改为你的正式域名，并提交更新。
    
6. **设置 Node 版本**（如需）：  
    若 Vercel 默认使用的 Node 版本较低，建议在项目设置 → Environment Variables 中添加一条环境变量：
    
    ```
    NODE_VERSION = 22
    ```
    

---

至此，Quartz 的部署流程就完成了。之后每次 `git push`，Vercel 都会自动触发构建并发布，无需手动干预，真正实现了**一键写作、自动上线**的无感化写作体验。