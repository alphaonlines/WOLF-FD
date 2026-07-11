import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type RawRow = Array<string | number | null | undefined>;
export declare function parsePro1stMontageWorkbookRows(rows: RawRow[]): ParsedManufacturerCatalogRow[];
export declare function parsePro1stMontageWorkbook(filePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export {};
