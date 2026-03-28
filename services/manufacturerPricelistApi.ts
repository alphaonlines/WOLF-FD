import type {
  ManufacturerCatalogItem,
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
  sourceNote: String(row.source_note ?? ""),
  sourceSortOrder: Number(row.source_sort_order ?? 0),
});

const mapReferenceNote = (row: any): ManufacturerReferenceNote => ({
  id: String(row.id ?? ""),
  manufacturer: String(row.manufacturer ?? ""),
  manufacturerSlug: String(row.manufacturer_slug ?? ""),
  uploadId: row.upload_id === null || row.upload_id === undefined ? null : String(row.upload_id),
  noteType: String(row.note_type ?? "reference"),
  title: String(row.title ?? ""),
  content: String(row.content ?? ""),
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
}): Promise<ManufacturerCatalogItem[]> {
  const params = new URLSearchParams();
  if (input?.manufacturer) params.set("manufacturer", input.manufacturer);
  if (input?.category) params.set("category", input.category);
  if (input?.color) params.set("color", input.color);
  if (input?.query) params.set("query", input.query);
  if (input?.limit) params.set("limit", String(input.limit));
  const search = params.toString();
  const json = await fetchJson(`/api/manufacturer-pricebooks/catalog${search ? `?${search}` : ""}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapCatalogItem(row));
}

export async function fetchManufacturerReferenceNotes(
  manufacturer?: string
): Promise<ManufacturerReferenceNote[]> {
  const search = manufacturer ? `?manufacturer=${encodeURIComponent(manufacturer)}` : "";
  const json = await fetchJson(`/api/manufacturer-pricebooks/notes${search}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapReferenceNote(row));
}
