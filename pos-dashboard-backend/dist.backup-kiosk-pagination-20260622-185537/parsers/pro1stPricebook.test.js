"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pro1stPricebook_1 = require("./pro1stPricebook");
const sampleRows = [
    ["Protection Plan", "Plan Description", "Plan Code", "Coverage Time", "Coverage Limit", "Wholesale", "", "Protection 1st Rebate = 4%", "Retailer Net"],
    ["Maximum Elite Combination", "Indoor Furniture", "FFMECFR", "5 Year", "$800 - $50,000", 69.95, "", 2.798, 67.152],
    ["Power Base", "1 Adjustable Base", "FFPBM", "10 Year", 5000, 31.95, "", 1.278, 30.672],
];
(0, vitest_1.describe)("parsePro1stMontageWorkbookRows", () => {
    (0, vitest_1.it)("parses Montage protection plan pricing rows", () => {
        const rows = (0, pro1stPricebook_1.parsePro1stMontageWorkbookRows)(sampleRows);
        (0, vitest_1.expect)(rows).toHaveLength(2);
        (0, vitest_1.expect)(rows[0]).toMatchObject({
            manufacturer: "Protection 1st",
            manufacturerSlug: "pro1st",
            collectionName: "Montage Protection Plans",
            category: "Protection Plans",
            productType: "Indoor Furniture Protection Plan",
            sku: "FFMECFR",
            description: "Maximum Elite Combination - Indoor Furniture - 5 Year - $800 - $50,000",
            basePrice: 69.95,
        });
        (0, vitest_1.expect)(rows[0].sourceNote).toContain("Retailer net 67.152");
        (0, vitest_1.expect)(rows[1]).toMatchObject({
            sku: "FFPBM",
            productType: "Adjustable Base Protection Plan",
            description: "Power Base - 1 Adjustable Base - 10 Year - 5000",
            basePrice: 31.95,
        });
    });
});
//# sourceMappingURL=pro1stPricebook.test.js.map