#!/usr/bin/env node
// Sync 长文 from a Notion database into src/content/posts/, and drive its publish workflow.
//
// Source of truth: the top-level Notion database「博客」, read through the internal integration
// 「VermilionVoid 博客同步」(read + update content, shared with that database only).
//
// 状态 is a small state machine; the writer only ever sets 草稿 / 待发布, everything else is ours:
//
//   草稿 ──writer──▶ 待发布 ──(--publish) claim──▶ 发布中 ──(--finalize) deployed──▶ 已发布
//                                                   └──────────── error ──────────▶ 发布失败 (+ 备注)
//
// - Only pages claimed in this run are (re-)rendered. 已发布 pages keep whatever file is already
//   on disk, so editing a live article in Notion changes nothing until it is set to 待发布 again.
// - A page whose status goes back to 草稿 (or that is deleted) loses its file on the next run.
// - Files land at `src/content/posts/<分类文件夹>/<Slug>.md` with `notion_id` in the frontmatter;
//   that field is how this script recognises its own posts. Hand-written posts are never touched.
// - Uploaded images and the cover go to `public/notion/<Slug>/`: Notion's file URLs expire in ~1h.
// - The sync-trigger Worker polls for 待发布 every minute and dispatches sync-notion.yml, and
//   fails pages stuck in 发布中 for more than 15 minutes.
//
// Modes:
//   (none)                   local: render missing 已发布 files, prune; claims nothing
//   --drafts                 local: additionally render every non-已发布 page into
//                            src/content/posts/notion-drafts/ (gitignored, `draft: true`, dev only)
//   --publish  --manifest F  CI step 1: claim 待发布 → 发布中, render them, prune, record claims in F
//   --finalize --manifest F  CI step 3 (after push): wait for Vercel on COMMIT_SHA, then 已发布
//   --fail     --manifest F  CI on failure: claimed pages still 发布中 → 发布失败 (--reason TEXT)
//
// Env:
//   NOTION_TOKEN           integration secret (ntn_…)
//   NOTION_DATA_SOURCE_ID  the database's data source id
//   NOTION_FORCE_PRUNE     `true` skips the "post count collapsed" guard
//   NOTION_SITE            default https://www.lapis.cafe
//   GITHUB_TOKEN / GITHUB_REPOSITORY / COMMIT_SHA   --finalize only
//
// Only Node built-ins, like sync-flomo.mjs.

import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, "..")
const POSTS_DIR = path.join(REPO_ROOT, "src", "content", "posts")
const DRAFTS_DIR = path.join(POSTS_DIR, "notion-drafts")
const IMAGES_DIR = path.join(REPO_ROOT, "public", "notion")
const DRAFT_IMAGES_DIR = path.join(REPO_ROOT, "public", "notion-drafts")

const TOKEN = (process.env.NOTION_TOKEN || "").trim()
const DATA_SOURCE_ID = (process.env.NOTION_DATA_SOURCE_ID || "").trim()
const FORCE_PRUNE = /^(1|true|yes)$/i.test((process.env.NOTION_FORCE_PRUNE || "").trim())
const SITE = (process.env.NOTION_SITE || "https://www.lapis.cafe").replace(/\/$/, "")

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const option = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? "" : argv[i + 1] || ""
}
const MODE = flag("--publish") ? "publish" : flag("--finalize") ? "finalize" : flag("--fail") ? "fail" : "local"
const WITH_DRAFTS = flag("--drafts")
const MANIFEST = option("--manifest")
if (MODE !== "local" && !MANIFEST) {
  console.error(`[sync-notion] --${MODE} needs --manifest <file>`)
  process.exit(1)
}

if (!TOKEN || !DATA_SOURCE_ID) {
  console.error("[sync-notion] Missing NOTION_TOKEN / NOTION_DATA_SOURCE_ID env vars.")
  process.exit(1)
}

// Database property names (see the「博客」database in Notion).
const PROP = {
  status: "状态",
  slug: "Slug",
  published: "发布日期",
  updated: "更新日期",
  category: "分类",
  tags: "标签",
  description: "摘要",
  pinned: "置顶",
}
const PROP_NOTE = "备注"

const STATUS = {
  draft: "草稿",
  queued: "待发布",
  publishing: "发布中",
  published: "已发布",
  failed: "发布失败",
}

