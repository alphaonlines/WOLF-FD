import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import multer from "multer";
import { Pool } from "pg";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import {
  ITEM_DATE_FIELD,
  prefixedDateField,
  SAFE_FINANCE_BALANCE,
  SAFE_FINANCE_FEE,
  SAFE_GRAND_TOTAL,
  SAFE_PROFIT,
  SAFE_TOTAL_FINANCE_AMT,
} from "./sqlFields";
import { registerCrmRoutes } from "./routes/crmRoutes";
import { registerTaskRoutes } from "./routes/tasksRoutes";
import { registerAdminRoutes } from "./routes/adminRoutes";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerReportRoutes } from "./routes/reportRoutes";
import { registerAnalyticsRoutes } from "./routes/analyticsRoutes";
import { registerSalesDetailRoutes } from "./routes/salesDetailRoutes";
import { registerInsightsRoutes } from "./routes/insightsRoutes";

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

const uploadsDir = path.resolve(__dirname, "..", "incoming");
fs.mkdirSync(uploadsDir, { recursive: true });
const execFileAsync = promisify(execFile);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^\w.\- ()]/g, "_");
      cb(null, `${Date.now()}_${safeName}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname);
    cb((ok ? null : new Error("Only .xlsx or .xls files are accepted")) as any, ok);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const envString = (key: string, fallback?: string) => {
  const v = process.env[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
};

const pool = new Pool({
  host: envString("PGHOST", "127.0.0.1"),
  port: Number(envString("PGPORT", "5432")),
  database: envString("PGDATABASE", "salesdb"),
  user: envString("PGUSER", "salesapp"),
  password: envString("PGPASSWORD", "dev_password_change_me"),
});

const AUTH_COOKIE_NAME = "fd_session";
const AUTH_SESSION_DAYS = Math.max(Number(envString("AUTH_SESSION_DAYS", "14")) || 14, 1);
const AUTH_COOKIE_SECURE_MODE = (envString("AUTH_COOKIE_SECURE", "auto") || "auto").toLowerCase();
const VALID_USER_ROLES = ["Owner", "Manager", "Sales", "Marketing"] as const;
const PUBLIC_AUTH_PATHS = new Set(["/auth/login", "/auth/logout", "/auth/me"]);

type AuthUserView = {
  id: string;
  name: string;
  email: string;
  roles: (typeof VALID_USER_ROLES)[number][];
};

function hashPassword(password: string, saltHex?: string): string {
  const salt = saltHex || randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const digestHex = parts[2];
  if (!salt || !digestHex) return false;
  const expected = Buffer.from(digestHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseCookies(req: any): Record<string, string> {
  const raw = typeof req.headers?.cookie === "string" ? req.headers.cookie : "";
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function isSecureRequest(req: any): boolean {
  if (AUTH_COOKIE_SECURE_MODE === "true") return true;
  if (AUTH_COOKIE_SECURE_MODE === "false") return false;
  const proto = String(req.headers?.["x-forwarded-proto"] || "").toLowerCase();
  return Boolean(req.secure) || proto.includes("https");
}

function setAuthCookie(res: any, token: string, req: any) {
  const maxAgeMs = AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000;
  const cookie = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isSecureRequest(req)) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

function clearAuthCookie(res: any, req: any) {
  const cookie = [
    `${AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isSecureRequest(req)) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

function normalizeRoleList(raw: any): (typeof VALID_USER_ROLES)[number][] {
  const inList = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const seen = new Set<string>();
  const out: (typeof VALID_USER_ROLES)[number][] = [];
  for (const item of inList) {
    const role = String(item || "").trim();
    if (!role || seen.has(role)) continue;
    if (!VALID_USER_ROLES.includes(role as any)) continue;
    seen.add(role);
    out.push(role as any);
  }
  return out;
}

function hasAnyRole(user: AuthUserView | null | undefined, roles: string[]): boolean {
  if (!user) return false;
  const own = new Set((user.roles || []).map((r) => String(r)));
  return roles.some((r) => own.has(r));
}

function buildAuthUser(row: any): AuthUserView {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    roles: normalizeRoleList(row.roles),
  };
}

