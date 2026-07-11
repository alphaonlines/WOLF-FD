import type { Express } from "express";
import type { Pool } from "pg";
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
type UploadLike = {
    array: (fieldName: string, maxCount?: number) => any;
};
type RegisterAllRoutesDeps = {
    app: Express;
    pool: Pool;
    upload: UploadLike;
    uploadsDir: string;
    manufacturerPricebookHoldingDir: string;
    boardUploadsDir: string;
    importerPath: string;
    pythonBin: string;
    execFileAsync: ExecFileAsyncLike;
    socialUploadsDir: string;
    socialPublicBaseUrl: string;
    runSocialDueJobsOnce: (maxJobs?: number) => Promise<number>;
    authCookieName: string;
    authSessionDays: number;
    authCookieSecureMode: string;
    publicAuthPaths: Set<string>;
    verifyPassword: (password: string, storedHash: string) => boolean;
    hashPassword: (password: string, saltHex?: string) => string;
    sha256Hex: (value: string) => string;
    createSessionToken: () => string;
};
export declare function registerAllRoutes({ app, pool, upload, uploadsDir, manufacturerPricebookHoldingDir, boardUploadsDir, importerPath, pythonBin, execFileAsync, socialUploadsDir, socialPublicBaseUrl, runSocialDueJobsOnce, authCookieName, authSessionDays, authCookieSecureMode, publicAuthPaths, verifyPassword, hashPassword, sha256Hex, createSessionToken, }: RegisterAllRoutesDeps): {
    setUserRolesByKeys: (userId: number, roleKeys: string[]) => Promise<void>;
};
export {};
