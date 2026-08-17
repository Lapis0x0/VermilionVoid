# VermilionVoid

时歌的个人博客源码 —— [www.lapis.cafe](https://www.lapis.cafe)

一个基于 Astro 的静态博客。除了常规的文章系统，它还长出了一些偏个人化的部件：碎碎念、读书/论文/漫画书架、学习追踪、加密文章、以及一套自托管的评论系统。

> **Fork 之前请先读[「Fork 须知」](#fork-须知)**，尤其是评论系统那节。有一条配置如果照抄，你的评论会发到我的服务器上。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | [Astro](https://astro.build) 5（`output: "static"` 纯静态） |
| 交互组件 | React 19（islands）+ Radix UI + Tailwind CSS 4 |
| 代码块 | Expressive Code（行号、折叠、语言徽章、自定义复制按钮） |
| 数学公式 | remark-math + KaTeX |
| 站内搜索 | Pagefind（构建时索引） |
| 页面切换 | Swup |
| 部署 | Vercel |
| 评论系统 | 自托管的 Cloudflare Worker（见下） |

包管理器是 **pnpm**。

## 快速开始

```bash
pnpm install
```

```bash
pnpm dev
```

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 本地开发服务器（默认 `http://localhost:4321`） |
| `pnpm build` | 构建到 `dist/`，并跑 Pagefind 建立搜索索引 |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm check` | Astro 的类型与内容校验（本项目没有单元测试框架，这就是唯一的自动检查） |

## 项目结构

```
src/
├── pages/          路由入口（每个文件对应一个 URL）
├── layouts/        页面骨架
├── components/     Astro / React 组件，可复用的原子组件放 components/ui/
├── content/        Markdown 内容集合（见下）
├── data/           站点配置：个人信息、友链
├── styles/         全局 CSS
├── plugins/        自定义 remark / rehype / Expressive Code 插件
├── lib/ hooks/     支撑逻辑
public/             原样拷贝到产物根目录的静态资源，同步生成的 JSON 数据也在这
scripts/            内容同步脚本（飞书、腾讯云 COS、komiic）
cwd-api/            评论系统后端，独立的 Cloudflare Worker 项目
```

`cwd-api/` **不在 pnpm workspace 里**，它有自己的 `package.json` 和 lockfile。在里面装依赖要加 `--ignore-workspace`：

```bash
cd cwd-api && pnpm install --ignore-workspace
```

## 写作

内容集合定义在 `src/content/config.ts`，共四个：

### `posts` —— 正式文章

放在 `src/content/posts/`，支持子目录分类。

```yaml
---
title: 文章标题
published: 2026-08-17
updated: 2026-08-18        # 可选
description: 摘要          # 可选，用于 SEO 和卡片
image: /images/cover.webp  # 可选，封面
tags: [Astro, 前端]
category: TechnicalTutorials
pinned: false              # 置顶
draft: false               # 草稿不会被构建
---
```

**加密文章**：给 frontmatter 加上 `encrypted: true` 和 `password: "你的密码"`，该文章正文会被加密，需输入密码才能阅读。适合半公开的内容。

**免责声明**：`disclaimer` 字段可以引用 `src/data/disclaimers.ts` 里预设的声明文案。

### `thoughts` —— 碎碎念

短内容，只需要 `published`，`title` 可选。由同步脚本从 Obsidian / COS 拉取，一般不手写。

### `studies` —— 学习追踪

```yaml
---
title: 主题
status: 在读               # 在读 | 沉淀中 | 暂搁 | 已结
started: 2026-08
field: 领域                # 可选
subtitle: 副标题           # 可选
epigraph: 题记             # 可选
---
```

### `articles`

早期结构，新内容一律用 `posts`。

## 自定义

想把这个博客改成你自己的，主要改这几处：

| 想改什么 | 改哪里 |
|---|---|
| 站点域名 | `astro.config.mjs` 的 `site` 字段 |
| 昵称、简介、头像、社交链接 | `src/data/profile.ts` |
| 友链列表 | `src/data/friends.json` |
| 导航栏、页脚 | `src/components/` 下对应组件 |
| 配色与全局样式 | `src/styles/` |
| 代码块主题 | `astro.config.mjs` 里 `expressiveCode` 的 `themes` |
| 免责声明模板 | `src/data/disclaimers.ts` |
| 头像、favicon 等静态资源 | `public/` |

代码风格：Astro/TS/TSX 一律 2 空格缩进。组件命名 `PascalCase` 与 `kebab-case` 混用，跟着所在目录的既有风格走即可。项目没有配 formatter，改动尽量贴合周围代码。

## 数据同步

书架、论文、漫画、碎碎念这些不是手写的，走各自的同步链路：

| 内容 | 来源 | 落点 | 触发 |
|---|---|---|---|
| 书 / 论文 | 飞书多维表 | `public/data/books.json`、`papers.json` | GitHub Actions，每周日 |
| 漫画 | komiic → 飞书多维表 | `public/data/comics.json` | 本地脚本推到飞书，再由 CI 生成 JSON |
| 碎碎念 / 学习追踪 | 腾讯云 COS | `src/content/thoughts/`、`studies/` | GitHub Actions，每 12 小时 |

CI 需要的 secrets：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_APP_TOKEN`、`FEISHU_TABLE_ID`（及 `_PAPERS` / `_COMICS` 变体）、`COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`、`COS_PREFIX`、`COS_STUDIES_PREFIX`。

两个已知约束：

- **写飞书多维表必须用 `lark-cli`**（user_access_token）。用 Python + tenant_access_token 会报 91403。读则随意。
- **komiic 同步只能本地跑**，GitHub Actions 的出口 IP 被 Cloudflare 拦。

## 部署

托管在 Vercel，配置见 `vercel.json`（构建命令、安全响应头、静态资源缓存策略）。

需要在 Vercel 项目里配置的环境变量：

| 变量 | 说明 |
|---|---|
| `PUBLIC_CWD_API_BASE_URL` | 评论系统 API 地址。**留空则整个评论区不渲染** |
| `PUBLIC_CWD_CUSTOM_CSS_URL` | 可选，评论组件的自定义样式表 |

本地开发时把这两个写进 `.env`（已 gitignore），参考 `.env.example`。

---

## 评论系统

这是本项目最需要小心的部分，单独展开讲。

### 架构

```
浏览器
  └─ cwd-widget（unpkg 上的第三方前端组件，Shadow DOM 渲染）
       └─ HTTPS
            └─ cwd-api（你自己部署的 Cloudflare Worker）
                 ├─ D1     评论、点赞、访问统计、配置项
                 ├─ KV     登录会话、失败计数
                 └─ SMTP   新评论 / 回复的邮件通知
```

前端只有 `src/components/Comments.astro` 一个文件，负责加载 widget 并把 `PUBLIC_CWD_API_BASE_URL` 传给它。后端在 `cwd-api/`，是一个独立的 Worker 项目。

**关键概念：`post_slug` 就是页面的完整 URL。** widget 用 `window.location.origin + window.location.pathname` 作为评论的归属标识。理解这一点，后面的安全设计才讲得通。

### 部署后端

```bash
cd cwd-api && pnpm install --ignore-workspace
```

1. 复制 `wrangler.jsonc.example` 为 `wrangler.jsonc`
2. 创建 D1 数据库和 KV 命名空间，把 id 填进 `wrangler.jsonc`
3. 用 `schemas/comment.sql` 初始化表结构
4. 配置路由（自定义域名，如 `comments.example.com`）
5. **设置后台登录凭据（见下，这一步有坑）**
6. `npx wrangler deploy`

### ⚠️ 凭据必须用 secret，不能用面板明文变量

后台登录读 `ADMIN_NAME` / `ADMIN_PASSWORD` 两个环境变量。**务必用 `wrangler secret put` 设置**：

```bash
npx wrangler secret put ADMIN_PASSWORD
```

```bash
npx wrangler secret put ADMIN_NAME
```

原因：`wrangler deploy` 会用 `wrangler.jsonc` 覆盖 Worker 的环境变量配置。**在 Cloudflare 面板上手填的明文变量会被部署抹掉，而 secret 不会。** 一旦被抹掉，登录接口就读不到凭据了。

本项目已经加了兜底：`ADMIN_PASSWORD` 未配置时，登录接口直接返回 503 拒绝，而不是回退到默认口令。但你仍然应该用 secret —— 否则每次部署完都得重新配一遍。

另外，明文变量的值会被 `wrangler versions view` 原样打印出来，secret 则只显示名字。

### ⚠️ 必须配置域名白名单

进后台 → 网站设置 → 评论与安全 → **「允许调用的域名」**，填上你的博客域名（带 www 和不带的都填，用逗号分隔）：

```
www.example.com,example.com
```

**为什么这条是必须的**：后端会校验 `post_slug` 的域名在不在白名单里，不在就拒绝写入。留空则不做任何限制 —— 这意味着任何人（包括 fork 了你仓库、在本地 `pnpm dev` 跑起来的人）都能往你的数据库里写评论，并触发发给你的邮件通知。

校验的是 `post_slug` 而不是 `Origin` 请求头，因为前者有业务语义：它决定评论挂在哪个页面。伪造 `Origin` 头轻而易举，伪造 `post_slug` 却只能填你的真实 URL —— 那样评论就变成一条正常显示在你页面上的普通评论，交给审核和黑名单处理即可。

**不要把 `localhost` 或 `127.0.0.1` 加进白名单**，那正是 fork 者跑的地址。代价是你自己本地开发时发不出评论（会收到 403），这是预期行为。

相关代码：`cwd-api/src/utils/allowedOrigin.ts`，挂在 `postComment`、`trackVisit`、`likePage` 三个写接口上。

### 其他安全设置

| 设置 | 位置 | 建议 |
|---|---|---|
| 新评论先审后发 | 后台 → 评论与安全 | 建议开启。白名单挡不住 curl 直接伪造你的真实 URL 灌垃圾评论，这是最后一道防线 |
| IP / 邮箱黑名单 | 后台 → 评论与安全 | 按需 |
| 管理员评论密钥 | 后台 → 评论与安全 | 设置后，用管理员邮箱评论需额外输入密钥，防止有人冒充你 |

### 邮件通知

在后台「邮箱提醒」里配置 SMTP。有新评论时通知站长，有人回复时通知被回复者。

通知邮件里的文章链接**由服务端从已校验的 `post_slug` 推导**，不采信请求体传入的地址 —— 否则伪造请求就能让你收到指向任意站点的链接。

注意 SMTP 密码在 D1 里是明文存储的（必须能还原原文才能登录邮件服务器，无法哈希），而后台的配置导出接口是整表导出。所以**别用你在别处复用的密码**。

### 运维命令

```bash
npx wrangler tail
```

实时看 Worker 日志。`OriginGuard:rejected` 表示有请求被白名单拦下，`OriginGuard:noAllowlistConfigured` 表示白名单是空的（危险）。

```bash
npx wrangler d1 execute cwd-db --remote --command "SELECT COUNT(*) FROM Comment"
```

**`--remote` 不能省。** `wrangler` 的 `d1` 和 `kv` 命令默认操作本地模拟存储，不加这个参数你查到的是一个空库，看起来像"没数据"。

---

## Fork 须知

如果你要基于这个仓库搭自己的博客，**至少改这三处**：

1. **`.env` 里的 `PUBLIC_CWD_API_BASE_URL`** —— 必须指向你自己部署的 cwd-api，或者干脆留空（留空则不渲染评论区）。`.env.example` 里是空值，别去别的地方抄一个线上地址填进来 —— 那会把你的评论写进别人的数据库，并给对方发邮件。
2. **`astro.config.mjs` 的 `site`** —— 改成你自己的域名，否则 sitemap、RSS、canonical 链接全是错的。
3. **`src/data/profile.ts`** —— 昵称、头像、社交链接。

另外 `src/content/` 下是我的文章，`src/data/friends.json` 是我的友链，`public/data/*.json` 是我的书架数据，按需清空。

## 致谢

文章系统的部分设计参考了 [Fuwari](https://github.com/saicaca/fuwari)。评论组件用的是 [CWD](https://cwd.js.org)，后端在其基础上做了改造。

## 许可

代码部分可自由参考取用。`src/content/` 下的文章内容版权归作者所有，转载请注明出处。