// 分类 → existing folder under src/content/posts (the folder is part of the URL).
const CATEGORY_DIRS = {
  深度学习: "AI and Deep Learning",
  金融与经济: "Finance and Economics",
  技术教程: "TechnicalTutorials",
  随笔: "Essays",
  人类研究: "HumanSciences",
  宗教研究: "HumanSciences",
  浅度报告: "ScheduledReport",
  法学: "Law",
}
const FALLBACK_DIR = "Essays"

// ---- Notion API -----------------------------------------------------------

const API = "https://api.notion.com/v1"
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Notion-Version": "2025-09-03",
  "Content-Type": "application/json",
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastCall = 0

// Notion allows ~3 requests/s per integration; stay under it and honour Retry-After.
async function notion(method, pathname, body) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCall + 350 - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    const res = await fetch(`${API}${pathname}`, {
      method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined,
    })
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const retry = Number(res.headers.get("retry-after")) || 2 ** attempt
      await sleep(retry * 1000)
      continue
    }
    const data = await res.json()
    if (!res.ok) throw new Error(`Notion ${res.status} ${data.code}: ${data.message}`)
    return data
  }
}

// All pages in the database (optionally only one 状态), newest first.
async function queryPages(status) {
  const pages = []
  let cursor
  do {
    const data = await notion("POST", `/data_sources/${DATA_SOURCE_ID}/query`, {
      ...(status ? { filter: { property: PROP.status, select: { equals: status } } } : {}),
      start_cursor: cursor,
      page_size: 100,
    })
    pages.push(...data.results.filter((p) => p.object === "page" && !p.in_trash))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)
  return pages
}

const statusOf = (page) => page.properties?.[PROP.status]?.select?.name || ""

const textProp = (s) => ({ rich_text: s ? [{ type: "text", text: { content: s.slice(0, 1900) } }] : [] })

async function setStatus(pageId, status, { note = "", extra = {} } = {}) {
  await notion("PATCH", `/pages/${pageId}`, {
    properties: { [PROP.status]: { select: { name: status } }, [PROP_NOTE]: textProp(note), ...extra },
  })
}

// Fetch a block's children, recursing into every child that has children of its own.
async function fetchChildren(blockId) {
  const out = []
  let cursor
  do {
    const qs = new URLSearchParams({ page_size: "100", ...(cursor ? { start_cursor: cursor } : {}) })
    const data = await notion("GET", `/blocks/${blockId}/children?${qs}`)
    out.push(...data.results)
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)
  for (const b of out) {
    if (b.has_children && b.type !== "child_page" && b.type !== "child_database") {
      b.children = await fetchChildren(b.id)
    }
  }
  return out
}

// ---- rich text ------------------------------------------------------------

const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// Backslash-escape anything Markdown, remark-math ($) or remark-directive (:name) would read as syntax.
const escMd = (s) => s.replace(/[\\`*_[\]<>$~|#]/g, "\\$&").replace(/:(?=[A-Za-z])/g, "\\:")

const colorClass = (color) => {
  if (!color || color === "default") return ""
  return color.endsWith("_background") ? `nt-bg-${color.slice(0, -11)}` : `nt-${color}`
}

// Marks are emitted as HTML tags rather than `**`: CommonMark's flanking rules break `**` next to
// CJK punctuation (e.g. **“引号”**中文), and inline tags work in both Markdown and raw-HTML contexts.
// `html: true` is for places Markdown is not parsed (<summary>, <figcaption>, table-free HTML blocks).
function rich(items = [], { html = false } = {}) {
  let out = ""
  for (const r of items) {
    let s
    if (r.type === "equation") {
      s = html ? `<code>${escHtml(r.equation.expression)}</code>` : `$${r.equation.expression}$`
    } else {
      const text = r.plain_text ?? ""
      const a = r.annotations || {}
      if (a.code) {
        if (html) s = `<code>${escHtml(text)}</code>`
        else {
          const ticks = "`".repeat((text.match(/`+/g) || [""]).reduce((m, x) => Math.max(m, x.length), 0) + 1)
          s = `${ticks}${/^`|`$/.test(text) ? ` ${text} ` : text}${ticks}`
        }
      } else {
        s = (html ? escHtml(text) : escMd(text)).replace(/\n/g, "<br>")
      }
      if (a.bold) s = `<strong>${s}</strong>`
      if (a.italic) s = `<em>${s}</em>`
      if (a.strikethrough) s = `<del>${s}</del>`
      if (a.underline) s = `<u>${s}</u>`
      const cls = colorClass(a.color)
      if (cls) s = `<span class="${cls}">${s}</span>`
    }
    const href = r.href || r.text?.link?.url
    if (href) s = `<a href="${escHtml(href)}">${s}</a>`
    out += s
  }
  return out
}

