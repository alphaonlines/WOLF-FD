import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type RawRow = Array<string | number | null | undefined>;
export declare function parseSertaSpiffRows(rows: RawRow[]): ParsedManufacturerCatalogRow[];
export declare function parseSertaSpiffWorkbook(filePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export {};
