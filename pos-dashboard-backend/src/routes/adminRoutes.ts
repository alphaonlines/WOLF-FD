import type { Express } from "express";
import type { Pool } from "pg";
import { parseTaskIdParam } from "../parsers";
import { PERMISSION_CATALOG, isValidPermissionKey } from "../permissionCatalog";

type AuthUserLike = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

type AdminRoutesDeps = {
  app: Express;
  pool: Pool;
  requireOwner: (req: any, res: any, next: any) => any;
  normalizeRoleList: (raw: any) => string[];
  hashPassword: (password: string) => string;
  setUserRolesByKeys: (userId: number, roleKeys: string[]) => Promise<void>;
  loadAuthUserById: (userId: number) => Promise<AuthUserLike | null>;
};

export function registerAdminRoutes({
  app,
  pool,
  requireOwner,
  normalizeRoleList,
  hashPassword,
  setUserRolesByKeys,
  loadAuthUserById,
}: AdminRoutesDeps) {
  app.get("/api/admin/roles", requireOwner, async (_req, res) => {
    const r = await pool.query("SELECT role_key, label FROM roles ORDER BY role_key ASC");
    res.json({
      rows: r.rows.map((x: any) => ({
        key: String(x.role_key ?? ""),
        label: String(x.label ?? ""),
      })),
    });
  });

  app.get("/api/admin/permissions", requireOwner, async (_req, res) => {
    const rolesResult = await pool.query("SELECT id, role_key, label FROM roles ORDER BY role_key ASC");
    const permissionRows = await pool.query(
      "SELECT role_id, permission_key, allowed FROM role_permissions ORDER BY role_id ASC, permission_key ASC"
    );

    const catalogKeys = PERMISSION_CATALOG.map((entry) => entry.key);
    const byRoleId = new Map<number, Record<string, boolean>>();
    for (const row of permissionRows.rows) {
      const roleId = Number(row.role_id);
      const key = String(row.permission_key || "");
      if (!Number.isFinite(roleId) || !key || !isValidPermissionKey(key)) continue;
      const allowed = Boolean(row.allowed);
      const map = byRoleId.get(roleId) || {};
      map[key] = allowed;
      byRoleId.set(roleId, map);
    }

    const rows = rolesResult.rows.map((role: any) => {
      const roleId = Number(role.id);
      const rolePermissions = byRoleId.get(roleId) || {};
      const fullMap: Record<string, boolean> = {};
      for (const key of catalogKeys) fullMap[key] = Boolean(rolePermissions[key]);
      return {
        role_key: String(role.role_key || ""),
        label: String(role.label || role.role_key || ""),
        permissions: fullMap,
      };
    });

    res.json({
      catalog: PERMISSION_CATALOG,
      rows,
    });
  });

  app.patch("/api/admin/permissions/:roleKey", requireOwner, async (req, res) => {
    const roleKey = String(req.params.roleKey || "").trim();
    if (!roleKey) return res.status(400).json({ ok: false, error: "invalid role key" });

    const roleRow = await pool.query("SELECT id, role_key FROM roles WHERE role_key = $1 LIMIT 1", [roleKey]);
    if (!roleRow.rows.length) return res.status(404).json({ ok: false, error: "role not found" });
    const roleId = Number(roleRow.rows[0].id);
    if (!Number.isFinite(roleId)) return res.status(400).json({ ok: false, error: "invalid role id" });

    const rawPermissions = req.body?.permissions;
    if (!rawPermissions || typeof rawPermissions !== "object" || Array.isArray(rawPermissions)) {
      return res.status(400).json({ ok: false, error: "permissions object is required" });
    }

    const updates: Array<{ key: string; allowed: boolean }> = [];
    for (const [key, value] of Object.entries(rawPermissions)) {
      const permissionKey = String(key || "").trim();
      if (!permissionKey || !isValidPermissionKey(permissionKey)) continue;
      updates.push({ key: permissionKey, allowed: Boolean(value) });
    }
    if (!updates.length) return res.status(400).json({ ok: false, error: "no valid permissions provided" });

    for (const update of updates) {
      await pool.query(
        `
          INSERT INTO role_permissions (role_id, permission_key, allowed, created_at, updated_at)
          VALUES ($1, $2, $3, now(), now())
          ON CONFLICT (role_id, permission_key)
          DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now()
        `,
        [roleId, update.key, update.allowed]
      );
    }

    res.json({ ok: true });
  });

  app.get("/api/admin/users", requireOwner, async (_req, res) => {
    const sql = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.active,
        u.created_at,
        u.updated_at,
        COALESCE(
          ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
          ARRAY[]::text[]
        ) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id, u.name, u.email, u.active, u.created_at, u.updated_at
      ORDER BY lower(u.email) ASC;
    `;
    const r = await pool.query(sql);
    res.json({
      rows: r.rows.map((x: any) => ({
        id: Number(x.id),
        name: String(x.name ?? ""),
        email: String(x.email ?? ""),
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

    if (!name || !email || !password) return res.status(400).json({ ok: false, error: "name, email, password required" });
    if (password.length < 4) return res.status(400).json({ ok: false, error: "password must be at least 4 chars" });

    const roleKeys = roles.length ? roles : (["Sales"] as const);
    const passwordHash = hashPassword(password);

    const r = await pool.query(
      `
        INSERT INTO users (name, email, password_hash, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        RETURNING id
      `,
      [name, email, passwordHash, active]
    );
    const userId = Number(r.rows[0]?.id);
    await setUserRolesByKeys(userId, roleKeys as any);
    const user = await loadAuthUserById(userId);
    res.status(201).json({ ok: true, row: user ? { ...user, active } : null });
  });

  app.patch("/api/admin/users/:id", requireOwner, async (req, res) => {
    const id = parseTaskIdParam(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "invalid id" });

    const fields: string[] = [];
    const values: any[] = [];

    if (req.body?.name !== undefined) {
      if (typeof req.body?.name !== "string" || !req.body.name.trim()) {
        return res.status(400).json({ ok: false, error: "invalid name" });
      }
      values.push(req.body.name.trim());
      fields.push(`name = $${values.length}`);
    }

    if (req.body?.email !== undefined) {
      if (typeof req.body?.email !== "string" || !req.body.email.trim()) {
        return res.status(400).json({ ok: false, error: "invalid email" });
      }
      values.push(req.body.email.trim().toLowerCase());
      fields.push(`email = $${values.length}`);
    }

    if (req.body?.active !== undefined) {
      values.push(Boolean(req.body.active));
      fields.push(`active = $${values.length}`);
    }

    if (!fields.length) return res.status(400).json({ ok: false, error: "no fields to update" });
    values.push(id);
    await pool.query(
      `UPDATE users SET ${fields.join(", ")}, updated_at = now() WHERE id = $${values.length}`,
      values
    );

    const user = await loadAuthUserById(id);
    if (!user) {
      const row = await pool.query("SELECT id, name, email, active FROM users WHERE id = $1 LIMIT 1", [id]);
      if (!row.rows.length) return res.status(404).json({ ok: false, error: "not found" });
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

  app.patch("/api/admin/users/:id/roles", requireOwner, async (req, res) => {
    const id = parseTaskIdParam(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "invalid id" });
    const roles = normalizeRoleList(req.body?.roles);
    if (!roles.length) return res.status(400).json({ ok: false, error: "at least one valid role is required" });

    await setUserRolesByKeys(id, roles);
    const row = await pool.query("SELECT active FROM users WHERE id = $1 LIMIT 1", [id]);
    if (!row.rows.length) return res.status(404).json({ ok: false, error: "not found" });
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
    const id = parseTaskIdParam(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "invalid id" });
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password || password.length < 4) return res.status(400).json({ ok: false, error: "password must be at least 4 chars" });

    const hash = hashPassword(password);
    const r = await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING id", [
      hash,
      id,
    ]);
    if (!r.rows.length) return res.status(404).json({ ok: false, error: "not found" });

    await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [id]).catch(() => {
      // ignore session cleanup failures
    });
    res.json({ ok: true });
  });
}
