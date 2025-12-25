"use client"

import { useEffect, useState } from "react"

type PagefindResult = {
  id: string
  data: () => Promise<{
    url: string
    title: string
    excerpt: string
  }>
}

declare global {
  interface Window {
    pagefind?: {
      search: (query: string) => Promise<{ results: PagefindResult[] }>
    }
  }
}

export function Search() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PagefindResult[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const isProd = import.meta.env.PROD

  useEffect(() => {
    if (!isProd) {
      return
    }

    let cancelled = false

    const loadPagefind = async () => {
      if (window.pagefind) {
        setStatus("ready")
        return
      }

      setStatus("loading")
      const script = document.createElement("script")
      script.src = "/pagefind/pagefind.js"
      script.async = true
      script.onload = () => {
        if (!cancelled) {
          setStatus("ready")
        }
      }
      script.onerror = () => {
        if (!cancelled) {
          setStatus("error")
        }
      }
      document.head.appendChild(script)
    }

    loadPagefind()

    return () => {
      cancelled = true
    }
  }, [isProd])

  useEffect(() => {
    if (!isProd || !window.pagefind) {
      return
    }

    const runSearch = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }

      try {
        const { results: searchResults } = await window.pagefind!.search(query)
        setResults(searchResults)
      } catch (error) {
        console.error("Pagefind search failed:", error)
      }
    }

    runSearch()
  }, [query, isProd])

  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-foreground mb-3">搜索</h1>
        <p className="text-muted-foreground">在全站文章中查找关键词。</p>
      </div>

      {!isProd && (
        <div className="mb-6 rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          Pagefind 只在生产构建后可用，请先执行 `pnpm build` 再 `pnpm preview`。
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入关键词..."
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {status === "loading" && <span className="text-xs text-muted-foreground">加载中...</span>}
        {status === "error" && <span className="text-xs text-destructive">加载失败</span>}
      </div>

      <div className="mt-8 space-y-4">
        {results.length === 0 && query.trim() ? (
          <div className="text-sm text-muted-foreground">未找到相关结果。</div>
        ) : null}

        {results.map((result) => (
          <SearchResult key={result.id} result={result} />
        ))}
      </div>
    </div>
  )
}

function SearchResult({ result }: { result: PagefindResult }) {
  const [data, setData] = useState<{ url: string; title: string; excerpt: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    result.data().then((payload) => {
      if (!cancelled) {
        setData(payload)
      }
    })
    return () => {
      cancelled = true
    }
  }, [result])

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">加载结果...</div>
    )
  }

  return (
    <a
      href={data.url}
      className="group block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
    >
      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{data.title}</h3>
      <div
        className="mt-2 text-sm text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: data.excerpt }}
      />
    </a>
  )
}
