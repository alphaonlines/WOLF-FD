"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePro1stMontageWorkbookRows = parsePro1stMontageWorkbookRows;
exports.parsePro1stMontageWorkbook = parsePro1stMontageWorkbook;
const xlsx_1 = __importDefault(require("xlsx"));
const MANUFACTURER = "Protection 1st";
const MANUFACTURER_SLUG = "pro1st";
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function parseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const parsed = Number(cleanText(value).replace(/[$,]/g, ""));
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
function productTypeFor(planDescription) {
    const value = planDescription.toLowerCase();
    if (value.includes("adjustable base") || value.includes("power base"))
        return "Adjustable Base Protection Plan";
    if (value.includes("indoor furniture"))
        return "Indoor Furniture Protection Plan";
    return "Protection Plan";
}
function buildRow(input) {
    const productType = productTypeFor(input.planDescription || input.protectionPlan);
    const description = [input.protectionPlan, input.planDescription, input.coverageTime, input.coverageLimit].map(cleanText).filter(Boolean).join(" - ");
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: "MONTAGE-PROTECTION-PLANS",
        collectionName: "Montage Protection Plans",
        category: "Protection Plans",
        productType,
        sku: input.planCode,
        description,
        colorFinish: "",
        colorFamily: "",
        material: "Protection plan",
        shape: "",
        dimensionsText: input.coverageLimit,
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: input.wholesale,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords(["protection plan", productType, input.coverageTime]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, input.protectionPlan, input.planDescription, input.planCode, input.coverageTime, input.coverageLimit, productType, "Montage"]),
        sourceNote: uniqueKeywords([
            input.rebate !== null ? `Protection 1st rebate ${input.rebate}` : "",
            input.retailerNet !== null ? `Retailer net ${input.retailerNet}` : "",
        ]).join("; "),
        sourceSortOrder: input.sourceSortOrder,
    };
}
function parsePro1stMontageWorkbookRows(rows) {
    const parsedRows = [];
    let headerFound = false;
    rows.forEach((rawRow, index) => {
        const row = rawRow.map(cleanText);
        if (!row.some(Boolean))
            return;
        if (row[0] === "Protection Plan" && row[2] === "Plan Code") {
            headerFound = true;
            return;
        }
        if (!headerFound)
            return;
        const protectionPlan = row[0];
        const planDescription = row[1];
        const planCode = row[2];
        const coverageTime = row[3];
        const coverageLimit = row[4];
        const wholesale = parseNumber(rawRow[5]);
        const rebate = parseNumber(rawRow[7]);
        const retailerNet = parseNumber(rawRow[8]);
        if (!protectionPlan || !planCode || wholesale === null)
            return;
        parsedRows.push(buildRow({
            protectionPlan,
            planDescription,
            planCode,
            coverageTime,
            coverageLimit,
            wholesale,
            rebate,
            retailerNet,
            sourceSortOrder: index + 1,
        }));
    });
    return parsedRows;
}
async function parsePro1stMontageWorkbook(filePath) {
    const workbook = xlsx_1.default.readFile(filePath, { dense: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet)
        return [];
    const rows = xlsx_1.default.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    return parsePro1stMontageWorkbookRows(rows);
}
//# sourceMappingURL=pro1stPricebook.js.map