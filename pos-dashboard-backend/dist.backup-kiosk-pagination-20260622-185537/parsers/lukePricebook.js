"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLukePricebookText = parseLukePricebookText;
exports.parseLukePricebookPdf = parseLukePricebookPdf;
const MANUFACTURER = "Luke Home";
const MANUFACTURER_SLUG = "luke-home";
const PRICE_PATTERN = /^\$?\s*([0-9][0-9,]*(?:\.\d{2})?)$/;
const DIMENSION_PATTERN = /^H\s*\d/i;
function normalizeText(value) {
    return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function parseMoney(value) {
    const match = normalizeText(value).match(PRICE_PATTERN);
    if (!match)
        return null;
    const parsed = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}
function slugPart(value, maxLength = 100) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, maxLength);
}
function toTitleCase(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase())
        .replace(/\bLaf\b/g, "LAF")
        .replace(/\bRaf\b/g, "RAF")
        .replace(/\bQ\b/g, "Q")
        .replace(/\bSt\b/g, "ST")
        .replace(/\bW\/\b/g, "w/");
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
function splitColumns(line) {
    return line.split(/\s{2,}/).map(normalizeText).filter(Boolean);
}
function sectionFromLine(line, currentCategory) {
    const text = normalizeText(line).toUpperCase();
    if (text === "QUICKSHIP LEATHER")
        return "Quickship Leather";
    if (text.startsWith("CUSTOM LEATHER"))
        return "Custom Leather";
    if (text === "QUICKSHIP FABRIC")
        return "Quickship Fabric";
    if (text.startsWith("CUSTOM FABRIC"))
        return "Custom Fabric";
    return currentCategory;
}
function isHeaderOrNoise(line) {
    const text = normalizeText(line);
    if (!text)
        return true;
    if (/^PAGE\s+\d+$/i.test(text))
        return true;
    if (/^LUKE HOME PRICE LIST/i.test(text))
        return true;
    if (/^(GROUP|SOFA|SECTIONAL|ACCENT CHAIRS|SWIVEL CHAIRS|STORAGE OTTOMANS)\b/i.test(text))
        return true;
    if (/^(Email:|Website:|Voice & Text:)/i.test(text))
        return true;
    if (/OCEAN SURCHARGE INCLUDED/i.test(text))
        return true;
    if (/All Quickship Fabric Collections/i.test(text))
        return true;
    if (/^(BASE FABRICS|BASE & PILLOW FABRICS|PILLOWS FABRICS ONLY)/i.test(text))
        return true;
    return false;
}
function parseDimensions(dimensionsText) {
    const match = normalizeText(dimensionsText).match(/^H\s*([0-9.]+)\s+W\s*([0-9.]+)\s+D\s*([0-9.]+)/i);
    if (!match)
        return { height: null, width: null, depth: null };
    const height = Number(match[1]);
    const width = Number(match[2]);
    const depth = Number(match[3]);
    return {
        height: Number.isFinite(height) ? height : null,
        width: Number.isFinite(width) ? width : null,
        depth: Number.isFinite(depth) ? depth : null,
    };
}
function productTypeFrom(productLabel, sourceCode) {
    const label = normalizeText(productLabel);
    const value = `${sourceCode} ${label}`.toLowerCase();
    if (value.includes("sectional") || /3str|anglaf|angraf/.test(value))
        return "Sectional";
    if (value.includes("sofacorner"))
        return "LAF Sofa Corner";
    if (value.includes("q sleeper"))
        return "Q Sleeper";
    if (value.includes("full sleeper"))
        return "Full Sleeper";
    return toTitleCase(label || "Furniture Item");
}
function collectionNameFrom(sourceCode) {
    const first = normalizeText(sourceCode).split(/[\s-]+/)[0] || "Luke";
    const match = first.match(/^[A-Z]+/i);
    return toTitleCase(match?.[0] || first);
}
function skuFrom(sourceCode, productLabel) {
    const normalizedSource = slugPart(sourceCode);
    const parts = normalizeText(sourceCode).split(/\s+/);
    const secondTokenLooksLikeCode = parts[1] ? /\d/.test(parts[1]) : false;
    const sourceNeedsDisambiguation = (!normalizedSource.includes("-") || (parts.length > 1 && !secondTokenLooksLikeCode));
    if (sourceNeedsDisambiguation && productLabel) {
        return `${normalizedSource}-${slugPart(productLabel)}`.replace(/-+/g, "-");
    }
    return normalizedSource;
}
function materialAndLabelFrom(preSegments, pendingDetail) {
    if (preSegments.length === 1) {
        const detail = normalizeText(pendingDetail);
        const bodyIndex = detail.toUpperCase().indexOf("BODY:");
        const pillowIndex = detail.toUpperCase().indexOf("PILLOW:");
        const splitIndex = bodyIndex >= 0 ? bodyIndex : pillowIndex;
        if (splitIndex > 0) {
            return {
                productLabel: normalizeText(detail.slice(0, splitIndex)),
                material: normalizeText(detail.slice(splitIndex)),
            };
        }
        return { productLabel: detail || "Furniture Item", material: "" };
    }
    const productLabel = preSegments[1] || "Furniture Item";
    const materialSegments = preSegments.slice(2).filter((segment) => !/^\d+\s+PILLOWS?$/i.test(segment));
    return { productLabel, material: materialSegments.join(" / ") };
}
function parsePricedLine(line, category, pendingDetail, sourceLineNumber) {
    const segments = splitColumns(line);
    const dimensionIndex = segments.findIndex((segment) => DIMENSION_PATTERN.test(segment));
    if (dimensionIndex <= 0)
        return null;
    const price = parseMoney(segments[segments.length - 1] || "");
    if (price === null)
        return null;
    const preSegments = segments.slice(0, dimensionIndex);
    const sourceCode = preSegments[0];
    if (!sourceCode || isHeaderOrNoise(sourceCode))
        return null;
    const { productLabel, material } = materialAndLabelFrom(preSegments, pendingDetail);
    return {
        sourceCode,
        sku: skuFrom(sourceCode, productLabel),
        productLabel,
        material,
        dimensionsText: normalizeText(segments[dimensionIndex]),
        price,
        category: category || "Luke Home",
        sourceLineNumber,
    };
}
function makeRow(parsed, index) {
    const dimensions = parseDimensions(parsed.dimensionsText);
    const productType = productTypeFrom(parsed.productLabel, parsed.sourceCode);
    const collectionName = collectionNameFrom(parsed.sourceCode);
    const description = normalizeText(`${parsed.sku} ${productType}${parsed.material && parsed.material !== "YOUR CHOICE" ? ` - ${parsed.material}` : ""}`);
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: slugPart(collectionName, 60),
        collectionName,
        category: parsed.category,
        productType,
        sku: parsed.sku,
        description,
        colorFinish: parsed.material === "YOUR CHOICE" ? "" : parsed.material,
        colorFamily: "",
        material: parsed.material,
        shape: "",
        dimensionsText: parsed.dimensionsText,
        widthInches: dimensions.width,
        depthInches: dimensions.depth,
        heightInches: dimensions.height,
        cubes: null,
        weightLbs: null,
        basePrice: parsed.price,
        isSet: /sectional|2pc|3pc/i.test(productType),
        setPieceCount: /3PC|3STR/i.test(parsed.productLabel) ? 3 : /2PC/i.test(parsed.productLabel) ? 2 : null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: parsed.material,
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords([parsed.category, productType, parsed.material]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, parsed.sku, parsed.sourceCode, parsed.productLabel, parsed.material, parsed.category, collectionName, productType]),
        sourceNote: `Luke Home price list line ${parsed.sourceLineNumber}`,
        sourceSortOrder: parsed.sourceLineNumber * 100 + index,
    };
}
function parseLukePricebookText(text) {
    const rows = [];
    let category = "";
    let pendingDetail = "";
    text.replace(/\f/g, "\n").split(/\r?\n/).forEach((rawLine, index) => {
        const line = normalizeText(rawLine);
        const nextCategory = sectionFromLine(line, category);
        if (nextCategory !== category) {
            category = nextCategory;
            pendingDetail = "";
            return;
        }
        const parsedLine = parsePricedLine(rawLine, category, pendingDetail, index + 1);
        if (parsedLine) {
            rows.push(makeRow(parsedLine, rows.length));
            pendingDetail = "";
            return;
        }
        if (!isHeaderOrNoise(line) && !PRICE_PATTERN.test(line) && !/\$/.test(line)) {
            pendingDetail = line;
        }
    });
    return rows.filter((row) => row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
}
async function parseLukePricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    return parseLukePricebookText(String(result.stdout || ""));
}
//# sourceMappingURL=lukePricebook.js.map