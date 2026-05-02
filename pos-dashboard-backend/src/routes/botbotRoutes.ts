import type { Express } from "express";
import type { Pool } from "pg";
import {
  callBotBotLocalAi,
  callClaude,
  callOllama,
  callOpenAI,
  type LLMMessage,
} from "../llmClient";
import {
  BOTBOT_SKILL_CATALOG,
  inferBotBotSkill,
  isLocalProvider,
  resolveModelAccess,
  resolveSkillAccess,
  type BotBotAuthUser,
  type BotBotSubjectType,
} from "../botbotAccess";
import { buildSystemPrompt, type PageContext } from "../botbotPrompt";
import { parseDateParam, parseTextParam } from "../parsers";
import { buildPro1stExcludedSql, buildQualifiedPro1stSql } from "../pro1stSql";
import {
  BOTBOT_LOCAL_AI_URL,
  BOTBOT_ENABLED,
  BOTBOT_LEDGER_TOKEN,
  OLLAMA_BASE_URL,
  OLLAMA_PRIMARY_MODEL,
  OLLAMA_PRIMARY_NODE_LABEL,
} from "../runtimeConfig";

type BotBotRoutesDeps = {
  app: Express;
  pool: Pool;
  requireOwner: (req: any, res: any, next: any) => void;
};

const HISTORY_LIMIT = 20;
const MAX_RESPONSE_MESSAGES = 200;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_MESSAGES = 10;

const rateLimitMap = new Map<number, number[]>();

const RANGE_CONFIG: Record<string, { interval: string; bucketSeconds: number }> = {
  "15m": { interval: "15 minutes", bucketSeconds: 60 },
  "1h": { interval: "1 hour", bucketSeconds: 60 },
  "24h": { interval: "24 hours", bucketSeconds: 3600 },
  "7d": { interval: "7 days", bucketSeconds: 86400 },
};

type SalesSnapshot = {
  page: string;
  range: { start: string; end: string; label: string };
  filters: { location: string | null; salesperson: string | null };
  summary: { ticketCount: number; sales: number; profit: number; marginPct: number | null };
  pro1st: {
    totalSales: number;
    proSales: number;
    attachRate: number;
    ticketCount: number;
    lowProfitTicketCount: number;
    midProfitTicketCount: number;
    highProfitTicketCount: number;
  };
  lowMargin: {
    count: number;
    topTickets: Array<{
      saleId: string;
      salesperson: string;
      location: string;
      grandTotal: number;
      profit: number;
      marginPct: number | null;
    }>;
  };
  leaderboard: Array<{ salesperson: string; sales: number; profit: number; ticketCount: number }>;
  warnings: string[];
  insightCandidates: string[];
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0
  );

const pct = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "unknown" : `${value.toFixed(1)}%`;

const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const arrayLength = (value: unknown) => (Array.isArray(value) ? value.length : 0);

const isSalesContext = (ctx: PageContext) =>
  ctx.pageId === "sales-dashboard" || ctx.subPageId === "pulse-sales" || ctx.module === "sales";

const getContextFilter = (ctx: PageContext, key: string) => {
  const value = ctx.filters?.[key];
  return value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim();
};

const salesContextParams = (ctx: PageContext) => {
  const start = ctx.dateRange?.start;
  const end = ctx.dateRange?.end;
  if (!start || !end) return null;
  return {
    start,
    end,
    label: ctx.dateRange?.label || `${start} to ${end}`,
    location: getContextFilter(ctx, "location"),
    salesperson: getContextFilter(ctx, "salesperson"),
  };
};

