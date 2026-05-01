import type { Pool } from "pg";
import type { AuthUserView } from "./authSessionUtils";

type CreateAuthDbHelpersDeps = {
  pool: Pool;
  authCookieName: string;
  parseCookies: (req: any) => Record<string, string>;
  sha256Hex: (value: string) => string;
  buildAuthUser: (row: any) => AuthUserView;
  normalizeRoleList: (raw: any) => AuthUserView["roles"];
};

export function createAuthDbHelpers({
  pool,
  authCookieName,
  parseCookies,
  sha256Hex,
  buildAuthUser,
  normalizeRoleList,
}: CreateAuthDbHelpersDeps) {
  const findAuthUserBySessionToken = async (token: string): Promise<AuthUserView | null> => {
    if (!token) return null;
    const tokenHash = sha256Hex(token);
    const sql = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.tutorial_completed_at,
        u.tutorial_reset_at,
        COALESCE(role_rows.roles, ARRAY[]::text[]) AS roles,
        CASE
          WHEN COALESCE(explicit_rows.permission_entry_count, 0) > 0
            THEN COALESCE(explicit_rows.allowed_permissions, ARRAY[]::text[])
          ELSE COALESCE(role_permission_rows.allowed_permissions, ARRAY[]::text[])
        END AS permissions,
        CASE
          WHEN COALESCE(explicit_rows.permission_entry_count, 0) > 0 THEN 'explicit'
          ELSE 'role'
        END AS permission_mode
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN (
        SELECT
          ur.user_id,
          COALESCE(
            ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
            ARRAY[]::text[]
          ) AS roles
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        GROUP BY ur.user_id
      ) role_rows ON role_rows.user_id = u.id
      LEFT JOIN (
        SELECT
          ur.user_id,
          COALESCE(
            ARRAY_AGG(DISTINCT rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL AND rp.allowed = TRUE),
            ARRAY[]::text[]
          ) AS allowed_permissions
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        GROUP BY ur.user_id
      ) role_permission_rows ON role_permission_rows.user_id = u.id
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*)::int AS permission_entry_count,
          COALESCE(
            ARRAY_AGG(DISTINCT permission_key) FILTER (WHERE permission_key IS NOT NULL AND allowed = TRUE),
            ARRAY[]::text[]
          ) AS allowed_permissions
        FROM user_permissions
        GROUP BY user_id
      ) explicit_rows ON explicit_rows.user_id = u.id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.active = TRUE
        AND COALESCE(u.access_status, 'approved') = 'approved'
      LIMIT 1;
    `;
    const r = await pool.query(sql, [tokenHash]);
    if (!r.rows.length) return null;

    await pool.query("UPDATE auth_sessions SET last_seen_at = now() WHERE token_hash = $1", [tokenHash]).catch(() => {
      // Ignore non-critical session touch failures.
    });
    return buildAuthUser(r.rows[0]);
  };

  const currentAuthUserFromReq = async (req: any): Promise<AuthUserView | null> => {
    const cookies = parseCookies(req);
    const token = cookies[authCookieName];
    if (!token) return null;
    return findAuthUserBySessionToken(token);
  };

  const getRoleIdMap = async (): Promise<Record<string, number>> => {
    const r = await pool.query("SELECT id, role_key FROM roles;");
    const out: Record<string, number> = {};
    for (const row of r.rows) {
      const k = String(row.role_key || "");
      const id = Number(row.id);
      if (k && Number.isFinite(id)) out[k] = id;
    }
    return out;
  };

  const setUserRolesByKeys = async (userId: number, roleKeys: string[]) => {
    const normalized = normalizeRoleList(roleKeys);
    const map = await getRoleIdMap();
    const roleIds = normalized.map((k) => map[k]).filter((v) => Number.isFinite(v));
    await pool.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
    for (const roleId of roleIds) {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, created_at) VALUES ($1, $2, now()) ON CONFLICT DO NOTHING`,
        [userId, roleId]
      );
    }
  };

  const loadAuthUserById = async (userId: number): Promise<AuthUserView | null> => {
    const sql = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.tutorial_completed_at,
        u.tutorial_reset_at,
        COALESCE(role_rows.roles, ARRAY[]::text[]) AS roles,
        CASE
          WHEN COALESCE(explicit_rows.permission_entry_count, 0) > 0
            THEN COALESCE(explicit_rows.allowed_permissions, ARRAY[]::text[])
          ELSE COALESCE(role_permission_rows.allowed_permissions, ARRAY[]::text[])
        END AS permissions,
        CASE
          WHEN COALESCE(explicit_rows.permission_entry_count, 0) > 0 THEN 'explicit'
          ELSE 'role'
        END AS permission_mode
      FROM users u
      LEFT JOIN (
        SELECT
          ur.user_id,
          COALESCE(
            ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
            ARRAY[]::text[]
          ) AS roles
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        GROUP BY ur.user_id
      ) role_rows ON role_rows.user_id = u.id
      LEFT JOIN (
        SELECT
          ur.user_id,
          COALESCE(
            ARRAY_AGG(DISTINCT rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL AND rp.allowed = TRUE),
            ARRAY[]::text[]
          ) AS allowed_permissions
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        GROUP BY ur.user_id
      ) role_permission_rows ON role_permission_rows.user_id = u.id
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*)::int AS permission_entry_count,
          COALESCE(
            ARRAY_AGG(DISTINCT permission_key) FILTER (WHERE permission_key IS NOT NULL AND allowed = TRUE),
            ARRAY[]::text[]
          ) AS allowed_permissions
        FROM user_permissions
        GROUP BY user_id
      ) explicit_rows ON explicit_rows.user_id = u.id
      WHERE u.id = $1
      LIMIT 1;
    `;
    const r = await pool.query(sql, [userId]);
    if (!r.rows.length) return null;
    return buildAuthUser(r.rows[0]);
  };

  return {
    currentAuthUserFromReq,
    setUserRolesByKeys,
    loadAuthUserById,
  };
}
