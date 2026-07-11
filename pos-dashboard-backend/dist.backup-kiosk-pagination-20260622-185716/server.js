"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: "/home/alphahs/WOLF-CENTRAL.env" });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const startupBootstrap_1 = require("./startupBootstrap");
const uploadSetup_1 = require("./uploadSetup");
const meetingSignaling_1 = require("./meetingSignaling");
const authCrypto_1 = require("./authCrypto");
const runtimeConfig_1 = require("./runtimeConfig");
const routeWiring_1 = require("./routeWiring");
const socialPublishing_1 = require("./socialPublishing");
const boardAiAgent_1 = require("./boardAiAgent");
const DASHBOARD_LOCKED = false;
const DASHBOARD_NOTICE = "System down until further notice.";
const app = (0, express_1.default)();
exports.app = app;
app.set("trust proxy", 1);
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
app.use(express_1.default.json({ limit: "25mb" }));
app.use((req, res, next) => {
    if (!DASHBOARD_LOCKED) {
        next();
        return;
    }
    if (req.path === "/health") {
        next();
        return;
    }
    if (req.path.startsWith("/api/")) {
        res.status(503).json({
            ok: false,
            error: "system_down",
            message: DASHBOARD_NOTICE,
        });
        return;
    }
    next();
});
const uploadsDir = path_1.default.resolve(__dirname, "..", "incoming");
fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const manufacturerPricebookHoldingDir = path_1.default.resolve(__dirname, "..", "manufacturer-pricebooks", "holding");
fs_1.default.mkdirSync(manufacturerPricebookHoldingDir, { recursive: true });
const boardUploadsDir = path_1.default.resolve(__dirname, "..", "board-uploads");
fs_1.default.mkdirSync(boardUploadsDir, { recursive: true });
const socialUploadsDir = path_1.default.resolve(__dirname, "..", "social-uploads");
fs_1.default.mkdirSync(socialUploadsDir, { recursive: true });
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const importerPath = path_1.default.resolve(__dirname, "..", "importer", "import_pos_xlsx.py");
const pythonBin = runtimeConfig_1.PYTHON_BIN;
const upload = (0, uploadSetup_1.createUpload)(uploadsDir);
const pool = (0, runtimeConfig_1.createPoolFromEnv)();
const socialPublisher = (0, socialPublishing_1.createSocialPublisher)({
    pool,
    publicBaseUrl: runtimeConfig_1.SOCIAL_PUBLIC_BASE_URL,
});
const { setUserRolesByKeys } = (0, routeWiring_1.registerAllRoutes)({
    app,
    pool,
    upload,
    uploadsDir,
    manufacturerPricebookHoldingDir,
    boardUploadsDir,
    importerPath,
    pythonBin,
    execFileAsync,
    socialUploadsDir,
    socialPublicBaseUrl: runtimeConfig_1.SOCIAL_PUBLIC_BASE_URL,
    runSocialDueJobsOnce: (maxJobs) => socialPublisher.runDueJobsOnce(maxJobs),
    authCookieName: runtimeConfig_1.AUTH_COOKIE_NAME,
    authSessionDays: runtimeConfig_1.AUTH_SESSION_DAYS,
    authCookieSecureMode: runtimeConfig_1.AUTH_COOKIE_SECURE_MODE,
    publicAuthPaths: runtimeConfig_1.PUBLIC_AUTH_PATHS,
    verifyPassword: authCrypto_1.verifyPassword,
    hashPassword: authCrypto_1.hashPassword,
    sha256Hex: authCrypto_1.sha256Hex,
    createSessionToken: authCrypto_1.createSessionToken,
});
const port = runtimeConfig_1.PORT;
async function startServer() {
    try {
        await (0, startupBootstrap_1.runStartupBootstrap)({
            pool,
            envString: runtimeConfig_1.envString,
            hashPassword: authCrypto_1.hashPassword,
            setUserRolesByKeys,
        });
    }
    catch (err) {
        console.error("Failed to ensure startup schema/state:", err);
    }
    if (runtimeConfig_1.SOCIAL_SCHEDULER_ENABLED) {
        setInterval(() => {
            void socialPublisher.runDueJobsOnce(5).catch((error) => {
                console.error("Social scheduler tick failed:", error);
            });
        }, runtimeConfig_1.SOCIAL_SCHEDULER_INTERVAL_MS);
        setTimeout(() => {
            void socialPublisher.runDueJobsOnce(5).catch((error) => {
                console.error("Initial social scheduler run failed:", error);
            });
        }, 5000);
    }
    (0, boardAiAgent_1.startBoardAiAgent)(pool);
    const httpServer = http_1.default.createServer(app);
    (0, meetingSignaling_1.attachMeetingSignaling)(httpServer);
    httpServer.listen(port, () => {
        console.log(`API listening on http://127.0.0.1:${port}`);
    });
}
if (require.main === module) {
    void startServer();
}
//# sourceMappingURL=server.js.map