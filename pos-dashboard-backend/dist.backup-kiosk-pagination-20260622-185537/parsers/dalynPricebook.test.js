"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dalynPricebook_1 = require("./dalynPricebook");
const sampleText = `
                                                    Dalyn Rug Company
                                                        Price Sheet
AMADOR           2'0"X3'0"            2'6"X8'0"           4' ROUND
                     $ 35.00             $ 110.00             $ 89.00
                10' ROUND          CUSTOM SIZE           18"X7'6" BLKT   18"X18" CORNER
                     $ 512.00             $ 8.95              $ 35.00           $ 15.00
BELIZE          5'0"X7'6"            8'0"X10'0"        CUSTOM SIZE          SWATCH SET
                                                    Dalyn Rug Company
                                                        Price Sheet                                                         3
                     $ 169.00           $ 339.00              $   8.95          $   29.00
`;
(0, vitest_1.describe)("parseDalynPricebookText", () => {
    (0, vitest_1.it)("pairs rug size labels with the following price line", () => {
        const rows = (0, dalynPricebook_1.parseDalynPricebookText)(sampleText);
        (0, vitest_1.expect)(rows).toHaveLength(11);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "AMADOR-2-0-X3-0")).toMatchObject({
            manufacturer: "Dalyn",
            manufacturerSlug: "dalyn",
            collectionName: "AMADOR",
            category: "Rugs",
            productType: "Rug",
            description: 'AMADOR Rug - 2\'0"X3\'0"',
            basePrice: 35,
            dimensionsText: '2\'0"X3\'0"',
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "AMADOR-10-ROUND")).toMatchObject({
            description: "AMADOR Rug - 10' ROUND",
            basePrice: 512,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "AMADOR-18-X18-CORNER")).toMatchObject({
            category: "Rug Accessories",
            productType: "Rug Accessory",
            basePrice: 15,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "BELIZE-SWATCH-SET")).toMatchObject({
            collectionName: "BELIZE",
            productType: "Rug Accessory",
            basePrice: 29,
        });
    });
});
//# sourceMappingURL=dalynPricebook.test.js.map