import type { ParsedManufacturerCatalogRow, ParsedManufacturerReferenceNote } from "./libertyPricebook";
type ExecFileAsyncLike = (file: string, args?: readonly string[] | null, options?: {
    timeout?: number;
}) => Promise<{
    stdout?: string | Buffer;
    stderr?: string | Buffer;
}>;
export declare function parseEnglandPricebookPdf(filePath: string, execFileAsync: ExecFileAsyncLike): Promise<ParsedManufacturerCatalogRow[]>;
export declare function parseEnglandReferenceNotes(): Promise<ParsedManufacturerReferenceNote[]>;
export {};
