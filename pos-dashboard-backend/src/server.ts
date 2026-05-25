import "dotenv/config";
import dotenv from "dotenv";

const extraEnvFile = process.env.WOLF_FD_DOTENV_FILE;
if (extraEnvFile) {
  dotenv.config({ path: extraEnvFile });
}

import http from "http";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { runStartupBootstrap } from "./startupBootstrap";
import { createUpload } from "./uploadSetup";
import { attachMeetingSignaling } from "./meetingSignaling";
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
  SOCIAL_PUBLIC_BASE_URL,
  SOCIAL_SCHEDULER_ENABLED,
  SOCIAL_SCHEDULER_INTERVAL_MS,
  STRIPE_TOPUP_WEBHOOK_PATH,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_API_KEY,
  BOTBOT_STRIPE_PUBLIC_BASE_URL,
  BOTBOT_STRIPE_DEFAULT_MODEL_KEY,
  BOTBOT_LEDGER_TOKEN,
  DEN_RECORDINGS_DIR,
} from "./runtimeConfig";
import { registerAllRoutes } from "./routeWiring";
import { createSocialPublisher } from "./socialPublishing";
import { startBoardAiAgent } from "./boardAiAgent";

const DASHBOARD_LOCKED = false;
const DASHBOARD_NOTICE = "System down until further notice.";

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({
  limit: "25mb",
  type: (req) => {
    const url = typeof req.url === "string" ? req.url : "";
    return !url.startsWith(STRIPE_TOPUP_WEBHOOK_PATH);
  },
}));
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

const uploadsDir = path.resolve(__dirname, "..", "incoming");
fs.mkdirSync(uploadsDir, { recursive: true });
const manufacturerPricebookHoldingDir = path.resolve(__dirname, "..", "manufacturer-pricebooks", "holding");
fs.mkdirSync(manufacturerPricebookHoldingDir, { recursive: true });
const boardUploadsDir = path.resolve(__dirname, "..", "board-uploads");
fs.mkdirSync(boardUploadsDir, { recursive: true });
const socialUploadsDir = path.resolve(__dirname, "..", "social-uploads");
fs.mkdirSync(socialUploadsDir, { recursive: true });
const denRecordingsDir = path.resolve(DEN_RECORDINGS_DIR);
fs.mkdirSync(denRecordingsDir, { recursive: true });
const execFileAsync = promisify(execFile);
const importerPath = path.resolve(__dirname, "..", "importer", "import_pos_xlsx.py");
const pythonBin = PYTHON_BIN;

const upload = createUpload(uploadsDir);
const pool = createPoolFromEnv();
const socialPublisher = createSocialPublisher({
  pool,
  publicBaseUrl: SOCIAL_PUBLIC_BASE_URL,
});

const { setUserRolesByKeys } = registerAllRoutes({
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
  denRecordingsDir,
  socialPublicBaseUrl: SOCIAL_PUBLIC_BASE_URL,
  runSocialDueJobsOnce: (maxJobs?: number) => socialPublisher.runDueJobsOnce(maxJobs),
  authCookieName: AUTH_COOKIE_NAME,
  authSessionDays: AUTH_SESSION_DAYS,
  authCookieSecureMode: AUTH_COOKIE_SECURE_MODE,
  publicAuthPaths: PUBLIC_AUTH_PATHS,
  verifyPassword,
  hashPassword,
  sha256Hex,
  createSessionToken,
  stripeTopupWebhookPath: STRIPE_TOPUP_WEBHOOK_PATH,
  stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,
  stripeApiKey: STRIPE_API_KEY,
  botbotStripePublicBaseUrl: BOTBOT_STRIPE_PUBLIC_BASE_URL,
  botbotStripeDefaultModelKey: BOTBOT_STRIPE_DEFAULT_MODEL_KEY,
  botbotLedgerToken: BOTBOT_LEDGER_TOKEN,
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

  if (SOCIAL_SCHEDULER_ENABLED) {
    setInterval(() => {
      void socialPublisher.runDueJobsOnce(5).catch((error) => {
        console.error("Social scheduler tick failed:", error);
      });
    }, SOCIAL_SCHEDULER_INTERVAL_MS);
    setTimeout(() => {
      void socialPublisher.runDueJobsOnce(5).catch((error) => {
        console.error("Initial social scheduler run failed:", error);
      });
    }, 5000);
  }

  startBoardAiAgent(pool);

  const httpServer = http.createServer(app);
  attachMeetingSignaling(httpServer);
  httpServer.listen(port, () => {
    console.log(`API listening on http://127.0.0.1:${port}`);
  });
}

if (require.main === module) {
  void startServer();
}

export { app };
