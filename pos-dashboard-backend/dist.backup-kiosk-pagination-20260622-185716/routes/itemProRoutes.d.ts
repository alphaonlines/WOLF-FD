import type { Express } from "express";
import type { Pool } from "pg";
type RegisterItemProRoutesDeps = {
    app: Express;
    pool: Pool;
    itemDateField: string;
    prefixedDateField: (tableAlias: string) => string;
};
export declare function registerItemProRoutes({ app, pool, itemDateField, prefixedDateField, }: RegisterItemProRoutesDeps): void;
export {};