const plain = (items = []) => items.map((r) => r.plain_text).join("")

// ---- blocks -> markdown ---------------------------------------------------

const CODE_LANGS = { "plain text": "text", "c++": "cpp", "c#": "csharp", shell: "sh", "objective-c": "objc" }

const CALLOUT_TYPES = {
  red: "caution",
  orange: "warning",
  yellow: "warning",
  brown: "warning",
  green: "tip",
  purple: "important",
  pink: "important",
}

const indent = (text, prefix) =>
  text
    .split("\n")
    .map((l, i) => (i === 0 ? l : l ? prefix + l : l))
    .join("\n")

const isListItem = (t) => t === "bulleted_list_item" || t === "numbered_list_item" || t === "to_do"

class Renderer {
  constructor({ slug, imagesDir, imagesUrl }) {
    this.slug = slug
    this.imagesDir = imagesDir
    this.imagesUrl = imagesUrl
    this.downloads = [] // { url, path }
    this.warnings = []
  }

  // `nested` = inside a toggle/column/callout, where a Markdown heading would break remark-sectionize.
  blocks(list = [], nested = false) {
    const parts = []
    let prevType = null
    let n = 0
    for (const b of list) {
      n = b.type === "numbered_list_item" ? (prevType === "numbered_list_item" ? n + 1 : 1) : 0
      const md = this.block(b, n, nested)
      if (md == null || md === "") {
        prevType = b.type
        continue
      }
      // Consecutive list items stay a tight list.
      const sep = parts.length && isListItem(b.type) && isListItem(prevType) ? "\n" : "\n\n"
      parts.push(parts.length ? sep + md : md)
      prevType = b.type
    }
    return parts.join("")
  }

