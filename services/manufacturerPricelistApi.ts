import type { ManufacturerPricebookUpload } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

const mapUpload = (row: any): ManufacturerPricebookUpload => ({
  id: String(row.id ?? ""),
  manufacturer: String(row.manufacturer ?? ""),
  manufacturerSlug: String(row.manufacturer_slug ?? ""),
  originalName: String(row.original_name ?? ""),
  storageName: String(row.storage_name ?? ""),
  relativePath: String(row.relative_path ?? ""),
  mimeType: String(row.mime_type ?? "application/octet-stream"),
  fileSizeBytes: Number(row.file_size_bytes ?? 0),
  replaceExisting: Boolean(row.replace_existing),
  status: String(row.status ?? "holding"),
  uploadedByUserId:
    row.uploaded_by_user_id === null || row.uploaded_by_user_id === undefined
      ? null
      : String(row.uploaded_by_user_id),
  createdAt: row.created_at ? String(row.created_at) : undefined,
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
  file: File;
  replaceExisting?: boolean;
}): Promise<ManufacturerPricebookUpload> {
  const formData = new FormData();
  formData.append("manufacturer", input.manufacturer);
  formData.append("replace_existing", String(input.replaceExisting ?? true));
  formData.append("file", input.file);

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
  return mapUpload((json as any)?.row || {});
}
