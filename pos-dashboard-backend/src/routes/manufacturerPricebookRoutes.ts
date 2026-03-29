import fs from "fs";
import path from "path";
import type { Express } from "express";
import type { Pool, PoolClient } from "pg";
import multer from "multer";
import {
  isBestResidentialWorkbook,
  parseBestPricebookWorkbook,
  parseBestReferenceNotes,
} from "../parsers/bestPricebook";
import { parseEnglandPricebookPdf, parseEnglandReferenceNotes } from "../parsers/englandPricebook";
import {
  type ParsedManufacturerCatalogRow,
  parseLibertyPricebookPdf,
  parseLibertyReferenceNotesFromPdf,
} from "../parsers/libertyPricebook";

type ExecFileAsyncLike = (
  file: string,
  args?: readonly string[] | null,
  options?: { timeout?: number }
) => Promise<{ stdout?: string | Buffer; stderr?: string | Buffer }>;

type UploadFileRow = {
  id?: number | string;
  manufacturer: string;
  manufacturerSlug: string;
  originalName: string;
  storageName: string;
  relativePath: string;
  documentType: string;
  mimeType: string;
  fileSizeBytes: number;
  replaceExisting: boolean;
  uploadedByUserId: number | null;
  parentUploadId?: number | null;
  status?: string;
  parsedRowCount?: number;
  lastError?: string | null;
  extractedFileCount?: number;
};

type RegisterManufacturerPricebookRoutesDeps = {
  app: Express;
  pool: Pool;
  requireOwner: (req: any, res: any, next: any) => any;
  holdingDir: string;
  execFileAsync: ExecFileAsyncLike;
};

const ACCEPTED_FILE_PATTERN = /\.(pdf|csv|xlsx|xls|zip)$/i;

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

function inferDocumentType(originalName: string, explicitType?: string) {
  const normalizedExplicit = normalizeText(explicitType).toLowerCase();
  if (normalizedExplicit && normalizedExplicit !== "auto") return normalizedExplicit;
  const lower = originalName.toLowerCase();
  if (lower.endsWith(".zip")) return "archive";
  if (lower.includes("warranty")) return "warranty";
  if (lower.includes("freight")) return "freight_policy";
  if (lower.includes("return")) return "return_policy";
  if (lower.includes("assembly")) return "assembly";
  return "pricebook";
}

function getUploadSelectionScore(uploadRow: any) {
  let score = 0;
  const name = `${String(uploadRow.original_name || "")} ${String(uploadRow.storage_name || "")}`.toLowerCase();
  const documentType = String(uploadRow.document_type || "pricebook").toLowerCase();
  if (documentType === "archive") score -= 1000;
  if (uploadRow.parent_upload_id) score += 25;
  if (/\.xlsx?$/.test(name)) score += 250;
  if (/\.csv$/.test(name)) score += 120;
  if (/residential price list/.test(name)) score += 600;
  if (/price[_ -]?list|pricebook/.test(name)) score += 180;
  if (/compressed/.test(name)) score += 20;
  if (/warranty/.test(name)) score -= 100;
  if (/diamond/.test(name)) score -= 120;
  if (/fabric/.test(name)) score -= 120;
  if (/grade change|cheat sheet/.test(name)) score -= 140;
  return score;
}

async function loadUploadChildren(pool: Pool, parentUploadId: number) {
  const result = await pool.query(
    `
      SELECT
        id,
        manufacturer,
        manufacturer_slug,
        original_name,
        storage_name,
        relative_path,
        document_type,
        mime_type,
        file_size_bytes,
        replace_existing,
        status,
        parsed_row_count,
        last_error,
        previewed_at,
        published_at,
        uploaded_by_user_id,
        parent_upload_id,
        extracted_file_count,
        created_at
      FROM manufacturer_pricebook_uploads
      WHERE parent_upload_id = $1
      ORDER BY created_at DESC
    `,
    [parentUploadId]
  );
  return result.rows;
}

function choosePreferredUploadCandidate(rows: any[]) {
  return [...rows].sort((left, right) => getUploadSelectionScore(right) - getUploadSelectionScore(left))[0] || null;
}

