---
title: 模型考古学（五）：Minimax-01 模型技术报告简读
published: 2025-03-22
description: "本篇博客简要解析了 Minimax-01 模型的架构设计，聚焦其在超长上下文处理中的性能表现与混合注意力机制的技术实现。"
image: "https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202503221522122.png"
tags: ["模型考古学"]
category: 深度学习
draft: false
---

DeepSeek V3刚出那会就想专门写篇解读博客了，但一直摸到现在，我寻思再不写的话Qwen3和Ds v4都快出了，当懒狗开摸也得有个限度对伐。

# Minimax-01模型亮点：Lightning attention加持下的百万上下文窗口

![](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202503221522122.png)

先放一个模型的跑分表，可以看到Minimax 01尤其在超长上下文领域表现优秀，随着上下文长度的增加，其模型性能衰退的速度是所有长上下文模型里最缓慢的。

## 1.Transformer架构模型的固有缺点——上下文增加带来计算复杂度的二次增长

我们都知道Transformer的核心机制是**自注意力机制(Self-Attention)**，它在每一层都要对输入序列的每一个token与其他所有token进行交互，这就导致了如下计算复杂度：

$$
O(n2⋅d)

$$

- $n$：输入序列的长度（即上下文长度）
- $d$：表示维度（一般为隐藏层维度）

当上下文长度n增加时，计算复杂度会按照 $n^2$ 的速度增长，注意力机制如此设计会导致随着上下文长度增加，如从1k tokens到8k、32k乃至于1M，对应的资源需求也会暴涨。注意力矩阵为 $n^2$ ，那么32k tokens就是一个32000*32000的矩阵，占用显存极大；训练中每一步都要进行 $n^2$ 次乘法运算，训练/推理速度也会大幅下降。

由此，Transformer一开始其实并不擅长原生建模如长文档、代码、大型图数据等长序列模型。

那么，之前学术界的解决办法都有哪些呢？

> To address this challenge, researchers have proposed various methods to reduce the computational complexity of the attention mechanism, including:
> 
> - **Sparse Attention** (Beltagy et al., 2020; Zaheer et al., 2020)
> - **Linear Attention** (Qin et al., 2022a, 2022b, 2024c)
> - **Long Convolutions** (Qin et al., 2023a)
> - **State Space Models** (the Mamba series) (Dao and Gu, 2024; Glorioso et al., 2024; Gu and Dao, 2024; Ren et al., 2024; Team et al., 2024b)
> - **Linear RNNs** (Qin et al., 2023b, 2024d)
> 
> Despite their theoretical promise, these innovations have seen limited adoption in commercial-scale models.
> 

英译中就是方法有稀疏注意力、线性注意力、长卷积、状态空间模型（如Mamba系列）还有线性RNN等。

### （1）稀疏注意力（Sparse Attention）

代表工作：

- Beltagy 等人（2020），提出了 Longformer
- Zaheer 等人（2020），提出了 Big Bird

> 大鸟转转转，启动！
> 

传统注意力机制中，所有位置（token）的两两交互都需要计算相似度，导致计算和显存开销随序列长度 n 呈平方关系。稀疏注意力的核心思路是只让部分位置之前进行注意力计算，使注意力矩阵变得稀疏，从而显著降低复杂度。Longformer采用局部窗口（local window）和全局token（global tokens）相结合的稀疏模式，而 Big Bird 则在此基础上结合随机稀疏和环状全局连接（circular patterns）。这类方法可以将复杂度降低到 $O(n)$ 或 $O(n log n)$ ，在长序列任务如文档级自然语言理解、长序列生成等方面具有一定优势。

稀疏注意力主要优势在于在长序列上显著减少计算量和内存占用，在对局部上下文比较敏感（比如文档摘要）的任务中效果通常较好。但这个架构下的稀疏模式需要精心设计，不同任务需要不同的稀疏结构，在捕获远程依赖（long-range dependency）时，依旧存在可能覆盖不足的隐患。

### （2）线性注意力（Linear Attention）

**代表工作**：

- Qin 等人（2022a,b, 2024c）等

线性注意力旨在将原本 $O(n²)$  的注意力操作近似或重构为 $O(n)$ 或  $O(n d)$ ，其中d通常为特征维度，其理论基础常是对 softmax 或其他核函数进行低秩近似、核化技巧（kernel trick）或因式分解。

