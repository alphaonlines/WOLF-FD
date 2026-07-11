"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCrmRoutes = registerCrmRoutes;
const parsers_1 = require("../parsers");
function mapLeadRow(row) {
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
function mapAutomationRow(row) {
    return {
        id: String(row.id ?? ""),
        label: String(row.label ?? ""),
        description: String(row.description ?? ""),
        enabled: Boolean(row.enabled),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
function registerCrmRoutes(app, pool) {
    app.get("/api/crm/leads", async (_req, res) => {
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
        stage,
        next_action,
        due_date,
        last_message,
        last_touch,
        notes,
        created_at,
        updated_at
      FROM crm_leads
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
        const r = await pool.query(sql);
        res.json({ rows: r.rows.map(mapLeadRow) });
    });
    app.post("/api/crm/leads", async (req, res) => {
        const id = (0, parsers_1.parseCrmLeadId)(req.body?.id) ?? `lead-${Date.now()}`;
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
        const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
        if (!name || !phone)
            return res.status(400).json({ error: "name and phone are required" });
        const channel = (0, parsers_1.parseCrmChannel)(req.body?.channel) ?? "SMS";
        const source = typeof req.body?.source === "string" && req.body.source.trim() ? req.body.source.trim() : "Website";
        const interest = typeof req.body?.interest === "string" ? req.body.interest.trim() : "";
        const budget = typeof req.body?.budget === "string" && req.body.budget.trim() ? req.body.budget.trim() : "Unspecified";
        const store = typeof req.body?.store === "string" && req.body.store.trim() ? req.body.store.trim() : "FD7";
        const owner = typeof req.body?.owner === "string" && req.body.owner.trim() ? req.body.owner.trim() : "Unassigned";
        const stage = (0, parsers_1.parseCrmStage)(req.body?.stage) ?? "New";
        const nextAction = typeof req.body?.next_action === "string" && req.body.next_action.trim()
            ? req.body.next_action.trim()
            : "First contact";
        const dueDate = (0, parsers_1.parseCrmDate)(req.body?.due_date);
        const lastMessage = typeof req.body?.last_message === "string" ? req.body.last_message.trim() : "";
        const lastTouch = typeof req.body?.last_touch === "string" ? req.body.last_touch.trim() : "";
        const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
        const sql = `
      INSERT INTO crm_leads (
        id, name, phone, channel, source, interest, budget, store, owner, stage,
        next_action, due_date, last_message, last_touch, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13, $14, $15, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        channel = EXCLUDED.channel,
        source = EXCLUDED.source,
        interest = EXCLUDED.interest,
        budget = EXCLUDED.budget,
        store = EXCLUDED.store,
        owner = EXCLUDED.owner,
        stage = EXCLUDED.stage,
        next_action = EXCLUDED.next_action,
        due_date = EXCLUDED.due_date,
        last_message = EXCLUDED.last_message,
        last_touch = EXCLUDED.last_touch,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING
        id, name, phone, channel, source, interest, budget, store, owner, stage,
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
            owner,
            stage,
            nextAction,
            dueDate,
            lastMessage,
            lastTouch,
            notes,
        ]);
        res.status(201).json({ row: mapLeadRow(r.rows[0]) });
    });
    app.patch("/api/crm/leads/:id", async (req, res) => {
        const id = (0, parsers_1.parseCrmLeadId)(req.params.id);
        if (!id)
            return res.status(400).json({ error: "invalid id" });
        const fields = [];
        const values = [];
        const textField = (name, value, fallbackEmpty = true) => {
            if (value === undefined)
                return;
            if (typeof value !== "string")
                return;
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
        textField("owner", req.body?.owner);
        textField("next_action", req.body?.next_action);
        textField("last_message", req.body?.last_message);
        textField("last_touch", req.body?.last_touch);
        textField("notes", req.body?.notes);
        if (req.body?.channel !== undefined) {
            const channel = (0, parsers_1.parseCrmChannel)(req.body?.channel);
            if (!channel)
                return res.status(400).json({ error: "invalid channel" });
            values.push(channel);
            fields.push(`channel = $${values.length}`);
        }
        if (req.body?.stage !== undefined) {
            const stage = (0, parsers_1.parseCrmStage)(req.body?.stage);
            if (!stage)
                return res.status(400).json({ error: "invalid stage" });
            values.push(stage);
            fields.push(`stage = $${values.length}`);
        }
        if (req.body?.due_date !== undefined) {
            const dueDate = req.body?.due_date === "" ? null : (0, parsers_1.parseCrmDate)(req.body?.due_date);
            if (req.body?.due_date !== "" && req.body?.due_date !== null && dueDate === null) {
                return res.status(400).json({ error: "invalid due_date" });
            }
            values.push(dueDate);
            fields.push(`due_date = $${values.length}::date`);
        }
        if (!fields.length)
            return res.status(400).json({ error: "no fields to update" });
        values.push(id);
        const sql = `
      UPDATE crm_leads
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING
        id, name, phone, channel, source, interest, budget, store, owner, stage,
        next_action, due_date, last_message, last_touch, notes, created_at, updated_at;
    `;
        const r = await pool.query(sql, values);
        if (!r.rows.length)
            return res.status(404).json({ error: "not found" });
        res.json({ row: mapLeadRow(r.rows[0]) });
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
        const id = (0, parsers_1.parseCrmLeadId)(req.body?.id) ?? `auto-${Date.now()}`;
        const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
        if (!label)
            return res.status(400).json({ error: "label is required" });
        const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
        const enabled = (0, parsers_1.parseCrmBool)(req.body?.enabled) ?? true;
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
        const id = (0, parsers_1.parseCrmLeadId)(req.params.id);
        if (!id)
            return res.status(400).json({ error: "invalid id" });
        const fields = [];
        const values = [];
        if (req.body?.label !== undefined) {
            if (typeof req.body?.label !== "string" || !req.body?.label.trim()) {
                return res.status(400).json({ error: "invalid label" });
            }
            values.push(req.body.label.trim());
            fields.push(`label = $${values.length}`);
        }
        if (req.body?.description !== undefined) {
            if (typeof req.body?.description !== "string")
                return res.status(400).json({ error: "invalid description" });
            values.push(req.body.description.trim());
            fields.push(`description = $${values.length}`);
        }
        if (req.body?.enabled !== undefined) {
            const enabled = (0, parsers_1.parseCrmBool)(req.body?.enabled);
            if (enabled === null)
                return res.status(400).json({ error: "invalid enabled value" });
            values.push(enabled);
            fields.push(`enabled = $${values.length}`);
        }
        if (!fields.length)
            return res.status(400).json({ error: "no fields to update" });
        values.push(id);
        const sql = `
      UPDATE crm_automations
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING id, label, description, enabled, created_at, updated_at;
    `;
        const r = await pool.query(sql, values);
        if (!r.rows.length)
            return res.status(404).json({ error: "not found" });
        res.json({ row: mapAutomationRow(r.rows[0]) });
    });
}
//# sourceMappingURL=crmRoutes.js.map