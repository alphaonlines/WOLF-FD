import type { Pool } from "pg";

type SocialPlatform = "facebook" | "instagram" | "google";
type SocialAccountRow = {
  id: number;
  platform: SocialPlatform;
  label: string;
  external_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  active: boolean;
  config_json: Record<string, any> | null;
};

type SocialAssetRow = {
  id: number;
  storage_name: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  asset_kind: string;
};

type SocialPostRow = {
  id: number;
  title: string;
  caption: string;
  status: string;
  scheduled_for: string | null;
  timezone: string;
  link_url: string;
  cta_label: string;
  google_topic_type: string;
  google_event_title: string;
  google_event_start: string | null;
  google_event_end: string | null;
  platforms: string[] | null;
  platform_account_ids: Record<string, any> | null;
  asset_id: number | null;
  published_at: string | null;
  last_error: string;
};

type SocialJobRow = {
  id: number;
  post_id: number;
  platform: SocialPlatform;
  account_id: number | null;
  status: string;
  scheduled_for: string;
  attempt_count: number;
  provider_post_id: string | null;
  provider_response: Record<string, any> | null;
  last_error: string;
};

type PublishResult = {
  providerPostId?: string | null;
  response?: any;
};

type CreatePublisherDeps = {
  pool: Pool;
  publicBaseUrl: string;
};

const META_API_VERSION = "v25.0";
const GOOGLE_API_BASE = "https://mybusiness.googleapis.com/v4";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function jsonHeaders(extra?: Record<string, string>) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

function sanitizeCaption(post: SocialPostRow): string {
  const parts = [String(post.caption || "").trim()];
  if (post.link_url && post.platforms?.includes("instagram")) {
    parts.push(String(post.link_url).trim());
  }
  return parts.filter(Boolean).join("\n\n").trim();
}

function normalizeGoogleActionType(input: string): string {
  const value = String(input || "").trim().toUpperCase();
  const allowed = new Set([
    "BOOK",
    "ORDER",
    "SHOP",
    "LEARN_MORE",
    "SIGN_UP",
    "CALL",
  ]);
  return allowed.has(value) ? value : "LEARN_MORE";
}

function assetPublicUrl(publicBaseUrl: string, asset: SocialAssetRow | null): string | null {
  if (!asset) return null;
  const safeBase = publicBaseUrl.replace(/\/+$/, "");
  return `${safeBase}/social/assets/${asset.id}/${encodeURIComponent(asset.original_name || asset.storage_name)}`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message =
      typeof body === "string"
        ? body
        : body?.error?.message || body?.message || `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return body;
}

async function logJob(pool: Pool, jobId: number, level: string, message: string, meta?: Record<string, any>) {
  await pool.query(
    `
      INSERT INTO social_publish_logs (job_id, level, message, meta_json, created_at)
      VALUES ($1, $2, $3, $4::jsonb, now())
    `,
    [jobId, level, message, JSON.stringify(meta || {})]
  );
}

async function publishToFacebook(account: SocialAccountRow, post: SocialPostRow, asset: SocialAssetRow | null, publicBaseUrl: string) {
  const pageId = String(account.external_id || "").trim();
  const accessToken = String(account.access_token || "").trim();
  if (!pageId || !accessToken) throw new Error("Facebook account is not configured with page ID and access token.");

  const assetUrl = assetPublicUrl(publicBaseUrl, asset);
  const caption = sanitizeCaption(post) || post.title || "WOLF FD update";

  if (!asset || !assetUrl) {
    return fetchJson(`https://graph.facebook.com/${META_API_VERSION}/${pageId}/feed`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        message: caption,
        link: post.link_url || undefined,
        access_token: accessToken,
      }),
    });
  }

  if (asset.asset_kind === "video" || asset.asset_kind === "gif") {
    return fetchJson(`https://graph.facebook.com/${META_API_VERSION}/${pageId}/videos`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        description: caption,
        file_url: assetUrl,
        access_token: accessToken,
      }),
    });
  }

  return fetchJson(`https://graph.facebook.com/${META_API_VERSION}/${pageId}/photos`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      caption,
      url: assetUrl,
      access_token: accessToken,
    }),
  });
}

async function waitForInstagramContainer(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await fetchJson(
      `https://graph.facebook.com/${META_API_VERSION}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    const code = String(status?.status_code || status?.status || "").toUpperCase();
    if (!code || code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram media container failed with status ${code}.`);
    }
    await sleep(2500);
  }
}

