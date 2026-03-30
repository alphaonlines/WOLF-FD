import { getPosApiBaseUrl } from "./posBackendApi";

export type CustomObjection = {
  id: number;
  objection_id: string;
  label: string;
  rebuttals: string[];
  sort_order: number;
  is_active: boolean;
  source: string;
  created_at: string;
};

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`POS API ${res.status} for ${path}${msg ? `: ${msg}` : ""}`);
  }
  return res.json();
}

export async function fetchCustomObjections(): Promise<CustomObjection[]> {
  const json = await fetchJson("/api/custom-objections");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows as CustomObjection[];
}

export async function createCustomObjection(data: {
  label: string;
  rebuttals: string[];
  objection_id?: string;
  sort_order?: number;
}): Promise<CustomObjection> {
  const json = await fetchJson("/api/custom-objections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const row = (json as any)?.row;
  if (!row) throw new Error("Custom objection create did not return row");
  return row as CustomObjection;
}

export async function updateCustomObjection(
  id: number,
  patch: Partial<Omit<CustomObjection, "id" | "created_at">>
): Promise<CustomObjection> {
  const json = await fetchJson(`/api/custom-objections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const row = (json as any)?.row;
  if (!row) throw new Error("Custom objection update did not return row");
  return row as CustomObjection;
}

export async function deleteCustomObjection(id: number): Promise<void> {
  await fetchJson(`/api/custom-objections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
