import type { Express } from "express";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import path from "path";
import fs from "fs";

const GA4_PROPERTY_ID = "257030674";
const GA4_KEY_PATH = path.resolve("/home/alphahs/secrets/ga4-fd-key.json");
const GA4_TOKEN_PATH = path.resolve("/home/alphahs/secrets/ga4-oauth-token.json");
const GA4_BASE = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}`;

const CLIENT_ID = process.env.GA4_OAUTH_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GA4_OAUTH_CLIENT_SECRET || "";
const REDIRECT_URI = "https://furnituredistributors.wolf.discount/fd/api/api/ga4-oauth-callback";

const CACHE_TTL = 5 * 60 * 1000;
const statsCache = new Map<string, { ts: number; data: any }>();

type DateRange = { startDate: string; endDate: string };

function getOAuthClient(): OAuth2Client {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

async function getBearerToken(): Promise<string> {
  if (fs.existsSync(GA4_TOKEN_PATH)) {
    const stored = JSON.parse(fs.readFileSync(GA4_TOKEN_PATH, "utf8"));
    const client = getOAuthClient();
    client.setCredentials(stored);
    const resp = await client.getAccessToken();
    if (resp.token) return resp.token;
  }

  const auth = new GoogleAuth({
    keyFile: GA4_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const c = await auth.getClient();
  const t = await c.getAccessToken();
  return t.token || "";
}

async function runReport(token: string, body: object) {
  const res = await fetch(`${GA4_BASE}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GA4 ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function parseIntMetric(row: any, index: number): number {
  return parseInt(row?.metricValues?.[index]?.value || "0", 10) || 0;
}

function parseFloatMetric(row: any, index: number): number {
  return parseFloat(row?.metricValues?.[index]?.value || "0") || 0;
}

