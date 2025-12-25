---
title: 用飞书多维文档打造博客书架页—支持 GitHub Actions 自动更新
published: 2025-01-28
description: "本文介绍了如何通过飞书API和GitHub Action实现自动化博客书架页更新。利用飞书多维表格管理书库数据，通过Python脚本同步数据并优化图片，最终借助GitHub Action自动构建和部署博客，实现数据与展示的自动化同步。"
image: ""
tags: []
category: 技术教程
draft: false
---

# 前言与总结

**项目代码还请直接参见我的博客GitHub库的scripts文件夹**
::github{repo="Lapis0x0/fuwari"}

情况是这样的：我现在将日常任务管理、OKR编排和个人书库影音库放到了飞书里。得益于飞书强大的自定义能力和开放的 API 接口，我能够根据自身需求构建个性化的信息管理系统。然而，仅仅在飞书内部管理这些数据还不够，我还需要一个对外展示的窗口，尤其是针对我的书库——一个精美的、可自动更新的博客书架页。

在当前的技术栈中，Astro作为静态站点生成器（SSG）提供了很棒的博客框架与组件化能力。但传统静态博客的痛点在于：每当飞书书库新增条目时，需要手动导出数据、更新Front Matter、重新部署站点。这种机械的重复劳动显然违背了自动化管理的初衷。

为了解决这个问题，我设计了一个自动化工作流：通过Github Action自动从飞书多维表格中同步数据，并触发博客的自动构建与部署，整个流程节点如下：

1. **数据源管理** 在飞书多维表格（Bitable）中，我创建了一个结构化的书库表格，记录每本书的基本信息、阅读状态、笔记等。这种方式不仅便于日常管理，还能通过飞书移动端随时记录读书心得。
2. **数据同步与处理** 我编写了一个 Python 脚本来处理数据同步，主要功能包括：
    - 通过飞书开放平台的 API 获取书库数据
    - 智能处理书籍封面图片：
        - 自动压缩和转换为 WebP 格式
        - 优化图片尺寸（最大 800×1200）
        - 控制文件大小（不超过 300KB）
        - 保持透明通道（如果原图有的话）
    - 将处理后的数据转换为博客可用的 JSON 格式
3. **自动化部署** 利用 GitHub Actions 的定时任务功能，系统会：
    - 定期执行数据同步脚本
    - 使用处理后的数据更新博客内容
    - 自动触发站点重新构建和部署

通过这种方式，我实现了一个真正的“阅读优先”的工作流，只需要在飞书中维护书库数据，博客页面就会自动保持同步。

# 二、脚本代码解析

## 1.环境配置与图片资源优化

脚本通过环境变量管理敏感配置信息：

```python
APP_ID = os.getenv('FEISHU_APP_ID')
APP_SECRET = os.getenv('FEISHU_APP_SECRET')
BITABLE_ID = os.getenv('FEISHU_BITABLE_ID')
TABLE_ID = os.getenv('FEISHU_TABLE_ID')
```

确保安全性，同时也方便在不同环境（本地开发/GitHub Action）间切换。

**环境变量介绍：**

1. **`FEISHU_APP_ID`**
    - 飞书应用的唯一标识符
    - 在创建飞书应用后可以在应用凭证页面获取
    - 用于识别是哪个应用在访问飞书 API
2. **`FEISHU_APP_SECRET`**
    - 飞书应用的密钥
    - 与 APP_ID 配对使用，用于生成访问令牌（access token）
    - 需要妥善保管，不能泄露
3. **`FEISHU_BITABLE_ID`**
    - 多维表格的唯一标识符
    - 可以从多维表格的 URL 中获取
    - 用于指定要操作的具体多维表格
4. **`FEISHU_TABLE_ID`**
    - 多维表格中具体数据表的唯一标识符
    - 一个多维表格可以包含多个数据表，这个 ID 用于指定具体要操作哪个数据表
    - 可以从数据表的 URL 或者 API 获取

为了确保博客页面的加载性能，实现了智能的图片处理机制：

```python
# 图片压缩配置
MAX_SIZE = (800, 1200)  # 最大尺寸
WEBP_QUALITY = 85      # 初始质量
MAX_FILE_SIZE = 300 * 1024  # 目标大小上限
```

