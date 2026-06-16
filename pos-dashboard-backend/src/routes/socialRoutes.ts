import fs from "fs";
import path from "path";
import type { Express } from "express";
import multer from "multer";
import type { Pool } from "pg";

type AuthUserLike = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

type RegisterSocialRoutesDeps = {
  app: Express;
  pool: Pool;
  socialUploadsDir: string;
  publicBaseUrl: string;
  runSocialDueJobsOnce: (maxJobs?: number) => Promise<number>;
};

const SOCIAL_PLATFORMS = ["facebook", "instagram", "google"] as const;
const VALID_POST_STATUSES = new Set(["draft", "scheduled", "publishing", "published", "failed"]);

function authUserFromReq(req: any): AuthUserLike | null {
  const user = (req as any).authUser as AuthUserLike | undefined;
  if (!user || !user.id) return null;
  return {
    id: String(user.id || ""),
    name: String(user.name || ""),
    email: String(user.email || ""),
    roles: Array.isArray(user.roles) ? user.roles.map((role) => String(role)) : [],
  };
}

function normalizePlatforms(raw: any): string[] {
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = String(item || "").trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    if (!SOCIAL_PLATFORMS.includes(value as any)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizePostStatus(raw: any): string {
  const value = String(raw || "").trim().toLowerCase();
  return VALID_POST_STATUSES.has(value) ? value : "draft";
}

function normalizeAssetKind(file: Express.Multer.File): string {
  const mime = String(file.mimetype || "").toLowerCase();
  const lower = String(file.originalname || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime === "image/gif" || lower.endsWith(".gif")) return "gif";
  return "image";
}

function normalizeGoogleTopicType(raw: any): string {
  const value = String(raw || "").trim().toUpperCase();
  const allowed = new Set(["STANDARD", "EVENT", "OFFER", "ALERT"]);
  return allowed.has(value) ? value : "STANDARD";
}

function normalizeGoogleCta(raw: any): string {
  const value = String(raw || "").trim().toUpperCase();
  const allowed = new Set(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]);
  return allowed.has(value) ? value : "LEARN_MORE";
}

function parseOptionalIso(raw: any): string | null {
  if (raw == null || raw === "") return null;
  const value = new Date(String(raw));
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function socialUploadMulter(dir: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (_req, file, cb) => {
        const safe = String(file.originalname || "asset").replace(/[^\w.\- ()]/g, "_");
        cb(null, `${Date.now()}_${safe}`);
      },
    }),
    limits: { fileSize: 150 * 1024 * 1024 },
  });
}

