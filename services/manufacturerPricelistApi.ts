import type {
  ManufacturerCatalogItem,
  ManufacturerPricebookSummary,
  ManufacturerUploadAnalysis,
  ManufacturerPricebookUpload,
  ManufacturerReferenceNote,
} from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

const mapUpload = (row: any): ManufacturerPricebookUpload => ({
  id: String(row.id ?? ""),
  manufacturer: String(row.manufacturer ?? ""),
  manufacturerSlug: String(row.manufacturer_slug ?? ""),
  originalName: String(row.original_name ?? ""),
  storageName: String(row.storage_name ?? ""),
  relativePath: String(row.relative_path ?? ""),
  documentType: String(row.document_type ?? "pricebook"),
  mimeType: String(row.mime_type ?? "application/octet-stream"),
  fileSizeBytes: Number(row.file_size_bytes ?? 0),
  replaceExisting: Boolean(row.replace_existing),
  status: String(row.status ?? "holding"),
  parsedRowCount: Number(row.parsed_row_count ?? 0),
  lastError: String(row.last_error ?? ""),
  previewedAt: row.previewed_at ? String(row.previewed_at) : null,
  publishedAt: row.published_at ? String(row.published_at) : null,
  uploadedByUserId:
    row.uploaded_by_user_id === null || row.uploaded_by_user_id === undefined
      ? null
      : String(row.uploaded_by_user_id),
  parentUploadId:
    row.parent_upload_id === null || row.parent_upload_id === undefined
      ? null
      : String(row.parent_upload_id),
  extractedFileCount: Number(row.extracted_file_count ?? 0),
  createdAt: row.created_at ? String(row.created_at) : undefined,
});

const mapCatalogItem = (row: any): ManufacturerCatalogItem => ({
  id: String(row.id ?? ""),
  uploadId: row.upload_id === null || row.upload_id === undefined ? null : String(row.upload_id),
  manufacturer: String(row.manufacturer ?? ""),
  manufacturerSlug: String(row.manufacturer_slug ?? ""),
  collectionCode: String(row.collection_code ?? ""),
  collectionName: String(row.collection_name ?? ""),
  category: String(row.category ?? ""),
  productType: String(row.product_type ?? ""),
  sku: String(row.sku ?? ""),
  description: String(row.description ?? ""),
  colorFinish: String(row.color_finish ?? ""),
  colorFamily: String(row.color_family ?? ""),
  material: String(row.material ?? ""),
  shape: String(row.shape ?? ""),
  dimensionsText: String(row.dimensions_text ?? ""),
  widthInches: row.width_inches === null || row.width_inches === undefined ? null : Number(row.width_inches),
  depthInches: row.depth_inches === null || row.depth_inches === undefined ? null : Number(row.depth_inches),
  heightInches: row.height_inches === null || row.height_inches === undefined ? null : Number(row.height_inches),
  cubes: row.cubes === null || row.cubes === undefined ? null : Number(row.cubes),
  weightLbs: row.weight_lbs === null || row.weight_lbs === undefined ? null : Number(row.weight_lbs),
  basePrice: row.base_price === null || row.base_price === undefined ? null : Number(row.base_price),
  isSet: Boolean(row.is_set),
  setPieceCount:
    row.set_piece_count === null || row.set_piece_count === undefined ? null : Number(row.set_piece_count),
  isSwatch: Boolean(row.is_swatch),
  isSample: Boolean(row.is_sample),
  isNewProduct: Boolean(row.is_new_product),
  upholsteryCover: String(row.upholstery_cover ?? ""),
  hardwareOptions: Array.isArray(row.hardware_options) ? row.hardware_options.map((value: any) => String(value)) : [],
  cushionOptions: Array.isArray(row.cushion_options) ? row.cushion_options.map((value: any) => String(value)) : [],
  featureTags: Array.isArray(row.feature_tags) ? row.feature_tags.map((value: any) => String(value)) : [],
  searchKeywords:
    Array.isArray(row.search_keywords) ? row.search_keywords.map((value: any) => String(value)) : [],
  imageUrls: Array.isArray(row.image_urls) ? row.image_urls.map((value: any) => String(value)) : [],
  sourceNote: String(row.source_note ?? ""),
  sourceSortOrder: Number(row.source_sort_order ?? 0),
  hasInventory: Boolean(row.has_inventory),
  inventoryQtyAvailable:
    row.inventory_qty_available === null || row.inventory_qty_available === undefined
      ? null
      : Number(row.inventory_qty_available),
  inventoryQtyInStockDam:
    row.inventory_qty_in_stock_dam === null || row.inventory_qty_in_stock_dam === undefined
      ? null
      : Number(row.inventory_qty_in_stock_dam),
  inventoryQtyReserved:
    row.inventory_qty_reserved === null || row.inventory_qty_reserved === undefined
      ? null
      : Number(row.inventory_qty_reserved),
  inventoryQtyOnorder:
    row.inventory_qty_onorder === null || row.inventory_qty_onorder === undefined
      ? null
      : Number(row.inventory_qty_onorder),
  inventoryUpdatedAt: row.inventory_updated_at ? String(row.inventory_updated_at) : null,
  ezproItemImageUrl: String(row.ezpro_item_image_url ?? ""),
  inventoryLocations: Array.isArray(row.inventory_locations)
    ? row.inventory_locations.map((location: any) => ({
        locationName: String(location?.location_name ?? location?.locationName ?? ""),
        qty: Number(location?.qty ?? 0),
      }))
    : [],
  inventoryVariants: Array.isArray(row.inventory_variants)
    ? row.inventory_variants.map((variant: any) => ({
        itemNumber: String(variant?.item_number ?? variant?.itemNumber ?? ""),
        qtyAvailable: Number(variant?.qty_available ?? variant?.qtyAvailable ?? 0),
        finish: String(variant?.finish ?? ""),
        fabric: String(variant?.fabric ?? ""),
        pillow1Set: String(variant?.pillow1_set ?? variant?.pillow1Set ?? ""),
        pillow2Set: String(variant?.pillow2_set ?? variant?.pillow2Set ?? ""),
      }))
    : [],
});

