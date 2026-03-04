import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
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
import { createUpload } from "./uploadSetup";
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
import { createSessionToken, hashPassword, sha256Hex, verifyPassword } from "./authCrypto";
import {
  envString,
  createPoolFromEnv,
  AUTH_COOKIE_NAME,
  AUTH_SESSION_DAYS,
  AUTH_COOKIE_SECURE_MODE,
  PUBLIC_AUTH_PATHS,
  PYTHON_BIN,
  PORT,
} from "./runtimeConfig";

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
const pythonBin = PYTHON_BIN;

const upload = createUpload(uploadsDir);
const pool = createPoolFromEnv();

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
  createSessionToken,
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

const port = PORT;

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