典型实现包括：

- **Performer**：通过随机特征映射（Random Feature Mapping）将 softmax 转换为可分解的向量乘积形式。
- **Linear Transformers**：使用可分解核函数将注意力矩阵分解，从而线性地累积和计算上下文信息。

这种工程方法的优点是理论复杂度大幅下降，易于在较长序列上进行扩展，减轻硬件压力，但一些线性化近似在准确性和稳定性上仍有挑战，尤其是当分布非常复杂或软注意力分布较尖锐时，逼近效果可能不如标准注意力。在实际大规模预训练模型中，线性注意力可能面临数值稳定性和收敛速度等问题，需要对训练流程进行专门调优。

### （3）长卷积（Long Convolution）

**代表工作：**

- Qin 等人（2023a）

基于卷积的模型通常具有平移不变性和高效的局部特征提取能力，且在硬件上（尤其是 GPU、TPU）高度可并行化。为应对长序列建模的需求，研究者引入了“长卷积”思想，即在传统卷积核的基础上通过扩张卷积（dilated convolution）、分段卷积或分块交互等方式来建模长距离依赖。与稀疏注意力相似，长卷积通过结构化地控制感受野的扩张，使得模型在捕获远距离依赖的同时保持较低的计算复杂度（通常在 $O(n) ～ O(n log n)$ 范围）。

优点是卷积对于局部模式和相对位置信息建模具备先验优势，但对特别远程的依赖可能需要较深网络或技巧性设计，效果不一定优于稀疏注意力；长卷积内核的设计和超参数设置往往比较复杂，模型大小也可能随之增加。

### （4）状态空间模型（Manba系列）

**代表工作**：

- Dao 和 Gu（2024）
- Glorioso 等人（2024）
- Gu 和 Dao（2024）
- Ren 等人（2024）
- Team 等人（2024b）

非常好Manba，使我的长序列问题out，腾讯用了都说好！

在序列建模中，**状态空间模型**（State Space Model, SSM）是一类将输入序列映射到隐状态空间再输出的模型，对应一个线性微分方程（或离散差分方程），能够以 O(n) 的复杂度表征长序列依赖。S4、Mamba 系列等模型通过对状态方程的谱域或时域进行高效求解，让网络对输入序列做卷积式或近似卷积式的处理，从而在理论上实现对数千甚至上万长度序列的高效建模。

优点：

- **改进隐状态更新和输出映射**，使得训练和推理更稳定；
- **结合特定任务特征**（如语言建模、时序预测、语音处理等），在保持线性复杂度的同时兼顾表达能力。
- 在捕捉长程依赖时，复杂度可保持在 O(n)，理论上可支持超长序列。
- 采用隐状态更新的方式，有利于在序列处理中与 RNN 等架构兼容，也方便硬件流水线加速。

潜在局限性：

- 对大规模预训练语言模型的适配仍在探索中，实际落地需要考虑与自回归生成、上下文并行等机制的兼容性。
- 模型超参数（如状态维度、离散化方式）选择不当时，可能导致优化不稳定或泛化性能欠佳。

### （5）线性RNN（Linear RNN）

**代表工作**：

- Qin 等人（2023b, 2024d）

传统 RNN（如 LSTM、GRU）在长序列建模中往往面临梯度消失或爆炸的问题，而且在推理时大多只能顺序执行，难以并行。线性 RNN 方法则尝试对循环结构中关键的非线性部分进行线性化，或者通过特定的核函数、矩阵分解，将状态更新变得更加稳定且易于并行化，最终在理论上能实现近似的 O(n) 训练和推理效率，同时减轻梯度消失。

与状态空间模型类似，此类方法核心在于对“循环”结构的改造，追求在大规模数据下更加可训练、可扩展，从而为长序列任务提供一种更轻量级的替代方案。

**主要优点**

- 保留 RNN 的时序依赖机制，避免大规模全局注意力的高内存开销。
- 相比标准 RNN 更易训练，并能部分并行化，推理延迟也较小。

**潜在局限**

- 在捕获复杂的跨句或篇章级依赖时，可能仍不及注意力机制灵活。
- 线性化的近似方式需要平衡模型容量和稳定性；训练大规模模型时的数值问题和优化策略仍有待进一步研究。

