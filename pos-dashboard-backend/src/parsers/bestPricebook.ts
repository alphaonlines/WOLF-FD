import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import type {
  ParsedManufacturerCatalogRow,
  ParsedManufacturerReferenceNote,
} from "./libertyPricebook";

const SHEET_CATEGORY_MAP: Record<string, string> = {
  Chairs: "Accent Upholstery",
  Dining: "Dining",
  Barstools: "Dining",
  Ottomans: "Ottomans",
  Recliners: "Recliners",
  "Lift Recliners": "Lift Recliners",
  Motion: "Motion Upholstery",
  Stationary: "Stationary Upholstery",
};

const PRODUCT_SHEETS = Object.keys(SHEET_CATEGORY_MAP);
const SKIPPED_PRODUCT_CODES = new Set(["HOW TO ORDER:", "NOTE:", "MATCHING PRODUCTS"]);
const COVER_FABRIC_HEADERS = new Set(["A", "B", "C", "D", "E", "F", "G"]);
type ModelCollectionMeta = {
  collectionName: string;
  collectionCode: string;
};
type DimensionColumns = {
  labelIndex: number;
  heightIndex: number;
  widthIndex: number;
  depthIndex: number;
};

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

function detectColorFamily(text: string) {
  const value = text.toLowerCase();
  const families = ["black", "brown", "cream", "gray", "green", "navy", "tan", "white"];
  return families.find((family) => value.includes(family)) || "";
}

function detectProductType(text: string, category: string) {
  const value = `${text} ${category}`.toLowerCase();
  if (value.includes("lift recliner")) return "lift recliner";
  if (value.includes("recliner")) return "recliner";
  if (value.includes("loveseat")) return "loveseat";
  if (value.includes("sofa")) return "sofa";
  if (value.includes("sectional")) return "sectional";
  if (value.includes("chair & a half")) return "chair and a half";
  if (value.includes("chair")) return "chair";
  if (value.includes("ottoman")) return "ottoman";
  if (value.includes("barstool")) return "barstool";
  if (value.includes("dining chair")) return "dining chair";
  if (value.includes("pillow")) return "pillow";
  if (value.includes("bench")) return "bench";
  return category.toLowerCase();
}

function detectFeatureTags(text: string, headers: string[]) {
  const value = `${text} ${headers.join(" ")}`.toLowerCase();
  const tags = new Set<string>();
  [
    "power",
    "recliner",
    "lift",
    "sleeper",
    "memory foam",
    "console",
    "swivel",
    "glider",
    "diamond pricing",
    "leather",
    "ottoman",
    "barstool",
    "dining",
  ].forEach((tag) => {
    if (value.includes(tag)) tags.add(tag);
  });
  return [...tags];
}

