import rss from "@astrojs/rss"
import type { APIContext } from "astro"
import MarkdownIt from "markdown-it"
import sanitizeHtml from "sanitize-html"
import { getSortedThoughts } from "@/lib/thoughts"

const parser = new MarkdownIt()

function stripInvalidXmlChars(str: string): string {
  return str.replace(
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F﷐-﷯￾￿]/g,
    "",
  )
}

const stripHtml = (html: string) =>
  html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n\s*\n+/g, "\n")
    .trim()

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+$/, "")}...`

export async function GET(context: APIContext) {
  const thoughts = await getSortedThoughts()
  const site = context.site ?? new URL("https://www.lapis.cafe")
  const base = `${site.href.replace(/\/$/, "")}/thoughts/`

  return rss({
    title: "时歌的偶得 | Boundary of Thought",
    description: "日常的碎片思考与随手记录",
    site,
    items: thoughts.map((thought) => {
      const body = typeof thought.body === "string" ? thought.body : ""
      const html = sanitizeHtml(parser.render(stripInvalidXmlChars(body)), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
      })

      return {
        // 偶得多数没有标题，缺省时用正文开头顶上，否则阅读器里只会显示一列日期。
        title: thought.data.title || truncate(stripHtml(html), 40) || "偶得",
        pubDate: thought.data.published,
        description: truncate(stripHtml(html), 160),
        content: html,
        // 偶得没有独立页面，只有 /thoughts/ 上的锚点。@astrojs/rss 的 guid 恒等于 link
        // 且不可自定义，所以锚点就是阅读器唯一的去重依据，必须逐条不同。
        // 这里必须给绝对 URL：相对路径会被 createCanonicalURL 补上尾斜杠，
        // 变成 `#thought-xxx/`，前端按 hash 定位就找不到对应的偶得了。
        link: `${base}#thought-${thought.id}`,
        categories: thought.data.tags?.length ? thought.data.tags : undefined,
      }
    }),
    customData: "<language>zh-CN</language>",
  })
}
