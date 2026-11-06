# sync-trigger

一个只有 cron 触发器的 Cloudflare Worker，每分钟跑一次：

- **Notion 长文**：查「博客」数据库里有没有「待发布」或「改回草稿但已上线还勾着」的文章，有就触发 `sync-notion.yml`；
  顺带把卡在「发布中」超过 15 分钟的文章改成「发布失败」。
- **整点**：触发 `sync-flomo.yml`，并无条件触发一次 `sync-notion.yml` 兜底（在 Notion 里直接删掉的文章查不到，靠它清掉）。

每分钟只是一次 Notion 查询，没活就什么都不做；GitHub Actions 只在真有文章要发时才跑。

## 为什么不用 GitHub 自己的 cron

GitHub 的 `schedule` 事件在本仓库上**稳定延迟 3~5 小时**，积压时还会整段跳过。
实测每次 schedule 运行的 `created` 与 `started` 时间戳完全相同，说明不是 runner
在排队，而是事件压根没按时发出来；同一个仓库手动 `workflow_dispatch` 则是秒级触发。
所以绕开 GitHub 的调度器，自己定点打 dispatch。

`sync-flomo.yml` 里仍保留了一个 6 小时一次的 `schedule` 作为兜底，万一这个
Worker 挂了或 PAT 过期，同步不会彻底停摆。重复触发是安全的：同步脚本是幂等的，
内容没变就不写文件、不产生提交。

## 部署

1. 建一个 fine-grained PAT（<https://github.com/settings/personal-access-tokens>）：
   - Repository access：只选 `Lapis0x0/VermilionVoid`
   - Permissions → Repository permissions → **Actions: Read and write**
   - 其余权限一律不给
2. 部署并写入 secret：

   ```sh
   pnpm install
   pnpm deploy
   pnpm wrangler secret put GH_TOKEN       # 粘贴上一步的 PAT
   pnpm wrangler secret put NOTION_TOKEN   # Notion 集成「VermilionVoid 博客同步」的令牌
   ```

   `GH_TOKEN`、`NOTION_TOKEN` **必须是 secret**，不要写进 `wrangler.jsonc` 的 vars，也不要在
   Cloudflare 面板上配成明文变量——`wrangler deploy` 会用 `wrangler.jsonc` 覆盖
   vars，明文变量会被抹掉，secret 不受影响。

3. 手动验证一次：

   ```sh
   pnpm wrangler dev --test-scheduled   # 另开终端 curl localhost:8787/__scheduled
   ```

## 改触发频率

改 `wrangler.jsonc` 里的 `triggers.crons`，重新 `pnpm deploy`。

## 线上排查

Worker 开了 observability，`pnpm wrangler tail` 可以看实时日志。成功是一行
`dispatched sync-flomo.yml ...` / `dispatched sync-notion.yml ...`；没活的分钟不打日志。
失败会抛异常并在 Cloudflare 面板记为 error。常见失败：

- PAT 过期 → HTTP 401 Bad credentials
- Notion 404 object_not_found → 数据库被挪了位置，集成丢了授权，去集成的「内容访问权限」里重新勾选「博客」
