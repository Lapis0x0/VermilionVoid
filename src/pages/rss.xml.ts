import rss from "@astrojs/rss"
import type { APIContext } from "astro"
import MarkdownIt from "markdown-it"
import sanitizeHtml from "sanitize-html"
import { getSortedPosts } from "@/lib/posts"

const parser = new MarkdownIt()

function stripInvalidXmlChars(str: string): string {
  return str.replace(
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
    "",
  )
}

export async function GET(context: APIContext) {
  const posts = await getSortedPosts(true)
  const publicPosts = posts.filter((post) => !post.data.encrypted)

  return rss({
    title: "思维边界 | Boundary of Thought",
    description: "探索金融、社会与人工智能的交汇点",
    site: context.site ?? "https://example.com",
    items: publicPosts.map((post) => {
      const content = typeof post.body === "string" ? post.body : String(post.body || "")
      const cleanedContent = stripInvalidXmlChars(content)
      return {
        title: post.data.title,
        pubDate: post.data.published,
        description: post.data.description || "",
        link: `/posts/${post.slug}/`,
        content: sanitizeHtml(parser.render(cleanedContent), {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        }),
      }
    }),
    customData: "<language>zh-CN</language>",
  })
}
