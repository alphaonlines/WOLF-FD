import type { Express } from "express";
import type { Pool } from "pg";
type RegisterWolfWorkRoutesDeps = {
    app: Express;
    pool: Pool;
};
export declare function registerWolfWorkRoutes({ app, pool }: RegisterWolfWorkRoutesDeps): void;
export {};
