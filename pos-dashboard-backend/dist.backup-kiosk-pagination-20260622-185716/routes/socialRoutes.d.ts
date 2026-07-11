import type { Express } from "express";
import type { Pool } from "pg";
type RegisterSocialRoutesDeps = {
    app: Express;
    pool: Pool;
    socialUploadsDir: string;
    publicBaseUrl: string;
    runSocialDueJobsOnce: (maxJobs?: number) => Promise<number>;
};
export declare function registerPublicSocialRoutes({ app, pool, socialUploadsDir }: Pick<RegisterSocialRoutesDeps, "app" | "pool" | "socialUploadsDir">): void;
export declare function registerSocialRoutes({ app, pool, socialUploadsDir, publicBaseUrl, runSocialDueJobsOnce, }: RegisterSocialRoutesDeps): void;
export {};
