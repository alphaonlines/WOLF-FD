import type { AccessRequestProfile, AuthConfig, AuthUser, PermissionMode, UserRole } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type AuthResponse = {
  ok?: boolean;
  user?: {
    id?: string | number;
    name?: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    permissionMode?: string;
    tutorialCompletedAt?: string | null;
  } | null;
};

type AuthConfigResponse = {
  ok?: boolean;
  googleWorkspaceEnabled?: boolean;
  googleClientId?: string;
  googleHostedDomain?: string;
  updatedAt?: string | null;
  source?: "database" | "environment";
};

type GoogleRequestProfileResponse = {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  givenName?: string;
  familyName?: string;
  phone?: string;
  accessStatus?: string;
};

type GoogleAuthResponse = {
  ok?: boolean;
  status?: string;
  user?: AuthResponse["user"];
  requestProfile?: GoogleRequestProfileResponse | null;
  error?: string;
};

export type GoogleAuthResult = {
  status: "approved" | "pending" | "request_required";
  user: AuthUser | null;
  requestProfile: AccessRequestProfile | null;
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
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map((permission) => String(permission)) : [],
    permissionMode: raw.permissionMode === "explicit" ? ("explicit" as PermissionMode) : ("role" as PermissionMode),
    tutorialCompletedAt: typeof raw.tutorialCompletedAt === "string" ? raw.tutorialCompletedAt : null,
  };
};

const mapRequestProfile = (raw: GoogleRequestProfileResponse | null | undefined): AccessRequestProfile | null => {
  if (!raw) return null;
  const email = String(raw.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const firstName = String(raw.firstName ?? raw.givenName ?? "").trim();
  const lastName = String(raw.lastName ?? raw.familyName ?? "").trim();
  const derivedName = `${firstName} ${lastName}`.trim();
  const name = String(raw.name ?? derivedName ?? "").trim() || email;
  return {
    email,
    name: name || email,
    firstName,
    lastName,
    phone: String(raw.phone ?? "").trim(),
    accessStatus: String(raw.accessStatus ?? "").trim() || "request_required",
  };
};

async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return fallback;
  try {
    const json = JSON.parse(text) as { error?: string };
    if (typeof json?.error === "string" && json.error.trim()) return json.error.trim();
  } catch {
    // fall through to raw text
  }
  return text;
}

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

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await authFetch("/api/auth/config");
  if (!res.ok) {
    const error = await readApiError(res, "Unable to load auth configuration.");
    throw new Error(error);
  }
  const json = (await res.json()) as AuthConfigResponse;
  return {
    googleWorkspaceEnabled: Boolean(json.googleWorkspaceEnabled),
    googleClientId: String(json.googleClientId ?? "").trim(),
    googleHostedDomain: String(json.googleHostedDomain ?? "").trim().toLowerCase(),
    updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : null,
    source: json.source === "database" ? "database" : "environment",
  };
}

export async function fetchAuthWorkspaceSettings(): Promise<AuthConfig> {
  const res = await authFetch("/api/admin/auth-settings");
  if (!res.ok) {
    const error = await readApiError(res, "Unable to load auth settings.");
    throw new Error(error);
  }
  const json = (await res.json()) as AuthConfigResponse;
  return {
    googleWorkspaceEnabled: Boolean(json.googleWorkspaceEnabled),
    googleClientId: String(json.googleClientId ?? "").trim(),
    googleHostedDomain: String(json.googleHostedDomain ?? "").trim().toLowerCase(),
    updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : null,
    source: json.source === "database" ? "database" : "environment",
  };
}

export async function updateAuthWorkspaceSettings(input: AuthConfig): Promise<AuthConfig> {
  const res = await authFetch("/api/admin/auth-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      googleWorkspaceEnabled: Boolean(input.googleWorkspaceEnabled),
      googleClientId: String(input.googleClientId ?? "").trim(),
      googleHostedDomain: String(input.googleHostedDomain ?? "").trim().toLowerCase(),
    }),
  });
  if (!res.ok) {
    const error = await readApiError(res, "Unable to save auth settings.");
    throw new Error(error);
  }
  const json = (await res.json()) as AuthConfigResponse;
  return {
    googleWorkspaceEnabled: Boolean(json.googleWorkspaceEnabled),
    googleClientId: String(json.googleClientId ?? "").trim(),
    googleHostedDomain: String(json.googleHostedDomain ?? "").trim().toLowerCase(),
    updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : null,
    source: json.source === "database" ? "database" : "environment",
  };
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await authFetch("/api/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readApiError(res, `Auth check failed (${res.status})`));
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
    throw new Error(await readApiError(res, `Login failed (${res.status})`));
  }
  const json = (await res.json()) as AuthResponse;
  const user = mapUser(json.user);
  if (!user) throw new Error("Login succeeded but no user was returned.");
  return user;
}

export async function startGoogleSignIn(credential: string): Promise<GoogleAuthResult> {
  const res = await authFetch("/api/auth/google/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, `Google sign-in failed (${res.status})`));
  }
  const json = (await res.json()) as GoogleAuthResponse;
  return {
    status:
      json.status === "approved" || json.status === "pending" || json.status === "request_required"
        ? json.status
        : "request_required",
    user: mapUser(json.user ?? null),
    requestProfile: mapRequestProfile(json.requestProfile),
  };
}

export async function submitGoogleAccessRequest(credential: string, phone: string): Promise<GoogleAuthResult> {
  const res = await authFetch("/api/auth/google/request-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, phone }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, `Google access request failed (${res.status})`));
  }
  const json = (await res.json()) as GoogleAuthResponse;
  return {
    status:
      json.status === "approved" || json.status === "pending" || json.status === "request_required"
        ? json.status
        : "pending",
    user: mapUser(json.user ?? null),
    requestProfile: mapRequestProfile(json.requestProfile),
  };
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
    throw new Error(await readApiError(res, `Password change failed (${res.status})`));
  }
}

export async function markTutorialComplete(): Promise<AuthUser | null> {
  const res = await authFetch("/api/auth/tutorial-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, `Tutorial update failed (${res.status})`));
  }
  const json = (await res.json()) as AuthResponse;
  return mapUser(json.user ?? null);
}
