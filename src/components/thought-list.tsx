"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import type { MouseEvent } from "react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type ThoughtMeta = {
  slug: string
  title?: string
  content: string
  date: string
  tags: string[]
}

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

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

function ThoughtCard({ thought, index }: { thought: ThoughtMeta; index: number }) {
  return (
    <div
      className="relative pl-8 pb-8 last:pb-0 onload-animation"
      style={{ animationDelay: `calc(var(--content-delay) + ${index * 50}ms)` }}
    >
      {/* Timeline line */}
      <div className="absolute left-[7px] top-3 bottom-0 w-px bg-border/50 last:hidden" />

      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-primary bg-background" />

      {/* Date */}
      <div className="text-xs text-muted-foreground mb-2 font-medium tracking-wide">
        {formatDate(thought.date)}
      </div>

      {/* Content card */}
      <div className="bg-card border border-border/50 rounded-xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
        {thought.title && (
          <h3 className="font-serif text-lg font-medium text-foreground mb-3">
            {thought.title}
          </h3>
        )}
        <div
          className="text-muted-foreground leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: thought.content }}
        />
        {thought.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
            {thought.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-xs bg-secondary text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThoughtSidebar({
  tags,
  activeTag,
  onTagChange,
}: {
  tags: string[]
  activeTag: string | null
  onTagChange: (tag: string | null) => void
}) {
  return (
    <aside className="w-full lg:w-64 shrink-0">
      <div className="bg-card border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 bg-primary rounded-full" />
          <h4 className="font-medium text-foreground">标签</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagChange(activeTag === tag ? null : tag)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-colors",
                activeTag === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}

export function ThoughtList({
  thoughts,
  tags: sidebarTags,
  pagination,
}: {
  thoughts: ThoughtMeta[]
  tags: string[]
  pagination?: PaginationMeta
}) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(pagination?.currentPage ?? 1)
  const basePath = pagination?.basePath ?? "/thoughts"

  const tags = sidebarTags

  const syncFromLocation = useCallback(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const queryTag = params.get("tag")?.trim()

    let nextTag: string | null = null
    if (queryTag && tags.includes(queryTag)) {
      nextTag = queryTag
    }

    setActiveTag(nextTag)
    setCurrentPage(nextTag ? 1 : pagination?.currentPage ?? 1)

    if (document.documentElement.hasAttribute("data-prefilter")) {
      requestAnimationFrame(() => {
        document.documentElement.removeAttribute("data-prefilter")
      })
    }
  }, [tags, pagination?.currentPage])

  useEffect(() => {
    if (typeof window === "undefined") return
    syncFromLocation()

    const handleLocationChange = () => syncFromLocation()

    window.addEventListener("popstate", handleLocationChange)
    document.addEventListener("astro:page-load", handleLocationChange)
    document.addEventListener("astro:after-swap", handleLocationChange)
    return () => {
      window.removeEventListener("popstate", handleLocationChange)
      document.removeEventListener("astro:page-load", handleLocationChange)
      document.removeEventListener("astro:after-swap", handleLocationChange)
    }
  }, [syncFromLocation])

  const filteredThoughts = useMemo(() => {
    return thoughts.filter((thought) => {
      return !activeTag || thought.tags.includes(activeTag)
    })
  }, [thoughts, activeTag])

  const isFiltering = Boolean(activeTag)
  const pageSize = pagination?.pageSize ?? Math.max(1, thoughts.length)
  const totalPages = pagination ? Math.max(1, Math.ceil(filteredThoughts.length / pageSize)) : 1

  useEffect(() => {
    if (!pagination) return
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [pagination, currentPage, totalPages])

  const pagedThoughts = pagination
    ? filteredThoughts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredThoughts

  const pageRange = useMemo(() => {
    if (!pagination) return []
    return buildPageRange(currentPage, totalPages)
  }, [pagination, currentPage, totalPages])

  const withHash = (href?: string, pageNumber?: number) => {
    if (!href) return undefined
    if (pageNumber === 1) return `${href}#thoughts-main`
    return href
  }

  const previousUrl = pagination && currentPage > 1 ? getPageHref(currentPage - 1, basePath) : undefined
  const nextUrl = pagination && currentPage < totalPages ? getPageHref(currentPage + 1, basePath) : undefined

  const scrollToListTop = () => {
    const target = document.getElementById("thoughts-main") ?? sectionRef.current
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const updateSearchParams = (nextTag: string | null) => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const targetPath = pagination ? getPageHref(1, basePath) : url.pathname

    if (nextTag) {
      url.searchParams.set("tag", nextTag)
    } else {
      url.searchParams.delete("tag")
    }

    const search = url.searchParams.toString()
    window.history.replaceState({}, "", `${targetPath}${search ? `?${search}` : ""}#thoughts-main`)
  }

  const handleTagChange = (tag: string | null) => {
    setActiveTag(tag)
    setCurrentPage(1)
    updateSearchParams(tag)
    requestAnimationFrame(scrollToListTop)
  }

  const handlePageClick = (page: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!pagination || !isFiltering) return
    event.preventDefault()
    setCurrentPage(page)
  }

  return (
    <section ref={sectionRef} className="thought-list-root px-6 py-16 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="mb-10 onload-animation" style={{ animationDelay: "50ms" }}>
          <span className="text-primary text-sm font-medium tracking-wide uppercase mb-2 block">
            Serendipity
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-foreground">偶得</h2>
        </div>

        {/* Main layout: Timeline + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          {tags.length > 0 && (
            <div className="order-2 lg:order-1 onload-animation" style={{ animationDelay: "100ms" }}>
              <ThoughtSidebar tags={tags} activeTag={activeTag} onTagChange={handleTagChange} />
            </div>
          )}

          {/* Timeline */}
          <div className="order-1 lg:order-2 flex-1">
            {pagedThoughts.length > 0 ? (
              <div className="relative">
                {pagedThoughts.map((thought, index) => (
                  <ThoughtCard key={thought.slug} thought={thought} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">暂无偶得</div>
            )}

            {/* Pagination */}
            {pagination && totalPages > 1 && (
              <div className="pt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        href={withHash(previousUrl, currentPage - 1)}
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
                            href={withHash(getPageHref(page, basePath), page)}
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
                        href={withHash(nextUrl, currentPage + 1)}
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
