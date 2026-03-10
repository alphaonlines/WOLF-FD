import fs from "fs";
import path from "path";
import type { Express } from "express";
import multer from "multer";
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

function canManageAllMessages(user: AuthUserLike | null): boolean {
  return hasAnyRole(user, ["Owner", "Manager"]);
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

function toNumericUserId(user: AuthUserLike | null): number | null {
  if (!user) return null;
  const value = Number(user.id);
  return Number.isFinite(value) ? value : null;
}

function normalizeScope(raw: any): "channel" | "dm" {
  return String(raw || "").trim().toLowerCase() === "dm" ? "dm" : "channel";
}

function boardUploadMulter(dir: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (_req, file, cb) => {
        const safe = String(file.originalname || "attachment").replace(/[^\w.\- ()]/g, "_");
        cb(null, `${Date.now()}_${safe}`);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
  });
}

function parseMentions(body: string) {
  const tokens = body.match(/@(?:[a-z0-9._-]+)/gi) || [];
  return Array.from(new Set(tokens.map((token) => token.slice(1).toLowerCase())));
}

function mapUploadRow(row: any, publicBaseUrl: string) {
  if (!row || row.upload_id == null) return null;
  const fileName = String(row.upload_original_name || row.upload_storage_name || "attachment");
  return {
    id: String(row.upload_id ?? ""),
    originalName: fileName,
    mimeType: String(row.upload_mime_type ?? "application/octet-stream"),
    fileSizeBytes: Number(row.upload_file_size_bytes ?? 0),
    publicUrl: `${publicBaseUrl.replace(/\/+$/, "")}/api/board/uploads/${row.upload_id}/${encodeURIComponent(fileName)}`,
    createdAt: row.upload_created_at || row.created_at || new Date().toISOString(),
  };
}