function mapAccountRow(row: any) {
  return {
    id: String(row.id ?? ""),
    platform: String(row.platform ?? ""),
    label: String(row.label ?? ""),
    externalId: String(row.external_id ?? ""),
    accessTokenConfigured: Boolean(String(row.access_token ?? "").trim()),
    tokenPreview: String(row.access_token ?? "").trim()
      ? `${String(row.access_token).trim().slice(0, 5)}...${String(row.access_token).trim().slice(-4)}`
      : "",
    refreshTokenConfigured: Boolean(String(row.refresh_token ?? "").trim()),
    tokenExpiresAt: row.token_expires_at || null,
    active: Boolean(row.active),
    configJson: row.config_json && typeof row.config_json === "object" ? row.config_json : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssetRow(row: any, publicBaseUrl: string) {
  const fileName = row.original_name || row.storage_name || "asset";
  return {
    id: String(row.id ?? ""),
    originalName: String(fileName),
    mimeType: String(row.mime_type ?? ""),
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    assetKind: String(row.asset_kind ?? "image"),
    publicUrl: `${publicBaseUrl.replace(/\/+$/, "")}/social/assets/${row.id}/${encodeURIComponent(String(fileName))}`,
    createdAt: row.created_at,
  };
}

function mapJobRow(row: any) {
  return {
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? ""),
    platform: String(row.platform ?? ""),
    accountId: row.account_id == null ? null : String(row.account_id),
    status: String(row.status ?? ""),
    scheduledFor: row.scheduled_for,
    attemptCount: Number(row.attempt_count ?? 0),
    providerPostId: row.provider_post_id ? String(row.provider_post_id) : null,
    lastError: String(row.last_error ?? ""),
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPostRow(row: any, asset: any, jobs: any[]) {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    caption: String(row.caption ?? ""),
    status: String(row.status ?? "draft"),
    scheduledFor: row.scheduled_for || null,
    timezone: String(row.timezone ?? "America/New_York"),
    linkUrl: String(row.link_url ?? ""),
    ctaLabel: String(row.cta_label ?? "LEARN_MORE"),
    googleTopicType: String(row.google_topic_type ?? "STANDARD"),
    googleEventTitle: String(row.google_event_title ?? ""),
    googleEventStart: row.google_event_start || null,
    googleEventEnd: row.google_event_end || null,
    platforms: Array.isArray(row.platforms) ? row.platforms.map((value: any) => String(value)) : [],
    platformAccountIds:
      row.platform_account_ids && typeof row.platform_account_ids === "object" ? row.platform_account_ids : {},
    asset,
    publishedAt: row.published_at || null,
    lastError: String(row.last_error ?? ""),
    createdByUserId: row.created_by_user_id == null ? null : String(row.created_by_user_id),
    updatedByUserId: row.updated_by_user_id == null ? null : String(row.updated_by_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    jobs,
  };
}

async function loadPosts(pool: Pool, publicBaseUrl: string, filters?: { status?: string; platform?: string; q?: string }) {
  const where: string[] = [];
  const params: any[] = [];
  if (filters?.status) {
    params.push(filters.status);
    where.push(`p.status = $${params.length}`);
  }
  if (filters?.platform) {
    params.push(filters.platform);
    where.push(`$${params.length} = ANY(COALESCE(p.platforms, '{}'::text[]))`);
  }
  if (filters?.q) {
    params.push(`%${filters.q.toLowerCase()}%`);
    where.push(`(lower(p.title) LIKE $${params.length} OR lower(p.caption) LIKE $${params.length})`);
  }
  const query = `
    SELECT
      p.id,
      p.title,
      p.caption,
      p.status,
      p.scheduled_for,
      p.timezone,
      p.link_url,
      p.cta_label,
      p.google_topic_type,
      p.google_event_title,
      p.google_event_start,
      p.google_event_end,
      p.platforms,
      p.platform_account_ids,
      p.asset_id,
      p.published_at,
      p.last_error,
      p.created_by_user_id,
      p.updated_by_user_id,
      p.created_at,
      p.updated_at
    FROM social_posts p
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY COALESCE(p.scheduled_for, p.created_at) DESC, p.id DESC
    LIMIT 200
  `;
  const result = await pool.query(query, params);
  const posts = result.rows;
  const assetIds = Array.from(new Set(posts.map((row: any) => Number(row.asset_id)).filter((id: number) => Number.isFinite(id))));
  const postIds = posts.map((row: any) => Number(row.id)).filter((id: number) => Number.isFinite(id));

  const assetsById = new Map<number, any>();
  if (assetIds.length) {
    const assetResult = await pool.query(
      `
        SELECT id, original_name, storage_name, mime_type, file_size_bytes, asset_kind, created_at
        FROM social_assets
        WHERE id = ANY($1::bigint[])
      `,
      [assetIds]
    );
    for (const row of assetResult.rows) {
      assetsById.set(Number(row.id), mapAssetRow(row, publicBaseUrl));
    }
  }

  const jobsByPost = new Map<number, any[]>();
  if (postIds.length) {
    const jobResult = await pool.query(
      `
        SELECT
          id,
          post_id,
          platform,
          account_id,
          status,
          scheduled_for,
          attempt_count,
          provider_post_id,
          last_error,
          started_at,
          finished_at,
          created_at,
          updated_at
        FROM social_publish_jobs
        WHERE post_id = ANY($1::bigint[])
        ORDER BY created_at DESC, id DESC
      `,
      [postIds]
    );
    for (const row of jobResult.rows) {
      const key = Number(row.post_id);
      const current = jobsByPost.get(key) || [];
      current.push(mapJobRow(row));
      jobsByPost.set(key, current);
    }
  }

  return posts.map((row: any) =>
    mapPostRow(row, row.asset_id ? assetsById.get(Number(row.asset_id)) || null : null, jobsByPost.get(Number(row.id)) || [])
  );
}

function normalizePlatformAccountIds(raw: any) {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    const platform = String(key || "").trim().toLowerCase();
    const accountId = String(value || "").trim();
    if (!SOCIAL_PLATFORMS.includes(platform as any)) continue;
    if (!accountId) continue;
    out[platform] = accountId;
  }
  return out;
}

async function syncJobsForPost(
  pool: Pool,
  postId: number,
  platforms: string[],
  scheduledForIso: string,
  platformAccountIds: Record<string, string>
) {
  await pool.query(
    `
      UPDATE social_publish_jobs
      SET status = 'cancelled', finished_at = now(), updated_at = now()
      WHERE post_id = $1 AND status IN ('scheduled', 'publishing', 'failed')
    `,
    [postId]
  );

  for (const platform of platforms) {
    await pool.query(
      `
        INSERT INTO social_publish_jobs (
          post_id, platform, account_id, status, scheduled_for, attempt_count, created_at, updated_at
        )
        VALUES ($1, $2, $3::bigint, 'scheduled', $4::timestamptz, 0, now(), now())
      `,
      [
        postId,
        platform,
        platformAccountIds[platform] ? Number(platformAccountIds[platform]) : null,
        scheduledForIso,
      ]
    );
  }
}

export function registerPublicSocialRoutes({ app, pool, socialUploadsDir }: Pick<RegisterSocialRoutesDeps, "app" | "pool" | "socialUploadsDir">) {
  app.get("/api/social/assets/:assetId/:name", async (req, res) => {
    const assetId = Number(req.params.assetId);
    if (!Number.isFinite(assetId) || assetId <= 0) return res.status(400).send("invalid asset");
    const result = await pool.query(
      `
        SELECT storage_name, original_name, mime_type
        FROM social_assets
        WHERE id = $1
        LIMIT 1
      `,
      [assetId]
    );
    if (!result.rows.length) return res.status(404).send("not found");
    const row = result.rows[0];
    const filePath = path.join(socialUploadsDir, String(row.storage_name || ""));
    if (!fs.existsSync(filePath)) return res.status(404).send("missing file");
    if (row.mime_type) res.setHeader("Content-Type", String(row.mime_type));
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.sendFile(filePath);
  });
}

export function registerSocialRoutes({
  app,
  pool,
  socialUploadsDir,
  publicBaseUrl,
  runSocialDueJobsOnce,
}: RegisterSocialRoutesDeps) {
  fs.mkdirSync(socialUploadsDir, { recursive: true });
  const upload = socialUploadMulter(socialUploadsDir);

  app.get("/api/social/accounts", async (_req, res) => {
    const result = await pool.query(
      `
        SELECT
          id,
          platform,
          label,
          external_id,
          access_token,
          refresh_token,
          token_expires_at,
          active,
          config_json,
          created_at,
          updated_at
        FROM social_accounts
        ORDER BY platform ASC, active DESC, updated_at DESC, id DESC
      `
    );
    res.json({ rows: result.rows.map(mapAccountRow) });
  });

  app.post("/api/social/accounts", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const accountId = req.body?.id ? Number(req.body.id) : null;
    const platform = String(req.body?.platform || "").trim().toLowerCase();
    if (!SOCIAL_PLATFORMS.includes(platform as any)) return res.status(400).json({ error: "invalid platform" });

    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const externalId = typeof req.body?.externalId === "string" ? req.body.externalId.trim() : "";
    const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken.trim() : "";
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken.trim() : "";
    const tokenExpiresAt = parseOptionalIso(req.body?.tokenExpiresAt);
    const active = Boolean(req.body?.active);
    const configJson = req.body?.configJson && typeof req.body.configJson === "object" ? req.body.configJson : {};

    let result;
    if (accountId && Number.isFinite(accountId)) {
      result = await pool.query(
        `
          UPDATE social_accounts
          SET
            platform = $2,
            label = $3,
            external_id = $4,
            access_token = CASE WHEN $5 <> '' THEN $5 ELSE access_token END,
            refresh_token = CASE WHEN $6 <> '' THEN $6 ELSE refresh_token END,
            token_expires_at = $7::timestamptz,
            active = $8,
            config_json = $9::jsonb,
            updated_at = now()
          WHERE id = $1
          RETURNING
            id, platform, label, external_id, access_token, refresh_token, token_expires_at, active, config_json, created_at, updated_at
        `,
        [accountId, platform, label, externalId, accessToken, refreshToken, tokenExpiresAt, active, JSON.stringify(configJson)]
      );
      if (!result.rows.length) return res.status(404).json({ error: "account not found" });
    } else {
      result = await pool.query(
        `
          INSERT INTO social_accounts (
            platform, label, external_id, access_token, refresh_token, token_expires_at, active, config_json, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::jsonb, now(), now())
          RETURNING
            id, platform, label, external_id, access_token, refresh_token, token_expires_at, active, config_json, created_at, updated_at
        `,
        [platform, label, externalId, accessToken, refreshToken, tokenExpiresAt, active, JSON.stringify(configJson)]
      );
    }
    res.json({ row: mapAccountRow(result.rows[0]) });
  });

  app.post("/api/social/assets", upload.single("file"), async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const kind = normalizeAssetKind(req.file);
    const result = await pool.query(
      `
        INSERT INTO social_assets (
          storage_name, original_name, mime_type, file_size_bytes, asset_kind, created_by_user_id, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
        RETURNING id, original_name, storage_name, mime_type, file_size_bytes, asset_kind, created_at
      `,
      [
        req.file.filename,
        req.file.originalname,
        req.file.mimetype || "application/octet-stream",
        Number(req.file.size || 0),
        kind,
        Number(user.id),
      ]
    );

    res.status(201).json({ row: mapAssetRow(result.rows[0], publicBaseUrl) });
  });

  app.get("/api/social/posts", async (req, res) => {
    const status = typeof req.query?.status === "string" ? normalizePostStatus(req.query.status) : "";
    const platform =
      typeof req.query?.platform === "string" && SOCIAL_PLATFORMS.includes(String(req.query.platform).toLowerCase() as any)
        ? String(req.query.platform).toLowerCase()
        : "";
    const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    const rows = await loadPosts(pool, publicBaseUrl, {
      status: status || undefined,
      platform: platform || undefined,
      q: q || undefined,
    });
    res.json({ rows });
  });

  app.post("/api/social/posts", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const caption = typeof req.body?.caption === "string" ? req.body.caption.trim() : "";
    const status = normalizePostStatus(req.body?.status);
    const scheduledFor = parseOptionalIso(req.body?.scheduledFor);
    const timezone = typeof req.body?.timezone === "string" ? req.body.timezone.trim() : "America/New_York";
    const linkUrl = typeof req.body?.linkUrl === "string" ? req.body.linkUrl.trim() : "";
    const ctaLabel = normalizeGoogleCta(req.body?.ctaLabel);
    const platforms = normalizePlatforms(req.body?.platforms);
    const platformAccountIds = normalizePlatformAccountIds(req.body?.platformAccountIds);
    const assetId = req.body?.assetId ? Number(req.body.assetId) : null;
    const googleTopicType = normalizeGoogleTopicType(req.body?.googleTopicType);
    const googleEventTitle = typeof req.body?.googleEventTitle === "string" ? req.body.googleEventTitle.trim() : "";
    const googleEventStart = parseOptionalIso(req.body?.googleEventStart);
    const googleEventEnd = parseOptionalIso(req.body?.googleEventEnd);

    if (!title && !caption) return res.status(400).json({ error: "title or caption is required" });
    if ((status === "scheduled" || status === "publishing") && (!scheduledFor || !platforms.length)) {
      return res.status(400).json({ error: "scheduled posts require scheduledFor and at least one platform" });
    }

    const result = await pool.query(
      `
        INSERT INTO social_posts (
          title,
          caption,
          status,
          scheduled_for,
          timezone,
          link_url,
          cta_label,
          google_topic_type,
          google_event_title,
          google_event_start,
          google_event_end,
          platforms,
          platform_account_ids,
          asset_id,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4::timestamptz, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz, $12::text[], $13::jsonb, $14, $15, $15, now(), now()
        )
        RETURNING id
      `,
      [
        title,
        caption,
        status,
        scheduledFor,
        timezone || "America/New_York",
        linkUrl,
        ctaLabel,
        googleTopicType,
        googleEventTitle,
        googleEventStart,
        googleEventEnd,
        platforms,
        JSON.stringify(platformAccountIds),
        assetId && Number.isFinite(assetId) ? assetId : null,
        Number(user.id),
      ]
    );
    const postId = Number(result.rows[0].id);
    if (status === "scheduled" && scheduledFor && platforms.length) {
      await syncJobsForPost(pool, postId, platforms, scheduledFor, platformAccountIds);
    }
    const rows = await loadPosts(pool, publicBaseUrl, {});
    const post = rows.find((item: any) => Number(item.id) === postId);
    res.status(201).json({ row: post || null });
  });

  app.patch("/api/social/posts/:id", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: "invalid id" });

    const fields: string[] = [];
    const params: any[] = [];
    const setField = (sql: string, value: any) => {
      params.push(value);
      fields.push(`${sql} = $${params.length}`);
    };

    if (req.body?.title !== undefined) setField("title", String(req.body.title || "").trim());
    if (req.body?.caption !== undefined) setField("caption", String(req.body.caption || "").trim());
    if (req.body?.status !== undefined) setField("status", normalizePostStatus(req.body.status));
    if (req.body?.scheduledFor !== undefined) setField("scheduled_for", parseOptionalIso(req.body.scheduledFor));
    if (req.body?.timezone !== undefined) setField("timezone", String(req.body.timezone || "America/New_York").trim());
    if (req.body?.linkUrl !== undefined) setField("link_url", String(req.body.linkUrl || "").trim());
    if (req.body?.ctaLabel !== undefined) setField("cta_label", normalizeGoogleCta(req.body.ctaLabel));
    if (req.body?.googleTopicType !== undefined) setField("google_topic_type", normalizeGoogleTopicType(req.body.googleTopicType));
    if (req.body?.googleEventTitle !== undefined) setField("google_event_title", String(req.body.googleEventTitle || "").trim());
    if (req.body?.googleEventStart !== undefined) setField("google_event_start", parseOptionalIso(req.body.googleEventStart));
    if (req.body?.googleEventEnd !== undefined) setField("google_event_end", parseOptionalIso(req.body.googleEventEnd));
    if (req.body?.platforms !== undefined) setField("platforms", normalizePlatforms(req.body.platforms));
    if (req.body?.platformAccountIds !== undefined) {
      params.push(JSON.stringify(normalizePlatformAccountIds(req.body.platformAccountIds)));
      fields.push(`platform_account_ids = $${params.length}::jsonb`);
    }
    if (req.body?.assetId !== undefined) {
      const assetId = req.body.assetId ? Number(req.body.assetId) : null;
      setField("asset_id", assetId && Number.isFinite(assetId) ? assetId : null);
    }

    params.push(Number(user.id));
    fields.push(`updated_by_user_id = $${params.length}`);
    if (!fields.length) return res.status(400).json({ error: "no fields to update" });

    params.push(postId);
    await pool.query(
      `
        UPDATE social_posts
        SET ${fields.join(", ")}, updated_at = now()
        WHERE id = $${params.length}
      `,
      params
    );

    const rows = await loadPosts(pool, publicBaseUrl, {});
    const post = rows.find((item: any) => Number(item.id) === postId);
    if (!post) return res.status(404).json({ error: "not found" });
    res.json({ row: post });
  });

  app.delete("/api/social/posts/:id", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: "invalid id" });

    await pool.query(
      `
        DELETE FROM social_publish_jobs
        WHERE post_id = $1
      `,
      [postId]
    );
    const result = await pool.query(
      `
        DELETE FROM social_posts
        WHERE id = $1
        RETURNING id
      `,
      [postId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "not found" });
    res.json({ ok: true, id: String(result.rows[0].id) });
  });

  app.post("/api/social/posts/:id/schedule", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: "invalid id" });

    const scheduledFor = parseOptionalIso(req.body?.scheduledFor);
    const platforms = normalizePlatforms(req.body?.platforms);
    const platformAccountIds = normalizePlatformAccountIds(req.body?.platformAccountIds);
    if (!scheduledFor || !platforms.length) {
      return res.status(400).json({ error: "scheduledFor and at least one platform are required" });
    }

    await pool.query(
      `
        UPDATE social_posts
        SET status = 'scheduled', scheduled_for = $2::timestamptz, platforms = $3::text[], platform_account_ids = $4::jsonb, last_error = '', updated_by_user_id = $5, updated_at = now()
        WHERE id = $1
      `,
      [postId, scheduledFor, platforms, JSON.stringify(platformAccountIds), Number(user.id)]
    );
    await syncJobsForPost(pool, postId, platforms, scheduledFor, platformAccountIds);
    const rows = await loadPosts(pool, publicBaseUrl, {});
    const post = rows.find((item: any) => Number(item.id) === postId);
    res.json({ row: post || null });
  });

  app.post("/api/social/posts/:id/publish-now", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: "invalid id" });

    const when = new Date().toISOString();
    const platforms = normalizePlatforms(req.body?.platforms);
    const platformAccountIds = normalizePlatformAccountIds(req.body?.platformAccountIds);
    const existing = await pool.query("SELECT platforms, platform_account_ids FROM social_posts WHERE id = $1 LIMIT 1", [postId]);
    if (!existing.rows.length) return res.status(404).json({ error: "post not found" });
    const resolvedPlatforms = platforms.length ? platforms : normalizePlatforms(existing.rows[0].platforms);
    if (!resolvedPlatforms.length) return res.status(400).json({ error: "at least one platform is required" });

    await pool.query(
      `
        UPDATE social_posts
        SET status = 'scheduled', scheduled_for = $2::timestamptz, platforms = $3::text[], platform_account_ids = $4::jsonb, last_error = '', updated_by_user_id = $5, updated_at = now()
        WHERE id = $1
      `,
      [
        postId,
        when,
        resolvedPlatforms,
        JSON.stringify(
          Object.keys(platformAccountIds).length
            ? platformAccountIds
            : normalizePlatformAccountIds(existing.rows[0]?.platform_account_ids)
        ),
        Number(user.id),
      ]
    );
    await syncJobsForPost(
      pool,
      postId,
      resolvedPlatforms,
      when,
      Object.keys(platformAccountIds).length
        ? platformAccountIds
        : normalizePlatformAccountIds(existing.rows[0]?.platform_account_ids)
    );
    await runSocialDueJobsOnce(10);
    const rows = await loadPosts(pool, publicBaseUrl, {});
    const post = rows.find((item: any) => Number(item.id) === postId);
    res.json({ row: post || null });
  });

  app.post("/api/social/posts/:id/cancel", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const postId = Number(req.params.id);
    if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: "invalid id" });

    await pool.query(
      `
        UPDATE social_posts
        SET status = 'draft', last_error = '', updated_by_user_id = $2, updated_at = now()
        WHERE id = $1
      `,
      [postId, Number(user.id)]
    );
    await pool.query(
      `
        UPDATE social_publish_jobs
        SET status = 'cancelled', finished_at = now(), updated_at = now()
        WHERE post_id = $1 AND status IN ('scheduled', 'publishing', 'failed')
      `,
      [postId]
    );

    const rows = await loadPosts(pool, publicBaseUrl, {});
    const post = rows.find((item: any) => Number(item.id) === postId);
    res.json({ row: post || null });
  });
}
