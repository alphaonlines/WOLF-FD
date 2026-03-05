import type { PermissionCatalogEntry, PermissionScope, RolePermissionRow, UserRole } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type PermissionsResponse = {
  catalog?: Array<{
    key?: string;
    label?: string;
    scope?: string;
    description?: string;
  }>;
  rows?: Array<{
    role_key?: string;
    label?: string;
    permissions?: Record<string, boolean>;
  }>;
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

export async function fetchRolePermissions(): Promise<{
  catalog: PermissionCatalogEntry[];
  rows: RolePermissionRow[];
}> {
  const json = (await fetchJson("/api/admin/permissions")) as PermissionsResponse;
  const catalog = (Array.isArray(json.catalog) ? json.catalog : []).map((entry) => ({
    scope:
      entry.scope === "dashboard_card" || entry.scope === "feature" || entry.scope === "module"
        ? (entry.scope as PermissionScope)
        : "module",
    key: String(entry.key || ""),
    label: String(entry.label || ""),
    description: String(entry.description || ""),
  }));
  const rows = (Array.isArray(json.rows) ? json.rows : []).map((row) => ({
    roleKey: String(row.role_key || "") as UserRole,
    label: String(row.label || row.role_key || ""),
    permissions: row.permissions && typeof row.permissions === "object" ? { ...row.permissions } : {},
  }));
  return { catalog, rows };
}

export async function saveRolePermissions(
  roleKey: UserRole,
  permissions: Record<string, boolean>
): Promise<void> {
  await fetchJson(`/api/admin/permissions/${encodeURIComponent(roleKey)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
}
