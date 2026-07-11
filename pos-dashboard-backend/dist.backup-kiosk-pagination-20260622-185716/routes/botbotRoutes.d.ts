import type { Express } from "express";
import type { Pool } from "pg";
type BotBotRoutesDeps = {
    app: Express;
    pool: Pool;
    requireOwner: (req: any, res: any, next: any) => void;
};
export declare function registerBotBotRoutes({ app, pool, requireOwner, }: BotBotRoutesDeps): void;
export {};
