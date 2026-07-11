import type { ParsedManufacturerCatalogRow } from "./libertyPricebook";
export declare function buildKnickerbockerPricebookRows(): ParsedManufacturerCatalogRow[];
export declare function parseKnickerbockerPricebookPdf(_filePath: string): Promise<ParsedManufacturerCatalogRow[]>;
