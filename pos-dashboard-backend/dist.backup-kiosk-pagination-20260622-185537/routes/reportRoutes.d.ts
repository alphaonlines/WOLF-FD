import type { Express } from "express";
import type { Pool } from "pg";
type RegisterReportRoutesDeps = {
    app: Express;
    pool: Pool;
    prefixedDateField: (tableAlias: string) => string;
};
export declare function registerReportRoutes({ app, pool, prefixedDateField }: RegisterReportRoutesDeps): void;
export {};
