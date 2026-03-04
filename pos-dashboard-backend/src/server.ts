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
} from "./runtimeConfig";
import { registerAllRoutes } from "./routeWiring";

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

const { setUserRolesByKeys } = registerAllRoutes({
  app,
  pool,
  upload,
  uploadsDir,
  importerPath,
  pythonBin,
  execFileAsync,
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

  app.listen(port, () => {
    console.log(`API listening on http://127.0.0.1:${port}`);
  });
}

void startServer();
