"use client"

import { useMemo, useState } from "react"
import { ArticleCard } from "./article-card"
import { Sidebar } from "./sidebar"

export type ArticleMeta = {
  slug: string
  title: string
  excerpt?: string
  category: string
  categoryLabel: string
  tags: string[]
  date: string
  wordCount?: number
  readTime?: string
  image?: string
  pinned?: boolean
}

export function ArticleList({
  articles,
  title = "近期文章",
  subtitle = "Latest Posts",
  showViewAll = true,
}: {
  articles: ArticleMeta[]
  title?: string
  subtitle?: string
  showViewAll?: boolean
}) {
  const [activeCategory, setActiveCategory] = useState("all")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const categories = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>()
    articles.forEach((article) => {
      if (!counts.has(article.category)) {
        counts.set(article.category, { id: article.category, name: article.categoryLabel, count: 0 })
      }
      counts.get(article.category)!.count += 1
    })
    return [
      { id: "all", name: "全部", count: articles.length },
      ...Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name)),
    ]
  }, [articles])

  const tags = useMemo(() => {
    const allTags = articles.flatMap((article) => article.tags || [])
    return Array.from(new Set(allTags)).sort((a, b) => a.localeCompare(b))
  }, [articles])

  const filteredArticles = articles.filter((article) => {
    const categoryMatch = activeCategory === "all" || article.category === activeCategory
    const tagMatch = !activeTag || article.tags.includes(activeTag)
    return categoryMatch && tagMatch
  })

  return (
    <section className="px-6 py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-10">
          <span className="text-primary text-sm font-medium tracking-wide uppercase mb-2 block">{subtitle}</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-foreground">{title}</h2>
        </div>

        {/* Main layout: Sidebar + Articles */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <Sidebar
            categories={categories}
            tags={tags}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            activeTag={activeTag}
            onTagChange={setActiveTag}
          />

          {/* Article list - Single column */}
          <div className="flex-1 space-y-4">
            {filteredArticles.length > 0 ? (
              filteredArticles.map((article) => <ArticleCard key={article.slug} article={article} />)
            ) : (
              <div className="text-center py-12 text-muted-foreground">暂无符合条件的文章</div>
            )}

            {/* View all link */}
            {showViewAll && (
              <div className="pt-8 text-center">
                <a
                  href="/posts"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors duration-200 group"
                >
                  <span>查看全部文章</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
