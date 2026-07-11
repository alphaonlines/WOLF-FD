import fs from "fs";
import path from "path";
import type { Express } from "express";
import type { Pool, PoolClient } from "pg";
import multer from "multer";
import * as XLSX from "xlsx";
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
import {
  parseJacksonCatnapperPricebookPdf,
  parseJacksonCatnapperReferenceNotes,
} from "../parsers/jacksonCatnapperPricebook";
import {
  parseAccessoryReferenceNotes,
  parseGbsProtectallWorkbook,
  parseGuardsmanWorkbook,
  parseInnovationsWorkbook,
} from "../parsers/accessoryWorkbookPricebooks";

const SIBLING_PREFERRED_MANUFACTURERS = new Set([
  "best",
  "england",
  "jackson-catnapper",
  "guardsman",
  "gbs-protectall",
  "innovations",
]);

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

type GenericMappingField =
  | "manufacturer"
  | "category"
  | "collectionName"
  | "collectionCode"
  | "productType"
  | "productName"
  | "description"
  | "colorFinish"
  | "colorFamily"
  | "material"
  | "shape"
  | "dimensionsText"
  | "widthInches"
  | "depthInches"
  | "heightInches"
  | "cubes"
  | "weightLbs"
  | "basePrice";

type GenericColumnMapping = Record<string, number | string | null | undefined>;

type ImageCandidateRun = {
  manufacturerSlug: string;
  runDir: string;
  publicPathPrefix: string;
};

type KioskImageCandidate = {
  id: string;
  product_id: string;
  manufacturer_slug: string;
  image_url: string;
  source_image_url: string;
  detail_url: string;
  score: number;
  image_specificity: string;
  reason: string;
  review_image: string;
  status: "pending";
};

type RegisterManufacturerPricebookRoutesDeps = {
  app: Express;
  pool: Pool;
  requireOwner: (req: any, res: any, next: any) => any;
  holdingDir: string;
  execFileAsync: ExecFileAsyncLike;
  imageCandidateRuns?: ImageCandidateRun[];
};

const ACCEPTED_FILE_PATTERN = /\.(pdf|csv|xlsx|xls|zip)$/i;
const SPREADSHEET_FILE_PATTERN = /\.(csv|xlsx|xls)$/i;
const SHOP_KIOSK_IMAGE_APPROVAL_PERMISSION = "feature.shop_kiosk_image_approval";

const DEFAULT_IMAGE_CANDIDATE_RUNS: ImageCandidateRun[] = [
  {
    manufacturerSlug: "catnapper",
    runDir: "/home/alphahs/catalog-image-runs/catnapper-20260621-203920",
    publicPathPrefix: "/fd/catalog-images/catnapper/candidates",
  },
];
const CUSTOM_PARSER_MANUFACTURERS = new Set([
  "liberty",
  "best",
  "england",
  "jackson-catnapper",
  "guardsman",
  "gbs-protectall",
  "innovations",
]);

