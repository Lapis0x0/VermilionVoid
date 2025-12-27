"use client"

import { useState } from "react"
import { Header } from "./header"
import { Footer } from "./footer"
import { BookOpen, Filter, Search, ThumbsUp, Minus, ThumbsDown, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import booksData from "../../public/data/books.json"

// 飞书数据类型定义
interface BookFields {
  书名: string
  作者?: string[]
  书籍简介?: string
  书评?: string
  封面?: { local_path: string }[]
  推荐状态?: "推荐" | "中庸" | "不行"
  阅读进度?: string
  完成阅读时期?: string
  领域?: string
}

interface BookRecord {
  fields: BookFields
  id: string
  record_id: string
}

// 过滤已读的书籍 (阅读进度 === "1")
const allBooks = (booksData.data.items as BookRecord[]).filter(
  (book) => book.fields.阅读进度 === "1"
)

// 按领域分组
const booksByCategory = allBooks.reduce<Record<string, BookRecord[]>>((acc, book) => {
  const category = book.fields.领域 || "未分类"
  if (!acc[category]) acc[category] = []
  acc[category].push(book)
  return acc
}, {})

// 获取所有领域
const categories = ["全部", ...Object.keys(booksByCategory)]
const recommendStatuses = ["全部", "推荐", "中庸", "不行"]

export function BookshelfContent() {
  const [selectedCategory, setSelectedCategory] = useState("全部")
  const [selectedStatus, setSelectedStatus] = useState("全部")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null)

  // 过滤书籍
  const filteredBooks = allBooks.filter((book) => {
    const matchCategory = selectedCategory === "全部" || book.fields.领域 === selectedCategory
    const matchStatus = selectedStatus === "全部" || book.fields.推荐状态 === selectedStatus
    const matchSearch =
      book.fields.书名.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.fields.作者?.join(", ") || "").toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchStatus && matchSearch
  })

  // 按领域分组过滤后的书籍
  const filteredByCategory = filteredBooks.reduce<Record<string, BookRecord[]>>((acc, book) => {
    const category = book.fields.领域 || "未分类"
    if (!acc[category]) acc[category] = []
    acc[category].push(book)
    return acc
  }, {})

  // 统计数据
  const stats = {
    total: allBooks.length,
    recommended: allBooks.filter((b) => b.fields.推荐状态 === "推荐").length,
    categories: Object.keys(booksByCategory).length,
  }

  // 获取封面URL
  const getCoverUrl = (book: BookRecord): string | null => {
    const cover = book.fields.封面?.[0]
    return cover?.local_path || null
  }

  // 获取推荐状态图标和样式
  const getRecommendBadge = (status?: string) => {
    switch (status) {
      case "推荐":
        return { icon: ThumbsUp, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
      case "中庸":
        return { icon: Minus, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" }
      case "不行":
        return { icon: ThumbsDown, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-muted/30">
      <Header />

      <main className="pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-6">
          {/* Page Header */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">书架</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              博学而笃志，切问而近思
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground mb-8">
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="font-medium text-foreground">{stats.total}</span> 本已读
            </span>
            <span className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-green-500" />
              <span className="font-medium text-foreground">{stats.recommended}</span> 本推荐
            </span>
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="font-medium text-foreground">{stats.categories}</span> 个领域
            </span>
          </div>

          {/* Search & Filters */}
          <div className="space-y-4 mb-10">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索书名或作者..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* Category Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">领域</span>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs transition-all duration-200",
                      selectedCategory === category
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-border hidden sm:block" />

              {/* Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">评价</span>
                {recommendStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs transition-all duration-200",
                      selectedStatus === status
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Book Grid by Category */}
          <div className="space-y-12">
            {Object.entries(filteredByCategory).map(([category, books]) => (
              <div key={category}>
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-lg font-semibold text-foreground">{category}</h2>
                  <span className="text-sm text-muted-foreground">({books.length})</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>

                {/* Books Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {books.map((book) => {
                    const badge = getRecommendBadge(book.fields.推荐状态)
                    const coverUrl = getCoverUrl(book)
                    return (
                      <div
                        key={book.id}
                        className="group cursor-pointer"
                        onClick={() => setSelectedBook(book)}
                      >
                        {/* Cover */}
                        <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-muted/30 shadow-sm group-hover:shadow-xl transition-shadow duration-300">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={book.fields.书名}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center p-3 bg-gradient-to-br from-primary/30 via-primary/20 to-primary/5">
                              <p className="font-semibold text-xs text-foreground text-center line-clamp-4">{book.fields.书名}</p>
                            </div>
                          )}

                          {/* Recommend Icon */}
                          {badge && (
                            <div className={cn("absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center", badge.className)}>
                              <badge.icon className="w-3 h-3" />
                            </div>
                          )}

                          {/* Hover Info Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                            {book.fields.书评 ? (
                              <p className="text-white/90 text-xs line-clamp-4 leading-relaxed">{book.fields.书评}</p>
                            ) : book.fields.书籍简介 ? (
                              <p className="text-white/80 text-xs line-clamp-4 leading-relaxed">{book.fields.书籍简介}</p>
                            ) : null}
                          </div>
                        </div>

                        {/* Info */}
                        <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                          {book.fields.书名}
                        </h3>
                        {book.fields.作者 && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{book.fields.作者.join(", ")}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">没有找到匹配的书籍</p>
            </div>
          )}

        </div>
      </main>

      <Footer />

      {/* Book Detail Dialog */}
      <Dialog open={!!selectedBook} onOpenChange={(open) => !open && setSelectedBook(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedBook && (
            <>
              <div className="flex gap-5">
                {/* Cover */}
                <div className="shrink-0 w-32 aspect-[3/4] rounded-lg overflow-hidden bg-muted/30">
                  {getCoverUrl(selectedBook) ? (
                    <img
                      src={getCoverUrl(selectedBook)!}
                      alt={selectedBook.fields.书名}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-3 bg-gradient-to-br from-primary/30 via-primary/20 to-primary/5">
                      <p className="font-semibold text-xs text-foreground text-center">{selectedBook.fields.书名}</p>
                    </div>
                  )}
                </div>

                {/* Basic Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground mb-2">{selectedBook.fields.书名}</h2>
                  {selectedBook.fields.作者 && (
                    <p className="text-sm text-muted-foreground mb-3">{selectedBook.fields.作者.join(", ")}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedBook.fields.领域 && (
                      <span className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground">
                        {selectedBook.fields.领域}
                      </span>
                    )}
                    {selectedBook.fields.推荐状态 && (
                      <span className={cn(
                        "px-2 py-1 text-xs rounded-md",
                        getRecommendBadge(selectedBook.fields.推荐状态)?.className
                      )}>
                        {selectedBook.fields.推荐状态}
                      </span>
                    )}
                    {selectedBook.fields.完成阅读时期 && (
                      <span className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {selectedBook.fields.完成阅读时期}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
                {selectedBook.fields.书评 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">我的书评</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedBook.fields.书评}
                    </p>
                  </div>
                )}
                {selectedBook.fields.书籍简介 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">书籍简介</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedBook.fields.书籍简介}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
