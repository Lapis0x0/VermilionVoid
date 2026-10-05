"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"

interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  /**
   * rail：桌面侧栏。顶部在文章大标题滚出视口后淡入标题，二级标题按所在章节手风琴展开，底部字符进度条。
   * list：手机抽屉。只有目录树，二级标题全部展开。
   */
  variant?: "rail" | "list"
  title?: string
}

// 每次滚动（合并到一帧）回调阅读进度 0–1：正文底部到达视口底部即为 1，不受页脚高度影响
function useReadingProgress(onChange: (progress: number) => void) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const article = document.querySelector("article")
      if (!article) return
      const end = article.getBoundingClientRect().bottom + window.scrollY - window.innerHeight
      onChangeRef.current(Math.max(0, Math.min(1, window.scrollY / Math.max(1, end))))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    document.addEventListener("astro:page-load", schedule)
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      document.removeEventListener("astro:page-load", schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
}

// 手机端没有侧栏，用顶端一条 1px 主色细线表示阅读进度；直接写 transform，不走 React 渲染
export function ReadingProgressLine() {
  const ref = useRef<HTMLDivElement>(null)
  useReadingProgress((p) => {
    if (ref.current) ref.current.style.transform = `scaleX(${p})`
  })
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-px origin-left scale-x-0 bg-primary"
    />
  )
}

const EASE_OUT = "ease-[cubic-bezier(.19,1,.22,1)]"

type TocGroup = { head: TocItem | null; subs: TocItem[] }

