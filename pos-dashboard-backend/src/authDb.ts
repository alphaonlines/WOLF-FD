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
      COALESCE(
        ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
        ARRAY[]::text[]
      ) AS roles,
      COALESCE(
        ARRAY_AGG(DISTINCT rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL AND rp.allowed = TRUE),
        ARRAY[]::text[]
      ) AS permissions
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    WHERE s.token_hash = $1
      AND s.expires_at > now()
      AND u.active = TRUE
      AND COALESCE(u.access_status, 'approved') = 'approved'
    GROUP BY u.id, u.name, u.email
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
      COALESCE(
        ARRAY_AGG(DISTINCT r.role_key) FILTER (WHERE r.role_key IS NOT NULL),
        ARRAY[]::text[]
      ) AS roles,
      COALESCE(
        ARRAY_AGG(DISTINCT rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL AND rp.allowed = TRUE),
        ARRAY[]::text[]
      ) AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    WHERE u.id = $1
    GROUP BY u.id, u.name, u.email
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
