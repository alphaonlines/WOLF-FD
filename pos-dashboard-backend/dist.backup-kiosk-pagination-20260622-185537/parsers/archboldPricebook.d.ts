import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
export declare function parseArchboldPricebookWorkbook(buffer: Buffer | string): ParsedManufacturerCatalogRow[];
export declare function parseArchboldEssentialsPricebookText(text: string): ParsedManufacturerCatalogRow[];
export declare function parseArchboldPricebookPdf(filePath: string, execFileAsync: ExecFileAsyncLike): Promise<ParsedManufacturerCatalogRow[]>;
export declare function parseArchboldReferenceNotes(_buffer: Buffer): string[];
export {};
