import { OAuth2Client } from "google-auth-library";
import type { Express } from "express";
import type { Pool } from "pg";
import { GOOGLE_WORKSPACE_CLIENT_ID, GOOGLE_WORKSPACE_DOMAIN } from "../runtimeConfig";

type AuthUserLike = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  permissionMode: "role" | "explicit";
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

type GooglePayloadLike = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  hd?: string;
};

const googleClient = GOOGLE_WORKSPACE_CLIENT_ID ? new OAuth2Client(GOOGLE_WORKSPACE_CLIENT_ID) : null;

function normalizeEmail(value: any): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePhone(value: any): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildGoogleRequestProfile(payload: GooglePayloadLike, row?: any) {
  const email = normalizeEmail(row?.email || payload.email);
  const fullName = String(row?.name || payload.name || email).trim();
  const givenName = String(payload.given_name || "").trim();
  const familyName = String(payload.family_name || "").trim();
  return {
    email,
    name: fullName || email,
    givenName,
    familyName,
    phone: normalizePhone(row?.phone),
    accessStatus: String(row?.access_status || "request_required"),
  };
}

async function verifyGoogleCredential(credential: string): Promise<GooglePayloadLike> {
  if (!GOOGLE_WORKSPACE_CLIENT_ID || !googleClient) {
    throw new Error("google_workspace_not_configured");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_WORKSPACE_CLIENT_ID,
  });
  const payload = ticket.getPayload() as GooglePayloadLike | undefined;
  if (!payload?.email || payload.email_verified !== true) {
    throw new Error("google_email_not_verified");
  }
  const email = normalizeEmail(payload.email);
  const hostedDomain = String(payload.hd || "").trim().toLowerCase();
  if (!email.endsWith(`@${GOOGLE_WORKSPACE_DOMAIN}`) && hostedDomain !== GOOGLE_WORKSPACE_DOMAIN) {
    throw new Error("google_workspace_domain_required");
  }
  return payload;
}

async function createAuthSessionForUser({
  pool,
  authSessionDays,
  createSessionToken,
  sha256Hex,
  userId,
  req,
  res,
  setAuthCookie,
}: {
  pool: Pool;
  authSessionDays: number;
  createSessionToken: () => string;
  sha256Hex: (value: string) => string;
  userId: number;
  req: any;
  res: any;
  setAuthCookie: (res: any, token: string, req: any) => void;
}) {
  const token = createSessionToken();
  const tokenHash = sha256Hex(token);
  const userAgent = typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : "";
  const ipAddress = (req.headers?.["x-forwarded-for"] as string) || req.ip || "";
  await pool.query(
    `
      INSERT INTO auth_sessions (user_id, token_hash, expires_at, created_at, last_seen_at, user_agent, ip_address)
      VALUES ($1, $2, now() + ($3::int || ' days')::interval, now(), now(), $4, $5)
    `,
    [userId, tokenHash, authSessionDays, userAgent || null, ipAddress || null]
  );
  setAuthCookie(res, token, req);
}

