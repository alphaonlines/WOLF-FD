import { spawn } from "child_process";
import type {
  ParsedManufacturerCatalogRow,
  ParsedManufacturerReferenceNote,
} from "./libertyPricebook";

type ExecFileAsyncLike = (
  file: string,
  args?: readonly string[] | null,
  options?: { timeout?: number }
) => Promise<{ stdout?: string | Buffer; stderr?: string | Buffer }>;

type StyleContext = {
  code: string;
  name: string;
  qualifier: string;
};

const ROW_WITH_PRICE_PATTERN =
  /^(.*?)(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+\$\s*([\d,]+\.\d{2})\s*$/;
const SKU_PATTERN = /(\d{3,5}-\d{2,3})/;

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\f/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
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

function extractPdfText(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("pdftotext", ["-layout", filePath, "-"]);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(cleanText(stderr) || `pdftotext exited with code ${code ?? "unknown"}`));
    });
  });
}

function shouldSkipLine(line: string) {
  const compact = cleanText(line);
  if (!compact) return true;
  if (
    /^(Effective|Updated)\b/i.test(compact) ||
    /^JACKSON FURNITURE\b/i.test(compact) ||
    /^Ship Point:/i.test(compact) ||
    /^STYLE\s+DESCRIPTION\s+SKU\b/i.test(compact) ||
    /^KIOSK$/i.test(compact) ||
    /^PRICE$/i.test(compact) ||
    /^\*If ordering a truckload/i.test(compact) ||
    /^Page \d+\b/i.test(compact)
  ) {
    return true;
  }
  return false;
}

function detectSection(line: string) {
  const compact = cleanText(line);
  if (/^STATIONARY LEATHER COLLECTIONS\b/i.test(compact)) {
    return "Stationary Leather Collections";
  }
  if (/^STATIONARY SOFAS and SECTIONALS\b/i.test(compact)) {
    return "Stationary Sofas and Sectionals";
  }
  if (/^MOTION\b/i.test(compact)) {
    return compact;
  }
  return "";
}

function detectSubtype(line: string) {
  const compact = cleanText(line);
  if (!compact) return "";
  if (/^(Modular Sectional|Sectional|Top Grain Leather Touch)$/i.test(compact)) {
    return compact;
  }
  return "";
}

function parseStyleLine(line: string): StyleContext | null {
  const compact = cleanText(line);
  if (!compact || compact.includes("$") || /Package Dimensions\/Measurements/i.test(compact)) return null;
  const match = compact.match(/^(\d{3,5})\s+(.+)$/);
  if (!match) return null;
  const code = cleanText(match[1]);
  const remainder = cleanText(match[2]);
  if (!remainder || SKU_PATTERN.test(remainder)) return null;
  const parts = remainder.split(/\s{2,}/).map(cleanText).filter(Boolean);
  const baseName = cleanText(parts[0] || remainder).replace(/\s*\(continued\)\s*/i, "");
  const qualifier = cleanText(parts.slice(1).join(" | "));
  if (!baseName) return null;
  return {
    code,
    name: baseName,
    qualifier,
  };
}

function detectProductType(text: string, subtype: string, section: string) {
  const value = `${text} ${subtype} ${section}`.toLowerCase();
  if (value.includes("comfort sack")) return "comfort sack";
  if (value.includes("footstool")) return "footstool";
  if (value.includes("accent cuddle chaise")) return "chaise";
  if (value.includes("console storage box")) return "console";
  if (value.includes("corner")) return "corner";
  if (value.includes("recliner")) return "recliner";
  if (value.includes("sleeper")) return "sleeper";
  if (value.includes("sectional")) return "sectional";
  if (value.includes("loveseat")) return "loveseat";
  if (value.includes("sofa")) return "sofa";
  if (value.includes("chair 1/2") || value.includes("chair 1 /2") || value.includes("chair 1/ 2")) {
    return "chair and a half";
  }
  if (value.includes("chair")) return "chair";
  if (value.includes("chaise")) return "chaise";
  if (value.includes("ottoman")) return "ottoman";
  return subtype ? subtype.toLowerCase() : section.toLowerCase();
}

function detectCategory(section: string, subtype: string, productType: string) {
  const value = `${section} ${subtype}`.toLowerCase();
  if (value.includes("leather")) return "Leather Upholstery";
  if (value.includes("motion")) return "Motion Upholstery";
  if (productType === "console") return "Sectional Accessories";
  return section || "Upholstery";
}

function detectMaterial(section: string, styleQualifier: string, description: string) {
  const value = `${section} ${styleQualifier} ${description}`.toLowerCase();
  if (value.includes("leather")) return "leather";
  return "fabric";
}