  block(b, n, nested) {
    const v = b[b.type] || {}
    const kids = () => this.blocks(b.children, nested)
    const wrapColor = (s) => {
      const cls = colorClass(v.color)
      return cls && s ? `<span class="${cls}">${s}</span>` : s
    }

    switch (b.type) {
      case "paragraph": {
        const text = wrapColor(rich(v.rich_text))
        const sub = b.children ? kids() : ""
        return [text, sub].filter(Boolean).join("\n\n")
      }

      case "heading_1":
      case "heading_2":
      case "heading_3": {
        const level = Number(b.type.slice(-1))
        const text = rich(v.rich_text)
        // Toggle headings are flattened: the heading stays a real heading (anchors, TOC) and its
        // contents follow it.
        const head = nested ? `<strong>${text}</strong>` : `${"#".repeat(level)} ${text}`
        return [head, b.children ? kids() : ""].filter(Boolean).join("\n\n")
      }

      case "bulleted_list_item":
      case "numbered_list_item":
      case "to_do": {
        const marker =
          b.type === "numbered_list_item" ? `${n}. ` : b.type === "to_do" ? `- [${v.checked ? "x" : " "}] ` : "- "
        const pad = " ".repeat(b.type === "to_do" ? 2 : marker.length)
        let s = marker + (wrapColor(rich(v.rich_text)) || "&nbsp;")
        // Sub-lists hang directly under the item to keep the list tight; anything else needs a blank
        // line, or it would be read as a lazy continuation of the item's own text.
        if (b.children) s += `${isListItem(b.children[0].type) ? "\n" : "\n\n"}${pad}${indent(kids(), pad)}`
        return s
      }

      case "quote": {
        const body = [wrapColor(rich(v.rich_text)), b.children ? kids() : ""].filter(Boolean).join("\n\n")
        return body
          .split("\n")
          .map((l) => (l ? `> ${l}` : ">"))
          .join("\n")
      }

      case "callout": {
        const type = CALLOUT_TYPES[(v.color || "").replace(/_background$/, "")] || "note"
        const body = [rich(v.rich_text), b.children ? this.blocks(b.children, true) : ""]
          .filter(Boolean)
          .join("\n\n")
        return `:::${type}\n${body}\n:::`
      }

      case "toggle": {
        const summary = rich(v.rich_text, { html: true }) || "展开"
        return `<details class="nt-toggle">\n<summary>${summary}</summary>\n\n${this.blocks(b.children, true)}\n\n</details>`
      }

      case "column_list": {
        const cols = (b.children || []).map(
          (c) => `<div class="nt-column">\n\n${this.blocks(c.children, true)}\n\n</div>`,
        )
        return `<div class="nt-columns">\n\n${cols.join("\n\n")}\n\n</div>`
      }

      case "equation":
        return `$$\n${v.expression}\n$$`

      case "code": {
        const lang = CODE_LANGS[v.language] ?? v.language ?? "text"
        const code = plain(v.rich_text)
        const fence = "`".repeat(Math.max(3, ...(code.match(/`{3,}/g) || []).map((x) => x.length + 1)))
        const title = plain(v.caption)
        return `${fence}${lang}${title ? ` title=${JSON.stringify(title)}` : ""}\n${code}\n${fence}`
      }

      case "divider":
        return "---"

      case "table": {
        const rows = (b.children || []).map((r) =>
          r.table_row.cells.map((cell) => rich(cell).replace(/\|/g, "\\|") || " "),
        )
        if (!rows.length) return ""
        const width = Math.max(...rows.map((r) => r.length))
        const line = (cells) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? " ").join(" | ")} |`
        // GFM tables need a header row; without one in Notion, an empty header is used.
        const header = v.has_column_header ? rows.shift() : []
        return [line(header), line(Array(width).fill("---")), ...rows.map(line)].join("\n")
      }

      case "image": {
        const src = this.fileUrl(v)
        if (!src) return ""
        const caption = rich(v.caption, { html: true })
        const alt = escHtml(plain(v.caption))
        if (!caption) return `![](${src})`
        return `<figure class="nt-figure">\n<img src="${escHtml(src)}" alt="${alt}" loading="lazy" />\n<figcaption>${caption}</figcaption>\n</figure>`
      }

      case "bookmark":
      case "link_preview":
      case "embed": {
        const url = v.url
        if (!url) return ""
        const label = plain(v.caption) || url
        return `<p class="nt-bookmark"><a href="${escHtml(url)}">${escHtml(label)}</a></p>`
      }

      case "video":
      case "audio":
      case "file":
      case "pdf": {
        const src = v.type === "external" ? v.external.url : this.fileUrl(v)
        if (!src) return ""
        const label = plain(v.caption) || v.name || path.basename(src)
        return `<p class="nt-bookmark"><a href="${escHtml(src)}">${escHtml(label)}</a></p>`
      }

      case "synced_block":
        return kids()

      case "table_of_contents":
      case "breadcrumb":
        return "" // the site renders its own TOC

      default:
        this.warnings.push(`unsupported block "${b.type}" skipped`)
        return ""
    }
  }

  // Uploaded files get downloaded and served from public/; external URLs are kept as-is.
  fileUrl(v) {
    if (v.type === "external") return v.external.url
    if (v.type !== "file") return ""
    const url = v.file.url
    const { pathname } = new URL(url)
    const ext = (path.extname(decodeURIComponent(pathname)) || ".png").toLowerCase()
    // The S3 key (without the signature) is unique per upload, so its hash is a stable file name.
    const name = `${crypto.createHash("sha1").update(pathname).digest("hex").slice(0, 12)}${ext}`
    this.downloads.push({ url, path: path.join(this.imagesDir, this.slug, name) })
    return `${this.imagesUrl}/${this.slug}/${name}`
  }
}

// ---- page -> file ---------------------------------------------------------

const prop = (page, name) => page.properties?.[name]

function pageMeta(page) {
  const titleProp = Object.values(page.properties).find((p) => p.type === "title")
  const slug = plain(prop(page, PROP.slug)?.rich_text).trim()
  return {
    id: page.id,
    title: plain(titleProp?.title).trim(),
    slug,
    published: prop(page, PROP.published)?.date?.start || page.created_time.slice(0, 10),
    updated: prop(page, PROP.updated)?.date?.start || "",
    category: prop(page, PROP.category)?.select?.name || "",
    tags: (prop(page, PROP.tags)?.multi_select || []).map((t) => t.name),
    description: plain(prop(page, PROP.description)?.rich_text).trim(),
    pinned: !!prop(page, PROP.pinned)?.checkbox,
    cover: page.cover,
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

async function pageToFile(page, { draft }) {
  const meta = pageMeta(page)
  if (!meta.title) throw new Error(`page ${page.id} has no 标题`)
  if (!meta.slug) {
    if (!draft) throw new Error(`「${meta.title}」has no Slug`)
    meta.slug = page.id.replace(/-/g, "")
  }
  if (!SLUG_RE.test(meta.slug)) throw new Error(`「${meta.title}」Slug "${meta.slug}" must be lowercase a-z, 0-9, -`)

  const r = new Renderer({
    slug: meta.slug,
    imagesDir: draft ? DRAFT_IMAGES_DIR : IMAGES_DIR,
    imagesUrl: draft ? "/notion-drafts" : "/notion",
  })
  const body = r.blocks(await fetchChildren(page.id))
  const image = meta.cover ? r.fileUrl(meta.cover) : ""

  const folder = CATEGORY_DIRS[meta.category] || FALLBACK_DIR
  const dir = draft ? DRAFTS_DIR : path.join(POSTS_DIR, folder)
  if (!draft && meta.category && !CATEGORY_DIRS[meta.category]) {
    r.warnings.push(`unknown 分类 "${meta.category}", filed under ${FALLBACK_DIR}/`)
  }

  const y = (s) => JSON.stringify(s)
  const frontmatter = [
    "---",
    `title: ${y(meta.title)}`,
    `published: ${meta.published}`,
    ...(meta.updated ? [`updated: ${meta.updated}`] : []),
    `description: ${y(meta.description)}`,
    `image: ${y(image)}`,
    `tags: ${y(meta.tags)}`,
    `category: ${y(meta.category)}`,
    ...(meta.pinned ? ["pinned: true"] : []),
    ...(draft ? ["draft: true"] : []),
    `notion_id: ${page.id}`,
    "---",
  ].join("\n")

  for (const w of r.warnings) console.warn(`[sync-notion] ${meta.slug}: ${w}`)
  return {
    id: page.id,
    title: meta.title,
    slug: meta.slug,
    // Astro's glob loader slugifies each path segment: "AI and Deep Learning" → "ai-and-deep-learning".
    url: `${SITE}/posts/${folder.toLowerCase().replace(/\s+/g, "-")}/${meta.slug}/`,
    path: path.join(dir, `${meta.slug}.md`),
    content: `${frontmatter}\n\n${body.trim()}\n`,
    images: r.downloads,
  }
}

// ---- filesystem -----------------------------------------------------------

async function walkFiles(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === "ENOENT") return out
    throw err
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...(await walkFiles(p)))
    else if (ent.isFile()) out.push(p)
  }
  return out
}

async function removeEmptyDirs(dir, root) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of entries) {
    if (ent.isDirectory()) await removeEmptyDirs(path.join(dir, ent.name), root)
  }
  if (dir !== root && (await fs.readdir(dir)).length === 0) await fs.rmdir(dir)
}

async function writeIfChanged(filePath, content) {
  const existing = await fs.readFile(filePath, "utf-8").catch(() => null)
  if (existing === content) return false
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, "utf-8")
  return true
}

