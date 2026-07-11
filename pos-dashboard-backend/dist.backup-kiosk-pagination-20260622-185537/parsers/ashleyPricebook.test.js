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
const vitest_1 = require("vitest");
const XLSX = __importStar(require("xlsx"));
const ashleyPricebook_1 = require("./ashleyPricebook");
function workbookBuffer(rows) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Nectar Primary NEW");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
(0, vitest_1.describe)("parseAshleyNectarPricebookWorkbook", () => {
    (0, vitest_1.it)("parses the side-by-side Nectar foam and hybrid tables", () => {
        const rows = (0, ashleyPricebook_1.parseAshleyNectarPricebookWorkbook)(workbookBuffer([
            ["Nectar Foam Primary", "", "", "", "", "", "", "", "", "Nectar Hybrid Primary"],
            ["Product", "Size", "Sku", "Wholesale", "New Wholesale", "MSRP", "MAP", "Margin", "", "Product", "Size", "Sku", "Wholesale", "New Wholesale", "MSRP", "MAP", "Margin"],
            ["Nectar 5.1 Foam Classic", "Twin", "M12511", "$195", "$184", "$699.00", "$349.00", "47%", "", "Nectar 5.1 Hybrid Classic", "Twin", "M14011", "$275", "$264", "$749.00", "$399.00", "47%"],
            ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ]));
        (0, vitest_1.expect)(rows).toHaveLength(2);
        (0, vitest_1.expect)(rows.every((row) => row.sku && row.description && row.category && row.basePrice !== null)).toBe(true);
        (0, vitest_1.expect)(rows.map((row) => row.sku).sort()).toEqual(["M12511", "M14011"]);
    });
    (0, vitest_1.it)("uses New Wholesale as base cost and preserves MSRP/MAP context", () => {
        const rows = (0, ashleyPricebook_1.parseAshleyNectarPricebookWorkbook)(workbookBuffer([
            ["Nectar Foam Primary", "", "", "", "", "", "", "", "", "Nectar Hybrid Primary"],
            ["Product", "Size", "Sku", "Wholesale", "New Wholesale", "MSRP", "MAP", "Margin", "", "Product", "Size", "Sku", "Wholesale", "New Wholesale", "MSRP", "MAP", "Margin"],
            ["Nectar 5.1 Foam Classic", "Queen", "M12531", "$375", "$367", "$1,099.00", "$649.00", "43%", "", "Nectar 5.1 Hybrid Classic", "Queen", "M14031", "$425", "$408", "$1,199.00", "$699.00", "43%"],
        ]));
        (0, vitest_1.expect)(rows.find((row) => row.sku === "M12531")).toMatchObject({
            manufacturer: "Ashley",
            manufacturerSlug: "ashley",
            collectionName: "Nectar Foam Primary",
            category: "Bedding",
            productType: "Mattress",
            description: "Nectar 5.1 Foam Classic - Queen",
            colorFinish: "Queen",
            basePrice: 367,
            isSet: false,
            hardwareOptions: [],
            cushionOptions: [],
            featureTags: ["Nectar", "Foam"],
            imageUrls: [],
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "M12531")?.sourceNote).toContain("MSRP 1099");
        (0, vitest_1.expect)(rows.find((row) => row.sku === "M12531")?.sourceNote).toContain("MAP 649");
        (0, vitest_1.expect)(rows.find((row) => row.sku === "M14031")).toMatchObject({
            collectionName: "Nectar Hybrid Primary",
            description: "Nectar 5.1 Hybrid Classic - Queen",
            basePrice: 408,
            featureTags: ["Nectar", "Hybrid"],
        });
    });
});
//# sourceMappingURL=ashleyPricebook.test.js.map