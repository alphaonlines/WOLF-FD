import type { Express } from "express";
import type { Pool } from "pg";
import {
  parseCrmBool,
  parseCrmChannel,
  parseCrmDate,
  parseCrmLeadId,
  parseCrmStage,
} from "../parsers";

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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
    const values: any[] = [];
    const where: string[] = [];
    if (storeRaw) {
      values.push(storeRaw);
      where.push(`store = $${values.length}`);
    }
    if (isSalesOnly(user)) {
      values.push(Number(user.id));
      where.push(`rep_user_id = $${values.length}`);
    }
    const sql = `
      SELECT
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
        created_at,
        updated_at
      FROM crm_ups_queue
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY store ASC, queue_position ASC, checked_in_at ASC;
    `;
    const r = await pool.query(sql, values);
    res.json({ rows: r.rows.map(mapUpsQueueRow) });
  });

  app.post("/api/crm/ups-queue", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });

    const store = typeof req.body?.store === "string" && req.body.store.trim() ? req.body.store.trim() : "FD7";
    const manualRepName = typeof req.body?.rep === "string" ? req.body.rep.trim() : "";
    const isManual = Boolean(manualRepName);
    if (isManual && !isManagerOrOwner(user)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const repUserId = isManual ? null : Number(user.id);
    const repName = isManual ? manualRepName : user.name || user.email;

    const existing = repUserId !== null
      ? await pool.query(`SELECT id FROM crm_ups_queue WHERE store = $1 AND rep_user_id = $2 LIMIT 1`, [store, repUserId])
      : await pool.query(`SELECT id FROM crm_ups_queue WHERE store = $1 AND lower(rep) = lower($2) LIMIT 1`, [store, repName]);
    if (existing.rows.length) {
      const row = await pool.query(
        `
        SELECT
          id, store, rep, rep_user_id, status, queue_position, checked_in_at,
          current_customer, current_customer_type, current_customer_details, started_at, created_at, updated_at
        FROM crm_ups_queue
        WHERE id = $1
      `,
        [existing.rows[0].id]
      );
      return res.status(200).json({ row: mapUpsQueueRow(row.rows[0]) });
    }

    const maxPos = await pool.query(`SELECT COALESCE(MAX(queue_position), 0)::int AS max_pos FROM crm_ups_queue WHERE store = $1`, [
      store,
    ]);
    const nextPos = Number(maxPos.rows[0]?.max_pos ?? 0) + 1;
    const id = parseCrmLeadId(req.body?.id) ?? `ups-rep-${Date.now()}`;

    const r = await pool.query(
      `
      INSERT INTO crm_ups_queue (
        id, store, rep, rep_user_id, status, queue_position, checked_in_at,
        current_customer, current_customer_type, current_customer_details, started_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4::bigint, 'waiting', $5, now(), NULL, NULL, NULL, NULL, now(), now())
      RETURNING
        id, store, rep, rep_user_id, status, queue_position, checked_in_at,
        current_customer, current_customer_type, current_customer_details, started_at, created_at, updated_at
    `,
      [id, store, repName, repUserId, nextPos]
    );
    res.status(201).json({ row: mapUpsQueueRow(r.rows[0]) });
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

    const row = await pool.query(`SELECT rep_user_id FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    if (isSalesOnly(user) && Number(row.rows[0].rep_user_id) !== Number(user.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const r = await pool.query(
      `
      UPDATE crm_ups_queue
      SET
        status = 'working',
        current_customer = $1,
        current_customer_type = $2,
        current_customer_details = $3,
        started_at = now(),
        updated_at = now()
      WHERE id = $4
      RETURNING
        id, store, rep, rep_user_id, status, queue_position, checked_in_at,
        current_customer, current_customer_type, current_customer_details, started_at, created_at, updated_at
    `,
      [customer, customerType, customerDetails, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "not found" });
    res.json({ row: mapUpsQueueRow(r.rows[0]) });
  });

  app.patch("/api/crm/ups-queue/:id/customer", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const row = await pool.query(`SELECT rep_user_id FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    if (isSalesOnly(user) && Number(row.rows[0].rep_user_id) !== Number(user.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

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

    values.push(id);
    const r = await pool.query(
      `
      UPDATE crm_ups_queue
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING
        id, store, rep, rep_user_id, status, queue_position, checked_in_at,
        current_customer, current_customer_type, current_customer_details, started_at, created_at, updated_at
      `,
      values
    );
    if (!r.rows.length) return res.status(404).json({ error: "not found" });
    res.json({ row: mapUpsQueueRow(r.rows[0]) });
  });

  app.post("/api/crm/ups-queue/:id/complete", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const row = await pool.query(
      `SELECT id, store, rep_user_id, current_customer_type FROM crm_ups_queue WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    const target = row.rows[0];
    if (isSalesOnly(user) && Number(target.rep_user_id) !== Number(user.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const moveToFront = String(target.current_customer_type || "") === "B-Back";
    const store = String(target.store || "FD7");

    if (moveToFront) {
      await pool.query(`UPDATE crm_ups_queue SET queue_position = queue_position + 1 WHERE store = $1 AND id <> $2`, [store, id]);
      await pool.query(
        `
        UPDATE crm_ups_queue
        SET
          status = 'waiting',
          current_customer = NULL,
          current_customer_type = NULL,
          current_customer_details = NULL,
          started_at = NULL,
          queue_position = 1,
          updated_at = now()
        WHERE id = $1
      `,
        [id]
      );
    } else {
      const maxPos = await pool.query(`SELECT COALESCE(MAX(queue_position), 0)::int AS max_pos FROM crm_ups_queue WHERE store = $1`, [
        store,
      ]);
      const nextPos = Number(maxPos.rows[0]?.max_pos ?? 1);
      await pool.query(
        `
        UPDATE crm_ups_queue
        SET
          status = 'waiting',
          current_customer = NULL,
          current_customer_type = NULL,
          current_customer_details = NULL,
          started_at = NULL,
          queue_position = $2,
          updated_at = now()
        WHERE id = $1
      `,
        [id, nextPos]
      );
    }

    const reordered = await pool.query(
      `
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY store ORDER BY queue_position ASC, checked_in_at ASC) AS rn
        FROM crm_ups_queue
        WHERE store = $1
      )
      UPDATE crm_ups_queue q
      SET queue_position = ranked.rn, updated_at = now()
      FROM ranked
      WHERE q.id = ranked.id
      RETURNING
        q.id, q.store, q.rep, q.rep_user_id, q.status, q.queue_position, q.checked_in_at,
        q.current_customer, q.current_customer_type, q.current_customer_details, q.started_at, q.created_at, q.updated_at
    `,
      [store]
    );
    res.json({ rows: reordered.rows.map(mapUpsQueueRow) });
  });

  app.delete("/api/crm/ups-queue/:id", async (req, res) => {
    const user = authUserFromReq(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const id = parseCrmLeadId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid id" });

    const row = await pool.query(`SELECT store, rep_user_id FROM crm_ups_queue WHERE id = $1 LIMIT 1`, [id]);
    if (!row.rows.length) return res.status(404).json({ error: "not found" });
    if (isSalesOnly(user) && Number(row.rows[0].rep_user_id) !== Number(user.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const store = String(row.rows[0].store || "FD7");

    await pool.query(`DELETE FROM crm_ups_queue WHERE id = $1`, [id]);
    await pool.query(
      `
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY store ORDER BY queue_position ASC, checked_in_at ASC) AS rn
        FROM crm_ups_queue
        WHERE store = $1
      )
      UPDATE crm_ups_queue q
      SET queue_position = ranked.rn, updated_at = now()
      FROM ranked
      WHERE q.id = ranked.id
    `,
      [store]
    );
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
