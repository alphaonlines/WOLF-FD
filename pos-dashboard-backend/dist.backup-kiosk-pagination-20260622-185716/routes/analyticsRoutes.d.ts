import type { Express } from "express";
import type { Pool } from "pg";
type RegisterAnalyticsRoutesDeps = {
    app: Express;
    pool: Pool;
    itemDateField: string;
    prefixedDateField: (tableAlias: string) => string;
};
export declare function registerAnalyticsRoutes({ app, pool, itemDateField, prefixedDateField, }: RegisterAnalyticsRoutesDeps): void;
export {};
