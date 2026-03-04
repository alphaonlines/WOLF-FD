import fs from "fs";
import path from "path";
import type { Express } from "express";
import type { Pool } from "pg";

type UploadLike = {
  array: (fieldName: string, maxCount?: number) => any;
};

type ExecFileAsyncLike = (
  file: string,
  args?: readonly string[] | null,
  options?: { timeout?: number }
) => Promise<{ stdout?: string | Buffer; stderr?: string | Buffer }>;

type RegisterSystemRoutesDeps = {
  app: Express;
  pool: Pool;
  upload: UploadLike;
  uploadsDir: string;
  importerPath: string;
  pythonBin: string;
  execFileAsync: ExecFileAsyncLike;
};

export function registerSystemRoutes({
  app,
  pool,
  upload,
  uploadsDir,
  importerPath,
  pythonBin,
  execFileAsync,
}: RegisterSystemRoutesDeps) {
  // Health
  app.get("/health", async (_req, res) => {
    const r = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: r.rows[0].ok });
  });

  app.post("/api/import/upload", upload.array("files", 25), async (req, res) => {
    const rawFiles = (req as any).files as Array<{ originalname: string; filename: string; size: number }> | undefined;
    const files = Array.isArray(rawFiles) ? rawFiles : [];
    if (!files.length) {
      res.status(400).json({ ok: false, error: "No files uploaded" });
      return;
    }

    let importOutput = "";
    let importError = "";
    const tempDir = fs.mkdtempSync(path.join(uploadsDir, "upload-"));

    try {
      for (const file of files) {
        const src = path.join(uploadsDir, file.filename);
        const dest = path.join(tempDir, file.filename);
        if (fs.existsSync(src)) {
          fs.renameSync(src, dest);
        }
      }

      const { stdout, stderr } = await execFileAsync(
        pythonBin,
        [importerPath, "--incoming", tempDir, "--no-move"],
        { timeout: 5 * 60 * 1000 }
      );

      importOutput = stdout?.toString() || "";
      importError = stderr?.toString() || "";
    } catch (err: any) {
      importError = err?.stderr?.toString?.() || String(err?.message || err);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }

    res.json({
      ok: true,
      saved_to: uploadsDir,
      files: files.map((f) => ({
        original_name: f.originalname,
        stored_name: f.filename,
        size: f.size,
      })),
      import: {
        ok: importError ? false : true,
        stdout: importOutput,
        stderr: importError,
      },
    });
  });
}
