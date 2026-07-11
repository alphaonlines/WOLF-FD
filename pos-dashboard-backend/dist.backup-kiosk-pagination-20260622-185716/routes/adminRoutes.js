"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminRoutes = registerAdminRoutes;
const parsers_1 = require("../parsers");
const permissionCatalog_1 = require("../permissionCatalog");
const appSettings_1 = require("../appSettings");
const runtimeConfig_1 = require("../runtimeConfig");
function splitNameParts(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed)
        return { firstName: "", lastName: "" };
    const [firstName, ...rest] = trimmed.split(/\s+/);
    return {
        firstName: firstName || "",
        lastName: rest.join(" ").trim(),
    };
}
function registerAdminRoutes({ app, pool, requireOwner, normalizeRoleList, hashPassword, setUserRolesByKeys, loadAuthUserById, }) {
    const buildPermissionMap = (rows) => {
        const out = {};
        for (const entry of permissionCatalog_1.PERMISSION_CATALOG)
            out[entry.key] = false;
        for (const row of rows) {
            const key = String(row.permission_key || "");
            if (!key || !(0, permissionCatalog_1.isValidPermissionKey)(key))
                continue;
            out[key] = Boolean(row.allowed);
        }
        return out;
    };
    const loadUserPermissionState = async (userId) => {
        const [rolePermissionRows, explicitPermissionRows] = await Promise.all([
            pool.query(`
          SELECT rp.permission_key, BOOL_OR(rp.allowed) AS allowed
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id
          WHERE ur.user_id = $1
          GROUP BY rp.permission_key
          ORDER BY rp.permission_key ASC
        `, [userId]),
            pool.query(`
          SELECT permission_key, allowed
          FROM user_permissions
          WHERE user_id = $1
          ORDER BY permission_key ASC
        `, [userId]),
        ]);
        const rolePermissions = buildPermissionMap(rolePermissionRows.rows);
        const explicitPermissions = buildPermissionMap(explicitPermissionRows.rows);
        const explicitCount = explicitPermissionRows.rows.length;
        return {
            rolePermissions,
            explicitPermissions,
            explicitCount,
            permissionMode: explicitCount > 0 ? "explicit" : "role",
            effectivePermissions: explicitCount > 0 ? explicitPermissions : rolePermissions,
        };
    };
    app.get("/api/admin/auth-settings", requireOwner, async (_req, res) => {
        const settings = await (0, appSettings_1.loadGoogleWorkspaceAuthSettings)(pool, {
            googleWorkspaceEnabled: Boolean(runtimeConfig_1.GOOGLE_WORKSPACE_CLIENT_ID),
            googleClientId: runtimeConfig_1.GOOGLE_WORKSPACE_CLIENT_ID,
            googleHostedDomain: runtimeConfig_1.GOOGLE_WORKSPACE_DOMAIN,
        });
        res.json({
            ok: true,
            googleWorkspaceEnabled: settings.googleWorkspaceEnabled,
            googleClientId: settings.googleClientId,
            googleHostedDomain: settings.googleHostedDomain,
            updatedAt: settings.updatedAt,
            source: settings.source,
        });
    });
    app.patch("/api/admin/auth-settings", requireOwner, async (req, res) => {
        const next = await (0, appSettings_1.saveGoogleWorkspaceAuthSettings)(pool, {
            googleWorkspaceEnabled: Boolean(req.body?.googleWorkspaceEnabled),
            googleClientId: typeof req.body?.googleClientId === "string" ? req.body.googleClientId : "",
            googleHostedDomain: typeof req.body?.googleHostedDomain === "string" ? req.body.googleHostedDomain : "",
        }, runtimeConfig_1.GOOGLE_WORKSPACE_DOMAIN);
        res.json({
            ok: true,
            googleWorkspaceEnabled: next.googleWorkspaceEnabled,
            googleClientId: next.googleClientId,
            googleHostedDomain: next.googleHostedDomain,
            updatedAt: next.updatedAt,
            source: next.source,
        });
    });
    app.get("/api/admin/roles", requireOwner, async (_req, res) => {
        const r = await pool.query("SELECT role_key, label FROM roles ORDER BY role_key ASC");
        res.json({
            rows: r.rows.map((x) => ({
                key: String(x.role_key ?? ""),
                label: String(x.label ?? ""),
            })),
        });
    });
    app.get("/api/admin/permissions", requireOwner, async (_req, res) => {
        const rolesResult = await pool.query("SELECT id, role_key, label FROM roles ORDER BY role_key ASC");
        const permissionRows = await pool.query("SELECT role_id, permission_key, allowed FROM role_permissions ORDER BY role_id ASC, permission_key ASC");
        const catalogKeys = permissionCatalog_1.PERMISSION_CATALOG.map((entry) => entry.key);
        const byRoleId = new Map();
        for (const row of permissionRows.rows) {
            const roleId = Number(row.role_id);
            const key = String(row.permission_key || "");
            if (!Number.isFinite(roleId) || !key || !(0, permissionCatalog_1.isValidPermissionKey)(key))
                continue;
            const allowed = Boolean(row.allowed);
            const map = byRoleId.get(roleId) || {};
            map[key] = allowed;
            byRoleId.set(roleId, map);
        }
        const rows = rolesResult.rows.map((role) => {
            const roleId = Number(role.id);
            const rolePermissions = byRoleId.get(roleId) || {};
            const fullMap = {};
            for (const key of catalogKeys)
                fullMap[key] = Boolean(rolePermissions[key]);
            return {
                role_key: String(role.role_key || ""),
                label: String(role.label || role.role_key || ""),
                permissions: fullMap,
            };
        });
        res.json({
            catalog: permissionCatalog_1.PERMISSION_CATALOG,
            rows,
        });
    });
    app.patch("/api/admin/permissions/:roleKey", requireOwner, async (req, res) => {
        const roleKey = String(req.params.roleKey || "").trim();
        if (!roleKey)
            return res.status(400).json({ ok: false, error: "invalid role key" });
        const roleRow = await pool.query("SELECT id, role_key FROM roles WHERE role_key = $1 LIMIT 1", [roleKey]);
        if (!roleRow.rows.length)
            return res.status(404).json({ ok: false, error: "role not found" });
        const roleId = Number(roleRow.rows[0].id);
        if (!Number.isFinite(roleId))
            return res.status(400).json({ ok: false, error: "invalid role id" });
        const rawPermissions = req.body?.permissions;
        if (!rawPermissions || typeof rawPermissions !== "object" || Array.isArray(rawPermissions)) {
            return res.status(400).json({ ok: false, error: "permissions object is required" });
        }
        const updates = [];
        for (const [key, value] of Object.entries(rawPermissions)) {
            const permissionKey = String(key || "").trim();
            if (!permissionKey || !(0, permissionCatalog_1.isValidPermissionKey)(permissionKey))
                continue;
            updates.push({ key: permissionKey, allowed: Boolean(value) });
        }
        if (!updates.length)
            return res.status(400).json({ ok: false, error: "no valid permissions provided" });
        for (const update of updates) {
            await pool.query(`
          INSERT INTO role_permissions (role_id, permission_key, allowed, created_at, updated_at)
          VALUES ($1, $2, $3, now(), now())
          ON CONFLICT (role_id, permission_key)
          DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()
        `, [roleId, update.key, update.allowed]);
        }
        res.json({ ok: true });
    });
    app.get("/api/admin/users", requireOwner, async (_req, res) => {
        const sql = `
      SELECT
        u.id,
        u.name,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.salesperson_name,
        u.auth_provider,
        u.access_status,
        u.access_requested_at,
        u.access_approved_at,
        u.active,
        u.created_at,
        u.updated_at,
        COUNT(DISTINCT up.permission_key)::int AS explicit_permission_count,
        COALESCE(
          ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
          ARRAY[]::text[]
        ) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN user_permissions up ON up.user_id = u.id
      GROUP BY
        u.id,
        u.name,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.salesperson_name,
        u.auth_provider,
        u.access_status,
        u.access_requested_at,
        u.access_approved_at,
        u.active,
        u.created_at,
        u.updated_at
      ORDER BY lower(u.email) ASC;
    `;
        const r = await pool.query(sql);
        res.json({
            rows: r.rows.map((x) => ({
                id: Number(x.id),
                name: String(x.name ?? ""),
                first_name: String(x.first_name ?? ""),
                last_name: String(x.last_name ?? ""),
                email: String(x.email ?? ""),
                phone: typeof x.phone === "string" ? x.phone : "",
                salesperson_name: typeof x.salesperson_name === "string" ? x.salesperson_name : "",
                auth_provider: String(x.auth_provider ?? "password"),
                access_status: String(x.access_status ?? "approved"),
                access_requested_at: x.access_requested_at,
                access_approved_at: x.access_approved_at,
                explicit_permission_count: Number(x.explicit_permission_count ?? 0),
                permission_mode: Number(x.explicit_permission_count ?? 0) > 0 ? "explicit" : "role",
                active: Boolean(x.active),
                roles: normalizeRoleList(x.roles),
                created_at: x.created_at,
                updated_at: x.updated_at,
            })),
        });
    });
    app.post("/api/admin/users", requireOwner, async (req, res) => {
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        const roles = normalizeRoleList(req.body?.roles);
        const active = req.body?.active === undefined ? true : Boolean(req.body?.active);
        if (!name || !email || !password)
            return res.status(400).json({ ok: false, error: "name, email, password required" });
        if (password.length < 4)
            return res.status(400).json({ ok: false, error: "password must be at least 4 chars" });
        const roleKeys = roles.length ? roles : ["Sales"];
        const passwordHash = hashPassword(password);
        const { firstName, lastName } = splitNameParts(name);
        const r = await pool.query(`
        INSERT INTO users (name, first_name, last_name, email, password_hash, auth_provider, access_status, access_approved_at, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'password', 'approved', now(), $6, now(), now())
        RETURNING id
      `, [name, firstName || null, lastName || null, email, passwordHash, active]);
        const userId = Number(r.rows[0]?.id);
        await setUserRolesByKeys(userId, roleKeys);
        const user = await loadAuthUserById(userId);
        res.status(201).json({ ok: true, row: user ? { ...user, active } : null });
    });
    app.patch("/api/admin/users/:id", requireOwner, async (req, res) => {
        const id = (0, parsers_1.parseTaskIdParam)(req.params.id);
        if (!id)
            return res.status(400).json({ ok: false, error: "invalid id" });
        const fields = [];
        const values = [];
        if (req.body?.name !== undefined) {
            if (typeof req.body?.name !== "string" || !req.body.name.trim()) {
                return res.status(400).json({ ok: false, error: "invalid name" });
            }
            const nextName = req.body.name.trim();
            const { firstName, lastName } = splitNameParts(nextName);
            values.push(nextName);
            fields.push(`name = $${values.length}`);
            values.push(firstName || null);
            fields.push(`first_name = $${values.length}`);
            values.push(lastName || null);
            fields.push(`last_name = $${values.length}`);
        }
        if (req.body?.first_name !== undefined) {
            if (typeof req.body?.first_name !== "string") {
                return res.status(400).json({ ok: false, error: "invalid first name" });
            }
            values.push(req.body.first_name.trim() || null);
            fields.push(`first_name = $${values.length}`);
        }
        if (req.body?.last_name !== undefined) {
            if (typeof req.body?.last_name !== "string") {
                return res.status(400).json({ ok: false, error: "invalid last name" });
            }
            values.push(req.body.last_name.trim() || null);
            fields.push(`last_name = $${values.length}`);
        }
        if (req.body?.email !== undefined) {
            if (typeof req.body?.email !== "string" || !req.body.email.trim()) {
                return res.status(400).json({ ok: false, error: "invalid email" });
            }
            values.push(req.body.email.trim().toLowerCase());
            fields.push(`email = $${values.length}`);
        }
        if (req.body?.phone !== undefined) {
            if (typeof req.body?.phone !== "string") {
                return res.status(400).json({ ok: false, error: "invalid phone" });
            }
            values.push(req.body.phone.trim());
            fields.push(`phone = $${values.length}`);
        }
        if (req.body?.salesperson_name !== undefined) {
            if (typeof req.body?.salesperson_name !== "string") {
                return res.status(400).json({ ok: false, error: "invalid salesperson name" });
            }
            const salespersonName = req.body.salesperson_name.trim();
            values.push(salespersonName || null);
            fields.push(`salesperson_name = $${values.length}`);
        }
        if (req.body?.active !== undefined) {
            values.push(Boolean(req.body.active));
            fields.push(`active = $${values.length}`);
        }
        if (req.body?.access_status !== undefined) {
            const accessStatus = String(req.body.access_status || "").trim().toLowerCase();
            if (!["approved", "pending"].includes(accessStatus)) {
                return res.status(400).json({ ok: false, error: "invalid access status" });
            }
            values.push(accessStatus);
            fields.push(`access_status = $${values.length}`);
            if (accessStatus === "approved") {
                const approverId = Number(req.authUser?.id);
                fields.push(`access_approved_at = now()`);
                if (Number.isFinite(approverId)) {
                    values.push(approverId);
                    fields.push(`approved_by_user_id = $${values.length}`);
                }
                else {
                    fields.push(`approved_by_user_id = NULL`);
                }
            }
            else {
                fields.push(`access_approved_at = NULL`);
                fields.push(`approved_by_user_id = NULL`);
            }
        }
        if (!fields.length)
            return res.status(400).json({ ok: false, error: "no fields to update" });
        values.push(id);
        await pool.query(`UPDATE users SET ${fields.join(", ")}, updated_at = now() WHERE id = $${values.length}`, values);
        const user = await loadAuthUserById(id);
        if (!user) {
            const row = await pool.query("SELECT id, name, email, active FROM users WHERE id = $1 LIMIT 1", [id]);
            if (!row.rows.length)
                return res.status(404).json({ ok: false, error: "not found" });
            return res.json({
                ok: true,
                row: {
                    id: String(row.rows[0].id),
                    name: String(row.rows[0].name ?? ""),
                    email: String(row.rows[0].email ?? ""),
                    roles: [],
                    active: Boolean(row.rows[0].active),
                },
            });
        }
        const activeRow = await pool.query("SELECT active FROM users WHERE id = $1 LIMIT 1", [id]);
        res.json({ ok: true, row: { ...user, active: Boolean(activeRow.rows[0]?.active) } });
    });
    app.get("/api/admin/users/:id/permissions", requireOwner, async (req, res) => {
        const id = (0, parsers_1.parseTaskIdParam)(req.params.id);
        if (!id)
            return res.status(400).json({ ok: false, error: "invalid id" });
        const userRow = await pool.query(`
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
        WHERE u.id = $1
        GROUP BY u.id, u.name, u.email
        LIMIT 1
      `, [id]);
        if (!userRow.rows.length)
            return res.status(404).json({ ok: false, error: "not found" });
        const permissionState = await loadUserPermissionState(id);
        res.json({
            catalog: permissionCatalog_1.PERMISSION_CATALOG,
            row: {
                user_id: id,
                name: String(userRow.rows[0].name ?? ""),
                email: String(userRow.rows[0].email ?? ""),
                roles: normalizeRoleList(userRow.rows[0].roles),
                permission_mode: permissionState.permissionMode,
                explicit_permissions: permissionState.explicitPermissions,
                role_permissions: permissionState.rolePermissions,
                effective_permissions: permissionState.effectivePermissions,
                explicit_permission_count: permissionState.explicitCount,
            },
        });
    });
    app.patch("/api/admin/users/:id/permissions", requireOwner, async (req, res) => {
        const id = (0, parsers_1.parseTaskIdParam)(req.params.id);
        if (!id)
            return res.status(400).json({ ok: false, error: "invalid id" });
        const mode = String(req.body?.mode || "").trim().toLowerCase();
        if (!["role", "explicit"].includes(mode)) {
            return res.status(400).json({ ok: false, error: "mode must be role or explicit" });
        }
        const existingUser = await pool.query("SELECT id FROM users WHERE id = $1 LIMIT 1", [id]);
        if (!existingUser.rows.length)
            return res.status(404).json({ ok: false, error: "not found" });
        if (mode === "role") {
            await pool.query("DELETE FROM user_permissions WHERE user_id = $1", [id]);
            return res.json({ ok: true, mode: "role" });
        }
        const rawPermissions = req.body?.permissions;
        if (!rawPermissions || typeof rawPermissions !== "object" || Array.isArray(rawPermissions)) {
            return res.status(400).json({ ok: false, error: "permissions object is required" });
        }
        const updates = [];
        for (const entry of permissionCatalog_1.PERMISSION_CATALOG) {
            updates.push({
                key: entry.key,
                allowed: Boolean(rawPermissions[entry.key]),
            });
        }
        await pool.query("DELETE FROM user_permissions WHERE user_id = $1", [id]);
        for (const update of updates) {
            await pool.query(`
          INSERT INTO user_permissions (user_id, permission_key, allowed, created_at, updated_at)
          VALUES ($1, $2, $3, now(), now())
          ON CONFLICT (user_id, permission_key)
          DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()
        `, [id, update.key, update.allowed]);
        }
        res.json({ ok: true, mode: "explicit" });
    });
    app.patch("/api/admin/users/:id/roles", requireOwner, async (req, res) => {
        const id = (0, parsers_1.parseTaskIdParam)(req.params.id);
        if (!id)
            return res.status(400).json({ ok: false, error: "invalid id" });
        const roles = normalizeRoleList(req.body?.roles);
        if (!roles.length)
            return res.status(400).json({ ok: false, error: "at least one valid role is required" });
        await setUserRolesByKeys(id, roles);
        const row = await pool.query("SELECT active FROM users WHERE id = $1 LIMIT 1", [id]);
        if (!row.rows.length)
            return res.status(404).json({ ok: false, error: "not found" });
        const user = await loadAuthUserById(id);
        if (!user) {
            const base = await pool.query("SELECT id, name, email FROM users WHERE id = $1 LIMIT 1", [id]);
            return res.json({
                ok: true,
                row: {
                    id: String(base.rows[0]?.id ?? id),
                    name: String(base.rows[0]?.name ?? ""),
                    email: String(base.rows[0]?.email ?? ""),
                    roles,
                    active: Boolean(row.rows[0]?.active),
                },
            });
        }
        res.json({ ok: true, row: { ...user, active: Boolean(row.rows[0]?.active) } });
    });
    app.patch("/api/admin/users/:id/password", requireOwner, async (req, res) => {
        const id = (0, parsers_1.parseTaskIdParam)(req.params.id);
        if (!id)
            return res.status(400).json({ ok: false, error: "invalid id" });
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        if (!password || password.length < 4)
            return res.status(400).json({ ok: false, error: "password must be at least 4 chars" });
        const hash = hashPassword(password);
        const r = await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING id", [
            hash,
            id,
        ]);
        if (!r.rows.length)
            return res.status(404).json({ ok: false, error: "not found" });
        await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [id]).catch(() => {
            // ignore session cleanup failures
        });
        res.json({ ok: true });
    });
    app.post("/api/admin/users/:id/tutorials/reset", requireOwner, async (req, res) => {
        const id = (0, parsers_1.parseTaskIdParam)(req.params.id);
        if (!id)
            return res.status(400).json({ ok: false, error: "invalid id" });
        const userRow = await pool.query("SELECT id FROM users WHERE id = $1 LIMIT 1", [id]);
        if (!userRow.rows.length)
            return res.status(404).json({ ok: false, error: "not found" });
        await pool.query(`
        UPDATE users
        SET tutorial_completed_at = NULL,
            tutorial_reset_at = now(),
            updated_at = now()
        WHERE id = $1
      `, [id]);
        await pool.query(`
        INSERT INTO botbot_settings (user_id, tutorial_completed, created_at, updated_at)
        VALUES ($1, false, now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET tutorial_completed = false, updated_at = now()
      `, [id]);
        await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [id]).catch(() => {
            // The next login should pick up the reset token, but don't fail the reset if cleanup has an issue.
        });
        res.json({ ok: true });
    });
}
//# sourceMappingURL=adminRoutes.js.map