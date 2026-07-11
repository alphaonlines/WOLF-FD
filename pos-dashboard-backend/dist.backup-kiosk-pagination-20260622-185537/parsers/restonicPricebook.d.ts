import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
type RawRow = Array<string | number | null | undefined>;
export declare function parseRestonicPricingRows(rows: RawRow[]): ParsedManufacturerCatalogRow[];
export declare function parseRestonicWorkbook(filePath: string): Promise<ParsedManufacturerCatalogRow[]>;
export {};