async function buildSalesSnapshot(
  pool: Pool,
  params: { start: string; end: string; label: string; location: string | null; salesperson: string | null }
): Promise<SalesSnapshot> {
  const pro1stItemSql = buildQualifiedPro1stSql("i.");
  const excludedPro1stSql = buildPro1stExcludedSql("i.");
  const queryParams = [params.start, params.end, params.location, params.salesperson];

  const summarySql = `
    WITH item_rollup AS (
      SELECT
        i.sale_id,
        SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END)::numeric AS item_sales,
        SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END)::numeric AS item_profit
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE s.delivery_confirmed_date >= $1
        AND s.delivery_confirmed_date < $2
      GROUP BY i.sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*)::int AS cnt
      FROM pos_sales_people
      GROUP BY sale_id
    )
    SELECT
      COUNT(DISTINCT p.sale_id)::int AS ticket_count,
      COALESCE(SUM(COALESCE(item_rollup.item_sales, 0) / NULLIF(people_counts.cnt, 0)), 0)::numeric AS sales,
      COALESCE(SUM(COALESCE(item_rollup.item_profit, 0) / NULLIF(people_counts.cnt, 0)), 0)::numeric AS profit
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    LEFT JOIN item_rollup ON item_rollup.sale_id = p.sale_id
    LEFT JOIN people_counts ON people_counts.sale_id = p.sale_id
    WHERE s.delivery_confirmed_date >= $1
      AND s.delivery_confirmed_date < $2
      AND ($3::text IS NULL OR COALESCE(p.location, s.location) ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'))
      AND p.sale_id IS NOT NULL
      AND p.sale_id <> '';
  `;

  const lowMarginSql = `
    WITH item_totals AS (
      SELECT
        sale_id,
        SUM(CASE WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0 ELSE total_sale_price END)::numeric AS item_sales,
        SUM(CASE WHEN total_profit IS NULL OR total_profit <> total_profit THEN 0 ELSE total_profit END)::numeric AS item_profit
      FROM pos_sale_items
      WHERE sale_id IS NOT NULL
        AND sale_id <> ''
        AND (category IS NULL OR category NOT ILIKE '%mattress%')
      GROUP BY sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*)::int AS people_count
      FROM pos_sales_people
      GROUP BY sale_id
    ),
    sale_rows AS (
      SELECT
        p.sale_id,
        p.salesperson,
        COALESCE(p.location, s.location) AS location,
        p.grand_total_split::numeric AS grand_total,
        (COALESCE(item_totals.item_profit, 0) / NULLIF(people_counts.people_count, 0))::numeric AS profit,
        CASE
          WHEN item_totals.item_sales IS NULL OR item_totals.item_sales = 0 THEN NULL
          ELSE (COALESCE(item_totals.item_profit, 0) / item_totals.item_sales) * 100
        END::numeric AS margin_pct
      FROM pos_sales_people p
      JOIN pos_sales s ON s.sale_id = p.sale_id
      LEFT JOIN item_totals ON item_totals.sale_id = p.sale_id
      LEFT JOIN people_counts ON people_counts.sale_id = p.sale_id
      WHERE s.delivery_confirmed_date >= $1
        AND s.delivery_confirmed_date < $2
        AND ($3::text IS NULL OR COALESCE(p.location, s.location) ILIKE ('%' || $3 || '%'))
        AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'))
        AND p.salesperson IS NOT NULL
        AND p.salesperson <> ''
        AND p.salesperson <> 'Sales, Store'
    )
    SELECT *, COUNT(*) OVER ()::int AS total_count
    FROM sale_rows
    WHERE margin_pct BETWEEN -100 AND 100
    ORDER BY margin_pct ASC NULLS LAST, profit ASC, grand_total DESC
    LIMIT 5;
  `;

  const leaderboardSql = `
    WITH item_rollup AS (
      SELECT
        i.sale_id,
        SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END)::numeric AS item_sales,
        SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END)::numeric AS item_profit
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE s.delivery_confirmed_date >= $1
        AND s.delivery_confirmed_date < $2
      GROUP BY i.sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*)::int AS cnt
      FROM pos_sales_people
      GROUP BY sale_id
    )
    SELECT
      p.salesperson,
      COUNT(DISTINCT p.sale_id)::int AS ticket_count,
      COALESCE(SUM(COALESCE(item_rollup.item_sales, 0) / NULLIF(people_counts.cnt, 0)), 0)::numeric AS sales,
      COALESCE(SUM(COALESCE(item_rollup.item_profit, 0) / NULLIF(people_counts.cnt, 0)), 0)::numeric AS profit
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    LEFT JOIN item_rollup ON item_rollup.sale_id = p.sale_id
    LEFT JOIN people_counts ON people_counts.sale_id = p.sale_id
    WHERE s.delivery_confirmed_date >= $1
      AND s.delivery_confirmed_date < $2
      AND ($3::text IS NULL OR COALESCE(p.location, s.location) ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'))
      AND p.salesperson IS NOT NULL
      AND p.salesperson <> ''
      AND p.salesperson <> 'Sales, Store'
    GROUP BY p.salesperson
    ORDER BY sales DESC
    LIMIT 5;
  `;

  const pro1stSql = `
    WITH non_mattress_items AS (
      SELECT
        i.sale_id,
        SUM(COALESCE(i.total_sale_price, 0))::numeric AS eligible_sales
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE s.delivery_confirmed_date >= $1
        AND s.delivery_confirmed_date < $2
        AND NOT (${excludedPro1stSql})
      GROUP BY i.sale_id
    ),
    pro_items AS (
      SELECT
        i.sale_id,
        SUM(COALESCE(i.total_sale_price, 0))::numeric AS pro_sales,
        SUM(COALESCE(i.total_profit, 0))::numeric AS pro_profit
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE s.delivery_confirmed_date >= $1
        AND s.delivery_confirmed_date < $2
        AND ${pro1stItemSql}
      GROUP BY i.sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*)::int AS cnt
      FROM pos_sales_people
      GROUP BY sale_id
    )
    SELECT
      COALESCE(SUM(COALESCE(non_mattress_items.eligible_sales, 0) / NULLIF(people_counts.cnt, 0)), 0)::numeric AS total_sales,
      COALESCE(SUM(COALESCE(pro_items.pro_sales, 0) / NULLIF(people_counts.cnt, 0)), 0)::numeric AS pro_sales,
      COUNT(DISTINCT p.sale_id) FILTER (WHERE pro_items.sale_id IS NOT NULL)::int AS ticket_count,
      ARRAY_AGG(DISTINCT p.sale_id) FILTER (WHERE pro_items.pro_profit < 100) AS low_ids,
      ARRAY_AGG(DISTINCT p.sale_id) FILTER (WHERE pro_items.pro_profit >= 100 AND pro_items.pro_profit < 200) AS mid_ids,
      ARRAY_AGG(DISTINCT p.sale_id) FILTER (WHERE pro_items.pro_profit >= 200) AS high_ids
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    LEFT JOIN non_mattress_items ON non_mattress_items.sale_id = p.sale_id
    LEFT JOIN pro_items ON pro_items.sale_id = p.sale_id
    LEFT JOIN people_counts ON people_counts.sale_id = p.sale_id
    WHERE s.delivery_confirmed_date >= $1
      AND s.delivery_confirmed_date < $2
      AND ($3::text IS NULL OR COALESCE(p.location, s.location) ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'))
      AND p.sale_id IS NOT NULL
      AND p.sale_id <> '';
  `;

  const [summaryResult, lowMarginResult, leaderboardResult, pro1stResult] = await Promise.all([
    pool.query(summarySql, queryParams),
    pool.query(lowMarginSql, queryParams),
    pool.query(leaderboardSql, queryParams),
    pool.query(pro1stSql, queryParams),
  ]);

  const summaryRow = summaryResult.rows[0] ?? {};
  const proRow = pro1stResult.rows[0] ?? {};
  const sales = asNumber(summaryRow.sales);
  const profit = asNumber(summaryRow.profit);
  const marginPct = sales > 0 ? (profit / sales) * 100 : null;
  const proTotalSales = asNumber(proRow.total_sales);
  const proSales = asNumber(proRow.pro_sales);
  const attachRate = proTotalSales > 0 ? (proSales / proTotalSales) * 100 : 0;
  const lowProfitTicketCount = arrayLength(proRow.low_ids);
  const midProfitTicketCount = arrayLength(proRow.mid_ids);
  const highProfitTicketCount = arrayLength(proRow.high_ids);
  const lowMarginCount = lowMarginResult.rows.length
    ? Number(lowMarginResult.rows[0]?.total_count ?? lowMarginResult.rows.length)
    : 0;

  const warnings = [
    Number(summaryRow.ticket_count ?? 0) === 0 || sales === 0
      ? "Sales report data is empty for this range/filter."
      : "",
    Number(summaryRow.ticket_count ?? 0) > 0 && proTotalSales === 0
      ? "Item report data appears missing or incomplete, so Pro1st/item insights may be unreliable."
      : "",
  ].filter(Boolean);

  const insightCandidates = [
    marginPct !== null && marginPct < 40
      ? `Overall margin is ${pct(marginPct)}, below the 40% coaching threshold.`
      : "",
    lowMarginCount > 0
      ? `${lowMarginCount} low-margin ticket${lowMarginCount === 1 ? "" : "s"} should be reviewed.`
      : "",
    proTotalSales > 0 && attachRate < 8
      ? `Pro1st attach rate is ${pct(attachRate)}, which is below the 8% watch threshold.`
      : "",
    proTotalSales > 0 && attachRate >= 12
      ? `Pro1st attach rate is ${pct(attachRate)}, which looks healthy for this range.`
      : "",
    lowProfitTicketCount > 0
      ? `${lowProfitTicketCount} Pro1st ticket${lowProfitTicketCount === 1 ? "" : "s"} are below $100 estimated Pro1st profit.`
      : "",
    warnings.length ? "Call out data completeness before making firm recommendations." : "",
  ].filter(Boolean);

  return {
    page: "Sales Dashboard",
    range: { start: params.start, end: params.end, label: params.label },
    filters: { location: params.location, salesperson: params.salesperson },
    summary: {
      ticketCount: Number(summaryRow.ticket_count ?? 0),
      sales,
      profit,
      marginPct,
    },
    pro1st: {
      totalSales: proTotalSales,
      proSales,
      attachRate,
      ticketCount: Number(proRow.ticket_count ?? 0),
      lowProfitTicketCount,
      midProfitTicketCount,
      highProfitTicketCount,
    },
    lowMargin: {
      count: lowMarginCount,
      topTickets: lowMarginResult.rows.map((row: any) => ({
        saleId: String(row.sale_id ?? ""),
        salesperson: String(row.salesperson ?? ""),
        location: String(row.location ?? ""),
        grandTotal: asNumber(row.grand_total),
        profit: asNumber(row.profit),
        marginPct: row.margin_pct === null || row.margin_pct === undefined ? null : asNumber(row.margin_pct),
      })),
    },
    leaderboard: leaderboardResult.rows.map((row: any) => ({
      salesperson: String(row.salesperson ?? ""),
      sales: asNumber(row.sales),
      profit: asNumber(row.profit),
      ticketCount: Number(row.ticket_count ?? 0),
    })),
    warnings,
    insightCandidates,
  };
}