- 自动转换为现代的 WebP 格式
- 智能压缩算法：从85%质量开始，逐步降低直至满足大小要求
- 保留透明通道：自动检测和保持图片的透明度
- 渐进式压缩：在保证视觉质量的同时实现最优压缩比

## 2.数据同步

同步过程分为以下几个：

**（1）认证**

```python
def get_tenant_access_token():
    """获取飞书应用的 tenant_access_token"""
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {
        "Content-Type": "application/json"
    }
    data = {
        "app_id": APP_ID,
        "app_secret": APP_SECRET
    }
```

通过飞书开放平台的 OAuth2 流程获取访问令牌，确保安全访问。

**（2）获取多维表格中的记录**

```python
def get_bitable_records():
    """获取多维表格中的记录"""
    token = get_tenant_access_token()
    if not token:
        print("Failed to get access token")
        return None
    
    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{BITABLE_ID}/tables/{TABLE_ID}/records"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(url, headers=headers)
    return response.json()
```

获取飞书多维表格中的表格记录

```python
def download_image(url, token, save_dir):
    """下载图片并返回本地路径"""
    try:
        # 生成文件名（使用URL的哈希值）
        url_hash = hashlib.md5(url.encode()).hexdigest()
        filename = f"{url_hash}.webp"  # 使用webp格式
        local_path = os.path.join(save_dir, filename)
        
        # 如果文件已存在，直接返回路径
        if os.path.exists(local_path):
            print(f"Image already exists: {filename}")
            return os.path.join('/images/books', filename)
        
        # 下载图片
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # 压缩图片
        compressed_data = compress_image(response.content)
        
        # 保存压缩后的图片
        with open(local_path, 'wb') as f:
            f.write(compressed_data)
        
        original_size = len(response.content) / 1024  # KB
        compressed_size = len(compressed_data) / 1024  # KB
        compression_ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
        print(f"Downloaded: {filename} (Original: {original_size:.1f}KB, Compressed: {compressed_size:.1f}KB, Saved: {compression_ratio:.1f}%)")
        
        return os.path.join('/images/books', filename)
    except Exception as e:
        print(f"Error downloading image {url}: {str(e)}")
        return None
```

```python
def process_records(records, token):
    """处理记录，下载图片并更新图片路径"""
    if not records or 'data' not in records or 'items' not in records['data']:
        return records
    
    # 确保图片目录存在
    save_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'images', 'books')
    os.makedirs(save_dir, exist_ok=True)
    
    # 处理每条记录
    for item in records['data']['items']:
        if '封面' in item['fields'] and item['fields']['封面']:
            covers = item['fields']['封面']
            new_covers = []
            for cover in covers:
                if 'url' in cover:
                    # 下载图片并获取本地路径
                    local_path = download_image(cover['url'], token, save_dir)
                    if local_path:
                        new_cover = cover.copy()
                        new_cover['local_path'] = local_path
                        new_covers.append(new_cover)
            if new_covers:
                item['fields']['封面'] = new_covers
    
    return records

def save_to_json(data):
    """将数据保存为 JSON 文件"""
    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'data', 'books.json')
    
    # 添加更新时间
    data['last_updated'] = datetime.now().isoformat()
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Data saved to {output_path}")
```

- 提取书籍信息
- 下载并优化封面图片
- 生成适用于静态站点的本地路径
- 将处理后的数据序列化为 JSON 格式
- 添加时间戳，便于追踪更新状态
- 保存到博客的 **`public/data`** 目录

**（3）文件组织**

处理后的资源按照类型分类存储：

- 图片资源：**`public/images/books/`**
- 数据文件：**`public/data/books.json`**

这种组织方式与 Astro 的静态资源处理完美契合，确保了资源的正确引用和加载。

## 2.静态博客书架页样式设计