async function publishToInstagram(account: SocialAccountRow, post: SocialPostRow, asset: SocialAssetRow | null, publicBaseUrl: string) {
  const igId = String(account.external_id || "").trim();
  const accessToken = String(account.access_token || "").trim();
  if (!igId || !accessToken) throw new Error("Instagram account is not configured with account ID and access token.");
  if (!asset) throw new Error("Instagram publishing requires an uploaded image or video asset.");

  const assetUrl = assetPublicUrl(publicBaseUrl, asset);
  if (!assetUrl) throw new Error("Instagram asset URL could not be built.");
  if (asset.asset_kind === "gif") {
    throw new Error("Instagram direct publishing does not support GIF uploads. Export as MP4 reel/video or JPG image.");
  }

  const caption = [String(post.caption || "").trim(), post.link_url ? String(post.link_url).trim() : ""]
    .filter(Boolean)
    .join("\n\n");

  const mediaPayload =
    asset.asset_kind === "video"
      ? {
          caption,
          video_url: assetUrl,
          media_type: "REELS",
          access_token: accessToken,
        }
      : {
          caption,
          image_url: assetUrl,
          access_token: accessToken,
        };

  const container = await fetchJson(`https://graph.facebook.com/${META_API_VERSION}/${igId}/media`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(mediaPayload),
  });

  const containerId = String(container?.id || "").trim();
  if (!containerId) throw new Error("Instagram media container was created without an ID.");

  await waitForInstagramContainer(containerId, accessToken);

  return fetchJson(`https://graph.facebook.com/${META_API_VERSION}/${igId}/media_publish`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });
}

