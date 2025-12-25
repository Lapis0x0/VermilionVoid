"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "首页", href: "/" },
  { name: "文章", href: "/posts" },
  { name: "搜索", href: "/search" },
  { name: "书架", href: "/bookshelf" },
  { name: "友链", href: "/friends" },
  { name: "关于", href: "/about" },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
        scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border/50 py-4" : "bg-transparent py-6",
      )}
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="group flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <span className="text-primary-foreground font-serif text-sm font-semibold">思</span>
          </div>
          <span className="text-foreground font-medium tracking-tight hidden sm:block">思维边界</span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 relative group"
            >
              {item.name}
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 -mr-2"
          aria-label="Toggle menu"
        >
          <div className="w-5 h-4 flex flex-col justify-between">
            <span
              className={cn(
                "w-full h-px bg-foreground transition-all duration-300",
                mobileMenuOpen && "rotate-45 translate-y-1.5",
              )}
            />
            <span
              className={cn("w-full h-px bg-foreground transition-all duration-300", mobileMenuOpen && "opacity-0")}
            />
            <span
              className={cn(
                "w-full h-px bg-foreground transition-all duration-300",
                mobileMenuOpen && "-rotate-45 -translate-y-1.5",
              )}
            />
          </div>
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border overflow-hidden transition-all duration-300",
          mobileMenuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="flex flex-col px-6 py-4 gap-4">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {item.name}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