Minimax最后做了个总结，尽管这些创新在理论上颇具前景，但在商业规模模型中的应用仍然有限。

那么，Minimax的解决方法是什么呢？他们确定了一种混合架构，主要使用基于 **线性注意力（Linear Attention）** 变体的 **闪电注意力（Lightning attention）** Qin 等人（2024b），该架构中，每七个使用 **Lightning attention** 的Transformer块之后都会跟随一个使用Softmax Attention的Transformer块。

Minimax 01采用了MoE架构，最终参数为456b，激活459亿，共32个专家。

![](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202503221757601.png)

新模型在长上下文场景下的响应延迟也非常不错。

## 2.注意力架构设计简析

> 该架构中，每七个使用Lightning attention的Transformer块之后都会跟随一个使用Softmax Attention的Transformer块
> 

我们知道Softmax Attention通常指的是Transformer及其变体中使用的“标准自注意力机制”，也被称为**Scaled Dot-Product Attention**。这一机制在每个注意力头的计算中，会对查询（$Q$）和键（$K$）之间的相似度采用点积后再使用Softmax函数归一化，以得到注意力权重，然后将权重作用在对应的值向量（$V$）上。其核心公式可写作：

$$
Attention(Q,K,V)
= \text{softmax}\!\Bigl(\frac{QK^\mathsf{T}}{\sqrt{d_k}}\Bigr)\,V
$$

在训练和推理时，**Softmax Attention** 机制最主要的计算瓶颈在于其注意力矩阵（$\text{softmax}\!\Bigl(\frac{QK^\mathsf{T}}{\sqrt{d_k}}\Bigr)$）的大小通常是随序列长度 nn 呈二次增长（$O(n^2)$），这会导致当序列较长时开销非常大。这么做的优势是能够对序列任意两位置（token）的交互进行“显式”建模，对长程依赖的捕捉更全面、表达能力较强。所以在通常的普遍的大语言模型中，**Softmax Attention** 仍被广泛采用，成为 Transformer 结构模型的核心。

而Minimax 01为了兼顾超长上下文+经济的资源占用，采用了**在大部分 Transformer 块中使用线性注意力（Lightning attention），但仍定期插入少量 Softmax Attention 块**的工程方法。

> 线性注意⼒确保了恒定的计算复杂度𝑂(𝑑)，不受序列⻓度影响。这是通过循环更新项 KV 实现的，从⽽避免了重复计算整个注意⼒矩阵的需要。相⽐之下，softmax 注意⼒在推理过程中会产⽣𝑂(𝑛𝑑)的复杂度。
> 

> 线性注意力既可以在一次整段前向计算中是$O(n)$ 级别，也能够在自回归场景下进一步将每步的边际开销缩减到仅$O(d)$。
> 

> Minimax团队在实验过程中发现Lightning attention机制在检索能力上表现有限，启发了他们探索采用一种混合方法（Hybrid-Lighting），结合了Lightning attention 和 Softmax Attention 二者的优势，通过每隔⼋层⽤ softmax 注意⼒替换闪电注意⼒来提升检索性能。
> 

> 虽然纯线性注意力模型在计算上高效，但他们并不适合LLMs。这是因为他们本质上无法执行检索，而检索能力对于上下文学习至关重要。
> 

这是Minimax-text-01的架构图：

![](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202503221816516.png)

虽然线性注意力（包括各种近似或低秩方法）虽然在理论和实验中大幅降低了计算复杂度和显存占用，但其对注意力分布的近似在某些场景下会带来表达损失，尤其是对长程依赖或分布较尖锐的注意力模式可能刻画得不够精细。插入少量的 Softmax Attention 块可以弥补这一局限，让模型仍能捕捉到更复杂或更细腻的依赖结构。另一方面，如果所有模块都使用标准的 Softmax Attention，则 O(n²) 的注意力机制在长序列场景下会带来巨大的硬件与时间成本。

因此，在大多数块中使用近似快速的注意力机制，只在一定间隔（例如每 7 个块）使用完整的 Softmax 注意力，就成为了一种工程上的“折衷方案”——既维持了大部分模块的高效性，也让模型在必要的层次仍保留了较高保真度的注意力计算。