const mapReferenceNote = (row: any): ManufacturerReferenceNote => ({
  id: String(row.id ?? ""),
  manufacturer: String(row.manufacturer ?? ""),
  manufacturerSlug: String(row.manufacturer_slug ?? ""),
  uploadId: row.upload_id === null || row.upload_id === undefined ? null : String(row.upload_id),
  noteType: String(row.note_type ?? "reference"),
  title: String(row.title ?? ""),
  content: String(row.content ?? ""),
  videoUrl: String(row.video_url ?? ""),
  sourceSortOrder: Number(row.source_sort_order ?? 0),
  createdAt: row.created_at ? String(row.created_at) : null,
});

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`POS API ${response.status} for ${path}${message ? `: ${message}` : ""}`);
  }
  return response.json();
}

export async function fetchManufacturerPricebookUploads(
  manufacturer?: string
): Promise<ManufacturerPricebookUpload[]> {
  const search = manufacturer ? `?manufacturer=${encodeURIComponent(manufacturer)}` : "";
  const json = await fetchJson(`/api/manufacturer-pricebooks/uploads${search}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUpload(row));
}

export async function fetchManufacturerPricebookSummary(): Promise<ManufacturerPricebookSummary> {
  const json = await fetchJson("/api/manufacturer-pricebooks/summary");
  return {
    totals: {
      manufacturers: Number((json as any)?.totals?.manufacturers ?? 0),
      uploads: Number((json as any)?.totals?.uploads ?? 0),
      catalogRows: Number((json as any)?.totals?.catalogRows ?? 0),
      holding: Number((json as any)?.totals?.holding ?? 0),
    },
    manufacturers: Array.isArray((json as any)?.manufacturers)
      ? (json as any).manufacturers.map((row: any) => ({
          manufacturer: String(row.manufacturer ?? ""),
          manufacturerSlug: String(row.manufacturerSlug ?? row.manufacturer_slug ?? ""),
          statuses: row.statuses && typeof row.statuses === "object" ? row.statuses : {},
          uploadCount: Number(row.uploadCount ?? 0),
          catalogRows: Number(row.catalogRows ?? 0),
          pricedRows: Number(row.pricedRows ?? 0),
          parserSupported: Boolean(row.parserSupported),
          latestUploadAt: row.latestUploadAt ?? null,
          latestCatalogAt: row.latestCatalogAt ?? null,
        }))
      : [],
  };
}

export async function uploadManufacturerPricebookToHolding(input: {
  manufacturer: string;
  files: File[];
  replaceExisting?: boolean;
  documentType?: string;
}): Promise<ManufacturerPricebookUpload[]> {
  const formData = new FormData();
  formData.append("manufacturer", input.manufacturer);
  formData.append("replace_existing", String(input.replaceExisting ?? true));
  if (input.documentType) formData.append("document_type", input.documentType);
  input.files.forEach((file) => formData.append("files", file));

  const baseUrl = getPosApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/manufacturer-pricebooks/uploads`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `POS API ${response.status} for /api/manufacturer-pricebooks/uploads${message ? `: ${message}` : ""}`
    );
  }
  const json = await response.json();
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  if (rows.length) return rows.map((row: any) => mapUpload(row));
  return (json as any)?.row ? [mapUpload((json as any).row)] : [];
}

