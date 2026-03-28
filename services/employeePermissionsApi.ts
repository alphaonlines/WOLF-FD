import type { PermissionCatalogEntry, PermissionMode, UserRole } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type EmployeePermissionsResponse = {
  catalog?: Array<{
    key?: string;
    label?: string;
    scope?: string;
    description?: string;
  }>;
  row?: {
    user_id?: number | string;
    name?: string;
    email?: string;
    roles?: string[];
    permission_mode?: string;
    explicit_permissions?: Record<string, boolean>;
    role_permissions?: Record<string, boolean>;
    effective_permissions?: Record<string, boolean>;
    explicit_permission_count?: number;
  };
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

export async function fetchEmployeePermissions(userId: string): Promise<{
  catalog: PermissionCatalogEntry[];
  row: {
    userId: string;
    name: string;
    email: string;
    roles: UserRole[];
    permissionMode: PermissionMode;
    explicitPermissions: Record<string, boolean>;
    rolePermissions: Record<string, boolean>;
    effectivePermissions: Record<string, boolean>;
    explicitPermissionCount: number;
  } | null;
}> {
  const json = (await fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/permissions`)) as EmployeePermissionsResponse;
  const catalog = (Array.isArray(json.catalog) ? json.catalog : []).map((entry) => ({
    key: String(entry.key || ""),
    label: String(entry.label || ""),
    scope:
      entry.scope === "dashboard_card" || entry.scope === "feature" || entry.scope === "module"
        ? entry.scope
        : "module",
    description: String(entry.description || ""),
  })) as PermissionCatalogEntry[];

  const row = json.row
    ? {
        userId: String(json.row.user_id ?? ""),
        name: String(json.row.name ?? ""),
        email: String(json.row.email ?? ""),
        roles: (Array.isArray(json.row.roles) ? json.row.roles.map((role) => String(role)) : []) as UserRole[],
        permissionMode: json.row.permission_mode === "explicit" ? "explicit" : "role",
        explicitPermissions:
          json.row.explicit_permissions && typeof json.row.explicit_permissions === "object"
            ? { ...json.row.explicit_permissions }
            : {},
        rolePermissions:
          json.row.role_permissions && typeof json.row.role_permissions === "object"
            ? { ...json.row.role_permissions }
            : {},
        effectivePermissions:
          json.row.effective_permissions && typeof json.row.effective_permissions === "object"
            ? { ...json.row.effective_permissions }
            : {},
        explicitPermissionCount: Number(json.row.explicit_permission_count ?? 0),
      }
    : null;

  return { catalog, row };
}

export async function saveEmployeePermissions(
  userId: string,
  mode: PermissionMode,
  permissions: Record<string, boolean>
): Promise<void> {
  await fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/permissions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      permissions,
    }),
  });
}
