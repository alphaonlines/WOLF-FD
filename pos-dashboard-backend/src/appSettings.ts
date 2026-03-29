import type { Pool } from "pg";

export const GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY = "auth_google_workspace";

export type GoogleWorkspaceAuthSettings = {
  googleWorkspaceEnabled: boolean;
  googleClientId: string;
  googleHostedDomain: string;
  updatedAt: string | null;
  source: "database" | "environment";
};

type GoogleWorkspaceAuthSettingsInput = {
  googleWorkspaceEnabled?: boolean;
  googleClientId?: string;
  googleHostedDomain?: string;
};

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeHostedDomain = (value: unknown, fallback: string) => {
  const next = normalizeText(value).toLowerCase();
  return next || fallback.trim().toLowerCase();
};

export async function loadGoogleWorkspaceAuthSettings(
  pool: Pool,
  fallback: Pick<GoogleWorkspaceAuthSettings, "googleWorkspaceEnabled" | "googleClientId" | "googleHostedDomain">
): Promise<GoogleWorkspaceAuthSettings> {
  const row = await pool
    .query(
      `
        SELECT value_json, updated_at
        FROM app_settings
        WHERE key = $1
        LIMIT 1
      `,
      [GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY]
    )
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
  const googleWorkspaceEnabledRaw =
    typeof valueJson.googleWorkspaceEnabled === "boolean"
      ? valueJson.googleWorkspaceEnabled
      : Boolean(fallback.googleWorkspaceEnabled);

  return {
    googleWorkspaceEnabled: Boolean(googleWorkspaceEnabledRaw && googleClientId),
    googleClientId,
    googleHostedDomain: normalizeHostedDomain(
      valueJson.googleHostedDomain ?? fallback.googleHostedDomain,
      "furnituredistributors.net"
    ),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    source: "database",
  };
}

export async function saveGoogleWorkspaceAuthSettings(
  pool: Pool,
  input: GoogleWorkspaceAuthSettingsInput,
  fallbackHostedDomain: string
): Promise<GoogleWorkspaceAuthSettings> {
  const googleClientId = normalizeText(input.googleClientId);
  const googleWorkspaceEnabled = Boolean(input.googleWorkspaceEnabled && googleClientId);
  const googleHostedDomain = normalizeHostedDomain(input.googleHostedDomain, fallbackHostedDomain);

  const result = await pool.query(
    `
      INSERT INTO app_settings (key, value_json, created_at, updated_at)
      VALUES ($1, $2::jsonb, now(), now())
      ON CONFLICT (key)
      DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()
      RETURNING updated_at
    `,
    [
      GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY,
      JSON.stringify({
        googleWorkspaceEnabled,
        googleClientId,
        googleHostedDomain,
      }),
    ]
  );

  return {
    googleWorkspaceEnabled,
    googleClientId,
    googleHostedDomain,
    updatedAt: result.rows[0]?.updated_at ? String(result.rows[0].updated_at) : null,
    source: "database",
  };
}
