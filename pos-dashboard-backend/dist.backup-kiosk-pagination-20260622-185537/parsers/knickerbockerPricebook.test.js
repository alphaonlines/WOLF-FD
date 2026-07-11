"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const knickerbockerPricebook_1 = require("./knickerbockerPricebook");
(0, vitest_1.describe)("buildKnickerbockerPricebookRows", () => {
    (0, vitest_1.it)("builds rows from the image-only 2025 Knickerbocker price sheet extraction", () => {
        const rows = (0, knickerbockerPricebook_1.buildKnickerbockerPricebookRows)();
        (0, vitest_1.expect)(rows).toHaveLength(69);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "8139-2")).toMatchObject({
            manufacturer: "Knickerbocker",
            manufacturerSlug: "knickerbocker",
            collectionName: "emBrace Platform 360",
            category: "Bed Support",
            productType: "Platform Bed Support",
            description: "emBrace Platform 360 Twin Size black",
            basePrice: 175,
            colorFinish: "black",
            dimensionsText: "Twin Size",
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "4139-1")).toMatchObject({
            collectionName: "emBrace WrapAround 360",
            description: "emBrace WrapAround 360 Twin Size white",
            basePrice: 150,
            colorFinish: "white",
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "3176-2")).toMatchObject({
            collectionName: "Deluxe enGauge Bed Support System",
            description: "Deluxe enGauge Bed Support System King Size black",
            basePrice: 100,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "KB2007G")).toMatchObject({
            collectionName: "Traditional Under-The-Bed Support Systems",
            description: "Ultra Premium 7 Leg Bed Frame - All Size",
            basePrice: 59.95,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "F543")).toMatchObject({
            collectionName: "Bedbeam",
            description: "Bedbeam 3 3 Leg - Full",
            basePrice: 75,
        });
    });
});
//# sourceMappingURL=knickerbockerPricebook.test.js.map