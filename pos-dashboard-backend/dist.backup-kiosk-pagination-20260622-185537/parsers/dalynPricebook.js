"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDalynPricebookText = parseDalynPricebookText;
exports.parseDalynPricebookPdf = parseDalynPricebookPdf;
const MANUFACTURER = "Dalyn";
const MANUFACTURER_SLUG = "dalyn";
const PRICE_PATTERN = /\$\s*([0-9][0-9,]*(?:\.\d{2})?)/g;
function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/[“”]/g, '"')
        .replace(/\s+/g, " ")
        .trim();
}
function parseMoney(value) {
    const parsed = Number(normalizeText(value).replace(/[,$]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}
function slugPart(value, maxLength = 80) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/["']/g, "-")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, maxLength);
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
    return line
        .replace(/\f/g, "")
        .split(/\s{2,}/)
        .map(normalizeText)
        .filter(Boolean);
}
function isNoiseLine(line) {
    const text = normalizeText(line);
    if (!text)
        return true;
    if (/^Dalyn Rug Company$/i.test(text))
        return true;
    if (/^ERIC\b/i.test(text))
        return true;
    if (/^Price Sheet(?:\s+\d+)?$/i.test(text))
        return true;
    if (/^\*\*\*/.test(text))
        return true;
    return false;
}
function looksLikeLabel(text) {
    const value = normalizeText(text).toUpperCase();
    if (!value || /\$/.test(value))
        return false;
    return /\d/.test(value) || /CUSTOM|SIZE|ROUND|CORNER|BLKT|BLANKET|SWATCH|RECT|OVAL|OCT|SQ|COLOR/.test(value);
}
function labelLineFrom(line, currentCollection, sourceLineNumber) {
    if (isNoiseLine(line) || /\$/.test(line))
        return null;
    const segments = splitColumns(line);
    if (!segments.length)
        return null;
    let collectionName = currentCollection;
    let labels = segments;
    const startsWithWhitespace = /^\s/.test(line);
    if (!startsWithWhitespace && !looksLikeLabel(segments[0]) && segments.length > 1) {
        collectionName = segments[0];
        labels = segments.slice(1);
    }
    labels = labels.filter(looksLikeLabel);
    if (!collectionName || !labels.length)
        return null;
    return { collectionName, labels, sourceLineNumber };
}
function parsePrices(line) {
    return [...line.matchAll(PRICE_PATTERN)]
        .map((match) => parseMoney(match[1]))
        .filter((value) => value !== null);
}
function isAccessoryLabel(label) {
    return /CUSTOM|CORNER|BLKT|BLANKET|SWATCH|COLOR/i.test(label);
}
function productTypeFor(label) {
    if (isAccessoryLabel(label))
        return "Rug Accessory";
    return "Rug";
}
function makeRow(input) {
    const category = isAccessoryLabel(input.label) ? "Rug Accessories" : "Rugs";
    const productType = productTypeFor(input.label);
    const collectionCode = slugPart(input.collectionName, 48);
    const labelCode = slugPart(input.label, 70);
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode,
        collectionName: input.collectionName,
        category,
        productType,
        sku: `${collectionCode}-${labelCode}`,
        description: `${input.collectionName} Rug - ${input.label}`,
        colorFinish: "",
        colorFamily: "",
        material: "",
        shape: /ROUND|OCT|SQ|OVAL|RECT/i.test(input.label) ? normalizeText(input.label.replace(/[0-9'"X/ -]/gi, "")) : "",
        dimensionsText: input.label,
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: input.basePrice,
        isSet: /SWATCH SET/i.test(input.label),
        setPieceCount: null,
        isSwatch: /SWATCH/i.test(input.label),
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords([productType, input.label]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, input.collectionName, input.label, category, productType]),
        sourceNote: `Dalyn rug price sheet line ${input.sourceLineNumber}`,
        sourceSortOrder: input.sourceLineNumber * 100 + input.index,
    };
}
function parseDalynPricebookText(text) {
    const rows = [];
    let currentCollection = "";
    let pending = null;
    text.replace(/\f/g, "\n").split(/\r?\n/).forEach((rawLine, index) => {
        const sourceLineNumber = index + 1;
        const line = normalizeText(rawLine);
        if (!line)
            return;
        const prices = parsePrices(rawLine);
        if (prices.length && pending) {
            const count = Math.min(prices.length, pending.labels.length);
            for (let priceIndex = 0; priceIndex < count; priceIndex += 1) {
                rows.push(makeRow({
                    collectionName: pending.collectionName,
                    label: pending.labels[priceIndex],
                    basePrice: prices[priceIndex],
                    sourceLineNumber,
                    index: priceIndex,
                }));
            }
            currentCollection = pending.collectionName;
            pending = null;
            return;
        }
        const labelLine = labelLineFrom(rawLine, currentCollection, sourceLineNumber);
        if (labelLine) {
            currentCollection = labelLine.collectionName;
            pending = labelLine;
        }
    });
    const seen = new Set();
    return rows.filter((row) => {
        const key = row.sku.toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return Boolean(row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
    });
}
async function parseDalynPricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    return parseDalynPricebookText(String(result.stdout || ""));
}
//# sourceMappingURL=dalynPricebook.js.map