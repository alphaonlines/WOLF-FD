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
import { registerSystemRoutes } from "./routes/systemRoutes";
import { runStartupBootstrap } from "./startupBootstrap";
import {
  type AuthUserView,
  normalizeRoleList,
  hasAnyRole,
  buildAuthUser,
  parseCookies,
  setAuthCookie,
  clearAuthCookie,
} from "./authSessionUtils";
import { createAuthDbHelpers } from "./authDb";

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
const importerPath = path.resolve(__dirname, "..", "importer", "import_pos_xlsx.py");
const pythonBin = process.env.POS_IMPORT_PYTHON || "python";

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
const PUBLIC_AUTH_PATHS = new Set(["/auth/login", "/auth/logout", "/auth/me"]);

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

const { currentAuthUserFromReq, setUserRolesByKeys, loadAuthUserById } = createAuthDbHelpers({
  pool,
  authCookieName: AUTH_COOKIE_NAME,
  parseCookies,
  sha256Hex,
  buildAuthUser,
  normalizeRoleList,
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
  setAuthCookie: (res: any, token: string, req: any) =>
    setAuthCookie(res, token, req, {
      authCookieName: AUTH_COOKIE_NAME,
      authSessionDays: AUTH_SESSION_DAYS,
      authCookieSecureMode: AUTH_COOKIE_SECURE_MODE,
    }),
  clearAuthCookie: (res: any, req: any) =>
    clearAuthCookie(res, req, {
      authCookieName: AUTH_COOKIE_NAME,
      authCookieSecureMode: AUTH_COOKIE_SECURE_MODE,
    }),
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
registerSystemRoutes({
  app,
  pool,
  upload,
  uploadsDir,
  importerPath,
  pythonBin,
  execFileAsync,
});

const port = Number(process.env.PORT || 5057);

async function startServer() {
  try {
    await runStartupBootstrap({
      pool,
      envString,
      hashPassword,
      setUserRolesByKeys,
    });
  } catch (err) {
    console.error("Failed to ensure startup schema/state:", err);
  }

  app.listen(port, () => {
    console.log(`API listening on http://127.0.0.1:${port}`);
  });
}

void startServer();
