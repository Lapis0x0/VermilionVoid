import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Giscus } from "@/components/Giscus"
import { ExternalLink, Heart, CheckCircle2, Copy, Check, Mail } from "lucide-react"
import { useState } from "react"
import friendsData from "@/data/friends.json"

type FriendLink = {
  title: string
  imgurl?: string
  desc?: string
  siteurl: string
}

type FriendCategory = {
  categoryTitle: string
  categoryDesc?: string
  links: FriendLink[]
}

const friends = friendsData as FriendCategory[]

// 站点信息配置
const siteInfo = {
  name: "时歌的博客",
  url: "https://www.lapis.cafe",
  avatar: "https://www.lapis.cafe/avatar.webp",
  desc: "理解以真实为本，但真实本身并不会自动呈现",
  rss: "https://lapis.cafe/rss.xml",
  email: "lapiscafe@foxmail.com"
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="复制"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function FriendsPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-muted/30">
      <Header />
      <main className="pt-32 pb-8">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <section className="mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-3 flex items-center gap-3">
              <span className="w-1 h-8 bg-primary rounded-full" />
              友情链接
            </h1>
            <p className="text-lg text-muted-foreground">这些是我欣赏的创作者们，他们在各自的领域持续输出优质内容。</p>
          </section>

          {/* Friends Grid */}
          <section className="mb-16 space-y-10">
            {friends.map((category) => (
              <div key={category.categoryTitle}>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-foreground mb-1">{category.categoryTitle}</h2>
                  {category.categoryDesc ? (
                    <p className="text-sm text-muted-foreground">{category.categoryDesc}</p>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {category.links.map((friend) => (
                    <a
                      key={friend.siteurl}
                      href={friend.siteurl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group p-5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        {friend.imgurl ? (
                          <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-border">
                            <img
                              src={friend.imgurl}
                              alt={friend.title}
                              width={56}
                              height={56}
                              loading="lazy"
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : null}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {friend.title}
                            </h3>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {friend.desc?.trim() ? friend.desc : "暂无描述"}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Apply Section */}
          <section className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">申请友链</h2>
                <p className="text-sm text-muted-foreground">如果你也有一个持续更新的博客，欢迎互换友链</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Requirements Card */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h3 className="text-sm font-medium text-foreground mb-4">申请标准</h3>
                <ul className="space-y-3">
                  {[
                    "贵站有一定深度的原创内容输出（读书笔记、专业研究、技术钻研或深度思考类内容）",
                    "建站时间至少半年以上，且已有十篇以上的原创博文",
                    "非以商业化为主，广告、推广内容不过多干扰阅读",
                    "申请者具备一定的基本教育背景（最好完成高中或同等教育）"
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Site Info Card */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h3 className="text-sm font-medium text-foreground mb-4">本站信息</h3>
                <div className="space-y-3">
                  {[
                    { label: "站点名称", value: siteInfo.name },
                    { label: "站点地址", value: siteInfo.url, mono: true },
                    { label: "站点头像", value: siteInfo.avatar, mono: true },
                    { label: "站点描述", value: siteInfo.desc },
                    { label: "RSS", value: siteInfo.rss, mono: true }
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4 group">
                      <span className="text-sm text-muted-foreground shrink-0">{item.label}</span>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`text-sm text-foreground truncate ${item.mono ? "font-mono text-xs" : ""}`}>
                          {item.value}
                        </span>
                        <CopyButton text={item.value} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Card */}
            <div className="p-5 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-foreground font-medium">通过邮件申请</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      由于评论系统使用 giscus，建议通过邮件提交，避免打扰其他读者
                    </p>
                  </div>
                </div>
                <a
                  href={`mailto:${siteInfo.email}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Mail className="w-4 h-4" />
                  {siteInfo.email}
                </a>
              </div>
            </div>
          </section>

          <section className="mt-8 pt-0 pb-8">
            <div className="max-w-3xl mx-auto">
              <Giscus />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