const exists = (p) =>
  fs.access(p).then(
    () => true,
    () => false,
  )

// Posts this script owns: .md under posts/ (outside the drafts folder) with notion_id → paths.
async function ownedPosts() {
  const files = (await walkFiles(POSTS_DIR)).filter((f) => f.endsWith(".md") && !f.startsWith(DRAFTS_DIR + path.sep))
  const owned = new Map()
  for (const f of files) {
    const head = (await fs.readFile(f, "utf-8")).slice(0, 2000)
    const id = head.match(/^---[\s\S]*?^notion_id:\s*(\S+)/m)?.[1]
    if (id) owned.set(id, [...(owned.get(id) || []), f])
  }
  return owned
}

// Writes the file and downloads its images; true if anything on disk changed.
async function writePost(f) {
  let changed = false
  if (await writeIfChanged(f.path, f.content)) {
    changed = true
    console.log(`[sync-notion] wrote ${path.relative(REPO_ROOT, f.path)}`)
  }
  for (const img of f.images) {
    if (await exists(img.path)) continue // named by upload, so an existing file is current
    const res = await fetch(img.url)
    if (!res.ok) throw new Error(`图片下载失败 (HTTP ${res.status})`)
    await fs.mkdir(path.dirname(img.path), { recursive: true })
    await fs.writeFile(img.path, Buffer.from(await res.arrayBuffer()))
    changed = true
    console.log(`[sync-notion] saved ${path.relative(REPO_ROOT, img.path)}`)
  }
  return changed
}

