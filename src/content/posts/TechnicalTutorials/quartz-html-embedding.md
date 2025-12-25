---
title: 在 Quartz v4 中嵌入本地 HTML 格式报告的解决方法
published: 2025-06-16
description: "和o3、Gemini 2.5 pro、4o等模型搏斗七小时后的结论"
image: ""
tags: []
category: 技术教程
draft: false
---

事情是这样的：

最近我注意到，Gemini App 在执行深度思考并生成报告之后，还能进一步基于这份报告产出一份交互式的 HTML 网页，前端审美非常棒。作为赛博仓鼠癖，我自然想：能不能把这个页面嵌入到我的 Quartz 4 笔记中展示呢？——反正 Quartz 4 和 Obsidian 本质上是一体的，Obsidian 能做的，Quartz 4 应该也能吧？

……对吧？

然后，我带着这个朴素的想法，和 o3、Gemini 2.5 Pro、GPT-4o & OpenAI深度思考、Roo code 等等 AI 模型和产品展开了长达七个小时的缠斗，最终得出一个明确结论：**可以实现**，而且稳定、可复用。

下面是我总结出的解决方法。

# 一、原理说明：Quartz 4 为什么不讲理？

Quartz v4 本质上是一个基于 TypeScript 的静态站点生成器，它对 `.md` 和 `.html` 有着「各执一词」的态度：

- 如果你把 HTML 文件放进 `content/` 目录，它会**当成一篇笔记处理**，然后去掉扩展名输出，这就导致html文件没办法正常被渲染展示；
    
- 如果你放进根目录的 `static/`，Quartz v4 根本不会管它（那个 static 是给主题内文件用的）；
    
- 即便你配置了 `Plugin.Static()`，Quartz 也只会把 `quartz/static/` 里的文件搬到 `/static/` 路径下；
    
- 你不能在 `Plugin.Assets()` 或 `Plugin.ContentPage()` 里“说服”它保留 `.html` 扩展名——因为这些插件压根不支持你想要的那种 override。

总结一下：**Quartz v4 在构建层面压根没考虑你想挂载 HTML 文件**，因为它默认你不会做这种事。我们必须**另辟蹊径**，把 `.html` 报告的生命周期**交给我们自己控制**，Quartz 构建完之后我们再偷偷塞进去。

# 二、操作步骤：绕过 Quartz

## 第一步：把报告文件放进单独目录

新建一个 `reports/` 文件夹，所有要嵌入的 HTML 报告（比如 Gemini 生成的交互页面）都放进去，比如：

```
your-project/
└── reports/
    └── 20250613-iran-vs-israel-overview.html
```

## 第二步：在笔记中通过 iframe 引用

在任意 `.md` 文件中写入：

```html
<iframe
  src="/reports/20250613-iran-vs-israel-overview.html"
  style="width:100%;height:90vh;border:none;"
  loading="lazy">
</iframe>
```

这样 Quartz 构建时会忽略它，后面我们再补进去。

## 第三步：在构建后自动复制报告文件

打开 `package.json`，在 `scripts` 中加入以下字段：

```jsonc
"scripts": {
  "copy-reports": "mkdir -p public/reports && cp -r reports/* public/reports/",
  "quartz-build-and-copy": "npx quartz build && npm run copy-reports",
  "build": "npm run quartz-build-and-copy"
}
```

这段逻辑做了两件事：

- 先跑原始的 Quartz 构建；
    
- 然后把你放在 `reports/` 里的报告原样复制到最终 `public/reports/` 路径下，**不改名、不加 .html，不被 Quartz 干扰**。
    

## 第四步（关键）：显式告诉 Vercel 用这个脚本部署

编辑 `vercel.json`，加入：

```json
{
  "buildCommand": "npm run build",
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/:path((?:[^/]+/)*[^./]+)",
      "destination": "/:path.html"
    }
  ]
}
```

否则 Vercel 默认只会跑 `npx quartz build`，根本不会执行你刚才写的复制逻辑。

---

# 三、最终效果

你可以访问[这个链接](https://note.lapis.cafe/%E6%8A%95%E8%B5%84/20250613%E4%BB%A5%E4%BC%8A%E5%86%B2%E7%AA%81%E4%B8%93%E9%A2%98/%E6%A2%B3%E7%90%86)来查看最终嵌入效果，我们可以看到`<iframe>` 成功在笔记中渲染完整内容，无需额外改路由。

![image.png](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202506162318563.png)
