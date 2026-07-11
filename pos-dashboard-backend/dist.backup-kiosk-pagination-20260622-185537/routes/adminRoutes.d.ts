import type { Express } from "express";
import type { Pool } from "pg";
type AuthUserLike = {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    permissionMode?: "role" | "explicit";
};
type AdminRoutesDeps = {
    app: Express;
    pool: Pool;
    requireOwner: (req: any, res: any, next: any) => any;
    normalizeRoleList: (raw: any) => string[];
    hashPassword: (password: string) => string;
    setUserRolesByKeys: (userId: number, roleKeys: string[]) => Promise<void>;
    loadAuthUserById: (userId: number) => Promise<AuthUserLike | null>;
};
export declare function registerAdminRoutes({ app, pool, requireOwner, normalizeRoleList, hashPassword, setUserRolesByKeys, loadAuthUserById, }: AdminRoutesDeps): void;
export {};
