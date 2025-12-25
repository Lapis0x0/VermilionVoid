---
title: 基于 Astro&Fuwari 主题博客的页面加密功能研究
published: 2025-07-31
description: 讲解博客的加密思路和具体源码
tags: []
category: "技术教程"
draft: false
---

由于我的博客内容涉及多个领域，难免会触及一些具有争议性的议题，可能会忤逆部分不特定读者的观念或利益。因此，我认为有必要研究如何在 Astro + Fuwari 框架下实现对特定页面的加密保护——当然，这种加密应尽量避免「掩耳盗铃」，不要干出来大家f12搜索一下就可以直接获取密码和实际全文内容的抽象事。

特别感谢我亲爱的两位 AI 开发伙伴——Claude Code 和 Roo Code 的协助。接下来，我将简要介绍这一功能的核心思路与实现路径。出于隐私与安全的考量，我目前已将博客的仓库转为私有，因此无法直接向大家展示完整的源码修改内容。但我会尽可能详细地说明与该加密功能相关的所有关键修改点，方便有类似需求的朋友参考实现。

>第一节是核心思路，第二节讲解了核心文件的修改原因，第三节是页面源代码

# 一、核心：如何给一个静态博客实现加密功能？

纯静态博客方便也就方便在**它没有后端服务器**，因此基本上不需要付出任何托管成本；但它麻烦也就麻烦在没有后端服务器，因为我们失去了传统网站中负责验证身份、分发内容的有效工具。

在动态网站（如 WordPress 或其他基于 Node_js/PHP/Java 的网站）中，加密内容的流程通常是这样的：
1. 服务器接收到用户请求。
2. 服务器判断该页面是否需要密码。
3. 如果需要，服务器先向用户发送一个密码输入页面。
4. 用户提交密码后，服务器在后端进行验证。
5. 验证通过，服务器才从数据库或文件中读取受保护的内容，将其渲染成 HTML，再发送给用户的浏览器。
整个过程中，受保护的原始内容始终安全地待在服务器上，绝不会在验证通过前泄露给客户端。

但对于我们静态博客，所有的 HTML 文件都已提前生成并部署。当用户请求一个 URL 时，托管服务（如 Vercel, Netlify, GitHub Pages）做的唯一一件事就是——把对应的 HTML 文件原封不动地发送过去。没有中间环节，没有验证逻辑。

这就引出了一个最常见，也最无效的“伪加密”方案：**前端隐藏**。

这种方法通常用 JavaScript 实现：页面加载后，先用 CSS 把文章内容 `display: none;` 藏起来，然后弹出一个密码框。用户输入密码后，JavaScript 判断输入的字符串是否等于预设的密码，如果相等，再把文章的 `display` 改回 `block`。

当然，该方法的缺陷也显而易见：**文章的全部原始内容已经完整地躺在发送过来的 HTML 文件里了**。任何一个稍懂技术的用户，只需在浏览器里按下 `F12` 打开开发者工具，或者直接右键“查看网页源代码”，就能毫不费力地找到被隐藏的全文，密码系统形同虚设，是绝对需要避免的。

那么，有没有一种方法，既能享受静态网站的便利，又能实现真正的加密呢？

答案是肯定的。核心思路是将验证和内容分发这两个本来应由服务器完成的工作，拆分到两个不同的阶段来完成。我的方案是 **「构建时加密+客户端解密」**。

## 第一步：构建时加密

这一阶段发生服务器构建环境，在 Vercel 等平台运行 `pnpm run build` 命令时，Astro 作为静态站点生成器（SSG），会遍历我所有的 Markdown 文章并将其转换为 HTML。

这时，我们可以让 Astro 在处理每篇文章时，检查其 frontmatter（头部元信息）中是否包含 `encrypted: true` 这个标记。如果包含该标记，就触发加密流程。

