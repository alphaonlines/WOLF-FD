import type { Express } from "express";
import type { Pool } from "pg";
type RegisterTrackingRoutesDeps = {
    app: Express;
    pool: Pool;
};
export declare function registerTrackingRoutes({ app, pool }: RegisterTrackingRoutesDeps): void;
export {};
