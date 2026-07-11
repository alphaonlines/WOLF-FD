import type { Express } from "express";
import type { Pool } from "pg";
type UploadLike = {
    array: (fieldName: string, maxCount?: number) => any;
};
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
type RegisterSystemRoutesDeps = {
    app: Express;
    pool: Pool;
    upload: UploadLike;
    uploadsDir: string;
    importerPath: string;
    pythonBin: string;
    execFileAsync: ExecFileAsyncLike;
};
export declare function registerSystemRoutes({ app, pool, upload, uploadsDir, importerPath, pythonBin, execFileAsync, }: RegisterSystemRoutesDeps): void;
export {};
