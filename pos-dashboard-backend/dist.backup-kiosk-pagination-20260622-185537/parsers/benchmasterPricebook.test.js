"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const benchmasterPricebook_1 = require("./benchmasterPricebook");
const sampleText = `
            Value Line                      100 % Polyester Fabric

                         Avery
                                                 48 Chestnut                                                                         $290
                         7895A

           Trend Line                       100 % Polyester Fabric           HK001-39 Khaki              HK001-45 Cocoa            Unit Cost   Extended Cost

                     Valencia
                    7583M/7968              Manual, Adj. Headrest
                                                29 Walnut
                                                                                                                                    $415

       Accessories                           Walnut #29            Slate #47     Chestnut # 48
                                                                                                                                Unit Cost    Extended Cost

                   T030 Side Table
                                                                                                                                   $50
                 Trend Line(7581G)
`;
(0, vitest_1.describe)("parseBenchmasterPricebookText", () => {
    (0, vitest_1.it)("parses recliner and accessory price rows from the warehouse order form", () => {
        const rows = (0, benchmasterPricebook_1.parseBenchmasterPricebookText)(sampleText);
        (0, vitest_1.expect)(rows.map((row) => row.sku).sort()).toEqual(["7895A", "7583M/7968", "T030"].sort());
        (0, vitest_1.expect)(rows.find((row) => row.sku === "7895A")).toMatchObject({
            manufacturer: "BenchMaster",
            manufacturerSlug: "benchmaster",
            collectionName: "Value Line",
            category: "Motion Upholstery",
            productType: "Recliner",
            description: "Avery - 48 Chestnut",
            basePrice: 290,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "7583M/7968")).toMatchObject({
            collectionName: "Trend Line",
            description: "Valencia - Manual, Adj. Headrest - 29 Walnut",
            basePrice: 415,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "T030")).toMatchObject({
            category: "Accessories",
            productType: "Accessory",
            description: "T030 Side Table",
            basePrice: 50,
        });
    });
});
//# sourceMappingURL=benchmasterPricebook.test.js.map