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
  "/botbot/external/usage",
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

export type OllamaNodeKey = "msi-5070ti" | "alphabs" | "alphabs1" | "alphahs";

export type OllamaNodeConfig = {
  key: OllamaNodeKey;
  label: string;
  host: string;
  baseUrl: string;
  description: string;
};

export const DEFAULT_OLLAMA_NODE_KEY =
  (envString("DEFAULT_OLLAMA_NODE_KEY", "msi-5070ti") as OllamaNodeKey) ?? "msi-5070ti";

export const OLLAMA_NODE_CONFIGS: OllamaNodeConfig[] = [
  {
    key: "msi-5070ti",
    label: "5070 Ti",
    host: "MSILaptop (.80)",
    baseUrl: envString("OLLAMA_NODE_MSI_URL", "http://192.168.4.80:11434") ?? "http://192.168.4.80:11434",
    description: "Primary GPU thinker with the RTX 5070 Ti laptop GPU.",
  },
  {
    key: "alphabs",
    label: "alphabs",
    host: "alphabs (.187)",
    baseUrl: envString("OLLAMA_NODE_ALPHABS_URL", "http://192.168.4.187:11434") ?? "http://192.168.4.187:11434",
    description: "Secondary Linux worker for CPU-side model tasks.",
  },
  {
    key: "alphabs1",
    label: "alphabs1",
    host: "alphabs1 (.174)",
    baseUrl: envString("OLLAMA_NODE_ALPHABS1_URL", "http://192.168.4.174:11434") ?? "http://192.168.4.174:11434",
    description: "Secondary Linux worker for CPU-side model tasks.",
  },
  {
    key: "alphahs",
    label: "alphahs",
    host: "alphahs (local)",
    baseUrl: envString("OLLAMA_NODE_ALPHAHS_URL", "http://127.0.0.1:11434") ?? "http://127.0.0.1:11434",
    description: "Local dashboard host for orchestration or light model work.",
  },
];

export const resolveOllamaNode = (nodeKey?: string): OllamaNodeConfig =>
  OLLAMA_NODE_CONFIGS.find((node) => node.key === nodeKey) ??
  OLLAMA_NODE_CONFIGS.find((node) => node.key === DEFAULT_OLLAMA_NODE_KEY) ??
  OLLAMA_NODE_CONFIGS[0];

export const OLLAMA_BASE_URL = resolveOllamaNode(DEFAULT_OLLAMA_NODE_KEY).baseUrl;
export const OLLAMA_PRIMARY_NODE_LABEL =
  `${resolveOllamaNode(DEFAULT_OLLAMA_NODE_KEY).host}`;
export const OLLAMA_PRIMARY_MODEL =
  envString("OLLAMA_PRIMARY_MODEL", "gemma4:e4b-it-q4_K_M") ??
  "gemma4:e4b-it-q4_K_M";
export const ANTHROPIC_API_KEY = envString("ANTHROPIC_API_KEY", "") ?? "";
export const BOTBOT_LOCAL_AI_URL =
  envString("BOTBOT_LOCAL_AI_URL", "http://192.168.4.80:3000") ??
  "http://192.168.4.80:3000";
export const BOTBOT_LOCAL_AI_TOKEN =
  envString("BOTBOT_LOCAL_AI_TOKEN", "") ?? "";
export const BOTBOT_LEDGER_TOKEN =
  envString("BOTBOT_LEDGER_TOKEN", "") ?? "";
export const OPENAI_API_KEY = envString("OPENAI_API_KEY", "") ?? "";
export const OPENAI_BASE_URL =
  envString("OPENAI_BASE_URL", "https://api.openai.com/v1") ??
  "https://api.openai.com/v1";
export const OPENAI_FAST_MODEL =
  envString("OPENAI_FAST_MODEL", "gpt-4o-mini") ?? "gpt-4o-mini";
export const OPENAI_BALANCED_MODEL =
  envString("OPENAI_BALANCED_MODEL", "gpt-4o") ?? "gpt-4o";
export const BOTBOT_ENABLED = envString("BOTBOT_ENABLED", "true") === "true";