function formatCollectionName(value: string) {
  const normalized = cleanText(value).replace(/\s+COLLECTION$/i, "");
  if (!normalized) return "";
  return normalized
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function scoreUploadName(fileName: string) {
  const value = fileName.toLowerCase();
  let score = 0;
  if (value.endsWith(".xlsx") || value.endsWith(".xls")) score += 200;
  if (value.includes("residential price list")) score += 500;
  if (value.includes("compressed")) score += 25;
  if (value.includes("grade change")) score -= 100;
  if (value.includes("diamond")) score -= 90;
  if (value.includes("fabric")) score -= 80;
  if (value.includes("warranty")) score -= 70;
  if (value.includes("cheat")) score -= 60;
  return score;
}

function choosePreferredPricebookFile(filePaths: string[]) {
  return [...filePaths].sort((left, right) => scoreUploadName(right) - scoreUploadName(left))[0] || "";
}

function readSheetRows(workbookPath: string, sheetName: string) {
  const workbook = XLSX.readFile(workbookPath, { dense: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" }) as string[][];
}

function buildHeaderLabels(previousRows: string[][], headerRow: string[]) {
  const labels = new Map<number, string>();
  const previousRowText = previousRows
    .map((row) => row.map((value) => cleanText(value)).filter(Boolean).join(" "))
    .filter(Boolean)
    .reverse();
  const globalDescriptor =
    previousRowText.find((value) => /special cording/i.test(value)) ||
    previousRowText.find((value) => /signature series leather|leather/i.test(value)) ||
    previousRowText.find((value) => /diamond pricing/i.test(value)) ||
    previousRowText.find((value) => /natural instincts/i.test(value)) ||
    previousRowText.find((value) => /\bfabric\b/i.test(value)) ||
    "";

  for (let columnIndex = 0; columnIndex < headerRow.length; columnIndex += 1) {
    const rawValue = cleanText(headerRow[columnIndex]);
    if (!rawValue) continue;
    if (COVER_FABRIC_HEADERS.has(rawValue)) {
      labels.set(columnIndex, `Fabric ${rawValue}`);
      continue;
    }

    let descriptor = "";
    for (let offset = previousRows.length - 1; offset >= 0 && !descriptor; offset -= 1) {
      const row = previousRows[offset];
      if (!row) continue;
      descriptor = cleanText(row[columnIndex]);
      if (!descriptor) {
        for (let lookback = columnIndex - 1; lookback >= Math.max(0, columnIndex - 3); lookback -= 1) {
          descriptor = cleanText(row[lookback]);
          if (descriptor) break;
        }
      }
    }

    if (/diamond pricing/i.test(descriptor) || /diamond pricing/i.test(globalDescriptor)) {
      labels.set(columnIndex, `Diamond Pricing ${rawValue}`);
      continue;
    }
    if (/leather/i.test(descriptor) || /leather/i.test(globalDescriptor)) {
      labels.set(columnIndex, `Leather ${rawValue}`);
      continue;
    }
    if (/special cording/i.test(descriptor) || /special cording/i.test(globalDescriptor)) {
      labels.set(columnIndex, `Special Cording ${rawValue}`);
      continue;
    }
    if (/natural instincts/i.test(descriptor) || /natural instincts/i.test(globalDescriptor)) {
      labels.set(columnIndex, `Natural Instincts ${rawValue}`);
      continue;
    }
    labels.set(columnIndex, descriptor ? `${descriptor} ${rawValue}` : rawValue);
  }
  return labels;
}

function chooseBasePrice(pricing: Array<{ label: string; price: number }>) {
  const preferred =
    pricing.find((entry) => entry.label === "Fabric A") ||
    pricing.find((entry) => entry.label.startsWith("Fabric ")) ||
    pricing.find((entry) => entry.label.startsWith("Special Cording ")) ||
    pricing.find((entry) => entry.label.startsWith("Leather ")) ||
    pricing.find((entry) => entry.label.startsWith("Diamond Pricing ")) ||
    pricing[0];
  return preferred || null;
}

function isLikelyCollectionName(value: string, nonEmptyValuesLength: number) {
  const normalized = cleanText(value);
  if (!normalized) return false;
  if (nonEmptyValuesLength > 4) return false;
  if (/collection|how to order|matching products|note:/i.test(normalized)) return false;
  if (/^(fabric|diamond pricing|special cording|signature series leather)/i.test(normalized.toLowerCase())) {
    return false;
  }
  if (/^[A-Z0-9][A-Z0-9/ _-]*$/.test(normalized) && /[0-9/_-]/.test(normalized) && normalized === normalized.toUpperCase()) {
    return false;
  }
  return /[a-z]/i.test(normalized);
}

function detectDimensionColumns(row: string[]): DimensionColumns | null {
  const heightIndex = row.findIndex((value) => /^height$/i.test(value));
  const widthIndex = row.findIndex((value) => /^width$/i.test(value));
  const depthIndex = row.findIndex((value) => /^depth$/i.test(value));
  if (heightIndex < 0 || widthIndex < 0 || depthIndex < 0) return null;
  return {
    labelIndex: Math.max(0, Math.min(heightIndex, widthIndex, depthIndex) - 1),
    heightIndex,
    widthIndex,
    depthIndex,
  };
}

function parseFractionalInches(value: string) {
  const normalized = cleanText(value).replace(/"/g, "");
  if (!normalized) return null;
  const mixedFraction = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const numerator = Number(mixedFraction[2]);
    const denominator = Number(mixedFraction[3]);
    if (denominator) return whole + numerator / denominator;
  }
  const simpleFraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (simpleFraction) {
    const numerator = Number(simpleFraction[1]);
    const denominator = Number(simpleFraction[2]);
    if (denominator) return numerator / denominator;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDimensionLabel(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchesDimensionLabel(row: ParsedManufacturerCatalogRow, label: string) {
  const normalizedLabel = normalizeDimensionLabel(label);
  if (!normalizedLabel || normalizedLabel === "seat") return false;
  const description = normalizeDimensionLabel(row.description);
  const productType = normalizeDimensionLabel(row.productType);

  if (normalizedLabel.includes("storage ottoman")) return description.includes("storage ottoman");
  if (normalizedLabel.includes("club chair")) return description.includes("club chair");
  if (normalizedLabel.includes("chair and a half")) {
    return description.includes("chair and a half") || description.includes("chair & a half");
  }
  if (normalizedLabel.includes("loveseat")) return description.includes("loveseat") || productType.includes("loveseat");
  if (normalizedLabel.includes("sofa")) return description.includes("sofa") || productType === "sofa";
  if (normalizedLabel.includes("recliner")) return productType.includes("recliner") || description.includes("recliner");
  if (normalizedLabel.includes("ottoman")) return description.includes("ottoman") || productType === "ottoman";
  if (normalizedLabel.includes("barstool")) return description.includes("barstool") || productType === "barstool";
  if (normalizedLabel.includes("bench")) return description.includes("bench") || productType === "bench";
  if (normalizedLabel.includes("chair")) return description.includes("chair") || productType.includes("chair");
  return description.includes(normalizedLabel) || productType.includes(normalizedLabel);
}

function applyDimensionsRow(
  row: string[],
  columns: DimensionColumns,
  currentSectionRows: ParsedManufacturerCatalogRow[]
) {
  const label = cleanText(row[columns.labelIndex]);
  const heightText = cleanText(row[columns.heightIndex]);
  const widthText = cleanText(row[columns.widthIndex]);
  const depthText = cleanText(row[columns.depthIndex]);
  const hasMeasurements = Boolean(heightText || widthText || depthText);
  if (!label || !hasMeasurements) return false;
  if (/measurements are approximate|may vary by base option/i.test(`${label} ${heightText} ${widthText} ${depthText}`)) {
    return true;
  }

  const target = [...currentSectionRows].reverse().find((entry) => matchesDimensionLabel(entry, label));
  if (!target) return false;

  const parts: string[] = [];
  if (heightText) parts.push(`H ${heightText}`);
  if (widthText) parts.push(`W ${widthText}`);
  if (depthText) parts.push(`D ${depthText}`);
  target.dimensionsText = parts.join(" x ");
  target.heightInches = parseFractionalInches(heightText);
  target.widthInches = parseFractionalInches(widthText);
  target.depthInches = parseFractionalInches(depthText);
  return true;
}

function buildSourceNote(params: {
  collectionName: string;
  category: string;
  pricing: Array<{ label: string; price: number }>;
  notes: string[];
  matchingProducts: string[];
}) {
  const parts: string[] = [];
  if (params.collectionName) parts.push(`Collection ${params.collectionName}`);
  if (params.category) parts.push(params.category);
  if (params.pricing.length) {
    parts.push(
      `Pricing: ${params.pricing
        .slice(0, 8)
        .map((entry) => `${entry.label} ${entry.price}`)
        .join(", ")}`
    );
  }
  if (params.matchingProducts.length) {
    parts.push(`Matching: ${params.matchingProducts.join(", ")}`);
  }
  if (params.notes.length) {
    parts.push(params.notes.join(" | "));
  }
  return parts.filter(Boolean).join(" | ");
}

function parseProductSheet(
  sheetName: string,
  workbookPath: string,
  sortOrderStart: number,
  modelCollectionMap: Map<string, ModelCollectionMeta>
) {
  const rows = readSheetRows(workbookPath, sheetName);
  const parsedRows: ParsedManufacturerCatalogRow[] = [];
  const category = SHEET_CATEGORY_MAP[sheetName] || "Upholstery";
  let currentCollectionName = "";
  let currentCollectionCode = "";
  let recentHeaderRows: string[][] = [];
  let currentHeaderLabels = new Map<number, string>();
  let pendingNotes: string[] = [];
  let matchingProducts: string[] = [];
  let currentSectionRows: ParsedManufacturerCatalogRow[] = [];
  let currentDimensionColumns: DimensionColumns | null = null;
  let sortOrder = sortOrderStart;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index].map((value) => cleanText(value));
    if (!row.some(Boolean)) continue;

    const first = row[0];
    const second = row[1];
    const nonEmptyValues = row.filter(Boolean);

    if (second === "Collection") continue;
    if (second === "Collection" || first === "Collection") continue;

    const hasPriceNumbers = row.some((value) => parseNumber(value) !== null);
    const hasFabricHeader = row.some((value) => COVER_FABRIC_HEADERS.has(value));
    const looksLikeHeaderRow =
      hasFabricHeader ||
      row.some((value) => /^\d{4,}[A-Z]*$/.test(value)) ||
      row.some((value) => /diamond pricing|leather|special cording|fabric/i.test(value));

    if (first && isLikelyCollectionName(first, nonEmptyValues.length)) {
      currentCollectionName = first;
      continue;
    }

    if (
      !hasPriceNumbers &&
      first &&
      !second &&
      /[0-9/_-]/.test(first) &&
      /^[A-Z0-9][A-Z0-9/ _-]*$/.test(first) &&
      first !== "Warranty"
    ) {
      currentCollectionCode = first.replace(/\s+/g, " ").trim();
      currentSectionRows = [];
      currentDimensionColumns = null;
      continue;
    }

    if (!hasPriceNumbers && second === "" && isLikelyCollectionName(first, nonEmptyValues.length)) {
      currentCollectionName = first;
      continue;
    }

    const detectedDimensionColumns = detectDimensionColumns(row);
    if (detectedDimensionColumns) {
      currentDimensionColumns = detectedDimensionColumns;
      if (!hasPriceNumbers) continue;
    }

    if (looksLikeHeaderRow) {
      currentDimensionColumns = null;
      if (hasPriceNumbers || hasFabricHeader) {
        currentHeaderLabels = buildHeaderLabels(recentHeaderRows.slice(-3), row);
      }
      recentHeaderRows.push(row);
      recentHeaderRows = recentHeaderRows.slice(-3);
      continue;
    }

    if (/^HOW TO ORDER:/i.test(first)) {
      pendingNotes = [];
      matchingProducts = [];
      continue;
    }

    if (/^NOTE:/i.test(first) || /^NOTE:/i.test(second)) {
      pendingNotes.push([first, second, ...row.slice(2)].filter(Boolean).join(" "));
      continue;
    }

    if (/matching products/i.test(first) || /matching product/i.test(first) || /matching products/i.test(second)) {
      continue;
    }

    if (/^set of/i.test(first) || /\*you must/i.test(first.toLowerCase()) || /body & the 2nd cover/i.test(first.toLowerCase())) {
      pendingNotes.push(first);
      continue;
    }

    if (
      currentDimensionColumns &&
      applyDimensionsRow(row, currentDimensionColumns, currentSectionRows) &&
      !hasPriceNumbers
    ) {
      continue;
    }

    if (/^[A-Z0-9]/.test(first) && !SKIPPED_PRODUCT_CODES.has(first.toUpperCase()) && hasPriceNumbers) {
      const pricing = Array.from(currentHeaderLabels.entries())
        .map(([columnIndex, label]) => ({ label, price: parseNumber(row[columnIndex]) }))
        .filter((entry): entry is { label: string; price: number } => Boolean(entry.label) && entry.price !== null);
      if (!pricing.length) continue;

      const chosenPrice = chooseBasePrice(pricing);
      if (!chosenPrice) continue;

      const description = second || category.replace(" Upholstery", "");
      const collectionMeta = resolveCollectionMeta({
        sku: first,
        collectionCode: currentCollectionCode,
        currentCollectionName,
        modelCollectionMap,
      });
      const collectionName = collectionMeta.collectionName;
      const normalizedCoverLabel = normalizeCoverLabel(chosenPrice.label);
      const featureTags = detectFeatureTags(`${description} ${category}`, pricing.map((entry) => entry.label));
      const searchKeywords = tokenize([
        first,
        collectionMeta.collectionCode,
        collectionName,
        category,
        description,
        normalizedCoverLabel,
        ...pricing.map((entry) => entry.label),
        ...featureTags,
      ]);

      const parsedRow: ParsedManufacturerCatalogRow = {
        manufacturer: "Best",
        manufacturerSlug: "best",
        collectionCode: collectionMeta.collectionCode,
        collectionName,
        category,
        productType: detectProductType(description, category),
        sku: first,
        description,
        colorFinish: normalizedCoverLabel,
        colorFamily: detectColorFamily(normalizedCoverLabel),
        material: "upholstery",
        shape: "",
        dimensionsText: "",
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: chosenPrice.price,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: normalizedCoverLabel,
        hardwareOptions: [],
        cushionOptions: featureTags.filter((tag) => tag.includes("memory foam")),
        featureTags,
        searchKeywords,
        sourceNote: buildSourceNote({
          collectionName,
          category,
          pricing,
          notes: pendingNotes,
          matchingProducts,
        }),
        sourceSortOrder: ++sortOrder,
      };
      parsedRows.push(parsedRow);
      currentSectionRows.push(parsedRow);
      continue;
    }

    if (row.some((value) => /matching product/i.test(value))) {
      const related = row.filter((value) => value && !/matching product/i.test(value.toLowerCase()));
      if (related.length) matchingProducts.push(...related);
    }
  }

  return parsedRows;
}

function parseGradeChangeSheet(workbookPath: string) {
  const rows = readSheetRows(workbookPath, "Sheet1");
  const mappings: string[] = [];
  for (const row of rows) {
    const series = cleanText(row[0]);
    const oldGrade = cleanText(row[1]);
    const newGrade = cleanText(row[2]);
    if (!series || series === "SERIES") continue;
    if (!oldGrade || oldGrade === "GRADE" || !newGrade || newGrade === "GRADE") continue;
    mappings.push(`${series}: ${oldGrade} -> ${newGrade}`);
  }
  return mappings;
}

function buildBundleReferenceNote(bundleDir: string) {
  const entries = fs
    .readdirSync(bundleDir)
    .filter((entry) => !entry.startsWith("."))
    .sort((left, right) => left.localeCompare(right));
  return entries.map((entry) => `- ${entry}`).join("\n");
}

function buildModelCollectionMap(workbookPath: string) {
  const rows = readSheetRows(workbookPath, "Model Names");
  const modelMap = new Map<string, ModelCollectionMeta>();
  for (const row of rows) {
    const pairs: Array<[string, string]> = [
      [cleanText(row[0]), cleanText(row[1])],
      [cleanText(row[3]), cleanText(row[4])],
    ];
    for (const [rawName, rawModels] of pairs) {
      if (!rawName || !rawModels || rawName === "NAME" || rawModels === "MODEL") continue;
      const collectionName = formatCollectionName(rawName);
      const collectionCode = rawModels.replace(/\s+/g, " ").trim();
      const tokens = rawModels
        .split(/[\/,&\s]+/)
        .map((value) => cleanText(value))
        .filter((value) => /[A-Z]/i.test(value) && /[0-9]/.test(value));
      for (const token of tokens) {
        modelMap.set(token.toUpperCase(), { collectionName, collectionCode });
        const family = token.match(/^[A-Z]+[0-9]{2,4}/i)?.[0];
        if (family) modelMap.set(family.toUpperCase(), { collectionName, collectionCode });
      }
    }
  }
  return modelMap;
}

function resolveCollectionMeta(params: {
  sku: string;
  collectionCode: string;
  currentCollectionName: string;
  modelCollectionMap: Map<string, ModelCollectionMeta>;
}) {
  const skuUpper = params.sku.toUpperCase();
  const collectionCodeUpper = params.collectionCode.toUpperCase();
  const skuFamily = skuUpper.match(/^[A-Z]+[0-9]{2,4}/i)?.[0] || "";
  const collectionFamily = collectionCodeUpper.match(/^[A-Z]+[0-9]{2,4}/i)?.[0] || "";
  const fallbackCollectionCode = cleanText(params.collectionCode) || skuUpper.match(/^[A-Z]*\d{3,4}/i)?.[0] || "";
  const found =
    params.modelCollectionMap.get(skuUpper) ||
    params.modelCollectionMap.get(skuFamily) ||
    params.modelCollectionMap.get(collectionCodeUpper) ||
    params.modelCollectionMap.get(collectionFamily) ||
    null;
  return (
    found || {
      collectionName: formatCollectionName(params.currentCollectionName) || params.collectionCode,
      collectionCode: fallbackCollectionCode,
    }
  );
}

function normalizeCoverLabel(label: string) {
  const value = cleanText(label);
  if (!value) return "";
  if (/^special cording(?:\s+\([^)]+\))?\s+\d+[a-z0-9]*$/i.test(value)) return "Special Cording";
  if (/^leather(?:\s+\([^)]+\))?\s+\d+[a-z0-9]*$/i.test(value)) return "Leather";
  if (/^diamond pricing(?:\s+\([^)]+\))?\s+\d+[a-z0-9]*$/i.test(value)) return "Diamond Pricing";
  if (/^natural instincts(?:\s+\([^)]+\))?\s+\d+[a-z0-9]*$/i.test(value)) return "Natural Instincts";
  if (/^[a-g]\s+\d+[a-z0-9]*$/i.test(value)) return `Fabric ${value.slice(0, 1).toUpperCase()}`;
  if (/^fabric\s+[a-g]$/i.test(value)) {
    return `Fabric ${value.slice(-1).toUpperCase()}`;
  }
  if (/^special cording\s+\d+[a-z]*$/i.test(value)) return "Special Cording";
  if (/^leather\s+\d+[a-z]*$/i.test(value)) return "Leather";
  if (/^diamond pricing\s+\d+[a-z]*$/i.test(value)) return "Diamond Pricing";
  if (/^natural instincts\s+\d+[a-z]*$/i.test(value)) return "Natural Instincts";
  if (/^\d+\s+\d+$/.test(value)) return "Leather Matrix";
  return value;
}

