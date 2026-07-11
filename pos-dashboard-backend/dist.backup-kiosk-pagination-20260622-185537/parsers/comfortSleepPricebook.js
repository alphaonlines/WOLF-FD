"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseComfortSleepPricebookText = parseComfortSleepPricebookText;
exports.parseComfortSleepPricebookPdf = parseComfortSleepPricebookPdf;
const MANUFACTURER = "Comfort Sleep";
const MANUFACTURER_SLUG = "comfort-sleep";
function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function slugPart(value, maxLength = 80) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
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
function sizeName(label) {
    const clean = normalizeText(label).toUpperCase();
    const withoutSet = clean.replace(/\s+SET$/, "");
    const map = {
        T: "Twin",
        TXL: "Twin XL",
        F: "Full",
        FXL: "Full XL",
        Q: "Queen",
        K: "King",
        CK: "California King",
        EACH: "Each",
        CASE: "Case",
        SET: "Set",
    };
    return map[withoutSet] || withoutSet;
}
function column(label) {
    return { label, size: sizeName(label), isSet: /\bSET$/i.test(label) || label === "SET" };
}
function labelsForHeader(header) {
    const h = normalizeText(header).toUpperCase();
    let labels = [];
    if (h.includes("35X72"))
        labels = ["35X72", "38X72", "48X72", "52X72", "54X72", "58X72", "60X72", "64X72"];
    else if (h.includes("30X80"))
        labels = ["30X80", "38X80", "42X80", "48X80", "54X80", "60X80", "66X80", "76X80"];
    else if (h.includes("THOMASVILLE BED IN A BOX"))
        labels = ["T", "TXL", "F", "FXL", "Q", "K"];
    else if (h.includes("COMFORT PILLOWS"))
        labels = ["EACH", "CASE"];
    else if (h.includes("ADJUSTABLE BASE ACCESSORIES"))
        labels = ["EACH"];
    else if (h.includes("METAL BED FRAMES") || h.includes("ADJUSTABLE BASES & LIFT CHAIR"))
        labels = [];
    else if (h.includes("ADJUSTABLE MATTRESSES"))
        labels = ["T", "TXL", "F", "Q", "SPLIT HEAD Q", "K", "SPLIT HEAD K"];
    else if (h.includes("WOOD FOUNDATIONS"))
        labels = ["T", "F", "FXL", "Q", "TXL", "SET"];
    else if (h.includes(" T SET") || h.endsWith("K SET") || h.includes(" SET F SET Q"))
        labels = ["T", "T SET", "F", "F SET", "Q", "Q SET", "K", "K SET"];
    return labels.map(column);
}
function collectionFromHeader(header) {
    let text = normalizeText(header).replace(/^SKU\s+/i, "");
    const markers = [" SPRING", " 35X", " 30X", " T SET", " T TXL", " EACH", " METAL", " WOOD"];
    for (const marker of markers) {
        const index = text.toUpperCase().indexOf(marker);
        if (index >= 0)
            text = text.slice(0, index);
    }
    return normalizeText(text);
}
function detectCategory(collectionName) {
    const value = collectionName.toLowerCase();
    if (/foundation|bunkie/.test(value))
        return "Foundations";
    if (/pillow|accessor/.test(value))
        return "Accessories";
    if (/adjustable mattresses/.test(value))
        return "Mattresses";
    return "Mattresses";
}
function detectProductType(collectionName, isSet) {
    const value = collectionName.toLowerCase();
    if (/pillow/.test(value))
        return "Pillow";
    if (/foundation|bunkie/.test(value))
        return isSet ? "Foundation Set" : "Foundation";
    if (/adjustable mattresses/.test(value))
        return "Adjustable Mattress";
    return isSet ? "Mattress Set" : "Mattress";
}
function detectMaterial(text) {
    const value = text.toLowerCase();
    if (/latex/.test(value))
        return "Latex";
    if (/hybrid|\bpc\b|\bpe\b|coil|spring|qtm|ins|cal/.test(value))
        return "Hybrid/Innerspring";
    if (/foam|gel|memory|graphite|cool mf/.test(value))
        return "Foam";
    if (/vinyl/.test(value))
        return "Vinyl";
    if (/nylon/.test(value))
        return "Nylon";
    return "";
}
function cleanSku(rawSku) {
    return normalizeText(rawSku).toUpperCase().replace(/[^A-Z0-9.]/g, "");
}
function labelKey(label) {
    return slugPart(label, 24) || "PRICE";
}
function parsePriceNumbers(line) {
    return [...line.matchAll(/\b\d{1,4}\b/g)].map((match) => Number(match[0])).filter((value) => Number.isFinite(value));
}
function stripTrailingNumbers(line, count) {
    let out = line;
    for (let index = 0; index < count; index += 1)
        out = out.replace(/\s+\d{1,4}\s*$/, "");
    return normalizeText(out);
}
function parseItemLine(line, sourceLineNumber, collectionName, columns) {
    const normalized = normalizeText(line);
    if (!columns.length || !normalized || /^SKU\b/i.test(normalized) || /^v\d/i.test(normalized))
        return [];
    const itemMatch = normalized.match(/^(?:Z\s+)?([A-Z0-9.]{2,8})\s+(.+)$/);
    if (!itemMatch)
        return [];
    const skuBase = cleanSku(itemMatch[1]);
    if (!skuBase || ["SKU", "PG"].includes(skuBase))
        return [];
    const numbers = parsePriceNumbers(normalized);
    const priceCount = Math.min(columns.length, numbers.length);
    if (!priceCount)
        return [];
    const prices = numbers.slice(numbers.length - priceCount);
    const usedColumns = columns.slice(columns.length - priceCount);
    const prefix = stripTrailingNumbers(normalized, priceCount);
    const descriptor = normalizeText(prefix.replace(new RegExp(`^(?:Z\\s+)?${skuBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), ""));
    if (!descriptor || /^SKU\b/i.test(descriptor))
        return [];
    const category = detectCategory(collectionName);
    const material = detectMaterial(`${collectionName} ${descriptor}`);
    return prices.map((price, index) => {
        const col = usedColumns[index];
        const productType = detectProductType(collectionName, col.isSet);
        const description = `${descriptor} - ${col.size}${col.isSet && col.size !== "Set" ? " Set" : ""}`;
        return {
            manufacturer: MANUFACTURER,
            manufacturerSlug: MANUFACTURER_SLUG,
            collectionCode: slugPart(collectionName),
            collectionName,
            category,
            productType,
            sku: `${skuBase}-${labelKey(col.label)}`,
            description,
            colorFinish: col.size,
            colorFamily: "",
            material,
            shape: "",
            dimensionsText: col.size,
            widthInches: null,
            depthInches: null,
            heightInches: null,
            cubes: null,
            weightLbs: null,
            basePrice: price,
            isSet: col.isSet,
            setPieceCount: col.isSet ? null : null,
            isSwatch: false,
            isSample: false,
            isNewProduct: false,
            upholsteryCover: "",
            hardwareOptions: [],
            cushionOptions: [],
            featureTags: uniqueKeywords([collectionName, productType, col.size, material]),
            imageUrls: [],
            searchKeywords: uniqueKeywords([MANUFACTURER, collectionName, skuBase, col.label, col.size, descriptor, productType, category, material]),
            sourceNote: `Comfort Sleep May-26 price list line ${sourceLineNumber}`,
            sourceSortOrder: sourceLineNumber * 100 + index,
        };
    });
}
function parseComfortSleepPricebookText(text) {
    const rows = [];
    let collectionName = "";
    let columns = [];
    text.replace(/\f/g, "\n").split(/\r?\n/).forEach((line, index) => {
        const normalized = normalizeText(line);
        if (!normalized)
            return;
        if (/^SKU\b/i.test(normalized)) {
            collectionName = collectionFromHeader(normalized);
            columns = labelsForHeader(normalized);
            return;
        }
        rows.push(...parseItemLine(normalized, index + 1, collectionName, columns));
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
async function parseComfortSleepPricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    return parseComfortSleepPricebookText(String(result.stdout || ""));
}
//# sourceMappingURL=comfortSleepPricebook.js.map