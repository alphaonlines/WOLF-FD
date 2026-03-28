export const VALID_USER_ROLES = ["Owner", "Manager", "Sales", "Marketing"] as const;

export type AuthUserView = {
  id: string;
  name: string;
  email: string;
  roles: (typeof VALID_USER_ROLES)[number][];
  permissions: string[];
  permissionMode: "role" | "explicit";
};

export function normalizeRoleList(raw: any): (typeof VALID_USER_ROLES)[number][] {
  const inList = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const seen = new Set<string>();
  const out: (typeof VALID_USER_ROLES)[number][] = [];
  for (const item of inList) {
    const role = String(item || "").trim();
    if (!role || seen.has(role)) continue;
    if (!VALID_USER_ROLES.includes(role as any)) continue;
    seen.add(role);
    out.push(role as any);
  }
  return out;
}

export function hasAnyRole(user: AuthUserView | null | undefined, roles: string[]): boolean {
  if (!user) return false;
  const own = new Set((user.roles || []).map((r) => String(r)));
  return roles.some((r) => own.has(r));
}

export function buildAuthUser(row: any): AuthUserView {
  const permissionsRaw = Array.isArray(row?.permissions) ? row.permissions : [];
  const permissionSet = new Set<string>();
  const permissions: string[] = [];
  for (const item of permissionsRaw) {
    const key = String(item || "").trim();
    if (!key || permissionSet.has(key)) continue;
    permissionSet.add(key);
    permissions.push(key);
  }
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    roles: normalizeRoleList(row.roles),
    permissions,
    permissionMode: row?.permission_mode === "explicit" ? "explicit" : "role",
  };
}

export function parseCookies(req: any): Record<string, string> {
  const raw = typeof req.headers?.cookie === "string" ? req.headers.cookie : "";
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function isSecureRequest(req: any, authCookieSecureMode: string): boolean {
  if (authCookieSecureMode === "true") return true;
  if (authCookieSecureMode === "false") return false;
  const proto = String(req.headers?.["x-forwarded-proto"] || "").toLowerCase();
  return Boolean(req.secure) || proto.includes("https");
}

export function setAuthCookie(
  res: any,
  token: string,
  req: any,
  deps: { authCookieName: string; authSessionDays: number; authCookieSecureMode: string }
) {
  const maxAgeMs = deps.authSessionDays * 24 * 60 * 60 * 1000;
  const cookie = [
    `${deps.authCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isSecureRequest(req, deps.authCookieSecureMode)) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

export function clearAuthCookie(
  res: any,
  req: any,
  deps: { authCookieName: string; authCookieSecureMode: string }
) {
  const cookie = [
    `${deps.authCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isSecureRequest(req, deps.authCookieSecureMode)) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}