async function findAuthUserBySessionToken(token: string): Promise<AuthUserView | null> {
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
      ) AS roles
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE s.token_hash = $1
      AND s.expires_at > now()
      AND u.active = TRUE
    GROUP BY u.id, u.name, u.email
    LIMIT 1;
  `;
  const r = await pool.query(sql, [tokenHash]);
  if (!r.rows.length) return null;

  await pool.query("UPDATE auth_sessions SET last_seen_at = now() WHERE token_hash = $1", [tokenHash]).catch(() => {
    // Ignore non-critical session touch failures.
  });
  return buildAuthUser(r.rows[0]);
}

async function currentAuthUserFromReq(req: any): Promise<AuthUserView | null> {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE_NAME];
  if (!token) return null;
  return findAuthUserBySessionToken(token);
}

async function ensureAuthSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            BIGSERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN active SET DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)));`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id         BIGSERIAL PRIMARY KEY,
      role_key   TEXT NOT NULL UNIQUE,
      label      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_key TEXT;`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS label TEXT;`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE roles ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE roles ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_key ON roles(role_key);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id    BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, role_id)
    );
  `);
  await pool.query(`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS user_id BIGINT;`);
  await pool.query(`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role_id BIGINT;`);
  await pool.query(`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE user_roles ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id            BIGSERIAL PRIMARY KEY,
      user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash    TEXT NOT NULL UNIQUE,
      expires_at    TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      user_agent    TEXT,
      ip_address    TEXT
    );
  `);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_id BIGINT;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;`);
  await pool.query(`ALTER TABLE auth_sessions ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE auth_sessions ALTER COLUMN last_seen_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);`);
}

async function ensureDefaultRoles() {
  const roleRows = [
    { role_key: "Owner", label: "Owner" },
    { role_key: "Manager", label: "Manager" },
    { role_key: "Sales", label: "Sales" },
    { role_key: "Marketing", label: "Marketing" },
  ];
  for (const role of roleRows) {
    await pool.query(
      `
        INSERT INTO roles (role_key, label, created_at, updated_at)
        VALUES ($1, $2, now(), now())
        ON CONFLICT (role_key) DO UPDATE
        SET label = EXCLUDED.label, updated_at = now()
      `,
      [role.role_key, role.label]
    );
  }
}

async function getRoleIdMap(): Promise<Record<string, number>> {
  const r = await pool.query("SELECT id, role_key FROM roles;");
  const out: Record<string, number> = {};
  for (const row of r.rows) {
    const k = String(row.role_key || "");
    const id = Number(row.id);
    if (k && Number.isFinite(id)) out[k] = id;
  }
  return out;
}

async function setUserRolesByKeys(userId: number, roleKeys: string[]) {
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
}

async function loadAuthUserById(userId: number): Promise<AuthUserView | null> {
  const sql = `
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
    LIMIT 1;
  `;
  const r = await pool.query(sql, [userId]);
  if (!r.rows.length) return null;
  return buildAuthUser(r.rows[0]);
}

