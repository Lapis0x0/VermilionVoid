// 博客正文的排版（字体、字号、行高、深色模式前景色等），文章页和偶得共用。
// 不含宽度与居中，由使用方自己决定。
export const articleProseClass = [
  "prose prose-neutral dark:prose-invert",
  "prose-headings:font-serif prose-headings:font-bold",
  "prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:flex prose-h2:items-center prose-h2:gap-3",
  "prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3",
  "prose-h4:text-xl",
  "prose-p:text-[16.5px] prose-p:leading-[1.85] prose-p:my-5 prose-p:text-foreground/90 dark:prose-p:text-foreground",
  "prose-a:text-primary prose-a:no-underline prose-a:hover:underline",
  "prose-blockquote:border-l-primary prose-blockquote:border-l-2 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-[16.5px] prose-blockquote:leading-[1.85] prose-blockquote:text-content-secondary prose-blockquote:font-normal",
  "prose-strong:text-foreground prose-strong:font-semibold",
  "prose-code:text-primary prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-secondary prose-pre:border prose-pre:border-border",
  "prose-ol:text-[16.5px] prose-ul:text-[16.5px] prose-ol:text-foreground/90 prose-ul:text-foreground/90 dark:prose-ol:text-foreground dark:prose-ul:text-foreground prose-ol:my-5 prose-ul:my-5",
  "prose-li:marker:text-primary prose-li:my-1.5 prose-li:leading-[1.85]",
  "prose-table:text-sm",
  "prose-th:bg-secondary prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-medium",
  "prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-border",
  "prose-hr:border-border prose-hr:my-8",
].join(" ")
