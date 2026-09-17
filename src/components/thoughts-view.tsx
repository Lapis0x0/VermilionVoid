"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { articleProseClass } from "@/lib/article-prose"

export type ThoughtMeta = {
  slug: string
  title?: string
  content: string
  date: string
  tags: string[]
}

type Mode = "quiet" | "timeline"

const MODE_KEY = "thoughts.mode"

function stripHtmlToPreview(html: string, max = 10) {
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max) + "…" : text
}

const LIGHTBOX_ATTR = "data-thoughts-lightbox"
const isLightboxOpen = () => document.documentElement.hasAttribute(LIGHTBOX_ATTR)

// 点击正文图片时在当前页放大预览，点任意处或按 Esc 退出。
function ImageLightbox() {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const img = (e.target as HTMLElement | null)?.closest?.(".thoughts-body img")
      if (!(img instanceof HTMLImageElement)) return
      e.preventDefault()
      setSrc(img.currentSrc || img.src)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  useEffect(() => {
    if (!src) return
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    root.setAttribute(LIGHTBOX_ATTR, "")
    root.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSrc(null)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      root.removeAttribute(LIGHTBOX_ATTR)
      root.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [src])

  if (!src) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      className="thoughts-cross-fade fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={() => setSrc(null)}
    >
      <img
        src={src}
        alt=""
        className="thoughts-fade-up max-h-full max-w-full rounded-lg object-contain shadow-2xl"
      />
    </div>
  )
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const btn = (key: Mode, label: string, icon: React.ReactNode) => {
    const on = mode === key
    return (
      <button
        onClick={() => onChange(key)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition-all",
          on
            ? "bg-foreground text-background font-medium"
            : "text-muted-foreground hover:text-foreground",
        )}
        style={{ letterSpacing: 0.3 }}
      >
        {icon}
        {label}
      </button>
    )
  }
  return (
    <div className="inline-flex items-center gap-0.5 p-[3px] rounded-full bg-muted border border-border">
      {btn(
        "quiet",
        "专注",
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3" />
          <circle cx="8" cy="8" r="6" opacity="0.4" />
        </svg>,
      )}
      {btn(
        "timeline",
        "时间线",
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="4" cy="4" r="1.5" fill="currentColor" />
          <circle cx="4" cy="12" r="1.5" />
          <path d="M4 5.5v5" />
          <path d="M7 4h6M7 12h5" />
        </svg>,
      )}
    </div>
  )
}

