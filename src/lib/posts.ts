import { getCollection, type CollectionEntry } from "astro:content"
import readingTime from "reading-time"

export type PostEntry = CollectionEntry<"posts">
export type SidebarCategory = { id: string; name: string; count: number }

const stripMarkdown = (input: string) => {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const formatDate = (date?: Date) => {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

export async function getSortedPosts(ignorePinned = false): Promise<PostEntry[]> {
  const allPosts = await getCollection("posts", (post: PostEntry) => {
    return import.meta.env.PROD ? post.data.draft !== true : true
  })

  const sorted = allPosts.sort((a: PostEntry, b: PostEntry) => {
    if (!ignorePinned) {
      if (a.data.pinned && !b.data.pinned) return -1
      if (!a.data.pinned && b.data.pinned) return 1
    }
    const dateA = new Date(a.data.published)
    const dateB = new Date(b.data.published)
    return dateA > dateB ? -1 : 1
  })

  return sorted
}

export async function getPostsWithNav(): Promise<PostEntry[]> {
  const sorted = await getSortedPosts()
  for (let i = 1; i < sorted.length; i += 1) {
    sorted[i].data.nextSlug = sorted[i - 1].id
    sorted[i].data.nextTitle = sorted[i - 1].data.title
  }
  for (let i = 0; i < sorted.length - 1; i += 1) {
    sorted[i].data.prevSlug = sorted[i + 1].id
    sorted[i].data.prevTitle = sorted[i + 1].data.title
  }
  return sorted
}

export const toPostMeta = (post: PostEntry) => {
  const body = typeof post.body === "string" ? post.body : String(post.body || "")
  const stats = readingTime(body)
  const words = stats.words
  const minutes = Math.max(1, Math.round(stats.minutes))
  const excerptSource = post.data.description?.trim() || ""
  const fallbackExcerpt = stripMarkdown(body).slice(0, 140)
  const excerpt = excerptSource.length > 0 ? excerptSource : fallbackExcerpt
  const tags = post.data.tags?.length ? post.data.tags : []
  const category = (post.data.category ?? "").toString().trim() || "未分类"

  return {
    slug: post.id,
    title: post.data.title,
    excerpt,
    category,
    categoryLabel: category,
    tags,
    date: formatDate(post.data.published),
    wordCount: words,
    readTime: `${minutes} 分钟`,
    image: post.data.image || undefined,
    pinned: post.data.pinned ?? false,
  }
}

export const buildSidebarMeta = (articles: { category: string; categoryLabel: string; tags: string[] }[]) => {
  const counts = new Map<string, SidebarCategory>()
  articles.forEach((article) => {
    if (!counts.has(article.category)) {
      counts.set(article.category, { id: article.category, name: article.categoryLabel, count: 0 })
    }
    counts.get(article.category)!.count += 1
  })

  const categories = [
    { id: "all", name: "全部", count: articles.length },
    ...Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name)),
  ]

  const tags = Array.from(new Set(articles.flatMap((article) => article.tags || []))).sort((a, b) =>
    a.localeCompare(b),
  )

  return { categories, tags }
}
