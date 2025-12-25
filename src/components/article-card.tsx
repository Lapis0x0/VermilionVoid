"use client"

import type { CSSProperties } from "react"
import { Calendar, Folder, Hash, ChevronRight } from "lucide-react"
import type { ArticleMeta } from "./article-list"
import { cn } from "@/lib/utils"

export function ArticleCard({
  article,
  className,
  style,
}: {
  article: ArticleMeta
  className?: string
  style?: CSSProperties
}) {
  const primaryTag = article.tags?.[0] ?? "未标签"
  const wordCount = article.wordCount ? `${article.wordCount} 字` : "——"
  const readTime = article.readTime ?? "——"

  return (
    <a href={`/posts/${article.slug}/`} className={cn("group block", className)} style={style}>
      <article className="relative bg-card border border-border/50 rounded-xl p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        {/* Pinned indicator */}
        {article.pinned && (
          <div className="absolute top-4 right-4 text-primary">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )}

        <div className="flex gap-5">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg sm:text-xl font-medium text-foreground mb-3 leading-tight group-hover:text-primary transition-colors duration-200 flex items-start gap-2">
              <span className="w-1 h-6 shrink-0 bg-primary rounded-full mt-0.5" />
              <span>{article.title}</span>
            </h3>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {article.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                {article.categoryLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                {primaryTag}
              </span>
            </div>

            {/* Excerpt */}
            <p className="text-muted-foreground text-sm leading-relaxed mb-3 line-clamp-2">{article.excerpt}</p>

            {/* Footer stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{wordCount}</span>
              <span className="text-border">|</span>
              <span>{readTime}</span>
            </div>
          </div>

          {/* Thumbnail (optional) */}
          {article.image && (
            <div className="hidden sm:block w-28 h-20 shrink-0 rounded-lg overflow-hidden">
              <img
                src={article.image || "/placeholder.svg"}
                alt=""
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          )}

          {/* Arrow */}
          <div className="flex items-center shrink-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </article>
    </a>
  )
}
