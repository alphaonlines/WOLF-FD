"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const simmonsPricebook_1 = require("./simmonsPricebook");
const sampleRows = [
    ["Mattress Product", "OHM Description", "Size Description", "Wholesale ", "SRP", "UPCs", "", "Description", "", "Flat Product", "OHM Description", "Size Description", "Wholesale ", "SRP", "UPCs", "", "Description"],
    ["700812781-1010", "BR 25 L1 MED TT", "Twin", 302, 599, 889152696657, "", "", "", "700812821-5010", "BR 25 TRITON FND SD", "Twin", 90, 180, 889152692598, "", ""],
    ["", "", "", "", "", "", "", "", "", "Adjustable Product", "OHM Description", "Size Description", "Wholesale ", "UPP", "UPCs", "", "Description"],
    ["700812782-1010", "BR 25 L1 FM TT", "Twin", 339, 699, 889152693717, "", "", "", "500833019-7520", "SSB 25 BASELOGIC BRONZE", "Twin XL", 180, 279, 198167029511, "", ""],
];
(0, vitest_1.describe)("parseSimmonsRawDataRows", () => {
    (0, vitest_1.it)("parses mattress, flat foundation, and adjustable base rows", () => {
        const rows = (0, simmonsPricebook_1.parseSimmonsRawDataRows)(sampleRows);
        (0, vitest_1.expect)(rows).toHaveLength(4);
        (0, vitest_1.expect)(rows.find((row) => row.sku === "700812781-1010")).toMatchObject({
            manufacturer: "Simmons",
            manufacturerSlug: "simmons",
            collectionName: "Beautyrest Everyday",
            category: "Mattresses",
            productType: "Mattress",
            description: "BR 25 L1 MED TT - Twin",
            basePrice: 302,
            dimensionsText: "Twin",
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "700812821-5010")).toMatchObject({
            category: "Foundations",
            productType: "Flat Foundation",
            description: "BR 25 TRITON FND SD - Twin",
            basePrice: 90,
        });
        (0, vitest_1.expect)(rows.find((row) => row.sku === "500833019-7520")).toMatchObject({
            category: "Adjustable Bases",
            productType: "Adjustable Base",
            description: "SSB 25 BASELOGIC BRONZE - Twin XL",
            basePrice: 180,
        });
        (0, vitest_1.expect)(rows[0].sourceNote).toContain("SRP 599");
    });
});
//# sourceMappingURL=simmonsPricebook.test.js.map