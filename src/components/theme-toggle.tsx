import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      data-theme-toggle
      className={cn(
        "p-2 rounded-full transition-colors duration-200",
        "hover:bg-muted",
        className
      )}
      aria-label="切换主题"
    >
      {/* 太阳图标 */}
      <svg
        className="w-5 h-5 text-foreground dark:hidden"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="4" strokeWidth="2" />
        <path
          strokeLinecap="round"
          strokeWidth="2"
          d="M12 2v2m0 16v2M4 12H2m20 0h-2m-2.05-6.95l-1.41 1.41m-9.9 9.9l-1.41 1.41m0-12.73l1.41 1.41m9.9 9.9l1.41 1.41"
        />
      </svg>
      {/* 月亮图标 */}
      <svg
        className="w-5 h-5 text-foreground hidden dark:block"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  )
}
