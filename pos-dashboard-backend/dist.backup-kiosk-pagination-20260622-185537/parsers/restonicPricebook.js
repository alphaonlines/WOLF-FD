"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRestonicPricingRows = parseRestonicPricingRows;
exports.parseRestonicWorkbook = parseRestonicWorkbook;
const xlsx_1 = __importDefault(require("xlsx"));
const MANUFACTURER = "Restonic";
const MANUFACTURER_SLUG = "restonic";
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function parseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const text = cleanText(value).replace(/[$,]/g, "");
    if (!text || /^N\/A$/i.test(text))
        return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}
function titleCase(value) {
    return cleanText(value).toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
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
function isHeader(row) {
    return row[0].toLowerCase().startsWith("model") && row[1].toLowerCase() === "sku" && row[2].toLowerCase() === "size";
}
function isFoundationName(value) {
    return /foundation/i.test(value) || /^Sofia Rose$/i.test(value);
}
function sizeSuffix(size) {
    return slugPart(size.replace(/CAL\/KING/i, "CAL KING"));
}
function updateState(state, modelCell, skuCell) {
    if (!modelCell)
        return state;
    if (isFoundationName(modelCell)) {
        return {
            currentModel: modelCell,
            currentVariant: modelCell,
            currentBaseSku: skuCell || slugPart(modelCell),
            inFoundationSection: true,
        };
    }
    if (skuCell) {
        return {
            ...state,
            currentVariant: modelCell,
            currentBaseSku: skuCell,
        };
    }
    return {
        currentModel: modelCell,
        currentVariant: "",
        currentBaseSku: "",
        inFoundationSection: false,
    };
}
function makeRow(input) {
    const basePrice = input.fdPrice ?? input.listPrice;
    const isFoundation = input.state.inFoundationSection;
    const category = isFoundation ? "Foundations" : "Mattresses";
    const productType = isFoundation ? "Foundation" : "Mattress";
    const collectionName = isFoundation
        ? (/universal foundation/i.test(input.state.currentModel) ? "Universal Foundation" : "Sofia Rose")
        : `Sofia Rose ${titleCase(input.state.currentModel)}`;
    const variant = titleCase(input.state.currentVariant || input.state.currentModel);
    const baseSku = input.state.currentBaseSku || slugPart(input.state.currentModel || collectionName);
    const sku = `${baseSku}-${sizeSuffix(input.size)}`;
    const description = isFoundation
        ? `${variant} Foundation - ${input.size}`
        : `Sofia Rose ${titleCase(input.state.currentModel)}${input.state.currentVariant ? ` ${variant}` : ""} Mattress - ${input.size}`;
    if (!sku || !description || !basePrice)
        return null;
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: slugPart(collectionName, 60),
        collectionName,
        category,
        productType,
        sku,
        description,
        colorFinish: "",
        colorFamily: "",
        material: isFoundation ? "Foundation" : "Mattress",
        shape: "",
        dimensionsText: input.size,
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords([category, productType, variant, input.size]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, collectionName, variant, input.state.currentBaseSku, sku, input.size, category, productType]),
        sourceNote: uniqueKeywords([
            `Mattress price ${input.listPrice}`,
            input.fdPrice !== null ? `Furniture Distributor price ${input.fdPrice}` : "",
        ]).join("; "),
        sourceSortOrder: input.sourceSortOrder,
    };
}
function parseRestonicPricingRows(rows) {
    const parsedRows = [];
    let headerFound = false;
    let state = { currentModel: "", currentVariant: "", currentBaseSku: "", inFoundationSection: false };
    rows.forEach((rawRow, index) => {
        const row = rawRow.map(cleanText);
        if (!row.some(Boolean))
            return;
        if (isHeader(row)) {
            headerFound = true;
            return;
        }
        if (!headerFound)
            return;
        const modelCell = row[0];
        const skuCell = row[1];
        const size = row[2];
        state = updateState(state, modelCell, skuCell);
        const listPrice = parseNumber(rawRow[3]);
        const fdPrice = parseNumber(rawRow[4]);
        if (!size || listPrice === null)
            return;
        const rowOut = makeRow({ state, size, listPrice, fdPrice, sourceSortOrder: index + 1 });
        if (rowOut)
            parsedRows.push(rowOut);
    });
    return parsedRows;
}
async function parseRestonicWorkbook(filePath) {
    const workbook = xlsx_1.default.readFile(filePath, { dense: true });
    const sheet = workbook.Sheets["Sofia Rose Pricing STD"] || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet)
        return [];
    const rows = xlsx_1.default.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    return parseRestonicPricingRows(rows);
}
//# sourceMappingURL=restonicPricebook.js.map