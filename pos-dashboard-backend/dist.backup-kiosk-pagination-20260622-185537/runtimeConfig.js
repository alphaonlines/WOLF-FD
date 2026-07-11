"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOTBOT_ENABLED = exports.OPENAI_BALANCED_MODEL = exports.OPENAI_FAST_MODEL = exports.OPENAI_BASE_URL = exports.OPENAI_API_KEY = exports.BOTBOT_LEDGER_TOKEN = exports.BOTBOT_LOCAL_AI_TOKEN = exports.BOTBOT_LOCAL_AI_URL = exports.ANTHROPIC_API_KEY = exports.OLLAMA_PRIMARY_MODEL = exports.OLLAMA_PRIMARY_NODE_LABEL = exports.OLLAMA_BASE_URL = exports.resolveOllamaNode = exports.OLLAMA_NODE_CONFIGS = exports.DEFAULT_OLLAMA_NODE_KEY = exports.SOCIAL_SCHEDULER_INTERVAL_MS = exports.SOCIAL_SCHEDULER_ENABLED = exports.SOCIAL_PUBLIC_BASE_URL = exports.PORT = exports.PYTHON_BIN = exports.GOOGLE_WORKSPACE_DOMAIN = exports.GOOGLE_WORKSPACE_CLIENT_ID = exports.PUBLIC_AUTH_PATHS = exports.AUTH_COOKIE_SECURE_MODE = exports.AUTH_SESSION_DAYS = exports.AUTH_COOKIE_NAME = exports.envString = void 0;
exports.createPoolFromEnv = createPoolFromEnv;
const pg_1 = require("pg");
const envString = (key, fallback) => {
    const value = process.env[key];
    if (typeof value === "string" && value.trim())
        return value.trim();
    return fallback;
};
exports.envString = envString;
function createPoolFromEnv() {
    return new pg_1.Pool({
        host: (0, exports.envString)("PGHOST", "127.0.0.1"),
        port: Number((0, exports.envString)("PGPORT", "5432")),
        database: (0, exports.envString)("PGDATABASE", "salesdb"),
        user: (0, exports.envString)("PGUSER", "salesapp"),
        password: (0, exports.envString)("PGPASSWORD", "dev_password_change_me"),
    });
}
exports.AUTH_COOKIE_NAME = "fd_session";
exports.AUTH_SESSION_DAYS = Math.max(Number((0, exports.envString)("AUTH_SESSION_DAYS", "14")) || 14, 1);
exports.AUTH_COOKIE_SECURE_MODE = ((0, exports.envString)("AUTH_COOKIE_SECURE", "auto") || "auto").toLowerCase();
exports.PUBLIC_AUTH_PATHS = new Set([
    "/auth/login",
    "/auth/logout",
    "/auth/me",
    "/auth/config",
    "/auth/google/start",
    "/auth/google/verify-domain",
    "/auth/google/request-access",
    "/botbot/external/usage",
    "/botbot/external/usage-status",
]);
exports.GOOGLE_WORKSPACE_CLIENT_ID = (0, exports.envString)("GOOGLE_WORKSPACE_CLIENT_ID", "");
exports.GOOGLE_WORKSPACE_DOMAIN = ((0, exports.envString)("GOOGLE_WORKSPACE_DOMAIN", "furnituredistributors.net") || "furnituredistributors.net").toLowerCase();
exports.PYTHON_BIN = process.env.POS_IMPORT_PYTHON || "python";
exports.PORT = Number(process.env.PORT || 5057);
exports.SOCIAL_PUBLIC_BASE_URL = (0, exports.envString)("SOCIAL_PUBLIC_BASE_URL", "https://furnituredistributors.wolf.discount/fd/api") ||
    "https://furnituredistributors.wolf.discount/fd/api";
