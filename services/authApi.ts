import type { AuthUser, UserRole } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type AuthResponse = {
  ok?: boolean;
  user?: {
    id?: string | number;
    name?: string;
    email?: string;
    roles?: string[];
  } | null;
};

const mapUser = (raw: AuthResponse["user"]): AuthUser | null => {
  if (!raw) return null;
  const id = raw.id === null || raw.id === undefined ? "" : String(raw.id);
  const name = String(raw.name ?? "").trim();
  const email = String(raw.email ?? "").trim();
  if (!id || !email) return null;
  return {
    id,
    name: name || email,
    email,
    roles: (Array.isArray(raw.roles) ? raw.roles.map((r) => String(r)) : []) as UserRole[],
  };
};

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await authFetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Auth check failed (${res.status})${msg ? `: ${msg}` : ""}`);
  }
  const json = (await res.json()) as AuthResponse;
  return mapUser(json.user);
}

export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const res = await authFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Login failed (${res.status})${msg ? `: ${msg}` : ""}`);
  }
  const json = (await res.json()) as AuthResponse;
  const user = mapUser(json.user);
  if (!user) throw new Error("Login succeeded but no user was returned.");
  return user;
}

export async function logoutCurrentUser(): Promise<void> {
  await authFetch("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => {
    // Ignore logout errors; local state should still clear.
  });
}

export async function changeCurrentPassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await authFetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Password change failed (${res.status})${msg ? `: ${msg}` : ""}`);
  }
}