async function ensureDefaultAuthUser() {
  const existing = await pool.query("SELECT COUNT(*)::int AS n FROM users;");
  const count = Number(existing.rows[0]?.n ?? 0);
  const defaultEmail = (envString("AUTH_BOOTSTRAP_EMAIL", "owner@wolffd.local") || "owner@wolffd.local").toLowerCase();
  if (count <= 0) {
    const defaultName = envString("AUTH_BOOTSTRAP_NAME", "WOLF FD Owner") || "WOLF FD Owner";
    const defaultPassword = envString("AUTH_BOOTSTRAP_PASSWORD", "1111") || "1111";
    const passwordHash = hashPassword(defaultPassword);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, active, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, now(), now())
       ON CONFLICT (email) DO NOTHING;`,
      [defaultName, defaultEmail, passwordHash]
    );
    console.log(`Auth bootstrap user ready: ${defaultEmail}`);
  }

  const ownerUser = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1", [defaultEmail]);
  if (ownerUser.rows.length) {
    await setUserRolesByKeys(Number(ownerUser.rows[0].id), ["Owner"]);
  }

  await pool.query(`
    INSERT INTO user_roles (user_id, role_id, created_at)
    SELECT u.id, r.id, now()
    FROM users u
    JOIN roles r ON r.role_key = 'Owner'
    WHERE NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
    )
    ON CONFLICT DO NOTHING;
  `);
}

async function ensureCrmSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      phone        TEXT NOT NULL,
      channel      TEXT NOT NULL DEFAULT 'SMS',
      source       TEXT NOT NULL DEFAULT 'Website',
      interest     TEXT NOT NULL DEFAULT '',
      budget       TEXT NOT NULL DEFAULT 'Unspecified',
      store        TEXT NOT NULL DEFAULT 'FD7',
      owner        TEXT NOT NULL DEFAULT 'Unassigned',
      stage        TEXT NOT NULL DEFAULT 'New',
      next_action  TEXT NOT NULL DEFAULT 'First contact',
      due_date     DATE NULL,
      last_message TEXT NOT NULL DEFAULT '',
      last_touch   TEXT NOT NULL DEFAULT '',
      notes        TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_due ON crm_leads(stage, due_date, id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_owner ON crm_leads(owner);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_automations (
      id          TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      enabled     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Health
app.get("/health", async (_req, res) => {
  const r = await pool.query("SELECT 1 AS ok");
  res.json({ ok: true, db: r.rows[0].ok });
});

registerAuthRoutes({
  app,
  pool,
  authSessionDays: AUTH_SESSION_DAYS,
  authCookieName: AUTH_COOKIE_NAME,
  publicAuthPaths: PUBLIC_AUTH_PATHS,
  verifyPassword,
  hashPassword,
  sha256Hex,
  createSessionToken: () => randomBytes(32).toString("hex"),
  setAuthCookie,
  clearAuthCookie,
  parseCookies,
  currentAuthUserFromReq,
  loadAuthUserById: async (userId: number) => {
    const user = await loadAuthUserById(userId);
    if (!user) return null;
    return {
      id: String(user.id),
      name: String(user.name),
      email: String(user.email),
      roles: (user.roles || []).map((role) => String(role)),
    };
  },
  buildAuthUser: (row: any) => {
    const user = buildAuthUser(row);
    return {
      id: String(user.id),
      name: String(user.name),
      email: String(user.email),
      roles: (user.roles || []).map((role) => String(role)),
    };
  },
});

const requireOwner = (req: any, res: any, next: any) => {
  const user = (req as any).authUser as AuthUserView | undefined;
  if (!hasAnyRole(user, ["Owner"])) return res.status(403).json({ ok: false, error: "forbidden" });
  return next();
};

registerAdminRoutes({
  app,
  pool,
  requireOwner,
  normalizeRoleList: (raw: any) => normalizeRoleList(raw),
  hashPassword,
  setUserRolesByKeys,
  loadAuthUserById: async (userId: number) => {
    const user = await loadAuthUserById(userId);
    if (!user) return null;
    return {
      id: String(user.id),
      name: String(user.name),
      email: String(user.email),
      roles: (user.roles || []).map((role) => String(role)),
    };
  },
});

app.post("/api/import/upload", upload.array("files", 25), async (req, res) => {
  const rawFiles = (req as any).files as Array<{ originalname: string; filename: string; size: number }> | undefined;
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  if (!files.length) {
    res.status(400).json({ ok: false, error: "No files uploaded" });
    return;
  }
  const importerPath = path.resolve(__dirname, "..", "importer", "import_pos_xlsx.py");
  const pythonBin = process.env.POS_IMPORT_PYTHON || "python";
  let importOutput = "";
  let importError = "";
  const tempDir = fs.mkdtempSync(path.join(uploadsDir, "upload-"));
  try {
    for (const file of files) {
      const src = path.join(uploadsDir, file.filename);
      const dest = path.join(tempDir, file.filename);
      if (fs.existsSync(src)) {
        fs.renameSync(src, dest);
      }
    }
    const { stdout, stderr } = await execFileAsync(
      pythonBin,
      [importerPath, "--incoming", tempDir, "--no-move"],
      { timeout: 5 * 60 * 1000 }
    );
    importOutput = stdout?.toString() || "";
    importError = stderr?.toString() || "";
  } catch (err: any) {
    importError = err?.stderr?.toString?.() || String(err?.message || err);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  res.json({
    ok: true,
    saved_to: uploadsDir,
    files: files.map((f) => ({
      original_name: f.originalname,
      stored_name: f.filename,
      size: f.size,
    })),
    import: {
      ok: importError ? false : true,
      stdout: importOutput,
      stderr: importError,
    },
  });
});

registerTaskRoutes(app, pool);
registerCrmRoutes(app, pool);
registerReportRoutes({ app, pool, prefixedDateField });
registerAnalyticsRoutes({ app, pool, itemDateField: ITEM_DATE_FIELD, prefixedDateField });
registerSalesDetailRoutes({ app, pool, itemDateField: ITEM_DATE_FIELD, prefixedDateField });
registerInsightsRoutes({
  app,
  pool,
  prefixedDateField,
  safeGrandTotal: SAFE_GRAND_TOTAL,
  safeProfit: SAFE_PROFIT,
  safeTotalFinanceAmt: SAFE_TOTAL_FINANCE_AMT,
  safeFinanceBalance: SAFE_FINANCE_BALANCE,
  safeFinanceFee: SAFE_FINANCE_FEE,
});

const port = Number(process.env.PORT || 5057);

async function startServer() {
  try {
    await ensureAuthSchema();
    await ensureDefaultRoles();
    await ensureDefaultAuthUser();
    await ensureCrmSchema();
  } catch (err) {
    console.error("Failed to ensure startup schema/state:", err);
  }

  app.listen(port, () => {
    console.log(`API listening on http://127.0.0.1:${port}`);
  });
}

void startServer();