function QuietMode({
  thoughts,
  idx,
  onJump,
  onSwitchMode,
}: {
  thoughts: ThoughtMeta[]
  idx: number
  onJump: (i: number) => void
  onSwitchMode: (m: Mode) => void
}) {
  const t = thoughts[idx]
  const prev = thoughts[(idx - 1 + thoughts.length) % thoughts.length]
  const next = thoughts[(idx + 1) % thoughts.length]

  const idxRef = useRef(idx)
  idxRef.current = idx
  const onJumpRef = useRef(onJump)
  onJumpRef.current = onJump

  useEffect(() => {
    const len = thoughts.length
    const onKey = (e: KeyboardEvent) => {
      if (isLightboxOpen()) return
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return
      }
      const cur = idxRef.current
      if (e.key === "ArrowLeft") onJumpRef.current((cur - 1 + len) % len)
      if (e.key === "ArrowRight") onJumpRef.current((cur + 1) % len)
    }
    window.addEventListener("keydown", onKey)

    let startX = 0
    let startY = 0
    let tracking = false
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      tracking = true
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      if (isLightboxOpen()) return
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      const cur = idxRef.current
      if (dx < 0) onJumpRef.current((cur + 1) % len)
      else onJumpRef.current((cur - 1 + len) % len)
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [thoughts.length])

  const prevLabel = useMemo(
    () => prev.title || stripHtmlToPreview(prev.content),
    [prev],
  )
  const nextLabel = useMemo(
    () => next.title || stripHtmlToPreview(next.content),
    [next],
  )

  if (!t) return null

  return (
    <div key="quiet" className="thoughts-cross-fade relative w-full font-sans text-foreground">
      {/* mode switch (desktop: top-right) */}
      <div className="hidden sm:block absolute right-8 top-6 z-10">
        <ModeSwitch mode="quiet" onChange={onSwitchMode} />
      </div>

      {/* prev rail (desktop only) */}
      <button
        onClick={() => onJump((idx - 1 + thoughts.length) % thoughts.length)}
        aria-label="前一则"
        className="hidden lg:flex fixed left-10 top-1/2 -translate-y-1/2 flex-col items-center gap-3.5 border-0 bg-transparent cursor-pointer font-mono text-[12px] tracking-widest text-muted-foreground opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M9 2L3 7l6 5" />
        </svg>
        <span style={{ writingMode: "vertical-rl", letterSpacing: 2 }}>
          前一则 · {prevLabel}
        </span>
      </button>
      <button
        onClick={() => onJump((idx + 1) % thoughts.length)}
        aria-label="后一则"
        className="hidden lg:flex fixed right-10 top-1/2 -translate-y-1/2 flex-col items-center gap-3.5 border-0 bg-transparent cursor-pointer font-mono text-[12px] tracking-widest text-muted-foreground opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M5 2l6 5-6 5" />
        </svg>
        <span style={{ writingMode: "vertical-rl", letterSpacing: 2 }}>
          后一则 · {nextLabel}
        </span>
      </button>

      {/* content */}
      <article
        key={t.slug}
        className="thoughts-fade-up mx-auto flex flex-col"
        // 至少占满首屏（减去 5rem 的顶栏）：编号/日期贴上方，翻页提示贴下方，正文在中间上下居中；
        // 正文长过一屏时中间区域自然撑开，退化为普通的从上往下排
        style={{ maxWidth: 640, padding: "56px 24px 80px", minHeight: "calc(100svh - 5rem)" }}
      >
        <div className="flex justify-center mb-10 sm:hidden">
          <ModeSwitch mode="quiet" onChange={onSwitchMode} />
        </div>
        <div className="text-center mb-11">
          <div
            className="font-serif italic text-[11px] text-muted-foreground uppercase"
            style={{ letterSpacing: 5 }}
          >
            Serendipity · №{" "}
            {String(thoughts.length - idx).padStart(2, "0")} of {thoughts.length}
          </div>
          <div
            className="mt-3 font-mono text-[12px] text-muted-foreground"
            style={{ letterSpacing: 2 }}
          >
            {t.date.replace(/[.\-]/g, " · ")}
          </div>
          <div
            className="mx-auto mt-5 flex flex-wrap justify-center gap-1.5"
            style={{ maxWidth: 400 }}
          >
            {thoughts.map((_, i) => (
              <button
                key={i}
                onClick={() => onJump(i)}
                aria-label={`跳到第 ${i + 1} 则`}
                className={cn(
                  "rounded-sm border-0 p-0 cursor-pointer transition-all",
                  i === idx ? "bg-primary opacity-100" : "bg-muted-foreground opacity-40 hover:opacity-70",
                )}
                style={{ width: i === idx ? 18 : 4, height: 4 }}
              />
            ))}
          </div>
        </div>

        {/* 上下留白按 2:3 分配而不是 1:1：视觉中心在几何中心略偏上，且顶部信息比底部翻页提示厚 */}
        <div className="flex flex-1 flex-col">
          <div className="flex-[2]" />
          {t.title && (
            <h1
              className="font-serif font-bold text-center text-foreground"
              style={{
                fontSize: "clamp(32px, 6vw, 52px)",
                fontWeight: 500,
                margin: "0 0 44px",
                letterSpacing: 4,
                lineHeight: 1.3,
              }}
            >
              {t.title}
            </h1>
          )}

          <div
            className={cn(articleProseClass, "text-left thoughts-body thoughts-quiet-body")}
            dangerouslySetInnerHTML={{ __html: t.content }}
          />

          {t.tags.length > 0 && (
            <div
              className="flex items-center justify-center gap-6 font-mono text-[12px] text-muted-foreground"
              style={{ marginTop: 44, letterSpacing: 1 }}
            >
              <span className="inline-block h-px w-10 bg-border" />
              <span>{t.tags.map((tag) => "#" + tag).join("  ·  ")}</span>
              <span className="inline-block h-px w-10 bg-border" />
            </div>
          )}
          <div className="flex-[3]" />
        </div>

        <div
          className="mt-11 text-center font-mono text-[11px] text-muted-foreground"
          style={{ letterSpacing: 2 }}
        >
          <kbd className="thoughts-kbd">←</kbd> 前一则 &nbsp;·&nbsp; <kbd className="thoughts-kbd">→</kbd> 后一则
        </div>
      </article>
    </div>
  )
}