async function loadUserRecordByEmail(pool: Pool, email: string) {
  return pool.query(
    `
      SELECT id, name, email, password_hash, active, phone, google_sub, auth_provider, access_status, access_requested_at, access_approved_at
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email]
  );
}

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
  app.get("/api/auth/config", async (_req, res) => {
    res.json({
      ok: true,
      googleWorkspaceEnabled: Boolean(GOOGLE_WORKSPACE_CLIENT_ID),
      googleClientId: GOOGLE_WORKSPACE_CLIENT_ID,
      googleHostedDomain: GOOGLE_WORKSPACE_DOMAIN,
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ ok: false, error: "email and password are required" });

    const userSql = `
      SELECT id, name, email, password_hash, active, access_status
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1;
    `;
    const userRes = await pool.query(userSql, [email]);
    if (!userRes.rows.length) return res.status(401).json({ ok: false, error: "invalid credentials" });
    const user = userRes.rows[0];
    if (!user.active) return res.status(403).json({ ok: false, error: "user is inactive" });
    if (String(user.access_status || "approved") !== "approved") {
      return res.status(403).json({ ok: false, error: "access is still pending owner approval" });
    }
    if (!verifyPassword(password, String(user.password_hash || ""))) {
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }

    await createAuthSessionForUser({
      pool,
      authSessionDays,
      createSessionToken,
      sha256Hex,
      userId: Number(user.id),
      req,
      res,
      setAuthCookie,
    });

    const authUser = await loadAuthUserById(Number(user.id));
    res.json({ ok: true, user: authUser || buildAuthUser(user) });
  });

  app.post("/api/auth/google/start", async (req, res) => {
    const credential = typeof req.body?.credential === "string" ? req.body.credential.trim() : "";
    if (!credential) return res.status(400).json({ ok: false, error: "google credential is required" });

    try {
      const payload = await verifyGoogleCredential(credential);
      const email = normalizeEmail(payload.email);
      const userRes = await loadUserRecordByEmail(pool, email);
      const row = userRes.rows[0];

      if (!row) {
        return res.json({
          ok: true,
          status: "request_required",
          requestProfile: buildGoogleRequestProfile(payload),
        });
      }

      if (!row.active) {
        return res.status(403).json({ ok: false, error: "this account is inactive" });
      }

      if (String(row.access_status || "approved") !== "approved") {
        await pool.query(
          `
            UPDATE users
            SET google_sub = $1,
                auth_provider = 'google',
                name = CASE WHEN trim(COALESCE(name, '')) = '' THEN $2 ELSE name END,
                updated_at = now()
            WHERE id = $3
          `,
          [payload.sub || null, String(payload.name || row.name || email).trim(), Number(row.id)]
        );
        const refreshed = (await loadUserRecordByEmail(pool, email)).rows[0] || row;
        return res.json({
          ok: true,
          status: "pending",
          requestProfile: buildGoogleRequestProfile(payload, refreshed),
        });
      }

      await pool.query(
        `
          UPDATE users
          SET google_sub = $1,
              auth_provider = 'google',
              name = CASE WHEN $2 <> '' THEN $2 ELSE name END,
              updated_at = now()
          WHERE id = $3
        `,
        [payload.sub || null, String(payload.name || "").trim(), Number(row.id)]
      );

      await createAuthSessionForUser({
        pool,
        authSessionDays,
        createSessionToken,
        sha256Hex,
        userId: Number(row.id),
        req,
        res,
        setAuthCookie,
      });

      const authUser = await loadAuthUserById(Number(row.id));
      return res.json({
        ok: true,
        status: "approved",
        user: authUser || buildAuthUser(row),
      });
    } catch (error: any) {
      const message = String(error?.message || error || "");
      if (message === "google_workspace_not_configured") {
        return res.status(503).json({ ok: false, error: "google workspace sign-in is not configured yet" });
      }
      if (message === "google_email_not_verified") {
        return res.status(403).json({ ok: false, error: "google email must be verified" });
      }
      if (message === "google_workspace_domain_required") {
        return res.status(403).json({ ok: false, error: `use your @${GOOGLE_WORKSPACE_DOMAIN} Google account` });
      }
      console.error("Google start auth failed:", error);
      return res.status(401).json({ ok: false, error: "google sign-in failed" });
    }
  });

  app.post("/api/auth/google/request-access", async (req, res) => {
    const credential = typeof req.body?.credential === "string" ? req.body.credential.trim() : "";
    const phone = normalizePhone(req.body?.phone);
    if (!credential) return res.status(400).json({ ok: false, error: "google credential is required" });
    if (!phone) return res.status(400).json({ ok: false, error: "phone number is required" });

    try {
      const payload = await verifyGoogleCredential(credential);
      const email = normalizeEmail(payload.email);
      const name = String(payload.name || email).trim();
      const googleSub = typeof payload.sub === "string" ? payload.sub.trim() : "";
      const userRes = await loadUserRecordByEmail(pool, email);
      const row = userRes.rows[0];

      if (row?.active === false) {
        return res.status(403).json({ ok: false, error: "this account is inactive" });
      }

      if (!row) {
        const placeholderPasswordHash = hashPassword(createSessionToken());
        await pool.query(
          `
            INSERT INTO users (
              name,
              email,
              password_hash,
              phone,
              google_sub,
              auth_provider,
              access_status,
              access_requested_at,
              active,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'google', 'pending', now(), TRUE, now(), now())
          `,
          [name, email, placeholderPasswordHash, phone, googleSub || null]
        );
      } else {
        await pool.query(
          `
            UPDATE users
            SET name = CASE WHEN $1 <> '' THEN $1 ELSE name END,
                phone = $2,
                google_sub = $3,
                auth_provider = 'google',
                access_status = CASE WHEN access_status = 'approved' THEN 'approved' ELSE 'pending' END,
                access_requested_at = CASE WHEN access_status = 'approved' THEN access_requested_at ELSE now() END,
                updated_at = now()
            WHERE id = $4
          `,
          [name, phone, googleSub || null, Number(row.id)]
        );
      }

      const refreshed = (await loadUserRecordByEmail(pool, email)).rows[0];

      if (String(refreshed?.access_status || "") === "approved") {
        await createAuthSessionForUser({
          pool,
          authSessionDays,
          createSessionToken,
          sha256Hex,
          userId: Number(refreshed.id),
          req,
          res,
          setAuthCookie,
        });
        const authUser = await loadAuthUserById(Number(refreshed.id));
        return res.json({
          ok: true,
          status: "approved",
          user: authUser || buildAuthUser(refreshed),
        });
      }

      return res.json({
        ok: true,
        status: "pending",
        requestProfile: buildGoogleRequestProfile(payload, refreshed),
      });
    } catch (error: any) {
      const message = String(error?.message || error || "");
      if (message === "google_workspace_not_configured") {
        return res.status(503).json({ ok: false, error: "google workspace sign-in is not configured yet" });
      }
      if (message === "google_email_not_verified") {
        return res.status(403).json({ ok: false, error: "google email must be verified" });
      }
      if (message === "google_workspace_domain_required") {
        return res.status(403).json({ ok: false, error: `use your @${GOOGLE_WORKSPACE_DOMAIN} Google account` });
      }
      console.error("Google request access failed:", error);
      return res.status(401).json({ ok: false, error: "google sign-in failed" });
    }
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
    await pool.query("UPDATE users SET password_hash = $1, auth_provider = 'password', updated_at = now() WHERE id = $2", [
      nextHash,
      Number(user.id),
    ]);

    res.json({ ok: true });
  });
}
