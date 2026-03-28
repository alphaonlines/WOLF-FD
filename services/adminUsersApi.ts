import type { ManagedUser, UserRole } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type ApiUserRow = {
  id: number | string;
  name: string;
  email: string;
  active: boolean;
  roles: string[];
  phone?: string | null;
  auth_provider?: string | null;
  access_status?: string | null;
  access_requested_at?: string | null;
  access_approved_at?: string | null;
  explicit_permission_count?: number | null;
  permission_mode?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const mapUser = (row: ApiUserRow): ManagedUser => ({
  id: String(row.id ?? ""),
  name: String(row.name ?? ""),
  email: String(row.email ?? ""),
  active: Boolean(row.active),
  roles: (Array.isArray(row.roles) ? row.roles : []).map((r) => String(r)) as UserRole[],
  phone: row.phone ? String(row.phone) : "",
  authProvider: row.auth_provider ? String(row.auth_provider) : "password",
  accessStatus: row.access_status ? String(row.access_status) : "approved",
  accessRequestedAt: row.access_requested_at ? String(row.access_requested_at) : undefined,
  accessApprovedAt: row.access_approved_at ? String(row.access_approved_at) : undefined,
  explicitPermissionCount: Number(row.explicit_permission_count ?? 0),
  permissionMode: row.permission_mode === "explicit" ? "explicit" : "role",
  createdAt: row.created_at ? String(row.created_at) : undefined,
  updatedAt: row.updated_at ? String(row.updated_at) : undefined,
});

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

export async function fetchAdminRoles(): Promise<Array<{ key: UserRole; label: string }>> {
  const json = await fetchJson("/api/admin/roles");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows
    .map((row: any) => ({ key: String(row.key ?? "") as UserRole, label: String(row.label ?? "") }))
    .filter((row: any) => !!row.key);
}

export async function fetchAdminUsers(): Promise<ManagedUser[]> {
  const json = await fetchJson("/api/admin/users");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUser(row as ApiUserRow));
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  roles: UserRole[];
  active?: boolean;
}): Promise<void> {
  await fetchJson("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
      roles: input.roles,
      active: input.active ?? true,
    }),
  });
}

export async function updateAdminUserRoles(userId: string, roles: UserRole[]): Promise<void> {
  await fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/roles`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  });
}

export async function setAdminUserActive(userId: string, active: boolean): Promise<void> {
  await fetchJson(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

export async function setAdminUserAccessStatus(userId: string, accessStatus: "approved" | "pending"): Promise<void> {
  await fetchJson(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_status: accessStatus }),
  });
}

export async function resetAdminUserPassword(userId: string, password: string): Promise<void> {
  await fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}
