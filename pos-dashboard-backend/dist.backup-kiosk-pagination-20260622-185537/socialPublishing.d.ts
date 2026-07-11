import type { Pool } from "pg";
type CreatePublisherDeps = {
    pool: Pool;
    publicBaseUrl: string;
};
export declare function createSocialPublisher({ pool, publicBaseUrl }: CreatePublisherDeps): {
    runJob: (jobId: number) => Promise<void>;
    runDueJobsOnce: (maxJobs?: number) => Promise<number>;
};
export {};
