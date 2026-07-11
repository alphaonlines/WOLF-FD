"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArchboldPricebookWorkbook = parseArchboldPricebookWorkbook;
exports.parseArchboldEssentialsPricebookText = parseArchboldEssentialsPricebookText;
exports.parseArchboldPricebookPdf = parseArchboldPricebookPdf;
exports.parseArchboldReferenceNotes = parseArchboldReferenceNotes;
const fs = __importStar(require("fs"));
const XLSX = __importStar(require("xlsx"));
function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeUpper(value) {
    return normalizeText(value).toUpperCase();
}
function slugPart(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70);
}
function parseMoney(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    const text = normalizeText(value);
    if (!text || /#REF!/i.test(text))
        return null;
    const cleaned = text.replace(/[,$\s]/g, "").replace(/[^\d.-]/g, "");
    if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.")
        return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}
function parsePlainNumber(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    const text = normalizeText(value);
    if (!text || /#REF!/i.test(text))
        return null;
    const parsed = Number(text.replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}
function parseMeasurement(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    let text = normalizeText(value).replace(/[”"]/g, "").trim();
    if (!text || /#REF!/i.test(text))
        return null;
    text = text.replace(/-/g, " ").replace(/\s+/g, " ");
    const mixed = text.match(/^(-?\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
        const whole = Number(mixed[1]);
        const numerator = Number(mixed[2]);
        const denominator = Number(mixed[3]);
        if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
            return whole + numerator / denominator;
        }
    }
    const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fraction) {
        const numerator = Number(fraction[1]);
        const denominator = Number(fraction[2]);
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0)
            return numerator / denominator;
    }
    const parsed = Number(text.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}
function isBlankRow(row) {
    return !row.some((cell) => normalizeText(cell));
}
function rowText(row) {
    return row.map((cell) => normalizeText(cell)).filter(Boolean).join(" ");
}
function findHeaderMap(row) {
    const cells = row.map(normalizeText);
    const normalized = cells.map((cell) => cell.toLowerCase());
    const descriptionIndex = normalized.findIndex((cell) => cell === "description");
    const explicitSkuIndex = normalized.findIndex((cell) => cell === "base item #" || cell === "item #" || cell === "item");
    const priceIndex = normalized.findIndex((cell) => cell === "price");
    const heightIndex = normalized.findIndex((cell) => cell === "h");
    const widthIndex = normalized.findIndex((cell) => cell === "w");
    const depthIndex = normalized.findIndex((cell) => cell === "d" || cell === "l");
    const cubeIndex = normalized.findIndex((cell) => cell === "cube");
    if (descriptionIndex < 0)
        return null;
    if (explicitSkuIndex < 0 && (priceIndex < 0 || heightIndex < 0 || widthIndex < 0 || depthIndex < 0))
        return null;
    return {
        skuIndex: explicitSkuIndex >= 0 ? explicitSkuIndex : 1,
        descriptionIndex,
        heightIndex,
        widthIndex,
        depthIndex,
        depthLabel: normalizeUpper(cells[depthIndex]) === "L" ? "L" : "D",
        cubeIndex,
        priceIndex,
    };
}
function isSkippableSectionText(text) {
    return /NOTE:|CONFIGURATOR|STEP\s|EMAIL|PHONE|DATE|TONES|STAINS|HARDWARE|HANDLES|OPTIONS|ITEM # SYSTEM|UNFINISHED|HIGHLIGHTED|ARCHBOLD FURNITURE COMPANY|PUBLISH DATE|EFFECTIVE DATE/i.test(text);
}
function detectSectionName(row) {
    const cells = row.map(normalizeText);
    const filled = cells.map((cell, index) => ({ cell, index })).filter((entry) => entry.cell);
    if (filled.length !== 1 || filled[0].index !== 0)
        return "";
    const text = filled[0].cell;
    if (text.length < 3 || isSkippableSectionText(text))
        return "";
    return text;
}
function normalizeVariantLabel(value) {
    const text = normalizeText(value);
    if (!text || /^step\s*\d+/i.test(text) || /^note:/i.test(text))
        return "";
    return text;
}
function parseDimensions(row, header) {
    const rawHeight = header.heightIndex >= 0 ? normalizeText(row[header.heightIndex]) : "";
    const rawWidth = header.widthIndex >= 0 ? normalizeText(row[header.widthIndex]) : "";
    const rawDepth = header.depthIndex >= 0 ? normalizeText(row[header.depthIndex]) : "";
    const widthInches = parseMeasurement(rawWidth);
    const depthInches = parseMeasurement(rawDepth);
    const heightInches = parseMeasurement(rawHeight);
    const dimensionsText = [
        rawWidth ? `${rawWidth} W` : "",
        rawDepth ? `${rawDepth} ${header.depthLabel}` : "",
        rawHeight ? `${rawHeight} H` : "",
    ]
        .filter(Boolean)
        .join(" x ");
    return { dimensionsText, widthInches, depthInches, heightInches };
}
function detectCategory(collectionName, description) {
    const lower = `${collectionName} ${description}`.toLowerCase();
    if (/home office|desk|file|credenza|workstation/.test(lower))
        return "Home Office";
    if (/entertainment|console/.test(lower))
        return "Entertainment";
    if (/bookcase/.test(lower))
        return "Bookcases";
    if (/bedroom|bed|headboard|footboard|rails|nightstand|dresser|chest|mirror|wardrobe|armoire|lingerie/.test(lower))
        return "Bedroom";
    if (/occasional|chairside|coffee|sofa table|end table/.test(lower))
        return "Occasional";
    if (/dining|table|chair|bench|server|pedestal|leaf|leg /.test(lower))
        return "Dining";
    return "Furniture";
}
function uniqueKeywords(values) {
    const seen = new Set();
    const out = [];
    values.forEach((value) => {
        const text = normalizeText(value);
        const key = text.toLowerCase();
        if (!text || seen.has(key))
            return;
        seen.add(key);
        out.push(text);
    });
    return out;
}
function makeCatalogRow(input) {
    const category = detectCategory(input.collectionName, input.description);
    const featureTags = [input.isSet ? "Set" : ""].filter(Boolean);
    const collectionCode = slugPart(input.collectionName);
    return {
        manufacturer: "Archbold",
        manufacturerSlug: "archbold",
        collectionCode,
        collectionName: input.collectionName,
        category,
        productType: input.description,
        sku: input.sku,
        description: input.description,
        colorFinish: input.variantLabel,
        colorFamily: "",
        material: "Wood",
        shape: "",
        dimensionsText: input.dimensions.dimensionsText,
        widthInches: input.dimensions.widthInches,
        depthInches: input.dimensions.depthInches,
        heightInches: input.dimensions.heightInches,
        cubes: input.cubes,
        weightLbs: null,
        basePrice: input.basePrice,
        isSet: input.isSet,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags,
        imageUrls: [],
        searchKeywords: uniqueKeywords([
            "Archbold",
            input.collectionName,
            input.sku,
            input.description,
            input.variantLabel,
            category,
        ]),
        sourceNote: `Archbold row ${input.sourceRowNumber}${input.variantLabel ? `; Variant/group: ${input.variantLabel}` : ""}`,
        sourceSortOrder: input.sourceRowNumber,
    };
}
function parseArchboldPricebookWorkbook(buffer) {
    const workbookBuffer = typeof buffer === "string" ? fs.readFileSync(buffer) : buffer;
    const workbook = XLSX.read(workbookBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames.includes("AFC Price List") ? "AFC Price List" : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const parsedRows = [];
    let currentSection = "";
    let currentHeader = null;
    let activeVariantLabel = "";
    rows.forEach((row, index) => {
        const sourceRowNumber = index + 1;
        if (!row || isBlankRow(row))
            return;
        const sectionName = detectSectionName(row);
        if (sectionName) {
            currentSection = sectionName;
            activeVariantLabel = "";
            return;
        }
        const header = findHeaderMap(row);
        if (header) {
            currentHeader = header;
            return;
        }
        if (!currentHeader)
            return;
        const rawSku = normalizeText(row[currentHeader.skuIndex]);
        const rawDescription = normalizeText(row[currentHeader.descriptionIndex]);
        const prefixVariant = normalizeVariantLabel(normalizeText(row[0]));
        const inlineVariant = currentHeader.descriptionIndex - currentHeader.skuIndex > 1
            ? normalizeVariantLabel(normalizeText(row[currentHeader.descriptionIndex - 1]))
            : "";
        const rowVariant = prefixVariant || inlineVariant;
        if (rowVariant)
            activeVariantLabel = rowVariant;
        const basePrice = currentHeader.priceIndex >= 0 ? parseMoney(row[currentHeader.priceIndex]) : null;
        if (basePrice === null || basePrice <= 0)
            return;
        if (!rawDescription)
            return;
        const isSet = !rawSku;
        const description = isSet && activeVariantLabel && /^total\b/i.test(rawDescription)
            ? `${activeVariantLabel} ${rawDescription}`
            : rawDescription;
        const collectionName = currentSection || "Archbold Furniture";
        const setSku = [slugPart(collectionName), "SET", slugPart(activeVariantLabel), slugPart(rawDescription), String(sourceRowNumber)]
            .filter(Boolean)
            .join("-");
        const sku = rawSku || setSku;
        if (!sku)
            return;
        parsedRows.push(makeCatalogRow({
            collectionName,
            sku,
            description,
            variantLabel: activeVariantLabel,
            basePrice,
            cubes: currentHeader.cubeIndex >= 0 ? parsePlainNumber(row[currentHeader.cubeIndex]) : null,
            dimensions: parseDimensions(row, currentHeader),
            isSet,
            sourceRowNumber,
        }));
    });
    return parsedRows.filter((row) => row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
}
function extractLastPdfPrice(text) {
    const regex = /\$\s*([0-9][0-9,]*(?:\.\d{2})?)/g;
    let match;
    let last = null;
    while ((match = regex.exec(text))) {
        const value = Number(match[1].replace(/,/g, ""));
        if (Number.isFinite(value))
            last = { value, index: match.index };
    }
    return last;
}
function cleanPdfDescription(value) {
    return normalizeText(value)
        .replace(/\$\s*-?\s*$/g, "")
        .replace(/\s+\d+(?:\.\d+)?\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function isPdfNoiseLine(line) {
    return !line ||
        /^Page\s+\d+$/i.test(line) ||
        /^BASE ITEM #/i.test(line) ||
        /^ITEM # SYSTEM/i.test(line) ||
        /^Email:/i.test(line) ||
        /^Phone:/i.test(line) ||
        /^Publish Date:/i.test(line) ||
        /^Effective Date:/i.test(line) ||
        /^\d{4}\s+Fall Price List/i.test(line) ||
        /^highlighted item numbers/i.test(line) ||
        /^pictured:/i.test(line);
}
function detectPdfSection(line) {
    const text = normalizeText(line);
    if (isPdfNoiseLine(text) || extractLastPdfPrice(text))
        return "";
    if (/^\d/.test(text) || /^Total\b/i.test(text))
        return "";
    if (text.length > 100)
        return "";
    if (/^[A-Z0-9 &,/&\-]+$/.test(text) && /[A-Z]{3}/.test(text))
        return text;
    if (/Table|Tops|Options|Servers|Chairs|Benches|Bedroom|Dining|Collections|Pedestal|Bookcases|Occasional|Maple|Cherry/i.test(text)) {
        return text;
    }
    return "";
}
function makePdfCatalogRow(input) {
    return makeCatalogRow({
        collectionName: input.collectionName,
        sku: input.sku,
        description: input.description,
        variantLabel: "Amish Essentials",
        basePrice: input.basePrice,
        cubes: null,
        dimensions: { dimensionsText: "", widthInches: null, depthInches: null, heightInches: null },
        isSet: input.isSet,
        sourceRowNumber: input.sourceLineNumber,
    });
}
function parseArchboldEssentialsPricebookText(text) {
    const rows = [];
    const lines = String(text || "").split(/\r?\n/);
    let currentSection = "Archbold Amish Essentials";
    let pending = null;
    const finishPending = () => {
        if (!pending)
            return;
        const combined = normalizeText(pending.parts.join(" "));
        const price = extractLastPdfPrice(combined);
        if (!price) {
            pending = null;
            return;
        }
        const description = cleanPdfDescription(combined.slice(0, price.index));
        if (description && pending.sku) {
            rows.push(makePdfCatalogRow({
                collectionName: currentSection,
                sku: pending.sku,
                description,
                basePrice: price.value,
                isSet: false,
                sourceLineNumber: pending.sourceLineNumber,
            }));
        }
        pending = null;
    };
    lines.forEach((rawLine, index) => {
        const sourceLineNumber = index + 1;
        const line = normalizeText(rawLine);
        if (isPdfNoiseLine(line))
            return;
        const section = detectPdfSection(line);
        if (section && !pending) {
            currentSection = section;
            return;
        }
        const totalPrice = extractLastPdfPrice(line);
        if (/^Total\b/i.test(line) && totalPrice) {
            finishPending();
            const description = cleanPdfDescription(line.slice(0, totalPrice.index));
            const sku = ["ARCHBOLD-ESSENTIALS", slugPart(currentSection), "SET", slugPart(description), String(sourceLineNumber)]
                .filter(Boolean)
                .join("-");
            if (description && sku) {
                rows.push(makePdfCatalogRow({
                    collectionName: currentSection,
                    sku,
                    description,
                    basePrice: totalPrice.value,
                    isSet: true,
                    sourceLineNumber,
                }));
            }
            return;
        }
        const productStart = line.match(/^([A-Z0-9][A-Z0-9-]{2,})\s+(.+)$/);
        if (productStart && /\d/.test(productStart[1]) && !/^Page$/i.test(productStart[1])) {
            finishPending();
            pending = { sku: productStart[1], parts: [productStart[2]], sourceLineNumber };
            if (extractLastPdfPrice(productStart[2]))
                finishPending();
            return;
        }
        if (pending) {
            pending.parts.push(line);
            if (extractLastPdfPrice(line))
                finishPending();
        }
    });
    finishPending();
    return rows.filter((row) => row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
}
async function parseArchboldPricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    return parseArchboldEssentialsPricebookText(String(result.stdout || ""));
}
function parseArchboldReferenceNotes(_buffer) {
    return [];
}
//# sourceMappingURL=archboldPricebook.js.map