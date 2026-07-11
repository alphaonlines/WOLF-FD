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
exports.parseAlbanyPricebookWorkbook = parseAlbanyPricebookWorkbook;
exports.parseAlbanyReferenceNotes = parseAlbanyReferenceNotes;
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
function rowText(row) {
    return row.map((cell) => normalizeText(cell)).filter(Boolean).join(" ");
}
function parseMoney(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    const text = normalizeText(value);
    if (!text)
        return null;
    const isNegative = /^\(.*\)$/.test(text);
    const cleaned = text.replace(/[,$\s()]/g, "").replace(/[^\d.-]/g, "");
    if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.")
        return null;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed))
        return null;
    return isNegative ? -parsed : parsed;
}
function parseNumber(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    const text = normalizeText(value);
    if (!text)
        return null;
    const parsed = Number(text.replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}
function parseDimensions(value) {
    const dimensionsText = normalizeText(value);
    const parts = dimensionsText
        .split(/\s*x\s*/i)
        .map((part) => parseNumber(part))
        .filter((part) => part !== null);
    return {
        dimensionsText,
        widthInches: parts[0] ?? null,
        depthInches: parts[1] ?? null,
        heightInches: parts[2] ?? null,
    };
}
function detectCategory(description) {
    const lower = description.toLowerCase();
    if (/\b(sofa|sectional|loveseat|chair|chaise|ottoman|recliner|laf|raf|armless)\b/.test(lower)) {
        return "Seating";
    }
    if (/\b(bed|dresser|chest|nightstand|mirror|mansion)\b/.test(lower)) {
        return "Bedroom";
    }
    if (/\b(table|desk|console|server|buffet|hutch|credenza|bookcase|entertainment)\b/.test(lower)) {
        return "Casegoods";
    }
    if (/\b(mattress|pillow|sleep)\b/.test(lower)) {
        return "Bedding";
    }
    return "Furniture";
}
function slugPart(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}
function extractVariantToken(sku) {
    const normalized = slugPart(sku);
    if (!normalized)
        return "";
    const parts = normalized.split("-").filter(Boolean);
    return parts[parts.length - 1] || normalized;
}
function componentStem(sku) {
    const normalized = slugPart(sku);
    return normalized.replace(/^(\d+)[AB](-.*)$/i, "$1$2");
}
function extractCollectionFromSku(sku) {
    const match = slugPart(sku).match(/^(\d+)/);
    return match?.[1]?.replace(/^0+/, "") || "";
}
function extractSetPieceCount(description) {
    const match = description.match(/\b(\d+)\s*PCS?\b/i);
    if (!match)
        return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}
function isBlankRow(row) {
    return !row.some((cell) => normalizeText(cell));
}
function isTitleRow(row) {
    const upper = rowText(row).toUpperCase();
    return upper.includes("ALBANY") && upper.includes("PRICE LIST");
}
function isPhaseOutRow(row) {
    return rowText(row).toUpperCase().includes("PHASE OUT GROUPS");
}
function isHeaderRow(row) {
    const itemNumber = normalizeUpper(row[1]);
    const description = normalizeUpper(row[2]);
    return itemNumber.includes("ITEM NUMBERS") || description.includes("SKU DESCRIPTION");
}
function getHeaderCollectionCode(row) {
    const firstCell = normalizeText(row[0]);
    if (!firstCell)
        return "";
    if (/PRICE LIST|PHASE OUT|ITEM NUMBERS|SKU DESCRIPTION/i.test(firstCell))
        return "";
    return firstCell;
}
function buildComponentDescriptionMap(rows) {
    const descriptions = new Map();
    rows.forEach((row, index) => {
        if (!row || isBlankRow(row) || isTitleRow(row) || isHeaderRow(row) || isPhaseOutRow(row))
            return;
        const sku = normalizeText(row[1]);
        const description = normalizeText(row[2]);
        const basePrice = parseMoney(row[5]) ?? parseMoney(row[6]);
        if (!sku || !description || basePrice === null)
            return;
        const stem = componentStem(sku);
        if (stem)
            descriptions.set(stem, { description, rowNumber: index + 1 });
    });
    return descriptions;
}
function uniqueKeywords(values) {
    const seen = new Set();
    const keywords = [];
    values.forEach((value) => {
        const normalized = normalizeText(value);
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key))
            return;
        seen.add(key);
        keywords.push(normalized);
    });
    return keywords;
}
function makeCatalogRow(input) {
    const category = detectCategory(input.description);
    const featureTags = [input.isSet ? "Set" : "", /sectional/i.test(input.description) ? "Sectional" : ""].filter(Boolean);
    return {
        manufacturer: "Albany",
        manufacturerSlug: "albany",
        collectionCode: input.collectionCode,
        collectionName: input.collectionCode,
        category,
        productType: input.description,
        sku: input.sku,
        description: input.description,
        colorFinish: input.colorFinish,
        colorFamily: "",
        material: "",
        shape: "",
        dimensionsText: input.dimensions.dimensionsText,
        widthInches: input.dimensions.widthInches,
        depthInches: input.dimensions.depthInches,
        heightInches: input.dimensions.heightInches,
        cubes: input.cubes,
        weightLbs: null,
        basePrice: input.basePrice,
        isSet: input.isSet,
        setPieceCount: input.setPieceCount,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: input.colorFinish,
        hardwareOptions: [],
        cushionOptions: [],
        featureTags,
        imageUrls: [],
        searchKeywords: uniqueKeywords(["Albany", input.collectionCode, input.sku, input.description, input.colorFinish, category]),
        sourceNote: input.sourceNoteParts.filter(Boolean).join("; "),
        sourceSortOrder: input.sourceSortOrder,
    };
}
function parseAlbanyPricebookWorkbook(buffer) {
    const workbookBuffer = typeof buffer === "string" ? fs.readFileSync(buffer) : buffer;
    const workbook = XLSX.read(workbookBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const componentDescriptions = buildComponentDescriptionMap(json);
    const rows = [];
    let currentCollectionCode = "";
    let activeFabric = "";
    let activeVariantToken = "";
    let lastDescriptionInCollection = null;
    json.forEach((row, index) => {
        const sourceRowNumber = index + 1;
        if (!row || isBlankRow(row) || isTitleRow(row) || isPhaseOutRow(row))
            return;
        if (isHeaderRow(row)) {
            const headerCollectionCode = getHeaderCollectionCode(row);
            if (headerCollectionCode)
                currentCollectionCode = headerCollectionCode;
            activeFabric = "";
            activeVariantToken = "";
            lastDescriptionInCollection = null;
            return;
        }
        const rawSku = normalizeText(row[1]);
        const rawDescription = normalizeText(row[2]);
        const rowFabric = normalizeText(row[3]);
        const cubes = parseNumber(row[4]);
        const tlPrice = parseMoney(row[5]);
        const ltlPrice = parseMoney(row[6]);
        const basePrice = tlPrice ?? ltlPrice;
        if (basePrice === null)
            return;
        const collectionCode = currentCollectionCode || getHeaderCollectionCode(row) || extractCollectionFromSku(rawSku) || "Albany";
        const dimensions = parseDimensions(row[7]);
        const sourceNoteParts = [`Albany row ${sourceRowNumber}`];
        if (tlPrice !== null) {
            if (ltlPrice !== null)
                sourceNoteParts.push(`TL cost used; LTL cost ${ltlPrice}`);
            else
                sourceNoteParts.push("TL cost used");
        }
        else if (ltlPrice !== null) {
            sourceNoteParts.push("LTL cost used; TL cost missing");
        }
        let description = rawDescription;
        if (!description && rawSku) {
            const stem = componentStem(rawSku);
            const inferred = componentDescriptions.get(stem) || lastDescriptionInCollection;
            if (inferred?.description) {
                description = inferred.description;
                sourceNoteParts.push(`Description inferred from Albany row ${inferred.rowNumber}`);
            }
        }
        if (!description)
            return;
        if (rowFabric)
            activeFabric = rowFabric;
        const colorFinish = rowFabric || activeFabric;
        if (rawSku) {
            activeVariantToken = extractVariantToken(rawSku) || activeVariantToken;
            const stem = componentStem(rawSku);
            if (stem && description)
                componentDescriptions.set(stem, { description, rowNumber: sourceRowNumber });
            lastDescriptionInCollection = { description, rowNumber: sourceRowNumber };
        }
        const isSet = !rawSku;
        const sku = rawSku || [slugPart(collectionCode), "SET", slugPart(description), slugPart(activeVariantToken || String(sourceRowNumber))]
            .filter(Boolean)
            .join("-");
        if (!sku)
            return;
        rows.push(makeCatalogRow({
            collectionCode,
            sku,
            description,
            colorFinish,
            cubes,
            basePrice,
            dimensions,
            isSet,
            setPieceCount: isSet ? extractSetPieceCount(description) : null,
            sourceNoteParts,
            sourceSortOrder: sourceRowNumber,
        }));
    });
    return rows.filter((row) => row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
}
function parseAlbanyReferenceNotes(_buffer) {
    return [];
}
//# sourceMappingURL=albanyPricebook.js.map