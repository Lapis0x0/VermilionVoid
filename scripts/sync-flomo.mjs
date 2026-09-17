#!/usr/bin/env node
// Sync 偶得 from flomo into src/content/thoughts/.
//
// Source of truth: flomo memos tagged `#blog` (or a child tag like `#blog/AI`).
// Reads flomo Web's own (undocumented) API: GET /api/v1/memo/updated/ with an MD5 signature.
// Every run fetches all memos and rebuilds the directory, so there is no local state:
// untagging or deleting a memo removes its file on the next run.
//
// Env:
//   FLOMO_TOKEN  the Bearer token from flomo Web (copy from any api/v1 request header)
//   FLOMO_TAG    publish tag, default `blog`
// Flags:
//   --preview N  ignore the tag and render the latest N memos (local preview only, never commit)

import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, "..")
const THOUGHTS_DIR = path.join(REPO_ROOT, "src", "content", "thoughts")
const IMAGES_DIR = path.join(REPO_ROOT, "public", "thoughts")
const IMAGES_URL = "/thoughts"

const TOKEN = (process.env.FLOMO_TOKEN || "").replace(/^Bearer\s+/i, "").trim()
const TAG = (process.env.FLOMO_TAG || "blog").replace(/^#/, "")
const previewIdx = process.argv.indexOf("--preview")
const PREVIEW = previewIdx === -1 ? 0 : Number(process.argv[previewIdx + 1] || 20)

if (!TOKEN) {
  console.error("[sync-flomo] Missing FLOMO_TOKEN env var.")
  process.exit(1)
}

// ---- flomo API ------------------------------------------------------------

// Part of flomo Web's public client bundle, not a user secret.
const SIGN_SALT = "dbbc3dd73364b4084c3a69346e0ce2b2"
const PAGE_SIZE = 200

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Origin: "https://v.flomoapp.com",
  Referer: "https://v.flomoapp.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  platform: "Web",
  "device-model": "Chrome",
  Authorization: `Bearer ${TOKEN}`,
}

function sign(params) {
  const query = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== "" && params[k] != null)
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  return crypto.createHash("md5").update(query + SIGN_SALT).digest("hex")
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// flomo returns times as "YYYY-MM-DD HH:mm:ss" in the requested tz (we request UTC+8).
const toDate = (s) => new Date(`${s.replace(" ", "T")}+08:00`)

async function fetchPage(latestUpdatedAt, latestSlug) {
  const params = {
    limit: PAGE_SIZE,
    latest_updated_at: latestUpdatedAt,
    latest_slug: latestSlug,
    tz: "8:0",
    timestamp: Math.floor(Date.now() / 1000),
    api_key: "flomo_web",
    app_version: "4.0",
    platform: "web",
  }
  params.sign = sign(params)
  const url = `https://flomoapp.com/api/v1/memo/updated/?${new URLSearchParams(params)}`

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    const text = await res.text()
    // flomo's nginx occasionally returns a transient HTML 403; retry GETs with backoff.
    if (res.status === 403 && text.includes("<html") && attempt < 3) {
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (!res.ok) throw new Error(`flomo HTTP ${res.status}: ${text.slice(0, 300)}`)
    const body = JSON.parse(text)
    if (body.code !== 0) {
      throw new Error(`flomo API error ${body.code}: ${body.message} (token expired? re-copy FLOMO_TOKEN)`)
    }
    return body.data || []
  }
}

async function fetchAllMemos() {
  const all = []
  let cursorAt = 0
  let cursorSlug = ""
  for (;;) {
    const page = await fetchPage(cursorAt, cursorSlug)
    if (page.length === 0) break
    all.push(...page)
    const last = page[page.length - 1]
    const nextAt = Math.floor(toDate(last.updated_at).getTime() / 1000)
    if (nextAt === cursorAt && last.slug === cursorSlug) throw new Error("flomo cursor did not advance")
    cursorAt = nextAt
    cursorSlug = last.slug
    if (page.length < PAGE_SIZE) break
    await sleep(500) // flomo Web's own interval between sync pages
  }
  return all
}

// ---- memo -> markdown -----------------------------------------------------

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")

const INLINE_MARKS = { strong: "**", b: "**", em: "*", i: "*", s: "~~", del: "~~", code: "`" }

// flomo only emits a small HTML subset: p, br, strong, ul/ol/li (plus the occasional inline mark or link).
function htmlToMarkdown(html) {
  const blocks = []
  const lists = [] // stack of { ordered, n }
  let listLines = []
  let cur = ""
  let marker = null
  const hrefs = []

  const flushBlock = () => {
    const t = cur.trim()
    if (t) blocks.push(t.replace(/\n/g, "\\\n"))
    cur = ""
  }
  const flushItem = () => {
    if (marker === null) return
    const t = cur.trim()
    if (t) listLines.push(marker + t.replace(/\n/g, `\\\n${" ".repeat(marker.length)}`))
    cur = ""
    marker = null
  }

  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    if (m[4] !== undefined) {
      cur += decodeEntities(m[4])
      continue
    }
    const closing = m[1] === "/"
    const tag = m[2].toLowerCase()
    if (tag === "br") cur += "\n"
    else if (tag in INLINE_MARKS) cur += INLINE_MARKS[tag]
    else if (tag === "a") {
      if (closing) cur += `](${hrefs.pop() || ""})`
      else {
        hrefs.push(decodeEntities(m[3].match(/href="([^"]*)"/)?.[1] || ""))
        cur += "["
      }
    } else if (tag === "p") {
      if (lists.length === 0) flushBlock()
      else if (closing) cur += "\n"
    } else if (tag === "ul" || tag === "ol") {
      if (closing) {
        flushItem()
        lists.pop()
        if (lists.length === 0) {
          if (listLines.length) blocks.push(listLines.join("\n"))
          listLines = []
        }
      } else {
        if (lists.length === 0) flushBlock()
        flushItem()
        lists.push({ ordered: tag === "ol", n: 0 })
      }
    } else if (tag === "li") {
      flushItem()
      if (!closing) {
        const top = lists[lists.length - 1]
        if (!top) continue
        top.n++
        marker = "   ".repeat(lists.length - 1) + (top.ordered ? `${top.n}. ` : "- ")
      }
    }
  }
  flushItem()
  if (listLines.length) blocks.push(listLines.join("\n"))
  flushBlock()
  return blocks.join("\n\n")
}

