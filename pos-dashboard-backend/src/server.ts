import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { runStartupBootstrap } from "./startupBootstrap";
import { createUpload } from "./uploadSetup";
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
} from "./runtimeConfig";
import { registerAllRoutes } from "./routeWiring";
import { createSocialPublisher } from "./socialPublishing";

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
const socialUploadsDir = path.resolve(__dirname, "..", "social-uploads");
fs.mkdirSync(socialUploadsDir, { recursive: true });
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
  importerPath,
  pythonBin,
  execFileAsync,
  socialUploadsDir,
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

  app.listen(port, () => {
    console.log(`API listening on http://127.0.0.1:${port}`);
  });
}

void startServer();
