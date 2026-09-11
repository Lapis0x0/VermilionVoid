import { MapPin, Heart } from "lucide-react"
import { profile } from "@/data/profile"
import { ProfileContactLink } from "@/components/profile-contact-link"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background dark:bg-surface-subtle">
      <main className="pt-32 pb-8">
        <div className="max-w-4xl mx-auto px-6">
          {/* Hero Section */}
          <section className="mb-10">
            <div className="flex flex-col md:flex-row gap-10 items-start">
              {/* Avatar */}
              <div className="shrink-0">
                <div className="w-36 h-36 rounded-2xl overflow-hidden border-2 border-border shadow-lg">
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    width={144}
                    height={144}
                    loading="lazy"
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
                  <span className="w-1 h-8 bg-primary rounded-full" />
                  关于我
                </h1>
                <p className="text-xl text-muted-foreground mb-4">{profile.bio}</p>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    中国
                  </span>
                </div>

                {/* Social Links */}
                <div className="flex items-center gap-3">
                  {profile.links.map((link) => {
                    return (
                      <ProfileContactLink
                        key={link.name}
                        link={link}
                        className="p-2.5 rounded-lg bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                        iconClassName="w-5 h-5"
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Bio Section */}
          <section className="mb-16">
            <div className="prose prose-neutral dark:prose-invert max-w-none
              prose-p:text-base prose-p:leading-8 prose-p:my-5 prose-p:text-foreground/90 dark:prose-p:text-foreground
              prose-a:text-primary prose-a:no-underline prose-a:hover:underline
              prose-blockquote:border-l-primary prose-blockquote:border-l-2 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-content-secondary prose-blockquote:font-normal prose-blockquote:bg-surface-subtle prose-blockquote:py-2 prose-blockquote:rounded-r-lg
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:text-foreground/90 dark:prose-ul:text-foreground prose-ul:my-5
              prose-li:marker:text-primary prose-li:my-1.5"
            >
              <blockquote>
                理解以真实为本，但真实本身并不会自动呈现
              </blockquote>
              <p>
                你好，我叫时歌，也可以叫我 Lapis0x0。
              </p>
              <p>
                2004年出生在河南，在大山中长大。
              </p>
              <p>
                可能是因为我从小性格就较为安静，因此有幸在最好奇的年龄读了很多杂七杂八的书；又因为喜欢打游戏，好让游戏能顺利跑起来而被迫自学计算机知识。这两件事不知不觉帮我训练出了一种跨学科的直觉，后来不管是学习、研究还是设计写代码，这种直觉都会冒出来且经常比我预想的有用。
              </p>
              <p>
                我说不太清楚它到底是什么，但我很喜欢它的存在，像是少年时的自己悄悄留给现在的礼物。
              </p>
              <p>
                我当过一段时间的老师，上一份工作是量化策略研究员。现在业余的大部分精力在维护一个叫 <a href="https://github.com/Lapis0x0/obsidian-yolo" target="_blank" rel="noopener noreferrer">YOLO</a> 的开源项目，它是一个 Obsidian AI 插件。我始终认为，鉴于 LLM 的潜能，它不应该仅仅止于被我们督促去做一些事情，它本可以在茫茫识海中自由穿梭，把你曾经记下的知识碎片、曾经习得的写作风格、曾经积累的对世界的理解融会贯通，生成真正流畅而自主的内容，做一些更有趣有价值的事情——这也就是 YOLO 想去探寻的方向。
              </p>
              <p>个人兴趣：</p>
              <ul>
                <li>LLM 算法</li>
                <li>社会学与人类学</li>
              </ul>
              <p>对世界充满兴趣，也总是心怀戒备。</p>
              <p>
                📮 <a href="mailto:lapiscafe@foxmail.com">lapiscafe@foxmail.com</a>　微信：shizhiyunzhe
              </p>
            </div>
          </section>

          {/* Appreciation Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded-full" />
              赞赏支持
            </h2>
            <div className="p-6 rounded-2xl border border-border bg-card">
              <div className="flex items-start gap-3 mb-6">
                <Heart className="w-5 h-5 text-primary mt-0.5" />
                <p className="text-muted-foreground text-sm leading-relaxed">
                  如果你觉得我的博客内容对你有所帮助或启发，可以考虑赞赏支持我继续创作。你的每一份支持都是我前进的动力，非常感谢！
                </p>
              </div>
              <div className="flex justify-center gap-8 flex-wrap">
                <div className="text-center">
                  <div className="w-52 h-52 rounded-xl overflow-hidden border border-border mb-2">
                    <img src="/images/vote/weixin.jpg" alt="微信赞赏码" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm font-medium text-green-600">微信赞赏</p>
                </div>
                <div className="text-center">
                  <div className="w-52 h-52 rounded-xl overflow-hidden border border-border mb-2">
                    <img src="/images/vote/zhifubao.jpg" alt="支付宝赞赏码" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm font-medium text-blue-600">支付宝赞赏</p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
