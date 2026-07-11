"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const crownMarkPricebook_1 = require("./crownMarkPricebook");
const requiredFieldsPresent = (row) => Boolean(row.sku && row.description && row.category && row.basePrice !== null);
(0, vitest_1.describe)("parseCrownMarkPricebookText", () => {
    (0, vitest_1.it)("parses item-only Crown Mark PDF text rows and skips the price-list header", () => {
        const rows = (0, crownMarkPricebook_1.parseCrownMarkPricebookText)(`
ITEM              CMI/CME-BASE PRICE
1216-BENCH        $                     62.50
1216S             $                     52.50
1216T-4272-BSL    $                    109.95
5-P               $                    419.95
5094-K-FB         $                     75.00
5094-K-HB         $                    179.95
5094-KQ-RAIL      $                     55.00
5094-Q-HB         $                    139.95
Q BED             $                    259.95
K BED             $                    309.95
`);
        (0, vitest_1.expect)(rows).toHaveLength(10);
        (0, vitest_1.expect)(rows.every(requiredFieldsPresent)).toBe(true);
        (0, vitest_1.expect)(rows.some((row) => /CMI\/CME|BASE PRICE|ITEM\s+CMI/i.test(`${row.sku} ${row.description}`))).toBe(false);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "1216-BENCH")).toMatchObject({
            manufacturer: "Crown Mark",
            manufacturerSlug: "crown-mark",
            collectionCode: "1216",
            collectionName: "Crown Mark 1216",
            category: "Dining",
            productType: "Bench",
            description: "1216-BENCH",
            basePrice: 62.5,
            isSet: false,
        });
        const diningPackage = rows.find((row) => row.description === "Package 5-P");
        (0, vitest_1.expect)(diningPackage).toMatchObject({
            collectionCode: "1216",
            category: "Dining",
            productType: "Dining Package",
            basePrice: 419.95,
            isSet: true,
            setPieceCount: 5,
        });
        (0, vitest_1.expect)(diningPackage?.sku).toMatch(/^CROWNMARK-1216-SET-5-P-\d+$/);
        (0, vitest_1.expect)(rows.find((row) => row.description === "Package Q BED")).toMatchObject({
            collectionCode: "5094",
            category: "Bedroom",
            productType: "Bed Package",
            basePrice: 259.95,
            isSet: true,
        });
    });
    (0, vitest_1.it)("handles package labels with spaces or plus signs and keeps generated package SKUs unique", () => {
        const rows = (0, crownMarkPricebook_1.parseCrownMarkPricebookText)(`
4201-BASE       $   107.00
4201-TOP        $   142.95
SET             $   249.95
4213-01         $   154.95
4213-02         $    87.50
1C+2E           $   329.95
B1140-1         $   415.00
B1140-K-HB      $   269.95
B1140-Q-HB      $   194.95
3-P Q D M       $   879.95
K-Q different   $   110.00
`);
        const generatedSkus = rows.filter((row) => row.sourceNote.includes("Generated SKU")).map((row) => row.sku);
        (0, vitest_1.expect)(new Set(generatedSkus).size).toBe(generatedSkus.length);
        (0, vitest_1.expect)(rows.find((row) => row.description === "Package SET")).toMatchObject({
            collectionCode: "4201",
            category: "Occasional",
            productType: "Occasional Table Set",
            isSet: true,
        });
        (0, vitest_1.expect)(rows.find((row) => row.description === "Package 1C+2E")).toMatchObject({
            collectionCode: "4213",
            isSet: true,
            setPieceCount: 3,
        });
        (0, vitest_1.expect)(rows.find((row) => row.description === "Package 3-P Q D M")).toMatchObject({
            collectionCode: "B1140",
            category: "Bedroom",
            isSet: true,
            setPieceCount: 3,
        });
        (0, vitest_1.expect)(rows.find((row) => row.description === "K-Q different")).toMatchObject({
            collectionCode: "B1140",
            category: "Bedroom",
            productType: "Price Adjustment",
            isSet: false,
            basePrice: 110,
        });
    });
    (0, vitest_1.it)("deduplicates repeated concrete item rows but keeps package totals as separate generated rows", () => {
        const rows = (0, crownMarkPricebook_1.parseCrownMarkPricebookText)(`
B1140-1         $   415.00
B1140-1         $   415.00
K BED           $   479.95
Q BED           $   369.95
`);
        (0, vitest_1.expect)(rows.filter((row) => row.sku === "B1140-1")).toHaveLength(1);
        (0, vitest_1.expect)(rows.filter((row) => row.isSet)).toHaveLength(2);
        (0, vitest_1.expect)(rows).toHaveLength(3);
    });
    (0, vitest_1.it)("classifies concrete Crown Mark SET item codes as sets without leaking SET into collection codes", () => {
        const rows = (0, crownMarkPricebook_1.parseCrownMarkPricebookText)(`
1715SET          $   309.95
1230SET-GW       $   144.95
B6830-CE-SET     $   209.95
`);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "1715SET")).toMatchObject({
            collectionCode: "1715",
            productType: "Dining Package",
            isSet: true,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "1230SET-GW")).toMatchObject({
            collectionCode: "1230",
            colorFinish: "Gray Wash",
            isSet: true,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "B6830-CE-SET")).toMatchObject({
            collectionCode: "B6830",
            category: "Bedroom",
            isSet: true,
        });
    });
});
(0, vitest_1.describe)("parseCrownMarkPricebookPdf", () => {
    (0, vitest_1.it)("extracts PDF text through pdftotext and parses Crown Mark rows", async () => {
        const rows = await (0, crownMarkPricebook_1.parseCrownMarkPricebookPdf)("/tmp/crownmark.pdf", async (file, args, options) => {
            (0, vitest_1.expect)(file).toBe("pdftotext");
            (0, vitest_1.expect)(args).toEqual(["-layout", "/tmp/crownmark.pdf", "-"]);
            (0, vitest_1.expect)(options?.timeout).toBeGreaterThanOrEqual(120000);
            return { stdout: "1216-BENCH $ 62.50\n5-P $ 419.95\n" };
        });
        (0, vitest_1.expect)(rows).toHaveLength(2);
        (0, vitest_1.expect)(rows.map((row) => row.basePrice)).toEqual([62.5, 419.95]);
    });
});
//# sourceMappingURL=crownMarkPricebook.test.js.map