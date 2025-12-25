---
title: Pake打包Web APP记录
published: 2024-05-13
description: "一、Pake是什么？ Pake是一项使用Rust Tauri作为底层框架的、实现了快捷键的透传、沉浸式的窗口、拖动、样式改写、去广告、产品的极简风格定制的web app打包开源项目。原本的网页打包成应用要么是PWA，要么就是electron塞一个chromium，Pake则是用Tauri 替代之前套"
image: ""
tags: []
category: 技术教程
draft: false
---

# 一、Pake是什么？

Pake是一项使用Rust Tauri作为底层框架的、实现了快捷键的透传、沉浸式的窗口、拖动、样式改写、去广告、产品的极简风格定制的web app打包开源项目。原本的网页打包成应用要么是PWA，要么就是electron塞一个chromium，Pake则是用Tauri 替代之前套壳网页打包的老思路，相比传统的 Electron 套壳打包，软件要小将近 20 倍，约 5M 上下。

[开源地址](https://github.com/tw93/Pake/blob/master/README_CN.md)

# 二、如何使用Pake呢？

有两种方法，一是直接在线使用Github Action（小白推荐），二是本地运行Pake。

## 1.Github Action 执行打包

### （1）Fork本项目

这一步我觉得不用多说了

### （2）前往Actions

- 点击前往Actions界面，选择 `Build App with Pake-Cli`，填写表单信息，点击 `Run Workflow`即可。
- 表单参数与填写要求基本和pake-cli参数保持一致，具体可以参考下面的pake-cli变量内容

![Untitled](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202405130355860.png)

### （3）下载附件

出现绿色小图标则代表打包成功，可以点击 `Build App with Pake-Cli`查看打包详情和附件。

![Untitled](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202405130356483.png)

可以看到这里的 `Artfacts`出现了一个1,也就代表有一个附件可供下载。

![Untitled](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202405130356397.png)

点击 `Artfacts`，自动跳转到最下方，可以看到最终的附件信息，点击该附件名即可正式下载。

![Untitled](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202405130357339.png)

### （4）运行时间

- 第一次运行会比较慢，大概10-15分钟左右，后续有了缓存后，就会快很多。
- 尽量保证第一次完整运行，这样生成的缓存可以节省很多时间，如果运行失败，则生成的缓存不完整，后续就无法实现加速的效果。
- 可以在Actions左下角的页面查看缓存，一般命名为 `[打包平台]-cargo-xxxx`，一般在400M-600M之间，如果缓存生成较小，只有几十M，可以通过右边的删除按钮删除缓存，那么下次构建会自动生成新缓存来代替。
  ![title](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202405130359855.png)

## 2.MacOS 环境配置

### （1）安装Node.js

MacOS里可以直接通过Homebrew安装。打开终端用以下命令安装Node.js：

```jsx
brew install node
```

安装完成后，同样可以使用 `node -v` 和 `npm -v` 命令验证安装。

### （2）安装Pake

确保 Node.js 版本为 18 或更高版本（例如 18.7），避免使用 `sudo` 进行安装

```jsx
npm install pake-cli -g
```

- 若下载速度较慢 请给终端设置代理
- 实测安装之后无法在当前终端进行打包，需要重启终端开一个新的窗口

## 2.Windows/Linux 环境配置（稍微麻烦一点）

- 对于 Windows 用户，请确保至少安装了 `Win10 SDK(10.0.19041.0)` 和 `Visual Studio Build Tools 2022（版本 17.2 或更高）`，此外还需要安装以下组件：

  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86)（可选）
  4. Microsoft Visual C++ 2013 Redistributable (x86)（可选）
  5. Microsoft Visual C++ 2008 Redistributable (x86)（可选）
- 对于 Ubuntu 用户，在开始之前，建议运行以下命令以安装所需的依赖项：

```jsx
sudo apt install libdbus-1-dev \
    libsoup2.4-dev \
    libjavascriptcoregtk-4.0-dev \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    gnome-video-effects \
    gnome-video-effects-extra
```

- 之后，命令行安装pake即可

```jsx
npm install pake-cli -g
```

## 3.正式打包网页（pake-cli）

```jsx
pake [url] [options]
```

举个例子：`pake https://weekly.tw93.fun --name Weekly --hide-title-bar`

**变量解释：**

**[url]**

`url` 是您需要打包的网页链接 🔗 或本地 HTML 文件的路径，此参数为必填。

**[options]**