function formatSalesSnapshotForPrompt(snapshot: SalesSnapshot): string {
  const filterParts = [
    snapshot.filters.location ? `location=${snapshot.filters.location}` : "",
    snapshot.filters.salesperson ? `salesperson=${snapshot.filters.salesperson}` : "",
  ].filter(Boolean);
  const topLowMargin = snapshot.lowMargin.topTickets
    .slice(0, 3)
    .map((row) => `${row.saleId} (${row.salesperson}, ${pct(row.marginPct)}, ${money(row.profit)} profit)`)
    .join("; ");
  const leaders = snapshot.leaderboard
    .slice(0, 3)
    .map((row) => `${row.salesperson}: ${money(row.sales)} sales, ${money(row.profit)} profit`)
    .join("; ");

  return [
    `${snapshot.page} snapshot for ${snapshot.range.label} (${snapshot.range.start} to ${snapshot.range.end}, end exclusive).`,
    filterParts.length ? `Filters: ${filterParts.join(", ")}.` : "Filters: none.",
    `Summary: ${snapshot.summary.ticketCount} tickets, ${money(snapshot.summary.sales)} sales, ${money(snapshot.summary.profit)} profit, ${pct(snapshot.summary.marginPct)} margin.`,
    `Pro1st: ${pct(snapshot.pro1st.attachRate)} attach rate, ${money(snapshot.pro1st.proSales)} Pro1st sales out of ${money(snapshot.pro1st.totalSales)} eligible sales, ${snapshot.pro1st.ticketCount} attached tickets, tiers low/mid/high=${snapshot.pro1st.lowProfitTicketCount}/${snapshot.pro1st.midProfitTicketCount}/${snapshot.pro1st.highProfitTicketCount}.`,
    `Low margin: ${snapshot.lowMargin.count} flagged tickets${topLowMargin ? `; examples: ${topLowMargin}` : ""}.`,
    leaders ? `Leaderboard highlights: ${leaders}.` : "",
    snapshot.warnings.length ? `Warnings: ${snapshot.warnings.join(" ")}` : "",
    snapshot.insightCandidates.length ? `Pre-considered checks: ${snapshot.insightCandidates.join(" ")}` : "",
  ].filter(Boolean).join("\n");
}

async function fetchOllamaTags(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`ollama_tags_${response.status}`);
    }
    const json = (await response.json()) as {
      models?: Array<{ name?: string }>;
    };
    const models = Array.isArray(json.models)
      ? json.models
          .map((model) => String(model?.name ?? "").trim())
          .filter(Boolean)
      : [];
    return {
      reachable: true,
      models,
    };
  } catch (_error) {
    return {
      reachable: false,
      models: [] as string[],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];

  const recentTimestamps = timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (recentTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    return false;
  }

  recentTimestamps.push(now);
  rateLimitMap.set(userId, recentTimestamps);
  return true;
}

const toAuthUser = (user: { id: string; name: string; roles: string[] }): BotBotAuthUser => ({
  id: String(user.id),
  name: String(user.name || ""),
  roles: Array.isArray(user.roles) ? user.roles.map((role) => String(role)) : [],
});

const parseQuota = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : fallback;
};

const tokenLedgerKeyForProvider = (provider: string, modelKey: string) =>
  isLocalProvider(provider) ? "local" : modelKey;

const normalizeExternalUserKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 160);

const clipPromptText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

