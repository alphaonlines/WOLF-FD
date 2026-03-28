import fs from "fs";
import path from "path";
import type { Express } from "express";
import type { Pool } from "pg";
import multer from "multer";

type RegisterManufacturerPricebookRoutesDeps = {
  app: Express;
  pool: Pool;
  requireOwner: (req: any, res: any, next: any) => any;
  holdingDir: string;
};

const ACCEPTED_FILE_PATTERN = /\.(pdf|csv|xlsx|xls)$/i;

function sanitizeManufacturer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\- ()]/g, "_");
}

function toNumericUserId(req: any) {
  const value = Number(req?.authUser?.id);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function registerManufacturerPricebookRoutes({
  app,
  pool,
  requireOwner,
  holdingDir,
}: RegisterManufacturerPricebookRoutesDeps) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, holdingDir),
      filename: (_req, file, cb) => cb(null, `${Date.now()}_${safeFileName(file.originalname)}`),
    }),
    fileFilter: (_req, file, cb) => {
      const ok = ACCEPTED_FILE_PATTERN.test(file.originalname);
      cb((ok ? null : new Error("Only PDF, CSV, XLS, and XLSX files are accepted")) as any, ok);
    },
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  app.get("/api/manufacturer-pricebooks/uploads", requireOwner, async (req, res) => {
    const manufacturer =
      typeof req.query?.manufacturer === "string" ? String(req.query.manufacturer).trim() : "";
    const values: any[] = [];
    const where: string[] = [];

    if (manufacturer) {
      values.push(manufacturer);
      where.push(`manufacturer = $${values.length}`);
    }

    const sql = `
      SELECT
        id,
        manufacturer,
        manufacturer_slug,
        original_name,
        storage_name,
        relative_path,
        mime_type,
        file_size_bytes,
        replace_existing,
        status,
        uploaded_by_user_id,
        created_at
      FROM manufacturer_pricebook_uploads
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const result = await pool.query(sql, values);
    res.json({
      rows: result.rows.map((row: any) => ({
        id: String(row.id ?? ""),
        manufacturer: String(row.manufacturer ?? ""),
        manufacturer_slug: String(row.manufacturer_slug ?? ""),
        original_name: String(row.original_name ?? ""),
        storage_name: String(row.storage_name ?? ""),
        relative_path: String(row.relative_path ?? ""),
        mime_type: String(row.mime_type ?? "application/octet-stream"),
        file_size_bytes: Number(row.file_size_bytes ?? 0),
        replace_existing: Boolean(row.replace_existing),
        status: String(row.status ?? "holding"),
        uploaded_by_user_id:
          row.uploaded_by_user_id === null || row.uploaded_by_user_id === undefined
            ? null
            : String(row.uploaded_by_user_id),
        created_at: row.created_at,
      })),
    });
  });

  app.post("/api/manufacturer-pricebooks/uploads", requireOwner, upload.single("file"), async (req, res) => {
    const rawFile = (req as any).file as
      | {
          originalname: string;
          filename: string;
          size: number;
          mimetype?: string;
          path?: string;
        }
      | undefined;
    if (!rawFile) return res.status(400).json({ ok: false, error: "No file uploaded" });

    const cleanupTempFile = () => {
      const tempPath = path.join(holdingDir, rawFile.filename);
      if (fs.existsSync(tempPath)) {
        try {
          fs.rmSync(tempPath, { force: true });
        } catch {
          // ignore cleanup failures
        }
      }
    };

    const manufacturer =
      typeof req.body?.manufacturer === "string" ? String(req.body.manufacturer).trim() : "";
    if (!manufacturer) {
      cleanupTempFile();
      return res.status(400).json({ ok: false, error: "manufacturer is required" });
    }

    const manufacturerSlug = sanitizeManufacturer(manufacturer);
    if (!manufacturerSlug) {
      cleanupTempFile();
      return res.status(400).json({ ok: false, error: "invalid manufacturer" });
    }

    const replaceExisting =
      req.body?.replace_existing === undefined
        ? true
        : String(req.body.replace_existing).trim().toLowerCase() !== "false";

    const manufacturerDir = path.join(holdingDir, manufacturerSlug);
    fs.mkdirSync(manufacturerDir, { recursive: true });

    const storageName = `${Date.now()}_${safeFileName(rawFile.originalname)}`;
    const sourcePath = path.join(holdingDir, rawFile.filename);
    const targetPath = path.join(manufacturerDir, storageName);
    fs.renameSync(sourcePath, targetPath);

    const relativePath = path.join(manufacturerSlug, storageName).replace(/\\/g, "/");
    const uploaderId = toNumericUserId(req);

    const inserted = await pool.query(
      `
        INSERT INTO manufacturer_pricebook_uploads (
          manufacturer,
          manufacturer_slug,
          original_name,
          storage_name,
          relative_path,
          mime_type,
          file_size_bytes,
          replace_existing,
          status,
          uploaded_by_user_id,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'holding', $9, now())
        RETURNING
          id,
          manufacturer,
          manufacturer_slug,
          original_name,
          storage_name,
          relative_path,
          mime_type,
          file_size_bytes,
          replace_existing,
          status,
          uploaded_by_user_id,
          created_at
      `,
      [
        manufacturer,
        manufacturerSlug,
        rawFile.originalname,
        storageName,
        relativePath,
        String(rawFile.mimetype || "application/octet-stream"),
        Number(rawFile.size || 0),
        replaceExisting,
        uploaderId,
      ]
    );

    const row = inserted.rows[0] || {};
    res.status(201).json({
      ok: true,
      row: {
        id: String(row.id ?? ""),
        manufacturer: String(row.manufacturer ?? manufacturer),
        manufacturer_slug: String(row.manufacturer_slug ?? manufacturerSlug),
        original_name: String(row.original_name ?? rawFile.originalname),
        storage_name: String(row.storage_name ?? storageName),
        relative_path: String(row.relative_path ?? relativePath),
        mime_type: String(row.mime_type ?? (rawFile.mimetype || "application/octet-stream")),
        file_size_bytes: Number(row.file_size_bytes ?? rawFile.size ?? 0),
        replace_existing: Boolean(row.replace_existing),
        status: String(row.status ?? "holding"),
        uploaded_by_user_id:
          row.uploaded_by_user_id === null || row.uploaded_by_user_id === undefined
            ? null
            : String(row.uploaded_by_user_id),
        created_at: row.created_at,
      },
    });
  });
}
