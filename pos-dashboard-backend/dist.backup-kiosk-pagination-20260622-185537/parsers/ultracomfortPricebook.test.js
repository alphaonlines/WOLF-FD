"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ultracomfortPricebook_1 = require("./ultracomfortPricebook");
(0, vitest_1.describe)("parseUltracomfortChairRows", () => {
    (0, vitest_1.it)("parses lift chair cover price variants from model blocks", () => {
        const rows = [
            ["", "", "UC520", "Standard", "Custom Cut", "UltraPlush", "Available Options:", "", "Price"],
            ["", "", "\"Sol\"", "Covers", "Covers", "Brisa", "", "", ""],
            ["", "", "Med/Large", "$1,043 ", "$1,093 ", "$1,393 ", "Left Side Control", "", "N/C"],
            ["", "", "H 44\"", "Standard Covers: SAL, SCF, SDK", "", "", "Footrest Extension **", "", "$74 "],
            ["", "", "W 38\"", "Standard With Far Inrared \"HeatWave System\" ", "", "", "Far Infrared Heat System", "", "STD"],
            ["", "", "D 37\"", "Arm & Headrest Cover Can be ordered at a charge", "", "", "", "", ""],
            ["", "", "Domestic", "Weight Capacity 375lbs", "", "", "", "", ""],
        ];
        const parsed = (0, ultracomfortPricebook_1.parseUltracomfortChairRows)(rows, "Domestic 2 Zone");
        (0, vitest_1.expect)(parsed).toHaveLength(3);
        (0, vitest_1.expect)(parsed[0]).toMatchObject({
            manufacturer: "UltraComfort",
            manufacturerSlug: "ultracomfort",
            collectionName: "UltraComfort Sol",
            category: "Lift Chairs",
            productType: "2-Zone Lift Chair",
            sku: "UC520-MED-LARGE-STANDARD-COVERS",
            description: "Sol 2-Zone Lift Chair - Med/Large - Standard Covers",
            basePrice: 1043,
            widthInches: 38,
            depthInches: 37,
            heightInches: 44,
            upholsteryCover: "Standard Covers",
        });
        (0, vitest_1.expect)(parsed[0].sourceNote).toContain("Weight Capacity 375lbs");
        (0, vitest_1.expect)(parsed[0].hardwareOptions).toContain("Left Side Control");
    });
    (0, vitest_1.it)("parses UltraCozy power recliner cloth and leather prices", () => {
        const rows = [
            ["", "", "UC671", "Tucker HP Fabric", "Top Grain", "Available Options:"],
            ["", "", "", "Cloth", "Leathers", "None"],
            ["", "", "Medium", "$948 ", "$1,298 ", ""],
            ["", "", "H 46\"", "Contour Solid Foam Seat", ""],
            ["", "", "W 38.5\"", "Arm Covers & Headrest Cover Not Available", ""],
            ["", "", "D 38\"", "Pwr Headrest, Lumbar, Cup Holder, Wireless Charger,Tablet Holder", ""],
            ["", "", "Import", "Weight Capacity 375lbs", ""],
        ];
        const parsed = (0, ultracomfortPricebook_1.parseUltracomfortChairRows)(rows, "UltraCozy Import");
        (0, vitest_1.expect)(parsed).toHaveLength(2);
        (0, vitest_1.expect)(parsed[1]).toMatchObject({
            collectionName: "UltraCozy UC671",
            category: "Power Recliners",
            productType: "Power Recliner",
            sku: "UC671-MEDIUM-TOP-GRAIN-LEATHERS",
            basePrice: 1298,
            material: "Top Grain Leathers",
        });
    });
});
(0, vitest_1.describe)("parseUltracomfortAccessoryRows", () => {
    (0, vitest_1.it)("parses separate and embedded accessory prices", () => {
        const rows = [
            ["Heat & Massage 4 Motor", "$147.00 ", ""],
            ["", "LED Reading Light $32", "", "Cooling Fan $33.00"],
            ["", "Tablet / Phone Holder", "", ""],
            ["", "With Charger $32", "", ""],
        ];
        const parsed = (0, ultracomfortPricebook_1.parseUltracomfortAccessoryRows)(rows, "Grommet Accessories");
        (0, vitest_1.expect)(parsed.map((row) => row.sku)).toContain("UC-ACCESSORY-HEAT-AND-MASSAGE-4-MOTOR");
        (0, vitest_1.expect)(parsed.map((row) => row.sku)).toContain("UC-ACCESSORY-LED-READING-LIGHT");
        (0, vitest_1.expect)(parsed.map((row) => row.sku)).toContain("UC-ACCESSORY-TABLET-PHONE-HOLDER-WITH-CHARGER");
        (0, vitest_1.expect)(parsed.find((row) => row.sku === "UC-ACCESSORY-COOLING-FAN")?.basePrice).toBe(33);
    });
});
//# sourceMappingURL=ultracomfortPricebook.test.js.map