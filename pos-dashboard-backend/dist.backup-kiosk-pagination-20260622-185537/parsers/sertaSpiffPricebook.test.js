"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sertaSpiffPricebook_1 = require("./sertaSpiffPricebook");
const sampleRows = [
    ["SKU #", "Discription", "Cost", "Spiff"],
    ["500957091-1020", "PLM24 GALLOWAY MD TT", "$520.00", "$26.00"],
    ["500957091-1030", "PLM24 GALLOWAY MD TT", "$540.00", "$27.00"],
    ["500319951-1060", "PSL 23 ADORE AZUL MD TT", "$380.00", "$16.00"],
    ["500319951-1060", "PSL 23 ADORE AZUL MD TT", "$380.00", "$16.00"],
    ["500319951-1070", "PSL 23 ADORE AZUL MD TT", "", "$16.00"],
];
(0, vitest_1.describe)("parseSertaSpiffRows", () => {
    (0, vitest_1.it)("parses Serta spiff rows with cost as base price and skips duplicate/unpriced rows", () => {
        const rows = (0, sertaSpiffPricebook_1.parseSertaSpiffRows)(sampleRows);
        (0, vitest_1.expect)(rows).toHaveLength(3);
        (0, vitest_1.expect)(rows[0]).toMatchObject({
            manufacturer: "Serta",
            manufacturerSlug: "serta",
            collectionName: "Serta 2025 Mattress Spiffs",
            category: "Mattresses",
            productType: "Mattress",
            sku: "500957091-1020",
            description: "PLM24 GALLOWAY Medium Tight Top - Twin XL",
            dimensionsText: "Twin XL",
            basePrice: 520,
        });
        (0, vitest_1.expect)(rows[0].sourceNote).toContain("Spiff 26");
        (0, vitest_1.expect)(rows.find((row) => row.sku === "500319951-1070")).toBeUndefined();
    });
});
//# sourceMappingURL=sertaSpiffPricebook.test.js.map