async function publishToGoogle(account: SocialAccountRow, post: SocialPostRow, asset: SocialAssetRow | null, publicBaseUrl: string) {
  const locationPath = String(account.external_id || "").trim();
  const accessToken = String(account.access_token || "").trim();
  if (!locationPath || !accessToken) {
    throw new Error("Google Business Profile is not configured with a location path and access token.");
  }
  if (asset && asset.asset_kind !== "image") {
    throw new Error("Google Business Profile local posts currently support image assets only in this scheduler.");
  }

  const assetUrl = assetPublicUrl(publicBaseUrl, asset);
  const topicType = String(post.google_topic_type || "STANDARD").trim().toUpperCase();
  const summary = String(post.caption || post.title || "").trim();
  if (!summary) throw new Error("Google Business Profile posts require caption or title text.");

  const body: Record<string, any> = {
    languageCode: "en-US",
    summary,
    topicType,
  };

  if (post.link_url) {
    body.callToAction = {
      actionType: normalizeGoogleActionType(post.cta_label),
      url: post.link_url,
    };
  }
  if (assetUrl) {
    body.media = [
      {
        mediaFormat: "PHOTO",
        sourceUrl: assetUrl,
      },
    ];
  }
  if ((topicType === "EVENT" || topicType === "OFFER") && post.google_event_start && post.google_event_end) {
    body.event = {
      title: post.google_event_title || post.title || "WOLF FD Event",
      schedule: {
        startDate: post.google_event_start,
        endDate: post.google_event_end,
      },
    };
  }

  return fetchJson(`${GOOGLE_API_BASE}/${locationPath}/localPosts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

async function publishForPlatform(
  platform: SocialPlatform,
  account: SocialAccountRow,
  post: SocialPostRow,
  asset: SocialAssetRow | null,
  publicBaseUrl: string
): Promise<PublishResult> {
  let response: any;
  if (platform === "facebook") {
    response = await publishToFacebook(account, post, asset, publicBaseUrl);
  } else if (platform === "instagram") {
    response = await publishToInstagram(account, post, asset, publicBaseUrl);
  } else {
    response = await publishToGoogle(account, post, asset, publicBaseUrl);
  }
  return {
    providerPostId: response?.id || response?.name || null,
    response,
  };
}

export function createSocialPublisher({ pool, publicBaseUrl }: CreatePublisherDeps) {
  async function runJob(jobId: number) {
    const jobResult = await pool.query(
      `
        SELECT
          j.id,
          j.post_id,
          j.platform,
          j.account_id,
          j.status,
          j.scheduled_for,
          j.attempt_count,
          j.provider_post_id,
          j.provider_response,
          j.last_error
        FROM social_publish_jobs j
        WHERE j.id = $1
        LIMIT 1
      `,
      [jobId]
    );
    if (!jobResult.rows.length) throw new Error("Social publish job not found.");
    const job = jobResult.rows[0] as SocialJobRow;

    const postResult = await pool.query(
      `
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
          p.last_error
        FROM social_posts p
        WHERE p.id = $1
        LIMIT 1
      `,
      [job.post_id]
    );
    if (!postResult.rows.length) throw new Error("Social post not found for publish job.");
    const post = postResult.rows[0] as SocialPostRow;

    const accountResult = await pool.query(
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
          config_json
        FROM social_accounts
        WHERE
          platform = $1
          AND active = TRUE
          AND ($2::bigint IS NULL OR id = $2::bigint)
        ORDER BY id ASC
        LIMIT 1
      `,
      [job.platform, job.account_id]
    );
    if (!accountResult.rows.length) {
      throw new Error(`No active ${job.platform} social account is configured.`);
    }
    const account = accountResult.rows[0] as SocialAccountRow;

    let asset: SocialAssetRow | null = null;
    if (post.asset_id) {
      const assetResult = await pool.query(
        `
          SELECT id, storage_name, original_name, mime_type, file_size_bytes, asset_kind
          FROM social_assets
          WHERE id = $1
          LIMIT 1
        `,
        [post.asset_id]
      );
      asset = assetResult.rows.length ? (assetResult.rows[0] as SocialAssetRow) : null;
    }

    await logJob(pool, job.id, "info", `Publishing ${job.platform} post`, {
      postId: post.id,
      assetId: post.asset_id,
    });

    try {
      const result = await publishForPlatform(job.platform, account, post, asset, publicBaseUrl);
      await pool.query(
        `
          UPDATE social_publish_jobs
          SET
            status = 'published',
            provider_post_id = $2,
            provider_response = $3::jsonb,
            last_error = '',
            finished_at = now(),
            updated_at = now()
          WHERE id = $1
        `,
        [job.id, result.providerPostId || null, JSON.stringify(result.response || {})]
      );
      await logJob(pool, job.id, "info", `${job.platform} publish succeeded`, {
        providerPostId: result.providerPostId || null,
      });

      const pending = await pool.query(
        `
          SELECT COUNT(*)::int AS n
          FROM social_publish_jobs
          WHERE post_id = $1 AND status IN ('scheduled', 'publishing')
        `,
        [post.id]
      );
      const hasPending = Number(pending.rows[0]?.n || 0) > 0;
      await pool.query(
        `
          UPDATE social_posts
          SET
            status = $2,
            published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
            last_error = '',
            updated_at = now()
          WHERE id = $1
        `,
        [post.id, hasPending ? "scheduled" : "published"]
      );
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error || "Unknown social publish failure");
      await pool.query(
        `
          UPDATE social_publish_jobs
          SET
            status = 'failed',
            last_error = $2,
            finished_at = now(),
            updated_at = now()
          WHERE id = $1
        `,
        [job.id, message]
      );
      await pool.query(
        `
          UPDATE social_posts
          SET status = 'failed', last_error = $2, updated_at = now()
          WHERE id = $1
        `,
        [post.id, message]
      );
      await logJob(pool, job.id, "error", message);
      throw error;
    }
  }

  async function claimOneDueJob(): Promise<number | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const claim = await client.query(
        `
          SELECT id
          FROM social_publish_jobs
          WHERE status = 'scheduled' AND scheduled_for <= now()
          ORDER BY scheduled_for ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `
      );
      if (!claim.rows.length) {
        await client.query("ROLLBACK");
        return null;
      }
      const jobId = Number(claim.rows[0].id);
      await client.query(
        `
          UPDATE social_publish_jobs
          SET
            status = 'publishing',
            attempt_count = COALESCE(attempt_count, 0) + 1,
            started_at = now(),
            updated_at = now()
          WHERE id = $1
        `,
        [jobId]
      );
      await client.query("COMMIT");
      return jobId;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async function runDueJobsOnce(maxJobs = 5) {
    let processed = 0;
    for (let i = 0; i < maxJobs; i += 1) {
      const jobId = await claimOneDueJob();
      if (!jobId) break;
      processed += 1;
      try {
        await runJob(jobId);
      } catch (error) {
        console.error("Social publish job failed:", error);
      }
    }
    return processed;
  }

  return {
    runJob,
    runDueJobsOnce,
  };
}