export async function parseBestPricebookWorkbook(absolutePath: string): Promise<ParsedManufacturerCatalogRow[]> {
  const allRows: ParsedManufacturerCatalogRow[] = [];
  const modelCollectionMap = buildModelCollectionMap(absolutePath);
  let sortOrder = 0;
  for (const sheetName of PRODUCT_SHEETS) {
    const rows = parseProductSheet(sheetName, absolutePath, sortOrder, modelCollectionMap);
    allRows.push(...rows);
    sortOrder = allRows.length;
  }
  return allRows;
}

export async function parseBestReferenceNotes(absolutePath: string): Promise<ParsedManufacturerReferenceNote[]> {
  const notes: ParsedManufacturerReferenceNote[] = [];
  const bundleDir = path.dirname(absolutePath);
  const workbook = XLSX.readFile(absolutePath, { dense: true });
  const warrantyRows = XLSX.utils.sheet_to_json(workbook.Sheets["Warranty"], {
    header: 1,
    blankrows: false,
    defval: "",
  }) as string[][];
  const warrantyText = warrantyRows
    .map((row) => row.map((value) => cleanText(value)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n");
  if (warrantyText) {
    notes.push({
      manufacturer: "Best",
      manufacturerSlug: "best",
      noteType: "warranty",
      title: "Warranty",
      content: warrantyText,
      sourceSortOrder: 10,
    });
  }

  const gradeChangePath = fs
    .readdirSync(bundleDir)
    .find((entry) => /grade change cheat sheet\.xls$/i.test(entry));
  if (gradeChangePath) {
    const mappings = parseGradeChangeSheet(path.join(bundleDir, gradeChangePath));
    if (mappings.length) {
      notes.push({
        manufacturer: "Best",
        manufacturerSlug: "best",
        noteType: "reference",
        title: "Grade Change Cheat Sheet",
        content: mappings.slice(0, 80).join("\n"),
        sourceSortOrder: 20,
      });
    }
  }

  notes.push({
    manufacturer: "Best",
    manufacturerSlug: "best",
    noteType: "reference",
    title: "Archive Bundle Contents",
    content: buildBundleReferenceNote(bundleDir),
    sourceSortOrder: 30,
  });

  const supportDocs = fs
    .readdirSync(bundleDir)
    .filter((entry) => /diamond pricing|fabrics/i.test(entry))
    .sort((left, right) => left.localeCompare(right));
  if (supportDocs.length) {
    notes.push({
      manufacturer: "Best",
      manufacturerSlug: "best",
      noteType: "reference",
      title: "Supporting Upholstery Documents",
      content: supportDocs.map((entry) => `- ${entry}`).join("\n"),
      sourceSortOrder: 40,
    });
  }

  return notes;
}

export function isBestResidentialWorkbook(filePath: string) {
  const lower = filePath.toLowerCase();
  return (
    (lower.endsWith(".xls") || lower.endsWith(".xlsx")) &&
    lower.includes("best") &&
    lower.includes("residential price list")
  );
}

export function chooseBestPreferredHoldingUpload(filePaths: string[]) {
  return choosePreferredPricebookFile(filePaths);
}
