import type { Pool } from "pg";
type RunStartupBootstrapDeps = {
    pool: Pool;
    envString: (key: string, fallback?: string) => string | undefined;
    hashPassword: (password: string, saltHex?: string) => string;
    setUserRolesByKeys: (userId: number, roleKeys: string[]) => Promise<void>;
};
export declare function runStartupBootstrap(deps: RunStartupBootstrapDeps): Promise<void>;
export {};