```python
---
import MainGridLayout from '../layouts/MainGridLayout.astro';
import { i18n } from '../i18n/translation';
import I18nKey from '../i18n/i18nKey';

// Read and parse the books data
const response = await fetch(new URL('/data/books.json', Astro.url));
const booksData = await response.json();
// Filter books with reading progress "1"
const books = booksData.data.items.filter(book => book.fields['阅读进度'] === "1");

// Group books by category (领域)
const booksByCategory = books.reduce((acc, book) => {
  const category = book.fields['领域'] || '未分类';
  if (!acc[category]) {
    acc[category] = [];
  }
  acc[category].push(book);
  return acc;
}, {});

// Function to get cover URL
function getCoverUrl(book) {
  if (book.fields['封面']?.[0]) {
    // 使用本地路径
    return book.fields['封面'][0].local_path;
  }
  return null;
}
---

<MainGridLayout title={i18n(I18nKey.bookshelf)} description={i18n(I18nKey.bookshelf)}>
  <style>
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255, 255, 255, 0.5);
    }
  </style>
  <div class="flex w-full rounded-[var(--radius-large)] overflow-hidden relative">
    <div class="card-base z-10 px-6 py-6 relative w-full">
      {Object.entries(booksByCategory).map(([category, books]) => (
        <div class="mb-12">
          <h2 class="text-2xl font-bold mb-6 pb-2 border-b border-zinc-200 dark:border-zinc-800 text-[var(--primary)]">
            {category}
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {books.map((book) => (
              <div class="group relative flex flex-col">
                <div class="aspect-[3/4] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 shadow-md transition-all duration-300 group-hover:shadow-xl">
                  {getCoverUrl(book) ? (
                    <img 
                      src={getCoverUrl(book)}
                      alt={book.fields['书名']} 
                      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div class="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-900 p-4">
                      <span class="text-center text-sm text-[var(--text-2)]">{book.fields['书名']}</span>
                    </div>
                  )}
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div class="absolute bottom-0 left-0 right-0 p-4">
                      <h3 class="text-sm font-bold text-white mb-1 line-clamp-2">
                        {book.fields['书名']}
                      </h3>
                      {book.fields['作者']?.length > 0 && (
                        <p class="text-xs text-zinc-200 mb-2">
                          {book.fields['作者'].join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div class="overlay absolute inset-0 bg-black/80 opacity-0 transition-opacity duration-300 rounded-lg invisible group-hover:visible group-hover:opacity-100 flex items-center justify-center overflow-hidden">
                  <div class="p-4 text-white h-full overflow-y-auto custom-scrollbar">
                    <h3 class="text-sm font-bold mb-2 sticky top-0 bg-black/80 py-2">{book.fields['书名']}</h3>
                    {book.fields['书评'] ? (
                      <>
                        <p class="text-sm text-zinc-100 mb-3">{book.fields['书评']}</p>
                        {book.fields['书籍简介'] && (
                          <div class="pt-3 border-t border-white/20">
                            <p class="text-xs text-zinc-400">
                              {book.fields['书籍简介']}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p class="text-xs text-zinc-300">{book.fields['书籍简介']}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-6 {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

```

## 3.Github Action工作流

设定为每周日从飞书那里拉取一次数据，更新书架页信息。

```python
name: Update Books Data

on:
  schedule:
    - cron: '0 0 * * 0'  # 每周日 UTC 00:00 运行
  workflow_dispatch:  # 允许手动触发

jobs:
  update-books:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # 明确设置写入权限
    
    steps:
    - uses: actions/checkout@v3
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'
        cache: 'pip'  # 启用pip缓存
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install pillow requests  # 直接指定必要的依赖
    
    - name: Update books data
      env:
        FEISHU_APP_ID: ${{ secrets.FEISHU_APP_ID }}
        FEISHU_APP_SECRET: ${{ secrets.FEISHU_APP_SECRET }}
        FEISHU_BITABLE_ID: ${{ secrets.FEISHU_BITABLE_ID }}
        FEISHU_TABLE_ID: ${{ secrets.FEISHU_TABLE_ID }}
      run: |
        python scripts/test_feishu_bitable.py
        
    - name: Commit and push if changed
      run: |
        git config --local user.email "github-actions[bot]@users.noreply.github.com"
        git config --local user.name "github-actions[bot]"
        git add public/data/books.json public/images/books/*
        git diff --quiet && git diff --staged --quiet || (git commit -m "Update books data [skip ci]" && git push)

```

# 三、实际效果
请访问 [此链接](https://www.lapis.cafe/bookshelf/) 来体验