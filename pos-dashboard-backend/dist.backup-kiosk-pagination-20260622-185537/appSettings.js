"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY = void 0;
exports.loadGoogleWorkspaceAuthSettings = loadGoogleWorkspaceAuthSettings;
exports.saveGoogleWorkspaceAuthSettings = saveGoogleWorkspaceAuthSettings;
exports.GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY = "auth_google_workspace";
const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
const normalizeHostedDomain = (value, fallback) => {
    const next = normalizeText(value).toLowerCase();
    return next || fallback.trim().toLowerCase();
};
async function loadGoogleWorkspaceAuthSettings(pool, fallback) {
    const row = await pool
        .query(`
        SELECT value_json, updated_at
        FROM app_settings
        WHERE key = $1
        LIMIT 1
      `, [exports.GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY])
        .then((result) => result.rows[0] || null)
        .catch(() => null);
    if (!row) {
        return {
            googleWorkspaceEnabled: Boolean(fallback.googleWorkspaceEnabled && normalizeText(fallback.googleClientId)),
            googleClientId: normalizeText(fallback.googleClientId),
            googleHostedDomain: normalizeHostedDomain(fallback.googleHostedDomain, "furnituredistributors.net"),
            updatedAt: null,
            source: "environment",
        };
    }
    const valueJson = row.value_json && typeof row.value_json === "object" ? row.value_json : {};
    const googleClientId = normalizeText(valueJson.googleClientId ?? fallback.googleClientId);
    const googleWorkspaceEnabledRaw = typeof valueJson.googleWorkspaceEnabled === "boolean"
        ? valueJson.googleWorkspaceEnabled
        : Boolean(fallback.googleWorkspaceEnabled);
    return {
        googleWorkspaceEnabled: Boolean(googleWorkspaceEnabledRaw && googleClientId),
        googleClientId,
        googleHostedDomain: normalizeHostedDomain(valueJson.googleHostedDomain ?? fallback.googleHostedDomain, "furnituredistributors.net"),
        updatedAt: row.updated_at ? String(row.updated_at) : null,
        source: "database",
    };
}
async function saveGoogleWorkspaceAuthSettings(pool, input, fallbackHostedDomain) {
    const googleClientId = normalizeText(input.googleClientId);
    const googleWorkspaceEnabled = Boolean(input.googleWorkspaceEnabled && googleClientId);
    const googleHostedDomain = normalizeHostedDomain(input.googleHostedDomain, fallbackHostedDomain);
    const result = await pool.query(`
      INSERT INTO app_settings (key, value_json, created_at, updated_at)
      VALUES ($1, $2::jsonb, now(), now())
      ON CONFLICT (key)
      DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()
      RETURNING updated_at
    `, [
        exports.GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY,
        JSON.stringify({
            googleWorkspaceEnabled,
            googleClientId,
            googleHostedDomain,
        }),
    ]);
    return {
        googleWorkspaceEnabled,
        googleClientId,
        googleHostedDomain,
        updatedAt: result.rows[0]?.updated_at ? String(result.rows[0].updated_at) : null,
        source: "database",
    };
}
//# sourceMappingURL=appSettings.js.map