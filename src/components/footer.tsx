import { Github, MessageCircle, Music } from "lucide-react"
import { profile, type ProfileLinkType } from "@/data/profile"

const iconMap: Record<ProfileLinkType, typeof Github> = {
  qq: MessageCircle,
  music: Music,
  github: Github,
}

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 bg-secondary">
                <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
              </div>
              <span className="text-foreground font-medium">时歌的博客</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              理解以真实为本，但真实本身并不会自动呈现
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-4 uppercase tracking-wide">导航</h4>
            <nav className="flex flex-col gap-3">
              {[
                { name: "首页", href: "/" },
                { name: "时间线", href: "/timeline/" },
                { name: "书架", href: "/bookshelf/" },
                { name: "友链", href: "/friends/" },
                { name: "关于", href: "/about/" },
                { name: "开往", href: "https://www.travellings.cn/go.html", external: true },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="text-muted-foreground text-sm hover:text-foreground transition-colors duration-200"
                >
                  {item.name}
                </a>
              ))}
            </nav>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-4 uppercase tracking-wide">联系</h4>
            <div className="flex items-center gap-4">
              {profile.links.map((link) => {
                const Icon = iconMap[link.type]
                return (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all duration-200"
                    aria-label={link.name}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                )
              })}
            </div>
            <p className="text-muted-foreground text-sm mt-6">订阅邮件通讯，获取最新文章更新。</p>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary/50 transition-colors duration-200"
              />
              <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity duration-200">
                订阅
              </button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">© 2025 时歌. All rights reserved.</p>
          <a
            href="https://github.com/Lapis0x0/VermilionVoid"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-muted-foreground text-xs hover:text-foreground transition-colors duration-200 group"
          >
            <Github className="w-3.5 h-3.5" />
            <span>博客主题：朱墨留白 | VermilionVoid</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