const isPublishTag = (t) => t === TAG || t.startsWith(`${TAG}/`)

function stripTags(html, tags) {
  // Longest first so `#blog/AI` is removed before `#blog`.
  let out = html
  for (const t of [...tags].sort((a, b) => b.length - a.length)) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    out = out.replace(new RegExp(`#${escaped}(?=\\s|<|&nbsp;|$)`, "g"), "")
  }
  return out
}

const pad = (n) => String(n).padStart(2, "0")

function extOf(file) {
  const ext = path.extname(file.name || file.path || "").toLowerCase()
  return ext || ".png"
}

function memoToFile(memo) {
  const created = toDate(memo.created_at)
  // Calendar parts in UTC+8, matching how the memo was written.
  const local = new Date(created.getTime() + 8 * 3600 * 1000)
  const y = local.getUTCFullYear()
  const slug = `${y}/${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}-${memo.slug}`

  const tags = PREVIEW
    ? memo.tags
    : [...new Set(memo.tags.filter((t) => t.startsWith(`${TAG}/`)).map((t) => t.slice(TAG.length + 1)))]

  const images = (memo.files || []).filter((f) => f.type === "image")
  const imageNames = images.map((f) => `${f.id}${extOf(f)}`)

  let body = htmlToMarkdown(stripTags(memo.content, memo.tags))
  // A first line written as a Markdown heading (`# 标题`, with a space so flomo doesn't treat it as a tag)
  // becomes the title and is removed from the body.
  const heading = body.match(/^#{1,6}[ \t]+([^\n]+?)[ \t#]*(?:\n|$)/)
  const title = heading?.[1].trim()
  if (heading) body = body.slice(heading[0].length)
  if (imageNames.length) {
    body += `\n\n${imageNames.map((n) => `[![](${IMAGES_URL}/${n})](${IMAGES_URL}/${n})`).join("\n\n")}`
  }

  const frontmatter = [
    "---",
    `slug: ${slug}`,
    ...(title ? [`title: ${JSON.stringify(title)}`] : []),
    `published: ${memo.created_at.replace(" ", "T")}+08:00`,
    `tags: ${JSON.stringify(tags)}`,
    "---",
  ].join("\n")

  return {
    path: path.join(THOUGHTS_DIR, `${slug}.md`),
    content: `${frontmatter}\n${body.trim()}\n`,
    images: images.map((f, i) => ({ url: f.url, path: path.join(IMAGES_DIR, imageNames[i]) })),
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

async function main() {
  const memos = await fetchAllMemos()
  // An empty account almost certainly means a broken token/protocol, not "delete everything".
  if (memos.length === 0) {
    console.error("[sync-flomo] aborting: flomo returned 0 memos (sanity check).")
    process.exit(2)
  }

  let selected = memos.filter((m) => !m.deleted_at)
  if (PREVIEW) {
    selected = selected.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, PREVIEW)
  } else {
    selected = selected.filter((m) => (m.tags || []).some(isPublishTag))
  }
  console.log(`[sync-flomo] ${memos.length} memo(s) fetched, ${selected.length} selected`)

  const files = selected.map(memoToFile)
  let written = 0
  for (const f of files) {
    if (await writeIfChanged(f.path, f.content)) {
      written++
      console.log(`[sync-flomo] wrote ${path.relative(REPO_ROOT, f.path)}`)
    }
    for (const img of f.images) {
      if (await exists(img.path)) continue // attachment ids are immutable
      const res = await fetch(img.url)
      if (!res.ok) throw new Error(`image download failed (${res.status}): ${img.url.split("?")[0]}`)
      await fs.mkdir(path.dirname(img.path), { recursive: true })
      await fs.writeFile(img.path, Buffer.from(await res.arrayBuffer()))
      console.log(`[sync-flomo] saved ${path.relative(REPO_ROOT, img.path)}`)
    }
  }

  if (PREVIEW) {
    console.log(`[sync-flomo] preview: ${written} written, cleanup skipped`)
    return
  }

  // This script owns both directories entirely: anything not produced this run is stale.
  const keep = new Set(files.flatMap((f) => [f.path, ...f.images.map((i) => i.path)]))
  let deleted = 0
  for (const root of [THOUGHTS_DIR, IMAGES_DIR]) {
    for (const p of await walkFiles(root)) {
      if (keep.has(p) || path.basename(p) === ".DS_Store") continue
      await fs.rm(p)
      deleted++
      console.log(`[sync-flomo] removed ${path.relative(REPO_ROOT, p)}`)
    }
    await removeEmptyDirs(root, root)
  }

  console.log(`[sync-flomo] done: ${written} written, ${files.length - written} unchanged, ${deleted} deleted`)
}

main().catch((err) => {
  console.error(`[sync-flomo] ${err.message || err}`)
  process.exit(1)
})