我使用了 `crypto-js` 作为加密库，将**整篇文章渲染后的 HTML 内容**作为明文，用我在 frontmatter 中设置的 `password` 作为密钥，进行 **AES 加密**。加密后，原本可读的 HTML 会变成一长串毫无意义的乱码，这就是**密文**。

为了避免将明文密码暴露在前端，我不会直接把密码存起来。而是使用 `bcryptjs` 库，将原始密码进行**加盐哈希**，生成一个不可逆的哈希值。这个哈希值的作用是用来比对，而不是用来解密。最后，Astro 生成的最终 HTML 页面里，**完全不包含原始文章内容**。取而代之的是一个空壳页面，里面只存放着两样东西：**文章内容的密文**和**密码的哈希值**。

经过这一步，部署到线上的 HTML 文件本身就是“安全”的。即使被直接下载，攻击者得到的也只是一堆无法阅读的密文和一个无法反解的密码哈希。

## 第二步：运行时解密

这一阶段发生在访客的浏览器里，当他们访问那个被加密的页面时：

1. **用户交互**：访客首先看到的不是文章，而是一个密码输入界面。
2. **客户端验证与解密**：当访客输入密码并点击“解锁”后，页面内嵌的 JavaScript 脚本会执行以下操作：
    - **验证密码**：脚本会先用 `bcryptjs` 将访客输入的密码进行**同样的哈希计算**，然后与页面中预存的那个哈希值进行比对。如果二者匹配，证明密码正确。这是为了快速验证密码，避免用错误的密码去尝试解密，浪费计算资源。
    - **解密内容**：密码验证通过后，脚本会使用访客**刚刚输入的明文密码**（它只存在于浏览器内存中，不会被发送到任何地方）作为密钥，调用 `crypto-js` 来解密页面中存储的**文章密文**。
3. **动态渲染**：一旦密文被成功解密，脚本就会将还原出的、包含完整格式的 HTML 内容，动态地插入到页面的相应容器中。

至此，访客才能看到文章的真实内容。通过这种方式，我们成功地在没有后端的情况下，模拟出了一套安全的“验证-解密-渲染”流程，实现了对静态内容的有效保护。

# 二、核心文件修改

为了实现这个功能，我们新增了两个包：`bcryptjs` 用于密码的哈希处理，以及 `crypto-js` 用于内容的对称加密。

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "crypto-js": "^4.2.0"
  }
}
```

核心文件分别为页面模板和密码验证组件。

## 1. 构建时加密：`src/pages/posts/[...slug].astro`

这个文件是博客文章的动态路由和页面模板。加密的核心逻辑之一在这里实现，即在**网站构建时**对需要加密的文章进行处理。

首先，我们在文章的 Markdown 文件头部通过 `frontmatter` 来控制一篇文章是否需要加密。当一篇文章需要加密时，我们添加 `encrypted: true` 和 `password: 'your-password'` 字段。

```markdown
---
title: '这是一篇加密文章'
encrypted: true
password: 'your-secret-password'
---

