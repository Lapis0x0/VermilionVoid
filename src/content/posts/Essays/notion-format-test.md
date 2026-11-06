---
title: "格式测试"
published: 2026-11-06
description: "Notion 同步格式测试"
image: ""
tags: ["测试"]
category: "随笔"
notion_id: 410d999d-3210-81be-b8ad-d50162f514c9
---

这是一篇用来测试同步效果的草稿。普通文字、<strong>加粗</strong>、<em>斜体</em>、<del>删除线</del>、`行内代码`、<a href="https://www.lapis.cafe/">链接</a>，还有行内公式 $E=mc^2$ 和价格 \$5 这种裸美元符号。

文字颜色：<span class="nt-red">红色</span>、<span class="nt-blue">蓝色</span>、<span class="nt-green">绿色</span>；背景高亮：<span class="nt-bg-yellow">黄色背景</span>、<span class="nt-bg-red">红色背景</span>。

## 提示框

:::note
这是一个灰色的提示框，默认当作 note。
:::

:::caution
这是一个红色的警告提示框。
:::

## 折叠

<details class="nt-toggle">
<summary>点开看看</summary>

折叠块里的内容，可以有多段。

- 也可以有列表

</details>

### 可折叠的标题

可折叠标题下面的内容。

## 分栏

<div class="nt-columns">

<div class="nt-column">

<strong>左栏：观点 A</strong>

左边写一些内容。

</div>

<div class="nt-column">

<strong>右栏：观点 B</strong>

右边写一些内容。

</div>

</div>

## 嵌套列表与颜色

- 第一层
  - <span class="nt-red">第二层，红色</span>
    - <span class="nt-bg-blue">第三层，蓝色背景</span>
1. 有序一
2. 有序二
   1. 有序二点一
- [ ] 待办：未完成
- [x] 待办：已完成

## 引用

> 引用的第一段。
>
> 引用里套的第二段。
>
> - 引用里的列表

## 公式与代码

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

```python
def hello():
    print("hi")
```

| 指标 | 数值 |
| --- | --- |
| 准确率 | 92.3% |

---

<p class="nt-bookmark"><a href="https://www.lapis.cafe">https://www.lapis.cafe</a></p>

<figure class="nt-figure">
<img src="https://www.lapis.cafe/avatar.webp" alt="图片说明文字" loading="lazy" />
<figcaption>图片说明文字</figcaption>
</figure>