function buildPromptContextAddendum(promptContext: unknown) {
  const context = promptContext && typeof promptContext === "object" ? (promptContext as any) : {};
  const systemPrompt = clipPromptText(context.systemPrompt, 1600);
  const documentContext = clipPromptText(context.documentContext, 8000);
  const parts = [
    systemPrompt
      ? `Temporary conversation mode selected by the user:\n${systemPrompt}`
      : "",
    documentContext
      ? `User-provided document or note to consider for this request:\n${documentContext}`
      : "",
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : "";
}

async function loadObjectionHandlingPromptContext(pool: Pool) {
  try {
    const result = await pool.query(
      `SELECT label, rebuttals
       FROM custom_objections
       WHERE is_active = true
       ORDER BY sort_order ASC, id ASC
       LIMIT 12`
    );
    if (!result.rows.length) {
      return [
        "DEN objection library note:",
        "No active custom objections are currently saved in the DEN objection library. Use general furniture sales objection-handling best practices and ask the user for the exact objection if needed.",
      ].join("\n");
    }
    const rows = result.rows.map((row, index) => {
      const rebuttals = Array.isArray(row.rebuttals) ? row.rebuttals : [];
      const topRebuttals = rebuttals
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((item, rebuttalIndex) => `   ${rebuttalIndex + 1}. ${item}`)
        .join("\n");
      return `${index + 1}. ${String(row.label || "Objection").trim()}\n${topRebuttals || "   No rebuttals saved yet."}`;
    });
    return [
      "DEN objection library context:",
      "Use these saved objections/rebuttals as source material. Do not read them verbatim unless the user asks; adapt them naturally to the conversation.",
      ...rows,
    ].join("\n");
  } catch (error) {
    console.error("botbot_objection_context_error", error);
    return [
      "DEN objection library note:",
      "The saved objection library could not be loaded for this request. Coach from general best practices and ask the user for the exact customer objection.",
    ].join("\n");
  }
}

async function logBotBotUsageEvent(
  pool: Pool,
  event: {
    userId: number;
    conversationId?: number | null;
    messageId?: number | null;
    modelKey: string;
    provider: string;
    skillKey: string;
    taskKey?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    status: "success" | "error" | "denied";
    errorCode?: string | null;
    responseMs?: number;
  }
) {
  const inputTokens = Math.max(0, Math.round(Number(event.inputTokens ?? 0)));
  const outputTokens = Math.max(0, Math.round(Number(event.outputTokens ?? 0)));
  await pool.query(
    `INSERT INTO botbot_usage_events
       (user_id, conversation_id, message_id, model_key, provider, skill_key, task_key,
        input_tokens, output_tokens, total_tokens, estimated_cost_usd, status, error_code, response_ms, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())`,
    [
      event.userId,
      event.conversationId ?? null,
      event.messageId ?? null,
      event.modelKey,
      event.provider,
      event.skillKey,
      event.taskKey ?? "",
      inputTokens,
      outputTokens,
      inputTokens + outputTokens,
      Number(event.estimatedCostUsd ?? 0) || 0,
      event.status,
      event.errorCode ?? null,
      Math.max(0, Math.round(Number(event.responseMs ?? 0))),
    ]
  );
}

async function loadSubjectAccess(pool: Pool, subjectType: BotBotSubjectType, subjectKey: string) {
  const [modelRows, skillRows, modelsResult, skillsResult] = await Promise.all([
    pool.query(
      `SELECT model_key, allowed, token_quota
       FROM botbot_model_access
       WHERE subject_type = $1 AND subject_key = $2`,
      [subjectType, subjectKey]
    ),
    pool.query(
      `SELECT skill_key, allowed
       FROM botbot_skill_access
       WHERE subject_type = $1 AND subject_key = $2`,
      [subjectType, subjectKey]
    ),
    pool.query(
      `SELECT model_key, display_name, provider, free_token_quota, enabled, sort_order
       FROM botbot_model_config
       ORDER BY sort_order ASC`
    ),
    pool.query(
      `SELECT skill_key, label, description, default_allowed, admin_only
       FROM botbot_skill_catalog
       ORDER BY skill_key ASC`
    ),
  ]);

  const modelMap = new Map(modelRows.rows.map((row) => [String(row.model_key), row]));
  const skillMap = new Map(skillRows.rows.map((row) => [String(row.skill_key), row]));

  return {
    subject: { type: subjectType, key: subjectKey },
    models: modelsResult.rows.map((model) => {
      const override = modelMap.get(String(model.model_key));
      const quota = parseQuota(override?.token_quota, parseQuota(model.free_token_quota, 0));
      return {
        modelKey: String(model.model_key),
        displayName: String(model.display_name ?? model.model_key),
        provider: String(model.provider ?? ""),
        enabled: Boolean(model.enabled),
        sortOrder: Number(model.sort_order ?? 0),
        allowed: Boolean(override?.allowed ?? false),
        hasOverride: Boolean(override),
        tokenQuota: quota,
      };
    }),
    skills: skillsResult.rows.map((skill) => {
      const override = skillMap.get(String(skill.skill_key));
      return {
        skillKey: String(skill.skill_key),
        label: String(skill.label ?? skill.skill_key),
        description: String(skill.description ?? ""),
        defaultAllowed: Boolean(skill.default_allowed),
        adminOnly: Boolean(skill.admin_only),
        allowed: Boolean(override?.allowed ?? false),
        hasOverride: Boolean(override),
      };
    }),
  };
}

async function saveSubjectAccess(pool: Pool, subjectType: BotBotSubjectType, subjectKey: string, body: any) {
  const models = body?.models && typeof body.models === "object" ? body.models : {};
  const skills = body?.skills && typeof body.skills === "object" ? body.skills : {};

  for (const [modelKey, raw] of Object.entries(models)) {
    const patch = raw && typeof raw === "object" ? (raw as any) : {};
    await pool.query(
      `INSERT INTO botbot_model_access
         (subject_type, subject_key, model_key, allowed, token_quota, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (subject_type, subject_key, model_key)
       DO UPDATE SET allowed = EXCLUDED.allowed,
                     token_quota = EXCLUDED.token_quota,
                     updated_at = now()`,
      [
        subjectType,
        subjectKey,
        String(modelKey),
        Boolean(patch.allowed),
        Number.isFinite(Number(patch.tokenQuota)) && Number(patch.tokenQuota) >= 0
          ? Math.round(Number(patch.tokenQuota))
          : null,
      ]
    );
  }

  for (const [skillKey, allowed] of Object.entries(skills)) {
    await pool.query(
      `INSERT INTO botbot_skill_access
         (subject_type, subject_key, skill_key, allowed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (subject_type, subject_key, skill_key)
       DO UPDATE SET allowed = EXCLUDED.allowed,
                     updated_at = now()`,
      [subjectType, subjectKey, String(skillKey), Boolean(allowed)]
    );
  }
}

export function registerBotBotRoutes({
  app,
  pool,
  requireOwner,
}: BotBotRoutesDeps): void {
  const getAuthUser = (req: any) =>
    (req as any).authUser as
      | { id: string; name: string; roles: string[] }
      | undefined;
  const userId = (req: any): number => parseInt(getAuthUser(req)!.id, 10);

  app.post("/api/botbot/external/usage", async (req, res) => {
    const headerToken = String(req.headers["x-botbot-ledger-token"] || "");
    if (!BOTBOT_LEDGER_TOKEN || headerToken !== BOTBOT_LEDGER_TOKEN) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const userKey = normalizeExternalUserKey(req.body?.externalUserKey || req.body?.username || req.body?.email);
    if (!userKey) {
      return res.status(400).json({ ok: false, error: "externalUserKey required" });
    }

    const userResult = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE lower(email) = $1
          OR lower(split_part(email, '@', 1)) = $1
          OR lower(name) = $1
       ORDER BY
         CASE
           WHEN lower(email) = $1 THEN 1
           WHEN lower(split_part(email, '@', 1)) = $1 THEN 2
           ELSE 3
         END,
         id ASC
       LIMIT 1`,
      [userKey]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }

    const provider = String(req.body?.provider || "wolfbot").trim().toLowerCase() || "wolfbot";
    const modelKey = String(req.body?.modelKey || "local").trim() || "local";
    const ledgerModelKey = tokenLedgerKeyForProvider(provider, modelKey);
    const inputTokens = Math.max(0, Math.round(Number(req.body?.inputTokens ?? 0)) || 0);
    const outputTokens = Math.max(0, Math.round(Number(req.body?.outputTokens ?? 0)) || 0);
    const totalTokens = inputTokens + outputTokens;
    const status = req.body?.status === "error" || req.body?.status === "denied" ? req.body.status : "success";
    const taskKey = String(req.body?.taskKey || req.body?.source || "wolfbot-ai").slice(0, 120);
    const responseMs = Math.max(0, Math.round(Number(req.body?.responseMs ?? 0)) || 0);

    if (totalTokens > 0) {
      await pool.query(
        `INSERT INTO botbot_token_ledger (user_id, model_key, tokens_used, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, model_key)
         DO UPDATE SET
           tokens_used = botbot_token_ledger.tokens_used + EXCLUDED.tokens_used,
           updated_at = now()`,
        [Number(userResult.rows[0].id), ledgerModelKey, totalTokens]
      );
    }

    await logBotBotUsageEvent(pool, {
      userId: Number(userResult.rows[0].id),
      conversationId: null,
      messageId: null,
      modelKey,
      provider,
      skillKey: "wolfbot_workspace",
      taskKey,
      inputTokens,
      outputTokens,
      status,
      errorCode: status === "success" ? null : String(req.body?.errorCode || "wolfbot_workspace_error"),
      responseMs,
    });

    return res.json({
      ok: true,
      userId: Number(userResult.rows[0].id),
      modelKey,
      billingModelKey: ledgerModelKey,
      tokensRecorded: totalTokens,
    });
  });

  app.get("/api/botbot/models", async (req, res) => {
    const user = toAuthUser(getAuthUser(req)!);
    const r = await pool.query(
      `SELECT model_key, display_name, provider, ollama_model_name, free_token_quota, sort_order
       FROM botbot_model_config
       WHERE enabled = TRUE
       ORDER BY sort_order ASC`
    );
    const models = [];
    for (const row of r.rows) {
      const access = await resolveModelAccess(
        pool,
        user,
        String(row.model_key),
        String(row.provider),
        parseQuota(row.free_token_quota, 0)
      );
      if (!access.allowed) continue;
      models.push({
        modelKey: String(row.model_key),
        displayName: String(row.display_name ?? row.model_key),
        provider: String(row.provider ?? ""),
        freeTokenQuota: access.tokenQuota,
        sortOrder: Number(row.sort_order ?? 0),
        accessSource: access.source,
      });
    }
    res.json({ models });
  });

  app.get("/api/botbot/runtime", async (req, res) => {
    const tagInfo = await fetchOllamaTags(OLLAMA_BASE_URL);

    res.json({
      runtime: {
        enabled: BOTBOT_ENABLED,
        endpointKey: "alphaai",
        endpointLabel: "AlphaAI model endpoint",
        endpointUrl: OLLAMA_BASE_URL,
        localAiPlatformUrl: BOTBOT_LOCAL_AI_URL,
        primaryNodeLabel: OLLAMA_PRIMARY_NODE_LABEL,
        primaryModel: OLLAMA_PRIMARY_MODEL,
        reachable: tagInfo.reachable,
        models: tagInfo.models,
        modelCount: tagInfo.models.length,
        nodes: [
          {
            key: "alphaai",
            label: "AlphaAI",
            host: OLLAMA_PRIMARY_NODE_LABEL,
            baseUrl: OLLAMA_BASE_URL,
            description: "Shared AI endpoint for all BotBot model choices.",
            reachable: tagInfo.reachable,
            models: tagInfo.models,
            modelCount: tagInfo.models.length,
            isDefault: true,
            isSelected: true,
          },
        ],
      },
    });
  });

  app.get("/api/botbot/context/sales-snapshot", async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const start = parseDateParam(req.query.start, today);
    const end = parseDateParam(req.query.end, tomorrow);
    const location = parseTextParam(req.query.location);
    const salesperson = parseTextParam(req.query.salesperson);
    const label = parseTextParam(req.query.label) || `${start} to ${end}`;

    try {
      const snapshot = await buildSalesSnapshot(pool, {
        start,
        end,
        label,
        location,
        salesperson,
      });
      res.json({ ok: true, snapshot });
    } catch (err: any) {
      console.error("botbot_sales_snapshot_error", err);
      res.status(500).json({
        ok: false,
        error: "sales_snapshot_failed",
        detail: String(err?.message ?? err),
      });
    }
  });

  app.get("/api/botbot/conversations", async (req, res) => {
    const uid = userId(req);
    const r = await pool.query(
      `SELECT c.id, c.title, c.model_key, c.context_tag, c.updated_at,
              COUNT(m.id)::int AS message_count
       FROM botbot_conversations c
       LEFT JOIN botbot_messages m ON m.conversation_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [uid]
    );
    res.json({ conversations: r.rows });
  });

  app.post("/api/botbot/conversations", async (req, res) => {
    const uid = userId(req);
    const {
      modelKey = "local",
      title = "New Chat",
      contextTag = "",
    } = (req.body ?? {}) as {
      modelKey?: string;
      title?: string;
      contextTag?: string;
    };

    const modelCheck = await pool.query(
      `SELECT model_key, provider, free_token_quota FROM botbot_model_config WHERE model_key = $1 AND enabled = TRUE`,
      [modelKey]
    );
    if (modelCheck.rows.length === 0) {
      return res.status(400).json({ ok: false, error: "invalid_model" });
    }
    const modelAccess = await resolveModelAccess(
      pool,
      toAuthUser(getAuthUser(req)!),
      modelKey,
      String(modelCheck.rows[0].provider ?? ""),
      parseQuota(modelCheck.rows[0].free_token_quota, 0)
    );
    if (!modelAccess.allowed) {
      return res.status(403).json({ ok: false, error: "model_not_allowed" });
    }

    const r = await pool.query(
      `INSERT INTO botbot_conversations (user_id, title, model_key, context_tag)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, model_key, context_tag, created_at, updated_at`,
      [uid, title, modelKey, contextTag]
    );
    res.status(201).json({ conversation: r.rows[0] });
  });

  app.patch("/api/botbot/conversations/:id", async (req, res) => {
    const uid = userId(req);
    const convId = parseInt(req.params.id, 10);
    const { title } = (req.body ?? {}) as { title?: string };
    if (!title || typeof title !== "string") {
      return res.status(400).json({ ok: false, error: "title_required" });
    }
    const r = await pool.query(
      `UPDATE botbot_conversations
       SET title = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id, title`,
      [title.slice(0, 100), convId, uid]
    );
    if (r.rows.length === 0)
      return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ conversation: r.rows[0] });
  });

  app.delete("/api/botbot/conversations/:id", async (req, res) => {
    const uid = userId(req);
    const convId = parseInt(req.params.id, 10);
    const r = await pool.query(
      `DELETE FROM botbot_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [convId, uid]
    );
    if (r.rows.length === 0)
      return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  });

  app.get("/api/botbot/conversations/:id/messages", async (req, res) => {
    const uid = userId(req);
    const convId = parseInt(req.params.id, 10);

    const ownerCheck = await pool.query(
      `SELECT id FROM botbot_conversations WHERE id = $1 AND user_id = $2`,
      [convId, uid]
    );
    if (ownerCheck.rows.length === 0)
      return res.status(404).json({ ok: false, error: "not_found" });

    const r = await pool.query(
      `SELECT id, role, content, model_key, input_tokens, output_tokens, finish_reason, created_at
       FROM botbot_messages
       WHERE conversation_id = $1
       ORDER BY id ASC
       LIMIT $2`,
      [convId, MAX_RESPONSE_MESSAGES]
    );
    res.json({ messages: r.rows });
  });

  app.post("/api/botbot/conversations/:id/messages", async (req, res) => {
    const uid = userId(req);
    const user = getAuthUser(req)!;
    const convId = parseInt(req.params.id, 10);
    const { content, pageContext, promptContext } = (req.body ?? {}) as {
      content?: string;
      pageContext?: PageContext;
      promptContext?: { systemPrompt?: string; documentContext?: string; includeObjections?: boolean };
    };

    if (!content || typeof content !== "string" || !content.trim()) {
      return res
        .status(400)
        .json({ ok: false, error: "content_required", errorCode: "content_required" });
    }

    if (!checkRateLimit(uid)) {
      return res.status(429).json({
        ok: false,
        error: "You're sending messages too fast. Wait a moment and try again.",
        errorCode: "rate_limited",
      });
    }

    const convResult = await pool.query(
      `SELECT id, model_key, context_tag FROM botbot_conversations WHERE id = $1 AND user_id = $2`,
      [convId, uid]
    );
    if (convResult.rows.length === 0) {
      return res
        .status(404)
        .json({ ok: false, error: "not_found", errorCode: "not_found" });
    }
    const conv = convResult.rows[0];

    const modelResult = await pool.query(
      `SELECT model_key, display_name, provider, ollama_model_name, free_token_quota, enabled
       FROM botbot_model_config WHERE model_key = $1`,
      [conv.model_key]
    );
    if (
      modelResult.rows.length === 0 ||
      !modelResult.rows[0].enabled
    ) {
      return res.status(503).json({
        ok: false,
        error: "model_unavailable",
        errorCode: "model_unavailable",
      });
    }
    const model = modelResult.rows[0];
    const provider = String(model.provider ?? "");
    const ledgerModelKey = tokenLedgerKeyForProvider(provider, conv.model_key);
    const modelAccess = await resolveModelAccess(
      pool,
      toAuthUser(user),
      conv.model_key,
      provider,
      parseQuota(model.free_token_quota, 0)
    );
    if (!modelAccess.allowed) {
      await logBotBotUsageEvent(pool, {
        userId: uid,
        conversationId: convId,
        modelKey: conv.model_key,
        provider: String(model.provider ?? ""),
        skillKey: "api_model_access",
        status: "denied",
        errorCode: "model_not_allowed",
      });
      return res.status(403).json({
        ok: false,
        error: "This AI model is not enabled for your account yet.",
        errorCode: "model_not_allowed",
      });
    }

    const ledgerResult = await pool.query(
      `SELECT COALESCE(tokens_used, 0) AS tokens_used,
              COALESCE(tokens_purchased, 0) AS tokens_purchased
       FROM botbot_token_ledger
       WHERE user_id = $1 AND model_key = $2`,
      [uid, ledgerModelKey]
    );
    const ledger =
      ledgerResult.rows[0] ?? { tokens_used: 0, tokens_purchased: 0 };
    const tokensUsed = parseInt(ledger.tokens_used, 10);
    const tokensPurchased = parseInt(ledger.tokens_purchased, 10);
    const quota = modelAccess.tokenQuota;

    if (tokensUsed >= quota + tokensPurchased) {
      return res.status(402).json({
        ok: false,
        error: "quota_exceeded",
        errorCode: "quota_exceeded",
        modelKey: conv.model_key,
        displayName: model.display_name ?? conv.model_key,
        tokensUsed,
        quota: quota + tokensPurchased,
        quotaRemaining: 0,
        billingModelKey: ledgerModelKey,
      });
    }

    await pool.query(
      `INSERT INTO botbot_messages (conversation_id, role, content, model_key, input_tokens, output_tokens)
       VALUES ($1, 'user', $2, $3, 0, 0)`,
      [convId, content.trim(), conv.model_key]
    );

    const historyResult = await pool.query(
      `SELECT role, content FROM botbot_messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [convId, HISTORY_LIMIT]
    );
    const history: LLMMessage[] = historyResult.rows.reverse();

    const settingsResult = await pool.query(
      `SELECT assistant_name FROM botbot_settings WHERE user_id = $1`,
      [uid]
    );
    const assistantName =
      settingsResult.rows[0]?.assistant_name ?? "BotBot";

    const ctx: PageContext = pageContext ?? {
      pageName: "Dashboard",
      module: conv.context_tag ?? "",
      userRole: user.roles?.[0] ?? "Employee",
      keyMetricsVisible: [],
      suggestedActions: [],
    };
    const skillKey = inferBotBotSkill(ctx);
    const skillAccess = await resolveSkillAccess(pool, toAuthUser(user), skillKey);
    if (!skillAccess.allowed) {
      const errMsg =
        "I can't help with that area yet because this BotBot skill is not enabled for your account.";
      const errRow = await pool.query(
        `INSERT INTO botbot_messages
           (conversation_id, role, content, model_key, input_tokens, output_tokens, finish_reason)
         VALUES ($1, 'assistant', $2, $3, 0, 0, 'denied')
         RETURNING id, role, content, model_key, input_tokens, output_tokens, finish_reason, created_at`,
        [convId, errMsg, conv.model_key]
      );
      await logBotBotUsageEvent(pool, {
        userId: uid,
        conversationId: convId,
        messageId: Number(errRow.rows[0]?.id ?? 0) || null,
        modelKey: conv.model_key,
        provider: String(model.provider ?? ""),
        skillKey,
        status: "denied",
        errorCode: "skill_not_allowed",
      });
      return res.status(200).json({
        message: errRow.rows[0],
        tokensUsed,
        quota: quota + tokensPurchased,
        quotaRemaining: Math.max(0, quota + tokensPurchased - tokensUsed),
        billingModelKey: ledgerModelKey,
        error: errMsg,
        errorCode: "skill_not_allowed",
      });
    }
    let liveContextSnapshot = "";
    if (isSalesContext(ctx)) {
      const params = salesContextParams(ctx);
      if (params) {
        try {
          liveContextSnapshot = formatSalesSnapshotForPrompt(await buildSalesSnapshot(pool, params));
        } catch (err: any) {
          console.error("botbot_sales_context_snapshot_error", err);
          liveContextSnapshot =
            "Sales live snapshot could not be loaded for this request. Explain the page using the manual and ask the user to verify the dashboard data.";
        }
      }
    }
    const promptContextAddendum = buildPromptContextAddendum(promptContext);
    const objectionContextAddendum =
      promptContext?.includeObjections ? await loadObjectionHandlingPromptContext(pool) : "";
    const systemPrompt = [
      buildSystemPrompt(user.name, assistantName, ctx, liveContextSnapshot),
      promptContextAddendum,
      objectionContextAddendum,
    ].filter(Boolean).join("\n\n");
    const responseStartedAt = Date.now();

    let llmResponse: {
      text: string;
      inputTokens: number;
      outputTokens: number;
    };
    try {
      if (model.provider === "wolfbot") {
        llmResponse = await callBotBotLocalAi(
          model.ollama_model_name || OLLAMA_PRIMARY_MODEL,
          history,
          systemPrompt
        );
      } else if (model.provider === "ollama") {
        llmResponse = await callOllama(
          model.ollama_model_name,
          history,
          systemPrompt,
          OLLAMA_BASE_URL
        );
      } else if (model.provider === "openai") {
        llmResponse = await callOpenAI(
          model.ollama_model_name || conv.model_key,
          history,
          systemPrompt
        );
      } else if (model.provider === "anthropic") {
        llmResponse = await callClaude(conv.model_key, history, systemPrompt);
      } else {
        throw new Error("unknown_provider");
      }
    } catch (err: any) {
      let errMsg: string;
      let errorCode: string;

      if (err.message === "model_unavailable") {
        errMsg =
          "Claude models are not configured on this server. Please use Local AI.";
        errorCode = "claude_not_configured";
      } else if (err.message === "openai_unavailable") {
        errMsg =
          "OpenAI models are not configured on this server yet. Please use Local AI.";
        errorCode = "openai_not_configured";
      } else if (err.message?.includes("BotBot AI platform")) {
        errMsg =
          "Local AI is reachable through BotBot, but the MSI platform could not complete the request. Please try again.";
        errorCode = "botbot_platform_down";
      } else if (err.message?.includes("Ollama")) {
        errMsg = "Local AI is currently unavailable. Please try again.";
        errorCode = "ollama_down";
      } else {
        errMsg = "Something went wrong. Please try again.";
        errorCode = "network_error";
      }

      const errRow = await pool.query(
        `INSERT INTO botbot_messages
           (conversation_id, role, content, model_key, input_tokens, output_tokens, finish_reason)
         VALUES ($1, 'assistant', $2, $3, 0, 0, 'error')
         RETURNING id, role, content, model_key, input_tokens, output_tokens, finish_reason, created_at`,
        [convId, errMsg, conv.model_key]
      );
      await logBotBotUsageEvent(pool, {
        userId: uid,
        conversationId: convId,
        messageId: Number(errRow.rows[0]?.id ?? 0) || null,
        modelKey: conv.model_key,
        provider: String(model.provider ?? ""),
        skillKey,
        status: "error",
        errorCode,
        responseMs: Date.now() - responseStartedAt,
      });
      return res.status(200).json({
        message: errRow.rows[0],
        tokensUsed,
        quota: quota + tokensPurchased,
        quotaRemaining: Math.max(0, quota + tokensPurchased - tokensUsed),
        billingModelKey: ledgerModelKey,
        error: errMsg,
        errorCode,
      });
    }

    const msgResult = await pool.query(
      `INSERT INTO botbot_messages
         (conversation_id, role, content, model_key, input_tokens, output_tokens, finish_reason)
       VALUES ($1, 'assistant', $2, $3, $4, $5, 'stop')
       RETURNING id, role, content, model_key, input_tokens, output_tokens, finish_reason, created_at`,
      [
        convId,
        llmResponse.text,
        conv.model_key,
        llmResponse.inputTokens,
        llmResponse.outputTokens,
      ]
    );

    const totalNew = llmResponse.inputTokens + llmResponse.outputTokens;
    await logBotBotUsageEvent(pool, {
      userId: uid,
      conversationId: convId,
      messageId: Number(msgResult.rows[0]?.id ?? 0) || null,
      modelKey: conv.model_key,
      provider: String(model.provider ?? ""),
      skillKey,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      status: "success",
      responseMs: Date.now() - responseStartedAt,
    });
    await pool.query(
      `INSERT INTO botbot_token_ledger (user_id, model_key, tokens_used, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, model_key)
       DO UPDATE SET
         tokens_used = botbot_token_ledger.tokens_used + EXCLUDED.tokens_used,
         updated_at = now()`,
      [uid, ledgerModelKey, totalNew]
    );

    await pool.query(
      `UPDATE botbot_conversations SET updated_at = now() WHERE id = $1`,
      [convId]
    );

    const newTokensUsed = tokensUsed + totalNew;
    res.json({
      message: msgResult.rows[0],
      tokensUsed: newTokensUsed,
      quota: quota + tokensPurchased,
      quotaRemaining: Math.max(0, quota + tokensPurchased - newTokensUsed),
      billingModelKey: ledgerModelKey,
    });
  });

  app.get("/api/botbot/token-usage", async (req, res) => {
    const uid = userId(req);
    const user = toAuthUser(getAuthUser(req)!);
    const r = await pool.query(
      `SELECT m.model_key, m.display_name, m.provider, m.free_token_quota AS quota,
              CASE WHEN m.provider IN ('wolfbot', 'ollama') THEN 'local' ELSE m.model_key END AS billing_model_key,
              COALESCE(l.tokens_used, 0) AS tokens_used,
              COALESCE(l.tokens_purchased, 0) AS tokens_purchased
       FROM botbot_model_config m
       LEFT JOIN botbot_token_ledger l
         ON l.model_key = CASE WHEN m.provider IN ('wolfbot', 'ollama') THEN 'local' ELSE m.model_key END
        AND l.user_id = $1
       WHERE m.enabled = TRUE
       ORDER BY m.sort_order ASC`,
      [uid]
    );
    const usage = [];
    for (const row of r.rows) {
      const access = await resolveModelAccess(
        pool,
        user,
        String(row.model_key),
        String(row.provider ?? ""),
        parseQuota(row.quota, 0)
      );
      if (!access.allowed) continue;
      const tokensUsed = parseInt(row.tokens_used, 10);
      const quota = access.tokenQuota;
      const tokensPurchased = parseInt(row.tokens_purchased, 10);
      const effective = quota + tokensPurchased;
      usage.push({
        modelKey: row.model_key,
        billingModelKey: row.billing_model_key,
        displayName: row.display_name,
        tokensUsed,
        quota: effective,
        quotaRemaining: Math.max(0, effective - tokensUsed),
        pctUsed:
          effective > 0
            ? Math.min(100, Math.round((tokensUsed / effective) * 100))
            : 0,
      });
    }
    res.json({ usage });
  });

  app.get("/api/botbot/settings", async (req, res) => {
    const uid = userId(req);
    const r = await pool.query(
      `SELECT assistant_name, assistant_theme, tutorial_completed, preferred_model_key, preferred_runtime_node
       FROM botbot_settings WHERE user_id = $1`,
      [uid]
    );
    res.json({ settings: r.rows[0] ?? null });
  });

  app.put("/api/botbot/settings", async (req, res) => {
    const uid = userId(req);
    const {
      assistantName,
      assistantTheme,
      tutorialCompleted,
      preferredModelKey,
    } = (req.body ?? {}) as {
      assistantName?: string;
      assistantTheme?: string;
      tutorialCompleted?: boolean;
      preferredModelKey?: string;
    };

    const validThemes = [
      "sky",
      "emerald",
      "violet",
      "amber",
      "rose",
      "teal",
    ];
    const safeName =
      typeof assistantName === "string"
        ? assistantName.trim().slice(0, 50) || "BotBot"
        : undefined;
    const safeTheme = validThemes.includes(assistantTheme)
      ? assistantTheme
      : undefined;

    await pool.query(
      `INSERT INTO botbot_settings (user_id, assistant_name, assistant_theme, tutorial_completed, preferred_model_key, preferred_runtime_node)
       VALUES ($1,
         COALESCE($2, 'BotBot'),
         COALESCE($3, 'sky'),
         COALESCE($4, FALSE),
         COALESCE($5, 'local'),
         COALESCE($6, 'alphaai')
       )
       ON CONFLICT (user_id) DO UPDATE SET
         assistant_name      = COALESCE($2, botbot_settings.assistant_name),
         assistant_theme     = COALESCE($3, botbot_settings.assistant_theme),
         tutorial_completed  = COALESCE($4, botbot_settings.tutorial_completed),
         preferred_model_key = COALESCE($5, botbot_settings.preferred_model_key),
         preferred_runtime_node = COALESCE($6, botbot_settings.preferred_runtime_node),
         updated_at = now()`,
      [uid, safeName, safeTheme, tutorialCompleted, preferredModelKey, undefined]
    );
    res.json({ ok: true });
  });

  app.get("/api/botbot/admin/usage", requireOwner, async (req, res) => {
    const page = Math.max(
      1,
      parseInt(String((req.query as any).page ?? "1"), 10)
    );
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String((req.query as any).limit ?? "50"), 10))
    );
    const offset = (page - 1) * limit;

    const r = await pool.query(
      `SELECT u.id AS user_id, u.name AS user_name, u.email,
              l.model_key, m.display_name, m.free_token_quota AS quota,
              COALESCE(l.tokens_used, 0) AS tokens_used,
              l.updated_at
       FROM botbot_token_ledger l
       JOIN users u ON u.id = l.user_id
       JOIN botbot_model_config m ON m.model_key = l.model_key
       ORDER BY l.tokens_used DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM botbot_token_ledger`
    );
    res.json({
      rows: r.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  });

  app.get("/api/botbot/admin/model-config", requireOwner, async (_req, res) => {
    const r = await pool.query(
      `SELECT model_key, display_name, provider, ollama_model_name,
              free_token_quota, enabled, sort_order, updated_at
       FROM botbot_model_config
       ORDER BY sort_order ASC`
    );
    res.json({ models: r.rows });
  });

  app.get("/api/botbot/admin/usage/history", requireOwner, async (req, res) => {
    const rangeKey = String((req.query as any).range ?? "1h");
    const config = RANGE_CONFIG[rangeKey] ?? RANGE_CONFIG["1h"];
    const r = await pool.query(
      `SELECT to_timestamp(floor(extract(epoch from created_at) / $2::numeric) * $2::numeric) AS bucket,
              COUNT(*)::int AS events,
              COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
              COALESCE(SUM(estimated_cost_usd), 0)::numeric AS estimated_cost_usd,
              COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0)::int AS errors,
              COALESCE(SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END), 0)::int AS denied,
              COALESCE(SUM(CASE WHEN response_ms >= 5000 THEN 1 ELSE 0 END), 0)::int AS slow_responses
       FROM botbot_usage_events
       WHERE created_at >= now() - ($1::interval)
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [config.interval, config.bucketSeconds]
    );
    res.json({
      range: rangeKey in RANGE_CONFIG ? rangeKey : "1h",
      bucketSeconds: config.bucketSeconds,
      points: r.rows.map((row) => ({
        bucket: row.bucket,
        events: Number(row.events ?? 0),
        totalTokens: Number(row.total_tokens ?? 0),
        inputTokens: Number(row.input_tokens ?? 0),
        outputTokens: Number(row.output_tokens ?? 0),
        estimatedCostUsd: Number(row.estimated_cost_usd ?? 0),
        errors: Number(row.errors ?? 0),
        denied: Number(row.denied ?? 0),
        slowResponses: Number(row.slow_responses ?? 0),
      })),
    });
  });

  app.get("/api/botbot/admin/usage/by-skill", requireOwner, async (req, res) => {
    const rangeKey = String((req.query as any).range ?? "24h");
    const config = RANGE_CONFIG[rangeKey] ?? RANGE_CONFIG["24h"];
    const r = await pool.query(
      `SELECT e.skill_key,
              COALESCE(c.label, e.skill_key) AS label,
              COUNT(*)::int AS events,
              COALESCE(SUM(e.total_tokens), 0)::bigint AS total_tokens,
              COALESCE(SUM(CASE WHEN e.status = 'denied' THEN 1 ELSE 0 END), 0)::int AS denied,
              COALESCE(SUM(CASE WHEN e.status = 'error' THEN 1 ELSE 0 END), 0)::int AS errors
       FROM botbot_usage_events e
       LEFT JOIN botbot_skill_catalog c ON c.skill_key = e.skill_key
       WHERE e.created_at >= now() - ($1::interval)
       GROUP BY e.skill_key, c.label
       ORDER BY total_tokens DESC, events DESC`,
      [config.interval]
    );
    res.json({
      range: rangeKey in RANGE_CONFIG ? rangeKey : "24h",
      rows: r.rows.map((row) => ({
        skillKey: row.skill_key,
        label: row.label,
        events: Number(row.events ?? 0),
        totalTokens: Number(row.total_tokens ?? 0),
        denied: Number(row.denied ?? 0),
        errors: Number(row.errors ?? 0),
      })),
    });
  });

  app.get("/api/botbot/admin/skills", requireOwner, async (_req, res) => {
    const r = await pool.query(
      `SELECT skill_key, label, description, default_allowed, admin_only, updated_at
       FROM botbot_skill_catalog
       ORDER BY skill_key ASC`
    );
    res.json({
      skills: r.rows.map((row) => ({
        skillKey: row.skill_key,
        label: row.label,
        description: row.description,
        defaultAllowed: Boolean(row.default_allowed),
        adminOnly: Boolean(row.admin_only),
        updatedAt: row.updated_at,
      })),
    });
  });

  app.get("/api/botbot/admin/access/roles/:roleKey", requireOwner, async (req, res) => {
    res.json(await loadSubjectAccess(pool, "role", String(req.params.roleKey || "")));
  });

  app.patch("/api/botbot/admin/access/roles/:roleKey", requireOwner, async (req, res) => {
    const roleKey = String(req.params.roleKey || "");
    await saveSubjectAccess(pool, "role", roleKey, req.body ?? {});
    res.json({ ok: true, access: await loadSubjectAccess(pool, "role", roleKey) });
  });

  app.get("/api/botbot/admin/access/users/:id", requireOwner, async (req, res) => {
    res.json(await loadSubjectAccess(pool, "user", String(req.params.id || "")));
  });

  app.patch("/api/botbot/admin/access/users/:id", requireOwner, async (req, res) => {
    const targetUserId = String(req.params.id || "");
    await saveSubjectAccess(pool, "user", targetUserId, req.body ?? {});
    res.json({ ok: true, access: await loadSubjectAccess(pool, "user", targetUserId) });
  });

  app.patch(
    "/api/botbot/admin/model-config/:modelKey",
    requireOwner,
    async (req, res) => {
      const { modelKey } = req.params;
      const {
        freeTokenQuota,
        displayName,
        enabled,
        sortOrder,
      } = (req.body ?? {}) as {
        freeTokenQuota?: number;
        displayName?: string;
        enabled?: boolean;
        sortOrder?: number;
      };

      const updates: string[] = ["updated_at = now()"];
      const values: any[] = [modelKey];

      if (typeof freeTokenQuota === "number" && freeTokenQuota >= 0) {
        values.push(freeTokenQuota);
        updates.push(`free_token_quota = $${values.length}`);
      }
      if (typeof displayName === "string" && displayName.trim()) {
        values.push(displayName.trim());
        updates.push(`display_name = $${values.length}`);
      }
      if (typeof enabled === "boolean") {
        values.push(enabled);
        updates.push(`enabled = $${values.length}`);
      }
      if (typeof sortOrder === "number") {
        values.push(sortOrder);
        updates.push(`sort_order = $${values.length}`);
      }

      const r = await pool.query(
        `UPDATE botbot_model_config SET ${updates.join(", ")}
         WHERE model_key = $1
         RETURNING model_key, display_name, free_token_quota, enabled, sort_order`,
        values
      );
      if (r.rows.length === 0)
        return res.status(404).json({ ok: false, error: "not_found" });
      res.json({ ok: true, model: r.rows[0] });
    }
  );

  app.post(
    "/api/botbot/admin/reset-user-quota",
    requireOwner,
    async (req, res) => {
      const { userId: targetUserId, modelKey } = (req.body ?? {}) as {
        userId?: string;
        modelKey?: string;
      };
      if (!targetUserId || !modelKey) {
        return res
          .status(400)
          .json({ ok: false, error: "userId and modelKey required" });
      }
      await pool.query(
        `UPDATE botbot_token_ledger
         SET tokens_used = 0, last_reset_at = now(), updated_at = now()
         WHERE user_id = $1 AND model_key = $2`,
        [parseInt(targetUserId, 10), modelKey]
      );
      res.json({ ok: true });
    }
  );
}