function TimelineMode({
  thoughts,
  activeTag,
  onTagChange,
  onSwitchMode,
}: {
  thoughts: ThoughtMeta[]
  activeTag: string
  onTagChange: (t: string) => void
  onSwitchMode: (m: Mode) => void
}) {
  const allTags = useMemo(
    () => Array.from(new Set(thoughts.flatMap((t) => t.tags))),
    [thoughts],
  )
  const filter = (t: ThoughtMeta) => activeTag === "全部" || t.tags.includes(activeTag)


  const groups = useMemo(() => {
    const map = new Map<string, ThoughtMeta[]>()
    for (const t of thoughts) {
      const year = t.date.slice(0, 4)
      if (!map.has(year)) map.set(year, [])
      map.get(year)!.push(t)
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([year, items]) => ({ year, items }))
  }, [thoughts])

  return (
    <div key="timeline" className="thoughts-cross-fade relative w-full font-sans text-foreground">
      <div className="hidden sm:block absolute right-8 top-6 z-10">
        <ModeSwitch mode="timeline" onChange={onSwitchMode} />
      </div>
      <div className="mx-auto" style={{ maxWidth: 760, padding: "40px 24px 80px" }}>
        <div className="mb-8 flex justify-center sm:hidden">
          <ModeSwitch mode="timeline" onChange={onSwitchMode} />
        </div>
        <div className="mb-8">
          <div
            className="font-mono text-[11px] uppercase text-muted-foreground mb-2.5"
            style={{ letterSpacing: 3 }}
          >
            SERENDIPITY
          </div>
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-7 rounded-sm bg-primary" />
            <div className="font-serif text-[36px] font-bold leading-none tracking-tight text-foreground">
              偶得
            </div>
          </div>
        </div>
        <div className="mb-10 flex flex-wrap gap-1.5 border-b border-border pb-5">
          {["全部", ...allTags].map((tag) => {
            const on = activeTag === tag
            return (
              <button
                key={tag}
                onClick={() => onTagChange(tag)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] transition-all",
                  on
                    ? "bg-foreground text-background border border-foreground"
                    : "border border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tag === "全部" ? "全部" : "#" + tag}
              </button>
            )
          })}
        </div>

        {groups.map((group) => {
          const items = group.items.filter(filter)
          if (!items.length) return null
          return (
            <div key={group.year} className="mb-10">
              <div className="mb-6 flex items-center gap-4">
                <div
                  className="font-mono text-[14px] font-semibold text-muted-foreground"
                  style={{ letterSpacing: 2 }}
                >
                  {group.year}
                </div>
                <div className="h-px flex-1 bg-border" />
                <div className="font-mono text-[12px] text-muted-foreground">
                  {items.length} 则
                </div>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-[3px] top-2 bottom-2 w-px bg-border" />
                {items.map((t) => {
                  return (
                    <div
                      key={t.slug}
                      id={`thought-${t.slug}`}
                      className="relative mb-7 -ml-3 rounded-md px-3 pb-2 pt-1 scroll-mt-28"
                    >
                      <div className="relative mb-1.5 flex items-center gap-3">
                        <span
                          className="absolute left-[-24px] top-1/2 -translate-y-1/2 h-[7px] w-[7px] rounded-full border-[1.5px] bg-primary border-primary"
                        />
                        <span className="font-mono text-[13px] text-muted-foreground">
                          {t.date.slice(5)}
                        </span>
                        {t.tags.map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[12px] text-muted-foreground/80"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      {t.title && (
                        <div className="mb-2 font-display-sans text-xl font-semibold leading-snug text-foreground">
                          {t.title}
                        </div>
                      )}
                      <div
                        className={cn(articleProseClass, "max-w-none thoughts-body")}
                        dangerouslySetInnerHTML={{ __html: t.content }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {thoughts.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">暂无偶得</div>
        )}
      </div>
    </div>
  )
}

export function ThoughtsView({ thoughts }: { thoughts: ThoughtMeta[] }) {
  const total = thoughts.length
  const [mode, setMode] = useState<Mode>("quiet")
  const [idx, setIdx] = useState(0)
  const [activeTag, setActiveTag] = useState("全部")
  const [hydrated, setHydrated] = useState(false)

  // Resolve initial state from URL hash / query / localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    const query = new URLSearchParams(window.location.search)

    let initialMode: Mode = (localStorage.getItem(MODE_KEY) as Mode) || "quiet"
    // Always start at the latest thought (idx 0). URL hash can still jump to a specific one.
    let initialIdx = 0

    const hashMatch = hash.match(/^#thought-(.+)$/)
    if (hashMatch) {
      const slug = decodeURIComponent(hashMatch[1])
      const i = thoughts.findIndex((t) => t.slug === slug)
      if (i >= 0) {
        initialIdx = i
        initialMode = "quiet"
      }
    }

    const queryTag = query.get("tag")?.trim()
    if (queryTag) {
      if (queryTag === "全部" || thoughts.some((t) => t.tags.includes(queryTag))) {
        setActiveTag(queryTag)
        initialMode = "timeline"
      }
    }

    setMode(initialMode)
    setIdx(initialIdx)
    setHydrated(true)
  }, [thoughts, total])

  useEffect(() => {
    if (hydrated) localStorage.setItem(MODE_KEY, mode)
  }, [hydrated, mode])

  const syncHash = useCallback((slug: string | null) => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.hash = slug ? `thought-${slug}` : ""
    window.history.replaceState({}, "", url.toString())
  }, [])

  const syncTag = useCallback((tag: string) => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (tag && tag !== "全部") url.searchParams.set("tag", tag)
    else url.searchParams.delete("tag")
    window.history.replaceState({}, "", url.toString())
  }, [])

  const handleJump = useCallback(
    (i: number) => {
      setIdx(i)
      syncHash(thoughts[i]?.slug ?? null)
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
    },
    [syncHash, thoughts],
  )

  const handleSwitchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      if (m === "timeline") syncHash(null)
      else syncHash(thoughts[idx]?.slug ?? null)
    },
    [syncHash, thoughts, idx],
  )

  const handleTagChange = useCallback(
    (tag: string) => {
      setActiveTag(tag)
      syncTag(tag)
    },
    [syncTag],
  )

  if (total === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-32 text-center text-muted-foreground">
        暂无偶得
      </div>
    )
  }

  const view = mode === "quiet" ? (
    <QuietMode
      thoughts={thoughts}
      idx={Math.min(idx, total - 1)}
      onJump={handleJump}
      onSwitchMode={handleSwitchMode}
    />
  ) : (
    <TimelineMode
      thoughts={thoughts}
      activeTag={activeTag}
      onTagChange={handleTagChange}
      onSwitchMode={handleSwitchMode}
    />
  )

  return (
    <>
      {view}
      <ImageLightbox />
    </>
  )
}
