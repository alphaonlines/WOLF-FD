import type { Pool } from "pg";
import type { AuthUserView } from "./authSessionUtils";
type CreateAuthDbHelpersDeps = {
    pool: Pool;
    authCookieName: string;
    parseCookies: (req: any) => Record<string, string>;
    sha256Hex: (value: string) => string;
    buildAuthUser: (row: any) => AuthUserView;
    normalizeRoleList: (raw: any) => AuthUserView["roles"];
};
export declare function createAuthDbHelpers({ pool, authCookieName, parseCookies, sha256Hex, buildAuthUser, normalizeRoleList, }: CreateAuthDbHelpersDeps): {
    currentAuthUserFromReq: (req: any) => Promise<AuthUserView | null>;
    setUserRolesByKeys: (userId: number, roleKeys: string[]) => Promise<void>;
    loadAuthUserById: (userId: number) => Promise<AuthUserView | null>;
};
export {};