您可以通过传递以下选项来定制打包过程：

**[name]**

指定应用程序的名称，如果在输入时未指定，系统会提示您输入，建议使用单个英文名称，不要出现下划线或者中文。

```
--name <string>

```

**[icon]**

指定应用程序的图标，支持本地或远程文件。默认使用 Pake 的内置图标。您可以访问 [icon-icons](https://icon-icons.com/)
或 [macOSicons](https://macosicons.com/#/) 下载自定义图标。

- macOS 要求使用 `.icns` 格式。
- Windows 要求使用 `.ico` 格式。
- Linux 要求使用 `.png` 格式。

```
--icon <path>

```

**[height]**

设置应用窗口的高度，默认为 `780px`。

```
--height <number>

```

**[width]**

设置应用窗口的宽度，默认为 `1200px`。

```
--width <number>

```

**[hide-title-bar]**

设置是否启用沉浸式头部，默认为 `false`（不启用）。当前只对 macOS 上有效。

```
--hide-title-bar

```

**[fullscreen]**

设置应用程序是否在启动时自动全屏，默认为 `false`。使用以下命令可以设置应用程序启动时自动全屏。

```
--fullscreen

```

**[activation-shortcut]**

设置应用程序的激活快捷键。默认为空，不生效，可以使用以下命令自定义激活快捷键，例如 `CmdOrControl+Shift+P`，使用可参考 [available-modifiers](https://www.electronjs.org/docs/latest/api/accelerator#available-modifiers)。

```
--activation-shortcut <string>

```

**[always-on-top]**

设置是否窗口一直在最顶层，默认为 `false`。

```
--always-on-top

```

**[disabled-web-shortcuts]**

设置是否禁用原有 Pake 容器里面的网页操作快捷键，默认为 `false`。

```
--disabled-web-shortcuts

```

**[multi-arch]**

设置打包结果同时支持 Intel 和 M1 芯片，仅适用于 macOS，默认为 `false`。

**准备工作**

- 注意：启用此选项后，需要使用 rust 官网的 rustup 安装 rust，不支持通过 brew 安装。
- 对于 Intel 芯片用户，需要安装 arm64 跨平台包，以使安装包支持 M1 芯片。使用以下命令安装：

  ```
  rustup target add aarch64-apple-darwin
  ```
- 对于 M1 芯片用户，需要安装 x86 跨平台包，以使安装包支持 Intel 芯片。使用以下命令安装：

  ```
  rustup target add x86_64-apple-darwin
  ```

使用方法：

```jsx
--multi-arch
```

**[targets]**

选择输出的包格式，支持 `deb`、`appimage` 或 `all`。如果选择 `all`，则会同时打包 `deb` 和 `appimage`。此选项仅适用于 Linux，默认为 `all`。

```
--targets <string>
```

**[user-agent]**

自定义浏览器的用户代理请求头，默认为空。

```
--user-agent <string>
```

**[show-system-tray]**

设置是否显示通知栏托盘，默认不显示。

```
--show-system-tray
```

**[system-tray-icon]**

设置通知栏托盘图标，仅在启用通知栏托盘时有效。图标必须为 `.ico` 或 `.png` 格式，分辨率为 32x32 到 256x256 像素。

```
--system-tray-icon <path>
```

**[use-local-file]**

当 `url` 为本地文件路径时，如果启用此选项，则会递归地将 `url` 路径文件所在的文件夹及其所有子文件复

制到 Pake 的静态文件夹。默认不启用。

```
--use-local-file
```

**[inject]**

使用 `inject` 可以通过本地的绝对、相对路径的 `css` `js` 文件注入到你所指定 `url` 的页面中，从而为

其做定制化改造。举个例子：一段可以通用到任何网页的广告屏蔽脚本，或者是优化页面 `UI` 展的 `css`，你

只需要书写一次可以将其通用到任何其他网页打包的 `app`。

```
--inject ./tools/style.css --inject ./tools/hotkey.js
```

**[safe-domain]**

这个安全域名是除你当前配置的 `url` 之外可能会出现重定向或跳转到的其他域名，只有在已配置为安全的域名中，

才能够使用 `tauri` 暴露到浏览器的 `api` ，保证 `pake` 内置增强功能的正确运行。

PS: 安全域名不需要携带协议。

```
--safe-domain weread.qq.com,google.com
```

**[debug]**

打出来的包具备 deb-tools 的调试模式，此外还会输出更多的日志信息用于调试。

```
--debug
```
