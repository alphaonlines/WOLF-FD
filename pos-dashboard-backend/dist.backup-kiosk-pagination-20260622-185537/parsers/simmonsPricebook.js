"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSimmonsRawDataRows = parseSimmonsRawDataRows;
exports.parseSimmonsWorkbook = parseSimmonsWorkbook;
const xlsx_1 = __importDefault(require("xlsx"));
const MANUFACTURER = "Simmons";
const MANUFACTURER_SLUG = "simmons";
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function parseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const text = cleanText(value).replace(/[$,]/g, "");
    if (!text)
        return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
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
function categoryForRightSide(description) {
    const value = description.toLowerCase();
    if (value.includes("baselogic") || value.includes("luxury base") || value.includes("ssb")) {
        return { category: "Adjustable Bases", productType: "Adjustable Base" };
    }
    return { category: "Foundations", productType: "Flat Foundation" };
}
function parseSourceItem(row, startIndex, sourceSortOrder, forcedType) {
    const sku = cleanText(row[startIndex]);
    const ohmDescription = cleanText(row[startIndex + 1]);
    const sizeDescription = cleanText(row[startIndex + 2]);
    const wholesale = parseNumber(row[startIndex + 3]);
    const srp = parseNumber(row[startIndex + 4]);
    const upc = cleanText(row[startIndex + 5]);
    if (!sku || !ohmDescription || !sizeDescription || wholesale === null)
        return null;
    if (/product|description|wholesale/i.test(`${sku} ${ohmDescription}`))
        return null;
    const type = forcedType || { category: "Mattresses", productType: "Mattress" };
    return { sku, ohmDescription, sizeDescription, wholesale, srp, upc, ...type, sourceSortOrder };
}
function makeRow(item) {
    const collectionName = "Beautyrest Everyday";
    const description = `${item.ohmDescription} - ${item.sizeDescription}`;
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: "BEAUTYREST-EVERYDAY",
        collectionName,
        category: item.category,
        productType: item.productType,
        sku: item.sku,
        description,
        colorFinish: "",
        colorFamily: "",
        material: item.category === "Mattresses" ? "Mattress" : item.productType,
        shape: "",
        dimensionsText: item.sizeDescription,
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: item.wholesale,
        isSet: /king|split/i.test(item.sizeDescription) && item.category !== "Mattresses",
        setPieceCount: /2 piece|split/i.test(item.sizeDescription) ? 2 : null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords([item.category, item.productType, item.sizeDescription]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, collectionName, item.sku, item.ohmDescription, item.sizeDescription, item.category, item.productType, item.upc]),
        sourceNote: uniqueKeywords([item.srp !== null ? `SRP ${item.srp}` : "", item.upc ? `UPC ${item.upc}` : ""]).join("; "),
        sourceSortOrder: item.sourceSortOrder,
    };
}
function parseSimmonsRawDataRows(rows) {
    const parsedRows = [];
    let rightSideType = { category: "Foundations", productType: "Flat Foundation" };
    rows.forEach((row, index) => {
        const rightHeader = cleanText(row[9]).toLowerCase();
        if (rightHeader === "flat product")
            rightSideType = { category: "Foundations", productType: "Flat Foundation" };
        if (rightHeader === "adjustable product")
            rightSideType = { category: "Adjustable Bases", productType: "Adjustable Base" };
        const mattress = parseSourceItem(row, 0, (index + 1) * 100);
        if (matressIsValid(mattress))
            parsedRows.push(makeRow(mattress));
        const rightType = rightSideType || categoryForRightSide(cleanText(row[10]));
        const base = parseSourceItem(row, 9, (index + 1) * 100 + 50, rightType);
        if (matressIsValid(base))
            parsedRows.push(makeRow(base));
    });
    return parsedRows;
}
function matressIsValid(item) {
    return Boolean(item?.sku && item?.ohmDescription && item?.wholesale !== null);
}
async function parseSimmonsWorkbook(filePath) {
    const workbook = xlsx_1.default.readFile(filePath, { dense: true });
    const sheet = workbook.Sheets["Raw Data "] || workbook.Sheets["Upload Unprotected"] || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet)
        return [];
    const rows = xlsx_1.default.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    return parseSimmonsRawDataRows(rows);
}
//# sourceMappingURL=simmonsPricebook.js.map