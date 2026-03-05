import type { Express } from "express";
import type { Pool } from "pg";

type AuthUserLike = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

type RegisterAuthRoutesDeps = {
  app: Express;
  pool: Pool;
  authSessionDays: number;
  authCookieName: string;
  publicAuthPaths: Set<string>;
  verifyPassword: (password: string, storedHash: string) => boolean;
  hashPassword: (password: string) => string;
  sha256Hex: (value: string) => string;
  createSessionToken: () => string;
  setAuthCookie: (res: any, token: string, req: any) => void;
  clearAuthCookie: (res: any, req: any) => void;
  parseCookies: (req: any) => Record<string, string>;
  currentAuthUserFromReq: (req: any) => Promise<AuthUserLike | null>;
  loadAuthUserById: (userId: number) => Promise<AuthUserLike | null>;
  buildAuthUser: (row: any) => AuthUserLike;
};

export function registerAuthRoutes({
  app,
  pool,
  authSessionDays,
  authCookieName,
  publicAuthPaths,
  verifyPassword,
  hashPassword,
  sha256Hex,
  createSessionToken,
  setAuthCookie,
  clearAuthCookie,
  parseCookies,
  currentAuthUserFromReq,
  loadAuthUserById,
  buildAuthUser,
}: RegisterAuthRoutesDeps) {
  app.post("/api/auth/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ ok: false, error: "email and password are required" });

    const userSql = `
      SELECT id, name, email, password_hash, active
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1;
    `;
    const userRes = await pool.query(userSql, [email]);
    if (!userRes.rows.length) return res.status(401).json({ ok: false, error: "invalid credentials" });
    const user = userRes.rows[0];
    if (!user.active) return res.status(403).json({ ok: false, error: "user is inactive" });
    if (!verifyPassword(password, String(user.password_hash || ""))) {
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }

    const token = createSessionToken();
    const tokenHash = sha256Hex(token);
    const userAgent = typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : "";
    const ipAddress = (req.headers?.["x-forwarded-for"] as string) || req.ip || "";
    await pool.query(
      `
        INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at, last_seen_at, user_agent, ip_address)
        VALUES ($1, $2, now() + ($3::int || ' days')::interval, now(), now(), $4, $5)
      `,
      [user.id, tokenHash, authSessionDays, userAgent || null, ipAddress || null]
    );

    setAuthCookie(res, token, req);
    const authUser = await loadAuthUserById(Number(user.id));
    res.json({ ok: true, user: authUser || buildAuthUser(user) });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies[authCookieName];
    if (token) {
      const tokenHash = sha256Hex(token);
      await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]).catch(() => {
        // Ignore missing/invalid session cleanup issues.
      });
    }
    clearAuthCookie(res, req);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await currentAuthUserFromReq(req);
    if (!user) return res.status(401).json({ ok: false, user: null });
    res.json({ ok: true, user });
  });

  app.use("/api", async (req, res, next) => {
    if (req.method === "OPTIONS") return next();
    if (publicAuthPaths.has(req.path)) return next();
    const user = await currentAuthUserFromReq(req);
    if (!user) return res.status(401).json({ ok: false, error: "unauthorized" });
    (req as any).authUser = user;
    return next();
  });

  app.post("/api/auth/change-password", async (req, res) => {
    const user = (req as any).authUser as AuthUserLike | undefined;
    if (!user) return res.status(401).json({ ok: false, error: "unauthorized" });

    const currentPassword = typeof req.body?.current_password === "string" ? req.body.current_password : "";
    const newPassword = typeof req.body?.new_password === "string" ? req.body.new_password : "";
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "current_password and new_password are required" });
    }
    if (newPassword.length < 4) return res.status(400).json({ ok: false, error: "new password must be at least 4 chars" });

    const currentRow = await pool.query(
      "SELECT id, password_hash FROM users WHERE id = $1 AND active = TRUE LIMIT 1",
      [Number(user.id)]
    );
    if (!currentRow.rows.length) return res.status(404).json({ ok: false, error: "user not found" });
    if (!verifyPassword(currentPassword, String(currentRow.rows[0].password_hash || ""))) {
      return res.status(401).json({ ok: false, error: "current password is invalid" });
    }

    const nextHash = hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
      nextHash,
      Number(user.id),
    ]);

    res.json({ ok: true });
  });
}
