import { defineCollection, z } from "astro:content"

const articles = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    excerpt: z.string().optional(),
    category: z.string(),
    categoryLabel: z.string(),
    tag: z.string(),
    date: z.coerce.date(),
    wordCount: z.number().optional(),
    readTime: z.string().optional(),
    image: z.string().optional(),
    pinned: z.boolean().optional(),
  }),
})

const posts = defineCollection({
  type: "content",
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
  type: "content",
  schema: z.object({
    title: z.string().optional(),
    published: z.date(),
    tags: z.array(z.string()).optional().default([]),
  }),
})

export const collections = { articles, posts, thoughts }
