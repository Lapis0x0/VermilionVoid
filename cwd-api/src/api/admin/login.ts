import { Context } from 'hono';
import { Bindings } from '../../bindings';

// 简单配置：允许尝试 5 次，锁定 30 分钟
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60; // 秒

export const adminLogin = async (c: Context<{ Bindings: Bindings }>) => {
	const data = await c.req.json();
	const ip = c.req.header('cf-connecting-ip') || '127.0.0.1';

	const blockKey = `block:${ip}`;
	const attemptKey = `attempts:${ip}`;

	// 1. 检查 IP 是否被封禁
	const isBlocked = await c.env.CWD_AUTH_KV.get(blockKey);
	if (isBlocked) {
		return c.json({ message: 'IP is blocked due to multiple failed login attempts' }, 403);
	}

	// 2. 验证用户名密码
	// 用户名不是秘密，可以有默认值；密码绝不能有默认口令——
	// 未配置 ADMIN_PASSWORD 时一律拒绝登录，而不是回退到 'password'
	const ADMIN_NAME = c.env.ADMIN_NAME || 'Admin';
	const ADMIN_PASSWORD = c.env.ADMIN_PASSWORD;
	if (!ADMIN_PASSWORD) {
		console.error('AdminLogin:passwordNotConfigured');
		return c.json(
			{ message: '后台密码未配置，请先设置 ADMIN_PASSWORD secret' },
			503
		);
	}
	const isValid = data.name === ADMIN_NAME && data.password === ADMIN_PASSWORD;

	if (!isValid) {
		// --- 登录失败逻辑 ---
		// 获取当前失败次数
		const attempts = parseInt((await c.env.CWD_AUTH_KV.get(attemptKey)) || '0') + 1;

		if (attempts >= MAX_ATTEMPTS) {
			// 达到上限，封禁 30 分钟
			await c.env.CWD_AUTH_KV.put(blockKey, '1', { expirationTtl: LOCK_TIME });
			await c.env.CWD_AUTH_KV.delete(attemptKey); // 清除尝试计数
			return c.json({ message: 'IP is blocked due to multiple failed login attempts' }, 403);
		} else {
			// 记录失败次数，设置 10 分钟内连续失败才计数
			await c.env.CWD_AUTH_KV.put(attemptKey, attempts.toString(), { expirationTtl: 600 });
			return c.json({ message: 'Invalid username or password', failedAttempts: attempts }, 401);
		}
	}

	// --- 3. 登录成功逻辑 ---
	await c.env.CWD_AUTH_KV.delete(attemptKey);

	// 生成 Token (你的 tempKey)
	const tempKey = crypto.randomUUID();

	// 将 Token 存入 KV，有效期 48 小时（172800秒）
	await c.env.CWD_AUTH_KV.put(
		`token:${tempKey}`,
		JSON.stringify({
			user: data.name,
			ip: ip,
		}),
		{ expirationTtl: 172800 }
	);

	return c.json({
		data: { key: tempKey },
	});
};