function detectFeatureTags(
  description: string,
  subtype: string,
  section: string,
  styleQualifier: string
) {
  void section;
  const value = `${description} ${subtype} ${styleQualifier}`.toLowerCase();
  const tags = new Set<string>();
  [
    "laf",
    "raf",
    "lsf",
    "rsf",
    "sectional",
    "modular",
    "swivel",
    "glider",
    "recliner",
    "rocker",
    "console",
    "storage",
    "bluetooth",
    "leather",
    "chair 1/2",
    "sleeper",
  ].forEach((tag) => {
    if (value.includes(tag)) tags.add(tag);
  });
  return [...tags];
}

function buildRow(input: {
  style: StyleContext;
  section: string;
  subtype: string;
  description: string;
  sku: string;
  fabricNumber: string;
  color: string;
  lengthInches: number | null;
  heightInches: number | null;
  depthInches: number | null;
  weightLbs: number | null;
  cubes: number | null;
  seats: number | null;
  basePrice: number | null;
  sourceSortOrder: number;
}): ParsedManufacturerCatalogRow {
  const productType = detectProductType(input.description, input.subtype, input.section);
  const category = detectCategory(input.section, input.subtype, productType);
  const featureTags = detectFeatureTags(
    input.description,
    input.subtype,
    input.section,
    input.style.qualifier
  );
  const sourceNoteParts = [
    input.section ? `Section ${input.section}` : "",
    input.subtype ? `Subtype ${input.subtype}` : "",
    input.style.qualifier ? `Qualifier ${input.style.qualifier}` : "",
    input.fabricNumber ? `Fabric ${input.fabricNumber}` : "",
    input.seats !== null ? `Seats ${input.seats}` : "",
  ].filter(Boolean);

  return {
    manufacturer: "Jackson/Catnapper",
    manufacturerSlug: "jackson-catnapper",
    collectionCode: input.style.code,
    collectionName: input.style.name,
    category,
    productType,
    sku: input.sku,
    description: input.description,
    colorFinish: input.color,
    colorFamily: "",
    material: detectMaterial(input.section, input.style.qualifier, input.description),
    shape: "",
    dimensionsText:
      input.lengthInches && input.depthInches && input.heightInches
        ? `L ${input.lengthInches}" · H ${input.heightInches}" · D ${input.depthInches}"`
        : "",
    widthInches: input.lengthInches,
    depthInches: input.depthInches,
    heightInches: input.heightInches,
    cubes: input.cubes,
    weightLbs: input.weightLbs,
    basePrice: input.basePrice,
    isSet: false,
    setPieceCount: null,
    isSwatch: false,
    isSample: false,
    isNewProduct: false,
    upholsteryCover: input.fabricNumber,
    hardwareOptions: [],
    cushionOptions: [],
    featureTags,
    searchKeywords: tokenize([
      input.style.code,
      input.style.name,
      input.description,
      input.section,
      input.subtype,
      input.style.qualifier,
      input.fabricNumber,
      input.color,
      category,
      productType,
    ]),
    sourceNote: sourceNoteParts.join(" | "),
    sourceSortOrder: input.sourceSortOrder,
  };
}