const GENERIC_MAPPING_FIELDS: Array<{ key: GenericMappingField; label: string; required?: boolean; synonyms: string[] }> = [
  { key: "manufacturer", label: "Manufacturer", synonyms: ["manufacturer", "vendor", "brand", "mfg"] },
  { key: "category", label: "Category", required: true, synonyms: ["category", "cat", "product category", "group", "department"] },
  { key: "collectionName", label: "Collection", synonyms: ["collection", "collection name", "series", "group name", "suite"] },
  { key: "collectionCode", label: "Collection Code", synonyms: ["collection code", "group code", "series code"] },
  { key: "productType", label: "Product Type", synonyms: ["product type", "type", "item type", "style type"] },
  { key: "productName", label: "Item # / SKU", required: true, synonyms: ["sku", "item", "item #", "item number", "item no", "model", "model #", "product", "product id", "number"] },
  { key: "description", label: "Description", required: true, synonyms: ["description", "desc", "item description", "product description", "name", "product name"] },
  { key: "colorFinish", label: "Color / Finish", synonyms: ["color", "colour", "finish", "color finish", "fabric", "cover", "cover name"] },
  { key: "colorFamily", label: "Color Family", synonyms: ["color family", "colour family", "finish family"] },
  { key: "material", label: "Material", synonyms: ["material", "materials", "wood", "fabric content"] },
  { key: "shape", label: "Shape", synonyms: ["shape"] },
  { key: "dimensionsText", label: "Dimensions", synonyms: ["dimensions", "dims", "size", "w x d x h", "wxdxh"] },
  { key: "widthInches", label: "Width", synonyms: ["width", "w", "w in", "width inches"] },
  { key: "depthInches", label: "Depth", synonyms: ["depth", "d", "d in", "depth inches"] },
  { key: "heightInches", label: "Height", synonyms: ["height", "h", "h in", "height inches"] },
  { key: "cubes", label: "Cubes", synonyms: ["cube", "cubes", "cuft", "cu ft"] },
  { key: "weightLbs", label: "Weight", synonyms: ["weight", "wt", "lbs", "pounds"] },
  { key: "basePrice", label: "Base Cost / Price", required: true, synonyms: ["price", "cost", "base price", "base cost", "dealer", "kiosk", "kiosk price", "wholesale", "list price", "msrp"] },
];

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
  if (/sku list|pricing by sku/.test(name)) score += 350;
  if (/compressed/.test(name)) score += 20;
  if (/order form|configurations/.test(name)) score -= 120;
  if (/kits/.test(name)) score -= 60;
  if (/warranty/.test(name)) score -= 100;
  if (/tariff|delivery schedule|schedule|coastal covers|curfab|pattern|cushion/.test(name)) score -= 220;
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
  if (SIBLING_PREFERRED_MANUFACTURERS.has(manufacturerSlug) && uploadRow.parent_upload_id) {
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

function normalizeHeaderText(value: any) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[#/\\().:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextArray(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .slice(0, 50);
}

function isSpreadsheetUpload(uploadRow: any) {
  return SPREADSHEET_FILE_PATTERN.test(
    `${String(uploadRow.original_name || "")} ${String(uploadRow.storage_name || "")}`.toLowerCase()
  );
}

function getCustomParserAvailable(uploadRow: any) {
  return CUSTOM_PARSER_MANUFACTURERS.has(String(uploadRow.manufacturer_slug || "").trim().toLowerCase());
}

function getCellText(row: any[], columnIndex: number) {
  if (!Number.isFinite(columnIndex) || columnIndex < 0) return "";
  return normalizeText(row[columnIndex]);
}

function getFieldMatchScore(header: string, field: (typeof GENERIC_MAPPING_FIELDS)[number]) {
  const normalizedHeader = normalizeHeaderText(header);
  if (!normalizedHeader) return 0;
  let best = 0;
  for (const synonym of field.synonyms) {
    const normalizedSynonym = normalizeHeaderText(synonym);
    if (!normalizedSynonym) continue;
    if (normalizedHeader === normalizedSynonym) best = Math.max(best, 100);
    if (normalizedHeader.includes(normalizedSynonym)) best = Math.max(best, 82);
    if (normalizedSynonym.includes(normalizedHeader) && normalizedHeader.length >= 3) best = Math.max(best, 65);
  }
  if (field.key === "basePrice" && /(retail|sell|sale)/.test(normalizedHeader) && !/(cost|dealer|kiosk|base|wholesale|price)/.test(normalizedHeader)) {
    best = Math.min(best, 45);
  }
  return best;
}

function suggestMappingsForHeaders(headers: string[]) {
  const usedColumns = new Set<number>();
  const suggestions: Record<string, { columnIndex: number; header: string; confidence: number }> = {};

  for (const field of GENERIC_MAPPING_FIELDS) {
    let best: { columnIndex: number; header: string; confidence: number } | null = null;
    headers.forEach((header, columnIndex) => {
      if (usedColumns.has(columnIndex)) return;
      const confidence = getFieldMatchScore(header, field);
      if (confidence <= 0) return;
      if (!best || confidence > best.confidence) {
        best = { columnIndex, header, confidence };
      }
    });
    if (best && best.confidence >= 50) {
      suggestions[field.key] = best;
      usedColumns.add(best.columnIndex);
    }
  }

  return suggestions;
}

function inferHeaderRow(rows: any[][]) {
  let best = { rowIndex: 0, score: -1, headers: [] as string[] };
  rows.slice(0, 30).forEach((row, rowIndex) => {
    const headers = row.map((cell) => normalizeText(cell));
    const nonEmpty = headers.filter(Boolean).length;
    if (nonEmpty < 2) return;
    const suggestions = suggestMappingsForHeaders(headers);
    const requiredMatches = GENERIC_MAPPING_FIELDS.filter((field) => field.required && suggestions[field.key]).length;
    const score = Object.keys(suggestions).length * 40 + requiredMatches * 35 + Math.min(nonEmpty, 16) * 2 - rowIndex;
    if (score > best.score) best = { rowIndex, score, headers };
  });
  return best;
}

function readSpreadsheetRows(filePath: string, sheetName?: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const selectedSheetName = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[selectedSheetName];
  const rows = worksheet
    ? (XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false }) as any[][])
    : [];
  return {
    workbook,
    sheetName: selectedSheetName,
    rows,
  };
}

