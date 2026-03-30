import XLSX from "xlsx";
import type {
  ParsedManufacturerCatalogRow,
  ParsedManufacturerReferenceNote,
} from "./libertyPricebook";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cleanText(value).replace(/[$,]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function tokenize(values: Array<string | number | null | undefined>) {
  const tokens = new Set<string>();
  for (const value of values) {
    const normalized = cleanText(value).toLowerCase().replace(/[^a-z0-9" ]+/g, " ");
    if (!normalized) continue;
    tokens.add(normalized);
    normalized.split(/\s+/).forEach((part) => {
      if (part.length >= 2) tokens.add(part);
    });
  }
  return [...tokens];
}

function toTitleCase(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function detectInnovationCategory(description: string) {
  const value = description.toLowerCase();
  if (value.includes("bunk")) return "Bunk Beds";
  if (value.includes("day bed") || value.includes("daybed")) return "Daybeds";
  if (value.includes("ladder")) return "Ladders";
  if (value.includes("stair")) return "Stair Parts";
  if (value.includes("drawer")) return "Storage";
  if (value.includes("slat")) return "Slat Kits";
  if (value.includes("rail")) return "Rails";
  if (value.includes("mirror")) return "Mirrors";
  if (value.includes("frame")) return "Frames";
  return "Bedroom Components";
}

function buildCollectionNameFromDescription(description: string) {
  const token = cleanText(description).split(/\s+/)[0] || "";
  if (!token || token.startsWith("#")) return "";
  if (/^(full|extra|metal|ubc|staircase|full)$/i.test(token)) return "";
  return toTitleCase(token);
}

function readSheetRows(workbookPath: string, sheetIndex = 0) {
  const workbook = XLSX.readFile(workbookPath, { dense: true });
  const sheetName = workbook.SheetNames[sheetIndex];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" }) as string[][];
}

function buildBaseRow(overrides: Partial<ParsedManufacturerCatalogRow>): ParsedManufacturerCatalogRow {
  const row: ParsedManufacturerCatalogRow = {
    manufacturer: "",
    manufacturerSlug: "",
    collectionCode: "",
    collectionName: "",
    category: "",
    productType: "",
    sku: "",
    description: "",
    colorFinish: "",
    colorFamily: "",
    material: "",
    shape: "",
    dimensionsText: "",
    widthInches: null,
    depthInches: null,
    heightInches: null,
    cubes: null,
    weightLbs: null,
    basePrice: null,
    isSet: false,
    setPieceCount: null,
    isSwatch: false,
    isSample: false,
    isNewProduct: false,
    upholsteryCover: "",
    hardwareOptions: [],
    cushionOptions: [],
    featureTags: [],
    searchKeywords: [],
    imageUrls: [],
    sourceNote: "",
    sourceSortOrder: 0,
  };
  return { ...row, ...overrides };
}

export async function parseGuardsmanWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]> {
  const rows = readSheetRows(absolutePath);
  const parsedRows: ParsedManufacturerCatalogRow[] = [];
  let headerFound = false;
  let currentCategory = "Furniture Care";
  let sortOrder = 0;

  for (const rawRow of rows) {
    const row = rawRow.map((value) => cleanText(value));
    const [description, sku, , msrpText, unitPriceText] = row;
    if (!row.some(Boolean)) continue;

    if (description === "Product Description" && sku === "Product #") {
      headerFound = true;
      continue;
    }
    if (!headerFound) continue;

    if (description && !sku && row.slice(1).every((value) => !value) && description === description.toUpperCase()) {
      currentCategory = toTitleCase(description);
      continue;
    }

    const unitPrice = parseNumber(unitPriceText);
    if (!description || !sku || unitPrice === null) continue;
    const msrp = parseNumber(msrpText);
    const searchKeywords = tokenize([sku, description, currentCategory, "guardsman furniture care"]);
    parsedRows.push(
      buildBaseRow({
        manufacturer: "Guardsman",
        manufacturerSlug: "guardsman",
        collectionName: currentCategory,
        category: currentCategory,
        productType: "care product",
        sku,
        description,
        material: "furniture care",
        basePrice: unitPrice,
        featureTags: ["care product"],
        searchKeywords,
        sourceNote: msrp !== null ? `MSRP ${msrp}` : "",
        sourceSortOrder: ++sortOrder,
      })
    );
  }
  return parsedRows;
}

export async function parseGbsProtectallWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]> {
  const rows = readSheetRows(absolutePath);
  const parsedRows: ParsedManufacturerCatalogRow[] = [];
  let headerFound = false;
  let currentCategory = "Protection Products";
  let sortOrder = 0;

  for (const rawRow of rows) {
    const row = rawRow.map((value) => cleanText(value));
    const sku = row[2];
    const description = row[3];
    const unitPrice = parseNumber(row[5]);
    const msrp = parseNumber(row[7]);
    if (!row.some(Boolean)) continue;

    if (row[2] === "ITEM # (SKU)" && row[3] === "DESCRIPTION") {
      headerFound = true;
      continue;
    }
    if (!headerFound) continue;

    if (!sku && description && unitPrice === null && msrp === null) {
      currentCategory = toTitleCase(description);
      continue;
    }

    if (!sku || !description || unitPrice === null) continue;
    const searchKeywords = tokenize([sku, description, currentCategory, "protectall healthy sleep gbs"]);
    parsedRows.push(
      buildBaseRow({
        manufacturer: "GBS ProtectAll",
        manufacturerSlug: "gbs-protectall",
        collectionName: currentCategory,
        category: currentCategory,
        productType: "protection accessory",
        sku,
        description,
        material: "accessory",
        basePrice: unitPrice,
        featureTags: ["protection plan"],
        searchKeywords,
        sourceNote: msrp !== null ? `MSRP ${msrp}` : "",
        sourceSortOrder: ++sortOrder,
      })
    );
  }
  return parsedRows;
}

export async function parseInnovationsWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]> {
  const rows = readSheetRows(absolutePath);
  const parsedRows: ParsedManufacturerCatalogRow[] = [];
  let headerFound = false;
  let sortOrder = 0;

  for (const rawRow of rows) {
    const row = rawRow.map((value) => cleanText(value));
    const sku = row[0];
    const description = row[1];
    const price = parseNumber(row[2]);
    if (!row.some(Boolean)) continue;

    if ((/^item$/i.test(sku) || /^\d+$/.test(sku)) && /^description$/i.test(description) && /^price$/i.test(row[2])) {
      headerFound = true;
      continue;
    }
    if (!headerFound) continue;
    if (!sku || !description || price === null) continue;

    const collectionName = buildCollectionNameFromDescription(description);
    const category = detectInnovationCategory(description);
    const searchKeywords = tokenize([sku, description, collectionName, category, "innovations"]);
    parsedRows.push(
      buildBaseRow({
        manufacturer: "Innovations",
        manufacturerSlug: "innovations",
        collectionCode: collectionName,
        collectionName,
        category,
        productType: "bedroom component",
        sku,
        description,
        material: "wood",
        basePrice: price,
        featureTags: ["component"],
        searchKeywords,
        sourceSortOrder: ++sortOrder,
      })
    );
  }

  if (!parsedRows.length) {
    throw new Error(
      "Innovations preview expects a SKU list workbook such as 'INNOVATION SKU LIST.xlsx' or 'INNOVATIONS PRICING BY SKU.xlsx'."
    );
  }

  return parsedRows;
}

export function parseAccessoryReferenceNotes(): ParsedManufacturerReferenceNote[] {
  return [];
}