async function prune(keep, candidates, roots) {
  let deleted = 0
  for (const p of candidates) {
    if (keep.has(p) || path.basename(p) === ".DS_Store") continue
    await fs.rm(p)
    deleted++
    console.log(`[sync-notion] removed ${path.relative(REPO_ROOT, p)}`)
  }
  for (const root of roots) await removeEmptyDirs(root, root)
  return deleted
}

const errText = (err) => String(err?.message || err)

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, "utf-8"))
  } catch (err) {
    if (err.code === "ENOENT") return { claimed: [] }
    throw err
  }
}

const saveManifest = (m) => fs.writeFile(MANIFEST, JSON.stringify(m, null, 2))

const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10) // UTC+8

// ---- local / --publish ----------------------------------------------------

async function sync() {
  let pages = await queryPages()
  if (pages.length === 0) {
    // An empty database almost certainly means lost access, not "unpublish everything".
    console.error("[sync-notion] aborting: the database returned 0 pages (integration access lost?).")
    process.exit(2)
  }

  // 1. Claim. The manifest is written right after each claim, so a crash later in this run still
  //    lets --fail release the pages instead of leaving them stuck in 发布中.
  const manifest = { claimed: [] }
  if (MODE === "publish") {
    for (const page of pages.filter((p) => statusOf(p) === STATUS.queued)) {
      const extra = page.properties[PROP.published]?.date ? {} : { [PROP.published]: { date: { start: today() } } }
      await setStatus(page.id, STATUS.publishing, { extra })
      manifest.claimed.push({ id: page.id, title: pageMeta(page).title })
      await saveManifest(manifest)
      console.log(`[sync-notion] claimed「${pageMeta(page).title}」`)
    }
    await saveManifest(manifest)
    // Re-read so claimed pages carry their new 状态 and 发布日期.
    if (manifest.claimed.length) pages = await queryPages()
  }
  const claimedIds = new Set(manifest.claimed.map((c) => c.id))

  // 2. Decide what each page contributes to the site.
  const owned = await ownedPosts()
  const onDiskCount = owned.size
  const render = [] // pages to (re-)render now
  const keepPaths = new Set() // existing files left exactly as they are
  for (const page of pages) {
    const st = statusOf(page)
    if (claimedIds.has(page.id)) render.push(page)
    else if (st === STATUS.draft || !st) continue // unpublished: its file (if any) gets pruned
    else if (owned.has(page.id)) owned.get(page.id).forEach((p) => keepPaths.add(p))
    else if (st === STATUS.published) render.push(page) // live in Notion but missing on disk: restore
  }

  const liveCount = keepPaths.size + render.length
  if (!FORCE_PRUNE && onDiskCount >= 4 && liveCount < onDiskCount / 2) {
    console.error(`[sync-notion] aborting: only ${liveCount} post(s) would stay, but ${onDiskCount} are on disk.`)
    console.error("[sync-notion] 状态 renamed? if the deletion is intended, re-run with NOTION_FORCE_PRUNE=true.")
    process.exit(2)
  }

  // 3. Render. A broken page fails on its own instead of blocking the others.
  const files = []
  const slugs = new Map([...keepPaths].map((p) => [path.basename(p, ".md"), p]))
  for (const page of render) {
    const entry = manifest.claimed.find((c) => c.id === page.id)
    try {
      const f = await pageToFile(page, { draft: false })
      const clash = slugs.get(f.slug)
      if (clash && clash !== f.path) throw new Error(`Slug「${f.slug}」和另一篇文章重复`)
      slugs.set(f.slug, f.path)
      const changed = await writePost(f)
      files.push(f)
      if (entry) Object.assign(entry, { url: f.url, changed })
    } catch (err) {
      console.error(`[sync-notion]「${pageMeta(page).title}」: ${errText(err)}`)
      // Keep the previous version online, if there was one.
      owned.get(page.id)?.forEach((p) => keepPaths.add(p))
      if (!entry) continue // an unclaimed restore: report it, but don't touch its 状态
      await setStatus(page.id, STATUS.failed, { note: `同步失败：${errText(err)}` })
      entry.failed = true
    }
  }
  if (MODE === "publish") await saveManifest(manifest)

  // 4. Prune. Images of kept posts live under public/notion/<their slug>/ and stay with them.
  const keep = new Set([...keepPaths, ...files.flatMap((f) => [f.path, ...f.images.map((i) => i.path)])])
  const keptImageDirs = [...keepPaths].map((p) => path.join(IMAGES_DIR, path.basename(p, ".md")) + path.sep)
  const allOwned = [...owned.values()].flat()
  const images = (await walkFiles(IMAGES_DIR)).filter((p) => !keptImageDirs.some((d) => p.startsWith(d)))
  const deleted = await prune(keep, [...allOwned, ...images], [IMAGES_DIR])
  console.log(`[sync-notion] ${files.length} rendered, ${keepPaths.size} kept, ${deleted} removed`)

  if (WITH_DRAFTS) await syncDrafts(pages)
}

