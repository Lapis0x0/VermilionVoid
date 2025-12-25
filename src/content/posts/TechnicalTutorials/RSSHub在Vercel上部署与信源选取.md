---
title: RSSHub在Vercel上部署与信源选取
published: 2024-08-18
description: "原来都是在vps上用docker部署的RSSHUB，这两天突然发现居然Vercel也能部署RSSHUB，太神奇了。 虽然不像其他能vercel一键部署的项目那样，但实际操作流程也很简单： 一、正式部署流程 1.Fork这个仓库： https//github.com/DIYgod/RSSHub 如果"
image: ""
tags: []
category: 技术教程
draft: false
---

原来都是在vps上用docker部署的RSSHUB，这两天突然发现居然Vercel也能部署RSSHUB，太神奇了。

虽然不像其他能vercel一键部署的项目那样，但实际操作流程也很简单：

# 一、正式部署流程

1.Fork这个仓库： [https://github.com/DIYgod/RSSHub](https://github.com/DIYgod/RSSHub)

如果像其他项目，Fork之后直接去Vercel导入即可，但是RSSHub的master分支是没办法直接部署的，bug一直都没修，所以我们必须要切换到legacy分支。

2.将仓库切换到legacy分支

Fork仓库后，在自己账号里被fork的仓库中打开“Setting”设置，于“General”的“Default branch”中将默认的分支从master选为legacy即可。

“Switch default branch to another branch”

3.Vercel部署

部署流程就跟其他的项目没啥差别，去Vercel导入后一路点点点就行。

完成后记得绑定一个自己的域名，Vercel自带的域名国内是没办法直连的。

# 二、信源选取

毕竟我使用RSS的目的就是主动的获取信息而非平台的算法推送，主打的就是一手高质量信源和多合一信息聚合带来的便利。

以下列表是我截止到2024年8月18日订阅的几乎全部RSS信源，其中微信公众号大部分仍未完成迁移，B站订阅反爬限制严格没办法。这一套下来每天接收到的RSS推送大概一共200-400条，需要看一遍的大概60-80条，信息密度还行。

* **大模型**
  * 贯一智能科技
  * 鹤啸九天
  * 机器之心、量子位、新智元三大ai“顶刊”、极客公园
* 技术
  * 极客湾
  * 阮一峰的网络日志
  * 少数派
* 金融信息
  * 财联社
  * 东方财富网—策略报告
  * 国家金融与发展实验室
  * 港股研究社
  * 海豚投研
  * 镜像娱乐
  * 美股研究社
  * 远川研究所
  * 36氪-产品观察
* 微信订阅号(RSS)
  * 甲子光年
  * 清华大学国际与地区研究院
  * 晚点LatePost
  * 新潮沉思录
* 新闻
  * 联合早报-东南亚、国际、中港台
  * 半岛电视台
  * 格隆汇