**让我们看一下不同架构的模型参数与 FLOPs ⽐较：**

![](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202503221826650.png)

已知常见符号含义如下：

- $b$：批大小（batch size）
- $n$：序列长度（sequence length）
- $l$：网络层数（number of layers）
- $d$：隐层维度（hidden dimension）
- $h$：注意力头数（number of attention heads）

参数量方面，三种注意力机制相比，Softmax最简单只有 $12ld^2$；Lightning和Hybrid则多一些关于 $d^2/h$ 的额外项，表明线性或混合注意力需要一部分核映射或门控参数。

FLOPs（运算量）：

- **Softmax** 随着序列长度 $n$ 增加会显著抬升，因为注意力部分是 $O(n^2)$（表格中则以$\tfrac{n}{6\,d}$的方式体现出依赖程度）。
- **Lightning** 避免了对 $n$ 的直接依赖，主要受注意力头数 $h$ 的影响，因此在长序列场景下运算量增幅更小。
- **Hybrid‐lightning** 介于两者之间：相对于纯 Lightning，多了一些与序列长度和注意力头数相关的运算成本，但通常比全部 Softmax Attention 要更高效；同时能在一定程度上保留 Softmax 的高保真注意力。

:::note
这张表格应该可以很清晰地显示不同技术路径的性能消耗区别了。模型规模越大，Lightning Attention 与 Hybrid-lightning 相对于 softmax 注意力的优势就越明显。
:::

![](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202503221933903.png)

> 技术报告显示，Lightning attention 在大多数下游任务中表现出与 Transformer 模型相当的性能，除了 NIAH。这表明线性注意力在语言建模能力上与 Transformer 模型相似，但在检索任务上表现不佳，使其不适合于大规模语言模型（LLMs）。然而，Hybrid Lightning attention 不仅匹配了 softmax attention 的检索和外推能力，还超越了其表现，因而非常适合在 LLMs 中进行上下文学习。
> 

> Softmax 注意力机制可解释为一种线性 RNN（Qin 等人，2024a）。在每个时间步 $t$ 从初始时间 $t=1$开始，重新计算隐藏状态的过程常被比喻为“翻阅书籍”。该方法通过系统地回顾先前数据，使模型能够准确保留输入信息。相比之下，线性模型缺乏这种重新计算过程，这限制了它们有效保留输入数据的能力。
> 

![](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202503221934775.png)

Hybrid Lightning Attention实现了与序列⻓度⽆关的恒定训练速度，并且是唯⼀⼀个性能超过FlashAttention2 的线性模型。

## 3.总结

Minimax本次的研究成果还是非常惊艳扎实的，从整体看，他们本次主要面向「如何在保证模型表达能力的同时控制计算资源消耗」做了扎实的探索，没有选择一味追求极致高效的线性模型（比如全 Lightning attention），也没有保守地坚持全 Softmax 架构，而是走出了一条 **工程实用主义导向的“混合注意力路径”**。

此外，Minimax Text-01 模型在架构设计上采用了 **分层结构+MoE（专家路由）机制**，进一步压缩推理成本，增强了模型在多任务、多语境下的适应能力。最终呈现出的表现，是一种**理论创新与工程可行性高度融合的成果**。

当然，目前包括 Hybrid Lightning 在内的各类长上下文解决方案仍存在很多值得继续探究的问题，比如：

- 如何进一步提升线性 attention 机制下的对齐能力与泛化性？
- Softmax block 的插入策略是否存在更优设计（例如动态插入、任务自适应等）？
- 面对极端长文本（如百万字级文档、代码库、视频字幕等），模型的训练稳定性和学习效率是否仍然可控？

在论文结尾，他们注明了未来的研究方向之一：

> 当前模型保留了 1/8 的组件，采⽤标准 softmax 注意⼒机制。我们正在研究更⾼效的架构，以期完全消除 softmax 注意⼒，从⽽可能实现⽆计算开销的⽆限上下⽂窗⼝。
> 

如果无计算开销的无限上下文窗口模型真给他们做成，那未来复杂市政 Agent 系统、跨文件级代码自动修复、长篇对话连续推理、甚至真实世界记忆能力的 LLM 构建等等场景都可以想象乃至初步落地了。

:::note
下一篇估计会简读DeepSeek V3和R1的技术报告
:::