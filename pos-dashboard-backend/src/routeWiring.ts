import type { Express } from "express";
import type { Pool } from "pg";
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
import {
  type AuthUserView,
  buildAuthUser,
  clearAuthCookie,
  hasAnyRole,
  normalizeRoleList,
  parseCookies,
  setAuthCookie,
} from "./authSessionUtils";
import { createAuthDbHelpers } from "./authDb";

type ExecFileAsyncLike = (
  file: string,
  args?: readonly string[] | null,
  options?: { timeout?: number }
) => Promise<{ stdout?: string | Buffer; stderr?: string | Buffer }>;

type UploadLike = {
  array: (fieldName: string, maxCount?: number) => any;
};

type RegisterAllRoutesDeps = {
  app: Express;
  pool: Pool;
  upload: UploadLike;
  uploadsDir: string;
  importerPath: string;
  pythonBin: string;
  execFileAsync: ExecFileAsyncLike;
  authCookieName: string;
  authSessionDays: number;
  authCookieSecureMode: string;
  publicAuthPaths: Set<string>;
  verifyPassword: (password: string, storedHash: string) => boolean;
  hashPassword: (password: string, saltHex?: string) => string;
  sha256Hex: (value: string) => string;
  createSessionToken: () => string;
};

const toRouteAuthUser = (user: AuthUserView | null | undefined) => {
  if (!user) return null;
  return {
    id: String(user.id),
    name: String(user.name),
    email: String(user.email),
    roles: (user.roles || []).map((role) => String(role)),
    permissions: (user.permissions || []).map((permission) => String(permission)),
  };
};

export function registerAllRoutes({
  app,
  pool,
  upload,
  uploadsDir,
  importerPath,
  pythonBin,
  execFileAsync,
  authCookieName,
  authSessionDays,
  authCookieSecureMode,
  publicAuthPaths,
  verifyPassword,
  hashPassword,
  sha256Hex,
  createSessionToken,
}: RegisterAllRoutesDeps) {
  const { currentAuthUserFromReq, setUserRolesByKeys, loadAuthUserById } = createAuthDbHelpers({
    pool,
    authCookieName,
    parseCookies,
    sha256Hex,
    buildAuthUser,
    normalizeRoleList,
  });

  registerAuthRoutes({
    app,
    pool,
    authSessionDays,
    authCookieName,
    publicAuthPaths,
    verifyPassword,
    hashPassword,
    sha256Hex,
    createSessionToken,
    setAuthCookie: (res: any, token: string, req: any) =>
      setAuthCookie(res, token, req, {
        authCookieName,
        authSessionDays,
        authCookieSecureMode,
      }),
    clearAuthCookie: (res: any, req: any) =>
      clearAuthCookie(res, req, {
        authCookieName,
        authCookieSecureMode,
      }),
    parseCookies,
    currentAuthUserFromReq,
    loadAuthUserById: async (userId: number) => toRouteAuthUser(await loadAuthUserById(userId)),
    buildAuthUser: (row: any) => toRouteAuthUser(buildAuthUser(row))!,
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
    loadAuthUserById: async (userId: number) => toRouteAuthUser(await loadAuthUserById(userId)),
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

  return { setUserRolesByKeys };
}
