import type { ParsedManufacturerCatalogRow, ParsedManufacturerReferenceNote } from "./libertyPricebook";
export declare function parseBestPricebookWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export declare function parseBestReferenceNotes(absolutePath: string): Promise<ParsedManufacturerReferenceNote[]>;
export declare function isBestResidentialWorkbook(filePath: string): boolean;
export declare function chooseBestPreferredHoldingUpload(filePaths: string[]): string;
