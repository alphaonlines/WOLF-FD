import type { ParsedManufacturerCatalogRow, ParsedManufacturerReferenceNote } from "./libertyPricebook";
export declare function parseGuardsmanWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export declare function parseGbsProtectallWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export declare function parseInnovationsWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export declare function parseAccessoryReferenceNotes(): ParsedManufacturerReferenceNote[];
