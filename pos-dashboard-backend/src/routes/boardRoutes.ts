import type { Express } from "express";
import type { Pool } from "pg";
import { parseTaskIdParam } from "../parsers";

type AuthUserLike = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

const DEFAULT_CHANNELS = [
  "announcements",
  "sales-floor",
  "operations",
  "inventory",
  "marketing",
  "leadership",
] as const;

const PRIVATE_CHANNELS = new Set(["leadership"]);

function authUserFromReq(req: any): AuthUserLike | null {
  const user = (req as any).authUser as AuthUserLike | undefined;
  if (!user || !user.id) return null;
  return {
    id: String(user.id),
    name: String(user.name || ""),
    email: String(user.email || ""),
    roles: Array.isArray(user.roles) ? user.roles.map((role) => String(role)) : [],
  };
}

function hasAnyRole(user: AuthUserLike | null, roles: string[]): boolean {
  if (!user) return false;
  const own = new Set((user.roles || []).map((role) => String(role)));
  return roles.some((role) => own.has(role));
}

function normalizeChannel(channelRaw: any): string {
  const channel = typeof channelRaw === "string" ? channelRaw.trim().toLowerCase() : "";
  if (!channel) return "announcements";
  if (!/^[a-z0-9-]{2,40}$/.test(channel)) return "announcements";
  return channel;
}

function canUseChannel(user: AuthUserLike | null, channel: string): boolean {
  if (!PRIVATE_CHANNELS.has(channel)) return true;
  return hasAnyRole(user, ["Owner", "Manager"]);
}

function mapPostRow(row: any) {
  return {
    id: String(row.id ?? ""),
    channel: String(row.channel ?? "announcements"),
    body: String(row.body ?? ""),
    priority: Boolean(row.priority),
    author_name: String(row.author_name ?? ""),
    author_email: String(row.author_email ?? ""),
    author_user_id: row.author_user_id === null || row.author_user_id === undefined ? null : String(row.author_user_id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCommentRow(row: any) {
  return {
    id: String(row.id ?? ""),
    post_id: String(row.post_id ?? ""),
    body: String(row.body ?? ""),
    author_name: String(row.author_name ?? ""),
    author_email: String(row.author_email ?? ""),
    author_user_id: row.author_user_id === null || row.author_user_id === undefined ? null : String(row.author_user_id),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function registerBoardRoutes(app: Express, pool: Pool) {
  app.get("/api/board/channels", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const counts = await pool.query(
      `
      SELECT channel, COUNT(*)::int AS n
      FROM board_posts
      GROUP BY channel
      `
    );

    const countMap = new Map<string, number>();
    for (const row of counts.rows) {
      const channel = String(row.channel || "");
      if (!channel) continue;
      countMap.set(channel, Number(row.n || 0));
    }

    const channels = DEFAULT_CHANNELS.filter((channel) => canUseChannel(user, channel)).map((channel) => ({
      id: channel,
      name: channel,
      is_private: PRIVATE_CHANNELS.has(channel),
      count: countMap.get(channel) || 0,
    }));
    res.json({ rows: channels });
  });

  app.get("/api/board/posts", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const channel = normalizeChannel(req.query?.channel);
    if (!canUseChannel(user, channel)) return res.status(403).json({ error: "forbidden" });

    const r = await pool.query(
      `
      SELECT
        id,
        channel,
        body,
        priority,
        author_name,
        author_email,
        author_user_id,
        created_at,
        updated_at
      FROM board_posts
      WHERE channel = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 200
      `,
      [channel]
    );

    res.json({ rows: r.rows.map(mapPostRow) });
  });

  app.post("/api/board/posts", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const channel = normalizeChannel(req.body?.channel);
    if (!canUseChannel(user, channel)) return res.status(403).json({ error: "forbidden" });
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) return res.status(400).json({ error: "body is required" });
    const priority = Boolean(req.body?.priority);

    const authorName = user.name || user.email;
    const authorEmail = user.email || "";
    const authorUserId = Number(user.id);

    const r = await pool.query(
      `
      INSERT INTO board_posts (
        channel, body, priority, author_name, author_email, author_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      RETURNING
        id, channel, body, priority, author_name, author_email, author_user_id, created_at, updated_at
      `,
      [channel, body, priority, authorName, authorEmail, authorUserId]
    );
    res.status(201).json({ row: mapPostRow(r.rows[0]) });
  });

  app.get("/api/board/posts/:postId/comments", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const postId = parseTaskIdParam(req.params.postId);
    if (!postId) return res.status(400).json({ error: "invalid postId" });

    const postRow = await pool.query("SELECT channel FROM board_posts WHERE id = $1 LIMIT 1", [postId]);
    if (!postRow.rows.length) return res.status(404).json({ error: "post not found" });
    const channel = String(postRow.rows[0].channel || "announcements");
    if (!canUseChannel(user, channel)) return res.status(403).json({ error: "forbidden" });

    const r = await pool.query(
      `
      SELECT
        id,
        post_id,
        body,
        author_name,
        author_email,
        author_user_id,
        created_at,
        updated_at
      FROM board_comments
      WHERE post_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [postId]
    );
    res.json({ rows: r.rows.map(mapCommentRow) });
  });

  app.post("/api/board/posts/:postId/comments", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const postId = parseTaskIdParam(req.params.postId);
    if (!postId) return res.status(400).json({ error: "invalid postId" });

    const postRow = await pool.query("SELECT channel FROM board_posts WHERE id = $1 LIMIT 1", [postId]);
    if (!postRow.rows.length) return res.status(404).json({ error: "post not found" });
    const channel = String(postRow.rows[0].channel || "announcements");
    if (!canUseChannel(user, channel)) return res.status(403).json({ error: "forbidden" });

    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) return res.status(400).json({ error: "body is required" });

    const authorName = user.name || user.email;
    const authorEmail = user.email || "";
    const authorUserId = Number(user.id);
    const r = await pool.query(
      `
      INSERT INTO board_comments (
        post_id, body, author_name, author_email, author_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, now(), now())
      RETURNING
        id, post_id, body, author_name, author_email, author_user_id, created_at, updated_at
      `,
      [postId, body, authorName, authorEmail, authorUserId]
    );
    res.status(201).json({ row: mapCommentRow(r.rows[0]) });
  });
}
