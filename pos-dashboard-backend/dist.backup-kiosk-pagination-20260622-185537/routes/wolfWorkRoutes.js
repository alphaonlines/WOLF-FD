"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWolfWorkRoutes = registerWolfWorkRoutes;
const runtimeConfig_1 = require("../runtimeConfig");
const GOAL_STATUSES = new Set(["active", "paused", "done", "archived"]);
const GOAL_PRIORITIES = new Set(["low", "medium", "high"]);
const MEMORY_TYPES = new Set(["note", "transcript", "summary", "decision", "blocker", "question"]);
const ACTION_TYPES = new Set(["create_task", "create_memory"]);
const ACTION_STATUSES = new Set(["pending", "approved", "rejected", "completed", "failed"]);
function authUserFromReq(req) {
    const user = req.authUser;
    return user?.id ? user : null;
}
function numericUserId(user) {
    const value = Number(user?.id);
    return Number.isFinite(value) ? value : null;
}
function isManager(user) {
    const roles = new Set((user?.roles || []).map((role) => String(role)));
    return roles.has("Owner") || roles.has("Manager");
}
function canUseWolfWork(user) {
    if (!user)
        return false;
    if (isManager(user))
        return true;
    const permissions = new Set((user.permissions || []).map((permission) => String(permission)));
    return permissions.has("module.wolf_work");
}
function requireWolfWork(req, res) {
    const user = authUserFromReq(req);
    if (!user) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return null;
    }
    if (!canUseWolfWork(user)) {
        res.status(403).json({ ok: false, error: "forbidden" });
        return null;
    }
    return user;
}
function text(raw, fallback = "", max = 4000) {
    const value = typeof raw === "string" ? raw.trim() : "";
    return (value || fallback).slice(0, max);
}
function jsonObject(raw) {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function stringList(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 24);
}
function normalizeGoalStatus(raw) {
    const value = text(raw, "active", 40);
    return GOAL_STATUSES.has(value) ? value : "active";
}
function normalizePriority(raw) {
    const value = text(raw, "medium", 40);
    return GOAL_PRIORITIES.has(value) ? value : "medium";
}
function normalizeMemoryType(raw) {
    const value = text(raw, "note", 40);
    return MEMORY_TYPES.has(value) ? value : "note";
}
function normalizeActionType(raw) {
    const value = text(raw, "create_task", 60);
    return ACTION_TYPES.has(value) ? value : "create_task";
}
function normalizeActionStatus(raw) {
    const value = text(raw, "pending", 60);
    return ACTION_STATUSES.has(value) ? value : "pending";
}
function mapGoal(row) {
    return {
        id: String(row.id),
        ownerUserId: row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
        title: String(row.title || ""),
        description: String(row.description || ""),
        status: String(row.status || "active"),
        priority: String(row.priority || "medium"),
        dueDate: row.due_date ? String(row.due_date).slice(0, 10) : "",
        assignedAgent: String(row.assigned_agent || ""),
        meta: typeof row.meta_json === "object" && row.meta_json ? row.meta_json : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapMemory(row) {
    return {
        id: String(row.id),
        ownerUserId: row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
        goalId: row.goal_id === null || row.goal_id === undefined ? null : String(row.goal_id),
        sourceType: String(row.source_type || "note"),
        sourceId: row.source_id === null || row.source_id === undefined ? null : String(row.source_id),
        title: String(row.title || ""),
        body: String(row.body || ""),
        tags: stringList(row.tags),
        pinned: Boolean(row.pinned),
        meta: typeof row.meta_json === "object" && row.meta_json ? row.meta_json : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapAgentAction(row) {
    return {
        id: String(row.id),
        ownerUserId: row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
        goalId: row.goal_id === null || row.goal_id === undefined ? null : String(row.goal_id),
        agentKey: String(row.agent_key || ""),
        agentName: String(row.agent_name || ""),
        actionType: String(row.action_type || "create_task"),
        title: String(row.title || ""),
        rationale: String(row.rationale || ""),
        payload: typeof row.payload_json === "object" && row.payload_json ? row.payload_json : {},
        status: String(row.status || "pending"),
        resultRefType: row.result_ref_type ? String(row.result_ref_type) : "",
        resultRefId: row.result_ref_id ? String(row.result_ref_id) : "",
        errorMessage: row.error_message ? String(row.error_message) : "",
        approvedByUserId: row.approved_by_user_id === null || row.approved_by_user_id === undefined ? null : String(row.approved_by_user_id),
        decidedAt: row.decided_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapRecording(row) {
    return {
        id: String(row.id),
        title: String(row.title || ""),
        status: String(row.status || ""),
        durationSec: Number(row.duration_sec || 0),
        transcriptText: String(row.transcript_text || ""),
        summary: typeof row.summary_json === "object" && row.summary_json ? row.summary_json : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
async function event(pool, eventType, message, meta = {}, userId = null) {
    await pool
        .query(`
        INSERT INTO wolf_work_events (event_type, message, meta_json, actor_user_id, created_at)
        VALUES ($1, $2, $3::jsonb, $4, now())
      `, [eventType, message.slice(0, 1000), jsonObject(meta), userId])
        .catch(() => undefined);
}
async function reachable(url, timeoutMs = 900) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: ctrl.signal });
        return response.ok;
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(timer);
    }
}
function taskPayloadFromAction(payload, fallbackTitle) {
    const safe = jsonObject(payload);
    return {
        title: text(safe.title, fallbackTitle, 240),
        assignee: text(safe.assignee, "Unassigned", 120),
        status: text(safe.status, "TODO", 40),
        priority: normalizePriority(safe.priority),
        deadline: text(safe.deadline, "", 20) || null,
        taskType: text(safe.taskType ?? safe.task_type, "wolf_work", 80),
        taskMeta: {
            source: "wolf_work_agent_action",
            wolfWork: jsonObject(safe.taskMeta ?? safe.task_meta),
        },
    };
}
function memoryPayloadFromAction(payload, fallbackTitle) {
    const safe = jsonObject(payload);
    return {
        title: text(safe.title, fallbackTitle, 240),
        body: text(safe.body, "", 20000),
        sourceType: normalizeMemoryType(safe.sourceType ?? safe.source_type),
        tags: stringList(safe.tags),
        pinned: Boolean(safe.pinned),
        meta: jsonObject(safe.meta),
    };
}
function registerWolfWorkRoutes({ app, pool }) {
    app.get("/api/wolf-work/overview", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const [goals, memory, actions, tasks, recordings] = await Promise.all([
            pool.query(`SELECT * FROM wolf_work_goals WHERE status <> 'archived' ORDER BY updated_at DESC, id DESC LIMIT 12`),
            pool.query(`SELECT * FROM wolf_work_memory WHERE archived_at IS NULL ORDER BY pinned DESC, updated_at DESC, id DESC LIMIT 12`),
            pool.query(`SELECT * FROM wolf_work_agent_actions ORDER BY created_at DESC, id DESC LIMIT 20`),
            pool.query(`
        SELECT status, count(*)::int AS count
        FROM tasks
        WHERE COALESCE(task_type, '') <> 'archived'
        GROUP BY status
      `),
            pool.query(`SELECT * FROM den_recordings ORDER BY created_at DESC LIMIT 8`).catch(() => ({ rows: [] })),
        ]);
        const [whisperReachable, primaryOllamaReachable] = await Promise.all([
            reachable(runtimeConfig_1.MEETILY_WHISPER_BASE_URL.replace(/\/+$/, "/")),
            reachable(`${runtimeConfig_1.OLLAMA_NODE_CONFIGS[0].baseUrl.replace(/\/+$/, "")}/api/tags`),
        ]);
        res.json({
            ok: true,
            goals: goals.rows.map(mapGoal),
            memory: memory.rows.map(mapMemory),
            agentActions: actions.rows.map(mapAgentAction),
            taskStats: tasks.rows.map((row) => ({ status: String(row.status || ""), count: Number(row.count || 0) })),
            recordings: recordings.rows.map(mapRecording),
            integrations: [
                {
                    key: "alphahs2",
                    label: "AlphaHS2",
                    status: "online",
                    detail: "WOLF backend and Postgres system of record",
                },
                {
                    key: "meetily-whisper",
                    label: "Meetily Whisper",
                    status: whisperReachable ? "online" : "offline",
                    detail: runtimeConfig_1.MEETILY_WHISPER_BASE_URL,
                },
                {
                    key: "ollama-primary",
                    label: runtimeConfig_1.OLLAMA_NODE_CONFIGS[0].host,
                    status: primaryOllamaReachable ? "online" : "offline",
                    detail: runtimeConfig_1.OLLAMA_NODE_CONFIGS[0].baseUrl,
                },
            ],
        });
    });
    app.get("/api/wolf-work/goals", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const result = await pool.query(`SELECT * FROM wolf_work_goals ORDER BY status ASC, updated_at DESC, id DESC`);
        res.json({ ok: true, rows: result.rows.map(mapGoal) });
    });
    app.post("/api/wolf-work/goals", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const userId = numericUserId(user);
        const title = text(req.body?.title, "", 240);
        if (!title)
            return res.status(400).json({ ok: false, error: "title_required" });
        const result = await pool.query(`
        INSERT INTO wolf_work_goals (owner_user_id, title, description, status, priority, due_date, assigned_agent, meta_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, $7, $8::jsonb, now(), now())
        RETURNING *
      `, [
            userId,
            title,
            text(req.body?.description, "", 6000),
            normalizeGoalStatus(req.body?.status),
            normalizePriority(req.body?.priority),
            text(req.body?.dueDate ?? req.body?.due_date, "", 20),
            text(req.body?.assignedAgent ?? req.body?.assigned_agent, "", 120),
            jsonObject(req.body?.meta),
        ]);
        await event(pool, "goal_created", title, { goalId: result.rows[0].id }, userId);
        res.status(201).json({ ok: true, row: mapGoal(result.rows[0]) });
    });
    app.patch("/api/wolf-work/goals/:id", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const result = await pool.query(`
        UPDATE wolf_work_goals
        SET title = COALESCE(NULLIF($2, ''), title),
            description = CASE WHEN $3::boolean THEN $4 ELSE description END,
            status = COALESCE(NULLIF($5, ''), status),
            priority = COALESCE(NULLIF($6, ''), priority),
            due_date = CASE WHEN $7::boolean THEN NULLIF($8, '')::date ELSE due_date END,
            assigned_agent = CASE WHEN $9::boolean THEN $10 ELSE assigned_agent END,
            meta_json = CASE WHEN $11::boolean THEN $12::jsonb ELSE meta_json END,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `, [
            req.params.id,
            text(req.body?.title, "", 240),
            req.body?.description !== undefined,
            text(req.body?.description, "", 6000),
            req.body?.status !== undefined ? normalizeGoalStatus(req.body?.status) : "",
            req.body?.priority !== undefined ? normalizePriority(req.body?.priority) : "",
            req.body?.dueDate !== undefined || req.body?.due_date !== undefined,
            text(req.body?.dueDate ?? req.body?.due_date, "", 20),
            req.body?.assignedAgent !== undefined || req.body?.assigned_agent !== undefined,
            text(req.body?.assignedAgent ?? req.body?.assigned_agent, "", 120),
            req.body?.meta !== undefined,
            jsonObject(req.body?.meta),
        ]);
        if (!result.rows.length)
            return res.status(404).json({ ok: false, error: "not_found" });
        await event(pool, "goal_updated", `Goal updated: ${result.rows[0].title}`, { goalId: req.params.id }, numericUserId(user));
        res.json({ ok: true, row: mapGoal(result.rows[0]) });
    });
    app.get("/api/wolf-work/memory", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const q = text(req.query?.q, "", 200);
        const values = [];
        let where = "WHERE archived_at IS NULL";
        if (q) {
            values.push(`%${q}%`);
            where += ` AND (title ILIKE $${values.length} OR body ILIKE $${values.length} OR tags::text ILIKE $${values.length})`;
        }
        const result = await pool.query(`SELECT * FROM wolf_work_memory ${where} ORDER BY pinned DESC, updated_at DESC, id DESC LIMIT 100`, values);
        res.json({ ok: true, rows: result.rows.map(mapMemory) });
    });
    app.post("/api/wolf-work/memory", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const userId = numericUserId(user);
        const title = text(req.body?.title, "", 240);
        const body = text(req.body?.body, "", 20000);
        if (!title && !body)
            return res.status(400).json({ ok: false, error: "memory_required" });
        const result = await pool.query(`
        INSERT INTO wolf_work_memory (owner_user_id, goal_id, source_type, source_id, title, body, tags, pinned, meta_json, created_at, updated_at)
        VALUES ($1, NULLIF($2, '')::uuid, $3, $4, $5, $6, $7::text[], $8, $9::jsonb, now(), now())
        RETURNING *
      `, [
            userId,
            text(req.body?.goalId ?? req.body?.goal_id, "", 80),
            normalizeMemoryType(req.body?.sourceType ?? req.body?.source_type),
            text(req.body?.sourceId ?? req.body?.source_id, "", 120),
            title || "Untitled memory",
            body,
            stringList(req.body?.tags),
            Boolean(req.body?.pinned),
            jsonObject(req.body?.meta),
        ]);
        if (req.body?.proposeTask) {
            await pool.query(`
          INSERT INTO wolf_work_agent_actions (owner_user_id, goal_id, agent_key, agent_name, action_type, title, rationale, payload_json, status, created_at, updated_at)
          VALUES ($1, NULLIF($2, '')::uuid, 'wolf-memory', 'Wolf Memory', 'create_task', $3, $4, $5::jsonb, 'pending', now(), now())
        `, [
                userId,
                text(req.body?.goalId ?? req.body?.goal_id, "", 80),
                `Follow up: ${title || "memory note"}`.slice(0, 240),
                "Created from a Wolf Work memory note and waiting for human approval.",
                {
                    title: `Follow up: ${title || "memory note"}`.slice(0, 240),
                    priority: "medium",
                    taskMeta: { memoryId: String(result.rows[0].id) },
                },
            ]);
        }
        await event(pool, "memory_created", title || "Memory created", { memoryId: result.rows[0].id }, userId);
        res.status(201).json({ ok: true, row: mapMemory(result.rows[0]) });
    });
    app.patch("/api/wolf-work/memory/:id", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const result = await pool.query(`
        UPDATE wolf_work_memory
        SET title = COALESCE(NULLIF($2, ''), title),
            body = CASE WHEN $3::boolean THEN $4 ELSE body END,
            source_type = COALESCE(NULLIF($5, ''), source_type),
            tags = CASE WHEN $6::boolean THEN $7::text[] ELSE tags END,
            pinned = CASE WHEN $8::boolean THEN $9 ELSE pinned END,
            meta_json = CASE WHEN $10::boolean THEN $11::jsonb ELSE meta_json END,
            updated_at = now()
        WHERE id = $1 AND archived_at IS NULL
        RETURNING *
      `, [
            req.params.id,
            text(req.body?.title, "", 240),
            req.body?.body !== undefined,
            text(req.body?.body, "", 20000),
            req.body?.sourceType !== undefined || req.body?.source_type !== undefined
                ? normalizeMemoryType(req.body?.sourceType ?? req.body?.source_type)
                : "",
            req.body?.tags !== undefined,
            stringList(req.body?.tags),
            req.body?.pinned !== undefined,
            Boolean(req.body?.pinned),
            req.body?.meta !== undefined,
            jsonObject(req.body?.meta),
        ]);
        if (!result.rows.length)
            return res.status(404).json({ ok: false, error: "not_found" });
        res.json({ ok: true, row: mapMemory(result.rows[0]) });
    });
    app.delete("/api/wolf-work/memory/:id", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const result = await pool.query(`UPDATE wolf_work_memory SET archived_at = now(), updated_at = now() WHERE id = $1 AND archived_at IS NULL RETURNING id`, [req.params.id]);
        if (!result.rows.length)
            return res.status(404).json({ ok: false, error: "not_found" });
        await event(pool, "memory_archived", "Memory archived", { memoryId: req.params.id }, numericUserId(user));
        res.json({ ok: true });
    });
    app.get("/api/wolf-work/agent-actions", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const status = req.query?.status !== undefined ? normalizeActionStatus(req.query.status) : "";
        const values = [];
        const where = status ? "WHERE status = $1" : "";
        if (status)
            values.push(status);
        const result = await pool.query(`SELECT * FROM wolf_work_agent_actions ${where} ORDER BY created_at DESC, id DESC LIMIT 100`, values);
        res.json({ ok: true, rows: result.rows.map(mapAgentAction) });
    });
    app.post("/api/wolf-work/agent-actions", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const userId = numericUserId(user);
        const title = text(req.body?.title, "", 240);
        if (!title)
            return res.status(400).json({ ok: false, error: "title_required" });
        const result = await pool.query(`
        INSERT INTO wolf_work_agent_actions (owner_user_id, goal_id, agent_key, agent_name, action_type, title, rationale, payload_json, status, created_at, updated_at)
        VALUES ($1, NULLIF($2, '')::uuid, $3, $4, $5, $6, $7, $8::jsonb, 'pending', now(), now())
        RETURNING *
      `, [
            userId,
            text(req.body?.goalId ?? req.body?.goal_id, "", 80),
            text(req.body?.agentKey ?? req.body?.agent_key, "wolf-work", 80),
            text(req.body?.agentName ?? req.body?.agent_name, "Wolf Work", 120),
            normalizeActionType(req.body?.actionType ?? req.body?.action_type),
            title,
            text(req.body?.rationale, "", 2000),
            jsonObject(req.body?.payload),
        ]);
        await event(pool, "agent_action_created", title, { actionId: result.rows[0].id }, userId);
        res.status(201).json({ ok: true, row: mapAgentAction(result.rows[0]) });
    });
    app.patch("/api/wolf-work/agent-actions/:id", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const result = await pool.query(`
        UPDATE wolf_work_agent_actions
        SET title = COALESCE(NULLIF($2, ''), title),
            rationale = CASE WHEN $3::boolean THEN $4 ELSE rationale END,
            payload_json = CASE WHEN $5::boolean THEN $6::jsonb ELSE payload_json END,
            status = CASE WHEN $7::boolean THEN $8 ELSE status END,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `, [
            req.params.id,
            text(req.body?.title, "", 240),
            req.body?.rationale !== undefined,
            text(req.body?.rationale, "", 2000),
            req.body?.payload !== undefined,
            jsonObject(req.body?.payload),
            req.body?.status !== undefined,
            normalizeActionStatus(req.body?.status),
        ]);
        if (!result.rows.length)
            return res.status(404).json({ ok: false, error: "not_found" });
        res.json({ ok: true, row: mapAgentAction(result.rows[0]) });
    });
    app.post("/api/wolf-work/agent-actions/:id/approve", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const userId = numericUserId(user);
        const actionResult = await pool.query(`SELECT * FROM wolf_work_agent_actions WHERE id = $1`, [req.params.id]);
        const action = actionResult.rows[0];
        if (!action)
            return res.status(404).json({ ok: false, error: "not_found" });
        if (action.status !== "pending")
            return res.status(409).json({ ok: false, error: "not_pending" });
        try {
            let refType = "";
            let refId = "";
            if (action.action_type === "create_task") {
                const payload = taskPayloadFromAction(action.payload_json, action.title);
                const sortResult = await pool.query("SELECT COALESCE(MAX(sort_index), -1) + 1 AS next FROM tasks WHERE status = $1", [
                    payload.status,
                ]);
                const created = await pool.query(`
            INSERT INTO tasks (title, assignee, status, priority, deadline, sort_index, task_type, task_meta, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8::jsonb, now(), now())
            RETURNING id
          `, [
                    payload.title,
                    payload.assignee,
                    payload.status,
                    payload.priority,
                    payload.deadline,
                    Number(sortResult.rows[0]?.next || 0),
                    payload.taskType,
                    { ...payload.taskMeta, agentActionId: String(action.id), goalId: action.goal_id ? String(action.goal_id) : null },
                ]);
                refType = "task";
                refId = String(created.rows[0].id);
            }
            else if (action.action_type === "create_memory") {
                const payload = memoryPayloadFromAction(action.payload_json, action.title);
                const created = await pool.query(`
            INSERT INTO wolf_work_memory (owner_user_id, goal_id, source_type, source_id, title, body, tags, pinned, meta_json, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9::jsonb, now(), now())
            RETURNING id
          `, [
                    userId,
                    action.goal_id,
                    payload.sourceType,
                    String(action.id),
                    payload.title,
                    payload.body,
                    payload.tags,
                    payload.pinned,
                    { ...payload.meta, agentActionId: String(action.id) },
                ]);
                refType = "memory";
                refId = String(created.rows[0].id);
            }
            const updated = await pool.query(`
          UPDATE wolf_work_agent_actions
          SET status = 'completed',
              approved_by_user_id = $2,
              decided_at = now(),
              result_ref_type = $3,
              result_ref_id = $4,
              error_message = NULL,
              updated_at = now()
          WHERE id = $1
          RETURNING *
        `, [req.params.id, userId, refType, refId]);
            await event(pool, "agent_action_approved", action.title, { actionId: req.params.id, refType, refId }, userId);
            res.json({ ok: true, row: mapAgentAction(updated.rows[0]) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const updated = await pool.query(`UPDATE wolf_work_agent_actions SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1 RETURNING *`, [req.params.id, message.slice(0, 1000)]);
            res.status(500).json({ ok: false, error: "approval_failed", row: updated.rows[0] ? mapAgentAction(updated.rows[0]) : null });
        }
    });
    app.post("/api/wolf-work/agent-actions/:id/reject", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const userId = numericUserId(user);
        const result = await pool.query(`
        UPDATE wolf_work_agent_actions
        SET status = 'rejected',
            approved_by_user_id = $2,
            decided_at = now(),
            error_message = $3,
            updated_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `, [req.params.id, userId, text(req.body?.reason, "", 1000)]);
        if (!result.rows.length)
            return res.status(404).json({ ok: false, error: "not_found_or_not_pending" });
        await event(pool, "agent_action_rejected", result.rows[0].title, { actionId: req.params.id }, userId);
        res.json({ ok: true, row: mapAgentAction(result.rows[0]) });
    });
    app.post("/api/wolf-work/recordings/:id/import", async (req, res) => {
        const user = requireWolfWork(req, res);
        if (!user)
            return;
        const userId = numericUserId(user);
        const recordingResult = await pool.query(`SELECT * FROM den_recordings WHERE id = $1`, [req.params.id]);
        const recording = recordingResult.rows[0];
        if (!recording)
            return res.status(404).json({ ok: false, error: "recording_not_found" });
        const title = text(req.body?.title, `Recording: ${recording.title || req.params.id}`, 240);
        const summary = jsonObject(recording.summary_json);
        const cleanSummary = text(summary.cleanSummary, "", 6000);
        const transcript = text(recording.transcript_text, "", 20000);
        const bodyParts = [
            cleanSummary ? `Summary:\n${cleanSummary}` : "",
            transcript ? `Transcript:\n${transcript}` : "",
        ].filter(Boolean);
        const memory = await pool.query(`
        INSERT INTO wolf_work_memory (owner_user_id, source_type, source_id, title, body, tags, pinned, meta_json, created_at, updated_at)
        VALUES ($1, 'transcript', $2, $3, $4, $5::text[], $6, $7::jsonb, now(), now())
        RETURNING *
      `, [
            userId,
            String(recording.id),
            title,
            bodyParts.join("\n\n") || "Recording imported before transcript text was available.",
            stringList(req.body?.tags).length ? stringList(req.body?.tags) : ["recorder", "transcript"],
            Boolean(req.body?.pinned),
            { recordingId: String(recording.id), status: String(recording.status || "") },
        ]);
        const actionItems = stringList(summary.actionItems ?? summary.action_items);
        for (const item of actionItems.slice(0, 8)) {
            await pool.query(`
          INSERT INTO wolf_work_agent_actions (owner_user_id, agent_key, agent_name, action_type, title, rationale, payload_json, status, created_at, updated_at)
          VALUES ($1, 'wolf-recorder', 'Wolf Recorder', 'create_task', $2, $3, $4::jsonb, 'pending', now(), now())
        `, [
                userId,
                item.slice(0, 240),
                "Action item extracted from an imported recorder transcript. Human approval is required before it becomes a Kanban task.",
                {
                    title: item.slice(0, 240),
                    priority: "medium",
                    taskMeta: { recordingId: String(recording.id), memoryId: String(memory.rows[0].id) },
                },
            ]);
        }
        await event(pool, "recording_imported", title, { recordingId: req.params.id, memoryId: memory.rows[0].id }, userId);
        res.status(201).json({ ok: true, row: mapMemory(memory.rows[0]), proposedActions: actionItems.length });
    });
}
//# sourceMappingURL=wolfWorkRoutes.js.map