/**
 * 定时把 GitHub 的 workflow_dispatch 打出去。
 *
 * 为什么需要它：GitHub 自己的 `schedule` 事件在本仓库上稳定延迟 3~5 小时，积压时
 * 还会整段跳过。实测每次 schedule 运行的 created 与 started 完全相同，说明不是
 * runner 在排队，而是事件压根没按时发出来。workflow_dispatch 走实时通道，秒级触发。
 *
 * 每分钟跑一次：
 * - 查 Notion「博客」库里有没有「待发布」，或改回「草稿」但还在线上的文章，有就触发
 *   sync-notion.yml。workflow 一开始就会认领它们（改成「发布中」/ 取消「已上线」），
 *   所以下一分钟不会重复触发。
 * - 把卡在「发布中」超过 15 分钟的文章改成「发布失败」（workflow 自己最多等 12 分钟，
 *   超过这个时间说明它中途死掉了，连失败都没来得及回写）。
 * - 整点：触发 sync-flomo.yml，并无条件触发一次 sync-notion.yml 兜底（比如在 Notion 里
 *   直接删掉的文章，查询查不到，只能靠例行同步清掉）。
 */

export interface Env {
  /** secret：fine-grained PAT，只需要本仓库的 Actions: Read and write */
  GH_TOKEN: string
  /** "owner/repo" */
  GH_REPO: string
  /** flomo 同步的 workflow 文件名 */
  GH_WORKFLOW: string
  /** Notion 发布的 workflow 文件名 */
  GH_NOTION_WORKFLOW: string
  /** 触发的分支 */
  GH_REF: string
  /** secret：Notion 集成「VermilionVoid 博客同步」的令牌（读取 + 更新内容） */
  NOTION_TOKEN: string
  /** Notion「博客」数据库的 data source id */
  NOTION_DATA_SOURCE_ID: string
}

const RETRYABLE_DELAYS_MS = [1000, 3000]
const STUCK_AFTER_MS = 15 * 60 * 1000

async function dispatch(env: Env, workflow: string): Promise<void> {
  const url = `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${workflow}/dispatches`

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        // GitHub 强制要求 User-Agent，缺了会直接 403。
        "User-Agent": "vermilion-sync-trigger",
        "Content-Type": "application/json",
      },
      // 不传 inputs：workflow 里的 force_prune 保持默认 false，
      // 批量删除只能由人手动勾选放行。
      body: JSON.stringify({ ref: env.GH_REF }),
    })

    if (res.status === 204) {
      console.log(`dispatched ${workflow} on ${env.GH_REPO}@${env.GH_REF}`)
      return
    }

    const detail = (await res.text()).slice(0, 300)
    // 4xx 是配置问题（token 过期、权限不足、workflow 改名），重试没有意义。
    if (res.status < 500 || attempt >= RETRYABLE_DELAYS_MS.length) {
      throw new Error(`GitHub dispatch ${workflow} failed: HTTP ${res.status} ${detail}`)
    }
    console.warn(`GitHub dispatch ${workflow} HTTP ${res.status}, retrying: ${detail}`)
    await new Promise((r) => setTimeout(r, RETRYABLE_DELAYS_MS[attempt]))
  }
}

async function notion(env: Env, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data: any = await res.json()
  if (!res.ok) throw new Error(`Notion ${method} ${path}: HTTP ${res.status} ${data?.code} ${data?.message}`)
  return data
}

// 有活 = 有「待发布」，或者有「草稿」但「已上线」还勾着（刚被改回草稿、线上还挂着）。
// 后者被 workflow 认领时会先取消「已上线」，所以和「发布中」一样不会被重复触发。
async function hasWork(env: Env): Promise<boolean> {
  const data = await notion(env, "POST", `/data_sources/${env.NOTION_DATA_SOURCE_ID}/query`, {
    filter: {
      or: [
        { property: "状态", select: { equals: "待发布" } },
        {
          and: [
            { property: "状态", select: { equals: "草稿" } },
            { property: "已上线", checkbox: { equals: true } },
          ],
        },
      ],
    },
    page_size: 1,
  })
  return data.results.length > 0
}

async function failStuck(env: Env, now: number): Promise<void> {
  const data = await notion(env, "POST", `/data_sources/${env.NOTION_DATA_SOURCE_ID}/query`, {
    filter: {
      and: [
        { property: "状态", select: { equals: "发布中" } },
        { timestamp: "last_edited_time", last_edited_time: { before: new Date(now - STUCK_AFTER_MS).toISOString() } },
      ],
    },
    page_size: 20,
  })
  for (const page of data.results) {
    await notion(env, "PATCH", `/pages/${page.id}`, {
      properties: {
        状态: { select: { name: "发布失败" } },
        备注: {
          rich_text: [
            {
              type: "text",
              text: {
                content: `超过 15 分钟还在「发布中」，发布流程可能中途退出了。看一下 https://github.com/${env.GH_REPO}/actions/workflows/${env.GH_NOTION_WORKFLOW} ，改回「待发布」即可重试。`,
              },
            },
          ],
        },
      },
    })
    console.warn(`marked stuck page ${page.id} as 发布失败`)
  }
}

export default {
  async scheduled(controller, env) {
    const now = controller.scheduledTime
    const onTheHour = new Date(now).getUTCMinutes() === 0
    const errors: unknown[] = []
    const attempt = async (fn: () => Promise<unknown>) => {
      try {
        await fn()
      } catch (err) {
        console.error(err)
        errors.push(err)
      }
    }

    // 各自独立：Notion 出问题不能耽误 flomo，反过来也一样。
    await attempt(() => failStuck(env, now))
    await attempt(async () => {
      if (onTheHour || (await hasWork(env))) await dispatch(env, env.GH_NOTION_WORKFLOW)
    })
    if (onTheHour) await attempt(() => dispatch(env, env.GH_WORKFLOW))

    // 抛异常会让这次 cron 在 Cloudflare 的 observability 里记为失败，便于排查。
    if (errors.length) throw errors[0]
  },
} satisfies ExportedHandler<Env>
