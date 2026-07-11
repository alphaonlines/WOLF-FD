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
exports.parseAshleyNectarPricebookWorkbook = parseAshleyNectarPricebookWorkbook;
exports.parseAshleyReferenceNotes = parseAshleyReferenceNotes;
const fs = __importStar(require("fs"));
const XLSX = __importStar(require("xlsx"));
function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function parseMoney(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    const text = normalizeText(value);
    if (!text)
        return null;
    const cleaned = text.replace(/[,$\s]/g, "").replace(/[^\d.-]/g, "");
    if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.")
        return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}
function slugPart(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70);
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
function formatMoneyForNote(value) {
    if (value === null)
        return "";
    return Number.isInteger(value) ? String(value) : String(value);
}
function featureTagsForProduct(product) {
    const tags = ["Nectar"];
    if (/hybrid/i.test(product))
        tags.push("Hybrid");
    else if (/foam/i.test(product))
        tags.push("Foam");
    return tags;
}
function makeRow(input) {
    const description = `${input.product} - ${input.size}`;
    const sourceNoteParts = [`Ashley/Nectar row ${input.sourceRowNumber}`, "Base cost uses New Wholesale"];
    if (input.wholesale !== null)
        sourceNoteParts.push(`Old wholesale ${formatMoneyForNote(input.wholesale)}`);
    if (input.msrp !== null)
        sourceNoteParts.push(`MSRP ${formatMoneyForNote(input.msrp)}`);
    if (input.map !== null)
        sourceNoteParts.push(`MAP ${formatMoneyForNote(input.map)}`);
    if (input.margin)
        sourceNoteParts.push(`Margin ${input.margin}`);
    return {
        manufacturer: "Ashley",
        manufacturerSlug: "ashley",
        collectionCode: slugPart(input.collectionName),
        collectionName: input.collectionName,
        category: "Bedding",
        productType: "Mattress",
        sku: input.sku,
        description,
        colorFinish: input.size,
        colorFamily: "",
        material: "",
        shape: "",
        dimensionsText: input.size,
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: input.newWholesale,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: featureTagsForProduct(input.product),
        imageUrls: [],
        searchKeywords: uniqueKeywords(["Ashley", "Nectar", input.collectionName, input.product, input.size, input.sku, "Mattress"]),
        sourceNote: sourceNoteParts.join("; "),
        sourceSortOrder: input.sourceRowNumber,
    };
}
function parseGroup(row, sourceRowNumber, startIndex, collectionName) {
    const product = normalizeText(row[startIndex]);
    const size = normalizeText(row[startIndex + 1]);
    const sku = normalizeText(row[startIndex + 2]);
    const wholesale = parseMoney(row[startIndex + 3]);
    const newWholesale = parseMoney(row[startIndex + 4]);
    const msrp = parseMoney(row[startIndex + 5]);
    const map = parseMoney(row[startIndex + 6]);
    const margin = normalizeText(row[startIndex + 7]);
    if (!product || !size || !sku || newWholesale === null)
        return null;
    return makeRow({
        collectionName,
        product,
        size,
        sku,
        wholesale,
        newWholesale,
        msrp,
        map,
        margin,
        sourceRowNumber,
    });
}
function parseAshleyNectarPricebookWorkbook(buffer) {
    const workbookBuffer = typeof buffer === "string" ? fs.readFileSync(buffer) : buffer;
    const workbook = XLSX.read(workbookBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames.includes("Nectar Primary NEW") ? "Nectar Primary NEW" : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const parsedRows = [];
    let headerIndex = rows.findIndex((row) => normalizeText(row[0]).toLowerCase() === "product" && normalizeText(row[2]).toLowerCase() === "sku");
    if (headerIndex < 0)
        headerIndex = 1;
    const titleRow = rows[headerIndex - 1] || [];
    const leftCollection = normalizeText(titleRow[0]) || "Nectar Foam Primary";
    const rightCollection = normalizeText(titleRow[9]) || "Nectar Hybrid Primary";
    rows.slice(headerIndex + 1).forEach((row, offset) => {
        const sourceRowNumber = headerIndex + offset + 2;
        const left = parseGroup(row, sourceRowNumber, 0, leftCollection);
        const right = parseGroup(row, sourceRowNumber, 9, rightCollection);
        if (left)
            parsedRows.push(left);
        if (right)
            parsedRows.push(right);
    });
    return parsedRows.filter((row) => row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
}
function parseAshleyReferenceNotes(_buffer) {
    return [];
}
//# sourceMappingURL=ashleyPricebook.js.map