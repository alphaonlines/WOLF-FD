"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const vaughanBassettPricebook_1 = require("./vaughanBassettPricebook");
(0, vitest_1.describe)("parseVaughanBassettPricebookText", () => {
    (0, vitest_1.it)("parses item rows under suite context and filters headers", () => {
        const rows = (0, vaughanBassettPricebook_1.parseVaughanBassettPricebookText)(`
PRICE LIST
FUNDAMENTALS
Suite No. 10 - Java
Suite No. 11 - Grey
Item Description Item Dimensions Price Bed Combo With rails Wt./Cu.
-002 Dresser - 6 drawers 54 x 19 x 37 520.00 178/31.
-446 Landscape Mirror 35 x 1 x 38H 100.00 34/3.4
-331 Panel Headboard, 3/3 41 1/4 x 2 x 52 140.00 295.00 42/6.8
`);
        (0, vitest_1.expect)(rows).toHaveLength(3);
        (0, vitest_1.expect)(rows.every((row) => row.sku && row.description && row.category && row.basePrice !== null)).toBe(true);
        (0, vitest_1.expect)(rows.some((row) => /PRICE LIST|Item Description/i.test(`${row.sku} ${row.description}`))).toBe(false);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "10-002")).toMatchObject({
            manufacturer: "Vaughan Bassett",
            manufacturerSlug: "vaughan-bassett",
            collectionCode: "10",
            collectionName: "FUNDAMENTALS",
            category: "Bedroom",
            description: "Dresser - 6 drawers",
            colorFinish: "Java",
            basePrice: 520,
            widthInches: 54,
            depthInches: 19,
            heightInches: 37,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "10-331")?.sourceNote).toContain("Bed combo/with rails 295");
    });
    (0, vitest_1.it)("generates stable set rows from combination/package lines", () => {
        const rows = (0, vaughanBassettPricebook_1.parseVaughanBassettPricebookText)(`
Bungalow Collection
Suite No. 740 - Folkstone (Driftwood)
Combination:
002, 226, 551, 155, 922 1079.99
Arched Bed
338-833-900 Twin $450.00
`);
        (0, vitest_1.expect)(rows).toHaveLength(2);
        (0, vitest_1.expect)(rows.find((row) => row.isSet && row.description.includes("002, 226"))).toMatchObject({
            sku: "740-SET-002-226-551-155-922-5",
            collectionCode: "740",
            collectionName: "Bungalow Collection",
            category: "Bedroom",
            basePrice: 1079.99,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "740-SET-338-833-900-TWIN-7")).toMatchObject({
            description: "338-833-900 Twin",
            basePrice: 450,
            isSet: true,
        });
    });
});
//# sourceMappingURL=vaughanBassettPricebook.test.js.map