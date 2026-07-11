"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const restonicPricebook_1 = require("./restonicPricebook");
const sampleRows = [
    ["Model  ", "SKU", "Size", "Mattress\r\nPrice", "Furniture Distributor Price", ""],
    ["Catarina", "", "TWIN", "N/A", "N/A", ""],
    ["Plush", "4000942", "TWIN XL", 815, 520, ""],
    ["Cushion Firm", "4001151", "FULL", 870, 575, ""],
    ["", "", "QUEEN", 895, 600, ""],
    ["", "", "CAL/KING", 1105, 810, ""],
    ["Emilia", "", "TWIN", 710, 442, ""],
    ["Sofia Rose", " ", "Twin", 100, "", ""],
    ["Universal Foundation (9\")", "4002999-50", "Twin XL", 105, "", ""],
];
(0, vitest_1.describe)("parseRestonicPricingRows", () => {
    (0, vitest_1.it)("expands Sofia Rose mattress and foundation pricing by size", () => {
        const rows = (0, restonicPricebook_1.parseRestonicPricingRows)(sampleRows);
        (0, vitest_1.expect)(rows).toHaveLength(7);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "4000942-TWIN-XL")).toMatchObject({
            manufacturer: "Restonic",
            manufacturerSlug: "restonic",
            collectionName: "Sofia Rose Catarina",
            category: "Mattresses",
            productType: "Mattress",
            description: "Sofia Rose Catarina Plush Mattress - TWIN XL",
            basePrice: 520,
            dimensionsText: "TWIN XL",
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "4001151-QUEEN")).toMatchObject({
            description: "Sofia Rose Catarina Cushion Firm Mattress - QUEEN",
            basePrice: 600,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "EMILIA-TWIN")).toMatchObject({
            collectionName: "Sofia Rose Emilia",
            description: "Sofia Rose Emilia Mattress - TWIN",
            basePrice: 442,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "SOFIA-ROSE-TWIN")).toMatchObject({
            category: "Foundations",
            productType: "Foundation",
            description: "Sofia Rose Foundation - Twin",
            basePrice: 100,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "4002999-50-TWIN-XL")).toMatchObject({
            collectionName: "Universal Foundation",
            description: "Universal Foundation (9\") Foundation - Twin XL",
            basePrice: 105,
        });
    });
});
//# sourceMappingURL=restonicPricebook.test.js.map