import { Context } from 'hono';
import { Bindings } from '../../bindings';
import { isValidEmail } from '../../utils/email';

export const setAdminEmail = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const { email } = await c.req.json();
    if (!email || !isValidEmail(email)) {
      return c.json({ message: '邮箱格式不正确' }, 400);
    }
    await c.env.CWD_DB.prepare(
      'CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
    ).run();
    // 写到通知和评论设置共用的 comment_admin_email，避免两处各存一份
    await c.env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)')
      .bind('comment_admin_email', email.trim())
      .run();
    return c.json({ message: '保存成功' });
  } catch (e: any) {
    return c.json({ message: e.message }, 500);
  }
};