function analyzeSpreadsheetFile(filePath: string, uploadRow: any, savedProfile?: any) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  let bestAnalysis: any = null;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = worksheet
      ? (XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false }) as any[][])
      : [];
    const header = inferHeaderRow(rows);
    const suggestions = suggestMappingsForHeaders(header.headers);
    const dataRows = rows.slice(header.rowIndex + 1).filter((row) => row.some((cell) => normalizeText(cell)));
    const score = header.score + dataRows.length / 100;
    const analysis = {
      sheetName,
      headerRowIndex: header.rowIndex,
      rowCount: dataRows.length,
      score,
      columns: header.headers.map((headerText, columnIndex) => ({
        index: columnIndex,
        key: `col_${columnIndex}`,
        header: headerText || `Column ${columnIndex + 1}`,
        sampleValues: dataRows
          .map((row) => getCellText(row, columnIndex))
          .filter(Boolean)
          .slice(0, 5),
      })),
      suggestedMappings: suggestions,
      sampleRows: dataRows.slice(0, 10).map((row, rowIndex) => ({
        rowNumber: header.rowIndex + rowIndex + 2,
        values: header.headers.map((headerText, columnIndex) => ({
          header: headerText || `Column ${columnIndex + 1}`,
          value: getCellText(row, columnIndex),
        })),
      })),
    };
    if (!bestAnalysis || analysis.score > bestAnalysis.score) bestAnalysis = analysis;
  }

  return {
    mode: "spreadsheet",
    supported: true,
    parserKind: "generic_mapper",
    manufacturer: String(uploadRow.manufacturer || ""),
    manufacturerSlug: String(uploadRow.manufacturer_slug || ""),
    sheetNames: workbook.SheetNames,
    savedProfile,
    ...bestAnalysis,
  };
}

