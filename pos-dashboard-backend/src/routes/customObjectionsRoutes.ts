import type { Express } from "express";
import type { Pool } from "pg";

function mapCustomObjectionRow(row: any) {
  return {
    id: Number(row.id),
    objection_id: row.objection_id,
    label: row.label,
    rebuttals: typeof row.rebuttals === "object" ? row.rebuttals : [],
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active === true || row.is_active === "true",
    source: row.source,
    created_at: row.created_at,
  };
}

export function registerCustomObjectionsRoutes(app: Express, pool: Pool) {
  // GET all custom objections
  app.get("/api/custom-objections", async (_req, res) => {
    const sql = `
      SELECT id, objection_id, label, rebuttals, sort_order, is_active, source, created_at
      FROM custom_objections
      WHERE is_active = true
      ORDER BY sort_order ASC, id ASC;
    `;
    const r = await pool.query(sql);
    res.json({ rows: r.rows.map(mapCustomObjectionRow) });
  });

  // POST create new custom objection
  app.post("/api/custom-objections", async (req, res) => {
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (!label) return res.status(400).json({ error: "label is required" });

    const rebuttals = Array.isArray(req.body?.rebuttals) ? req.body.rebuttals : [];
    const objection_id = typeof req.body?.objection_id === "string" ? req.body.objection_id.trim() : `custom-${Date.now()}`;
    const sortOrder = typeof req.body?.sort_order === "number" ? req.body.sort_order : 0;

    const sql = `
      INSERT INTO custom_objections (objection_id, label, rebuttals, sort_order, is_active, source, created_at)
      VALUES ($1, $2, $3::jsonb, $4, true, 'user', now())
      RETURNING id, objection_id, label, rebuttals, sort_order, is_active, source, created_at;
    `;
    const r = await pool.query(sql, [objection_id, label, JSON.stringify(rebuttals), sortOrder]);
    res.status(201).json({ row: mapCustomObjectionRow(r.rows[0]) });
  });

  // PATCH update custom objection
  app.patch("/api/custom-objections/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const fields: string[] = [];
    const values: any[] = [];

    const label = typeof req.body?.label === "string" ? req.body.label.trim() : null;
    if (label !== null) {
      if (!label) return res.status(400).json({ error: "label cannot be empty" });
      values.push(label);
      fields.push(`label = $${values.length}`);
    }

    const rebuttals = req.body?.rebuttals;
    if (rebuttals !== undefined) {
      values.push(JSON.stringify(rebuttals));
      fields.push(`rebuttals = $${values.length}::jsonb`);
    }

    const sort_order = typeof req.body?.sort_order === "number" ? req.body.sort_order : null;
    if (sort_order !== null) {
      values.push(sort_order);
      fields.push(`sort_order = $${values.length}`);
    }

    const is_active = typeof req.body?.is_active === "boolean" ? req.body.is_active : null;
    if (is_active !== null) {
      values.push(is_active);
      fields.push(`is_active = $${values.length}`);
    }

    if (!fields.length) return res.status(400).json({ error: "no fields to update" });

    values.push(id);
    const sql = `
      UPDATE custom_objections
      SET ${fields.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, objection_id, label, rebuttals, sort_order, is_active, source, created_at;
    `;
    const r = await pool.query(sql, values);
    if (!r.rows.length) return res.status(404).json({ error: "not found" });

    res.json({ row: mapCustomObjectionRow(r.rows[0]) });
  });

  // DELETE custom objection (soft delete - set is_active = false)
  app.delete("/api/custom-objections/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const sql = `
      UPDATE custom_objections
      SET is_active = false
      WHERE id = $1
      RETURNING id;
    `;
    const r = await pool.query(sql, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "not found" });

    res.json({ success: true });
  });
}
