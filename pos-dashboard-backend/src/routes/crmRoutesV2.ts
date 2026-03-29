import type { Express } from "express";
import type { Pool } from "pg";
import {
  parseCrmBool,
  parseCrmChannel,
  parseCrmDate,
  parseCrmLeadId,
  parseCrmStage,
} from "../parsers";
import { getStoreWeatherSnapshot } from "../crmWeather";

type AuthUserLike = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

type SqlClauseBuild = {
  clause: string;
  values: any[];
};

const UPS_LANES = ["Unattended", "Be-Back", "Quote Follow-up"] as const;
const UPS_PRIORITIES = ["Hot", "Today", "Nurture"] as const;
const UPS_QUEUE_CUSTOMER_TYPES = ["Regular Up", "B-Back"] as const;
const UPS_QUEUE_STATUSES = ["waiting", "working", "on_break"] as const;
const UPS_QUEUE_SELECT_SQL = `
  id,
  store,
  rep,
  rep_user_id,
  status,
  queue_position,
  checked_in_at,
  current_customer,
  current_customer_type,
  current_customer_details,
  started_at,
  current_weather_location,
  current_weather_summary,
  current_weather_temp_f,
  current_weather_precip_pct,
  current_weather_wind_mph,
  current_weather_fetched_at,
  current_weather_source,
  active_history_id,
  created_at,
  updated_at
`;
const QUALIFIED_UPS_QUEUE_SELECT_SQL = `
  q.id,
  q.store,
  q.rep,
  q.rep_user_id,
  q.status,
  q.queue_position,
  q.checked_in_at,
  q.current_customer,
  q.current_customer_type,
  q.current_customer_details,
  q.started_at,
  q.current_weather_location,
  q.current_weather_summary,
  q.current_weather_temp_f,
  q.current_weather_precip_pct,
  q.current_weather_wind_mph,
  q.current_weather_fetched_at,
  q.current_weather_source,
  q.active_history_id,
  q.created_at,
  q.updated_at
`;
const UPS_ACTIVE_CUSTOMER_JSON_SQL = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', ac.id,
        'queue_entry_id', ac.queue_entry_id,
        'customer', ac.customer,
        'customer_type', ac.customer_type,
        'customer_details', ac.customer_details,
        'started_at', ac.started_at,
        'history_id', ac.history_id
      )
      ORDER BY ac.started_at DESC, ac.created_at DESC, ac.id DESC
    ) FILTER (WHERE ac.id IS NOT NULL),
    '[]'::json
  ) AS active_customers,
  COUNT(ac.id)::int AS active_customer_count
`;

function parseUpsLane(value: any): (typeof UPS_LANES)[number] | null {
  if (!value || typeof value !== "string") return null;
  const lane = value.trim();
  return UPS_LANES.includes(lane as any) ? (lane as any) : null;
}

function parseUpsPriority(value: any): (typeof UPS_PRIORITIES)[number] | null {
  if (!value || typeof value !== "string") return null;
  const priority = value.trim();
  return UPS_PRIORITIES.includes(priority as any) ? (priority as any) : null;
}

function parseUpsQueueCustomerType(value: any): (typeof UPS_QUEUE_CUSTOMER_TYPES)[number] | null {
  if (!value || typeof value !== "string") return null;
  const type = value.trim();
  return UPS_QUEUE_CUSTOMER_TYPES.includes(type as any) ? (type as any) : null;
}

function parseUpsQueueStatus(value: any): (typeof UPS_QUEUE_STATUSES)[number] | null {
  if (!value || typeof value !== "string") return null;
  const status = value.trim();
  return UPS_QUEUE_STATUSES.includes(status as any) ? (status as any) : null;
}

function buildUpsHistoryId(): string {
  return `uphist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function isManagerOrOwner(user: AuthUserLike | null): boolean {
  return hasAnyRole(user, ["Owner", "Manager"]);
}

function isSalesOnly(user: AuthUserLike | null): boolean {
  return hasAnyRole(user, ["Sales"]) && !isManagerOrOwner(user);
}

function normalizePersonNameTokens(value: any): string[] {
  return String(value || "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .sort();
}

function namesLikelyMatch(left: any, right: any): boolean {
  const leftTokens = normalizePersonNameTokens(left);
  const rightTokens = normalizePersonNameTokens(right);
  return leftTokens.length > 0 && leftTokens.join("|") === rightTokens.join("|");
}

function canManageUpsQueueRow(user: AuthUserLike | null, row: any): boolean {
  if (!user) return false;
  if (!isSalesOnly(user)) return true;
  const repUserId =
    row?.rep_user_id === null || row?.rep_user_id === undefined || row?.rep_user_id === ""
      ? null
      : Number(row.rep_user_id);
  if (repUserId !== null && Number.isFinite(repUserId) && repUserId > 0) {
    return repUserId === Number(user.id);
  }
  return namesLikelyMatch(row?.rep, user.name);
}

async function resolveOwner(
  pool: Pool,
  ownerUserIdRaw: any,
  ownerRaw: any
): Promise<{ ownerUserId: number | null; ownerName: string }> {
  const ownerUserId =
    ownerUserIdRaw === null || ownerUserIdRaw === undefined || ownerUserIdRaw === ""
      ? null
      : Number(ownerUserIdRaw);
  if (ownerUserId !== null && Number.isFinite(ownerUserId) && ownerUserId > 0) {
    const userRow = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1 AND active = TRUE LIMIT 1",
      [ownerUserId]
    );
    if (userRow.rows.length) {
      return {
        ownerUserId: Number(userRow.rows[0].id),
        ownerName: String(userRow.rows[0].name || userRow.rows[0].email || "Unassigned"),
      };
    }
  }

  const ownerName = typeof ownerRaw === "string" && ownerRaw.trim() ? ownerRaw.trim() : "Unassigned";
  return {
    ownerUserId: null,
    ownerName,
  };
}