async function loadLatestMappingProfile(pool: Pool, manufacturerSlug: string) {
  const result = await pool.query(
    `
      SELECT
        id,
        manufacturer,
        manufacturer_slug,
        profile_name,
        file_type,
        sheet_name,
        header_row_index,
        mappings,
        updated_at
      FROM manufacturer_pricebook_mapping_profiles
      WHERE manufacturer_slug = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [manufacturerSlug]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    manufacturer: String(row.manufacturer || ""),
    manufacturerSlug: String(row.manufacturer_slug || ""),
    profileName: String(row.profile_name || ""),
    fileType: String(row.file_type || ""),
    sheetName: String(row.sheet_name || ""),
    headerRowIndex: Number(row.header_row_index || 0),
    mappings: row.mappings || {},
    updatedAt: row.updated_at || null,
  };
}

async function saveMappingProfile(input: {
  pool: Pool;
  uploadRow: any;
  profileName?: string;
  sheetName: string;
  headerRowIndex: number;
  mappings: GenericColumnMapping;
  userId: number | null;
}) {
  await input.pool.query(
    `
      INSERT INTO manufacturer_pricebook_mapping_profiles (
        manufacturer,
        manufacturer_slug,
        profile_name,
        file_type,
        sheet_name,
        header_row_index,
        mappings,
        updated_by_user_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now(), now())
      ON CONFLICT (manufacturer_slug, profile_name)
      DO UPDATE SET
        file_type = EXCLUDED.file_type,
        sheet_name = EXCLUDED.sheet_name,
        header_row_index = EXCLUDED.header_row_index,
        mappings = EXCLUDED.mappings,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
    `,
    [
      String(input.uploadRow.manufacturer || ""),
      String(input.uploadRow.manufacturer_slug || ""),
      input.profileName || "Default",
      path.extname(String(input.uploadRow.original_name || input.uploadRow.storage_name || "")).replace(".", "").toLowerCase(),
      input.sheetName,
      input.headerRowIndex,
      JSON.stringify(input.mappings || {}),
      input.userId,
    ]
  );
}

function resolveMappedColumnIndex(mapping: any, headers: string[]) {
  if (typeof mapping === "number" && Number.isFinite(mapping)) return mapping;
  if (typeof mapping === "string") {
    const trimmed = mapping.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;
    const normalized = normalizeHeaderText(trimmed);
    const index = headers.findIndex((header) => normalizeHeaderText(header) === normalized);
    return index >= 0 ? index : null;
  }
  if (mapping && typeof mapping === "object") {
    return resolveMappedColumnIndex(mapping.columnIndex ?? mapping.header, headers);
  }
  return null;
}

function buildMappedRows(input: {
  filePath: string;
  uploadRow: any;
  sheetName?: string;
  headerRowIndex?: number;
  mappings: GenericColumnMapping;
}) {
  const { sheetName, rows } = readSpreadsheetRows(input.filePath, input.sheetName);
  const headerRowIndex = Math.max(Number(input.headerRowIndex ?? inferHeaderRow(rows).rowIndex) || 0, 0);
  const headers = (rows[headerRowIndex] || []).map((cell) => normalizeText(cell));
  const dataRows = rows.slice(headerRowIndex + 1);
  const mappedRows: ParsedManufacturerCatalogRow[] = [];

  const getMappedValue = (row: any[], field: GenericMappingField) => {
    const columnIndex = resolveMappedColumnIndex(input.mappings[field], headers);
    return columnIndex === null ? "" : getCellText(row, columnIndex);
  };

  dataRows.forEach((row, index) => {
    if (!row.some((cell) => normalizeText(cell))) return;
    const manufacturer = getMappedValue(row, "manufacturer") || normalizeText(input.uploadRow.manufacturer);
    const category = getMappedValue(row, "category");
    const sku = getMappedValue(row, "productName");
    const description = getMappedValue(row, "description");
    const basePrice = parseNumericInput(getMappedValue(row, "basePrice"));
    if (!manufacturer && !category && !sku && !description && basePrice === null) return;

    const normalized: ParsedManufacturerCatalogRow = {
      manufacturer: manufacturer || normalizeText(input.uploadRow.manufacturer),
      manufacturerSlug: normalizeText(input.uploadRow.manufacturer_slug) || sanitizeManufacturer(manufacturer),
      collectionCode: getMappedValue(row, "collectionCode"),
      collectionName: getMappedValue(row, "collectionName"),
      category,
      productType: getMappedValue(row, "productType"),
      sku,
      description,
      colorFinish: getMappedValue(row, "colorFinish"),
      colorFamily: getMappedValue(row, "colorFamily"),
      material: getMappedValue(row, "material"),
      shape: getMappedValue(row, "shape"),
      dimensionsText: getMappedValue(row, "dimensionsText"),
      widthInches: parseNumericInput(getMappedValue(row, "widthInches")),
      depthInches: parseNumericInput(getMappedValue(row, "depthInches")),
      heightInches: parseNumericInput(getMappedValue(row, "heightInches")),
      cubes: parseNumericInput(getMappedValue(row, "cubes")),
      weightLbs: parseNumericInput(getMappedValue(row, "weightLbs")),
      basePrice,
      isSet: false,
      setPieceCount: null,
      isSwatch: false,
      isSample: false,
      isNewProduct: false,
      upholsteryCover: "",
      hardwareOptions: [],
      cushionOptions: [],
      featureTags: [],
      searchKeywords: [],
      imageUrls: [],
      sourceNote: `Mapped from ${input.uploadRow.original_name || input.uploadRow.storage_name} · ${sheetName} row ${headerRowIndex + index + 2}`,
      sourceSortOrder: index + 1,
    };
    normalized.searchKeywords = buildSearchText(normalized)
      .toLowerCase()
      .split(/\s+/)
      .filter((value) => value.length >= 2)
      .slice(0, 50);
    mappedRows.push(normalized);
  });

  return {
    sheetName,
    headerRowIndex,
    headers,
    rows: mappedRows,
  };
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
    image_urls: Array.isArray(row.image_urls) ? row.image_urls.map((value: any) => String(value)) : [],
    source_note: String(row.source_note ?? ""),
    source_sort_order: Number(row.source_sort_order ?? 0),
  };
}

function mapKioskProductRow(row: any) {
  return {
    id: String(row.id ?? ""),
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
    dimensions_text: String(row.dimensions_text ?? ""),
    width_inches: row.width_inches === null || row.width_inches === undefined ? null : Number(row.width_inches),
    depth_inches: row.depth_inches === null || row.depth_inches === undefined ? null : Number(row.depth_inches),
    height_inches: row.height_inches === null || row.height_inches === undefined ? null : Number(row.height_inches),
    feature_tags: Array.isArray(row.feature_tags) ? row.feature_tags.map((value: any) => String(value)) : [],
    search_keywords: Array.isArray(row.search_keywords) ? row.search_keywords.map((value: any) => String(value)) : [],
    image_urls: Array.isArray(row.image_urls) ? row.image_urls.map((value: any) => String(value)) : [],
    availability_label: String(row.availability_label ?? "Ask associate"),
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function parseCsvRows(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? "").trim();
    });
    return row;
  });
}

function normalizePublicPathPrefix(prefix: string) {
  return String(prefix || "").replace(/\/+$/, "");
}

function candidateIdFor(run: ImageCandidateRun, productId: string, reviewImage: string) {
  const fileName = path.basename(reviewImage || "candidate.jpg");
  return `${run.manufacturerSlug}:${productId}:${fileName}`;
}

function loadKioskImageCandidates(runs: ImageCandidateRun[], productIds?: Set<string>): KioskImageCandidate[] {
  const rows: KioskImageCandidate[] = [];
  for (const run of runs) {
    const csvPath = path.join(run.runDir, "match_candidates.csv");
    if (!fs.existsSync(csvPath)) continue;
    const parsed = parseCsvRows(fs.readFileSync(csvPath, "utf8"));
    const publicPrefix = normalizePublicPathPrefix(run.publicPathPrefix);
    for (const raw of parsed) {
      const productId = String(raw.row_id || "").trim();
      const reviewImage = String(raw.review_image || "").trim();
      if (!productId || !reviewImage) continue;
      if (productIds && !productIds.has(productId)) continue;
      const fileName = path.basename(reviewImage);
      const localImagePath = path.join(run.runDir, reviewImage);
      if (!fs.existsSync(localImagePath)) continue;
      rows.push({
        id: candidateIdFor(run, productId, reviewImage),
        product_id: productId,
        manufacturer_slug: run.manufacturerSlug,
        image_url: `${publicPrefix}/${fileName}`,
        source_image_url: String(raw.source_image_url || ""),
        detail_url: String(raw.detail_url || ""),
        score: Number(raw.score || 0),
        image_specificity: String(raw.image_specificity || ""),
        reason: String(raw.reason || ""),
        review_image: reviewImage,
        status: "pending",
      });
    }
  }
  return rows;
}

function parseProductIdList(raw: unknown): Set<string> {
  const value = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
  return new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 200)
  );
}


function hasKioskImageApprovalAccess(req: any) {
  const user = req?.authUser || {};
  const roles = Array.isArray(user.roles) ? user.roles.map((role: any) => String(role)) : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions.map((permission: any) => String(permission)) : [];
  return roles.includes("Owner") || permissions.includes(SHOP_KIOSK_IMAGE_APPROVAL_PERMISSION);
}

function requireKioskImageApproval(req: any, res: any, next: any) {
  if (!hasKioskImageApprovalAccess(req)) return res.status(403).json({ ok: false, error: "forbidden" });
  return next();
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
  if (manufacturerSlug === "jackson-catnapper") {
    return parseJacksonCatnapperPricebookPdf(filePath, input.execFileAsync);
  }
  if (manufacturerSlug === "guardsman") {
    return parseGuardsmanWorkbook(filePath);
  }
  if (manufacturerSlug === "gbs-protectall") {
    return parseGbsProtectallWorkbook(filePath);
  }
  if (manufacturerSlug === "innovations") {
    return parseInnovationsWorkbook(filePath);
  }
  throw new Error(
    `No parser is available yet for ${resolvedUploadRow.manufacturer}. Liberty, Best, England, Jackson/Catnapper, Guardsman, GBS ProtectAll, and Innovations are currently live.`
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
  if (manufacturerSlug === "jackson-catnapper") {
    return parseJacksonCatnapperReferenceNotes();
  }
  if (manufacturerSlug === "guardsman" || manufacturerSlug === "gbs-protectall" || manufacturerSlug === "innovations") {
    return parseAccessoryReferenceNotes();
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
        imageUrls: normalizeTextArray(row.image_urls ?? row.imageUrls),
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
          image_urls,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, now()
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
        row.imageUrls ?? [],
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
  imageCandidateRuns = DEFAULT_IMAGE_CANDIDATE_RUNS,
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

  app.get("/api/manufacturer-pricebooks/summary", requireOwner, async (_req, res) => {
    const [uploadResult, catalogResult] = await Promise.all([
      pool.query(
        `
          SELECT
            manufacturer,
            manufacturer_slug,
            status,
            COUNT(*)::int AS count,
            MAX(created_at) AS latest_upload_at
          FROM manufacturer_pricebook_uploads
          GROUP BY manufacturer, manufacturer_slug, status
          ORDER BY manufacturer ASC, status ASC
        `
      ),
      pool.query(
        `
          SELECT
            manufacturer,
            manufacturer_slug,
            COUNT(*)::int AS catalog_rows,
            COUNT(*) FILTER (WHERE base_price IS NOT NULL)::int AS priced_rows,
            MAX(created_at) AS latest_catalog_at
          FROM manufacturer_catalog_items
          GROUP BY manufacturer, manufacturer_slug
          ORDER BY manufacturer ASC
        `
      ),
    ]);

    const bySlug = new Map<string, any>();
    for (const row of uploadResult.rows) {
      const slug = String(row.manufacturer_slug || sanitizeManufacturer(String(row.manufacturer || "")));
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          manufacturer: String(row.manufacturer || ""),
          manufacturerSlug: slug,
          statuses: {},
          uploadCount: 0,
          catalogRows: 0,
          pricedRows: 0,
          parserSupported: CUSTOM_PARSER_MANUFACTURERS.has(slug),
          latestUploadAt: null,
          latestCatalogAt: null,
        });
      }
      const entry = bySlug.get(slug);
      const count = Number(row.count || 0);
      entry.statuses[String(row.status || "holding")] = count;
      entry.uploadCount += count;
      entry.latestUploadAt = row.latest_upload_at || entry.latestUploadAt;
    }
    for (const row of catalogResult.rows) {
      const slug = String(row.manufacturer_slug || sanitizeManufacturer(String(row.manufacturer || "")));
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          manufacturer: String(row.manufacturer || ""),
          manufacturerSlug: slug,
          statuses: {},
          uploadCount: 0,
          catalogRows: 0,
          pricedRows: 0,
          parserSupported: CUSTOM_PARSER_MANUFACTURERS.has(slug),
          latestUploadAt: null,
          latestCatalogAt: null,
        });
      }
      const entry = bySlug.get(slug);
      entry.catalogRows = Number(row.catalog_rows || 0);
      entry.pricedRows = Number(row.priced_rows || 0);
      entry.latestCatalogAt = row.latest_catalog_at || null;
    }

    const manufacturers = [...bySlug.values()].sort((left, right) =>
      String(left.manufacturer).localeCompare(String(right.manufacturer))
    );
    res.json({
      ok: true,
      totals: {
        manufacturers: manufacturers.length,
        uploads: manufacturers.reduce((sum, entry) => sum + Number(entry.uploadCount || 0), 0),
        catalogRows: manufacturers.reduce((sum, entry) => sum + Number(entry.catalogRows || 0), 0),
        holding: manufacturers.reduce((sum, entry) => sum + Number(entry.statuses?.holding || 0), 0),
      },
      manufacturers,
    });
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

  app.get("/api/manufacturer-pricebooks/uploads/:uploadId/analyze", requireOwner, async (req, res) => {
    const uploadRow = await loadUploadByIdOr404(pool, String(req.params.uploadId || ""), res);
    if (!uploadRow) return;

    try {
      const resolvedUploadRow = await resolveUploadRowForProcessing(pool, uploadRow);
      const filePath = path.join(holdingDir, String(resolvedUploadRow.relative_path || ""));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ ok: false, error: `Holding file is missing at ${resolvedUploadRow.relative_path}` });
      }

      const savedProfile = await loadLatestMappingProfile(pool, String(resolvedUploadRow.manufacturer_slug || ""));
      const parserSupported = getCustomParserAvailable(resolvedUploadRow);
      if (!isSpreadsheetUpload(resolvedUploadRow)) {
        return res.json({
          ok: true,
          supported: false,
          parserSupported,
          parserKind: parserSupported ? "custom_parser" : "parser_needed",
          upload: mapUploadRow(uploadRow),
          resolvedUpload: mapUploadRow(resolvedUploadRow),
          analysis: {
            mode: "unsupported_file",
            supported: false,
            parserKind: parserSupported ? "custom_parser" : "parser_needed",
            message: parserSupported
              ? "This file type uses the existing manufacturer parser. Use Load Into Validation."
              : "PDF parser needed for this manufacturer. Spreadsheet and CSV files can use generic mapping now.",
            savedProfile,
          },
        });
      }

      const analysis = analyzeSpreadsheetFile(filePath, resolvedUploadRow, savedProfile);
      res.json({
        ok: true,
        supported: true,
        parserSupported,
        parserKind: "generic_mapper",
        upload: mapUploadRow(uploadRow),
        resolvedUpload: mapUploadRow(resolvedUploadRow),
        analysis,
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: String(error?.message || error || "Failed to analyze upload") });
    }
  });

  app.post("/api/manufacturer-pricebooks/uploads/:uploadId/mapped-preview", requireOwner, async (req, res) => {
    const uploadRow = await loadUploadByIdOr404(pool, String(req.params.uploadId || ""), res);
    if (!uploadRow) return;

    try {
      const resolvedUploadRow = await resolveUploadRowForProcessing(pool, uploadRow);
      const filePath = path.join(holdingDir, String(resolvedUploadRow.relative_path || ""));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ ok: false, error: `Holding file is missing at ${resolvedUploadRow.relative_path}` });
      }
      if (!isSpreadsheetUpload(resolvedUploadRow)) {
        return res.status(400).json({ ok: false, error: "Generic mapping currently supports CSV, XLS, and XLSX files." });
      }

      const mappings = (req.body?.mappings || {}) as GenericColumnMapping;
      const built = buildMappedRows({
        filePath,
        uploadRow: resolvedUploadRow,
        sheetName: typeof req.body?.sheetName === "string" ? String(req.body.sheetName) : undefined,
        headerRowIndex: Number(req.body?.headerRowIndex ?? 0),
        mappings,
      });
      if (req.body?.saveProfile) {
        await saveMappingProfile({
          pool,
          uploadRow: resolvedUploadRow,
          profileName: typeof req.body?.profileName === "string" ? String(req.body.profileName).trim() || "Default" : "Default",
          sheetName: built.sheetName,
          headerRowIndex: built.headerRowIndex,
          mappings,
          userId: toNumericUserId(req),
        });
      }
      await pool.query(
        `
          UPDATE manufacturer_pricebook_uploads
          SET status = CASE WHEN status = 'published' THEN status ELSE 'previewed' END,
              parsed_row_count = $2,
              last_error = NULL,
              previewed_at = now()
          WHERE id = $1
        `,
        [Number(resolvedUploadRow.id), built.rows.length]
      );
      res.json({
        ok: true,
        upload: mapUploadRow({
          ...resolvedUploadRow,
          status: resolvedUploadRow.status === "published" ? "published" : "previewed",
          parsed_row_count: built.rows.length,
        }),
        analysis: {
          sheetName: built.sheetName,
          headerRowIndex: built.headerRowIndex,
          rowCount: built.rows.length,
          headers: built.headers,
        },
        notes: [],
        rows: built.rows.map((row, index) =>
          mapCatalogRow({
            ...row,
            id: `mapped-preview-${index + 1}`,
            upload_id: resolvedUploadRow.id,
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
            image_urls: row.imageUrls,
            source_note: row.sourceNote,
            source_sort_order: row.sourceSortOrder,
          })
        ),
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: String(error?.message || error || "Failed to build mapped preview") });
    }
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
                video_url,
                source_sort_order,
                created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
            `,
            [
              note.manufacturer,
              note.manufacturerSlug,
              Number(uploadRow.id),
              note.noteType,
              note.title,
              note.content,
              note.videoUrl ?? "",
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

  app.get("/api/shop/kiosk/products", async (req, res) => {
    const manufacturer =
      typeof req.query?.manufacturer === "string" ? String(req.query.manufacturer).trim() : "";
    const category = typeof req.query?.category === "string" ? String(req.query.category).trim() : "";
    const color = typeof req.query?.color === "string" ? String(req.query.color).trim() : "";
    const productType = typeof req.query?.productType === "string" ? String(req.query.productType).trim() : "";
    const query = typeof req.query?.query === "string" ? String(req.query.query).trim() : "";
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 200), 1), 5000);
    const offset = Math.max(Number(req.query?.offset ?? 0), 0);

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
    if (productType) {
      values.push(productType);
      where.push(`product_type = $${values.length}`);
    }
    if (query) {
      values.push(query.toLowerCase());
      where.push(
        `(lower(search_text) LIKE '%' || $${values.length} || '%' OR lower(sku) LIKE '%' || $${values.length} || '%')`
      );
    }
    const countValues = [...values];
    values.push(limit);
    values.push(offset);

    const [result, countResult] = await Promise.all([
      pool.query(
        `
          SELECT
            id,
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
            dimensions_text,
            width_inches,
            depth_inches,
            height_inches,
            feature_tags,
            search_keywords,
            image_urls,
            'Ask associate' AS availability_label
          FROM manufacturer_catalog_items
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY
            CASE WHEN COALESCE(cardinality(image_urls), 0) > 0 THEN 0 ELSE 1 END ASC,
            manufacturer ASC,
            category ASC,
            collection_name ASC,
            sku ASC
          LIMIT $${values.length - 1}
          OFFSET $${values.length}
        `,
        values
      ),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM manufacturer_catalog_items
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        `,
        countValues
      ),
    ]);
    const totalCount = Number(countResult.rows[0]?.total ?? result.rows.length);

    res.json({
      ok: true,
      count: result.rows.length,
      total: totalCount,
      limit,
      offset,
      has_more: totalCount > offset + result.rows.length,
      rows: result.rows.map(mapKioskProductRow),
    });
  });


  app.get("/api/shop/kiosk/image-candidates", requireKioskImageApproval, async (req, res) => {
    const productIds = parseProductIdList(req.query?.productIds ?? req.query?.product_ids);
    if (!productIds.size) return res.json({ ok: true, rows: [] });
    const rows = loadKioskImageCandidates(imageCandidateRuns, productIds);
    res.json({ ok: true, rows });
  });

  app.post("/api/shop/kiosk/products/:productId/image-candidates/:candidateId/approve", requireKioskImageApproval, async (req, res) => {
    const productId = String(req.params.productId || "").trim();
    const candidateId = String(req.params.candidateId || "").trim();
    if (!productId || !candidateId) return res.status(400).json({ ok: false, error: "product and candidate are required" });

    const candidate = loadKioskImageCandidates(imageCandidateRuns, new Set([productId])).find((row) => row.id === candidateId);
    if (!candidate) return res.status(404).json({ ok: false, error: "image candidate not found" });

    const numericProductId = Number(productId);
    if (!Number.isFinite(numericProductId) || numericProductId <= 0) {
      return res.status(400).json({ ok: false, error: "invalid product id" });
    }

    const imageUrls = [candidate.image_url];
    const result = await pool.query(
      `
        UPDATE manufacturer_catalog_items
        SET image_urls = $2
        WHERE id = $1
        RETURNING
          id,
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
          dimensions_text,
          width_inches,
          depth_inches,
          height_inches,
          feature_tags,
          search_keywords,
          image_urls,
          'Ask associate' AS availability_label
      `,
      [numericProductId, imageUrls]
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, error: "product not found" });
    res.json({ ok: true, row: mapKioskProductRow(result.rows[0]), candidate });
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
    const countValues = [...values];
    values.push(limit);

    const [result, countResult] = await Promise.all([
      pool.query(
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
          image_urls,
          source_note,
          source_sort_order
        FROM manufacturer_catalog_items
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY manufacturer ASC, category ASC, collection_name ASC, source_sort_order ASC
        LIMIT $${values.length}
      `,
      values
      ),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM manufacturer_catalog_items
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        `,
        countValues
      ),
    ]);
    const totalCount = Number(countResult.rows[0]?.total ?? result.rows.length);

    res.json({
      ok: true,
      count: result.rows.length,
      total: totalCount,
      limit,
      has_more: totalCount > result.rows.length,
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
          video_url,
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
        video_url: String(row.video_url ?? ""),
        source_sort_order: Number(row.source_sort_order ?? 0),
        created_at: row.created_at || null,
      })),
    });
  });
}
