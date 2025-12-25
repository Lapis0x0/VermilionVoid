import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { MapPin, Github, MessageCircle, Music, BookOpen, TrendingUp, Users, Cpu } from "lucide-react"
import { profile } from "@/data/profile"

const skills = [
  { icon: TrendingUp, name: "金融学", desc: "量化投资、宏观经济分析、金融市场结构" },
  { icon: Users, name: "社会学", desc: "社会网络、文化研究、制度分析" },
  { icon: Cpu, name: "AI/大模型", desc: "LLM应用开发、Prompt工程、AI伦理" },
]

const timeline = [
  { year: "2024", event: "开始探索 AI 大模型与社会科学的交叉研究" },
  { year: "2023", event: "发表跨学科研究论文，关注金融市场中的社会行为" },
  { year: "2022", event: "创建个人博客「思维边界」" },
  { year: "2021", event: "开始系统性学习量化金融与社会学理论" },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          {/* Hero Section */}
          <section className="mb-20">
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
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    持续学习中
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    开放交流
                  </span>
                </div>

                {/* Social Links */}
                <div className="flex items-center gap-3">
                  {profile.links.map((link) => {
                    const Icon = link.type === "qq" ? MessageCircle : link.type === "music" ? Music : Github
                    return (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                        aria-label={link.name}
                      >
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Bio Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded-full" />
              简介
            </h2>
            <div className="prose prose-neutral max-w-none text-muted-foreground leading-relaxed space-y-4">
              <p>
                我是一名跨学科研究者，专注于金融学、社会学与人工智能的交叉领域。我相信，
                <span className="text-foreground font-medium">真正的洞见往往诞生于学科边界的碰撞之处</span>。
              </p>
              <p>
                这个博客是我记录思考的地方。在这里，我尝试用金融学的理性框架分析市场行为，
                用社会学的视角解读技术变革，用 AI 的可能性探索认知边界。
              </p>
              <p>
                我不追求面面俱到的知识积累，而是希望在有限的领域里
                <span className="text-foreground font-medium">深挖本质</span>。
                每一篇文章都是一次思维实验，欢迎你参与讨论。
              </p>
            </div>
          </section>

          {/* Research Areas */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded-full" />
              研究领域
            </h2>
            <div className="grid gap-4">
              {skills.map((skill) => (
                <div
                  key={skill.name}
                  className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <skill.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{skill.name}</h3>
                      <p className="text-sm text-muted-foreground">{skill.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-3">
              <span className="w-1 h-6 bg-primary rounded-full" />
              时间线
            </h2>
            <div className="relative pl-6 border-l-2 border-border space-y-6">
              {timeline.map((item, index) => (
                <div key={index} className="relative">
                  <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  <div className="text-sm text-primary font-medium mb-1">{item.year}</div>
                  <div className="text-muted-foreground">{item.event}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
