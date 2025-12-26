"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import type { MouseEvent } from "react"
import { ArticleCard } from "./article-card"
import { Sidebar } from "./sidebar"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

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

type SidebarCategory = { id: string; name: string; count: number }

type PaginationMeta = {
  currentPage: number
  basePath?: string
  pageSize?: number
}

const HIDDEN = -1
const ADJACENT_DISTANCE = 2
const VISIBLE_PAGES = ADJACENT_DISTANCE * 2 + 1

const normalizeBasePath = (basePath: string) => {
  if (!basePath.startsWith("/")) return `/${basePath}`.replace(/\/+$/, "")
  return basePath === "/" ? "" : basePath.replace(/\/+$/, "")
}

const getPageHref = (pageNumber: number, basePath: string) => {
  const base = normalizeBasePath(basePath)
  if (pageNumber === 1) return base || "/"
  return `${base}/${pageNumber}/`
}

const buildPageRange = (currentPage: number, totalPages: number) => {
  if (totalPages <= 1) return []

  let count = 1
  let left = currentPage
  let right = currentPage

  while (left - 1 > 0 && right + 1 <= totalPages && count + 2 <= VISIBLE_PAGES) {
    count += 2
    left -= 1
    right += 1
  }

  while (left - 1 > 0 && count < VISIBLE_PAGES) {
    count += 1
    left -= 1
  }

  while (right + 1 <= totalPages && count < VISIBLE_PAGES) {
    count += 1
    right += 1
  }

  const pages: number[] = []
  if (left > 1) pages.push(1)
  if (left === 3) pages.push(2)
  if (left > 3) pages.push(HIDDEN)
  for (let page = left; page <= right; page += 1) pages.push(page)
  if (right < totalPages - 2) pages.push(HIDDEN)
  if (right === totalPages - 2) pages.push(totalPages - 1)
  if (right < totalPages) pages.push(totalPages)

  return pages
}

