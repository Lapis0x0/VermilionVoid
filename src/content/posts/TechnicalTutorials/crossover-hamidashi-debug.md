---
title: MacOS使用Crossover&Wine运行Galgame（常轨脱离）崩溃解决记录
published: 2025-04-23
description: "本篇记录了在 Apple Silicon Mac 上使用 Crossover（Wine）运行 Galgame《常轨脱离》时遭遇白屏崩溃的排查与解决全过程。详尽分析了 WVC1/WMA 解码失败背后的多媒体依赖问题，并通过安装 DirectShow Filters 成功修复。适合所有在 macOS 上尝试跑 Windows 游戏的折腾型玩家参考。"
image: "https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/iShot_2025-04-23_22.00.00-tuya.webp"
tags: []
category: 技术教程
draft: false
---

:::note
2025年9月18日更新：因为 crossover 似乎下架了 DirectShot Filters,以下内容是可能的其他替代方案
:::

有读者反馈说之前的 **DirectShow Filters** 安装项已经不见了。这大概率是因为 CrossOver 每次大版本升级时，都会清理或调整一些老旧或维护成本高的组件库。

不过，目前 CrossOver 仍然保留了一个官方支持的 **“DirectShow (x86)” 配方**，大家可以优先尝试安装，看是否能解决游戏的解码问题；以下是两个可能的替代方案：

### ✅ 替代方案一：手动安装 LAV Filters（x86）

