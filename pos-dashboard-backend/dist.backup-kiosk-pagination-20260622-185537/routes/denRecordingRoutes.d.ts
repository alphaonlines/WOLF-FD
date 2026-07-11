import type { Express } from "express";
import type { Pool } from "pg";
type RegisterDenRecordingRoutesDeps = {
    app: Express;
    pool: Pool;
    recordingsDir: string;
};
export declare function registerDenRecordingRoutes({ app, pool, recordingsDir }: RegisterDenRecordingRoutesDeps): void;
export {};