async function syncDrafts(pages) {
  const drafts = []
  for (const page of pages.filter((p) => statusOf(p) !== STATUS.published)) {
    try {
      drafts.push(await pageToFile(page, { draft: true }))
    } catch (err) {
      console.warn(`[sync-notion] draft「${pageMeta(page).title}」skipped: ${errText(err)}`)
    }
  }
  for (const f of drafts) await writePost(f)
  const keep = new Set(drafts.flatMap((f) => [f.path, ...f.images.map((i) => i.path)]))
  const deleted = await prune(
    keep,
    [...(await walkFiles(DRAFTS_DIR)), ...(await walkFiles(DRAFT_IMAGES_DIR))],
    [DRAFTS_DIR, DRAFT_IMAGES_DIR],
  )
  console.log(`[sync-notion] drafts: ${drafts.length} rendered, ${deleted} removed (local preview only, gitignored)`)
}

// ---- --finalize -----------------------------------------------------------

// Vercel reports each push as a commit status with context "Vercel": pending → success / failure.
async function waitForVercel(sha) {
  const repo = process.env.GITHUB_REPOSITORY
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "User-Agent": "vermilion-sync-notion",
  }
  const deadline = Date.now() + 12 * 60 * 1000
  while (Date.now() < deadline) {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/statuses`, { headers })
    if (res.ok) {
      const latest = (await res.json()).find((st) => st.context === "Vercel")
      if (latest?.state === "success") return
      if (latest && latest.state !== "pending") throw new Error(`Vercel 部署失败（${latest.state}）：${latest.target_url || ""}`)
    }
    await sleep(15000)
  }
  throw new Error("等了 12 分钟，Vercel 还没部署完")
}

async function waitForPage(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" }).catch(() => null)
    if (res?.ok) return
    await sleep(10000)
  }
  throw new Error(`部署成功了，但页面打不开：${url}`)
}

async function finalize() {
  const manifest = await readManifest()
  const pending = manifest.claimed.filter((c) => !c.failed)
  if (!pending.length) return console.log("[sync-notion] nothing to finalize")

  const sha = (process.env.COMMIT_SHA || "").trim()
  let deployError = null
  if (pending.some((c) => c.changed)) {
    if (!sha) deployError = new Error("文件有改动，但没有拿到推送后的提交")
    else await waitForVercel(sha).catch((err) => (deployError = err))
  }

  for (const c of pending) {
    let error = deployError
    if (!error) error = await waitForPage(c.url).then(() => null, (err) => err)
    if (error) {
      await setStatus(c.id, STATUS.failed, { note: errText(error) })
      console.error(`[sync-notion] failed「${c.title}」: ${errText(error)}`)
    } else {
      await setStatus(c.id, STATUS.published)
      console.log(`[sync-notion] published「${c.title}」→ ${c.url}`)
    }
    c.failed = !!error
    c.done = true
  }
  await saveManifest(manifest)
  if (deployError) process.exit(1)
}

// ---- --fail ---------------------------------------------------------------

async function fail() {
  const manifest = await readManifest()
  const reason = option("--reason") || "发布流程出错"
  for (const c of manifest.claimed) {
    if (c.done) continue
    const page = await notion("GET", `/pages/${c.id}`)
    if (statusOf(page) !== STATUS.publishing) continue
    await setStatus(c.id, STATUS.failed, { note: reason })
    console.log(`[sync-notion] marked「${c.title}」as ${STATUS.failed}`)
  }
}

const run = { local: sync, publish: sync, finalize, fail }[MODE]
run().catch((err) => {
  console.error(`[sync-notion] ${errText(err)}`)
  process.exit(1)
})
