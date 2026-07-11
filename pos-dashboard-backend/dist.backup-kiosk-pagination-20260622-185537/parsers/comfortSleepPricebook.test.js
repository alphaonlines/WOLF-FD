"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const comfortSleepPricebook_1 = require("./comfortSleepPricebook");
const sampleText = `
 SKU     DYNASTY SLEEP COLLECTION                                       SPRING WRTY   T     SET   F     SET   Q     SET   K      SET
 ARS     ARISTOCRAT II                        9"   PLUSH                 INS    10    120   194   145   225   170   254   240     388
 Z     PRT     PORTOFINO - GENIE GEL                8"   ZIPPER COVER          FOAM   10    190   264   245   325   265   349   345     493
 SKU     THOMASVILLE BED IN A BOX                                        SPRING WRTY     T    TXL    F    FXL   Q            K
 ZGL08   GEL MATTRESS - 1.5" QUILTED TOP   8"    CUSHION FIRM             FOAM     5    199   219   254   264   269         324
 SKU      COMFORT PILLOWS                                                                             EACH CASE
 PILQ     COMFORT ZIPPER PILLOW                QUEEN 10 PER CASE                                       10      100
`;
(0, vitest_1.describe)("parseComfortSleepPricebookText", () => {
    (0, vitest_1.it)("parses size and set columns from Comfort Sleep matrix sections", () => {
        const rows = (0, comfortSleepPricebook_1.parseComfortSleepPricebookText)(sampleText);
        (0, vitest_1.expect)(rows).toHaveLength(24);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "ARS-T")).toMatchObject({
            manufacturer: "Comfort Sleep",
            manufacturerSlug: "comfort-sleep",
            collectionName: "DYNASTY SLEEP COLLECTION",
            category: "Mattresses",
            productType: "Mattress",
            description: 'ARISTOCRAT II 9" PLUSH INS 10 - Twin',
            basePrice: 120,
            isSet: false,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "ARS-Q-SET")).toMatchObject({
            productType: "Mattress Set",
            description: 'ARISTOCRAT II 9" PLUSH INS 10 - Queen Set',
            basePrice: 254,
            isSet: true,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "PRT-K-SET")).toMatchObject({
            description: 'PORTOFINO - GENIE GEL 8" ZIPPER COVER FOAM 10 - King Set',
            basePrice: 493,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "ZGL08-TXL")).toMatchObject({
            collectionName: "THOMASVILLE BED IN A BOX",
            description: 'GEL MATTRESS - 1.5" QUILTED TOP 8" CUSHION FIRM FOAM 5 - Twin XL',
            basePrice: 219,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "PILQ-CASE")).toMatchObject({
            category: "Accessories",
            productType: "Pillow",
            basePrice: 100,
        });
    });
});
//# sourceMappingURL=comfortSleepPricebook.test.js.map