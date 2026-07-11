"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTaskRoutes = registerTaskRoutes;
const parsers_1 = require("../parsers");
function mapTaskRow(row) {
    return {
        id: Number(row.id),
        title: row.title,
        assignee: row.assignee,
        status: row.status,
        priority: row.priority,
        deadline: row.deadline ? String(row.deadline).slice(0, 10) : null,
        sort_index: Number(row.sort_index ?? 0),
        task_type: row.task_type,
        task_meta: typeof row.task_meta === "object" ? row.task_meta : null,
        responded_at: row.responded_at,
        completed_at: row.completed_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
function registerTaskRoutes(app, pool) {
    app.get("/api/tasks", async (_req, res) => {
        const sql = `
      SELECT
        id,
        title,
        assignee,
        status,
        priority,
        deadline,
        sort_index,
        task_type,
        task_meta,
        responded_at,
        completed_at,
        created_at,
        updated_at
      FROM tasks
      ORDER BY status ASC, sort_index ASC, id ASC;
    `;
        const r = await pool.query(sql);
        res.json({ rows: r.rows.map(mapTaskRow) });
    });
    app.post("/api/tasks", async (req, res) => {
        const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
        if (!title)
            return res.status(400).json({ error: "title is required" });
        const assignee = typeof req.body?.assignee === "string" && req.body.assignee.trim() ? req.body.assignee.trim() : "Unassigned";
        const status = (0, parsers_1.parseTaskStatus)(req.body?.status) ?? "TODO";
        const priority = (0, parsers_1.parseTaskPriority)(req.body?.priority) ?? "medium";
        const deadline = (0, parsers_1.parseTaskDeadline)(req.body?.deadline);
        const sortIndexExplicit = (0, parsers_1.parseIntBody)(req.body?.sort_index);
        const taskType = typeof req.body?.task_type === "string" && req.body.task_type.trim() ? req.body.task_type.trim() : null;
        const taskMeta = req.body?.task_meta !== undefined && req.body?.task_meta !== null ? req.body.task_meta : {};
        const respondedAt = status === "IN_PROGRESS" ? new Date().toISOString() : null;
        const completedAt = status === "DONE" ? new Date().toISOString() : null;
        const sortIndex = sortIndexExplicit !== null
            ? sortIndexExplicit
            : (await pool.query("SELECT COALESCE(MAX(sort_index), -1) + 1 AS next FROM tasks WHERE status = $1", [status])).rows[0]?.next ?? 0;
        const sql = `
      INSERT INTO tasks (title, assignee, status, priority, deadline, sort_index, task_type, task_meta, responded_at, completed_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8::jsonb, $9::timestamptz, $10::timestamptz, now(), now())
      RETURNING id, title, assignee, status, priority, deadline, sort_index, task_type, task_meta, responded_at, completed_at, created_at, updated_at;
    `;
        const r = await pool.query(sql, [title, assignee, status, priority, deadline, sortIndex, taskType, taskMeta, respondedAt, completedAt]);
        res.status(201).json({ row: mapTaskRow(r.rows[0]) });
    });
    app.patch("/api/tasks/:id", async (req, res) => {
        const id = (0, parsers_1.parseTaskIdParam)(req.params.id);
        if (!id)
            return res.status(400).json({ error: "invalid id" });
        const fields = [];
        const values = [];
        const title = typeof req.body?.title === "string" ? req.body.title.trim() : null;
        if (title !== null) {
            if (!title)
                return res.status(400).json({ error: "title cannot be empty" });
            values.push(title);
            fields.push(`title = $${values.length}`);
        }
        const assignee = typeof req.body?.assignee === "string" ? req.body.assignee.trim() : null;
        if (assignee !== null) {
            values.push(assignee || "Unassigned");
            fields.push(`assignee = $${values.length}`);
        }
        const status = req.body?.status !== undefined ? (0, parsers_1.parseTaskStatus)(req.body?.status) : null;
        if (status !== null) {
            values.push(status);
            fields.push(`status = $${values.length}`);
        }
        const priority = req.body?.priority !== undefined ? (0, parsers_1.parseTaskPriority)(req.body?.priority) : null;
        if (priority !== null) {
            values.push(priority);
            fields.push(`priority = $${values.length}`);
        }
        const deadline = req.body?.deadline !== undefined ? (req.body?.deadline === "" ? null : (0, parsers_1.parseTaskDeadline)(req.body?.deadline)) : null;
        if (req.body?.deadline !== undefined) {
            if (req.body?.deadline !== "" && deadline === null)
                return res.status(400).json({ error: "invalid deadline" });
            values.push(deadline);
            fields.push(`deadline = $${values.length}::date`);
        }
        const sortIndex = req.body?.sort_index !== undefined ? (0, parsers_1.parseIntBody)(req.body?.sort_index) : null;
        if (sortIndex !== null) {
            values.push(sortIndex);
            fields.push(`sort_index = $${values.length}`);
        }
        const taskType = req.body?.task_type !== undefined
            ? (typeof req.body.task_type === "string" && req.body.task_type.trim() ? req.body.task_type.trim() : null)
            : null;
        if (taskType !== null || req.body?.task_type === null) {
            values.push(taskType);
            fields.push(`task_type = $${values.length}`);
        }
        const taskMeta = req.body?.task_meta !== undefined
            ? (req.body.task_meta === null ? null : req.body.task_meta)
            : null;
        if (taskMeta !== null || req.body?.task_meta === null) {
            values.push(taskMeta);
            fields.push(`task_meta = $${values.length}::jsonb`);
        }
        if (!fields.length)
            return res.status(400).json({ error: "no fields to update" });
        if (status === "IN_PROGRESS") {
            fields.push(`responded_at = COALESCE(responded_at, now())`);
        }
        if (status === "DONE") {
            fields.push(`completed_at = now()`);
        }
        else if (status === "TODO" || status === "IN_PROGRESS") {
            // If a task is re-opened, clear completion timestamp.
            fields.push(`completed_at = NULL`);
        }
        values.push(id);
        const sql = `
      UPDATE tasks
      SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING id, title, assignee, status, priority, deadline, sort_index, task_type, task_meta, responded_at, completed_at, created_at, updated_at;
    `;
        const r = await pool.query(sql, values);
        if (!r.rows.length)
            return res.status(404).json({ error: "not found" });
        res.json({ row: mapTaskRow(r.rows[0]) });
    });
}
//# sourceMappingURL=tasksRoutes.js.map