function isYmd(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function defaultRange(): DateRange {
  const today = new Date();
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return { startDate: isoDate(addDays(end, -29)), endDate: isoDate(end) };
}

function queryRange(req: any, prefix = ""): DateRange | null {
  const start = req.query[`${prefix}start`];
  const end = req.query[`${prefix}end`];
  if (!start && !end && !prefix) return defaultRange();
  if (!isYmd(start) || !isYmd(end)) return null;
  if (start > end) return null;
  return { startDate: start, endDate: end };
}

function pct(value: number): number {
  return Number((value * 100).toFixed(1));
}

async function fetchRangeStats(token: string, range: DateRange) {
  const dateRanges = [range];
  const [summaryRaw, pagesRaw, channelsRaw, devicesRaw, citiesRaw, referrersRaw, dailyRaw] = await Promise.all([
    runReport(token, {
      dateRanges,
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "screenPageViews" },
        { name: "engagedSessions" },
        { name: "engagementRate" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "eventCount" },
      ],
    }),
    runReport(token, {
      dateRanges,
      dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "averageSessionDuration" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
    runReport(token, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagementRate" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 8,
    }),
    runReport(token, {
      dateRanges,
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagementRate" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 8,
    }),
    runReport(token, {
      dateRanges,
      dimensions: [{ name: "city" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 8,
    }),
    runReport(token, {
      dateRanges,
      dimensions: [{ name: "sessionSourceMedium" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 8,
    }),
    runReport(token, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
      limit: 366,
    }),
  ]);

  const sumRow = summaryRaw?.rows?.[0] || {};
  const sessions = parseIntMetric(sumRow, 0);
  const pageViews = parseIntMetric(sumRow, 3);
  const summary = {
    sessions,
    users: parseIntMetric(sumRow, 1),
    newUsers: parseIntMetric(sumRow, 2),
    pageViews,
    engagedSessions: parseIntMetric(sumRow, 4),
    engagementRate: pct(parseFloatMetric(sumRow, 5)),
    bounceRate: pct(parseFloatMetric(sumRow, 6)),
    avgSessionDuration: Math.round(parseFloatMetric(sumRow, 7)),
    eventCount: parseIntMetric(sumRow, 8),
    pagesPerSession: Number((sessions ? pageViews / sessions : 0).toFixed(2)),
  };

  const topPages = (pagesRaw?.rows || []).map((r: any) => ({
    title: r.dimensionValues?.[0]?.value || "Unknown",
    path: r.dimensionValues?.[1]?.value || "/",
    views: parseIntMetric(r, 0),
    users: parseIntMetric(r, 1),
    avgSessionDuration: Math.round(parseFloatMetric(r, 2)),
  }));
  const channels = (channelsRaw?.rows || []).map((r: any) => ({
    channel: r.dimensionValues?.[0]?.value || "Other",
    sessions: parseIntMetric(r, 0),
    users: parseIntMetric(r, 1),
    engagementRate: pct(parseFloatMetric(r, 2)),
  }));
  const devices = (devicesRaw?.rows || []).map((r: any) => ({
    device: r.dimensionValues?.[0]?.value || "unknown",
    sessions: parseIntMetric(r, 0),
    users: parseIntMetric(r, 1),
    engagementRate: pct(parseFloatMetric(r, 2)),
  }));
  const cities = (citiesRaw?.rows || []).map((r: any) => ({
    city: r.dimensionValues?.[0]?.value || "Unknown",
    users: parseIntMetric(r, 0),
    sessions: parseIntMetric(r, 1),
  }));
  const referrers = (referrersRaw?.rows || []).map((r: any) => ({
    source: r.dimensionValues?.[0]?.value || "Unknown",
    sessions: parseIntMetric(r, 0),
    users: parseIntMetric(r, 1),
  }));
  const daily = (dailyRaw?.rows || []).map((r: any) => ({
    date: r.dimensionValues?.[0]?.value || "",
    sessions: parseIntMetric(r, 0),
    users: parseIntMetric(r, 1),
    pageViews: parseIntMetric(r, 2),
  }));

  return { range, summary, topPages, channels, devices, cities, referrers, daily };
}

async function fetchGA4Stats(currentRange: DateRange, compareRange: DateRange | null) {
  const token = await getBearerToken();
  const current = await fetchRangeStats(token, currentRange);
  const compare = compareRange ? await fetchRangeStats(token, compareRange) : null;
  return { current, compare, fetchedAt: Date.now() };
}

export function registerGa4Routes(app: Express) {
  app.get("/api/ga4-oauth", (_req, res) => {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    res.redirect(url);
  });

  app.get("/api/ga4-oauth-callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing code");
    try {
      const client = getOAuthClient();
      const { tokens } = await client.getToken(code);
      fs.writeFileSync(GA4_TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
      statsCache.clear();
      res.send(`
        <html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2 style="color:#16a34a">GA4 Access Granted</h2>
          <p>Google Analytics is now connected to the FD dashboard.</p>
          <p>You can close this tab and refresh the dashboard.</p>
        </body></html>
      `);
    } catch (e: any) {
      res.status(500).send("OAuth error: " + e.message);
    }
  });

  app.get("/api/ga4-website-stats", async (req, res) => {
    try {
      const currentRange = queryRange(req);
      const compareRange = queryRange(req, "compare");
      if (!currentRange) {
        return res.status(400).json({ ok: false, error: "Invalid date range" });
      }
      if ((req.query.compareStart || req.query.compareEnd) && !compareRange) {
        return res.status(400).json({ ok: false, error: "Invalid compare date range" });
      }

      const cacheKey = JSON.stringify({ currentRange, compareRange });
      const cached = statsCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return res.json({ ok: true, cached: true, ...cached.data });
      }

      const data = await fetchGA4Stats(currentRange, compareRange);
      statsCache.set(cacheKey, { ts: Date.now(), data });
      return res.json({ ok: true, cached: false, ...data });
    } catch (err: any) {
      console.error("[GA4]", err?.message || err);
      return res.status(502).json({ ok: false, error: err?.message || "GA4 fetch failed" });
    }
  });
}