这里是文章的正常内容...
```

在 [`[...slug].astro`](src/pages/posts/[...slug].astro:1) 文件中，我们通过以下步骤实现加密：

1.  **检测加密标记**：在组件的脚本区域，我们首先检查文章的 `frontmatter` 中是否存在 `entry.data.encrypted` 和 `entry.data.password`。

2.  **密码哈希**：为了安全起见，我们不希望将明文密码直接暴露在前端。因此，我们使用 `bcryptjs` 在构建时为密码创建一个安全的哈希值。这个哈希值将用于在客户端验证用户输入的密码是否正确。

    ```javascript
    // src/pages/posts/[...slug].astro
    const passwordHash = bcrypt.hashSync(entry.data.password, 10);
    ```

3.  **内容加密**：我们直接获取文章的原始 `body`（即包含 frontmatter 的完整 Markdown 文本），并使用 `crypto-js` 对其进行加密。

    ```javascript
    // src/pages/posts/[...slug].astro
    const { body } = entry;
    const encrypted = CryptoJS.AES.encrypt(body, entry.data.password).toString();

    ```
  

4.  **传递数据**：最后，我们将**加密后的内容** `encrypted` 和**密码哈希** `passwordHash` 组合成一个对象 `encryptedData`，并通过 `props` 传递给密码保护组件 `<PasswordProtection />`。

    ```javascript
    // src/pages/posts/[...slug].astro
    encryptedData = {
      content: encrypted,
      hash: passwordHash
    };
    ```

在页面的 HTML 结构中，我们使用一个三元运算符来根据 `entry.data.encrypted` 的值决定是显示密码保护组件还是文章的原始内容。

```astro
// src/pages/posts/[...slug].astro
{entry.data.encrypted ? (
    <div>
        <PasswordProtection 
          encryptedData={encryptedData} 
          slug={entry.slug} 
          class="mb-6 rounded-xl password-container onload-animation"
        />
        {/* 加密内容容器，内容将通过JavaScript动态解密显示 */}
        <div id={`article-content-${entry.slug}`} class="mb-6 markdown-content onload-animation hidden encrypted-content">
            {/* 内容将在验证密码后动态插入 */}
        </div>
    </div>
) : (
    <div class="mb-6 markdown-content onload-animation">
        <Markdown class="w-full">
            <Content />
        </Markdown>
    </div>
)}
```

## 2. 客户端解密：`src/components/PasswordProtection.astro`

这个组件负责在客户端（用户的浏览器中）处理密码验证和内容解密。它接收从 `[...slug].astro` 传递过来的 `encryptedData` 和 `slug`。

它的工作流程如下：

1.  **显示密码表单**：组件的核心是一个密码输入框和提交按钮，它会覆盖在原本应该显示文章内容的位置。

2.  **动态加载依赖**：为了优化性能，该组件的内联脚本 ([`<script is:inline>`](src/components/PasswordProtection.astro:81)) 会动态地从 CDN 加载 `crypto-js` 和 `bcryptjs` 库。这样，只有在需要加密功能的页面上，用户的浏览器才会下载这些脚本。

3.  **处理表单提交**：当用户输入密码并提交时：
    *   **验证密码**：脚本使用 `bcrypt.compareSync()` 函数，将用户输入的密码与从服务器（构建时）传来的 `encryptedData.hash` 进行比较。这个过程完全在客户端进行，不会有网络请求，保证了验证的瞬时性。
        ```javascript
        // src/components/PasswordProtection.astro
        const isValidPassword = dcodeIO.bcrypt.compareSync(inputPassword, encryptedData.hash);
        ```
    *   **解密内容**：如果密码验证通过，脚本会使用用户输入的正确密码作为密钥，通过 `CryptoJS.AES.decrypt()` 来解密 `encryptedData.content`。
        ```javascript
        // src/components/PasswordProtection.astro
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData.content, inputPassword);
        const decryptedContent = decryptedBytes.toString(CryptoJS.enc.Utf8);
        ```
    *   **显示内容**：解密后的 HTML 内容会被动态插入到页面中预留的 `div` ([`#article-content-${slug}`](src/components/PasswordProtection.astro:17)) 中，同时密码输入框的遮罩层会被隐藏。

4.  **本地缓存**：为了提升用户体验，一旦用户成功解锁了一篇文章，脚本会使用 `localStorage` 将解锁状态和解密后的内容缓存起来。这样，当用户下次访问同一篇文章时，脚本会直接从缓存中读取并显示内容，无需再次输入密码。

    ```javascript
    // src/components/PasswordProtection.astro
    localStorage.setItem(`fuwari-unlocked-${slug}`, 'true');
    localStorage.setItem(`fuwari-content-${slug}`, decryptedContent);
    ```

## 3.工作流程总结

整个加密功能的流程可以总结为以下几个步骤：

