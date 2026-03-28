import { Pool } from "pg";

export const envString = (key: string, fallback?: string) => {
  const value = process.env[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
};

export function createPoolFromEnv() {
  return new Pool({
    host: envString("PGHOST", "127.0.0.1"),
    port: Number(envString("PGPORT", "5432")),
    database: envString("PGDATABASE", "salesdb"),
    user: envString("PGUSER", "salesapp"),
    password: envString("PGPASSWORD", "dev_password_change_me"),
  });
}

export const AUTH_COOKIE_NAME = "fd_session";
export const AUTH_SESSION_DAYS = Math.max(Number(envString("AUTH_SESSION_DAYS", "14")) || 14, 1);
export const AUTH_COOKIE_SECURE_MODE = (envString("AUTH_COOKIE_SECURE", "auto") || "auto").toLowerCase();
export const PUBLIC_AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/logout",
  "/auth/me",
  "/auth/config",
  "/auth/google/start",
  "/auth/google/request-access",
]);
export const GOOGLE_WORKSPACE_CLIENT_ID = envString("GOOGLE_WORKSPACE_CLIENT_ID", "");
export const GOOGLE_WORKSPACE_DOMAIN = (envString("GOOGLE_WORKSPACE_DOMAIN", "furnituredistributors.net") || "furnituredistributors.net").toLowerCase();

export const PYTHON_BIN = process.env.POS_IMPORT_PYTHON || "python";
export const PORT = Number(process.env.PORT || 5057);
export const SOCIAL_PUBLIC_BASE_URL =
  envString("SOCIAL_PUBLIC_BASE_URL", "https://furnituredistributors.wolf.discount/fd/api") ||
  "https://furnituredistributors.wolf.discount/fd/api";
export const SOCIAL_SCHEDULER_ENABLED = (envString("SOCIAL_SCHEDULER_ENABLED", "true") || "true").toLowerCase() !== "false";
export const SOCIAL_SCHEDULER_INTERVAL_MS = Math.max(
  Number(envString("SOCIAL_SCHEDULER_INTERVAL_MS", "60000")) || 60000,
  15000
);