export async function parseJacksonCatnapperPricebookPdf(
  filePath: string,
  execFileAsync: ExecFileAsyncLike
): Promise<ParsedManufacturerCatalogRow[]> {
  void execFileAsync;
  const text = await extractPdfText(filePath);
  if (!text.trim()) {
    throw new Error("Jackson/Catnapper parser could not extract text from PDF.");
  }

  const rows: ParsedManufacturerCatalogRow[] = [];
  const seen = new Set<string>();
  const pages = text.split("\f");
  let sourceSortOrder = 0;
  let currentSection = "";
  let currentSubtype = "";
  let currentStyle: StyleContext = { code: "", name: "", qualifier: "" };
  let variantFabric = "";
  let variantColor = "";
  let pendingDescription = "";
  let awaitingContinuationIndex = -1;

  for (const page of pages) {
    const pageText = cleanText(page);
    if (!pageText) continue;
    if (/Package Dimensions\/Measurements/i.test(pageText)) {
      continue;
    }

    const pageLines = page.split("\n").map((line) => line.replace(/\s+$/g, ""));

    for (const rawLine of pageLines) {
      const compact = cleanText(rawLine);
      if (!compact) continue;
      if (shouldSkipLine(compact)) continue;

      const section = detectSection(compact);
      if (section) {
        currentSection = section.replace(/\s*\(continued\)\s*/i, "");
        currentSubtype = "";
        pendingDescription = "";
        awaitingContinuationIndex = -1;
        continue;
      }

      const style = parseStyleLine(compact);
      if (style) {
        currentStyle = style;
        variantFabric = "";
        variantColor = "";
        pendingDescription = "";
        awaitingContinuationIndex = -1;
        continue;
      }

      const subtype = detectSubtype(compact);
      if (subtype) {
        currentSubtype = subtype;
        pendingDescription = "";
        awaitingContinuationIndex = -1;
        continue;
      }

      if (/^(?:\d+(?:st|nd|rd|th)\s+)?Pillow Fabric\b/i.test(compact) || /Contrast Welt/i.test(compact)) {
        pendingDescription = "";
        awaitingContinuationIndex = -1;
        continue;
      }

      const rawNormalized = rawLine.replace(/\f/g, "").replace(/\s+$/g, "");
      const rowMatch = rawNormalized.match(ROW_WITH_PRICE_PATTERN);
      if (!rowMatch) {
        if (awaitingContinuationIndex >= 0 && !SKU_PATTERN.test(compact)) {
          const existing = rows[awaitingContinuationIndex];
          existing.description = cleanText(`${existing.description} ${compact}`);
          existing.searchKeywords = tokenize([
            existing.collectionCode,
            existing.collectionName,
            existing.description,
            existing.category,
            existing.productType,
            existing.upholsteryCover,
            existing.colorFinish,
          ]);
          awaitingContinuationIndex = -1;
          continue;
        }
        pendingDescription = compact;
        continue;
      }

      const left = rowMatch[1].replace(/\f/g, "").replace(/\s+$/g, "");
      const price = parseNumber(rowMatch[8]);
      const seats = parseNumber(rowMatch[7]);
      const cubes = parseNumber(rowMatch[6]);
      const weightLbs = parseNumber(rowMatch[5]);
      const depthInches = parseNumber(rowMatch[4]);
      const heightInches = parseNumber(rowMatch[3]);
      const lengthInches = parseNumber(rowMatch[2]);

      const skuMatch = left.match(SKU_PATTERN);
      if (!skuMatch || !currentStyle.code) {
        pendingDescription = cleanText(left) || pendingDescription;
        continue;
      }

      const sku = cleanText(skuMatch[1]);
      const beforeSkuRaw = left.slice(0, skuMatch.index ?? 0);
      const afterSkuRaw = left.slice((skuMatch.index ?? 0) + sku.length);
      const beforeSku = cleanText(beforeSkuRaw);
      const afterSku = cleanText(afterSkuRaw);

      let description = beforeSku;
      if (!description && pendingDescription) {
        description = pendingDescription;
      }

      const beforeTokens = beforeSkuRaw
        ? beforeSkuRaw.split(/\s{2,}/).map(cleanText).filter(Boolean)
        : [];
      if (beforeTokens.length >= 2) {
        currentSubtype = beforeTokens[0];
        description = beforeTokens.slice(1).join(" ");
      }

      const afterTokens = afterSkuRaw.split(/\s{2,}/).map(cleanText).filter(Boolean);
      let fabricNumber = "";
      let color = "";
      if (afterTokens.length >= 2) {
        fabricNumber = afterTokens[0];
        color = afterTokens.slice(1).join(" ");
      } else if (afterTokens.length === 1) {
        const fabricColorMatch = afterTokens[0].match(/^([0-9/-]+)(?:\s+(.+))?$/);
        fabricNumber = cleanText(fabricColorMatch?.[1] || afterTokens[0]);
        color = cleanText(fabricColorMatch?.[2] || "");
      }

      if (!description) description = "Item";
      if (!fabricNumber) fabricNumber = variantFabric;
      if (!color) color = variantColor;
      if (fabricNumber) variantFabric = fabricNumber;
      if (color) variantColor = color;

      const row = buildRow({
        style: currentStyle,
        section: currentSection,
        subtype: currentSubtype,
        description,
        sku,
        fabricNumber,
        color,
        lengthInches,
        heightInches,
        depthInches,
        weightLbs,
        cubes,
        seats,
        basePrice: price,
        sourceSortOrder,
      });

      const dedupeKey = [
        row.collectionCode,
        row.sku,
        row.description,
        row.upholsteryCover,
        row.colorFinish,
        row.basePrice ?? "",
      ].join("|");
      if (!seen.has(dedupeKey)) {
        rows.push(row);
        seen.add(dedupeKey);
        sourceSortOrder += 1;
        awaitingContinuationIndex = beforeSku ? -1 : rows.length - 1;
      } else {
        awaitingContinuationIndex = -1;
      }

      pendingDescription = "";
    }
  }

  if (!rows.length) {
    throw new Error("Jackson/Catnapper parser did not detect any price rows.");
  }

  return rows;
}

export function parseJacksonCatnapperReferenceNotes(): ParsedManufacturerReferenceNote[] {
  return [];
}