async function resolveUploadRowForProcessing(pool: Pool, uploadRow: any) {
  const documentType = String(uploadRow.document_type || "pricebook").toLowerCase();
  if (documentType === "archive") {
    const children = await loadUploadChildren(pool, Number(uploadRow.id));
    const usableChildren = children.filter((row) => String(row.document_type || "").toLowerCase() !== "archive");
    return choosePreferredUploadCandidate(usableChildren) || uploadRow;
  }

  const manufacturerSlug = String(uploadRow.manufacturer_slug || "").trim().toLowerCase();
  if (manufacturerSlug === "best" && uploadRow.parent_upload_id) {
    const siblings = await loadUploadChildren(pool, Number(uploadRow.parent_upload_id));
    const usableSiblings = siblings.filter((row) => String(row.document_type || "").toLowerCase() !== "archive");
    return choosePreferredUploadCandidate(usableSiblings) || uploadRow;
  }

  return uploadRow;
}

function toNumericUserId(req: any) {
  const value = Number(req?.authUser?.id);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseNumericInput(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: any) {
  return String(value ?? "").trim();
}

function normalizeTextArray(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .slice(0, 50);
}

function buildSearchText(row: ParsedManufacturerCatalogRow) {
  return [
    row.manufacturer,
    row.collectionCode,
    row.collectionName,
    row.category,
    row.productType,
    row.sku,
    row.description,
    row.colorFinish,
    row.colorFamily,
    row.material,
    row.shape,
    row.dimensionsText,
    row.upholsteryCover,
    ...row.featureTags,
    ...row.searchKeywords,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapUploadRow(row: any) {
  return {
    id: String(row.id ?? ""),
    manufacturer: String(row.manufacturer ?? ""),
    manufacturer_slug: String(row.manufacturer_slug ?? ""),
    original_name: String(row.original_name ?? ""),
    storage_name: String(row.storage_name ?? ""),
    relative_path: String(row.relative_path ?? ""),
    document_type: String(row.document_type ?? "pricebook"),
    mime_type: String(row.mime_type ?? "application/octet-stream"),
    file_size_bytes: Number(row.file_size_bytes ?? 0),
    replace_existing: Boolean(row.replace_existing),
    status: String(row.status ?? "holding"),
    parsed_row_count: Number(row.parsed_row_count ?? 0),
    last_error: row.last_error ? String(row.last_error) : "",
    previewed_at: row.previewed_at || null,
    published_at: row.published_at || null,
    uploaded_by_user_id:
      row.uploaded_by_user_id === null || row.uploaded_by_user_id === undefined
        ? null
        : String(row.uploaded_by_user_id),
    parent_upload_id:
      row.parent_upload_id === null || row.parent_upload_id === undefined
        ? null
        : String(row.parent_upload_id),
    extracted_file_count: Number(row.extracted_file_count ?? 0),
    created_at: row.created_at || null,
  };
}

function collectFilesRecursively(rootDir: string) {
  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "__MACOSX" || entry.name.startsWith(".")) continue;
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      files.push(nextPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function insertUploadRow(pool: Pool, input: UploadFileRow) {
  const result = await pool.query(
    `
      INSERT INTO manufacturer_pricebook_uploads (
        manufacturer,
        manufacturer_slug,
        original_name,
        storage_name,
        relative_path,
        document_type,
        mime_type,
        file_size_bytes,
        replace_existing,
        status,
        parsed_row_count,
        last_error,
        uploaded_by_user_id,
        parent_upload_id,
        extracted_file_count,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
      RETURNING
        id,
        manufacturer,
        manufacturer_slug,
        original_name,
        storage_name,
        relative_path,
        document_type,
        mime_type,
        file_size_bytes,
        replace_existing,
        status,
        parsed_row_count,
        last_error,
        previewed_at,
        published_at,
        uploaded_by_user_id,
        parent_upload_id,
        extracted_file_count,
        created_at
    `,
    [
      input.manufacturer,
      input.manufacturerSlug,
      input.originalName,
      input.storageName,
      input.relativePath,
      input.documentType,
      input.mimeType,
      input.fileSizeBytes,
      input.replaceExisting,
      input.status || "holding",
      input.parsedRowCount ?? 0,
      input.lastError ?? null,
      input.uploadedByUserId,
      input.parentUploadId ?? null,
      input.extractedFileCount ?? 0,
    ]
  );
  return result.rows[0] || null;
}

async function extractArchiveChildren(input: {
  pool: Pool;
  holdingDir: string;
  manufacturerDir: string;
  archiveAbsolutePath: string;
  archiveUploadRow: any;
  manufacturer: string;
  manufacturerSlug: string;
  replaceExisting: boolean;
  uploadedByUserId: number | null;
  execFileAsync: ExecFileAsyncLike;
}) {
  const archiveBaseName = path.parse(String(input.archiveUploadRow.storage_name || "archive")).name;
  const extractFolderName = `${archiveBaseName}__unzipped_${Number(input.archiveUploadRow.id)}`;
  const extractDir = path.join(input.manufacturerDir, extractFolderName);
  fs.mkdirSync(extractDir, { recursive: true });

  await input.execFileAsync(
    "unzip",
    ["-oq", input.archiveAbsolutePath, "-d", extractDir],
    { timeout: 120000 }
  );

  const extractedFiles = collectFilesRecursively(extractDir).filter((filePath) =>
    ACCEPTED_FILE_PATTERN.test(path.basename(filePath))
  );

  const insertedRows: any[] = [];
  for (const filePath of extractedFiles) {
    const relativeToManufacturerDir = path.relative(input.manufacturerDir, filePath).replace(/\\/g, "/");
    const relativePath = path.join(input.manufacturerSlug, relativeToManufacturerDir).replace(/\\/g, "/");
    const stats = fs.statSync(filePath);
    const inserted = await insertUploadRow(input.pool, {
      manufacturer: input.manufacturer,
      manufacturerSlug: input.manufacturerSlug,
      originalName: relativeToManufacturerDir,
      storageName: path.basename(filePath),
      relativePath,
      documentType: inferDocumentType(relativeToManufacturerDir),
      mimeType: "application/octet-stream",
      fileSizeBytes: Number(stats.size || 0),
      replaceExisting: input.replaceExisting,
      uploadedByUserId: input.uploadedByUserId,
      parentUploadId: Number(input.archiveUploadRow.id),
      status: "holding",
      extractedFileCount: 0,
    });
    if (inserted) insertedRows.push(inserted);
  }

  return {
    extractFolderName,
    extractedFiles,
    insertedRows,
  };
}

function mapCatalogRow(row: any) {
  return {
    id: String(row.id ?? ""),
    upload_id: row.upload_id === null || row.upload_id === undefined ? null : String(row.upload_id),
    manufacturer: String(row.manufacturer ?? ""),
    manufacturer_slug: String(row.manufacturer_slug ?? ""),
    collection_code: String(row.collection_code ?? ""),
    collection_name: String(row.collection_name ?? ""),
    category: String(row.category ?? ""),
    product_type: String(row.product_type ?? ""),
    sku: String(row.sku ?? ""),
    description: String(row.description ?? ""),
    color_finish: String(row.color_finish ?? ""),
    color_family: String(row.color_family ?? ""),
    material: String(row.material ?? ""),
    shape: String(row.shape ?? ""),
    dimensions_text: String(row.dimensions_text ?? ""),
    width_inches: row.width_inches === null || row.width_inches === undefined ? null : Number(row.width_inches),
    depth_inches: row.depth_inches === null || row.depth_inches === undefined ? null : Number(row.depth_inches),
    height_inches: row.height_inches === null || row.height_inches === undefined ? null : Number(row.height_inches),
    cubes: row.cubes === null || row.cubes === undefined ? null : Number(row.cubes),
    weight_lbs: row.weight_lbs === null || row.weight_lbs === undefined ? null : Number(row.weight_lbs),
    base_price: row.base_price === null || row.base_price === undefined ? null : Number(row.base_price),
    is_set: Boolean(row.is_set),
    set_piece_count:
      row.set_piece_count === null || row.set_piece_count === undefined ? null : Number(row.set_piece_count),
    is_swatch: Boolean(row.is_swatch),
    is_sample: Boolean(row.is_sample),
    is_new_product: Boolean(row.is_new_product),
    upholstery_cover: String(row.upholstery_cover ?? ""),
    hardware_options: Array.isArray(row.hardware_options) ? row.hardware_options.map((value: any) => String(value)) : [],
    cushion_options: Array.isArray(row.cushion_options) ? row.cushion_options.map((value: any) => String(value)) : [],
    feature_tags: Array.isArray(row.feature_tags) ? row.feature_tags.map((value: any) => String(value)) : [],
    search_keywords: Array.isArray(row.search_keywords) ? row.search_keywords.map((value: any) => String(value)) : [],
    source_note: String(row.source_note ?? ""),
    source_sort_order: Number(row.source_sort_order ?? 0),
  };
}

async function loadUploadByIdOr404(pool: Pool, uploadId: string, res: any) {
  const parsedId = Number(uploadId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    res.status(400).json({ ok: false, error: "invalid upload id" });
    return null;
  }
  const result = await pool.query(
    `
      SELECT
        id,
        manufacturer,
        manufacturer_slug,
        original_name,
        storage_name,
        relative_path,
        document_type,
        mime_type,
        file_size_bytes,
        replace_existing,
        status,
        parsed_row_count,
        last_error,
        previewed_at,
        published_at,
        uploaded_by_user_id,
        parent_upload_id,
        extracted_file_count,
        created_at
      FROM manufacturer_pricebook_uploads
      WHERE id = $1
      LIMIT 1
    `,
    [parsedId]
  );
  if (!result.rows.length) {
    res.status(404).json({ ok: false, error: "upload not found" });
    return null;
  }
  return result.rows[0];
}

async function parseUploadRows(input: {
  pool: Pool;
  holdingDir: string;
  uploadRow: any;
  execFileAsync: ExecFileAsyncLike;
}) {
  const resolvedUploadRow = await resolveUploadRowForProcessing(input.pool, input.uploadRow);
  const filePath = path.join(input.holdingDir, String(resolvedUploadRow.relative_path || ""));
  if (!fs.existsSync(filePath)) {
    throw new Error(`Holding file is missing at ${resolvedUploadRow.relative_path}`);
  }

  const manufacturerSlug = String(resolvedUploadRow.manufacturer_slug || "").trim().toLowerCase();
  if (manufacturerSlug === "liberty") {
    return parseLibertyPricebookPdf(filePath, input.execFileAsync);
  }
  if (manufacturerSlug === "best") {
    if (!isBestResidentialWorkbook(filePath)) {
      throw new Error(
        "Best preview currently expects the extracted Residential Price List workbook. Select the spreadsheet child file from the archive."
      );
    }
    return parseBestPricebookWorkbook(filePath);
  }
  if (manufacturerSlug === "england") {
    return parseEnglandPricebookPdf(filePath, input.execFileAsync);
  }
  throw new Error(
    `No parser is available yet for ${resolvedUploadRow.manufacturer}. Liberty, Best, and England are currently live.`
  );
}

async function parseUploadReferenceNotes(input: {
  pool: Pool;
  holdingDir: string;
  uploadRow: any;
  execFileAsync: ExecFileAsyncLike;
}) {
  const resolvedUploadRow = await resolveUploadRowForProcessing(input.pool, input.uploadRow);
  const filePath = path.join(input.holdingDir, String(resolvedUploadRow.relative_path || ""));
  if (!fs.existsSync(filePath)) return [];
  const manufacturerSlug = String(resolvedUploadRow.manufacturer_slug || "").trim().toLowerCase();
  if (String(resolvedUploadRow.document_type || "pricebook") === "archive") return [];
  if (manufacturerSlug === "liberty") {
    return parseLibertyReferenceNotesFromPdf(filePath, input.execFileAsync);
  }
  if (manufacturerSlug === "best") {
    if (!isBestResidentialWorkbook(filePath)) return [];
    return parseBestReferenceNotes(filePath);
  }
  if (manufacturerSlug === "england") {
    return parseEnglandReferenceNotes();
  }
  return [];
}

function normalizeDraftRows(rows: any[], uploadRow: any): ParsedManufacturerCatalogRow[] {
  const manufacturer = normalizeText(uploadRow.manufacturer) || "Liberty";
  const manufacturerSlug = normalizeText(uploadRow.manufacturer_slug) || sanitizeManufacturer(manufacturer);
  return rows
    .map((row: any, index) => {
      const normalized: ParsedManufacturerCatalogRow = {
        manufacturer,
        manufacturerSlug,
        collectionCode: normalizeText(row.collection_code ?? row.collectionCode),
        collectionName: normalizeText(row.collection_name ?? row.collectionName),
        category: normalizeText(row.category),
        productType: normalizeText(row.product_type ?? row.productType),
        sku: normalizeText(row.sku ?? row.productName),
        description: normalizeText(row.description),
        colorFinish: normalizeText(row.color_finish ?? row.colorFinish),
        colorFamily: normalizeText(row.color_family ?? row.colorFamily),
        material: normalizeText(row.material),
        shape: normalizeText(row.shape),
        dimensionsText: normalizeText(row.dimensions_text ?? row.dimensionsText),
        widthInches: parseNumericInput(row.width_inches ?? row.widthInches),
        depthInches: parseNumericInput(row.depth_inches ?? row.depthInches),
        heightInches: parseNumericInput(row.height_inches ?? row.heightInches),
        cubes: parseNumericInput(row.cubes),
        weightLbs: parseNumericInput(row.weight_lbs ?? row.weightLbs),
        basePrice: parseNumericInput(row.base_price ?? row.basePrice),
        isSet: Boolean(row.is_set ?? row.isSet),
        setPieceCount: parseNumericInput(row.set_piece_count ?? row.setPieceCount),
        isSwatch: Boolean(row.is_swatch ?? row.isSwatch),
        isSample: Boolean(row.is_sample ?? row.isSample),
        isNewProduct: Boolean(row.is_new_product ?? row.isNewProduct),
        upholsteryCover: normalizeText(row.upholstery_cover ?? row.upholsteryCover),
        hardwareOptions: normalizeTextArray(row.hardware_options ?? row.hardwareOptions),
        cushionOptions: normalizeTextArray(row.cushion_options ?? row.cushionOptions),
        featureTags: normalizeTextArray(row.feature_tags ?? row.featureTags),
        searchKeywords: normalizeTextArray(row.search_keywords ?? row.searchKeywords),
        sourceNote: normalizeText(row.source_note ?? row.sourceNote),
        sourceSortOrder: Number(row.source_sort_order ?? row.sourceSortOrder ?? index + 1),
      };
      normalized.searchKeywords =
        normalized.searchKeywords.length > 0
          ? normalized.searchKeywords
          : buildSearchText(normalized)
              .toLowerCase()
              .split(/\s+/)
              .filter((value) => value.length >= 2)
              .slice(0, 50);
      return normalized;
    })
    .filter((row) => row.sku && row.description && row.category);
}

async function replaceCatalogForUpload(client: PoolClient, uploadRow: any, rows: ParsedManufacturerCatalogRow[]) {
  if (Boolean(uploadRow.replace_existing)) {
    await client.query(`DELETE FROM manufacturer_catalog_items WHERE manufacturer_slug = $1`, [
      String(uploadRow.manufacturer_slug || ""),
    ]);
  }

  for (const row of rows) {
    await client.query(
      `
        INSERT INTO manufacturer_catalog_items (
          manufacturer,
          manufacturer_slug,
          upload_id,
          source_sort_order,
          collection_code,
          collection_name,
          category,
          product_type,
          sku,
          description,
          color_finish,
          color_family,
          material,
          shape,
          dimensions_text,
          width_inches,
          depth_inches,
          height_inches,
          cubes,
          weight_lbs,
          base_price,
          is_set,
          set_piece_count,
          is_swatch,
          is_sample,
          is_new_product,
          upholstery_cover,
          hardware_options,
          cushion_options,
          feature_tags,
          search_keywords,
          search_text,
          source_note,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, now()
        )
      `,
      [
        row.manufacturer,
        row.manufacturerSlug,
        Number(uploadRow.id),
        row.sourceSortOrder,
        row.collectionCode,
        row.collectionName,
        row.category,
        row.productType,
        row.sku,
        row.description,
        row.colorFinish,
        row.colorFamily,
        row.material,
        row.shape,
        row.dimensionsText,
        row.widthInches,
        row.depthInches,
        row.heightInches,
        row.cubes,
        row.weightLbs,
        row.basePrice,
        row.isSet,
        row.setPieceCount,
        row.isSwatch,
        row.isSample,
        row.isNewProduct,
        row.upholsteryCover,
        row.hardwareOptions,
        row.cushionOptions,
        row.featureTags,
        row.searchKeywords,
        buildSearchText(row),
        row.sourceNote,
      ]
    );
  }
}

export function registerManufacturerPricebookRoutes({
  app,
  pool,
  requireOwner,
  holdingDir,
  execFileAsync,
}: RegisterManufacturerPricebookRoutesDeps) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, holdingDir),
      filename: (_req, file, cb) => cb(null, `${Date.now()}_${safeFileName(file.originalname)}`),
    }),
    fileFilter: (_req, file, cb) => {
      const ok = ACCEPTED_FILE_PATTERN.test(file.originalname);
      cb((ok ? null : new Error("Only PDF, CSV, XLS, XLSX, and ZIP files are accepted")) as any, ok);
    },
    limits: { fileSize: 250 * 1024 * 1024 },
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
        document_type,
        mime_type,
        file_size_bytes,
        replace_existing,
        status,
        parsed_row_count,
        last_error,
        previewed_at,
        published_at,
        uploaded_by_user_id,
        parent_upload_id,
        extracted_file_count,
        created_at
      FROM manufacturer_pricebook_uploads
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const result = await pool.query(sql, values);
    res.json({ rows: result.rows.map(mapUploadRow) });
  });

  app.post("/api/manufacturer-pricebooks/uploads", requireOwner, upload.any(), async (req, res) => {
    const requestFiles = Array.isArray((req as any).files)
      ? ((req as any).files as Array<{
          originalname: string;
          filename: string;
          size: number;
          mimetype?: string;
        }>)
      : [];
    if (!requestFiles.length) return res.status(400).json({ ok: false, error: "No files uploaded" });

    const cleanupTempFile = (fileName: string) => {
      const tempPath = path.join(holdingDir, fileName);
      if (!fs.existsSync(tempPath)) return;
      try {
        fs.rmSync(tempPath, { force: true });
      } catch {
        // ignore cleanup failures
      }
    };

    const manufacturer =
      typeof req.body?.manufacturer === "string" ? String(req.body.manufacturer).trim() : "";
    if (!manufacturer) {
      requestFiles.forEach((file) => cleanupTempFile(file.filename));
      return res.status(400).json({ ok: false, error: "manufacturer is required" });
    }

    const manufacturerSlug = sanitizeManufacturer(manufacturer);
    if (!manufacturerSlug) {
      requestFiles.forEach((file) => cleanupTempFile(file.filename));
      return res.status(400).json({ ok: false, error: "invalid manufacturer" });
    }

    const replaceExisting =
      req.body?.replace_existing === undefined
        ? true
        : String(req.body.replace_existing).trim().toLowerCase() !== "false";

    const manufacturerDir = path.join(holdingDir, manufacturerSlug);
    fs.mkdirSync(manufacturerDir, { recursive: true });
    const uploaderId = toNumericUserId(req);
    const insertedRows: any[] = [];

    for (const rawFile of requestFiles) {
      const storageName = `${Date.now()}_${safeFileName(rawFile.originalname)}`;
      const sourcePath = path.join(holdingDir, rawFile.filename);
      const targetPath = path.join(manufacturerDir, storageName);
      fs.renameSync(sourcePath, targetPath);

      const relativePath = path.join(manufacturerSlug, storageName).replace(/\\/g, "/");
      const documentType = inferDocumentType(rawFile.originalname, req.body?.document_type);
      const inserted = await insertUploadRow(pool, {
        manufacturer,
        manufacturerSlug,
        originalName: rawFile.originalname,
        storageName,
        relativePath,
        documentType,
        mimeType: String(rawFile.mimetype || "application/octet-stream"),
        fileSizeBytes: Number(rawFile.size || 0),
        replaceExisting,
        uploadedByUserId: uploaderId,
        parentUploadId: null,
        status: "holding",
        extractedFileCount: 0,
      });
      if (inserted) insertedRows.push(inserted);

      if (documentType === "archive" && inserted) {
        try {
          const extracted = await extractArchiveChildren({
            pool,
            holdingDir,
            manufacturerDir,
            archiveAbsolutePath: targetPath,
            archiveUploadRow: inserted,
            manufacturer,
            manufacturerSlug,
            replaceExisting,
            uploadedByUserId: uploaderId,
            execFileAsync,
          });
          await pool.query(
            `
              UPDATE manufacturer_pricebook_uploads
              SET status = $2,
                  last_error = CASE WHEN $3 > 0 THEN NULL ELSE 'Archive extracted, but no supported upload files were found inside.' END,
                  extracted_file_count = $3
              WHERE id = $1
            `,
            [Number(inserted.id), extracted.extractedFiles.length ? "extracted" : "holding", extracted.extractedFiles.length]
          );
          inserted.status = extracted.extractedFiles.length ? "extracted" : "holding";
          inserted.extracted_file_count = extracted.extractedFiles.length;
          inserted.last_error = extracted.extractedFiles.length
            ? null
            : "Archive extracted, but no supported upload files were found inside.";
          insertedRows.push(...extracted.insertedRows);
        } catch (error: any) {
          const message = String(error?.message || error || "Failed to extract archive");
          await pool.query(
            `
              UPDATE manufacturer_pricebook_uploads
              SET status = 'error',
                  last_error = $2
              WHERE id = $1
            `,
            [Number(inserted.id), message.slice(0, 4000)]
          );
          inserted.status = "error";
          inserted.last_error = message.slice(0, 4000);
        }
      }
    }

    res.status(201).json({
      ok: true,
      row: mapUploadRow(insertedRows[0] || {}),
      rows: insertedRows.map(mapUploadRow),
    });
  });

  app.get("/api/manufacturer-pricebooks/uploads/:uploadId/preview", requireOwner, async (req, res) => {
    const uploadRow = await loadUploadByIdOr404(pool, String(req.params.uploadId || ""), res);
    if (!uploadRow) return;

    try {
      const rows = await parseUploadRows({ pool, holdingDir, uploadRow, execFileAsync });
      const notes = await parseUploadReferenceNotes({ pool, holdingDir, uploadRow, execFileAsync });
      await pool.query(
        `
          UPDATE manufacturer_pricebook_uploads
          SET status = CASE WHEN status = 'published' THEN status ELSE 'previewed' END,
              parsed_row_count = $2,
              last_error = NULL,
              previewed_at = now()
          WHERE id = $1
        `,
        [Number(uploadRow.id), rows.length]
      );
      res.json({
        ok: true,
        upload: mapUploadRow({ ...uploadRow, status: uploadRow.status === "published" ? "published" : "previewed", parsed_row_count: rows.length }),
        notes,
        rows: rows.map((row, index) =>
          mapCatalogRow({
            ...row,
            id: `preview-${index + 1}`,
            upload_id: uploadRow.id,
            manufacturer_slug: row.manufacturerSlug,
            collection_code: row.collectionCode,
            collection_name: row.collectionName,
            product_type: row.productType,
            color_finish: row.colorFinish,
            color_family: row.colorFamily,
            dimensions_text: row.dimensionsText,
            width_inches: row.widthInches,
            depth_inches: row.depthInches,
            height_inches: row.heightInches,
            weight_lbs: row.weightLbs,
            base_price: row.basePrice,
            is_set: row.isSet,
            set_piece_count: row.setPieceCount,
            is_swatch: row.isSwatch,
            is_sample: row.isSample,
            is_new_product: row.isNewProduct,
            upholstery_cover: row.upholsteryCover,
            hardware_options: row.hardwareOptions,
            cushion_options: row.cushionOptions,
            feature_tags: row.featureTags,
            search_keywords: row.searchKeywords,
            source_note: row.sourceNote,
            source_sort_order: row.sourceSortOrder,
          })
        ),
      });
    } catch (error: any) {
      const message = String(error?.message || error || "Failed to preview upload");
      await pool.query(
        `
          UPDATE manufacturer_pricebook_uploads
          SET status = 'error',
              last_error = $2
          WHERE id = $1
        `,
        [Number(uploadRow.id), message.slice(0, 4000)]
      );
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.post("/api/manufacturer-pricebooks/uploads/:uploadId/publish", requireOwner, async (req, res) => {
    const uploadRow = await loadUploadByIdOr404(pool, String(req.params.uploadId || ""), res);
    if (!uploadRow) return;

    try {
      const draftRows = Array.isArray(req.body?.rows) ? normalizeDraftRows(req.body.rows, uploadRow) : [];
      const rows =
        draftRows.length > 0 ? draftRows : await parseUploadRows({ pool, holdingDir, uploadRow, execFileAsync });
      const notes = await parseUploadReferenceNotes({ pool, holdingDir, uploadRow, execFileAsync });
      if (!rows.length) {
        return res.status(400).json({ ok: false, error: "No normalized rows were produced for publish" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await replaceCatalogForUpload(client, uploadRow, rows);
        if (Boolean(uploadRow.replace_existing)) {
          await client.query(`DELETE FROM manufacturer_reference_notes WHERE manufacturer_slug = $1`, [
            String(uploadRow.manufacturer_slug || ""),
          ]);
        }
        for (const note of notes) {
          await client.query(
            `
              INSERT INTO manufacturer_reference_notes (
                manufacturer,
                manufacturer_slug,
                upload_id,
                note_type,
                title,
                content,
                source_sort_order,
                created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, now())
            `,
            [
              note.manufacturer,
              note.manufacturerSlug,
              Number(uploadRow.id),
              note.noteType,
              note.title,
              note.content,
              note.sourceSortOrder,
            ]
          );
        }
        await client.query(
          `
            UPDATE manufacturer_pricebook_uploads
            SET status = 'published',
                parsed_row_count = $2,
                last_error = NULL,
                previewed_at = COALESCE(previewed_at, now()),
                published_at = now()
            WHERE id = $1
          `,
          [Number(uploadRow.id), rows.length]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS n FROM manufacturer_catalog_items WHERE manufacturer_slug = $1`,
        [String(uploadRow.manufacturer_slug || "")]
      );
      res.json({
        ok: true,
        published_rows: rows.length,
        published_notes: notes.length,
        manufacturer_total_rows: Number(countResult.rows[0]?.n ?? 0),
        manufacturer: String(uploadRow.manufacturer || ""),
      });
    } catch (error: any) {
      const message = String(error?.message || error || "Failed to publish upload");
      await pool.query(
        `
          UPDATE manufacturer_pricebook_uploads
          SET status = 'error',
              last_error = $2
          WHERE id = $1
        `,
        [Number(uploadRow.id), message.slice(0, 4000)]
      );
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.get("/api/manufacturer-pricebooks/catalog", requireOwner, async (req, res) => {
    const manufacturer =
      typeof req.query?.manufacturer === "string" ? String(req.query.manufacturer).trim() : "";
    const category = typeof req.query?.category === "string" ? String(req.query.category).trim() : "";
    const color = typeof req.query?.color === "string" ? String(req.query.color).trim() : "";
    const query = typeof req.query?.query === "string" ? String(req.query.query).trim() : "";
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 200), 1), 5000);

    const values: any[] = [];
    const where: string[] = [];

    if (manufacturer) {
      values.push(manufacturer);
      where.push(`manufacturer = $${values.length}`);
    }
    if (category) {
      values.push(category);
      where.push(`category = $${values.length}`);
    }
    if (color) {
      values.push(color.toLowerCase());
      where.push(`(lower(color_family) = $${values.length} OR lower(color_finish) LIKE '%' || $${values.length} || '%')`);
    }
    if (query) {
      values.push(query.toLowerCase());
      where.push(
        `(lower(search_text) LIKE '%' || $${values.length} || '%' OR lower(sku) LIKE '%' || $${values.length} || '%')`
      );
    }
    values.push(limit);

    const result = await pool.query(
      `
        SELECT
          id,
          upload_id,
          manufacturer,
          manufacturer_slug,
          collection_code,
          collection_name,
          category,
          product_type,
          sku,
          description,
          color_finish,
          color_family,
          material,
          shape,
          dimensions_text,
          width_inches,
          depth_inches,
          height_inches,
          cubes,
          weight_lbs,
          base_price,
          is_set,
          set_piece_count,
          is_swatch,
          is_sample,
          is_new_product,
          upholstery_cover,
          hardware_options,
          cushion_options,
          feature_tags,
          search_keywords,
          source_note,
          source_sort_order
        FROM manufacturer_catalog_items
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY manufacturer ASC, category ASC, collection_name ASC, source_sort_order ASC
        LIMIT $${values.length}
      `,
      values
    );

    res.json({
      ok: true,
      rows: result.rows.map(mapCatalogRow),
    });
  });

  app.get("/api/manufacturer-pricebooks/notes", requireOwner, async (req, res) => {
    const manufacturer =
      typeof req.query?.manufacturer === "string" ? String(req.query.manufacturer).trim() : "";
    const values: any[] = [];
    const where: string[] = [];
    if (manufacturer) {
      values.push(manufacturer);
      where.push(`manufacturer = $${values.length}`);
    }
    const result = await pool.query(
      `
        SELECT
          id,
          manufacturer,
          manufacturer_slug,
          upload_id,
          note_type,
          title,
          content,
          source_sort_order,
          created_at
        FROM manufacturer_reference_notes
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY manufacturer ASC, source_sort_order ASC, created_at DESC
      `,
      values
    );
    res.json({
      ok: true,
      rows: result.rows.map((row) => ({
        id: String(row.id ?? ""),
        manufacturer: String(row.manufacturer ?? ""),
        manufacturer_slug: String(row.manufacturer_slug ?? ""),
        upload_id: row.upload_id === null || row.upload_id === undefined ? null : String(row.upload_id),
        note_type: String(row.note_type ?? "reference"),
        title: String(row.title ?? ""),
        content: String(row.content ?? ""),
        source_sort_order: Number(row.source_sort_order ?? 0),
        created_at: row.created_at || null,
      })),
    });
  });
}
