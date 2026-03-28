import type { Express } from "express";
import type { Pool } from "pg";

type RegisterTrackingRoutesDeps = {
  app: Express;
  pool: Pool;
};

type TrackingMetaValue = string | number | boolean | null;

const MAX_SITE_LENGTH = 120;
const MAX_PATH_LENGTH = 260;
const MAX_URL_LENGTH = 600;
const MAX_LABEL_LENGTH = 180;
const MAX_TEXT_LENGTH = 240;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_META_KEYS = 20;

function normalizeText(raw: any, maxLength: number) {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();
  return value ? value.slice(0, maxLength) : "";
}

function normalizePath(raw: any) {
  const value = normalizeText(raw, MAX_PATH_LENGTH);
  if (!value) return "/";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      return new URL(value).pathname || "/";
    } catch {
      return "/";
    }
  }
  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeEventType(raw: any) {
  const value = normalizeText(raw, 40).toLowerCase();
  return value || "pageview";
}

function normalizeMeta(raw: any): Record<string, TrackingMetaValue> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: Record<string, TrackingMetaValue> = {};
  for (const [key, value] of Object.entries(raw).slice(0, MAX_META_KEYS)) {
    const safeKey = normalizeText(key, 60);
    if (!safeKey) continue;
    if (value == null) {
      output[safeKey] = null;
      continue;
    }
    if (typeof value === "string") {
      output[safeKey] = normalizeText(value, 240);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      output[safeKey] = value;
      continue;
    }
    output[safeKey] = normalizeText(JSON.stringify(value), 240);
  }
  return output;
}

function clampDays(raw: any) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(365, Math.round(parsed)));
}

