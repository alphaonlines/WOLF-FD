import type { CompetitorPricingInputRow, CompetitorPricingJobStatus, CompetitorPricingResultRow, CompetitorPricingRunMode } from './types';
declare function jobDir(jobId: string): string;
declare function statusPath(jobId: string): string;
declare function resultsJsonPath(jobId: string): string;
declare function resultsCsvPath(jobId: string): string;
declare function inputRowsPath(jobId: string): string;
declare function selectRows(rows: CompetitorPricingInputRow[], mode: CompetitorPricingRunMode): CompetitorPricingInputRow[];
export declare function resultRowsToCsv(rows: CompetitorPricingResultRow[]): string;
export declare function createCompetitorPricingJob(args: {
    rows: CompetitorPricingInputRow[];
    mode: CompetitorPricingRunMode;
}): Promise<CompetitorPricingJobStatus>;
export declare function getCompetitorPricingJob(jobId: string): Promise<CompetitorPricingJobStatus>;
export declare function getCompetitorPricingResultPath(jobId: string, format: 'csv' | 'json'): Promise<string>;
export declare function getCompetitorPricingResults(jobId: string): Promise<CompetitorPricingResultRow[]>;
export declare function runCompetitorPricingJob(jobId: string): Promise<void>;
export declare const __testing: {
    selectRows: typeof selectRows;
    jobDir: typeof jobDir;
    inputRowsPath: typeof inputRowsPath;
    statusPath: typeof statusPath;
    resultsCsvPath: typeof resultsCsvPath;
    resultsJsonPath: typeof resultsJsonPath;
};
export {};
