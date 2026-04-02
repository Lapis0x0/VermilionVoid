# Astro 博客模板

一个基于 Astro、React 和 Tailwind CSS 构建的现代化、高性能博客模板。由高度定制化的 [VermilionVoid](https://github.com/Lapis0x0/VermilionVoid) 项目抽象而来。

## 核心特性

- 🚀 **基于 Astro**: 极速的静态站点生成体验。
- 🎨 **Tailwind CSS & Radix UI**: 优美、可访问且易于定制的设计系统。
- 📝 **高级 Markdown/MDX**: 支持 GitHub 风格的提示框 (Admonitions)、KaTeX 数学公式渲染以及 Expressive Code 代码块。
- 🌗 **深色模式**: 基于 CSS 变量的无缝深色模式切换。
- 🔍 **全文搜索**: 集成 Pagefind 实现极速的本地静态搜索。
- 📡 **RSS & Sitemap**: 自动生成符合 SEO 标准的订阅源与站点地图。

## 快速上手

### 1. 安装依赖

首先，克隆仓库并安装依赖。建议使用 `pnpm`:

```bash
pnpm install
```

### 2. 个性化配置

更新以下配置文件以个性化你的博客：

- **`astro.config.mjs`**: 将 `site` 属性更新为你的域名。
- **`src/data/profile.ts`**: 更新此文件中的姓名、简介、头像和社交链接。
- **`src/data/friends.json`**: 在此处添加你的友人帐链接。

### 3. 开发环境

启动本地开发服务器：

```bash
pnpm dev
```

访问 `http://localhost:4321` 即可预览你的站点。

### 4. 撰写内容

- **文章 (Posts)**: 向 `src/content/posts/` 目录添加 `.md` 或 `.mdx` 文件。
- **碎碎念 (Thoughts)**: 在 `src/content/thoughts/` 目录添加短动态。

参考现有的示例文章来了解 Frontmatter（头信息）的可用字段，如 `title`（标题）、`description`（描述）、`tags`（标签）等。

### 5. 部署发布

构建静态站点：

```bash
pnpm build
```

构建产物将位于 `dist`（或根据 Astro 配置位于 `static`）目录下。你可以将其部署到任何静态托管平台，如 Vercel、Cloudflare Pages、Netlify 或 GitHub Pages。

**(注：本项目还包含一个 `cwd-api` 文件夹，用于如果你希望通过 Cloudflare Workers 实现后端 API 功能。)**

---

## 同步机制 (Synchronization Mechanism)

本项目构建了一套 **Obsidian -> 博客** 的端到端自动化同步系统，包含增量同步、AI 自动打标以及三轨部署架构。

### 1. 数据流转：Obsidian ➔ 七牛云 S3 ➔ 网站服务器
- **Obsidian 端**：使用 S3 插件将笔记同步到云端桶的 `website/` 文件夹。
- **增量同步**：同步脚本对比本地与云端文件的修改时间（mtime），仅在云端更新时执行拉取，节省流量与时间。

### 2. 智能处理：Frontmatter 守卫者
- **Frontmatter 提取与合并**：当老文章更新时，系统会优先保留**本地**已有的元数据（如自定义标签、分类），并将其与云端新正文缝合，防止手动修改被覆盖。
- **AI 自动打标 (LLM)**：对于缺失头信息的新文章，系统会自动调用大模型（Deepseek/OpenAI）生成标题、摘要、分类及标签。

### 3. 三轨部署架构
- **方案 A：Go 后端服务 (`scripts/gosync`)**：
  提供 REST API。调用 `POST /api/sync` 后，服务器在后台异步执行“同步 -> AI 加工 -> Git 提交”。支持秒级响应，无需等待构建完成。
- **方案 B：GitHub Actions (GitOps)**：
  Go 服务将更新推送到 `deploy` 分支。GitHub 接到推送后自动启动云端构建 (`pnpm build`)。该方案实现了**模板隔离**，保护 `main` 分支不受文章与部署逻辑污染。
- **方案 C：本地一键速通脚本 (`deploy.ps1`)**：
  在本地执行打包并利用 SCP 协议直接覆盖到服务器的 `/var/www/` 目录。适用于不涉及 Git 流程的紧急发布。

---

## 致谢 (Credits)

本模板是 Lapis0x0 的 [VermilionVoid](https://github.com/Lapis0x0/VermilionVoid) 博客项目的抽象简化版本。