exports.SOCIAL_SCHEDULER_ENABLED = ((0, exports.envString)("SOCIAL_SCHEDULER_ENABLED", "true") || "true").toLowerCase() !== "false";
exports.SOCIAL_SCHEDULER_INTERVAL_MS = Math.max(Number((0, exports.envString)("SOCIAL_SCHEDULER_INTERVAL_MS", "60000")) || 60000, 15000);
exports.DEFAULT_OLLAMA_NODE_KEY = (0, exports.envString)("DEFAULT_OLLAMA_NODE_KEY", "msi-5070ti") ?? "msi-5070ti";
exports.OLLAMA_NODE_CONFIGS = [
    {
        key: "msi-5070ti",
        label: "5070 Ti",
        host: "MSILaptop (.80)",
        baseUrl: (0, exports.envString)("OLLAMA_NODE_MSI_URL", "http://192.168.4.80:11434") ?? "http://192.168.4.80:11434",
        description: "Primary GPU thinker with the RTX 5070 Ti laptop GPU.",
    },
    {
        key: "alphabs",
        label: "alphabs",
        host: "alphabs (.187)",
        baseUrl: (0, exports.envString)("OLLAMA_NODE_ALPHABS_URL", "http://192.168.4.187:11434") ?? "http://192.168.4.187:11434",
        description: "Secondary Linux worker for CPU-side model tasks.",
    },
    {
        key: "alphabs1",
        label: "alphabs1",
        host: "alphabs1 (.174)",
        baseUrl: (0, exports.envString)("OLLAMA_NODE_ALPHABS1_URL", "http://192.168.4.174:11434") ?? "http://192.168.4.174:11434",
        description: "Secondary Linux worker for CPU-side model tasks.",
    },
    {
        key: "alphahs",
        label: "alphahs",
        host: "alphahs (local)",
        baseUrl: (0, exports.envString)("OLLAMA_NODE_ALPHAHS_URL", "http://127.0.0.1:11434") ?? "http://127.0.0.1:11434",
        description: "Local dashboard host for orchestration or light model work.",
    },
];
const resolveOllamaNode = (nodeKey) => exports.OLLAMA_NODE_CONFIGS.find((node) => node.key === nodeKey) ??
    exports.OLLAMA_NODE_CONFIGS.find((node) => node.key === exports.DEFAULT_OLLAMA_NODE_KEY) ??
    exports.OLLAMA_NODE_CONFIGS[0];
exports.resolveOllamaNode = resolveOllamaNode;
exports.OLLAMA_BASE_URL = (0, exports.resolveOllamaNode)(exports.DEFAULT_OLLAMA_NODE_KEY).baseUrl;
exports.OLLAMA_PRIMARY_NODE_LABEL = `${(0, exports.resolveOllamaNode)(exports.DEFAULT_OLLAMA_NODE_KEY).host}`;
exports.OLLAMA_PRIMARY_MODEL = (0, exports.envString)("OLLAMA_PRIMARY_MODEL", "gemma4:e4b-it-q4_K_M") ??
    "gemma4:e4b-it-q4_K_M";
exports.ANTHROPIC_API_KEY = (0, exports.envString)("ANTHROPIC_API_KEY", "") ?? "";
exports.BOTBOT_LOCAL_AI_URL = (0, exports.envString)("BOTBOT_LOCAL_AI_URL", "http://192.168.4.80:3000") ??
    "http://192.168.4.80:3000";
exports.BOTBOT_LOCAL_AI_TOKEN = (0, exports.envString)("BOTBOT_LOCAL_AI_TOKEN", "") ?? "";
exports.BOTBOT_LEDGER_TOKEN = (0, exports.envString)("BOTBOT_LEDGER_TOKEN", "") ?? "";
exports.OPENAI_API_KEY = (0, exports.envString)("OPENAI_API_KEY", "") ?? "";
exports.OPENAI_BASE_URL = (0, exports.envString)("OPENAI_BASE_URL", "https://api.openai.com/v1") ??
    "https://api.openai.com/v1";
exports.OPENAI_FAST_MODEL = (0, exports.envString)("OPENAI_FAST_MODEL", "gpt-4o-mini") ?? "gpt-4o-mini";
exports.OPENAI_BALANCED_MODEL = (0, exports.envString)("OPENAI_BALANCED_MODEL", "gpt-4o") ?? "gpt-4o";
exports.BOTBOT_ENABLED = (0, exports.envString)("BOTBOT_ENABLED", "true") === "true";
//# sourceMappingURL=runtimeConfig.js.map