1.  **构建时 (Build-Time)**：
    *   Astro 遍历所有 Markdown 文章。
    *   如果文章 `frontmatter` 包含 `encrypted: true`，则触发加密流程。
    *   使用 `bcryptjs` 将明文密码哈希化。
    *   使用 `crypto-js` 和明文密码加密文章内容。
    *   将加密内容和密码哈希传递给前端组件。

2.  **客户端 (Client-Side)**：
    *   页面加载，显示密码输入框遮罩层。
    *   用户输入密码。
    *   浏览器中的 `bcryptjs` 脚本将输入密码与哈希进行比对。
    *   如果匹配，浏览器中的 `crypto-js` 脚本使用该密码解密文章内容。
    *   解密后的内容被注入到页面中，遮罩层消失。
    *   解锁状态被存入 `localStorage`，方便用户下次访问。

通过这种方式，我们实现了一个安全且高效的静态博客页面加密方案。它将加密过程放在构建时，保证了服务器端没有动态解密的开销；同时在客户端进行验证和解密，避免了明文密码在网络中传输的风险。

# 三、页面源代码

>导入包之类的我这里就不放了

## 1.`[...slug].astro`

```javascript
import path from 'node:path'
import { getCollection } from 'astro:content'
import License from '@components/misc/License.astro'
import Markdown from '@components/misc/Markdown.astro'
import I18nKey from '@i18n/i18nKey'
import { i18n } from '@i18n/translation'
import MainGridLayout from '@layouts/MainGridLayout.astro'
import { getDir, getPostUrlBySlug } from '@utils/url-utils'
import { Icon } from 'astro-icon/components'
import { licenseConfig } from 'src/config'
import PostMetadata from '../../components/PostMeta.astro'
import ImageWrapper from '../../components/misc/ImageWrapper.astro'
import { profileConfig, siteConfig } from '../../config'
import { formatDateToYYYYMMDD } from '../../utils/date-utils'
import PasswordProtection from '../../components/PasswordProtection.astro'
import bcrypt from 'bcryptjs'
import CryptoJS from 'crypto-js'

export async function getStaticPaths() {
  const blogEntries = await getCollection('posts', ({ data }) => {
    return import.meta.env.PROD ? data.draft !== true : true
  })
  return blogEntries.map(entry => ({
    params: { slug: entry.slug },
    props: { entry },
  }))
}

const { entry } = Astro.props
const { Content, headings } = await entry.render()

const { remarkPluginFrontmatter } = await entry.render()

// 处理加密文章
let encryptedData = null;
if (entry.data.encrypted && entry.data.password) {
  // 生成密码哈希用于验证
  const passwordHash = bcrypt.hashSync(entry.data.password, 10);
  
  // 获取文章的原始body内容
  const { body } = entry;
  
  // 使用密码加密原始Markdown内容
  const encrypted = CryptoJS.AES.encrypt(body, entry.data.password).toString();
  
  encryptedData = {
    content: encrypted,
    hash: passwordHash
  };
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: entry.data.title,
  description: entry.data.description || entry.data.title,
  keywords: entry.data.tags,
  author: {
    '@type': 'Person',
    name: profileConfig.name,
    url: Astro.site,
  },
  datePublished: formatDateToYYYYMMDD(entry.data.published),
  inLanguage: (entry.data.lang ? entry.data.lang.replace('_', '-') : siteConfig.lang.replace('_', '-')),
  // TODO include cover image here
}
---
<MainGridLayout banner={entry.data.image} title={entry.data.title} description={entry.data.description} lang={entry.data.lang} setOGTypeArticle={true} headings={headings}>
    <script is:inline slot="head" type="application/ld+json" set:html={JSON.stringify(jsonLd)}></script>
    <div class="flex w-full rounded-[var(--radius-large)] overflow-hidden relative mb-4">
        <div id="post-container" class:list={["card-base z-10 px-6 md:px-9 pt-6 pb-4 relative w-full ",
            {}
        ]}>
            <!-- word count and reading time -->
            <div class="flex flex-row text-black/30 dark:text-white/30 gap-5 mb-3 transition onload-animation">
                <div class="flex flex-row items-center">
                    <div class="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 flex items-center justify-center mr-2">
                        <Icon name="material-symbols:notes-rounded"></Icon>
                    </div>
                    <div class="text-sm">{remarkPluginFrontmatter.words} {" " + i18n(I18nKey.wordsCount)}</div>
                </div>
                <div class="flex flex-row items-center">
                    <div class="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 flex items-center justify-center mr-2">
                        <Icon name="material-symbols:schedule-outline-rounded"></Icon>
                    </div>
                    <div class="text-sm">{remarkPluginFrontmatter.minutes} {" " + i18n(I18nKey.minutesCount)}</div>
                </div>
            </div>

            <!-- title -->
            <div class="relative onload-animation">
                <div
                    data-pagefind-body data-pagefind-weight="10" data-pagefind-meta="title"
                    class="transition w-full block font-bold mb-3
                    text-3xl md:text-[2.25rem]/[2.75rem]
                    text-black/90 dark:text-white/90
                    md:before:w-1 before:h-5 before:rounded-md before:bg-[var(--primary)]
                    before:absolute before:top-[0.75rem] before:left-[-1.125rem]
                ">
                    {entry.data.title}
                </div>
            </div>

            <!-- metadata -->
            <div class="onload-animation">
                <PostMetadata
                        class="mb-5"
                        published={entry.data.published}
                        updated={entry.data.updated}
                        tags={entry.data.tags}
                        category={entry.data.category}
                ></PostMetadata>
                {!entry.data.image && <div class="border-[var(--line-divider)] border-dashed border-b-[1px] mb-5"></div>}
            </div>

            <!-- always show cover as long as it has one -->

            {entry.data.image &&
                <ImageWrapper id="post-cover" src={entry.data.image} basePath={path.join("content/posts/", getDir(entry.id))} class="mb-8 rounded-xl banner-container onload-animation"/>
            }

            <!-- 加密文章的处理 -->
            {encryptedData ? (
                <div>
                    <PasswordProtection 
                      encryptedData={encryptedData} 
                      slug={entry.slug} 
                      class="mb-6 rounded-xl password-container onload-animation"
                    />
                    <!-- 加密内容容器，内容将通过JavaScript动态解密显示 -->
                    <div id={`article-content-${entry.slug}`} class="mb-6 markdown-content onload-animation hidden encrypted-content">
                        <!-- 内容将在验证密码后动态插入 -->
                    </div>
                </div>
            ) : (
                <div class="mb-6 markdown-content onload-animation">
                    <Markdown class="w-full">
                        <Content />
                    </Markdown>
                </div>
            )}

            {licenseConfig.enable && <License title={entry.data.title} slug={entry.slug} pubDate={entry.data.published} class="mb-6 rounded-xl license-container onload-animation"></License>}

        </div>
    </div>


    <div class="flex flex-col md:flex-row justify-between mb-4 gap-4 overflow-hidden w-full">
        <a href={entry.data.nextSlug ? getPostUrlBySlug(entry.data.nextSlug) : "#"}
           class:list={["w-full font-bold overflow-hidden active:scale-95", {"pointer-events-none": !entry.data.nextSlug}]}>
            {entry.data.nextSlug && <div class="btn-card rounded-2xl w-full h-[3.75rem] max-w-full px-4 flex items-center !justify-start gap-4" >
                <Icon name="material-symbols:chevron-left-rounded" class="text-[2rem] text-[var(--primary)]" />
                <div class="overflow-hidden transition overflow-ellipsis whitespace-nowrap max-w-[calc(100%_-_3rem)] text-black/75 dark:text-white/75">
                    {entry.data.nextTitle}
                </div>
            </div>}
        </a>

        <a href={entry.data.prevSlug ? getPostUrlBySlug(entry.data.prevSlug) : "#"}
           class:list={["w-full font-bold overflow-hidden active:scale-95", {"pointer-events-none": !entry.data.prevSlug}]}>
            {entry.data.prevSlug && <div class="btn-card rounded-2xl w-full h-[3.75rem] max-w-full px-4 flex items-center !justify-end gap-4">
                <div class="overflow-hidden transition overflow-ellipsis whitespace-nowrap max-w-[calc(100%_-_3rem)] text-black/75 dark:text-white/75">
                    {entry.data.prevTitle}
                </div>
                <Icon name="material-symbols:chevron-right-rounded" class="text-[2rem] text-[var(--primary)]" />
            </div>}
        </a>
    </div>
<!-- giscus评论 -->
<div style="margin-top: 20px;"></div>
<script src="https://giscus.app/client.js"
        data-repo="Lapis0x0/blog-discussion"
        data-repo-id="R_kgDONda6_g"
        data-category="Announcements"
        data-category-id="DIC_kwDONda6_s4ClN0D"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="preferred_color_scheme"
        data-lang="zh-CN"
        crossorigin="anonymous"
        async>
</script>
</MainGridLayout>


```

