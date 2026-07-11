import type { Express } from "express";
import type { Pool } from "pg";
type RegisterSalesDetailRoutesDeps = {
    app: Express;
    pool: Pool;
    itemDateField: string;
    prefixedDateField: (tableAlias: string) => string;
};
export declare function registerSalesDetailRoutes({ app, pool, itemDateField, prefixedDateField, }: RegisterSalesDetailRoutesDeps): void;
export {};