export function registerTrackingRoutes({ app, pool }: RegisterTrackingRoutesDeps) {
  const registerEventRoute = (routePath: string) =>
    app.post(routePath, async (req, res) => {
      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const site = normalizeText(body.site, MAX_SITE_LENGTH);
        const pagePath = normalizePath(body.pagePath ?? body.path ?? body.pageUrl);
        const pageUrl = normalizeText(body.pageUrl ?? body.url, MAX_URL_LENGTH);
        const pageTitle = normalizeText(body.pageTitle ?? body.title, MAX_LABEL_LENGTH);
        const eventType = normalizeEventType(body.eventType ?? body.type);
        const eventName = normalizeText(body.eventName ?? body.name, MAX_LABEL_LENGTH);
        const elementText = normalizeText(body.elementText ?? body.label, MAX_TEXT_LENGTH);
        const linkUrl = normalizeText(body.linkUrl ?? body.href, MAX_URL_LENGTH);
        const referrer = normalizeText(body.referrer, MAX_URL_LENGTH);
        const visitorId = normalizeText(body.visitorId, 120);
        const sessionId = normalizeText(body.sessionId, 120);
        const metaJson = normalizeMeta(body.meta);
        const userAgent = normalizeText(req.get("user-agent"), MAX_USER_AGENT_LENGTH);
        const ipAddress = normalizeText(req.ip, 80);

        if (!site) {
          res.status(400).json({ ok: false, error: "site is required" });
          return;
        }

        await pool.query(
          `
            INSERT INTO web_page_events (
              site,
              page_path,
              page_url,
              page_title,
              event_type,
              event_name,
              element_text,
              link_url,
              referrer,
              visitor_id,
              session_id,
              ip_address,
              user_agent,
              meta_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
          `,
          [
            site,
            pagePath,
            pageUrl,
            pageTitle,
            eventType,
            eventName,
            elementText,
            linkUrl,
            referrer,
            visitorId,
            sessionId,
            ipAddress,
            userAgent,
            JSON.stringify(metaJson),
          ]
        );

        res.status(201).json({ ok: true });
      } catch (error) {
        console.error("tracking event insert failed", error);
        res.status(500).json({ ok: false, error: "tracking_insert_failed" });
      }
    });

  const registerSummaryRoute = (routePath: string) =>
    app.get(routePath, async (req, res) => {
      try {
        const site = normalizeText(req.query.site, MAX_SITE_LENGTH);
        const pagePath = normalizeText(req.query.pagePath, MAX_PATH_LENGTH);
        const days = clampDays(req.query.days);

        if (!site) {
          res.status(400).json({ ok: false, error: "site is required" });
          return;
        }

        const filterSql = `
          FROM web_page_events
          WHERE site = $1
            AND created_at >= now() - make_interval(days => $2::int)
            AND ($3::text = '' OR page_path = $3)
        `;
        const params = [site, days, pagePath];

        const totalsResult = await pool.query(
          `
            SELECT
              COUNT(*)::int AS events,
              COUNT(*) FILTER (WHERE event_type = 'pageview')::int AS pageviews,
              COUNT(*) FILTER (WHERE event_type <> 'pageview')::int AS interactions,
              COUNT(DISTINCT NULLIF(visitor_id, ''))::int AS unique_visitors,
              COUNT(DISTINCT NULLIF(session_id, ''))::int AS unique_sessions
            ${filterSql}
          `,
          params
        );

        const topPagesResult = await pool.query(
          `
            SELECT
              page_path,
              COALESCE(MAX(NULLIF(page_title, '')), '') AS page_title,
              COUNT(*) FILTER (WHERE event_type = 'pageview')::int AS pageviews,
              COUNT(DISTINCT NULLIF(visitor_id, ''))::int AS unique_visitors,
              COUNT(DISTINCT NULLIF(session_id, ''))::int AS unique_sessions
            ${filterSql}
            GROUP BY page_path
            ORDER BY pageviews DESC, page_path ASC
            LIMIT 20
          `,
          params
        );

        const topClicksResult = await pool.query(
          `
            SELECT
              page_path,
              COALESCE(NULLIF(event_name, ''), NULLIF(element_text, ''), NULLIF(link_url, ''), 'interaction') AS event_name,
              COALESCE(NULLIF(element_text, ''), NULLIF(event_name, ''), '') AS element_text,
              COALESCE(NULLIF(link_url, ''), '') AS link_url,
              COUNT(*)::int AS clicks
            ${filterSql}
            AND event_type <> 'pageview'
            GROUP BY page_path, 2, 3, 4
            ORDER BY clicks DESC, page_path ASC
            LIMIT 25
          `,
          params
        );

        const dailyResult = await pool.query(
          `
            SELECT
              to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(*) FILTER (WHERE event_type = 'pageview')::int AS pageviews,
              COUNT(*) FILTER (WHERE event_type <> 'pageview')::int AS interactions,
              COUNT(DISTINCT NULLIF(visitor_id, ''))::int AS unique_visitors
            ${filterSql}
            GROUP BY 1
            ORDER BY 1 ASC
          `,
          params
        );

        res.json({
          ok: true,
          site,
          days,
          pagePath: pagePath || null,
          totals: totalsResult.rows[0] || {
            events: 0,
            pageviews: 0,
            interactions: 0,
            unique_visitors: 0,
            unique_sessions: 0,
          },
          topPages: topPagesResult.rows.map((row) => ({
            pagePath: String(row.page_path || "/"),
            pageTitle: String(row.page_title || ""),
            pageviews: Number(row.pageviews || 0),
            uniqueVisitors: Number(row.unique_visitors || 0),
            uniqueSessions: Number(row.unique_sessions || 0),
          })),
          topClicks: topClicksResult.rows.map((row) => ({
            pagePath: String(row.page_path || "/"),
            eventName: String(row.event_name || ""),
            elementText: String(row.element_text || ""),
            linkUrl: String(row.link_url || ""),
            clicks: Number(row.clicks || 0),
          })),
          daily: dailyResult.rows.map((row) => ({
            day: String(row.day || ""),
            pageviews: Number(row.pageviews || 0),
            interactions: Number(row.interactions || 0),
            uniqueVisitors: Number(row.unique_visitors || 0),
          })),
        });
      } catch (error) {
        console.error("tracking summary query failed", error);
        res.status(500).json({ ok: false, error: "tracking_summary_failed" });
      }
    });

  registerEventRoute("/public/tracking/event");
  registerEventRoute("/api/public/tracking/event");
  registerSummaryRoute("/public/tracking/summary");
  registerSummaryRoute("/api/public/tracking/summary");
}
