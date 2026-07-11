import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
export declare function parseVaughanBassettPricebookText(text: string): ParsedManufacturerCatalogRow[];
export declare function parseVaughanBassettPricebookPdf(filePath: string, execFileAsync: ExecFileAsyncLike): Promise<ParsedManufacturerCatalogRow[]>;
export declare function parseVaughanBassettReferenceNotes(_buffer: Buffer): string[];
export {};
