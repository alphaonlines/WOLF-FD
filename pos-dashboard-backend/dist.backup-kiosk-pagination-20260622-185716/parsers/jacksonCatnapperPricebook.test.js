"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const jacksonCatnapperPricebook_1 = require("./jacksonCatnapperPricebook");
(0, vitest_1.describe)("parseJacksonCatnapperPricebookText", () => {
    (0, vitest_1.it)("keeps inline power-upgrade style headings from inheriting the previous collection", () => {
        const text = `
CATNAPPER FURNITURE KIOSK PRICE LIST FALL 2025
STYLE                                 DESCRIPTION                            SKU           FABRIC #                  COLOR              L    H     D    WT CUBES SEATS      PRICE
RECLINING SOFAS/SECTIONALS
100 Atlas
                            Reclining Sofa                                              1001        1153-18/1253-18             Charcoal            91    43   43 237     57.3     3.0 $      540.00
106 Tyler                   POWER UPGRADE AVAILABLE
                            Reclining Loveseat                                       1062     1710-28/2648-28                                      60    40    39   180   46      2.0    $    410.00
108 Hollifield              POWER UPGRADE AVAILABLE
                            Reclining Loveseat                                       1082     1847-09/1998-09                                       66    41   41   195   47.0     2.0   $    520.00
`;
        const rows = (0, jacksonCatnapperPricebook_1.parseJacksonCatnapperPricebookText)(text);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "1001")).toMatchObject({ collectionCode: "100", collectionName: "Atlas" });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "1062")).toMatchObject({ collectionCode: "106", collectionName: "Tyler" });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "1082")).toMatchObject({ collectionCode: "108", collectionName: "Hollifield" });
    });
});
//# sourceMappingURL=jacksonCatnapperPricebook.test.js.map