## 2.PasswordProtection.astro

```javascript
/**
 * 文章密码保护组件
 * 使用构建时加密的内容和密码哈希验证
 */
interface Props {
  slug: string;
  encryptedData?: {
    content: string;
    hash: string;
  };
  class?: string;
}

const { slug, encryptedData, class: className = '' } = Astro.props;
const formId = `password-form-${slug}`;
const contentId = `article-content-${slug}`;
const overlayId = `overlay-${slug}`;
---

<div id={overlayId} class={`password-protection-overlay ${className}`}>
  <div class="password-container card-base rounded-xl p-6 md:p-8 max-w-md w-full">
    <h3 class="font-bold text-xl mb-4 text-black/90 dark:text-white/90">🔒 此文章已加密</h3>
    <p class="mb-6 text-black/70 dark:text-white/70">本文章内容可能忤逆部分读者所持的思潮立场、年龄背景或兴趣偏好。请输入密码以查看完整内容，若您不清楚密码，请联系博主获取。</p>
    <form id={formId} class="flex flex-col">
      <input 
        type="password" 
        class="form-input mb-4 p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-[#1a1a1a] text-black/90 dark:text-white/90 w-full focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" 
        placeholder="请输入密码" 
        required
      />
      <button 
        type="submit" 
        class="bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-md py-2 px-4 text-white font-medium transition-colors"
      >
        解锁内容
      </button>
      <p id="error-message" class="text-red-500 mt-2 text-sm hidden">密码错误，请重试</p>
    </form>
  </div>
</div>

<style>
.password-protection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--card-bg);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
  backdrop-filter: blur(5px);
}

.password-container {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.hidden-overlay {
  animation: fadeOut 0.3s forwards;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; visibility: hidden; }
}

/* 确保加密内容在页面源码中不可见 */
.encrypted-content {
  display: none !important;
}

.encrypted-content.unlocked {
  display: block !important;
}
</style>

<script define:vars={{ slug, encryptedData, formId, contentId, overlayId }} is:inline>
(function() {
  // 动态加载所需的库
  function loadLibraries() {
    return new Promise((resolve, reject) => {
      let loadedCount = 0;
      const totalLibs = 2;
      
      function checkComplete() {
        loadedCount++;
        if (loadedCount === totalLibs) {
          resolve();
        }
      }
      
      // 加载 crypto-js
      if (typeof CryptoJS === 'undefined') {
        const cryptoScript = document.createElement('script');
        cryptoScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js';
        cryptoScript.onload = checkComplete;
        cryptoScript.onerror = () => reject(new Error('Failed to load crypto-js'));
        document.head.appendChild(cryptoScript);
      } else {
        checkComplete();
      }
      
      // 加载 bcryptjs
      if (typeof dcodeIO === 'undefined') {
        const bcryptScript = document.createElement('script');
        bcryptScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js';
        bcryptScript.onload = checkComplete;
        bcryptScript.onerror = () => reject(new Error('Failed to load bcryptjs'));
        document.head.appendChild(bcryptScript);
      } else {
        checkComplete();
      }
    });
  }
  
  function initEncryption() {
    // 检查是否已解锁
    const storageKey = `fuwari-unlocked-${slug}`;
    const isUnlocked = localStorage.getItem(storageKey) === 'true';
    
    if (isUnlocked) {
      // 如果已解锁，尝试从缓存获取内容
      const cachedContent = localStorage.getItem(`fuwari-content-${slug}`);
      if (cachedContent) {
        const contentElement = document.getElementById(contentId);
        if (contentElement) {
          renderMarkdownContent(cachedContent, contentElement);
          document.getElementById(overlayId).classList.add('hidden-overlay');
        }
      }
    }
    
    // 表单提交处理
    const form = document.getElementById(formId);
    if (form && encryptedData) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const inputPassword = e.target.querySelector('input[type="password"]').value;
        const errorElement = document.getElementById('error-message');
        const submitButton = e.target.querySelector('button[type="submit"]');
        
        // 显示加载状态
        const originalText = submitButton.textContent;
        submitButton.textContent = '验证中...';
        submitButton.disabled = true;
        
        try {
          // 使用bcrypt验证密码哈希
          const isValidPassword = dcodeIO.bcrypt.compareSync(inputPassword, encryptedData.hash);
          
          if (isValidPassword) {
            // 密码正确，解密内容
            const decryptedBytes = CryptoJS.AES.decrypt(encryptedData.content, inputPassword);
            const decryptedMarkdown = decryptedBytes.toString(CryptoJS.enc.Utf8);
            
            if (decryptedMarkdown) {
              // 解密成功，渲染Markdown内容
              localStorage.setItem(storageKey, 'true');
              localStorage.setItem(`fuwari-content-${slug}`, decryptedMarkdown);
              
              const contentElement = document.getElementById(contentId);
              if (contentElement) {
                renderMarkdownContent(decryptedMarkdown, contentElement);
                document.getElementById(overlayId).classList.add('hidden-overlay');
              }
              
              errorElement.classList.add('hidden');
            } else {
              throw new Error('解密失败');
            }
          } else {
            // 密码错误
            errorElement.classList.remove('hidden');
            e.target.querySelector('input[type="password"]').value = '';
          }
        } catch (error) {
          console.error('验证失败:', error);
          errorElement.classList.remove('hidden');
          e.target.querySelector('input[type="password"]').value = '';
        } finally {
          // 恢复按钮状态
          submitButton.textContent = originalText;
          submitButton.disabled = false;
        }
      });
    }
  }

  // 渲染Markdown内容为HTML
  function renderMarkdownContent(markdown, targetElement) {
    // 动态加载marked库来解析Markdown
    if (typeof marked === 'undefined') {
      const markedScript = document.createElement('script');
      markedScript.src = 'https://cdn.jsdelivr.net/npm/marked@12.0.0/lib/marked.umd.js';
      markedScript.onload = function() {
        const html = marked.parse(markdown);
        targetElement.innerHTML = `<div class="w-full !max-w-none custom-md dark:prose-invert prose prose-base" data-pagefind-body>${html}</div>`;
        targetElement.classList.remove('hidden');
        targetElement.classList.add('unlocked');
      };
      document.head.appendChild(markedScript);
    } else {
      const html = marked.parse(markdown);
      targetElement.innerHTML = `<div class="w-full !max-w-none custom-md dark:prose-invert prose prose-base" data-pagefind-body>${html}</div>`;
      targetElement.classList.remove('hidden');
      targetElement.classList.add('unlocked');
    }
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      loadLibraries().then(initEncryption).catch(console.error);
    });
  } else {
    loadLibraries().then(initEncryption).catch(console.error);
  }
})();
</script>
```