function mapMessageRow(row: any, publicBaseUrl: string) {
  return {
    id: String(row.id ?? ""),
    scope: String(row.scope ?? "channel"),
    channel: row.channel ? String(row.channel) : null,
    body: String(row.body ?? ""),
    priority: Boolean(row.priority),
    authorName: String(row.author_name ?? ""),
    authorEmail: String(row.author_email ?? ""),
    authorUserId: row.author_user_id == null ? null : String(row.author_user_id),
    recipientUserId: row.recipient_user_id == null ? null : String(row.recipient_user_id),
    recipientName: row.recipient_name ? String(row.recipient_name) : "",
    recipientEmail: row.recipient_email ? String(row.recipient_email) : "",
    attachment: mapUploadRow(row, publicBaseUrl),
    mentions: parseMentions(String(row.body ?? "")),
    editedAt: row.edited_at || null,
    deletedAt: row.deleted_at || null,
    forwardedFromMessageId: row.forwarded_from_message_id == null ? null : String(row.forwarded_from_message_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContactRow(row: any) {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    roles: Array.isArray(row.roles) ? row.roles.map((role: any) => String(role)) : [],
    active: Boolean(row.active),
    lastMessageAt: row.last_message_at || null,
    lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : "",
  };
}

async function resolveRecipient(pool: Pool, recipientUserId: number) {
  const result = await pool.query(
    `
      SELECT id, name, email, active
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [recipientUserId]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  if (!Boolean(row.active)) return null;
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
  };
}

async function loadMessageForAccess(pool: Pool, messageId: number) {
  const result = await pool.query(
    `
      SELECT
        m.id,
        m.scope,
        m.channel,
        m.body,
        m.priority,
        m.author_name,
        m.author_email,
        m.author_user_id,
        m.recipient_user_id,
        m.recipient_name,
        m.recipient_email,
        m.attachment_upload_id,
        m.forwarded_from_message_id,
        m.edited_at,
        m.deleted_at,
        m.created_at,
        m.updated_at,
        u.id AS upload_id,
        u.storage_name AS upload_storage_name,
        u.original_name AS upload_original_name,
        u.mime_type AS upload_mime_type,
        u.file_size_bytes AS upload_file_size_bytes,
        u.created_at AS upload_created_at
      FROM board_messages m
      LEFT JOIN board_uploads u ON u.id = m.attachment_upload_id
      WHERE m.id = $1
      LIMIT 1
    `,
    [messageId]
  );
  return result.rows[0] || null;
}

function canAccessMessage(user: AuthUserLike | null, row: any): boolean {
  if (!user || !row) return false;
  if (row.deleted_at) return false;
  const userId = toNumericUserId(user);
  if (row.scope === "dm") {
    return userId !== null && (Number(row.author_user_id) === userId || Number(row.recipient_user_id) === userId);
  }
  return canUseChannel(user, String(row.channel || "announcements"));
}

function canMutateMessage(user: AuthUserLike | null, row: any): boolean {
  if (!user || !row) return false;
  const userId = toNumericUserId(user);
  return canManageAllMessages(user) || (userId !== null && Number(row.author_user_id) === userId);
}

function buildMessageSelectSql(whereSql: string) {
  return `
    SELECT
      m.id,
      m.scope,
      m.channel,
      m.body,
      m.priority,
      m.author_name,
      m.author_email,
      m.author_user_id,
      m.recipient_user_id,
      m.recipient_name,
      m.recipient_email,
      m.attachment_upload_id,
      m.forwarded_from_message_id,
      m.edited_at,
      m.deleted_at,
      m.created_at,
      m.updated_at,
      u.id AS upload_id,
      u.storage_name AS upload_storage_name,
      u.original_name AS upload_original_name,
      u.mime_type AS upload_mime_type,
      u.file_size_bytes AS upload_file_size_bytes,
      u.created_at AS upload_created_at
    FROM board_messages m
    LEFT JOIN board_uploads u ON u.id = m.attachment_upload_id
    ${whereSql}
  `;
}

export function registerBoardRoutes(app: Express, pool: Pool, boardUploadsDir: string, publicBaseUrl: string) {
  fs.mkdirSync(boardUploadsDir, { recursive: true });
  const upload = boardUploadMulter(boardUploadsDir);

  app.get("/api/board/uploads/:uploadId/:name", async (req, res) => {
    const uploadId = Number(req.params.uploadId);
    if (!Number.isFinite(uploadId) || uploadId <= 0) return res.status(400).send("invalid upload");
    const result = await pool.query(
      `
        SELECT storage_name, original_name, mime_type
        FROM board_uploads
        WHERE id = $1
        LIMIT 1
      `,
      [uploadId]
    );
    if (!result.rows.length) return res.status(404).send("not found");
    const row = result.rows[0];
    const filePath = path.join(boardUploadsDir, String(row.storage_name || ""));
    if (!fs.existsSync(filePath)) return res.status(404).send("missing file");
    if (row.mime_type) res.setHeader("Content-Type", String(row.mime_type));
    res.setHeader("Cache-Control", "private, max-age=120");
    return res.sendFile(filePath);
  });

  app.get("/api/board/channels", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const counts = await pool.query(
      `
      SELECT channel, COUNT(*)::int AS n
      FROM board_messages
      WHERE scope = 'channel' AND deleted_at IS NULL
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

  app.get("/api/board/users", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const userId = toNumericUserId(user);

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.active,
        COALESCE(
          ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
          ARRAY[]::text[]
        ) AS roles,
        MAX(dm.created_at) AS last_message_at,
        (
          ARRAY_REMOVE(
            ARRAY_AGG(dm.body ORDER BY dm.created_at DESC, dm.id DESC),
            NULL
          )
        )[1] AS last_message_preview
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN board_messages dm
        ON dm.scope = 'dm'
        AND dm.deleted_at IS NULL
        AND $1::bigint IS NOT NULL
        AND (
          (dm.author_user_id = $1::bigint AND dm.recipient_user_id = u.id)
          OR
          (dm.author_user_id = u.id AND dm.recipient_user_id = $1::bigint)
        )
      WHERE u.active = TRUE
        AND ($1::bigint IS NULL OR u.id <> $1::bigint)
      GROUP BY u.id, u.name, u.email, u.active
      ORDER BY MAX(dm.created_at) DESC NULLS LAST, lower(u.name) ASC, lower(u.email) ASC
      `
      ,
      [userId]
    );

    res.json({ rows: result.rows.map(mapContactRow) });
  });

  app.get("/api/board/messages", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const userId = toNumericUserId(user);
    const scope = normalizeScope(req.query?.scope);

    if (scope === "dm") {
      const otherUserId = parseTaskIdParam(req.query?.userId);
      if (!otherUserId) return res.status(400).json({ error: "invalid userId" });
      if (userId === null) return res.status(400).json({ error: "invalid current user" });

      const result = await pool.query(
        `
        ${buildMessageSelectSql(
          `WHERE m.scope = 'dm'
             AND m.deleted_at IS NULL
             AND (
               (m.author_user_id = $1::bigint AND m.recipient_user_id = $2::bigint)
               OR
               (m.author_user_id = $2::bigint AND m.recipient_user_id = $1::bigint)
             )
           ORDER BY m.created_at ASC, m.id ASC
           LIMIT 500`
        )}
        `,
        [userId, otherUserId]
      );
      return res.json({ rows: result.rows.map((row) => mapMessageRow(row, publicBaseUrl)) });
    }

    const channel = normalizeChannel(req.query?.channel);
    if (!canUseChannel(user, channel)) return res.status(403).json({ error: "forbidden" });
    const result = await pool.query(
      `
      ${buildMessageSelectSql(
        `WHERE m.scope = 'channel'
           AND m.deleted_at IS NULL
           AND m.channel = $1
         ORDER BY m.created_at ASC, m.id ASC
         LIMIT 500`
      )}
      `,
      [channel]
    );
    return res.json({ rows: result.rows.map((row) => mapMessageRow(row, publicBaseUrl)) });
  });

  app.post("/api/board/uploads", upload.single("file"), async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const uploaderId = toNumericUserId(user);
    const insert = await pool.query(
      `
      INSERT INTO board_uploads (
        storage_name, original_name, mime_type, file_size_bytes, uploaded_by_user_id, created_at
      )
      VALUES ($1, $2, $3, $4, $5, now())
      RETURNING id, storage_name, original_name, mime_type, file_size_bytes, created_at
      `,
      [
        req.file.filename,
        req.file.originalname,
        req.file.mimetype || "application/octet-stream",
        req.file.size || 0,
        uploaderId,
      ]
    );

    const row = insert.rows[0];
    res.status(201).json({
      row: {
        id: String(row.id ?? ""),
        originalName: String(row.original_name ?? ""),
        mimeType: String(row.mime_type ?? "application/octet-stream"),
        fileSizeBytes: Number(row.file_size_bytes ?? 0),
        publicUrl: `${publicBaseUrl.replace(/\/+$/, "")}/api/board/uploads/${row.id}/${encodeURIComponent(String(row.original_name || "attachment"))}`,
        createdAt: row.created_at,
      },
    });
  });

  app.post("/api/board/messages", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const userId = toNumericUserId(user);
    if (userId === null) return res.status(400).json({ error: "invalid current user" });

    const scope = normalizeScope(req.body?.scope);
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) return res.status(400).json({ error: "body is required" });
    const priority = Boolean(req.body?.priority);
    const attachmentUploadId = req.body?.attachmentUploadId ? Number(req.body.attachmentUploadId) : null;
    if (attachmentUploadId !== null && !Number.isFinite(attachmentUploadId)) {
      return res.status(400).json({ error: "invalid attachmentUploadId" });
    }

    let channel: string | null = null;
    let recipientUserId: number | null = null;
    let recipientName = "";
    let recipientEmail = "";

    if (scope === "dm") {
      recipientUserId = parseTaskIdParam(req.body?.recipientUserId);
      if (!recipientUserId) return res.status(400).json({ error: "recipientUserId is required" });
      if (recipientUserId === userId) return res.status(400).json({ error: "cannot message yourself" });
      const recipient = await resolveRecipient(pool, recipientUserId);
      if (!recipient) return res.status(404).json({ error: "recipient not found" });
      recipientName = recipient.name;
      recipientEmail = recipient.email;
    } else {
      channel = normalizeChannel(req.body?.channel);
      if (!canUseChannel(user, channel)) return res.status(403).json({ error: "forbidden" });
    }

    const authorName = user.name || user.email;
    const authorEmail = user.email || "";

    const result = await pool.query(
      `
      WITH inserted AS (
        INSERT INTO board_messages (
          scope,
          channel,
          body,
          priority,
          author_name,
          author_email,
          author_user_id,
          recipient_user_id,
          recipient_name,
          recipient_email,
          attachment_upload_id,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
        RETURNING id
      )
      ${buildMessageSelectSql(`INNER JOIN inserted i ON i.id = m.id`)}
      `,
      [
        scope,
        channel,
        body,
        priority,
        authorName,
        authorEmail,
        userId,
        recipientUserId,
        recipientName,
        recipientEmail,
        attachmentUploadId,
      ]
    );

    res.status(201).json({ row: mapMessageRow(result.rows[0], publicBaseUrl) });
  });

  app.patch("/api/board/messages/:messageId", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const messageId = parseTaskIdParam(req.params.messageId);
    if (!messageId) return res.status(400).json({ error: "invalid messageId" });

    const existing = await loadMessageForAccess(pool, messageId);
    if (!existing || !canAccessMessage(user, existing)) return res.status(404).json({ error: "message not found" });
    if (!canMutateMessage(user, existing)) return res.status(403).json({ error: "forbidden" });

    const nextBody = req.body?.body === undefined ? String(existing.body ?? "") : String(req.body.body || "").trim();
    if (!nextBody) return res.status(400).json({ error: "body is required" });
    const nextPriority = req.body?.priority === undefined ? Boolean(existing.priority) : Boolean(req.body.priority);

    const result = await pool.query(
      `
      WITH updated AS (
        UPDATE board_messages
        SET body = $2,
            priority = $3,
            edited_at = now(),
            updated_at = now()
        WHERE id = $1
        RETURNING id
      )
      ${buildMessageSelectSql(`INNER JOIN updated u2 ON u2.id = m.id`)}
      `,
      [messageId, nextBody, nextPriority]
    );

    res.json({ row: mapMessageRow(result.rows[0], publicBaseUrl) });
  });

  app.delete("/api/board/messages/:messageId", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const messageId = parseTaskIdParam(req.params.messageId);
    if (!messageId) return res.status(400).json({ error: "invalid messageId" });

    const existing = await loadMessageForAccess(pool, messageId);
    if (!existing || !canAccessMessage(user, existing)) return res.status(404).json({ error: "message not found" });
    if (!canMutateMessage(user, existing)) return res.status(403).json({ error: "forbidden" });

    await pool.query(
      `
      UPDATE board_messages
      SET deleted_at = now(), updated_at = now()
      WHERE id = $1
      `,
      [messageId]
    );

    res.json({ ok: true });
  });

  app.post("/api/board/messages/:messageId/forward", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const userId = toNumericUserId(user);
    const messageId = parseTaskIdParam(req.params.messageId);
    if (!messageId || userId === null) return res.status(400).json({ error: "invalid request" });

    const source = await loadMessageForAccess(pool, messageId);
    if (!source || !canAccessMessage(user, source)) return res.status(404).json({ error: "message not found" });

    const scope = normalizeScope(req.body?.scope);
    let channel: string | null = null;
    let recipientUserId: number | null = null;
    let recipientName = "";
    let recipientEmail = "";

    if (scope === "dm") {
      recipientUserId = parseTaskIdParam(req.body?.recipientUserId);
      if (!recipientUserId) return res.status(400).json({ error: "recipientUserId is required" });
      if (recipientUserId === userId) return res.status(400).json({ error: "cannot message yourself" });
      const recipient = await resolveRecipient(pool, recipientUserId);
      if (!recipient) return res.status(404).json({ error: "recipient not found" });
      recipientName = recipient.name;
      recipientEmail = recipient.email;
    } else {
      channel = normalizeChannel(req.body?.channel);
      if (!canUseChannel(user, channel)) return res.status(403).json({ error: "forbidden" });
    }

    const authorName = user.name || user.email;
    const authorEmail = user.email || "";
    const result = await pool.query(
      `
      WITH inserted AS (
        INSERT INTO board_messages (
          scope,
          channel,
          body,
          priority,
          author_name,
          author_email,
          author_user_id,
          recipient_user_id,
          recipient_name,
          recipient_email,
          attachment_upload_id,
          forwarded_from_message_id,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
        RETURNING id
      )
      ${buildMessageSelectSql(`INNER JOIN inserted i ON i.id = m.id`)}
      `,
      [
        scope,
        channel,
        String(source.body ?? ""),
        Boolean(source.priority),
        authorName,
        authorEmail,
        userId,
        recipientUserId,
        recipientName,
        recipientEmail,
        source.attachment_upload_id == null ? null : Number(source.attachment_upload_id),
        messageId,
      ]
    );

    res.status(201).json({ row: mapMessageRow(result.rows[0], publicBaseUrl) });
  });
}
