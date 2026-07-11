import type { Express } from "express";
import type { Pool } from "pg";
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
type RegisterManufacturerPricebookRoutesDeps = {
    app: Express;
    pool: Pool;
    requireOwner: (req: any, res: any, next: any) => any;
    holdingDir: string;
    execFileAsync: ExecFileAsyncLike;
};
export declare function registerManufacturerPricebookRoutes({ app, pool, requireOwner, holdingDir, execFileAsync, }: RegisterManufacturerPricebookRoutesDeps): void;
export {};
