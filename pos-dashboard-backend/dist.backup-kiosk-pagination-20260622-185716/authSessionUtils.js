"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_USER_ROLES = void 0;
exports.normalizeRoleList = normalizeRoleList;
exports.hasAnyRole = hasAnyRole;
exports.buildAuthUser = buildAuthUser;
exports.parseCookies = parseCookies;
exports.setAuthCookie = setAuthCookie;
exports.clearAuthCookie = clearAuthCookie;
exports.VALID_USER_ROLES = ["Owner", "Manager", "Sales", "Marketing"];
function normalizeRoleList(raw) {
    const inList = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
    const seen = new Set();
    const out = [];
    for (const item of inList) {
        const role = String(item || "").trim();
        if (!role || seen.has(role))
            continue;
        if (!exports.VALID_USER_ROLES.includes(role))
            continue;
        seen.add(role);
        out.push(role);
    }
    return out;
}
function hasAnyRole(user, roles) {
    if (!user)
        return false;
    const own = new Set((user.roles || []).map((r) => String(r)));
    return roles.some((r) => own.has(r));
}
function buildAuthUser(row) {
    const permissionsRaw = Array.isArray(row?.permissions) ? row.permissions : [];
    const permissionSet = new Set();
    const permissions = [];
    for (const item of permissionsRaw) {
        const key = String(item || "").trim();
        if (!key || permissionSet.has(key))
            continue;
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
        tutorialCompletedAt: row?.tutorial_completed_at ? new Date(row.tutorial_completed_at).toISOString() : null,
        tutorialResetAt: row?.tutorial_reset_at ? new Date(row.tutorial_reset_at).toISOString() : null,
    };
}
function parseCookies(req) {
    const raw = typeof req.headers?.cookie === "string" ? req.headers.cookie : "";
    if (!raw)
        return {};
    const out = {};
    for (const part of raw.split(";")) {
        const idx = part.indexOf("=");
        if (idx <= 0)
            continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key)
            continue;
        try {
            out[key] = decodeURIComponent(value);
        }
        catch {
            out[key] = value;
        }
    }
    return out;
}
function isSecureRequest(req, authCookieSecureMode) {
    if (authCookieSecureMode === "true")
        return true;
    if (authCookieSecureMode === "false")
        return false;
    const proto = String(req.headers?.["x-forwarded-proto"] || "").toLowerCase();
    return Boolean(req.secure) || proto.includes("https");
}
function setAuthCookie(res, token, req, deps) {
    const maxAgeMs = deps.authSessionDays * 24 * 60 * 60 * 1000;
    const cookie = [
        `${deps.authCookieName}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    ];
    if (isSecureRequest(req, deps.authCookieSecureMode))
        cookie.push("Secure");
    res.setHeader("Set-Cookie", cookie.join("; "));
}
function clearAuthCookie(res, req, deps) {
    const cookie = [
        `${deps.authCookieName}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
    ];
    if (isSecureRequest(req, deps.authCookieSecureMode))
        cookie.push("Secure");
    res.setHeader("Set-Cookie", cookie.join("; "));
}
//# sourceMappingURL=authSessionUtils.js.map