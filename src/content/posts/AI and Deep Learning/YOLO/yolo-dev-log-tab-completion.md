---
title: YOLO 开发日志（二）：Tab 补全设计
published: 2025-12-27
description: "从obsidian-copilot-auto-completion汲取灵感，重新设计 YOLO 的 Tab 补全功能，实现掩码替代任务、智能触发机制和上下文边界检测。"
image: ""
tags: ["YOLO开发日志"]
category: 深度学习
draft: false
---
注 ：YOLO 最初的 Tab 补全功能非常不完善，1.4.10里的 tab 补全更新很大程度上是参考了[obsidian-copilot-auto-completion](https://github.com/j0rd1smit/obsidian-copilot-auto-completion) 的思路与功能设计，向开发者致敬！

首先，我们为什么需要 Tab 补全呢？

我认为，从笔记软件设计的角度出发，Tab 补全的核心价值就在于「减少打断」。当我们在写作时，思维是流动的，**任何需要我们停下来思考「接下来该怎么表达」的瞬间都会增添认知负担**。传统的 AI 写作助手（和 yolo 的其他模块设计）都需要你主动发起对话、等待响应、然后复制粘贴结果，而这个过程显然会打断写作的心流状态。

Tab 补全则不同，它会在你书写的间隙悄然出现，用淡灰色的幽灵文本提示可能的方向。满意就按 Tab 接受，不满意就继续打字，补全提示自动消失。整个交互过程非常的「轻」，几乎不会占用用户额外的注意力资源。
# Copilot auto completion 的设计哲学

在重新设计 YOLO 的 Tab 补全时，我从 [obsidian-copilot-auto-completion](https://github.com/j0rd1smit/obsidian-copilot-auto-completion) 中汲取了不少灵感。这里记录一下他们的核心设计思路，以及我做出的调整。

## 1.提示词设计：掩码替代任务

他们的提示词设计很有意思，将补全任务重新表述为「掩码替换」任务，系统提示词如下：

```
Your job is to predict the most logical text that should be written at the location of the <mask/>.
Your answer can be either code, a single word, or multiple sentences.
Your answer must be in the same language as the text that is already there.
Your response must have the following format:
THOUGHT: here, you reason about the answer; use the 80/20 principle to be brief.
LANGUAGE: here, you write the language of your answer, e.g. English, Python, Dutch, etc.
ANSWER: here, you write the text that should be at the location of <mask/>.
```

上下文则以 `<truncated_text_before_cursor> <mask/> <truncated_text_after_cursor>` 的格式传递给模型。举个例子：

```
Weighted average of (sequence) elements, with the weights dynamically computed based on an input query and elements' keys. 

The attention weight $a_i$ is calculated as follows:
$$
<mask/>
$$

In this formula we have the following components:
- Value: For each element, we have a feature vector per element we want to average over.
- Score function  $f_{score}(key, query)$: uses the queries and keys to calculate the weights per value. (Typically a simple similarity metric or MLP.)
- Attention weight $\alpha_i$: the amount of attention to put on value $i$.
```

这种设计的好处在于：模型不仅能看到光标前的内容，还能参考光标后的上下文来生成更贴合语境的补全。不过，以目前模型的能力，我觉得强制输出 `THOUGHT` 和 `LANGUAGE` 有些冗余了。所以我简化了提示词：
```
Your job is to predict the most logical text that should be written at the location of the <mask/>. Your answer can be either code, a single word, or multiple sentences. Your answer must be in the same language as the text that is already there. Your response must have the following format: 
ANSWER: here, you write the text that should be at the location of <mask/>.
```

程序只需识别 `ANSWER:` 之后的内容即可，既减少了 token 消耗，响应也更快。

## 2.触发机制

相比之前 YOLO 「停止输入 N 秒后触发」的粗放策略，Auto Completion 采用了更精细的触发器设计。

插件内置了多种触发场景：
- **句子结束**：`.` `!` `?`
- **换行符**：`\n`
- **列表或任务项**：如 `-` 或 `- [ ]` 之后
- 等等

在此基础上，用户可以编辑、移除默认触发器，或添加自定义触发器。每个触发器支持两种匹配模式：
- **字符串匹配**：检查光标前的文本是否以该字符串结尾
- **正则表达式匹配**：检查光标前的文本是否匹配该正则

# YOLO的设计思路

YOLO 的 Tab 补全在继承 Auto Completion 核心理念的基础上，做了一些调整和扩展。
## 提示词：保留掩码，开放约束

YOLO 保留了掩码替代任务的核心思路，但做了两处改动；首先是简化输出格式。现代模型已经足够聪明，不需要强制输出 `THOUGHT` 和 `LANGUAGE` 字段，直接要求输出 `ANSWER:` 即可。程序解析时只需找到这个标记，提取后面的内容：

```typescript

const parseMaskedAnswer = (raw: string): string => {

const normalized = raw.trim()

const markerIndex = normalized.toLowerCase().indexOf('answer:')

if (markerIndex === -1) return normalized

return normalized.slice(markerIndex + 'answer:'.length).trim()

}

```

  其次是引入约束占位符 `{{tab_completion_constraints}}`。用户可以在设置中填写自定义规则，比如「不要使用 emoji」「保持简洁」「用正式语气」等，这些规则会被注入到系统提示词中。

## 触发机制：继承与本地化

  YOLO 完整继承了 Auto Completion 的触发器架构。默认配置中，除了换行符和列表项这些通用触发器外，还增加了中文逗号 `，` 和中文冒号 `：` 的支持，毕竟 YOLO 的主要用户群体（也就是我）是中文用户。

  TAB 补全的触发机制是遍历所有启用的触发器，检查光标前的文本是否匹配。字符串类型的触发器用 `endsWith` 判断，正则类型的用 `test` 判断。用户可以在设置中自由编辑、禁用或添加触发器，实现完全的个性化控制。
## 上下文处理：智能边界检测

这是 YOLO 相对于 Auto Completion 的另一个改进：在提取上下文时，YOLO 不会简单地截取固定长度的文本，而是会识别文档结构边界。默认的上下文范围是 4000 字符，按 4:1 的比例分配给前文和后文（3200 + 800）。这个比例的考量是：**前文对于理解当前写作意图更重要，而后文主要用于确保补全内容与后续段落衔接自然**。

在此基础上，YOLO 引入了后文边界检测，程序会识别段落分隔（连续两个换行）、标题、列表、引用块、代码块等 Markdown 结构。一旦遇到这些边界，就会截断后文上下文。这样做的好处是：模型看到的后文更加「干净」，不会被无关的段落干扰。比如你正在写一个段落的中间部分，模型不需要看到下一个章节的内容。

```typescript

const boundaryPatterns = [

/^#{1,6}\s/, // 标题

/^-\s+\[[ xX]\]\s+/, // 任务列表

/^[-*+]\s+/, // 无序列表

/^\d+\.\s+/, // 有序列表

/^>\s+/, // 引用块

/^```/, // 代码块

]

```

## 写在最后

回顾这次 Tab 补全的重构，其核心思路很简单：**让 AI 辅助写作可以可靠地回归「辅助」的本质**。

YOLO 的其他功能和传统的 AI 写作工具总是试图抢夺用户的注意力——弹窗、对话框、复制粘贴，每一步都在提醒用户「嘿，我是 AI，我在帮你」；但在 tab 补全的使用场景下，ai 应该是隐形的，在用户需要时出现，不需要时消失，全程不打扰用户的思考节奏：淡灰色的幽灵文本悄悄浮现，一个 Tab 键决定去留。

当然，目前的实现还有很多可以优化的空间。比如触发时机的智能化（能否根据写作速度动态调整？）、补全内容的多样性（能否提供多个候选项？）、以及与其他 YOLO 模块的联动（能否结合知识库做更精准的补全？）。这些都是后续值得探索的方向。

感谢 [obsidian-copilot-auto-completion](https://github.com/j0rd1smit/obsidian-copilot-auto-completion) 提供的灵感，站在前人的肩膀上确实能看得更远。如果你在使用 YOLO 的 Tab 补全功能时有任何想法或建议，欢迎反馈。毕竟一个人的使用场景终究有限，而好的工具是在真实需求中打磨出来的。

下一篇日志，我可能会分析一下目前主流的 agent loop 的实现方式与架构，以及 YOLO 在这方面的探索。agent loop 是当下 AI 应用开发中相当热门的话题，从 LangChain 到 BMAD，各种框架层出不穷，但说实话，很多实现都过于复杂，把简单的事情搞得晦涩难懂。

我想从一个更务实的角度来拆解这个问题：一个好用的 agent loop 到底需要什么？工具调用、记忆管理、错误恢复、任务拆解……这些听起来高大上的概念，落到代码里其实就是几个核心的设计决策。YOLO 作为一个 Obsidian 插件，场景相对垂直，反而有机会避开那些「为了通用而通用」的设计陷阱，做一些更贴合实际写作场景的尝试。

不过这个话题展开起来内容不少，今天就先写到这里。有兴趣的朋友可以先看看 Anthropic 的 [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) 这篇文章，写得非常扎实，是我目前看到的对 agent 设计讲解最清晰的文章之一。