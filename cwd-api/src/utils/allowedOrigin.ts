import type { Context } from 'hono';
import type { Bindings } from '../bindings';

const ALLOWED_DOMAINS_KEY = 'comment_allowed_domains';

// 归一化后台填写的条目：`example.com` 与 `https://example.com/path` 两种写法都接受
function normalizeDomainEntry(entry: string): string | null {
  const value = entry.trim().toLowerCase();
  if (!value) return null;
  if (/^https?:\/\//.test(value)) {
    try {
      return new URL(value).hostname;
    } catch {
      return null;
    }
  }
  return value.replace(/\/.*$/, '') || null;
}

export async function loadAllowedDomains(env: Bindings): Promise<string[]> {
  const row = await env.CWD_DB.prepare('SELECT value FROM Settings WHERE key = ?')
    .bind(ALLOWED_DOMAINS_KEY)
    .first<{ value: string }>();

  const raw = row?.value || '';
  return raw
    .split(/[,\s]+/)
    .map(normalizeDomainEntry)
    .filter((d): d is string => !!d);
}

// post_slug 本身就是页面完整地址（见 getComments 的 URL 解析），
// 所以它既是业务主键、也是天然的来源凭证——伪造它的唯一结果是评论落到自己站点的真实页面上。
export function toPageUrl(postSlug: string): string | null {
  try {
    const url = new URL(postSlug.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * 校验 post_slug 的域名是否在白名单内。
 * 通过返回 null，未通过返回可直接 return 的 403 响应。
 * 白名单未配置时放行并打日志，避免"先部署后台还没填"把站长自己锁在外面。
 */
export async function guardPostSlug(
  c: Context<{ Bindings: Bindings }>,
  postSlug: string
): Promise<Response | null> {
  const allowed = await loadAllowedDomains(c.env);
  if (!allowed.length) {
    console.warn('OriginGuard:noAllowlistConfigured', { path: c.req.path });
    return null;
  }

  const reject = (reason: string) => {
    console.warn('OriginGuard:rejected', {
      path: c.req.path,
      postSlug,
      ip: c.req.header('cf-connecting-ip') || null,
    });
    return c.json({ message: reason }, 403);
  };

  const pageUrl = toPageUrl(postSlug);
  if (!pageUrl) {
    return reject('post_slug 不是合法的页面地址');
  }

  const hostname = new URL(pageUrl).hostname.toLowerCase();
  if (!allowed.includes(hostname)) {
    return reject('该站点未被授权调用此评论服务');
  }

  return null;
}
