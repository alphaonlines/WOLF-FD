export declare const VALID_USER_ROLES: readonly ["Owner", "Manager", "Sales", "Marketing"];
export type AuthUserView = {
    id: string;
    name: string;
    email: string;
    roles: (typeof VALID_USER_ROLES)[number][];
    permissions: string[];
    permissionMode: "role" | "explicit";
    tutorialCompletedAt: string | null;
    tutorialResetAt: string | null;
};
export declare function normalizeRoleList(raw: any): (typeof VALID_USER_ROLES)[number][];
export declare function hasAnyRole(user: AuthUserView | null | undefined, roles: string[]): boolean;
export declare function buildAuthUser(row: any): AuthUserView;
export declare function parseCookies(req: any): Record<string, string>;
export declare function setAuthCookie(res: any, token: string, req: any, deps: {
    authCookieName: string;
    authSessionDays: number;
    authCookieSecureMode: string;
}): void;
export declare function clearAuthCookie(res: any, req: any, deps: {
    authCookieName: string;
    authCookieSecureMode: string;
}): void;