export function ArticleList({
  articles,
  title = "近期文章",
  subtitle = "Latest Posts",
  showViewAll = true,
  pagination,
  sidebarCategories,
  sidebarTags,
}: {
  articles: ArticleMeta[]
  title?: string
  subtitle?: string
  showViewAll?: boolean
  pagination?: PaginationMeta
  sidebarCategories?: SidebarCategory[]
  sidebarTags?: string[]
}) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [activeCategory, setActiveCategory] = useState("all")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(pagination?.currentPage ?? 1)
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const basePath = pagination?.basePath ?? "/"

  const computedCategories = useMemo(() => {
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

  const categories = useMemo(() => {
    if (!sidebarCategories || sidebarCategories.length === 0) {
      return computedCategories
    }
    const hasAll = sidebarCategories.some((category) => category.id === "all")
    if (hasAll) return sidebarCategories
    const total = sidebarCategories.reduce((sum, category) => sum + category.count, 0)
    return [{ id: "all", name: "全部", count: total }, ...sidebarCategories]
  }, [computedCategories, sidebarCategories])

  const computedTags = useMemo(() => {
    const allTags = articles.flatMap((article) => article.tags || [])
    return Array.from(new Set(allTags)).sort((a, b) => a.localeCompare(b))
  }, [articles])

  const tags = sidebarTags && sidebarTags.length > 0 ? sidebarTags : computedTags

  const syncFromLocation = useCallback(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const queryCategory = params.get("category")?.trim()
    const queryTag = params.get("tag")?.trim()

    let nextCategory = "all"
    let nextTag: string | null = null
    let nextExpanded = false

    if (queryTag && tags.includes(queryTag)) {
      nextTag = queryTag
    } else if (queryCategory && categories.some((category) => category.id === queryCategory)) {
      nextCategory = queryCategory
      nextExpanded = true
    }

    setActiveCategory(nextCategory)
    setActiveTag(nextTag)
    setCategoriesExpanded(nextExpanded)
    setCurrentPage(1)

    if (document.documentElement.hasAttribute("data-prefilter")) {
      requestAnimationFrame(() => {
        document.documentElement.removeAttribute("data-prefilter")
      })
    }
  }, [categories, tags])

  useEffect(() => {
    if (typeof window === "undefined") return
    syncFromLocation()

    const handleLocationChange = () => {
      syncFromLocation()
    }

    window.addEventListener("popstate", handleLocationChange)
    window.addEventListener("hashchange", handleLocationChange)
    document.addEventListener("astro:page-load", handleLocationChange)
    document.addEventListener("astro:after-swap", handleLocationChange)
    return () => {
      window.removeEventListener("popstate", handleLocationChange)
      window.removeEventListener("hashchange", handleLocationChange)
      document.removeEventListener("astro:page-load", handleLocationChange)
      document.removeEventListener("astro:after-swap", handleLocationChange)
    }
  }, [syncFromLocation])

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const categoryMatch = activeCategory === "all" || article.category === activeCategory
      const tagMatch = !activeTag || article.tags.includes(activeTag)
      return categoryMatch && tagMatch
    })
  }, [articles, activeCategory, activeTag])

  const isFiltering = activeCategory !== "all" || Boolean(activeTag)
  const pageSize = pagination?.pageSize ?? Math.max(1, articles.length)
  const totalPages = pagination ? Math.max(1, Math.ceil(filteredArticles.length / pageSize)) : 1

  useEffect(() => {
    if (!pagination) return
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [pagination, currentPage, totalPages])

  const pagedArticles = pagination
    ? filteredArticles.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredArticles

  const pageRange = useMemo(() => {
    if (!pagination) return []
    return buildPageRange(currentPage, totalPages)
  }, [pagination, currentPage, totalPages])

  const withHomeHash = (href?: string) => (href ? `${href}#home-main` : undefined)
  const previousUrl = pagination && currentPage > 1 ? getPageHref(currentPage - 1, basePath) : undefined
  const nextUrl = pagination && currentPage < totalPages ? getPageHref(currentPage + 1, basePath) : undefined
  const scrollToListTop = () => {
    const target = document.getElementById("home-main") ?? sectionRef.current
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const updateSearchParams = (nextCategory: string, nextTag: string | null) => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const targetPath = pagination ? getPageHref(1, basePath) : url.pathname

    if (nextCategory !== "all") {
      url.searchParams.set("category", nextCategory)
    } else {
      url.searchParams.delete("category")
    }

    if (nextTag) {
      url.searchParams.set("tag", nextTag)
    } else {
      url.searchParams.delete("tag")
    }

    const search = url.searchParams.toString()
    window.history.replaceState({}, "", `${targetPath}${search ? `?${search}` : ""}#home-main`)
  }

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category)
    setActiveTag(null)
    setCurrentPage(1)
    setCategoriesExpanded(true)
    updateSearchParams(category, null)
    requestAnimationFrame(scrollToListTop)
  }
  const handleTagChange = (tag: string | null) => {
    setActiveTag(tag)
    setActiveCategory("all")
    setCategoriesExpanded(false)
    setCurrentPage(1)
    updateSearchParams("all", tag)
    requestAnimationFrame(scrollToListTop)
  }
  const handlePageClick =
    (page: number) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (!pagination || !isFiltering) return
      event.preventDefault()
      setCurrentPage(page)
    }

  return (
    <section ref={sectionRef} className="article-list-root px-6 py-16 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-10 onload-animation" style={{ animationDelay: "50ms" }}>
          <span className="text-primary text-sm font-medium tracking-wide uppercase mb-2 block">{subtitle}</span>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-foreground">{title}</h2>
        </div>

        {/* Main layout: Sidebar + Articles */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="order-2 lg:order-1 onload-animation" style={{ animationDelay: "100ms" }}>
            <Sidebar
              categories={categories}
              tags={tags}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              activeTag={activeTag}
              onTagChange={handleTagChange}
              categoriesExpanded={categoriesExpanded}
              onCategoriesExpandedChange={setCategoriesExpanded}
            />
          </div>

          {/* Article list - Single column */}
          <div className="order-1 lg:order-2 flex-1 space-y-4">
            {pagedArticles.length > 0 ? (
              pagedArticles.map((article, index) => (
                <ArticleCard
                  key={article.slug}
                  article={article}
                  className="onload-animation"
                  style={{ animationDelay: `calc(var(--content-delay) + ${index * 50}ms)` }}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">暂无符合条件的文章</div>
            )}

            {/* View all link */}
            {showViewAll && (
              <div className="pt-8 text-center">
                <a
                  href="/posts/"
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

            {pagination && totalPages > 1 && (
              <div className="pt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        href={withHomeHash(previousUrl)}
                        size="default"
                        aria-disabled={!previousUrl}
                        tabIndex={previousUrl ? undefined : -1}
                        className={cn("gap-1 px-2.5", !previousUrl && "pointer-events-none opacity-50")}
                        rel={previousUrl ? "prev" : undefined}
                        onClick={previousUrl ? handlePageClick(currentPage - 1) : undefined}
                      >
                        <ChevronLeft className="size-4" />
                        <span className="hidden sm:block">上一页</span>
                      </PaginationLink>
                    </PaginationItem>

                    {pageRange.map((page, index) => (
                      <PaginationItem key={`${page}-${index}`}>
                        {page === HIDDEN ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href={withHomeHash(getPageHref(page, basePath))}
                            isActive={currentPage === page}
                            onClick={handlePageClick(page)}
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationLink
                        href={withHomeHash(nextUrl)}
                        size="default"
                        aria-disabled={!nextUrl}
                        tabIndex={nextUrl ? undefined : -1}
                        className={cn("gap-1 px-2.5", !nextUrl && "pointer-events-none opacity-50")}
                        rel={nextUrl ? "next" : undefined}
                        onClick={nextUrl ? handlePageClick(currentPage + 1) : undefined}
                      >
                        <span className="hidden sm:block">下一页</span>
                        <ChevronRight className="size-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