export function TableOfContents({ variant = "rail", title }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const navRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const headingElementsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map())
  // Pre-measured document-coord top of every heading. Refreshed on resize / page
  // load — never read inside the IO callback to avoid forced sync layout while
  // the user scrolls.
  const headingOffsetsRef = useRef<Array<{ id: string; top: number }>>([])
  const tocAutoScrollTimerRef = useRef<number | null>(null)
  const programmaticTargetRef = useRef<string>("")
  const programmaticLockRef = useRef(false)
  const lockTimerRef = useRef<number | null>(null)

  const unlockProgrammaticLock = useCallback(() => {
    programmaticLockRef.current = false
    programmaticTargetRef.current = ""
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current)
      lockTimerRef.current = null
    }
  }, [])

  const clearTocAutoScrollTimer = useCallback(() => {
    if (tocAutoScrollTimerRef.current !== null) {
      window.clearTimeout(tocAutoScrollTimerRef.current)
      tocAutoScrollTimerRef.current = null
    }
  }, [])

  const collectHeadings = useCallback(() => {
    const article = document.querySelector("article")
    if (!article) return

    const elements = article.querySelectorAll("h2, h3")
    const items: TocItem[] = []
    elements.forEach((el) => {
      const id = el.id
      if (!id) return
      const clone = el.cloneNode(true) as HTMLElement
      clone.querySelectorAll(".anchor, .anchor-icon").forEach((a) => a.remove())
      const text = clone.textContent?.trim() || ""
      if (!text) return
      const level = parseInt(el.tagName[1], 10)
      items.push({ id, text, level })
    })
    setHeadings(items)
    return items
  }, [])

  const measureOffsets = useCallback((items: TocItem[]) => {
    const scrollY = window.scrollY
    const offsets: Array<{ id: string; top: number }> = []
    items.forEach((item) => {
      const el = document.getElementById(item.id)
      if (!el) return
      offsets.push({ id: item.id, top: el.getBoundingClientRect().top + scrollY })
    })
    offsets.sort((a, b) => a.top - b.top)
    headingOffsetsRef.current = offsets
  }, [])

  const setupObserver = useCallback(
    (items: TocItem[]) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      headingElementsRef.current = new Map()

      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            headingElementsRef.current.set(entry.target.id, entry)
          })

          if (programmaticLockRef.current) {
            const targetId = programmaticTargetRef.current
            if (targetId) {
              // While a click-driven smooth scroll is in flight, keep activeId
              // pinned to the target. Unlock is driven by `scrollend` / 2500ms
              // hard timer / user gesture — never by IO geometry, which would
              // either flicker (entry-based) or cost a sync layout read
              // (rect-based, the original implementation).
              setActiveId(targetId)
              return
            }
            unlockProgrammaticLock()
          }

          const visibleHeadings: IntersectionObserverEntry[] = []
          headingElementsRef.current.forEach((entry) => {
            if (entry.isIntersecting) visibleHeadings.push(entry)
          })

          if (visibleHeadings.length > 0) {
            const sorted = visibleHeadings.sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
            )
            setActiveId(sorted[0].target.id)
          } else {
            // Fallback: use pre-measured offsets instead of reading layout for
            // every heading on every callback (the original code triggered a
            // forced reflow per heading per scroll tick — the main mobile-jank
            // culprit reported by Codex).
            const scrollY = window.scrollY
            const offsets = headingOffsetsRef.current
            let closestId = ""
            for (const o of offsets) {
              if (o.top <= scrollY + 100) closestId = o.id
              else break
            }
            if (closestId) setActiveId(closestId)
          }
        },
        {
          rootMargin: "-80px 0px -60% 0px",
          threshold: 0,
        },
      )

      items.forEach((item) => {
        const el = document.getElementById(item.id)
        if (el) observerRef.current?.observe(el)
      })
    },
    [unlockProgrammaticLock],
  )

  useEffect(() => {
    let resizeRaf = 0
    let remeasureRaf = 0
    let currentItems: TocItem[] = []
    let articleObserver: ResizeObserver | null = null

    const remeasure = () => {
      if (currentItems.length > 0) measureOffsets(currentItems)
    }

    const scheduleRemeasure = () => {
      if (remeasureRaf) cancelAnimationFrame(remeasureRaf)
      remeasureRaf = requestAnimationFrame(remeasure)
    }

    const observeArticleResize = () => {
      articleObserver?.disconnect()
      const article = document.querySelector("article")
      if (!article || typeof ResizeObserver === "undefined") return
      // Markdown images load lazily and rarely declare width/height, so the
      // article reflows during scrolling. Re-measure heading offsets whenever
      // article geometry changes — keeps the fallback branch accurate without
      // forcing a layout read inside the IO callback itself.
      articleObserver = new ResizeObserver(scheduleRemeasure)
      articleObserver.observe(article)
    }

    const init = () => {
      const items = collectHeadings()
      if (items && items.length > 0) {
        currentItems = items
        measureOffsets(items)
        setupObserver(items)
        observeArticleResize()
      }
    }

    init()
    window.addEventListener("load", remeasure)
    document.addEventListener("astro:page-load", init)

    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(remeasure)
    }
    window.addEventListener("resize", onResize, { passive: true })

    const handleUserIntent = () => {
      if (programmaticLockRef.current) {
        unlockProgrammaticLock()
      }
    }

    // `scrollend` (Chrome 114+, Safari 18+, Firefox 109+) is the cleanest
    // signal that a programmatic smooth scroll has finished. Older browsers
    // fall back to the existing 2500ms hard timer + user-gesture unlock.
    const onScrollEnd = () => {
      if (programmaticLockRef.current) unlockProgrammaticLock()
    }

    window.addEventListener("wheel", handleUserIntent, { passive: true })
    window.addEventListener("touchstart", handleUserIntent, { passive: true })
    window.addEventListener("keydown", handleUserIntent)
    window.addEventListener("scrollend", onScrollEnd, { passive: true })

    return () => {
      observerRef.current?.disconnect()
      articleObserver?.disconnect()
      window.removeEventListener("load", remeasure)
      document.removeEventListener("astro:page-load", init)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("wheel", handleUserIntent)
      window.removeEventListener("touchstart", handleUserIntent)
      window.removeEventListener("keydown", handleUserIntent)
      window.removeEventListener("scrollend", onScrollEnd)
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      if (remeasureRaf) cancelAnimationFrame(remeasureRaf)
      clearTocAutoScrollTimer()
      unlockProgrammaticLock()
    }
  }, [clearTocAutoScrollTimer, collectHeadings, measureOffsets, setupObserver, unlockProgrammaticLock])

  useEffect(() => {
    if (!activeId || !navRef.current) return

    // Mobile renders the TOC inside a drawer that's usually closed; auto-scroll
    // there forces extra layout reads on every heading change while the user
    // scrolls the article. Desktop (sidebar) is the only place where keeping
    // the active link visible matters.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      return
    }

    clearTocAutoScrollTimer()
    tocAutoScrollTimerRef.current = window.setTimeout(() => {
      const nav = navRef.current
      if (!nav) return

      const activeLink = nav.querySelector<HTMLAnchorElement>(`a[href="#${CSS.escape(activeId)}"]`)
      if (!activeLink) return

      const scrollContainer = nav.closest<HTMLElement>(".toc-scroll-container")
      if (!scrollContainer) return

      const containerRect = scrollContainer.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const isContainerVisible = containerRect.bottom > 0 && containerRect.top < viewportHeight
      if (!isContainerVisible) return

      const linkRect = activeLink.getBoundingClientRect()
      const padding = 12
      const isOutOfView =
        linkRect.top < containerRect.top + padding ||
        linkRect.bottom > containerRect.bottom - padding

      if (isOutOfView) {
        activeLink.scrollIntoView({ block: "nearest", inline: "nearest" })
      }
    }, 90)

    return () => {
      clearTocAutoScrollTimer()
    }
  }, [activeId, clearTocAutoScrollTimer])

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return

    unlockProgrammaticLock()
    programmaticLockRef.current = true
    programmaticTargetRef.current = id

    const top = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top, behavior: "smooth" })
    setActiveId(id)

    lockTimerRef.current = window.setTimeout(() => {
      unlockProgrammaticLock()
    }, 2500)
  }

  // 二级标题挂到前一个一级标题下；文章开头若直接是三级标题，单独成组且始终展开
  const groups = useMemo(() => {
    const result: TocGroup[] = []
    for (const h of headings) {
      if (h.level === 2) result.push({ head: h, subs: [] })
      else if (result.length === 0) result.push({ head: null, subs: [h] })
      else result[result.length - 1].subs.push(h)
    }
    return result
  }, [headings])

  const isRail = variant === "rail"

  // 进度条格数随侧栏宽度铺满：可用宽度 ÷ 单个等宽字符宽度。字符宽度实测（字体加载前后会变），
  // 侧栏宽度变化或字体就绪时重新计算。React 19 的 ref 回调可以返回清理函数
  const [cells, setCells] = useState(24)
  const progressBarRef = useCallback((bar: HTMLSpanElement | null) => {
    if (!bar) return
    const probe = bar.querySelector<HTMLSpanElement>("[data-cell-probe]")
    const measure = () => {
      const cellWidth = probe ? probe.getBoundingClientRect().width / 10 : 0
      if (cellWidth > 0) setCells(Math.max(8, Math.floor(bar.clientWidth / cellWidth)))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [])

  const [percent, setPercent] = useState(0)
  useReadingProgress((p) => {
    if (isRail) setPercent(Math.round(p * 100))
  })

  // 文章大标题滚出视口后，侧栏顶部接住标题
  const [titleShown, setTitleShown] = useState(false)
  useEffect(() => {
    if (!isRail || !title) return
    const h1 = document.querySelector("main h1[data-pagefind-meta='title']")
    if (!h1) return
    const io = new IntersectionObserver(([entry]) => {
      setTitleShown(!entry.isIntersecting && entry.boundingClientRect.bottom < 0)
    })
    io.observe(h1)
    return () => io.disconnect()
  }, [isRail, title])

  if (headings.length === 0) return null

  const renderLink = (heading: TocItem, sub: boolean) => {
    const active = activeId === heading.id
    return (
      <a
        key={heading.id}
        href={`#${heading.id}`}
        onClick={(e) => handleClick(e, heading.id)}
        aria-current={active ? "location" : undefined}
        className={cn(
          "flex gap-2.5 py-[3px] text-[13px] leading-[1.6] transition-colors duration-200",
          sub && "pl-[18px]",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 font-mono transition-colors duration-200",
            active ? "text-primary" : "text-muted-foreground/45",
          )}
        >
          └
        </span>
        <span className="line-clamp-2 min-w-0">{heading.text}</span>
      </a>
    )
  }

  const tree = (
    <div>
      {groups.map((group, gi) => {
        const open =
          !isRail ||
          !group.head ||
          group.head.id === activeId ||
          group.subs.some((h) => h.id === activeId)
        return (
          <div key={group.head?.id ?? `lead-${gi}`}>
            {group.head && renderLink(group.head, false)}
            {group.subs.length > 0 && (
              // grid-template-rows 0fr ↔ 1fr：不用测量高度就能过渡到 auto
              <div
                className={cn(
                  "grid transition-[grid-template-rows,visibility] duration-300 motion-reduce:transition-none",
                  EASE_OUT,
                  open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  {group.subs.map((h) => renderLink(h, Boolean(group.head)))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  if (!isRail) {
    return (
      <nav ref={navRef} aria-label="目录" className="toc-nav">
        {tree}
      </nav>
    )
  }

  const filled = Math.round((percent / 100) * cells)

  return (
    <nav ref={navRef} aria-label="目录" className="toc-nav flex max-h-[calc(100dvh-8rem)] flex-col">
      {title && (
        <div
          aria-hidden={!titleShown}
          className={cn(
            "shrink-0 overflow-hidden font-serif text-base font-semibold leading-snug text-foreground text-pretty",
            "transition-[opacity,transform,max-height,margin] duration-[400ms] motion-reduce:transition-none",
            EASE_OUT,
            titleShown ? "mb-6 max-h-60 translate-y-0 opacity-100" : "max-h-0 translate-y-2 opacity-0",
          )}
        >
          {title}
        </div>
      )}
      <div className="mb-3 shrink-0 font-mono text-[11px] tracking-[0.2em] text-muted-foreground">目录</div>
      <div className="toc-scroll-container toc-scrollbar min-h-0 overflow-y-auto overscroll-contain pr-2">
        {tree}
      </div>
      {/* 字符进度条：▓ 已读、░ 未读，与 claude.dev 同法直接输出字符，依赖 --font-mono 里这两个字形等宽。
          条占满百分比左侧的全部空间，格数按宽度实测计算；百分比固定在右，任何宽度下都不会被挤出去 */}
      <div
        className="mt-6 flex shrink-0 items-baseline gap-2.5 font-mono text-[12px]"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span
          ref={progressBarRef}
          aria-hidden="true"
          className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-muted-foreground/40"
        >
          <span className="text-primary">{"▓".repeat(filled)}</span>
          {"░".repeat(cells - filled)}
          {/* 量字符宽度用的探针：10 个字符取平均，不占位、不可见 */}
          <span data-cell-probe className="invisible absolute left-0 top-0">
            ░░░░░░░░░░
          </span>
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{String(percent).padStart(2, "0")}%</span>
      </div>
    </nav>
  )
}
