import type { CompetitorPricingResultRow } from './types';
type FetchLike = typeof fetch;
export type CompetitorPricingSheetWritebackRequest = {
    spreadsheetIdOrUrl: string;
    sheetName?: string;
    ahsCompHeader?: string;
    fflCompHeader?: string;
    dryRun?: boolean;
};
export type CompetitorPricingSheetWritebackSummary = {
    spreadsheetId: string;
    sheetName: string;
    sheetId: number;
    dryRun: boolean;
    updatedRows: number;
    updatedCells: number;
    skippedRows: Array<{
        sourceRow: number;
        sku: string;
        reason: string;
    }>;
    columns: {
        ahsCompColumn: string;
        fflCompColumn: string;
    };
};
type CellUpdate = {
    sourceRow: number;
    sku: string;
    columnIndex: number;
    price: string;
    note: string;
};
type RequestContext = {
    token?: string;
    fetchImpl?: FetchLike;
};
export declare function parseSpreadsheetId(input: string): string;
export declare function columnLetter(indexZeroBased: number): string;
declare function quoteSheetName(sheetName: string): string;
declare function findHeaderIndex(headers: string[], preferredHeader: string, aliases: RegExp[]): number;
declare function planCellUpdates(results: CompetitorPricingResultRow[], columns: {
    ahsIndex: number;
    fflIndex: number;
}): {
    updates: CellUpdate[];
    skippedRows: Array<{
        sourceRow: number;
        sku: string;
        reason: string;
    }>;
};
export declare function writeCompetitorPricingResultsToSheet(results: CompetitorPricingResultRow[], request: CompetitorPricingSheetWritebackRequest, context?: RequestContext): Promise<CompetitorPricingSheetWritebackSummary>;
export declare const __testing: {
    findHeaderIndex: typeof findHeaderIndex;
    planCellUpdates: typeof planCellUpdates;
    quoteSheetName: typeof quoteSheetName;
};
export {};
