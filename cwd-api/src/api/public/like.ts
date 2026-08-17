import type { Context } from 'hono';
import type { Bindings } from '../../bindings';
import { guardPostSlug } from '../../utils/allowedOrigin';

type LikeStatusResponse = {
	liked: boolean;
	alreadyLiked: boolean;
	totalLikes: number;
};

type LikeRequestBody = {
	postSlug?: string;
	postTitle?: string;
	postUrl?: string;
};

function getUserIdFromRequest(c: Context<{ Bindings: Bindings }>): string {
	const header =
		c.req.header('X-CWD-Like-User') ||
		c.req.header('x-cwd-like-user') ||
		'';
	const fromHeader = header.trim();
	if (fromHeader) {
		return fromHeader;
	}
	const ip = c.req.header('cf-connecting-ip') || '';
	const trimmedIp = ip.trim();
	if (trimmedIp) {
		return `ip:${trimmedIp}`;
	}
	return 'anonymous';
}

async function ensureLikesTable(env: Bindings) {
	await env.CWD_DB.prepare(
		'CREATE TABLE IF NOT EXISTS Likes (id INTEGER PRIMARY KEY AUTOINCREMENT, page_slug TEXT NOT NULL, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(page_slug, user_id))'
	).run();
}

async function ensurePageStatsTable(env: Bindings) {
	await env.CWD_DB.prepare(
		'CREATE TABLE IF NOT EXISTS page_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, post_slug TEXT UNIQUE NOT NULL, post_title TEXT, post_url TEXT, pv INTEGER NOT NULL DEFAULT 0, last_visit_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)'
	).run();
}

export const getLikeStatus = async (
	c: Context<{ Bindings: Bindings }>
): Promise<Response> => {
	try {
		const rawPostSlug = c.req.query('post_slug') || '';
		const postSlug = rawPostSlug.trim();

		if (!postSlug) {
			return c.json({ message: 'post_slug is required' }, 400);
		}

		const userIdHeader =
			c.req.header('X-CWD-Like-User') ||
			c.req.header('x-cwd-like-user') ||
			'';
		const userId = userIdHeader.trim();

		await ensureLikesTable(c.env);

		const totalRow = await c.env.CWD_DB.prepare(
			'SELECT COUNT(*) AS count FROM Likes WHERE page_slug = ?'
		)
			.bind(postSlug)
			.first<{ count: number }>();

		let liked = false;
		if (userId) {
			const row = await c.env.CWD_DB.prepare(
				'SELECT id FROM Likes WHERE page_slug = ? AND user_id = ?'
			)
				.bind(postSlug, userId)
				.first<{ id: number }>();
			liked = !!row;
		}

		const totalLikes = totalRow?.count || 0;

		const payload: LikeStatusResponse = {
			liked,
			alreadyLiked: false,
			totalLikes
		};

		return c.json(payload);
	} catch (e: any) {
		return c.json(
			{ message: e?.message || '获取点赞状态失败' },
			500
		);
	}
};

export const likePage = async (
	c: Context<{ Bindings: Bindings }>
): Promise<Response> => {
	try {
		const body = ((await c.req
			.json()
			.catch(() => ({}))) || {}) as LikeRequestBody;

		const rawPostSlug =
			typeof body.postSlug === 'string' ? body.postSlug.trim() : '';
		const rawPostTitle =
			typeof body.postTitle === 'string' ? body.postTitle.trim() : '';
		const rawPostUrl =
			typeof body.postUrl === 'string' ? body.postUrl.trim() : '';

		if (!rawPostSlug) {
			return c.json({ message: 'postSlug is required' }, 400);
		}

		const rejected = await guardPostSlug(c, rawPostSlug);
		if (rejected) return rejected;

		const userId = getUserIdFromRequest(c);

		await ensureLikesTable(c.env);
		await ensurePageStatsTable(c.env);

		const now = Date.now();

		const existingLike = await c.env.CWD_DB.prepare(
			'SELECT id FROM Likes WHERE page_slug = ? AND user_id = ?'
		)
			.bind(rawPostSlug, userId)
			.first<{ id: number }>();

		let alreadyLiked = false;

		if (!existingLike) {
			await c.env.CWD_DB.prepare(
				'INSERT INTO Likes (page_slug, user_id, created_at) VALUES (?, ?, ?)'
			)
				.bind(rawPostSlug, userId, now)
				.run();
		} else {
			alreadyLiked = true;
		}

		const pageStatsRow = await c.env.CWD_DB.prepare(
			'SELECT id FROM page_stats WHERE post_slug = ?'
		)
			.bind(rawPostSlug)
			.first<{ id: number }>();

		if (!pageStatsRow) {
			await c.env.CWD_DB.prepare(
				'INSERT INTO page_stats (post_slug, post_title, post_url, pv, last_visit_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
			)
				.bind(
					rawPostSlug,
					rawPostTitle || null,
					rawPostUrl || null,
					0,
					now,
					now,
					now
				)
				.run();
		} else if (rawPostTitle || rawPostUrl) {
			await c.env.CWD_DB.prepare(
				'UPDATE page_stats SET post_title = COALESCE(?, post_title), post_url = COALESCE(?, post_url), updated_at = ? WHERE id = ?'
			)
				.bind(
					rawPostTitle || null,
					rawPostUrl || null,
					now,
					pageStatsRow.id
				)
				.run();
		}

		const totalRow = await c.env.CWD_DB.prepare(
			'SELECT COUNT(*) AS count FROM Likes WHERE page_slug = ?'
		)
			.bind(rawPostSlug)
			.first<{ count: number }>();

		const totalLikes = totalRow?.count || 0;

		const payload: LikeStatusResponse = {
			liked: true,
			alreadyLiked,
			totalLikes
		};

		return c.json(payload);
	} catch (e: any) {
		return c.json(
			{ message: e?.message || '点赞失败' },
			500
		);
	}
};

