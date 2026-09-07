import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    published: z.date(),
    updated: z.date().optional(),
    draft: z.boolean().optional().default(false),
    description: z.string().optional().default(""),
    image: z.string().optional().default(""),
    tags: z.array(z.string()).optional().default([]),
    category: z.string().optional().nullable().default(""),
    lang: z.string().optional().default(""),
    pinned: z.boolean().optional().default(false),

    encrypted: z.boolean().optional().default(false),
    password: z.string().optional().default(""),
    disclaimer: z.union([z.string(), z.array(z.string())]).optional(),

    prevTitle: z.string().default(""),
    prevSlug: z.string().default(""),
    nextTitle: z.string().default(""),
    nextSlug: z.string().default(""),
  }),
})

const thoughts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/thoughts" }),
  schema: z.object({
    title: z.string().optional(),
    published: z.date(),
    tags: z.array(z.string()).optional().default([]),
  }),
})

const studies = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/studies" }),
  // 注意：frontmatter 里的 `slug` 字段在 glob loader 下不再是保留字，也不参与 URL 生成；
  // URL 用 entry.id（= 相对 base 的文件路径）。这里不声明 slug，正文里的 slug: 字段是冗余的。
  schema: z.object({
    title: z.string(),
    status: z.enum(["在读", "沉淀中", "暂搁", "已结"]),
    started: z.string(), // "YYYY-MM" 或 "YYYY-MM-DD"
    subtitle: z.string().optional(),
    epigraph: z.string().optional(),
    field: z.string().optional(),
  }),
})

export const collections = { posts, thoughts, studies }
