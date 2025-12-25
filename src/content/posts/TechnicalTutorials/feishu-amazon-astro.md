---
title: 从个人书架到电商项目：我如何将飞书多维表格打造成一个真正的无头 CMS
published: 2025-08-11
description: "记录了架构设计、相关代码与改进思路"
image: ""
tags: []
category: 技术教程
draft: false
---
该想法最初起源于我将飞书云文档作为博客的[书架页面](https://www.lapis.cafe/bookshelf/)的数据来源，相关博客请参见[《用飞书多维文档打造博客书架页—支持 GitHub Actions 自动更新》](https://www.lapis.cafe/posts/technicaltutorials/bookshelf-with-feishu/); 没想到前两天就有客户循着这篇文章找到我，希望定制一个外贸电商站点，并将**站点名、Logo、轮播图、商品与分类**等全量数据统一托管在飞书云文档里，让网站只做渲染与交付。换句话说：把飞书云文档用作 **无头 CMS（Headless CMS）/ 解耦 CMS（Decoupled CMS）** 的数据源。

在整个流程里，飞书多维表格、Github Action 和 Vercel 部署网站都是可以白嫖零成本的，整个项目唯一的花费可能就是域名的购买与续租成本。

>有类似需求但没时间/精力研究的读者也欢迎来私信我，我还想继续恰钱

# 一、项目主要思路与架构设计

项目的核心架构分为三个部分：**数据源（飞书多维表格**、**同步脚本（Python））** 和 **前端渲染（Astro）框架**。数据由 GitHub Action 定期拉取到 repo 仓库中，并交由 Vercel 触发执行重新部署到公网上。

## 1.数据源：飞书多维表格

用户所有的动态内容都存储在飞书的一个多维表格应用中。我们为不同类型的数据创建了独立的表格，例如：

* **网站信息表** (`site_homepage`)：存储网站名称、Logo、全局 SEO 设置等。
* **首页轮播图表** (`banner`)：管理首页 Banner 的图片、链接和排序。
* **商品信息表** (`product`)：包含商品标题、价格、图片、详情、分类关联等。
* **商品分类表** (`category`)：定义商品的分类信息。

这种方式让客户可以像编辑电子表格一样，直观地管理整个网站的内容，无需接触任何代码。

>我发现在飞书 Wiki/知识库中直接创建的多维表格，其 API 权限限制比云盘中创建的复杂得多。尤其是在知识库创建的多维表格里，根本无法**直接获取表格 ID**，当时差点被气死。最后我干脆直接在云盘中创建多维表格，省心省力，变量获取也方便。建议看到这里的朋友直接在飞书云盘中建表，少走弯路。

## 2.同步脚本：采用 Github Action 来自动、定期执行

我们使用 Python 脚本来完成数据从飞书到本地 json 文件的迁移。

所有脚本都依赖于一个共享模块 [`feishu_common.py`](scripts/feishu_common.py:1)，它封装了通用逻辑：
- **认证**：通过 `APP_ID` 和 `APP_SECRET` 获取 API 操作所需的 `tenant_access_token`。
- **API 封装**：提供了 [`list_records`](scripts/feishu_common.py:36) 函数，用于获取指定表格的全部记录，并自动处理了分页。
- **文件下载**：关键的 [`download_feishu_file`](scripts/feishu_common.py:75) 函数。飞书中的图片/附件有访问权限，无法直接在网站上使用。该函数负责携带 token 下载这些文件，根据其内容和来源为其生成一个稳定的、唯一的本地文件名，存入 `public/images/feishu/` 目录下，并返回一个可在网站上公开访问的相对路径，如 `/images/feishu/product/xxx.jpg`。
- **数据写入**：[`write_json_file`](scripts/feishu_common.py:133) 函数将处理好的数据写入到 `src/data/` 目录下的对应 JSON 文件中。

每个具体的数据同步脚本（如 [`sync_products.py`](scripts/sync_products.py:1)）都遵循清晰的三步流程：
1. **提取 (Extract)**：调用 [`feishu_common.fetch_records`](scripts/feishu_common.py:144) 从飞书 API 获取原始数据。
2. **转换 (Transform)**：这是最核心的一步。脚本将飞书返回的原始、复杂的 JSON 结构，转换为前端友好、结构扁平清晰的数据格式。例如，在 [`transform_products`](scripts/sync_products.py:7) 函数中，它会：
	- 遍历商品记录。
	- 调用 `download_feishu_file` 处理商品图片。
	- 从关联的分类信息中提取出分类名称，并生成一个用于 URL 的 `categorySlug`。
	- 组合成一个结构化的商品对象。
3. **加载 (Load)**：调用 `write_json_file` 将转换后的数据列表保存为本地的 `products.json` 文件。

## 3.前端渲染：纯粹的数据展示层

前端采用 [Astro](https://astro.build/) 框架。得益于解耦架构，Astro 项目本身完全**不知道飞书的存在**。它的任务非常纯粹，即在构建时（或服务器端渲染时），直接读取 `src/data/` 目录下的 `products.json`、`categories.json` 等文件，将这些本地数据作为信源，渲染出商品列表页、详情页等静态页面，页面中引用的图片路径，就是同步脚本生成并保存在 `public/` 目录下的本地图片。

当客户在飞书更新内容后，只需重新运行一次同步脚本 (`sh scripts/sync_all.sh`)，即可拉取最新数据。随后重新部署 Astro 站点，网站内容便完成了更新。整个过程实现了内容管理与网站代码的完全分离。


# 二、具体示例代码

>出于最基本的商业道德和个人操守，飞书表格和具体的隐私内容就不在这里展示了

## 1.`feishu_common.py`通用共享模块

```python
"""
飞书数据同步共享模块
包含所有通用的、可复用的代码，如 API 配置、token 管理、文件下载、JSON 写入等函数。
"""

import os, json, pathlib, requests, time, re
from urllib.parse import urlparse

# === 0. 基础配置（强烈建议用环境变量读取） ===
APP_ID     = os.getenv("FEISHU_APP_ID",     "")
APP_SECRET = os.getenv("FEISHU_APP_SECRET", "")
BASE_URL   = "https://open.feishu.cn"
SITE_DATA_DIR = pathlib.Path(__file__).parent.parent / "src" / "data"
FEISHU_IMAGE_DIR = pathlib.Path(__file__).parent.parent / "public" / "images" / "feishu"

TABLES = {
    "site_homepage": dict(cn_name="网站首页",   app="", tbl=""),
    "banner":        dict(cn_name="首页轮播图", app="", tbl=""),
    "category":      dict(cn_name="商品分类",   app="", tbl=""),
    "product":       dict(cn_name="商品信息",   app="", tbl=""),
}

# === 1. 飞书 API 封装 ===

def get_tenant_token() -> str:
    """获取 tenant_access_token"""
    url  = f"{BASE_URL}/open-apis/auth/v3/tenant_access_token/internal"
    body = {"app_id": APP_ID, "app_secret": APP_SECRET}
    r = requests.post(url, json=body, timeout=10)
    r.raise_for_status()
    return r.json()["tenant_access_token"]

def list_records(app_token: str, table_id: str, token: str, sort_field: str = None):
    """获取一个表的所有记录（会自动处理分页）"""
    all_records = []
    page_token = ""
    while True:
        params = {"page_size": 500}
        if page_token:
            params["page_token"] = page_token
        
        # 添加排序参数，按照记录创建时间或指定字段排序
        if sort_field:
            params["sort"] = f'[{{"field_name":"{sort_field}","desc":false}}]'

        url = f"{BASE_URL}/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records"
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(url, headers=headers, params=params, timeout=30)
        r.raise_for_status()
        resp_data = r.json()
        
        if resp_data.get("code", 0) != 0:
            print(f"Error from Feishu API: {resp_data.get('msg')} (code: {resp_data.get('code')})")
            # 打印一些上下文帮助调试
            print(f"  → Request URL: {r.request.url}")
            print(f"  → App Token used: {app_token}")
            print(f"  → Table ID used: {table_id}")
            break

        data = resp_data.get("data", {})
        items = data.get("items", [])
        if items:
            all_records.extend(items)

        if data.get("has_more"):
            page_token = data.get("page_token")
        else:
            break
        time.sleep(0.2) # 避免频率超限
    return all_records

def download_feishu_file(url: str, token: str, table_name: str) -> str | None:
    """
    从飞书下载文件并保存到本地。
    返回可公开访问的 URL 路径。
    """
    if not url:
        return None

    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        with requests.get(url, headers=headers, stream=True, timeout=30) as r:
            r.raise_for_status()
            
            parsed_url = urlparse(url)
            file_token = parsed_url.path.split('/')[-2]

            content_disposition = r.headers.get('Content-Disposition', "")
            filename_match = re.search(r'filename="(.+)"', content_disposition)
            
            original_filename = ""
            if filename_match:
                original_filename = filename_match.group(1)
                # 确保文件名有扩展名
                if not pathlib.Path(original_filename).suffix:
                    content_type = r.headers.get('Content-Type', 'image/png')
                    extension = f".{content_type.split('/')[-1]}"
                    original_filename += extension
            else:
                content_type = r.headers.get('Content-Type', 'image/png')
                extension = f".{content_type.split('/')[-1]}"
                original_filename = f"download{extension}"

            # 清理文件名，防止路径问题
            safe_filename = re.sub(r'[\\/*?:"<>|]', "", original_filename)
            local_filename = f"{file_token}-{safe_filename}"
            
            table_image_dir = FEISHU_IMAGE_DIR / table_name
            table_image_dir.mkdir(exist_ok=True, parents=True)
            save_path = table_image_dir / local_filename
            
            with open(save_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                
                print(f"  → Downloaded {url} to {save_path}")
                
                return f"/images/feishu/{table_name}/{local_filename}"
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 403:
             print(f"  → Error 403: Forbidden to download file from {url}. "
                   f"Please ensure the app has 'drive:file:readonly' permission and the file is shared correctly.")
        else:
            print(f"  → An HTTP error occurred: {e}")
        return None

# === 2. 辅助函数 ===

def write_json_file(data: any, filename: str):
    """将数据写入指定的 JSON 文件"""
    outfile = SITE_DATA_DIR / filename
    outfile.parent.mkdir(parents=True, exist_ok=True)
    outfile.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    
    count_info = ""
    if isinstance(data, list):
        count_info = f" ({len(data)} items)"
    print(f"✔ Generated {outfile}{count_info}")

def fetch_records(table_key: str, token: str, sort_field: str = None) -> list:
    """根据 table key 获取一个表的所有记录"""
    table_info = TABLES[table_key]
    print(f"Fetching {table_info['cn_name']}...")
    records = list_records(table_info["app"], table_info["tbl"], token, sort_field)
    print(f"  → Fetched {len(records)} records.")
    return records
```

## 2.具体数据同步脚本：以 `sync_products.py`为例

其他模块这里就不再展示了。

```python
"""
同步飞书中的“商品信息”到本地的 products.json
"""

import feishu_common as fc

def transform_products(records: list, token: str) -> list:
    """
    转换商品数据。
    将飞书多维表格的原始记录列表，转换为网站所需的商品数据列表。
    """
    data = []
    for index, r in enumerate(records):
        f = r["fields"]
        
        # 下载图片并获取本地路径
        local_images = []
        if f.get("商品图片"):
            # 反转图片列表，让最新上传的图片排在最前面
            for img in reversed(f.get("商品图片", [])):
                if img.get("url"):
                    local_path = fc.download_feishu_file(img["url"], token, "product")
                    if local_path:
                        local_images.append(local_path)
        elif f.get("商品图片网址"):
            # 如果没有上传图片，则使用图片网址
            image_urls = f.get("商品图片网址", "").split(',')
            # 按录入顺序展示（不倒序）
            for url in image_urls:
                local_images.append(url.strip())

        # 将分类名称转换为slug格式
        category_name = f.get("商品分类", [{}])[0].get("text", "")
        category_slug = category_name.lower().replace(" ", "-").replace("&", "").replace(",", "").strip()
        
        data.append({
            "title": f.get("商品标题"),
            "tags": f.get("打标", []),
            "categorySlug": category_slug,
            "categoryName": category_name,  # 保留原分类名称用于显示
            "seo": {
                "title": f.get("商品标题title"),
                "keywords": ", ".join(f.get("商品keywords", [])),
                "description": f.get("商品详情"),
            },
            "slug": f.get("商品slug"),
            "images": local_images,
            "sku": f.get("货号"),
            "price": f.get("商品价格"),
            "details": f.get("商品详情"),
            "amazonLink": f.get("亚马逊购买链接"),
            "createdAt": index,  # 使用记录在列表中的索引作为排序依据，索引越大表示越新
        })
    
    # 按索引倒序排序，表格末尾（索引大）的商品在前面，实现最新商品在前
    data.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
    return data

def main():
    """主执行函数"""
    # 1. 获取 token
    token = fc.get_tenant_token()
    
    # 2. 提取 (Extract)
    product_records = fc.fetch_records("product", token)
    
    # 3. 转换 (Transform)
    products_data = transform_products(product_records, token)
    
    # 4. 加载 (Load)
    fc.write_json_file(products_data, "products.json")

if __name__ == "__main__":
    main()
```

## 3.Github Action 定期同步脚本

```yml
name: Sync Data from Feishu

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  sync_data:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          python3 -m venv .venv
          .venv/bin/pip install requests

      - name: Execute sync script
        env:
          FEISHU_APP_ID: ${{ secrets.FEISHU_APP_ID }}
          FEISHU_APP_SECRET: ${{ secrets.FEISHU_APP_SECRET }}
        run: bash ./scripts/sync_all.sh

      - name: Update deployment timestamp
        run: |
          echo "Last sync: $(date -u '+%Y-%m-%d %H:%M:%S UTC')" > LAST_SYNC.md
          echo "Workflow run: ${{ github.run_number }}" >> LAST_SYNC.md
          echo "Trigger: ${{ github.event_name }}" >> LAST_SYNC.md

      - name: Commit and push changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'Automated: Sync data from Feishu'
          file_pattern: 'src/data/*.json public/images/feishu/**/*.* LAST_SYNC.md'
          
```

Astro 模板的数据源改造等相关事宜这里就不再赘述，不同模板/项目的思路各不相同。
# 三、总结

**对于客户而言**，他们获得了一个无需任何技术背景、像编辑 Excel 一样直观的内容管理后台。增删商品、更换轮播图、调整网站文案，都只是在熟悉的表格里填填改改，学习成本几乎为零。

**对于我（开发者）而言**，前端（Astro）与数据源（飞书）完全分离。我只需要关心如何优雅地展示 JSON 数据，而无需为内容管理系统的开发、部署和维护操心。这种分工让整个项目的迭代和维护变得异常清晰和高效。

从最初用飞书管理个人书架，到现在支撑起了一个完整的电商网站，这套 飞书多维表格数据源+Github Action+Astro框架等静态站点的方案无疑展现了其高度的灵活性。它证明了我们可以利用手边成熟、易用的工具，通过一点胶水代码，创造出专业、稳定且对非技术人员极其友好的解决方案。

当然，虽然目前的方案已经能比较好地满足需求，但仍然有不少值得优化的方向：

## 1.实现增量同步与缓存机制

目前的同步脚本每次都是全量拉取所有数据，并重新下载所有图片。当商品数量和图片文件越来越多时，每次构建都会消耗不必要的时间和 GitHub Actions 的资源。在下载图片前，可以先检查本地是否已存在同名（基于飞书 `file_token` 生成的稳定文件名）的文件。如果存在，就跳过下载，直接复用本地路径。这是最容易实现的优化点。

## 2.强化系统鲁棒性，增加数据校验层

我们现在完全信任客户在飞书表格中输入的数据格式。如果客户不小心在价格字段填入了文本（如 `100元`），或者在必填项留空，可能会导致前端页面渲染出现小问题。可以在 Python 脚本的“转换 (Transform)”环节，引入 `Pydantic` 之类的库。为每种数据类型（如商品、分类）定义一个数据模型，明确字段类型、是否必填等规则。在转换后、写入 JSON 文件前进行校验，如果数据不合规，可以打印详细的错误日志，方便快速定位问题，甚至可以中止构建并发送通知。

## 3.这套 Python 脚本的设计能否更加优雅？

目前各表同步仍然依赖在Python中直接指定具体的分列；能否将其他的具体数据同步脚本实现 all in one，实现更优雅、更统一、更集中的数据保存机制？

## 4.引入 Webhook 实现实时更新

`cron` 定时任务虽然稳定，但不够实时。客户更新内容后，最长可能需要等待 24 小时才能在网站上看到效果，或者需要用户手动去触发 `workflow_dispatch`。可以利用飞书开放平台的事件订阅功能，配置一个 Webhook。当指定的飞书表格发生内容变更时，飞书会主动向一个指定的 URL（例如 GitHub Actions 的 `repository_dispatch` webhook 地址）发送通知，从而自动触发同步工作流，这将带来近乎实时的更新体验。
