"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSertaSpiffRows = parseSertaSpiffRows;
exports.parseSertaSpiffWorkbook = parseSertaSpiffWorkbook;
const xlsx_1 = __importDefault(require("xlsx"));
const MANUFACTURER = "Serta";
const MANUFACTURER_SLUG = "serta";
const COLLECTION_NAME = "Serta 2025 Mattress Spiffs";
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function parseMoney(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const text = cleanText(value).replace(/[$,]/g, "");
    if (!text)
        return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}
function slugPart(value, maxLength = 80) {
    return cleanText(value)
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
        const text = cleanText(value);
        const key = text.toLowerCase();
        if (!text || seen.has(key))
            return;
        seen.add(key);
        out.push(text);
    });
    return out;
}
function sizeFromSku(sku) {
    const suffix = cleanText(sku).slice(-2);
    const sizeMap = {
        "10": "Twin",
        "20": "Twin XL",
        "30": "Full",
        "50": "Queen",
        "60": "King",
        "70": "California King",
    };
    return sizeMap[suffix] || "";
}
function normalizeDescription(description) {
    return cleanText(description)
        .replace(/\bMD\b/gi, "Medium")
        .replace(/\bPL\b/gi, "Plush")
        .replace(/\bFM\b/gi, "Firm")
        .replace(/\bTT\b/gi, "Tight Top")
        .replace(/\bPT\b/gi, "Pillow Top")
        .replace(/\s+/g, " ")
        .trim();
}
function makeRow(input) {
    const size = sizeFromSku(input.sku);
    const normalizedDescription = normalizeDescription(input.description);
    const displayDescription = size ? `${normalizedDescription} - ${size}` : normalizedDescription;
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: slugPart(COLLECTION_NAME, 60),
        collectionName: COLLECTION_NAME,
        category: "Mattresses",
        productType: "Mattress",
        sku: input.sku,
        description: displayDescription,
        colorFinish: "",
        colorFamily: "",
        material: "Mattress",
        shape: "",
        dimensionsText: size,
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: input.cost,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords(["Mattresses", "Mattress", size, "Spiff eligible"]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, COLLECTION_NAME, input.sku, input.description, normalizedDescription, size, "spiff"]),
        sourceNote: uniqueKeywords([input.spiff !== null ? `Spiff ${input.spiff}` : "", "Source: 2025 SERTA SPIFFS.xlsx"]).join("; "),
        sourceSortOrder: input.sourceSortOrder,
    };
}
function parseSertaSpiffRows(rows) {
    const parsedRows = [];
    const seenSkus = new Set();
    rows.forEach((row, index) => {
        const sku = cleanText(row[0]);
        const description = cleanText(row[1]);
        const cost = parseMoney(row[2]);
        const spiff = parseMoney(row[3]);
        if (!sku || !description || cost === null)
            return;
        if (/sku|description|discription|cost|spiff/i.test(`${sku} ${description}`))
            return;
        if (seenSkus.has(sku))
            return;
        seenSkus.add(sku);
        parsedRows.push(makeRow({ sku, description, cost, spiff, sourceSortOrder: index + 1 }));
    });
    return parsedRows;
}
async function parseSertaSpiffWorkbook(filePath) {
    const workbook = xlsx_1.default.readFile(filePath, { dense: true });
    const sheet = workbook.Sheets["Sheet1"] || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet)
        return [];
    const rows = xlsx_1.default.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    return parseSertaSpiffRows(rows);
}
//# sourceMappingURL=sertaSpiffPricebook.js.map