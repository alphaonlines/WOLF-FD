import type { Express } from "express";
import type { Pool } from "pg";
export declare function registerBoardRoutes(app: Express, pool: Pool, boardUploadsDir: string, publicBaseUrl: string): void;
