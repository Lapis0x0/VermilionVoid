/**
 * 定时把 GitHub 的 workflow_dispatch 打出去。
 *
 * 为什么需要它：GitHub 自己的 `schedule` 事件在本仓库上稳定延迟 3~5 小时，积压时
 * 还会整段跳过。实测每次 schedule 运行的 created 与 started 完全相同，说明不是
 * runner 在排队，而是事件压根没按时发出来。workflow_dispatch 走实时通道，秒级触发。
 */

export interface Env {
  /** secret：fine-grained PAT，只需要本仓库的 Actions: Read and write */
  GH_TOKEN: string
  /** "owner/repo" */
  GH_REPO: string
  /** workflow 文件名，如 sync-flomo.yml */
  GH_WORKFLOW: string
  /** 触发的分支 */
  GH_REF: string
}

const RETRYABLE_DELAYS_MS = [1000, 3000]

async function dispatch(env: Env): Promise<void> {
  const url = `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${env.GH_WORKFLOW}/dispatches`

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
      console.log(`dispatched ${env.GH_WORKFLOW} on ${env.GH_REPO}@${env.GH_REF}`)
      return
    }

    const detail = (await res.text()).slice(0, 300)
    // 4xx 是配置问题（token 过期、权限不足、workflow 改名），重试没有意义。
    if (res.status < 500 || attempt >= RETRYABLE_DELAYS_MS.length) {
      throw new Error(`GitHub dispatch failed: HTTP ${res.status} ${detail}`)
    }
    console.warn(`GitHub dispatch HTTP ${res.status}, retrying: ${detail}`)
    await new Promise((r) => setTimeout(r, RETRYABLE_DELAYS_MS[attempt]))
  }
}

export default {
  // 抛异常会让这次 cron 在 Cloudflare 的 observability 里记为失败，便于排查。
  async scheduled(_controller, env) {
    await dispatch(env)
  },
} satisfies ExportedHandler<Env>
