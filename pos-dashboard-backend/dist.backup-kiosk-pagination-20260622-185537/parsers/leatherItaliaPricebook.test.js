"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const leatherItaliaPricebook_1 = require("./leatherItaliaPricebook");
const sampleText = `
 WHSE       IMAGE              SKU#                                         DESCRIPTION                          WHSE        FOB     L      D      H                                       FACTORY
 NC ONLY             1444-3308ALC-014273LV     3308 ADELL SECTIONAL ARMLESS CHAIR 4273LV SADDLE               $     299   $    199   33.0   40.0   40.0    23.3       76        90          CAMBRIA
 NC                1444-6110-0304234         6110 ARIZONA SOFA 04234 MARCO                                  $     999   $    677   89.0   39.3   41.3    68.9      174        90          CAMBRIA
 CA                1444-6110-0204234         6110 ARIZONA LOVE 04234 MARCO                                  $     979   $    655   65.8   39.3   41.3    51.2      137        90          CAMBRIA
`;
(0, vitest_1.describe)("parseLeatherItaliaPricebookText", () => {
    (0, vitest_1.it)("parses WHSE/FOB price rows with dimensions", () => {
        const rows = (0, leatherItaliaPricebook_1.parseLeatherItaliaPricebookText)(sampleText);
        (0, vitest_1.expect)(rows).toHaveLength(3);
        (0, vitest_1.expect)(rows[0]).toMatchObject({
            manufacturer: "Leather Italia",
            manufacturerSlug: "leather-italia",
            collectionName: "3308 Adell",
            category: "Sectionals",
            productType: "Armless Chair",
            sku: "1444-3308ALC-014273LV",
            description: "3308 ADELL SECTIONAL ARMLESS CHAIR 4273LV SADDLE",
            basePrice: 299,
            widthInches: 33,
            depthInches: 40,
            heightInches: 40,
            cubes: 23.3,
            weightLbs: 76,
        });
        (0, vitest_1.expect)(rows[1]).toMatchObject({
            collectionName: "6110 Arizona",
            productType: "Sofa",
            basePrice: 999,
        });
        (0, vitest_1.expect)(rows[2]?.sourceNote).toContain("FOB 655");
    });
});
//# sourceMappingURL=leatherItaliaPricebook.test.js.map