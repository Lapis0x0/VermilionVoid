import { Context } from 'hono';
import { Bindings } from '../../bindings';

// 通知实际读的是 comment_admin_email（评论设置页写的那个），admin_notify_email 只是旧键兜底
export const getAdminEmail = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    await c.env.CWD_DB.prepare(
      'CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
    ).run();
    const { results } = await c.env.CWD_DB.prepare('SELECT key, value FROM Settings WHERE key IN (?, ?)')
      .bind('comment_admin_email', 'admin_notify_email')
      .all<{ key: string; value: string }>();
    const current = results.find((row) => row.key === 'comment_admin_email')?.value;
    const legacy = results.find((row) => row.key === 'admin_notify_email')?.value;
    const email = current || legacy || null;
    return c.json({ email });
  } catch (e: any) {
    return c.json({ message: e.message }, 500);
  }
};
