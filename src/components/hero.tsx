"use client"

import { useEffect, useState, useCallback, useRef } from "react"

const phrases = [
  { prefix: "探求 AI 的", highlight: "边界" },
  { prefix: "追问金融的", highlight: "理性" },
  { prefix: "分析社会的", highlight: "结构" },
  { prefix: "记录跨学科", highlight: "洞见" },
]

export function Hero() {
  const [mounted, setMounted] = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [displayText, setDisplayText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [cursorOpacity, setCursorOpacity] = useState(1)
  const cursorAnimationRef = useRef<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let startTime: number | null = null
    const duration = 800 // ms for one cycle

    const animateCursor = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = (elapsed % duration) / duration
      // Sine wave for smooth transition: 1 -> 0.3 -> 1
      const opacity = 0.3 + 0.7 * Math.abs(Math.sin(progress * Math.PI))
      setCursorOpacity(opacity)
      cursorAnimationRef.current = requestAnimationFrame(animateCursor)
    }

    cursorAnimationRef.current = requestAnimationFrame(animateCursor)
    return () => {
      if (cursorAnimationRef.current) {
        cancelAnimationFrame(cursorAnimationRef.current)
      }
    }
  }, [])

  const getTypeSpeed = useCallback(() => {
    // Random variation for natural typing rhythm (50-90ms)
    return 50 + Math.random() * 40
  }, [])

  const getDeleteSpeed = useCallback(() => {
    // Faster, more consistent deletion (25-40ms)
    return 25 + Math.random() * 15
  }, [])

  const typeWriter = useCallback(() => {
    const currentPhrase = phrases[phraseIndex]
    const fullText = currentPhrase.prefix + currentPhrase.highlight

    if (!isDeleting) {
      if (displayText.length < fullText.length) {
        setTimeout(() => {
          setDisplayText(fullText.slice(0, displayText.length + 1))
        }, getTypeSpeed())
      } else {
        setTimeout(() => setIsDeleting(true), 1500)
      }
    } else {
      if (displayText.length > 0) {
        setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, getDeleteSpeed())
      } else {
        setIsDeleting(false)
        setPhraseIndex((prev) => (prev + 1) % phrases.length)
      }
    }
  }, [displayText, isDeleting, phraseIndex, getTypeSpeed, getDeleteSpeed])

  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(typeWriter, 50)
      return () => clearTimeout(timer)
    }
  }, [mounted, typeWriter])

  const renderText = () => {
    const currentPhrase = phrases[phraseIndex]
    const prefixLength = currentPhrase.prefix.length

    if (displayText.length <= prefixLength) {
      return <span>{displayText}</span>
    } else {
      return (
        <>
          <span>{currentPhrase.prefix}</span>
          <span className="text-primary">{displayText.slice(prefixLength)}</span>
        </>
      )
    }
  }

  const handleBrowseClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const target = document.getElementById("home-main")
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "start" })
    if (history.replaceState) {
      history.replaceState({}, "", "#home-main")
    }
  }, [])

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto text-center">
        <div
          className={`transition-all duration-1000 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-xs sm:text-sm tracking-[0.3em] text-muted-foreground uppercase mb-8">
            金融学 · 社会学 · AI 大模型
          </p>

          <h1 className="font-sans text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.1] mb-8 min-h-[1.2em]">
            {renderText()}
            <span
              className="inline-block w-[4px] sm:w-[5px] md:w-[6px] lg:w-[7px] h-[48px] sm:h-[60px] md:h-[72px] lg:h-[96px] bg-foreground align-middle rounded-sm ml-2 -translate-y-1"
              style={{ opacity: cursorOpacity }}
            />
          </h1>

          <blockquote className="max-w-xl mx-auto mb-10">
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed italic">
              「我不知道我在想什么，直到我读到我写的东西。」
            </p>
            <footer className="mt-2 text-sm text-muted-foreground/70">
              —— Flannery O'Connor
            </footer>
          </blockquote>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#home-main"
              onClick={handleBrowseClick}
              className="group flex items-center gap-2 px-8 py-3 bg-foreground text-background rounded-full font-medium text-sm hover:bg-foreground/90 transition-all duration-300"
            >
              浏览文章
              <svg
                className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <a
              href="/about/"
              className="px-8 py-3 border border-border rounded-full font-medium text-sm text-foreground hover:border-foreground/40 transition-all duration-300"
            >
              关于我
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-px h-12 bg-gradient-to-b from-border to-transparent relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </section>
  )
}