function mapLeadRow(row: any) {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    channel: String(row.channel ?? "SMS"),
    source: String(row.source ?? ""),
    interest: String(row.interest ?? ""),
    budget: String(row.budget ?? ""),
    store: String(row.store ?? ""),
    owner: String(row.owner ?? "Unassigned"),
    owner_user_id: row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
    stage: String(row.stage ?? "New"),
    next_action: String(row.next_action ?? ""),
    due_date: row.due_date ? String(row.due_date).slice(0, 10) : null,
    last_message: String(row.last_message ?? ""),
    last_touch: String(row.last_touch ?? ""),
    notes: String(row.notes ?? ""),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapAutomationRow(row: any) {
  return {
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
    description: String(row.description ?? ""),
    enabled: Boolean(row.enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapUpsRow(row: any) {
  return {
    id: String(row.id ?? ""),
    customer: String(row.customer ?? ""),
    task: String(row.task ?? ""),
    owner: String(row.owner ?? "Unassigned"),
    owner_user_id: row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
    lane: String(row.lane ?? "Unattended"),
    priority: String(row.priority ?? "Today"),
    due_at: row.due_at ? String(row.due_at).slice(0, 10) : null,
    channel: String(row.channel ?? "SMS"),
    done: Boolean(row.done),
    started_at: row.started_at ? String(row.started_at) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapUpsQueueRow(row: any) {
  return {
    id: String(row.id ?? ""),
    store: String(row.store ?? "FD7"),
    rep: String(row.rep ?? ""),
    rep_user_id: row.rep_user_id === null || row.rep_user_id === undefined ? null : String(row.rep_user_id),
    status: String(row.status ?? "waiting"),
    queue_position: Number(row.queue_position ?? 0),
    checked_in_at: row.checked_in_at ? String(row.checked_in_at) : null,
    current_customer: row.current_customer ? String(row.current_customer) : null,
    current_customer_type: row.current_customer_type ? String(row.current_customer_type) : null,
    current_customer_details: row.current_customer_details ? String(row.current_customer_details) : null,
    started_at: row.started_at ? String(row.started_at) : null,
    current_weather_location: row.current_weather_location ? String(row.current_weather_location) : null,
    current_weather_summary: row.current_weather_summary ? String(row.current_weather_summary) : null,
    current_weather_temp_f:
      row.current_weather_temp_f === null || row.current_weather_temp_f === undefined
        ? null
        : Number(row.current_weather_temp_f),
    current_weather_precip_pct:
      row.current_weather_precip_pct === null || row.current_weather_precip_pct === undefined
        ? null
        : Number(row.current_weather_precip_pct),
    current_weather_wind_mph:
      row.current_weather_wind_mph === null || row.current_weather_wind_mph === undefined
        ? null
        : Number(row.current_weather_wind_mph),
    current_weather_fetched_at: row.current_weather_fetched_at ? String(row.current_weather_fetched_at) : null,
    current_weather_source: row.current_weather_source ? String(row.current_weather_source) : null,
    active_history_id: row.active_history_id ? String(row.active_history_id) : null,
    live_weather_location: row.live_weather_location ? String(row.live_weather_location) : null,
    live_weather_summary: row.live_weather_summary ? String(row.live_weather_summary) : null,
    live_weather_temp_f:
      row.live_weather_temp_f === null || row.live_weather_temp_f === undefined ? null : Number(row.live_weather_temp_f),
    live_weather_precip_pct:
      row.live_weather_precip_pct === null || row.live_weather_precip_pct === undefined ? null : Number(row.live_weather_precip_pct),
    live_weather_wind_mph:
      row.live_weather_wind_mph === null || row.live_weather_wind_mph === undefined ? null : Number(row.live_weather_wind_mph),
    live_weather_fetched_at: row.live_weather_fetched_at ? String(row.live_weather_fetched_at) : null,
    helped_today_count: row.helped_today_count === null || row.helped_today_count === undefined ? 0 : Number(row.helped_today_count),
    active_customer_count:
      row.active_customer_count === null || row.active_customer_count === undefined ? 0 : Number(row.active_customer_count),
    active_customers: Array.isArray(row.active_customers)
      ? row.active_customers.map((entry: any) => ({
          id: String(entry?.id ?? ""),
          queue_entry_id: String(entry?.queue_entry_id ?? ""),
          customer: String(entry?.customer ?? ""),
          customer_type: entry?.customer_type ? String(entry.customer_type) : null,
          customer_details: entry?.customer_details ? String(entry.customer_details) : null,
          started_at: entry?.started_at ? String(entry.started_at) : null,
          history_id: entry?.history_id ? String(entry.history_id) : null,
        }))
      : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function fetchUpsQueueRows(
  pool: Pool,
  options?: { store?: string; repUserId?: number; ids?: string[] }
) {
  const values: any[] = [];
  const where: string[] = [];
  if (options?.store) {
    values.push(options.store);
    where.push(`q.store = $${values.length}`);
  }
  if (options?.repUserId !== undefined) {
    values.push(options.repUserId);
    where.push(`q.rep_user_id = $${values.length}`);
  }
  if (options?.ids?.length) {
    values.push(options.ids);
    where.push(`q.id = ANY($${values.length}::text[])`);
  }

  const sql = `
    SELECT
      ${QUALIFIED_UPS_QUEUE_SELECT_SQL},
      ${UPS_ACTIVE_CUSTOMER_JSON_SQL}
    FROM crm_ups_queue q
    LEFT JOIN crm_ups_active_customers ac ON ac.queue_entry_id = q.id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY ${QUALIFIED_UPS_QUEUE_SELECT_SQL}
    ORDER BY
      q.store ASC,
      CASE q.status
        WHEN 'waiting' THEN 1
        WHEN 'working' THEN 2
        WHEN 'on_break' THEN 3
        ELSE 99
      END ASC,
      q.queue_position ASC,
      q.checked_in_at ASC;
  `;
  const r = await pool.query(sql, values);
  const decoratedRows = await decorateQueueRows(pool, r.rows);
  return decoratedRows.map(mapUpsQueueRow);
}

async function syncUpsQueueRowFromActiveCustomers(pool: Pool, queueEntryId: string) {
  const activeCustomers = await pool.query(
    `
    SELECT
      id,
      history_id,
      customer,
      customer_type,
      customer_details,
      started_at
    FROM crm_ups_active_customers
    WHERE queue_entry_id = $1
    ORDER BY started_at DESC, created_at DESC, id DESC
  `,
    [queueEntryId]
  );

  if (activeCustomers.rows.length) {
    const primary = activeCustomers.rows[0];
    const historyWeather = primary.history_id
      ? await pool.query(
          `
          SELECT
            weather_location,
            weather_summary,
            weather_temp_f,
            weather_precip_pct,
            weather_wind_mph,
            weather_fetched_at,
            weather_source
          FROM crm_ups_history
          WHERE id = $1
          LIMIT 1
        `,
          [String(primary.history_id)]
        )
      : { rows: [] as any[] };
    const weatherRow = historyWeather.rows[0] || null;
    const updated = await pool.query(
      `
      UPDATE crm_ups_queue
      SET
        status = 'working',
        current_customer = $1,
        current_customer_type = $2,
        current_customer_details = $3,
        started_at = $4,
        active_history_id = $5,
        current_weather_location = $6,
        current_weather_summary = $7,
        current_weather_temp_f = $8,
        current_weather_precip_pct = $9,
        current_weather_wind_mph = $10,
        current_weather_fetched_at = $11,
        current_weather_source = $12,
        updated_at = now()
      WHERE id = $13
      RETURNING store
    `,
      [
        String(primary.customer || ""),
        primary.customer_type ? String(primary.customer_type) : null,
        primary.customer_details ? String(primary.customer_details) : null,
        primary.started_at || null,
        primary.history_id ? String(primary.history_id) : null,
        weatherRow?.weather_location ? String(weatherRow.weather_location) : null,
        weatherRow?.weather_summary ? String(weatherRow.weather_summary) : null,
        weatherRow?.weather_temp_f ?? null,
        weatherRow?.weather_precip_pct ?? null,
        weatherRow?.weather_wind_mph ?? null,
        weatherRow?.weather_fetched_at ?? null,
        weatherRow?.weather_source ? String(weatherRow.weather_source) : null,
        queueEntryId,
      ]
    );
    return {
      store: String(updated.rows[0]?.store || "FD7"),
      activeCustomerCount: activeCustomers.rows.length,
    };
  }

  const updated = await pool.query(
    `
    UPDATE crm_ups_queue
    SET
      status = 'waiting',
      current_customer = NULL,
      current_customer_type = NULL,
      current_customer_details = NULL,
      started_at = NULL,
      current_weather_location = NULL,
      current_weather_summary = NULL,
      current_weather_temp_f = NULL,
      current_weather_precip_pct = NULL,
      current_weather_wind_mph = NULL,
      current_weather_fetched_at = NULL,
      current_weather_source = NULL,
      active_history_id = NULL,
      updated_at = now()
    WHERE id = $1
    RETURNING store
  `,
    [queueEntryId]
  );
  return {
    store: String(updated.rows[0]?.store || "FD7"),
    activeCustomerCount: 0,
  };
}

function buildQueueRepMetricKey(row: any): string | null {
  if (row?.rep_user_id !== null && row?.rep_user_id !== undefined && row?.rep_user_id !== "") {
    return `uid:${String(row.rep_user_id)}`;
  }
  const rep = String(row?.rep || "").trim().toLowerCase();
  return rep ? `name:${rep}` : null;
}

async function decorateQueueRows(pool: Pool, rows: any[]) {
  const stores = [...new Set(rows.map((row) => String(row.store || "").trim()).filter(Boolean))];
  const weatherByStore = new Map<string, Awaited<ReturnType<typeof getStoreWeatherSnapshot>>>();
  await Promise.all(
    stores.map(async (store) => {
      const snapshot = await getStoreWeatherSnapshot(store);
      weatherByStore.set(store, snapshot);
    })
  );
  const repUserIds = [...new Set(
    rows
      .map((row) => (row.rep_user_id === null || row.rep_user_id === undefined || row.rep_user_id === "" ? null : Number(row.rep_user_id)))
      .filter((value): value is number => Number.isFinite(value) && value > 0)
  )];
  const repNames = [...new Set(
    rows
      .filter((row) => row.rep_user_id === null || row.rep_user_id === undefined || row.rep_user_id === "")
      .map((row) => String(row.rep || "").trim().toLowerCase())
      .filter(Boolean)
  )];
  const helpedTodayByRep = new Map<string, number>();
  if (repUserIds.length || repNames.length) {
    const metrics = await pool.query(
      `
      SELECT
        CASE
          WHEN rep_user_id IS NOT NULL THEN 'uid:' || rep_user_id::text
          ELSE 'name:' || lower(rep)
        END AS rep_key,
        COUNT(*)::int AS helped_today_count
      FROM crm_ups_history
      WHERE
        counts_as_up = TRUE
        AND (started_at AT TIME ZONE 'America/New_York')::date = (now() AT TIME ZONE 'America/New_York')::date
        AND (
          (array_length($1::bigint[], 1) IS NOT NULL AND rep_user_id = ANY($1::bigint[]))
          OR (array_length($2::text[], 1) IS NOT NULL AND rep_user_id IS NULL AND lower(rep) = ANY($2::text[]))
        )
      GROUP BY 1
    `,
      [repUserIds, repNames]
    );
    for (const metricRow of metrics.rows) {
      helpedTodayByRep.set(String(metricRow.rep_key || ""), Number(metricRow.helped_today_count ?? 0));
    }
  }
  return rows.map((row) => {
    const snapshot = weatherByStore.get(String(row.store || "").trim()) || null;
    const repKey = buildQueueRepMetricKey(row);
    return {
      ...row,
      live_weather_location: snapshot?.locationLabel || null,
      live_weather_summary: snapshot?.summary || null,
      live_weather_temp_f: snapshot?.temperatureF ?? null,
      live_weather_precip_pct: snapshot?.precipitationProbabilityPct ?? null,
      live_weather_wind_mph: snapshot?.windSpeedMph ?? null,
      live_weather_fetched_at: snapshot?.fetchedAt || null,
      helped_today_count: repKey ? helpedTodayByRep.get(repKey) ?? 0 : 0,
    };
  });
}

async function reorderUpsQueueStore(pool: Pool, store: string) {
  const reordered = await pool.query(
    `
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY store
          ORDER BY
            CASE status
              WHEN 'waiting' THEN 1
              WHEN 'working' THEN 2
              WHEN 'on_break' THEN 3
              ELSE 99
            END ASC,
            queue_position ASC,
            checked_in_at ASC
        ) AS rn
      FROM crm_ups_queue
      WHERE store = $1
    )
    UPDATE crm_ups_queue q
    SET queue_position = ranked.rn, updated_at = now()
    FROM ranked
    WHERE q.id = ranked.id
    RETURNING
      ${QUALIFIED_UPS_QUEUE_SELECT_SQL}
  `,
    [store]
  );

  const decoratedRows = await decorateQueueRows(pool, reordered.rows);
  return decoratedRows.map(mapUpsQueueRow);
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

function buildLooseSearchClause(columns: string[], query: string, phoneDigits: string): SqlClauseBuild {
  const values: any[] = [];
  const conditions: string[] = [];
  const normalized = query.trim().toLowerCase();
  if (normalized) {
    values.push(`%${normalized}%`);
    const token = `$${values.length}`;
    conditions.push(`(${columns.map((column) => `lower(COALESCE(${column}, '')) LIKE ${token}`).join(" OR ")})`);
  }
  if (phoneDigits) {
    values.push(`%${phoneDigits}%`);
    const token = `$${values.length}`;
    conditions.push(`regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE ${token}`);
  }
  return {
    clause: conditions.length ? conditions.join(" OR ") : "FALSE",
    values,
  };
}

function mapCustomerRow(row: any) {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    store: String(row.store ?? "FD7"),
    notes: String(row.notes ?? ""),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCustomerOrderRow(row: any) {
  return {
    sale_id: String(row.sale_id ?? ""),
    sale_date: row.sale_date ? String(row.sale_date).slice(0, 10) : null,
    delivery_confirmed_date: row.delivery_confirmed_date ? String(row.delivery_confirmed_date).slice(0, 10) : null,
    est_delivery_date: row.est_delivery_date ? String(row.est_delivery_date).slice(0, 10) : null,
    location: String(row.location ?? ""),
    salesperson: String(row.salesperson ?? ""),
    receipt_no: String(row.receipt_no ?? ""),
    customer_name: String(row.customer_name ?? ""),
    phone: String(row.phone ?? ""),
    grand_total: row.grand_total ?? null,
    sale_status: String(row.sale_status ?? ""),
  };
}

export function registerCrmRoutes(app: Express, pool: Pool) {
  app.get("/api/crm/owners", async (_req, res) => {
    const sql = `
      SELECT
        u.id,
        u.name,
        u.email,
        COALESCE(
          ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
          ARRAY[]::text[]
        ) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.active = TRUE
      GROUP BY u.id, u.name, u.email
      HAVING bool_or(r.role_key IN ('Owner', 'Manager', 'Sales'))
      ORDER BY lower(u.name) ASC, lower(u.email) ASC;
    `;
    const r = await pool.query(sql);
    res.json({
      rows: r.rows.map((row: any) => ({
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        roles: Array.isArray(row.roles) ? row.roles.map((role: any) => String(role)) : [],
      })),
    });
  });

  app.get("/api/crm/salespeople", async (_req, res) => {
    const sql = `
      WITH base AS (
        SELECT
          lower(trim(p.salesperson)) AS salesperson_key,
          trim(p.salesperson) AS salesperson_name,
          COALESCE(NULLIF(trim(s.location), ''), 'Unknown') AS location,
          p.sale_id,
          s.sale_date
        FROM pos_sales_people p
        JOIN pos_sales s ON s.sale_id = p.sale_id
        WHERE p.salesperson IS NOT NULL
          AND trim(p.salesperson) <> ''
          AND trim(p.salesperson) <> 'Sales, Store'
      ),
      rep_names AS (
        SELECT
          salesperson_key,
          (ARRAY_AGG(salesperson_name ORDER BY length(salesperson_name) DESC, salesperson_name ASC))[1] AS salesperson_name
        FROM base
        GROUP BY salesperson_key
      ),
      rep_locations AS (
        SELECT
          salesperson_key,
          location,
          COUNT(DISTINCT sale_id)::int AS ticket_count,
          MAX(sale_date) AS last_sale_date
        FROM base
        GROUP BY salesperson_key, location
      ),
      matched_users AS (
        SELECT
          lower(trim(u.name)) AS salesperson_key,
          MIN(u.id)::bigint AS user_id
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.active = TRUE
        GROUP BY lower(trim(u.name))
        HAVING bool_or(r.role_key IN ('Owner', 'Manager', 'Sales'))
      )
      SELECT
        names.salesperson_name AS name,
        matched.user_id,
        (ARRAY_AGG(loc.location ORDER BY loc.ticket_count DESC, loc.location ASC))[1] AS primary_location,
        ARRAY_AGG(loc.location ORDER BY loc.ticket_count DESC, loc.location ASC) AS locations,
        SUM(loc.ticket_count)::int AS total_tickets,
        MAX(loc.last_sale_date) AS last_sale_date
      FROM rep_locations loc
      JOIN rep_names names ON names.salesperson_key = loc.salesperson_key
      LEFT JOIN matched_users matched ON matched.salesperson_key = loc.salesperson_key
      GROUP BY names.salesperson_name, matched.user_id
      ORDER BY lower((ARRAY_AGG(loc.location ORDER BY loc.ticket_count DESC, loc.location ASC))[1]) ASC, lower(names.salesperson_name) ASC;
    `;
    const r = await pool.query(sql);
    res.json({
      rows: r.rows.map((row: any) => ({
        name: String(row.name ?? ""),
        user_id: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
        primary_location: String(row.primary_location ?? ""),
        locations: Array.isArray(row.locations) ? row.locations.map((value: any) => String(value)) : [],
        total_tickets: Number(row.total_tickets ?? 0),
        last_sale_date: row.last_sale_date ? String(row.last_sale_date).slice(0, 10) : null,
      })),
    });
  });

  app.get("/api/crm/leads", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const scope = String(req.query?.scope || "team").toLowerCase() === "my" ? "my" : "team";
    const salesOnly = isSalesOnly(user);
    const values: any[] = [];
    const where: string[] = [];

    if (salesOnly || scope === "my") {
      values.push(Number(user.id));
      where.push(`owner_user_id = $${values.length}`);
    }

    const sql = `
      SELECT
        id,
        name,
        phone,
        channel,
        source,
        interest,
        budget,
        store,
        owner,
        owner_user_id,
        stage,
        next_action,
        due_date,
        last_message,
        last_touch,
        notes,
        created_at,
        updated_at
      FROM crm_leads
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        CASE stage
          WHEN 'New' THEN 1
          WHEN 'Contacted' THEN 2
          WHEN 'Appointment' THEN 3
          WHEN 'Quoted' THEN 4
          WHEN 'Won' THEN 5
          WHEN 'Lost' THEN 6
          ELSE 99
        END ASC,
        due_date ASC NULLS LAST,
        updated_at DESC,
        id ASC;
    `;
    const r = await pool.query(sql, values);
    res.json({ rows: r.rows.map(mapLeadRow) });
  });

  app.post("/api/crm/leads", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const id = parseCrmLeadId(req.body?.id) ?? `lead-${Date.now()}`;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });

    const channel = parseCrmChannel(req.body?.channel) ?? "SMS";
    const source = typeof req.body?.source === "string" && req.body.source.trim() ? req.body.source.trim() : "Website";
    const interest = typeof req.body?.interest === "string" ? req.body.interest.trim() : "";
    const budget =
      typeof req.body?.budget === "string" && req.body.budget.trim() ? req.body.budget.trim() : "Unspecified";
    const store = typeof req.body?.store === "string" && req.body.store.trim() ? req.body.store.trim() : "FD7";
    const stage = parseCrmStage(req.body?.stage) ?? "New";
    const nextAction =
      typeof req.body?.next_action === "string" && req.body.next_action.trim()
        ? req.body.next_action.trim()
        : "First contact";
    const dueDate = parseCrmDate(req.body?.due_date);
    const lastMessage = typeof req.body?.last_message === "string" ? req.body.last_message.trim() : "";
    const lastTouch = typeof req.body?.last_touch === "string" ? req.body.last_touch.trim() : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

    const ownerResult = await resolveOwner(pool, req.body?.owner_user_id, req.body?.owner);
    let ownerUserId = ownerResult.ownerUserId;
    let ownerName = ownerResult.ownerName;

    if (isSalesOnly(user)) {
      ownerUserId = Number(user.id);
      ownerName = user.name || user.email;
    }

    const sql = `
      INSERT INTO crm_leads (
        id, name, phone, channel, source, interest, budget, store, owner, owner_user_id, stage,
        next_action, due_date, last_message, last_touch, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::bigint, $11, $12, $13::date, $14, $15, $16, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        channel = EXCLUDED.channel,
        source = EXCLUDED.source,
        interest = EXCLUDED.interest,
        budget = EXCLUDED.budget,
        store = EXCLUDED.store,
        owner = EXCLUDED.owner,
        owner_user_id = EXCLUDED.owner_user_id,
        stage = EXCLUDED.stage,
        next_action = EXCLUDED.next_action,
        due_date = EXCLUDED.due_date,
        last_message = EXCLUDED.last_message,
        last_touch = EXCLUDED.last_touch,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING
        id, name, phone, channel, source, interest, budget, store, owner, owner_user_id, stage,
        next_action, due_date, last_message, last_touch, notes, created_at, updated_at;
    `;
    const r = await pool.query(sql, [
      id,
      name,
      phone,
      channel,
      source,
      interest,
      budget,
      store,
      ownerName,
      ownerUserId,
      stage,
      nextAction,
      dueDate,
      lastMessage,
      lastTouch,
      notes,
    ]);
    res.status(201).json({ row: mapLeadRow(r.rows[0]) });
  });

  app.patch("/api/crm/leads/:id/assign", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const existing = await pool.query("SELECT owner_user_id FROM crm_leads WHERE id = $1 LIMIT 1", [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "not found" });

    const salesOnly = isSalesOnly(user);
    const currentOwnerUserId =
      existing.rows[0].owner_user_id === null || existing.rows[0].owner_user_id === undefined
        ? null
        : Number(existing.rows[0].owner_user_id);
    const ownerResult = await resolveOwner(pool, req.body?.owner_user_id, req.body?.owner);

    if (salesOnly) {
      if (currentOwnerUserId !== null && currentOwnerUserId !== Number(user.id)) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (ownerResult.ownerUserId !== Number(user.id)) {
        return res.status(403).json({ error: "sales can only assign leads to themselves" });
      }
    }

    const r = await pool.query(
      `
        UPDATE crm_leads
        SET owner = $1, owner_user_id = $2::bigint, updated_at = now()
        WHERE id = $3
        RETURNING
          id, name, phone, channel, source, interest, budget, store, owner, owner_user_id, stage,
          next_action, due_date, last_message, last_touch, notes, created_at, updated_at
      `,
      [ownerResult.ownerName, ownerResult.ownerUserId, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "not found" });

    res.json({ row: mapLeadRow(r.rows[0]) });
  });

  app.patch("/api/crm/leads/:id", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    if (isSalesOnly(user)) {
      const own = await pool.query("SELECT owner_user_id FROM crm_leads WHERE id = $1 LIMIT 1", [id]);
      if (!own.rows.length) return res.status(404).json({ error: "not found" });
      const ownerUserId =
        own.rows[0].owner_user_id === null || own.rows[0].owner_user_id === undefined
          ? null
          : Number(own.rows[0].owner_user_id);
      if (ownerUserId !== Number(user.id)) {
        return res.status(403).json({ error: "forbidden" });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    const textField = (name: string, value: any, fallbackEmpty = true) => {
      if (value === undefined) return;
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      values.push(fallbackEmpty ? trimmed : trimmed || null);
      fields.push(`${name} = $${values.length}`);
    };

    textField("name", req.body?.name);
    textField("phone", req.body?.phone);
    textField("source", req.body?.source);
    textField("interest", req.body?.interest);
    textField("budget", req.body?.budget);
    textField("store", req.body?.store);
    textField("next_action", req.body?.next_action);
    textField("last_message", req.body?.last_message);
    textField("last_touch", req.body?.last_touch);
    textField("notes", req.body?.notes);

    if (req.body?.owner !== undefined || req.body?.owner_user_id !== undefined) {
      const ownerResult = await resolveOwner(pool, req.body?.owner_user_id, req.body?.owner);
      values.push(ownerResult.ownerName);
      fields.push(`owner = $${values.length}`);
      values.push(ownerResult.ownerUserId);
      fields.push(`owner_user_id = $${values.length}::bigint`);
    }

    if (req.body?.channel !== undefined) {
      const channel = parseCrmChannel(req.body?.channel);
      if (!channel) return res.status(400).json({ error: "invalid channel" });
      values.push(channel);
      fields.push(`channel = $${values.length}`);
    }

    if (req.body?.stage !== undefined) {
      const stage = parseCrmStage(req.body?.stage);
      if (!stage) return res.status(400).json({ error: "invalid stage" });
      values.push(stage);
      fields.push(`stage = $${values.length}`);
    }

    if (req.body?.due_date !== undefined) {
      const dueDate = req.body?.due_date === "" ? null : parseCrmDate(req.body?.due_date);
      if (req.body?.due_date !== "" && req.body?.due_date !== null && dueDate === null) {
        return res.status(400).json({ error: "invalid due_date" });
      }
      values.push(dueDate);
      fields.push(`due_date = $${values.length}::date`);
    }

    if (!fields.length) return res.status(400).json({ error: "no fields to update" });

    values.push(id);
    const sql = `
      UPDATE crm_leads
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING
        id, name, phone, channel, source, interest, budget, store, owner, owner_user_id, stage,
        next_action, due_date, last_message, last_touch, notes, created_at, updated_at;
    `;
    const r = await pool.query(sql, values);
    if (!r.rows.length) return res.status(404).json({ error: "not found" });

    res.json({ row: mapLeadRow(r.rows[0]) });
  });

  app.get("/api/crm/ups", async (_req, res) => {
    const sql = `
      SELECT
        id,
        customer,
        task,
        owner,
        owner_user_id,
        lane,
        priority,
        due_at,
        channel,
        done,
        started_at,
        created_at,
        updated_at
      FROM crm_ups_items
      ORDER BY done ASC, started_at DESC NULLS LAST, due_at DESC NULLS LAST, updated_at DESC;
    `;
    const r = await pool.query(sql);
    res.json({ rows: r.rows.map(mapUpsRow) });
  });

  app.post("/api/crm/ups", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const id = parseCrmLeadId(req.body?.id) ?? `ups-${Date.now()}`;
    const customer = typeof req.body?.customer === "string" ? req.body.customer.trim() : "";
    const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";
    if (!customer) return res.status(400).json({ error: "customer is required" });

    const lane = parseUpsLane(req.body?.lane) ?? "Unattended";
    const priority = parseUpsPriority(req.body?.priority) ?? "Today";
    const dueAt = parseCrmDate(req.body?.due_at) ?? new Date().toISOString().slice(0, 10);
    const channel = parseCrmChannel(req.body?.channel) ?? "SMS";
    const done = parseCrmBool(req.body?.done) ?? false;
    const startedAt = typeof req.body?.started_at === "string" && req.body.started_at.trim() ? req.body.started_at : null;

    const ownerResult = await resolveOwner(pool, req.body?.owner_user_id, req.body?.owner);

    if (isSalesOnly(user) && ownerResult.ownerUserId !== null && ownerResult.ownerUserId !== Number(user.id)) {
      return res.status(403).json({ error: "sales can only assign to themselves" });
    }

    const sql = `
      INSERT INTO crm_ups_items (
        id, customer, task, owner, owner_user_id, lane, priority, due_at,
        channel, done, started_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::bigint, $6, $7, $8::date, $9, $10, $11::timestamptz, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        customer = EXCLUDED.customer,
        task = EXCLUDED.task,
        owner = EXCLUDED.owner,
        owner_user_id = EXCLUDED.owner_user_id,
        lane = EXCLUDED.lane,
        priority = EXCLUDED.priority,
        due_at = EXCLUDED.due_at,
        channel = EXCLUDED.channel,
        done = EXCLUDED.done,
        started_at = EXCLUDED.started_at,
        updated_at = now()
      RETURNING
        id,
        customer,
        task,
        owner,
        owner_user_id,
        lane,
        priority,
        due_at,
        channel,
        done,
        started_at,
        created_at,
        updated_at;
    `;
    const r = await pool.query(sql, [
      id,
      customer,
      task || "Showroom walk-in customer",
      ownerResult.ownerName,
      ownerResult.ownerUserId,
      lane,
      priority,
      dueAt,
      channel,
      done,
      startedAt,
    ]);
    res.status(201).json({ row: mapUpsRow(r.rows[0]) });
  });

  app.patch("/api/crm/ups/:id", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const current = await pool.query("SELECT owner_user_id FROM crm_ups_items WHERE id = $1 LIMIT 1", [id]);
    if (!current.rows.length) return res.status(404).json({ error: "not found" });

    if (isSalesOnly(user)) {
      const currentOwnerUserId =
        current.rows[0].owner_user_id === null || current.rows[0].owner_user_id === undefined
          ? null
          : Number(current.rows[0].owner_user_id);
      if (currentOwnerUserId !== null && currentOwnerUserId !== Number(user.id)) {
        return res.status(403).json({ error: "forbidden" });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    const textField = (name: string, value: any) => {
      if (value === undefined) return;
      if (typeof value !== "string") return;
      values.push(value.trim());
      fields.push(`${name} = $${values.length}`);
    };

    textField("customer", req.body?.customer);
    textField("task", req.body?.task);

    if (req.body?.owner !== undefined || req.body?.owner_user_id !== undefined) {
      const ownerResult = await resolveOwner(pool, req.body?.owner_user_id, req.body?.owner);
      if (isSalesOnly(user) && ownerResult.ownerUserId !== null && ownerResult.ownerUserId !== Number(user.id)) {
        return res.status(403).json({ error: "sales can only assign to themselves" });
      }
      values.push(ownerResult.ownerName);
      fields.push(`owner = $${values.length}`);
      values.push(ownerResult.ownerUserId);
      fields.push(`owner_user_id = $${values.length}::bigint`);
    }

    if (req.body?.lane !== undefined) {
      const lane = parseUpsLane(req.body?.lane);
      if (!lane) return res.status(400).json({ error: "invalid lane" });
      values.push(lane);
      fields.push(`lane = $${values.length}`);
    }

    if (req.body?.priority !== undefined) {
      const priority = parseUpsPriority(req.body?.priority);
      if (!priority) return res.status(400).json({ error: "invalid priority" });
      values.push(priority);
      fields.push(`priority = $${values.length}`);
    }

    if (req.body?.due_at !== undefined) {
      const dueAt = req.body?.due_at === "" ? null : parseCrmDate(req.body?.due_at);
      if (req.body?.due_at !== "" && req.body?.due_at !== null && dueAt === null) {
        return res.status(400).json({ error: "invalid due_at" });
      }
      values.push(dueAt);
      fields.push(`due_at = $${values.length}::date`);
    }

    if (req.body?.channel !== undefined) {
      const channel = parseCrmChannel(req.body?.channel);
      if (!channel) return res.status(400).json({ error: "invalid channel" });
      values.push(channel);
      fields.push(`channel = $${values.length}`);
    }

    if (req.body?.done !== undefined) {
      const done = parseCrmBool(req.body?.done);
      if (done === null) return res.status(400).json({ error: "invalid done" });
      values.push(done);
      fields.push(`done = $${values.length}`);
    }

    if (req.body?.started_at !== undefined) {
      const startedAt =
        req.body?.started_at === null || req.body?.started_at === ""
          ? null
          : typeof req.body?.started_at === "string"
            ? req.body.started_at
            : null;
      values.push(startedAt);
      fields.push(`started_at = $${values.length}::timestamptz`);
    }

    if (!fields.length) return res.status(400).json({ error: "no fields to update" });

    values.push(id);
    const sql = `
      UPDATE crm_ups_items
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING
        id,
        customer,
        task,
        owner,
        owner_user_id,
        lane,
        priority,
        due_at,
        channel,
        done,
        started_at,
        created_at,
        updated_at;
    `;
    const r = await pool.query(sql, values);
    if (!r.rows.length) return res.status(404).json({ error: "not found" });

    res.json({ row: mapUpsRow(r.rows[0]) });
  });

  app.get("/api/crm/ups-queue", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const storeRaw = typeof req.query?.store === "string" ? req.query.store.trim() : "";
    const rows = await fetchUpsQueueRows(pool, {
      store: storeRaw || undefined,
      repUserId: isSalesOnly(user) ? Number(user.id) : undefined,
    });
    res.json({ rows });
  });

  app.post("/api/crm/ups-queue", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const store = typeof req.body?.store === "string" && req.body.store.trim() ? req.body.store.trim() : "FD7";
    const manualRepName = typeof req.body?.rep === "string" ? req.body.rep.trim() : "";
    const requestedRepUserIdRaw = req.body?.rep_user_id;
    const isManual = Boolean(manualRepName);
    if (isManual && !isManagerOrOwner(user)) {
      return res.status(403).json({ error: "forbidden" });
    }
    let repUserId = isManual
      ? requestedRepUserIdRaw === null || requestedRepUserIdRaw === undefined || requestedRepUserIdRaw === ""
        ? null
        : Number(requestedRepUserIdRaw)
      : Number(user.id);
    let repName = isManual ? manualRepName : user.name || user.email;

    if (repUserId !== null && (!Number.isFinite(repUserId) || repUserId <= 0)) {
      repUserId = null;
    }
    if (isManual && repUserId !== null) {
      const matchedUser = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          COALESCE(
            ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
            ARRAY[]::text[]
          ) AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = $1 AND u.active = TRUE
        GROUP BY u.id, u.name, u.email
        LIMIT 1
      `,
        [repUserId]
      );
      if (!matchedUser.rows.length) {
        return res.status(400).json({ error: "invalid rep_user_id" });
      }
      const roles = Array.isArray(matchedUser.rows[0].roles)
        ? matchedUser.rows[0].roles.map((role: any) => String(role))
        : [];
      if (!roles.some((role: string) => ["Owner", "Manager", "Sales"].includes(role))) {
        return res.status(400).json({ error: "rep_user_id is not queue-eligible" });
      }
      repName = String(matchedUser.rows[0].name || matchedUser.rows[0].email || repName);
    }

    const existing = repUserId !== null
      ? await pool.query(`SELECT id FROM crm_ups_queue WHERE store = $1 AND rep_user_id = $2 LIMIT 1`, [store, repUserId])
      : await pool.query(`SELECT id FROM crm_ups_queue WHERE store = $1 AND lower(rep) = lower($2) LIMIT 1`, [store, repName]);
    if (existing.rows.length) {
      const rows = await fetchUpsQueueRows(pool, { ids: [String(existing.rows[0].id)] });
      return res.status(200).json({ row: rows[0] || null });
    }

    const maxPos = await pool.query(`SELECT COALESCE(MAX(queue_position), 0)::int AS max_pos FROM crm_ups_queue WHERE store = $1`, [
      store,
    ]);
    const nextPos = Number(maxPos.rows[0]?.max_pos ?? 0) + 1;
    const id = parseCrmLeadId(req.body?.id) ?? `ups-rep-${Date.now()}`;

    await pool.query(
      `
      INSERT INTO crm_ups_queue (
        id, store, rep, rep_user_id, status, queue_position, checked_in_at,
        current_customer, current_customer_type, current_customer_details, started_at,
        current_weather_location, current_weather_summary, current_weather_temp_f, current_weather_precip_pct,
        current_weather_wind_mph, current_weather_fetched_at, current_weather_source, active_history_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4::bigint, 'waiting', $5, now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, now(), now())
      RETURNING
        ${UPS_QUEUE_SELECT_SQL}
    `,
      [id, store, repName, repUserId, nextPos]
    );
    const rows = await fetchUpsQueueRows(pool, { ids: [id] });
    res.status(201).json({ row: rows[0] || null });
  });

  app.post("/api/crm/ups-queue/:id/start", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const customer = typeof req.body?.customer === "string" ? req.body.customer.trim() : "";
    if (!customer) return res.status(400).json({ error: "customer is required" });
    const customerType = parseUpsQueueCustomerType(req.body?.customer_type) ?? "Regular Up";
    const customerDetails = typeof req.body?.customer_details === "string" ? req.body.customer_details.trim() : "";

    const row = await pool.query(`SELECT rep_user_id, store, rep, status, queue_position FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    if (!canManageUpsQueueRow(user, row.rows[0])) {
      return res.status(403).json({ error: "forbidden" });
    }
    const store = String(row.rows[0].store || "FD7");
    const rep = String(row.rows[0].rep || user.name || user.email || "");
    const currentStatus = String(row.rows[0].status || "waiting");
    const maxPos = await pool.query(`SELECT COALESCE(MAX(queue_position), 0)::int AS max_pos FROM crm_ups_queue WHERE store = $1`, [
      store,
    ]);
    const nextPos = Number(maxPos.rows[0]?.max_pos ?? 1) + 1;
    const historyId = buildUpsHistoryId();
    const activeCustomerId = `upactive-${historyId}`;
    const weather = await getStoreWeatherSnapshot(store);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        INSERT INTO crm_ups_history (
          id, queue_entry_id, store, rep, rep_user_id, customer, customer_type, customer_details,
          started_at, completed_at, weather_location, weather_summary, weather_temp_f, weather_precip_pct,
          weather_wind_mph, weather_fetched_at, weather_source, ended_reason, counts_as_up, is_door_traffic,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5::bigint, $6, $7, $8,
          now(), NULL, $9, $10, $11, $12, $13, $14, $15, 'completed', TRUE, TRUE, now(), now()
        )
      `,
        [
          historyId,
          id,
          store,
          rep,
          row.rows[0].rep_user_id ?? null,
          customer,
          customerType,
          customerDetails,
          weather?.locationLabel || null,
          weather?.summary || null,
          weather?.temperatureF ?? null,
          weather?.precipitationProbabilityPct ?? null,
          weather?.windSpeedMph ?? null,
          weather?.fetchedAt || null,
          weather?.source || null,
        ]
      );
      await client.query(
        `
        INSERT INTO crm_ups_active_customers (
          id,
          queue_entry_id,
          history_id,
          store,
          rep,
          rep_user_id,
          customer,
          customer_type,
          customer_details,
          started_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::bigint, $7, $8, $9, now(), now(), now())
      `,
        [
          activeCustomerId,
          id,
          historyId,
          store,
          rep,
          row.rows[0].rep_user_id ?? null,
          customer,
          customerType,
          customerDetails,
        ]
      );
      await client.query(
        `
        UPDATE crm_ups_queue
        SET
          status = 'working',
          current_customer = $1,
          current_customer_type = $2,
          current_customer_details = $3,
          queue_position = CASE WHEN status = 'working' THEN queue_position ELSE $4 END,
          started_at = now(),
          current_weather_location = $5,
          current_weather_summary = $6,
          current_weather_temp_f = $7,
          current_weather_precip_pct = $8,
          current_weather_wind_mph = $9,
          current_weather_fetched_at = $10,
          current_weather_source = $11,
          active_history_id = $12,
          updated_at = now()
        WHERE id = $13
      `,
        [
          customer,
          customerType,
          customerDetails,
          currentStatus === "working" ? Number(row.rows[0].queue_position ?? nextPos) : nextPos,
          weather?.locationLabel || null,
          weather?.summary || null,
          weather?.temperatureF ?? null,
          weather?.precipitationProbabilityPct ?? null,
          weather?.windSpeedMph ?? null,
          weather?.fetchedAt || null,
          weather?.source || null,
          historyId,
          id,
        ]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await reorderUpsQueueStore(pool, store);
    const rows = await fetchUpsQueueRows(pool, { ids: [id] });
    res.json({ row: rows[0] || null });
  });

  app.patch("/api/crm/ups-queue/:id/customers/:customerId", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    const customerId = parseCrmLeadId(req.params.customerId);
    if (!id) return res.status(400).json({ error: "invalid id" });
    if (!customerId) return res.status(400).json({ error: "invalid customerId" });

    const row = await pool.query(`SELECT rep_user_id FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    if (!canManageUpsQueueRow(user, row.rows[0])) {
      return res.status(403).json({ error: "forbidden" });
    }
    const activeRow = await pool.query(
      `SELECT id, history_id FROM crm_ups_active_customers WHERE id = $1 AND queue_entry_id = $2 LIMIT 1`,
      [customerId, id]
    );
    if (!activeRow.rows.length) return res.status(404).json({ error: "active customer not found" });

    const fields: string[] = [];
    const values: any[] = [];

    if (req.body?.customer !== undefined) {
      if (typeof req.body.customer !== "string" || !req.body.customer.trim()) {
        return res.status(400).json({ error: "customer is required" });
      }
      values.push(req.body.customer.trim());
      fields.push(`current_customer = $${values.length}`);
    }

    if (req.body?.customer_type !== undefined) {
      const customerType = parseUpsQueueCustomerType(req.body.customer_type);
      if (!customerType) return res.status(400).json({ error: "invalid customer_type" });
      values.push(customerType);
      fields.push(`current_customer_type = $${values.length}`);
    }

    if (req.body?.customer_details !== undefined) {
      if (typeof req.body.customer_details !== "string") {
        return res.status(400).json({ error: "invalid customer_details" });
      }
      values.push(req.body.customer_details.trim());
      fields.push(`current_customer_details = $${values.length}`);
    }

    if (!fields.length) return res.status(400).json({ error: "no fields to update" });

    values.push(customerId);
    await pool.query(
      `
      UPDATE crm_ups_active_customers
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
    `,
      values
    );
    if (activeRow.rows[0].history_id) {
      const historyFields: string[] = [];
      const historyValues: any[] = [];
      if (req.body?.customer !== undefined) {
        historyValues.push(req.body.customer.trim());
        historyFields.push(`customer = $${historyValues.length}`);
      }
      if (req.body?.customer_type !== undefined) {
        const customerType = parseUpsQueueCustomerType(req.body.customer_type);
        historyValues.push(customerType);
        historyFields.push(`customer_type = $${historyValues.length}`);
      }
      if (req.body?.customer_details !== undefined) {
        historyValues.push(req.body.customer_details.trim());
        historyFields.push(`customer_details = $${historyValues.length}`);
      }
      if (historyFields.length) {
        historyValues.push(String(activeRow.rows[0].history_id));
        await pool.query(
          `
          UPDATE crm_ups_history
          SET ${historyFields.join(", ")}, updated_at = now()
          WHERE id = $${historyValues.length}
        `,
          historyValues
        );
      }
    }
    await syncUpsQueueRowFromActiveCustomers(pool, id);
    const rows = await fetchUpsQueueRows(pool, { ids: [id] });
    res.json({ row: rows[0] || null });
  });

  app.post("/api/crm/ups-queue/:id/customers/:customerId/complete", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    const customerId = parseCrmLeadId(req.params.customerId);
    if (!id) return res.status(400).json({ error: "invalid id" });
    if (!customerId) return res.status(400).json({ error: "invalid customerId" });

    const row = await pool.query(`SELECT id, store, rep_user_id FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    const target = row.rows[0];
    if (!canManageUpsQueueRow(user, target)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const activeCustomer = await pool.query(
      `SELECT id, history_id FROM crm_ups_active_customers WHERE id = $1 AND queue_entry_id = $2 LIMIT 1`,
      [customerId, id]
    );
    if (!activeCustomer.rows.length) return res.status(404).json({ error: "active customer not found" });

    const store = String(target.store || "FD7");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM crm_ups_active_customers WHERE id = $1 AND queue_entry_id = $2`, [customerId, id]);
      if (activeCustomer.rows[0].history_id) {
        await client.query(
          `
          UPDATE crm_ups_history
          SET
            completed_at = COALESCE(completed_at, now()),
            ended_reason = COALESCE(NULLIF(ended_reason, ''), 'completed'),
            counts_as_up = COALESCE(counts_as_up, TRUE),
            is_door_traffic = COALESCE(is_door_traffic, TRUE),
            updated_at = now()
          WHERE id = $1
        `,
          [activeCustomer.rows[0].history_id]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await syncUpsQueueRowFromActiveCustomers(pool, id);
    const rows = await reorderUpsQueueStore(pool, store);
    res.json({ rows });
  });

  app.post("/api/crm/ups-queue/:id/customers/:customerId/remove-up", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    const customerId = parseCrmLeadId(req.params.customerId);
    if (!id) return res.status(400).json({ error: "invalid id" });
    if (!customerId) return res.status(400).json({ error: "invalid customerId" });

    const row = await pool.query(`SELECT id, store, rep_user_id FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    const target = row.rows[0];
    if (!canManageUpsQueueRow(user, target)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const activeCustomer = await pool.query(
      `SELECT id, history_id FROM crm_ups_active_customers WHERE id = $1 AND queue_entry_id = $2 LIMIT 1`,
      [customerId, id]
    );
    if (!activeCustomer.rows.length) return res.status(404).json({ error: "active customer not found" });

    const store = String(target.store || "FD7");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM crm_ups_active_customers WHERE id = $1 AND queue_entry_id = $2`, [customerId, id]);
      if (activeCustomer.rows[0].history_id) {
        await client.query(
          `
          UPDATE crm_ups_history
          SET
            completed_at = COALESCE(completed_at, now()),
            ended_reason = 'traffic_only',
            counts_as_up = FALSE,
            is_door_traffic = TRUE,
            updated_at = now()
          WHERE id = $1
        `,
          [activeCustomer.rows[0].history_id]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await syncUpsQueueRowFromActiveCustomers(pool, id);
    const rows = await reorderUpsQueueStore(pool, store);
    res.json({ rows });
  });

  app.patch("/api/crm/ups-queue/:id/status", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const nextStatus = parseUpsQueueStatus(req.body?.status);
    if (!nextStatus || (nextStatus !== "waiting" && nextStatus !== "on_break")) {
      return res.status(400).json({ error: "invalid status" });
    }

    const row = await pool.query(
      `
      SELECT id, store, rep_user_id, status, current_customer
      FROM crm_ups_queue
      WHERE id = $1
      LIMIT 1
    `,
      [id]
    );
    if (!row.rows.length) return res.status(404).json({ error: "not found" });

    const target = row.rows[0];
    if (!canManageUpsQueueRow(user, target)) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (String(target.status || "") === "working") {
      return res.status(400).json({ error: "complete the active customer before changing break status" });
    }

    const store = String(target.store || "FD7");
    const maxPos = await pool.query(`SELECT COALESCE(MAX(queue_position), 0)::int AS max_pos FROM crm_ups_queue WHERE store = $1`, [
      store,
    ]);
    const nextPos = Number(maxPos.rows[0]?.max_pos ?? 0) + 1;

    await pool.query(
      `
      UPDATE crm_ups_queue
      SET
        status = $1,
        queue_position = $2,
        current_customer = NULL,
        current_customer_type = NULL,
        current_customer_details = NULL,
        started_at = NULL,
        current_weather_location = NULL,
        current_weather_summary = NULL,
        current_weather_temp_f = NULL,
        current_weather_precip_pct = NULL,
        current_weather_wind_mph = NULL,
        current_weather_fetched_at = NULL,
        current_weather_source = NULL,
        active_history_id = NULL,
        updated_at = now()
      WHERE id = $3
    `,
      [nextStatus, nextPos, id]
    );

    const rows = await reorderUpsQueueStore(pool, store);
    res.json({ rows });
  });

  app.patch("/api/crm/ups-queue/:id/reorder", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (!isManagerOrOwner(user)) return res.status(403).json({ error: "forbidden" });

    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const direction = typeof req.body?.direction === "string" ? req.body.direction.trim().toLowerCase() : "";
    if (direction !== "up" && direction !== "down") {
      return res.status(400).json({ error: "invalid direction" });
    }

    const row = await pool.query(
      `
      SELECT id, store, status, queue_position
      FROM crm_ups_queue
      WHERE id = $1
      LIMIT 1
    `,
      [id]
    );
    if (!row.rows.length) return res.status(404).json({ error: "not found" });

    const target = row.rows[0];
    const store = String(target.store || "FD7");
    const status = String(target.status || "waiting");
    if (status === "working") {
      return res.status(400).json({ error: "cannot reorder a salesperson who is with a customer" });
    }

    const peers = await pool.query(
      `
      SELECT id, queue_position
      FROM crm_ups_queue
      WHERE store = $1 AND status = $2
      ORDER BY queue_position ASC, checked_in_at ASC
    `,
      [store, status]
    );

    const ids = peers.rows.map((entry: any) => String(entry.id));
    const currentIndex = ids.indexOf(id);
    if (currentIndex === -1) return res.status(404).json({ error: "not found" });

    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= ids.length) {
      const rows = await reorderUpsQueueStore(pool, store);
      return res.json({ rows });
    }

    const otherId = ids[swapIndex];
    const currentPos = Number(target.queue_position ?? currentIndex + 1);
    const otherPos = Number(peers.rows[swapIndex]?.queue_position ?? swapIndex + 1);

    await pool.query(
      `
      UPDATE crm_ups_queue
      SET
        queue_position = CASE
          WHEN id = $1 THEN $3
          WHEN id = $2 THEN $4
          ELSE queue_position
        END,
        updated_at = now()
      WHERE id IN ($1, $2)
    `,
      [id, otherId, otherPos, currentPos]
    );

    const rows = await reorderUpsQueueStore(pool, store);
    res.json({ rows });
  });

  app.delete("/api/crm/ups-queue/:id", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const row = await pool.query(`SELECT store, rep_user_id, active_history_id FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    if (!canManageUpsQueueRow(user, row.rows[0])) {
      return res.status(403).json({ error: "forbidden" });
    }
    const store = String(row.rows[0].store || "FD7");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const activeHistoryRows = await client.query(
        `SELECT history_id FROM crm_ups_active_customers WHERE queue_entry_id = $1 AND history_id IS NOT NULL`,
        [id]
      );
      const historyIds = activeHistoryRows.rows
        .map((entry: any) => String(entry.history_id || ""))
        .filter(Boolean);
      if (historyIds.length) {
        await client.query(
          `
          UPDATE crm_ups_history
          SET
            completed_at = COALESCE(completed_at, now()),
            ended_reason = COALESCE(NULLIF(ended_reason, ''), 'queue_deleted'),
            counts_as_up = COALESCE(counts_as_up, FALSE),
            is_door_traffic = COALESCE(is_door_traffic, TRUE),
            updated_at = now()
          WHERE id = ANY($1::text[])
        `,
          [historyIds]
        );
      }
      await client.query(`DELETE FROM crm_ups_active_customers WHERE queue_entry_id = $1`, [id]);
      await client.query(`DELETE FROM crm_ups_queue WHERE id = $1`, [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await reorderUpsQueueStore(pool, store);
    res.json({ ok: true });
  });

  app.get("/api/crm/customers/find", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const phoneRaw = typeof req.query?.phone === "string" ? req.query.phone.trim() : "";
    const emailRaw = typeof req.query?.email === "string" ? req.query.email.trim().toLowerCase() : "";
    const phoneNorm = normalizePhone(phoneRaw);

    if (!phoneNorm && !emailRaw) {
      return res.status(400).json({ error: "phone or email is required" });
    }

    const customerRes = await pool.query(
      `
      SELECT id, name, phone, email, store, notes, created_at, updated_at
      FROM crm_customers
      WHERE
        ($1::text <> '' AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE ('%' || $1 || '%'))
        OR ($2::text <> '' AND lower(COALESCE(email, '')) = $2)
      ORDER BY updated_at DESC
      LIMIT 25
    `,
      [phoneNorm, emailRaw]
    );

    const salesRes = await pool.query(
      `
      SELECT
        sale_id,
        sale_date,
        delivery_confirmed_date,
        est_delivery_date,
        location,
        salesperson,
        receipt_no,
        customer_name,
        phone,
        grand_total,
        sale_status
      FROM pos_sales
      WHERE
        ($1::text <> '' AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE ('%' || $1 || '%'))
      ORDER BY delivery_confirmed_date DESC NULLS LAST, sale_date DESC NULLS LAST
      LIMIT 100
    `,
      [phoneNorm]
    );

    res.json({
      customers: customerRes.rows.map(mapCustomerRow),
      orders: salesRes.rows.map(mapCustomerOrderRow),
      matched_by: {
        phone: Boolean(phoneNorm),
        email: Boolean(emailRaw),
      },
    });
  });

  app.get("/api/crm/search", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const queryRaw = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    const phoneDigits = normalizePhone(queryRaw);
    if (!queryRaw) return res.status(400).json({ error: "q is required" });

    const customerSearch = buildLooseSearchClause(["name", "email", "store", "notes"], queryRaw, phoneDigits);
    const leadSearch = buildLooseSearchClause(
      ["name", "source", "interest", "store", "owner", "notes", "last_message", "next_action"],
      queryRaw,
      phoneDigits
    );

    const orderValues: any[] = [`%${queryRaw.toLowerCase()}%`];
    const orderParts: string[] = [
      "(lower(COALESCE(customer_name, '')) LIKE $1 OR lower(COALESCE(receipt_no, '')) LIKE $1 OR lower(COALESCE(location, '')) LIKE $1 OR lower(COALESCE(salesperson, '')) LIKE $1)",
    ];
    if (phoneDigits) {
      orderValues.push(`%${phoneDigits}%`);
      orderParts.push(`regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE $${orderValues.length}`);
    }

    const customersRes = await pool.query(
      `
      SELECT id, name, phone, email, store, notes, created_at, updated_at
      FROM crm_customers
      WHERE ${customerSearch.clause}
      ORDER BY updated_at DESC, lower(name) ASC
      LIMIT 20
      `,
      customerSearch.values
    );

    const leadValues = [...leadSearch.values];
    const leadWhereParts = [leadSearch.clause];
    if (isSalesOnly(user)) {
      leadValues.push(Number(user.id));
      leadWhereParts.push(`owner_user_id = $${leadValues.length}`);
    }
    const leadsRes = await pool.query(
      `
      SELECT
        id, name, phone, channel, source, interest, budget, store, owner, owner_user_id, stage,
        next_action, due_date, last_message, last_touch, notes, created_at, updated_at
      FROM crm_leads
      WHERE ${leadWhereParts.join(" AND ")}
      ORDER BY updated_at DESC, due_date ASC NULLS LAST
      LIMIT 20
      `,
      leadValues
    );

    const ordersRes = await pool.query(
      `
      SELECT
        sale_id,
        sale_date,
        delivery_confirmed_date,
        est_delivery_date,
        location,
        salesperson,
        receipt_no,
        customer_name,
        phone,
        grand_total,
        sale_status
      FROM pos_sales
      WHERE ${orderParts.join(" OR ")}
      ORDER BY delivery_confirmed_date DESC NULLS LAST, sale_date DESC NULLS LAST
      LIMIT 30
      `,
      orderValues
    );

    res.json({
      customers: customersRes.rows.map(mapCustomerRow),
      leads: leadsRes.rows.map(mapLeadRow),
      orders: ordersRes.rows.map(mapCustomerOrderRow),
    });
  });

  app.post("/api/crm/customers/upsert", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const store = typeof req.body?.store === "string" && req.body.store.trim() ? req.body.store.trim() : "FD7";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

    if (!name) return res.status(400).json({ error: "name is required" });
    if (!phone && !email) return res.status(400).json({ error: "phone or email is required" });

    const phoneNorm = normalizePhone(phone);
    const existing = await pool.query(
      `
      SELECT id
      FROM crm_customers
      WHERE
        ($1::text <> '' AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE ('%' || $1 || '%'))
        OR ($2::text <> '' AND lower(COALESCE(email, '')) = $2)
      ORDER BY updated_at DESC
      LIMIT 1
    `,
      [phoneNorm, email]
    );

    const id = existing.rows[0]?.id ? String(existing.rows[0].id) : `cust-${Date.now()}`;
    const customerRes = await pool.query(
      `
      INSERT INTO crm_customers (id, name, phone, email, store, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        store = EXCLUDED.store,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING id, name, phone, email, store, notes, created_at, updated_at
    `,
      [id, name, phone, email, store, notes]
    );

    const orderRes = await pool.query(
      `
      SELECT
        sale_id,
        sale_date,
        delivery_confirmed_date,
        est_delivery_date,
        location,
        salesperson,
        receipt_no,
        customer_name,
        phone,
        grand_total,
        sale_status
      FROM pos_sales
      WHERE
        ($1::text <> '' AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE ('%' || $1 || '%'))
      ORDER BY delivery_confirmed_date DESC NULLS LAST, sale_date DESC NULLS LAST
      LIMIT 100
    `,
      [normalizePhone(phone)]
    );

    res.status(existing.rows.length ? 200 : 201).json({
      customer: mapCustomerRow(customerRes.rows[0]),
      orders: orderRes.rows.map(mapCustomerOrderRow),
      linked: {
        by_phone: Boolean(normalizePhone(phone)),
        by_email: Boolean(email),
      },
    });
  });

  app.get("/api/crm/automations", async (_req, res) => {
    const sql = `
      SELECT id, label, description, enabled, created_at, updated_at
      FROM crm_automations
      ORDER BY id ASC;
    `;
    const r = await pool.query(sql);
    res.json({ rows: r.rows.map(mapAutomationRow) });
  });

  app.post("/api/crm/automations", async (req, res) => {
    const id = parseCrmLeadId(req.body?.id) ?? `auto-${Date.now()}`;
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (!label) return res.status(400).json({ error: "label is required" });

    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const enabled = parseCrmBool(req.body?.enabled) ?? true;

    const sql = `
      INSERT INTO crm_automations (id, label, description, enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        enabled = EXCLUDED.enabled,
        updated_at = now()
      RETURNING id, label, description, enabled, created_at, updated_at;
    `;
    const r = await pool.query(sql, [id, label, description, enabled]);
    res.status(201).json({ row: mapAutomationRow(r.rows[0]) });
  });

  app.patch("/api/crm/automations/:id", async (req, res) => {
    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const fields: string[] = [];
    const values: any[] = [];

    if (req.body?.label !== undefined) {
      if (typeof req.body?.label !== "string" || !req.body?.label.trim()) {
        return res.status(400).json({ error: "invalid label" });
      }
      values.push(req.body.label.trim());
      fields.push(`label = $${values.length}`);
    }

    if (req.body?.description !== undefined) {
      if (typeof req.body?.description !== "string") return res.status(400).json({ error: "invalid description" });
      values.push(req.body.description.trim());
      fields.push(`description = $${values.length}`);
    }

    if (req.body?.enabled !== undefined) {
      const enabled = parseCrmBool(req.body?.enabled);
      if (enabled === null) return res.status(400).json({ error: "invalid enabled value" });
      values.push(enabled);
      fields.push(`enabled = $${values.length}`);
    }

    if (!fields.length) return res.status(400).json({ error: "no fields to update" });

    values.push(id);
    const sql = `
      UPDATE crm_automations
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING id, label, description, enabled, created_at, updated_at;
    `;
    const r = await pool.query(sql, values);
    if (!r.rows.length) return res.status(404).json({ error: "not found" });

    res.json({ row: mapAutomationRow(r.rows[0]) });
  });
}