[LAV Filters](https://github.com/Nevcairiel/LAVFilters) 是一套广泛使用的 DirectShow 解码器，对很多老游戏来说足以满足播放视频的需求。

**安装步骤：**

1. 下载 LAV Filters 安装包（注意选择 **32-bit / x86** 版本，文件名里一般带有 `LAVFilters`）；
2. 打开 CrossOver，选中目标 Bottle，点击「安装未列出的程序」，导入安装包进行安装；
3. 安装完成后，直接尝试启动游戏。

**如仍无法播放，可额外检查库优先级：**

1. CrossOver → 目标 Bottle →「运行命令」，输入 `winecfg`；
2. 打开 Wine 配置，在「Libraries（库）」页面添加以下两项并设为 `native, builtin`：

   * `quartz`
   * `devenum`
3. 保存设置后重新尝试游戏。

### ✅ 替代方案二：安装 K-Lite Codec Pack Basic（x86）

这是一个整合了常见解码器的经典 codec 包，适合直接梭哈：

**安装步骤：**

1. 同样通过「安装未列出的程序」方式，在 Bottle 中安装 **K-Lite Codec Pack Basic（x86）**；
2. 安装过程保持默认设置即可（不建议勾选过多组件）；
3. 安装完成后先试运行游戏，如仍无效，再按上方 `winecfg` 步骤设置 `quartz` 和 `devenum`。

> ☑️ **优点**：成功率较高，组件齐全；
> ⚠️ **缺点**：比 LAV Filters 稍重，极少数程序可能出现解码器冲突（很罕见）。

### 🧵 最后手段：考虑用虚拟机运行原生 Windows

如果上述方法都未奏效，建议直接使用虚拟机（如 [Parallels](https://www.parallels.com) 或 [UTM](https://mac.getutm.app/)）运行 Windows 10 ARM 版。对部分 DRM 或复杂解码需求的老游戏来说，这往往是最稳妥的方案。

如果你在 Mac 上用 CrossOver 玩老游戏，也碰到视频无法播放的问题，欢迎留言交流。如果有新的解决办法或踩坑记录，我也会继续补充在这篇文章下方。



>你家族有精神病史吗？
>
>我有个叔叔买MAC打游戏。

今天刚把PC主机寄走，想着趁空档把之前没玩完的Galgame《常轨脱离》拷到Mac上，用 Crossover（其实就是 Wine 的商用壳）继续补完进度，但结果在crossover里启动游戏后却连主菜单都没看到直接白屏然后哐哐一堆报错。

一开始我以为是路径错了、容器设置有问题，甚至还试了装 DXVK、换 Windows 版本、切字体，但全都没用——白屏照旧，报错日志倒是越来越长。

在谷歌和Gemini老师的帮助下，我终于排查出了问题：《常轨脱离》在启动时会尝试加载一段视频（也就是主菜单的那段），**而这段视频用了 WVC1 编码的视频流 + WMA 编码的音频流**，也就是 Windows 系统里常见的那套多媒体格式组合。

问题就出在这里了——**Wine 本身虽然能模拟 Windows 环境，但它并不包含这些视频/音频的解码器，而是试图调用 macOS 端的 GStreamer 插件来替代**。可惜的是，Mac 默认根本不支持 WVC1 和 WMA，更别提我这台是 Apple Silicon 架构，很多 GStreamer 插件还得自己编译，直接完蛋。

本篇博客将记录我的排查和解决流程，给诸位不畏艰难在Mac上折腾Galgame的朋友们留个参考。
# 一、遇到的问题：启动即为崩溃，错误代码 c0000005

我是用的设备是2020年的MacBook air M1， macOS Sonoma 系统，CrossOver 版本是 24.0.7。在一个新建的 Windows 10 (64位) Bottle 环境中安装了汉化版的 hamidashi_cn.exe。但每次运行程序，往往在加载界面、播放片头动画 (OP) 或刚进入主菜单时，程序就会直接崩溃退出，没有任何明确的错误提示框。

为了弄清原因，我启用了 CrossOver 的日志记录功能。在冗长的日志文件 (+seh +tid +process +debugstr) 和G老师的帮助下，我发现了关键信息：
1. **GStreamer 报错：** 日志中反复出现 winegstreamer error: decodebin1: Your GStreamer installation is missing a plug-in. 的错误，并且明确指出缺少 Windows Media Video 9 (video/x-wmv, wmvversion=(int)3, format=(string)WVC1) 和 Windows Media Audio (audio/x-wma, ...) 的解码器 (decoder)。
2. **致命错误：** 紧随 GStreamer 错误之后，出现了 EXCEPTION_ACCESS_VIOLATION exception (code=c0000005) 的错误，表明程序试图访问无效内存，导致崩溃。地址指向了与多媒体处理相关的模块。

# 二、分析原因，解决问题

结合日志信息，问题就很明显了：
- 游戏需要播放使用 WMV (WVC1) 视频编码和/或 WMA 音频编码的媒体文件（很可能是片头 OP 或背景音乐 BGM）。
- Wine/CrossOver 默认尝试使用 macOS 系统自带的多媒体框架 GStreamer 来解码这些文件。
- 但是，我的系统环境缺少处理这些特定编码所需的 GStreamer 插件，或者存在架构不匹配的问题（我的程序是 32 位的，而 Homebrew 安装的 GStreamer 插件是 arm64 的）。
- 解码失败导致 Wine 内部处理多媒体播放的代码出错，最终引发了 c0000005 访问冲突，程序崩溃。
## 1.尝试：安装系统级 GStreamer 插件
根据错误提示，我首先想到的解决方案是为 macOS 安装缺失的 GStreamer 插件。我打开终端，使用 Homebrew 执行了：`brew install gst-plugins-ugly gst-plugins-bad gst-libav`，安装确实顺利，但重启crossover之后问题依旧，甚至日志都和之前的一模一样。Crossover似乎没有能力正确调用这些系统级的 arm64 插件来处理 32 位的 Windows 程序请求。

>当然我毕竟不是这方面的专业人士，这只是我的猜测（

## 2.尝试：修复安装 Wine 的多媒体组件

既然系统级的不行，那我们可以把目光转向Wine环境（也就是 CrossOver 的 Bottle）内部模拟 Windows 原生的解码能力。Windows 处理这些媒体格式主要依赖 **DirectShow** 框架。

一开始，我听从G老师的建议安装了Windows Media Player 10（WMP 10）。确实，这理论上应该能一劳永逸地解决所有 Windows Media 相关的解码问题。但在 CrossOver 的“安装 Windows 应用程序”里找到 WMP 10 并尝试安装后，过程并不顺利，弹出了若干错误提示，似乎是 WMP 10 的某些依赖组件在 Wine 环境下无法正确安装或注册。最终结果就是——安装失败，游戏启动依然白屏报错。

在检索后，我发现 **DirectShow Filters** 也能满足游戏的组件需求。这次的下载安装过程就非常顺利：在 CrossOver 对应容器“安装软件”中选择“DirectShow Filters”，一键安装完成，不需要额外配置、不需要自己找 DLL，也没有出现之前 WMP 安装时那种依赖冲突或组件注册失败的问题。

![泪目](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/iShot_2025-04-23_22.00.00-tuya.webp)
>泪目，终于顺利进游戏了

>最终结果当然也是游戏顺利启动并渲染，直到现在都没有碰到过任何报错。

# 三、Wine的原理是什么？

## 1.Wine 不是模拟器，而是翻译器

首先，很多人会有一个常见的误解：Wine是虚拟机或模拟器。

那你猜猜Wine的全名是什么？

实际上，Wine就是“**Wine Is Not an Emulator**”（Wine不是模拟器）的缩写，**Wine不是在模拟一个完整的 Windows 系统环境**，它的本质是把 Windows 应用的系统调用（System Calls）**实时翻译**为宿主系统（这里是 macOS）的本地调用。比如你调用了 `CreateFileA`，Wine 就会把这个 API 翻译成 Unix 的 `open()` 或 macOS 的相关系统调用。

这种设计理念非常聪明，也非常“极限压榨资源”，因为它不需要虚拟 CPU、内存、驱动、内核。理论上运行效率极高，启动快，内存占用低。

但，代价也**极其明显**：
>它必须 **准确复现海量 Windows API 行为和子系统逻辑**，哪怕是一些没人用的陈年旧接口也得想办法“魔改”兼容。

在M系列的MacBook上，情况还会更复杂。Windows 程序通常是为 x86/x64 架构编译的，而 M 芯片是 ARM 架构。这里需要苹果的 **Rosetta 2** 转译层先介入，将 x86/x64 指令实时翻译成 ARM 指令，让 CPU 能够执行程序代码。然后，Wine 再在这个基础上进行 Windows API 到 macOS API 的翻译。这等于是在一个翻译层 (Rosetta 2) 之上又叠加了另一个翻译层 (Wine)。

## 2.为什么Wine/CrossOver问题这么多？

理解了基本原理，我们就能更好地理解为什么用 Wine 跑 Windows 程序时会遇到各种问题。

首先， Windows API 是一个极其庞大、历史悠久且充满“黑魔法”（未公开或非标准用法）的系统。Wine 项目需要通过逆向工程和文档研究，一点点地重新实现成千上万个 API 函数及其各种行为和边缘情况。这必然是一个**持续进行且永远无法达到 100% 完美兼容**的过程。很多程序的崩溃或功能异常，就是因为它调用了 Wine 尚未实现、实现有误或行为与原生 Windows 不完全一致的 API。

>这就是屎山代码，听巨硬说

在API之上，Windows程序通常依赖于大量的动态链接库 (DLL)。这包括：
- **系统核心 DLL：** 如 kernel32.dll, user32.dll, gdi32.dll 等，Wine 会提供内建的替代实现。
- **运行时库：** 如 Visual C++ Runtimes (msvcr*.dll, vcruntime*.dll), .NET Framework 等。Wine 可能需要用户手动安装这些（通过 Winetricks 或 CrossOver 的内建安装器）。
- **特定功能库：** 如 DirectX (d3d*.dll, dinput*.dll), Media Foundation (mf*.dll), DirectShow (quartz.dll) 等。Wine 要么提供内建实现（可能不完整），要么需要安装原生版本。
- **程序自带的 DLL。**  
    管理这些依赖关系非常复杂。版本冲突、DLL 丢失、注册不正确等问题都可能导致程序无法运行。**我遇到的 WVC1/WMA 解码问题，本质上就是缺少了提供特定解码功能的原生 DirectShow Filter DLL 依赖。**
这还没完，我们打游戏的画面需要通过图形API来进行渲染，好死不死这里也是一大坨问题。 
**Windows 游戏大量使用 DirectX**，**在 macOS 上，图形 API 主要是 Metal (较新) 和 OpenGL (较旧)** ，这就需要 Wine 需要将 DirectX 调用转换。传统方式是转为 OpenGL (WineD3D)，兼容性较好但性能一般。**现代方式是通过 DXVK 转为 Vulkan**，再通过 MoltenVK 将 Vulkan 转为 Metal (macOS 上的主流方案)，性能通常更好，但兼容性问题和图形错误 (glitches) 也可能更多。这个转换过程非常复杂，是许多游戏图形问题的根源。

对于20年之后统一换装ARM架构芯片的MacBook而言，Rosetta 2 + Wine 的双重翻译增加了复杂性。虽然 Rosetta 2 效率惊人，但它并非完美。尤其当 x86 程序试图调用或交互 macOS 原生的 ARM 组件时（比如 Wine 试图调用系统级的 ARM 架构 GStreamer 插件来处理 32 位 x86 程序的媒体请求），就可能因为架构不匹配而失败。**这很可能是我安装系统级 GStreamer 插件无效的关键原因之一。**

在我这次运行《常轨脱离》的过程中，我们就见识到了 Wine 的一个典型“弱点”：**对 Windows 多媒体子系统（尤其是 DirectShow）的不完整支持**。

Windows 的 DirectShow 是个庞大又历史悠久的系统，它本质上是一个“模块化媒体处理管道”：
- 各种格式的媒体文件会先被 Source Filter 拆包
- 然后交给 Splitter 分离音视频流
- 再分别由 Video 和 Audio Decoder 解码
- 最后送入 Renderer 进行播放渲染

这个过程中，每一个 Filter 都可能依赖系统预装的 DLL 或注册组件。

但 Wine 并不自带这些解码器，它靠的是 `winegstreamer.dll`，试图把 DirectShow 的逻辑“桥接”到 GStreamer 上去，也就是让 macOS 来代打解码器的活。但我们知道，**macOS 本身就不支持 WVC1 和 WMA 格式，而且 GStreamer 的 arm64 插件还经常缺失或不兼容 32 位调用**，所以整条链直接断了。

Wine 就在这里崩了——它试图“翻译” Windows 的 DirectShow 调用，但发现对面根本没人接电话，最后就只能以 `c0000005` 异常死在内存访问上。

最终，我 通过 CrossOver 安装 "DirectShow Filters"，实际上是**在 Wine 的 Bottle (模拟 C:\ 环境) 内部，放置了原生 Windows 的、x86 架构的解码器 DLL 文件** (如 wmvdecod.dll 等) 并正确注册了它们。这样，当游戏通过 DirectShow 请求解码 WVC1/WMA 时，Wine 就能在 Bottle 内部找到并直接使用这些“原装零件”，完全绕开了与宿主系统 GStreamer 的交互及其带来的架构和插件缺失问题。这正是 Wine (和 Winetricks/CrossOver) 解决依赖问题的经典模式：**缺啥补啥，尽量在模拟环境内部搞定。**

# 总结

Wine 是一个伟大的项目，但它永远不是完美替代 Windows 的解法，尤其是在涉及到复杂子系统（如多媒体、字体渲染、打印系统、USB 设备调用）时。Mac 用户用 Wine 的时候，踩坑基本是常态，而不是例外。

这也是为什么我强烈建议：
>打游戏有Win优先选win，没Win有主机优先选主机，没Win没主机优先选Linux系统（因为Linux Steam有proton兼容层），如果你既没有Win也没有主机还没有x86的Linux只能用MacOS，那你还可以考虑Parallels Desktop这种虚拟机。

解决《常轨脱离》崩溃问题的整个过程，说实话比我打算玩的这部Galgame还要曲折。从白屏报错到一点点分析日志，再到理解GStreamer与DirectShow的差异、补齐Windows解码器依赖，甚至牵扯到了Apple Silicon架构和x86兼容性的问题……这大概是我为一部游戏写过最长的“序章”。

**Wine 能让你“运行”Windows程序，但从来没承诺你能“顺利使用”它们。** 它更像是那种“不保证好用”的实验室装置——每次能跑成功都像是靠人品，能打补丁的地方比操作系统本身还多。

所以，当有人问我：“你家族有精神病史吗？”  

我大概会平静地回答：

> “我有个叔叔……买 Mac 打游戏。”

愿读到这里的你，至少成功启动了自己想玩的那款Gal。