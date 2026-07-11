import type { Pool } from "pg";
export declare const GOOGLE_WORKSPACE_AUTH_SETTINGS_KEY = "auth_google_workspace";
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
export declare function loadGoogleWorkspaceAuthSettings(pool: Pool, fallback: Pick<GoogleWorkspaceAuthSettings, "googleWorkspaceEnabled" | "googleClientId" | "googleHostedDomain">): Promise<GoogleWorkspaceAuthSettings>;
export declare function saveGoogleWorkspaceAuthSettings(pool: Pool, input: GoogleWorkspaceAuthSettingsInput, fallbackHostedDomain: string): Promise<GoogleWorkspaceAuthSettings>;
export {};
