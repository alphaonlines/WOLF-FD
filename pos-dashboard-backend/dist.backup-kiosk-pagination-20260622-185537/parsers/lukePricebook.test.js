"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const lukePricebook_1 = require("./lukePricebook");
const sampleText = `
                           QUICKSHIP LEATHER
        GROUP     SKU         STOCK LEATHER      DIMENSIONS         STOCK PRICE
AVA-S            SOFA        3511 BOMBER TAN     H36 W81 D36           $899.00

                         CUSTOM LEATHER
         GROUP        SKU                       DIMENSIONS                CUSTOM PRICE
BENNETT-C            CHAIR                      H36 W37 D39                   850.00
AVA SECTIONAL    3STRLAF/ANGRAF               H36 W109/86 D36                $1,899.00

                                             QUICKSHIP FABRIC
        GROUP                 DESCRIPTION                    FABRIC                  DIMENSIONS           STOCK PRICE
                            LAF SOFA CORNER         BODY: HERCLUES NATURAL
STALEY L9250-30LC                                                                    H37 W92 D37             $550.00

                                     CUSTOM FABRIC
        SOFA         DESCRIPTION      PILLOWS       CUSTOM FABRIC   DIMENSIONS    CUSTOM PRICE
CHARLOTTE-1004-30        SOFA         2 PILLOWS      YOUR CHOICE    H40 W86 D38      $499.00
`;
(0, vitest_1.describe)("parseLukePricebookText", () => {
    (0, vitest_1.it)("parses leather and fabric rows with dimensions and prices", () => {
        const rows = (0, lukePricebook_1.parseLukePricebookText)(sampleText);
        (0, vitest_1.expect)(rows).toHaveLength(5);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "AVA-S")).toMatchObject({
            manufacturer: "Luke Home",
            manufacturerSlug: "luke-home",
            collectionName: "Ava",
            category: "Quickship Leather",
            productType: "Sofa",
            description: "AVA-S Sofa - 3511 BOMBER TAN",
            material: "3511 BOMBER TAN",
            basePrice: 899,
            widthInches: 81,
            depthInches: 36,
            heightInches: 36,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "BENNETT-C")).toMatchObject({
            category: "Custom Leather",
            productType: "Chair",
            basePrice: 850,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "AVA-SECTIONAL-3STRLAF-ANGRAF")).toMatchObject({
            productType: "Sectional",
            basePrice: 1899,
            dimensionsText: "H36 W109/86 D36",
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "STALEY-L9250-30LC")).toMatchObject({
            category: "Quickship Fabric",
            productType: "LAF Sofa Corner",
            material: "BODY: HERCLUES NATURAL",
            basePrice: 550,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "CHARLOTTE-1004-30")).toMatchObject({
            category: "Custom Fabric",
            productType: "Sofa",
            material: "YOUR CHOICE",
            basePrice: 499,
        });
    });
});
//# sourceMappingURL=lukePricebook.test.js.map