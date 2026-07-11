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
const archboldPricebook_1 = require("./archboldPricebook");
function workbookBuffer(rows) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "AFC Price List");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
(0, vitest_1.describe)("parseArchboldPricebookWorkbook", () => {
    (0, vitest_1.it)("parses repeated Archbold price-list blocks and skips non-priced configurator rows", () => {
        const rows = (0, archboldPricebook_1.parseArchboldPricebookWorkbook)(workbookBuffer([
            ["Archbold Furniture Company"],
            ["2025 Fall Price List"],
            ["SHAKER ESSENTIAL PANEL BED"],
            ["", "Base Item #", "", "Description", "H", "W", "L", "Cube", " Retail ", "Price"],
            ["TWIN", "61182", "", "Twin Essential Panel Headboard and Footboard", "", "", "", "6.04", "$0", "$288"],
            ["", "612781", "", "Twin Rails", "", "", "", "1.50", "$0", "$99"],
            ["", "", "", "Total Bed", "52\"", "42 1/2\"", "78 5/8\"", "7.54", "$0", "$387"],
            ["Shaker Chest Bed Configurator:"],
            ["", "Item #", "Description", "", "H", "W", "D", "Cube", " Retail ", ""],
            ["Step 1", "60330", "Queen/King 6 Drawer Pedestal", "", "23\"", "25 1/4\"", "80 1/2\"", "31.01", "$0", ""],
            ["ALDER BEDROOM COLLECTIONS"],
            ["SHAKER BEDROOM"],
            ["", "Item", "", "Description", "H", "W", "D", "Cube", " Retail ", "Price"],
            ["", "61411", "", "1 Drawer Nightstand", "29 1/2\"", "19\"", "18\"", "9.09", "$0", "$229"],
        ]));
        (0, vitest_1.expect)(rows).toHaveLength(4);
        (0, vitest_1.expect)(rows.every((row) => row.sku && row.description && row.category && row.basePrice !== null)).toBe(true);
        (0, vitest_1.expect)(rows.some((row) => /PRICE LIST|BASE ITEM|DESCRIPTION|CONFIGURATOR/i.test(`${row.sku} ${row.description}`))).toBe(false);
    });
    (0, vitest_1.it)("normalizes dimensions, generated set SKUs, sections, and full catalog row shape", () => {
        const rows = (0, archboldPricebook_1.parseArchboldPricebookWorkbook)(workbookBuffer([
            ["SHAKER ESSENTIAL PANEL BED"],
            ["", "Base Item #", "", "Description", "H", "W", "L", "Cube", " Retail ", "Price"],
            ["TWIN", "61182", "", "Twin Essential Panel Headboard and Footboard", "", "", "", "6.04", "$0", "$288"],
            ["", "612781", "", "Twin Rails", "", "", "", "1.50", "$0", "$99"],
            ["", "", "", "Total Bed", "52\"", "42 1/2\"", "78 5/8\"", "7.54", "$0", "$387"],
            ["SHAKER BEDROOM"],
            ["", "Item", "", "Description", "H", "W", "D", "Cube", " Retail ", "Price"],
            ["", "61411", "", "1 Drawer Nightstand", "29 1/2\"", "19\"", "18\"", "9.09", "$0", "$229"],
        ]));
        (0, vitest_1.expect)(rows.find((row) => row.sku === "61182")).toMatchObject({
            manufacturer: "Archbold",
            manufacturerSlug: "archbold",
            collectionName: "SHAKER ESSENTIAL PANEL BED",
            category: "Bedroom",
            productType: "Twin Essential Panel Headboard and Footboard",
            basePrice: 288,
            cubes: 6.04,
            isSet: false,
            hardwareOptions: [],
            cushionOptions: [],
            featureTags: [],
            imageUrls: [],
        });
        (0, vitest_1.expect)(rows.find((row) => row.isSet)).toMatchObject({
            sku: "SHAKER-ESSENTIAL-PANEL-BED-SET-TWIN-TOTAL-BED-5",
            description: "TWIN Total Bed",
            collectionName: "SHAKER ESSENTIAL PANEL BED",
            basePrice: 387,
            widthInches: 42.5,
            depthInches: 78.625,
            heightInches: 52,
            cubes: 7.54,
            isSet: true,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "61411")).toMatchObject({
            collectionName: "SHAKER BEDROOM",
            category: "Bedroom",
            description: "1 Drawer Nightstand",
            widthInches: 19,
            depthInches: 18,
            heightInches: 29.5,
            basePrice: 229,
        });
    });
    (0, vitest_1.it)("parses Amish Essentials PDF text rows and total/package lines", () => {
        const rows = (0, archboldPricebook_1.parseArchboldEssentialsPricebookText)(`
MAPLE LEG TABLES
Rectangle Shape - Leg Table Tops - Maple
BASE ITEM #         DESCRIPTION          WIDTH               LENGTH               LEAF      CUBE   RETAIL     PRICE
4013648             36" x 48" Rectangle -36"
                                          18" Leaf           48"                  1 x 18"   7.55   $        - $525
Total 42" x 72" Rectangle with 2 x 18" Leaves (9' Full Extension - Seats 10)                       $        - $1,035
Standard Height Leg Options - 29"H - Maple
BASE ITEM #       DESCRIPTION                                                                  CUBE       RETAIL      PRICE
400L01            Shaker Taper Leg    Universal to leg table tops above                        1.11       $          - $180
`);
        (0, vitest_1.expect)(rows).toHaveLength(3);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "4013648")).toMatchObject({
            manufacturer: "Archbold",
            manufacturerSlug: "archbold",
            collectionName: "Rectangle Shape - Leg Table Tops - Maple",
            category: "Dining",
            basePrice: 525,
            isSet: false,
        });
        const total = rows.find((row) => row.isSet);
        (0, vitest_1.expect)(total?.sku).toContain("SET");
        (0, vitest_1.expect)(total).toMatchObject({
            description: "Total 42\" x 72\" Rectangle with 2 x 18\" Leaves (9' Full Extension - Seats 10)",
            basePrice: 1035,
            isSet: true,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "400L01")).toMatchObject({
            collectionName: "Standard Height Leg Options - 29\"H - Maple",
            description: "Shaker Taper Leg Universal to leg table tops above",
            basePrice: 180,
        });
    });
});
//# sourceMappingURL=archboldPricebook.test.js.map