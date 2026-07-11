import type { Express } from "express";
import type { Pool } from "pg";
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
type ImageCandidateRun = {
    manufacturerSlug: string;
    runDir: string;
    publicPathPrefix: string;
};
type RegisterManufacturerPricebookRoutesDeps = {
    app: Express;
    pool: Pool;
    requireOwner: (req: any, res: any, next: any) => any;
    holdingDir: string;
    execFileAsync: ExecFileAsyncLike;
    imageCandidateRuns?: ImageCandidateRun[];
};
export declare function registerManufacturerPricebookRoutes({ app, pool, requireOwner, holdingDir, execFileAsync, imageCandidateRuns, }: RegisterManufacturerPricebookRoutesDeps): void;
export {};
