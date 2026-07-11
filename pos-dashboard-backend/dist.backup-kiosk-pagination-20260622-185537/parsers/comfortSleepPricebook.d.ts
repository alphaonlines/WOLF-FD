import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
export declare function parseComfortSleepPricebookText(text: string): ParsedManufacturerCatalogRow[];
export declare function parseComfortSleepPricebookPdf(filePath: string, execFileAsync: ExecFileAsyncLike): Promise<ParsedManufacturerCatalogRow[]>;
export {};
