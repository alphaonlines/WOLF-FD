import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type RawRow = Array<string | number | null | undefined>;
export declare function parseSimmonsRawDataRows(rows: RawRow[]): ParsedManufacturerCatalogRow[];
export declare function parseSimmonsWorkbook(filePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export {};