export async function previewManufacturerPricebookUpload(uploadId: string): Promise<{
  upload: ManufacturerPricebookUpload | null;
  rows: ManufacturerCatalogItem[];
  notes: ManufacturerReferenceNote[];
}> {
  const json = await fetchJson(`/api/manufacturer-pricebooks/uploads/${encodeURIComponent(uploadId)}/preview`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  const notes = Array.isArray((json as any)?.notes) ? (json as any).notes : [];
  return {
    upload: (json as any)?.upload ? mapUpload((json as any).upload) : null,
    rows: rows.map((row: any) => mapCatalogItem(row)),
    notes: notes.map((row: any) => mapReferenceNote(row)),
  };
}

export async function analyzeManufacturerPricebookUpload(uploadId: string): Promise<{
  upload: ManufacturerPricebookUpload | null;
  resolvedUpload: ManufacturerPricebookUpload | null;
  supported: boolean;
  parserSupported: boolean;
  parserKind: string;
  analysis: ManufacturerUploadAnalysis;
}> {
  const json = await fetchJson(`/api/manufacturer-pricebooks/uploads/${encodeURIComponent(uploadId)}/analyze`);
  return {
    upload: (json as any)?.upload ? mapUpload((json as any).upload) : null,
    resolvedUpload: (json as any)?.resolvedUpload ? mapUpload((json as any).resolvedUpload) : null,
    supported: Boolean((json as any)?.supported),
    parserSupported: Boolean((json as any)?.parserSupported),
    parserKind: String((json as any)?.parserKind ?? ""),
    analysis: ((json as any)?.analysis || { mode: "unknown", supported: false, parserKind: "unknown" }) as ManufacturerUploadAnalysis,
  };
}

export async function previewMappedManufacturerPricebookUpload(input: {
  uploadId: string;
  sheetName?: string;
  headerRowIndex?: number;
  mappings: Record<string, number | string | null | undefined>;
  saveProfile?: boolean;
}): Promise<{
  upload: ManufacturerPricebookUpload | null;
  rows: ManufacturerCatalogItem[];
  notes: ManufacturerReferenceNote[];
  analysis: { sheetName: string; headerRowIndex: number; rowCount: number; headers: string[] };
}> {
  const json = await fetchJson(`/api/manufacturer-pricebooks/uploads/${encodeURIComponent(input.uploadId)}/mapped-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetName: input.sheetName,
      headerRowIndex: input.headerRowIndex,
      mappings: input.mappings,
      saveProfile: input.saveProfile ?? true,
    }),
  });
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  const notes = Array.isArray((json as any)?.notes) ? (json as any).notes : [];
  return {
    upload: (json as any)?.upload ? mapUpload((json as any).upload) : null,
    rows: rows.map((row: any) => mapCatalogItem(row)),
    notes: notes.map((row: any) => mapReferenceNote(row)),
    analysis: {
      sheetName: String((json as any)?.analysis?.sheetName ?? ""),
      headerRowIndex: Number((json as any)?.analysis?.headerRowIndex ?? 0),
      rowCount: Number((json as any)?.analysis?.rowCount ?? rows.length),
      headers: Array.isArray((json as any)?.analysis?.headers)
        ? (json as any).analysis.headers.map((value: any) => String(value))
        : [],
    },
  };
}

export async function publishManufacturerPricebookUpload(input: {
  uploadId: string;
  rows: ManufacturerCatalogItem[];
}): Promise<{
  publishedRows: number;
  manufacturerTotalRows: number;
  manufacturer: string;
}> {
  const json = await fetchJson(`/api/manufacturer-pricebooks/uploads/${encodeURIComponent(input.uploadId)}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: input.rows }),
  });
  return {
    publishedRows: Number((json as any)?.published_rows ?? 0),
    manufacturerTotalRows: Number((json as any)?.manufacturer_total_rows ?? 0),
    manufacturer: String((json as any)?.manufacturer ?? ""),
  };
}

export async function fetchManufacturerCatalog(input?: {
  manufacturer?: string;
  category?: string;
  color?: string;
  query?: string;
  limit?: number;
  inStockOnly?: boolean;
}): Promise<{
  rows: ManufacturerCatalogItem[];
  total: number;
  count: number;
  limit: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (input?.manufacturer) params.set("manufacturer", input.manufacturer);
  if (input?.category) params.set("category", input.category);
  if (input?.color) params.set("color", input.color);
  if (input?.query) params.set("query", input.query);
  if (input?.limit) params.set("limit", String(input.limit));
  if (input?.inStockOnly) params.set("in_stock_only", "1");
  const search = params.toString();
  const json = await fetchJson(`/api/manufacturer-pricebooks/catalog${search ? `?${search}` : ""}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return {
    rows: rows.map((row: any) => mapCatalogItem(row)),
    total: Number((json as any)?.total ?? rows.length),
    count: Number((json as any)?.count ?? rows.length),
    limit: Number((json as any)?.limit ?? input?.limit ?? rows.length),
    hasMore: Boolean((json as any)?.has_more ?? (json as any)?.hasMore),
  };
}

export async function fetchManufacturerReferenceNotes(
  manufacturer?: string
): Promise<ManufacturerReferenceNote[]> {
  const search = manufacturer ? `?manufacturer=${encodeURIComponent(manufacturer)}` : "";
  const json = await fetchJson(`/api/manufacturer-pricebooks/notes${search}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapReferenceNote(row));
}
