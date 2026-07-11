import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type RawRow = Array<string | number | null | undefined>;
export declare function parseUltracomfortChairRows(rows: RawRow[], sheetName: string, sourceOffset?: number): ParsedManufacturerCatalogRow[];
export declare function parseUltracomfortAccessoryRows(rows: RawRow[], sheetName: string, sourceOffset?: number): ParsedManufacturerCatalogRow[];
export declare function parseUltracomfortWorkbookRows(sheetRows: Record<string, RawRow[]>): ParsedManufacturerCatalogRow[];
export declare function parseUltracomfortWorkbook(filePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export {};
