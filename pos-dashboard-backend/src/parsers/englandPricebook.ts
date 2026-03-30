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

type CollectionContext = {
  code: string;
  name: string;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\f/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string | undefined | null) {
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

function detectSection(pageLines: string[]) {
  const topText = pageLines.slice(0, 12).join(" ");
  if (/\bADDITIONAL ITEMS\b/i.test(topText)) return "Additional Items";
  if (/\bLEATHER\b/i.test(topText)) return "Leather";
  if (/\bSTATIONARY\b/i.test(topText)) return "Stationary";
  return "";
}

function parseCollection(pageLines: string[]): CollectionContext {
  for (const rawLine of pageLines) {
    const line = cleanText(rawLine);
    const match = line.match(/^([A-Z0-9/]+)\s+Series\s+-\s+(.+)$/i);
    if (!match) continue;
    return {
      code: cleanText(match[1]),
      name: cleanText(match[2]),
    };
  }
  return { code: "", name: "" };
}

function detectProductType(text: string, section: string) {
  const value = `${text} ${section}`.toLowerCase();
  if (value.includes("recliner")) return "recliner";
  if (value.includes("sleeper")) return "sleeper";
  if (value.includes("sectional")) return "sectional";
  if (value.includes("loveseat")) return "loveseat";
  if (value.includes("sofa")) return "sofa";
  if (value.includes("chair & 1/2") || value.includes("chair & 1/ 2") || value.includes("chair and 1/2")) {
    return "chair and a half";
  }
  if (value.includes("chair")) return "chair";
  if (value.includes("ottoman") || value.includes("otto")) return "ottoman";
  if (value.includes("pillow")) return "pillow";
  if (value.includes("fabric yardage") || value.includes("price per yard")) return "fabric";
  if (value.includes("hide")) return "leather hide";
  if (value.includes("mechanism")) return "mechanism";
  if (value.includes("console")) return "console";
  return section ? section.toLowerCase() : "";
}

function detectCategory(section: string, productType: string) {
  if (section === "Leather") return "Leather Upholstery";
  if (section === "Stationary") return "Stationary Upholstery";
  if (productType === "mechanism") return "Mechanisms";
  if (productType === "fabric" || productType === "leather hide" || productType === "pillow") {
    return "Additional Items";
  }
  return section || "Upholstery";
}

function detectMaterial(section: string, text: string) {
  const value = text.toLowerCase();
  if (section === "Leather" || value.includes("leather")) return "leather";
  if (value.includes("fabric") || value.includes("pillow")) return "fabric";
  return "upholstery";
}

function detectFeatureTags(text: string, section: string) {
  const value = `${text} ${section}`.toLowerCase();
  const tags = new Set<string>();
  [
    "laf",
    "raf",
    "sleeper",
    "swivel",
    "rocking",
    "recliner",
    "console",
    "power",
    "leather",
    "stationary",
    "ottoman",
    "pillow",
  ].forEach((tag) => {
    if (value.includes(tag)) tags.add(tag);
  });
  return [...tags];
}

function parseRow(
  line: string,
  section: string,
  collection: CollectionContext,
  typeLine: string,
  sourceSortOrder: number
): ParsedManufacturerCatalogRow | null {
  const normalized = line.replace(/\f/g, "").replace(/\s+$/g, "");
  const match = normalized.match(/^\s*([A-Z0-9][A-Z0-9/-]*)\s+(.+?)\s{2,}(.+)$/);
  if (!match) return null;

  const sku = cleanText(match[1]);
  const description = cleanText(match[2]);
  const tail = cleanText(match[3]);

  if (!sku || !description || !/\d/.test(tail)) return null;
  if (/^(features|backs|seats|legs|style)$/i.test(sku)) return null;

  const firstPriceMatch = tail.match(/\d+(?:\.\d+)?/);
  const basePrice = parseNumber(firstPriceMatch?.[0] || null);
  if (basePrice === null) return null;

  const numericTokens = Array.from(tail.matchAll(/\d+(?:\.\d+)?/g), (entry) => Number(entry[0])).filter((value) =>
    Number.isFinite(value)
  );
  const widthInches = numericTokens.length >= 3 ? numericTokens[numericTokens.length - 3] : null;
  const depthInches = numericTokens.length >= 2 ? numericTokens[numericTokens.length - 2] : null;
  const heightInches = numericTokens.length >= 1 ? numericTokens[numericTokens.length - 1] : null;
  const cubes = numericTokens.length >= 4 ? numericTokens[numericTokens.length - 4] : null;
  const weightLbs = numericTokens.length >= 5 ? numericTokens[numericTokens.length - 5] : null;

  const productType = detectProductType(description, section);
  const category = detectCategory(section, productType);
  const featureTags = detectFeatureTags(description, section);
  const sourceNoteParts = [
    section ? `Section ${section}` : "",
    collection.code ? `Series ${collection.code}` : "",
    collection.name ? `Collection ${collection.name}` : "",
    typeLine ? cleanText(typeLine) : "",
  ].filter(Boolean);

  return {
    manufacturer: "England",
    manufacturerSlug: "england",
    collectionCode: collection.code,
    collectionName: collection.name,
    category,
    productType,
    sku,
    description,
    colorFinish: "",
    colorFamily: "",
    material: detectMaterial(section, description),
    shape: "",
    dimensionsText:
      widthInches && depthInches && heightInches ? `W ${widthInches}" · D ${depthInches}" · H ${heightInches}"` : "",
    widthInches,
    depthInches,
    heightInches,
    cubes,
    weightLbs,
    basePrice,
    isSet: false,
    setPieceCount: null,
    isSwatch: false,
    isSample: false,
    isNewProduct: false,
    upholsteryCover: section === "Leather" ? "Leather" : "",
    hardwareOptions: [],
    cushionOptions: [],
    featureTags,
    searchKeywords: tokenize([collection.code, collection.name, description, category, productType, section]),
    imageUrls: [],
    sourceNote: sourceNoteParts.join(" | "),
    sourceSortOrder,
  };
}

export async function parseEnglandPricebookPdf(
  filePath: string,
  execFileAsync: ExecFileAsyncLike
): Promise<ParsedManufacturerCatalogRow[]> {
  void execFileAsync;
  const text = await extractPdfText(filePath);
  if (!text.trim()) {
    throw new Error("England parser could not extract text from PDF.");
  }

  const rows: ParsedManufacturerCatalogRow[] = [];
  const seenSkus = new Set<string>();
  const pages = text.split("\f");

  for (const page of pages) {
    const pageLines = page.split("\n").map((line) => line.replace(/\s+$/g, ""));
    const section = detectSection(pageLines);
    const collection = parseCollection(pageLines);
    let inTable = false;
    let currentTypeLine = "";

    for (const rawLine of pageLines) {
      const line = rawLine.replace(/\f/g, "");
      const compact = cleanText(line);
      if (!compact) continue;

      if (/^Type\s+/i.test(compact)) {
        currentTypeLine = compact;
      }
      if (/^Style Number and Description\b/i.test(compact)) {
        inTable = true;
        continue;
      }
      if (/^(FEATURES|OPTIONS)\b/i.test(compact) || /^\*Please refer/i.test(compact)) {
        inTable = false;
        continue;
      }
      if (!inTable) continue;

      const parsed = parseRow(line, section, collection, currentTypeLine, rows.length + 1);
      if (!parsed) continue;

      const dedupeKey = [parsed.collectionCode, parsed.sku, parsed.description, parsed.basePrice].join("|");
      if (seenSkus.has(dedupeKey)) continue;
      seenSkus.add(dedupeKey);
      rows.push(parsed);
    }
  }

  return rows;
}

export async function parseEnglandReferenceNotes(): Promise<ParsedManufacturerReferenceNote[]> {
  return [];
}
