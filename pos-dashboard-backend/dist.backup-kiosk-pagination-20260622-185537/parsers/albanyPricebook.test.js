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
const albanyPricebook_1 = require("./albanyPricebook");
function workbookBuffer(rows) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Pricelist");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
(0, vitest_1.describe)("parseAlbanyPricebookWorkbook", () => {
    (0, vitest_1.it)("skips Albany headers/non-products and emits only complete catalog rows", () => {
        const rows = (0, albanyPricebook_1.parseAlbanyPricebookWorkbook)(workbookBuffer([
            ["Albany Price List April 2026"],
            ["130", "ITEM NUMBERS", "SKU DESCRIPTION", "FABRICS", "CUBES", "TL", "LTL", "LxWxH"],
            ["", "0130-47-GENS-54292", "SOFA", "GENESIS SMOKE", "45", "499", "525", "65x34x35"],
            ["", "0130-99-GENS-54292", "OTTOMAN", "GENESIS SMOKE", "4", "", "200", "50x60"],
            ["", "", "2PCS SECTIONAL 61/67", "", "80", "999", "1049", ""],
            ["PHASE OUT GROUPS"],
            ["1210", "ITEM NUMBERS", "SKU DESCRIPTION", "FABRICS", "CUBES", "TL", "LTL", "LxWxH"],
            ["", "1210A-18-VIMP-25074", "LAF SOFA", "VINTAGE IMP", "33", "450", "475", "70x40x38"],
            ["", "1210B-18-VIMP-25074", "", "", "31", "440", "465", "70x40x38"],
            ["", "9999", "NO PRICE ROW", "FABRIC", "1", "", "", "10x10x10"],
            [],
        ]));
        (0, vitest_1.expect)(rows).toHaveLength(5);
        (0, vitest_1.expect)(rows.every((row) => row.sku && row.description && row.category && row.basePrice !== null)).toBe(true);
        (0, vitest_1.expect)(rows.some((row) => /ITEM NUMBERS|SKU DESCRIPTION|PRICE LIST|PHASE OUT/i.test(`${row.sku} ${row.description}`))).toBe(false);
    });
    (0, vitest_1.it)("parses prices, dimensions, package rows, and inferred component descriptions", () => {
        const rows = (0, albanyPricebook_1.parseAlbanyPricebookWorkbook)(workbookBuffer([
            ["130", "ITEM NUMBERS", "SKU DESCRIPTION", "FABRICS", "CUBES", "TL", "LTL", "LxWxH"],
            ["", "0130-47-GENS-54292", "SOFA", "GENESIS SMOKE", "45", "$499.00", "$525.00", "65x34x35"],
            ["", "0130-99-GENS-54292", "OTTOMAN", "GENESIS SMOKE", "4", "", "200", "50x60"],
            ["", "", "2PCS SECTIONAL 61/67", "", "80", "999", "1049", ""],
            ["1210", "ITEM NUMBERS", "SKU DESCRIPTION", "FABRICS", "CUBES", "TL", "LTL", "LxWxH"],
            ["", "1210A-18-VIMP-25074", "LAF SOFA", "VINTAGE IMP", "33", "450", "475", "70x40x38"],
            ["", "1210B-18-VIMP-25074", "", "", "31", "440", "465", "70x40x38"],
        ]));
        const sofa = rows.find((row) => row.sku === "0130-47-GENS-54292");
        (0, vitest_1.expect)(sofa).toMatchObject({
            manufacturer: "Albany",
            manufacturerSlug: "albany",
            collectionCode: "130",
            category: "Seating",
            productType: "SOFA",
            colorFinish: "GENESIS SMOKE",
            basePrice: 499,
            widthInches: 65,
            depthInches: 34,
            heightInches: 35,
            cubes: 45,
            isSet: false,
        });
        const fallbackPrice = rows.find((row) => row.sku === "0130-99-GENS-54292");
        (0, vitest_1.expect)(fallbackPrice).toMatchObject({ basePrice: 200, dimensionsText: "50x60", widthInches: 50, depthInches: 60, heightInches: null });
        const setRow = rows.find((row) => row.isSet);
        (0, vitest_1.expect)(setRow).toMatchObject({
            sku: "130-SET-2PCS-SECTIONAL-61-67-54292",
            description: "2PCS SECTIONAL 61/67",
            setPieceCount: 2,
            basePrice: 999,
            colorFinish: "GENESIS SMOKE",
        });
        const inferred = rows.find((row) => row.sku === "1210B-18-VIMP-25074");
        (0, vitest_1.expect)(inferred?.description).toBe("LAF SOFA");
        (0, vitest_1.expect)(inferred?.sourceNote).toMatch(/Description inferred/i);
        (0, vitest_1.expect)(inferred?.colorFinish).toBe("VINTAGE IMP");
    });
});
//# sourceMappingURL=albanyPricebook.test.js.map