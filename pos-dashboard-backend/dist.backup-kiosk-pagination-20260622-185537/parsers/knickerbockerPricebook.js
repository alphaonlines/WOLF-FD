"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildKnickerbockerPricebookRows = buildKnickerbockerPricebookRows;
exports.parseKnickerbockerPricebookPdf = parseKnickerbockerPricebookPdf;
const MANUFACTURER = "Knickerbocker";
const MANUFACTURER_SLUG = "knickerbocker";
function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function slugPart(value, maxLength = 80) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, maxLength);
}
function uniqueKeywords(values) {
    const seen = new Set();
    const out = [];
    values.forEach((value) => {
        const text = normalizeText(value);
        const key = text.toLowerCase();
        if (!text || seen.has(key))
            return;
        seen.add(key);
        out.push(text);
    });
    return out;
}
function makeRow(def, index) {
    const description = def.description || normalizeText(`${def.collectionName} ${def.size || ""} ${def.colorFinish || ""}`);
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: slugPart(def.collectionName),
        collectionName: def.collectionName,
        category: def.productType.includes("Deck") ? "Bed Support Accessories" : "Bed Support",
        productType: def.productType,
        sku: def.sku,
        description,
        colorFinish: def.colorFinish || "",
        colorFamily: def.colorFinish || "",
        material: "steel",
        shape: "",
        dimensionsText: def.size || "All Size",
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: def.basePrice,
        isSet: def.productType.includes("Deck Set"),
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords([def.productType, def.size || "", def.colorFinish || "", ...(def.featureTags || [])]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, def.collectionName, def.sku, description, def.size || "", def.colorFinish || "", def.productType]),
        sourceNote: `Knickerbocker image-only 2025 price sheet page ${def.page}`,
        sourceSortOrder: def.page * 100 + index,
    };
}
function colorRows(collectionName, productType, baseSku, size, basePrice, page) {
    return [
        { suffix: "1", color: "white" },
        { suffix: "2", color: "black" },
        { suffix: "3", color: "brown" },
        { suffix: "4", color: "gray" },
    ].map(({ suffix, color }) => ({
        collectionName,
        productType,
        sku: `${baseSku}-${suffix}`,
        size,
        colorFinish: color,
        basePrice,
        page,
    }));
}
function sourceRows() {
    const rows = [];
    const platform = "emBrace Platform 360";
    rows.push({ collectionName: platform, productType: "Platform Bed Support", sku: "8139-2", size: "Twin Size", colorFinish: "black", basePrice: 175, page: 1, featureTags: ["8 inch standard height", "12 inch extended height"] }, { collectionName: platform, productType: "Deck Set", sku: "360TWNDECKBLK", size: "Twin Size", colorFinish: "black", description: "emBrace Platform 360 Twin Deck Set black", basePrice: 75, page: 1 }, { collectionName: platform, productType: "Platform Bed Support", sku: "8154-2", size: "Full Size", colorFinish: "black", basePrice: 200, page: 1, featureTags: ["8 inch standard height", "12 inch extended height"] }, { collectionName: platform, productType: "Deck Set", sku: "360FLDECKBLK", size: "Full Size", colorFinish: "black", description: "emBrace Platform 360 Full Deck Set black", basePrice: 100, page: 1 }, { collectionName: platform, productType: "Platform Bed Support", sku: "8160-2", size: "Queen Size", colorFinish: "black", basePrice: 225, page: 1, featureTags: ["8 inch standard height", "12 inch extended height"] }, { collectionName: platform, productType: "Deck Set", sku: "360QNDECKBLK", size: "Queen Size", colorFinish: "black", description: "emBrace Platform 360 Queen Deck Set black", basePrice: 100, page: 1 }, { collectionName: platform, productType: "Platform Bed Support", sku: "8176-2", size: "King Size", colorFinish: "black", basePrice: 250, page: 1, featureTags: ["8 inch standard height", "12 inch extended height"] }, { collectionName: platform, productType: "Deck Set", sku: "360KINGDECKBLK", size: "King Size", colorFinish: "black", description: "emBrace Platform 360 King Deck Set black", basePrice: 125, page: 1 }, { collectionName: platform, productType: "Platform Bed Support", sku: "8172-2", size: "Cal King Size", colorFinish: "black", basePrice: 250, page: 1, featureTags: ["8 inch standard height", "12 inch extended height"] }, { collectionName: platform, productType: "Deck Set", sku: "360CALKNGDECKBLK", size: "Cal King Size", colorFinish: "black", description: "emBrace Platform 360 Cal King Deck Set black", basePrice: 125, page: 1 });
    const wrap = "emBrace WrapAround 360";
    rows.push(...colorRows(wrap, "WrapAround Bed Support", "4139", "Twin Size", 150, 2), ...colorRows(wrap, "WrapAround Bed Support", "4154", "Full Size", 165, 2), ...colorRows(wrap, "WrapAround Bed Support", "4160", "Queen Size", 175, 2), ...colorRows(wrap, "WrapAround Bed Support", "4176", "King Size", 200, 2), ...colorRows(wrap, "WrapAround Bed Support", "4172", "Cal King Size", 200, 2));
    const embrace = "emBrace Bed Support System";
    rows.push(...colorRows(embrace, "Bed Support System", "2139", "Twin", 135, 3), ...colorRows(embrace, "Bed Support System", "2154", "Full", 150, 3), ...colorRows(embrace, "Bed Support System", "2160", "Queen", 160, 3), ...colorRows(embrace, "Bed Support System", "2176", "King", 185, 3), ...colorRows(embrace, "Bed Support System", "2172", "Cal King", 185, 3));
    const deluxe = "Deluxe enGauge Bed Support System";
    rows.push({ collectionName: deluxe, productType: "Deluxe Bed Support", sku: "1139-2", size: "Twin Size", colorFinish: "black", basePrice: 65, page: 4, featureTags: ["double steel cross rails"] }, { collectionName: deluxe, productType: "Deluxe Bed Support", sku: "3154-2", size: "Full Size", colorFinish: "black", basePrice: 85, page: 4, featureTags: ["double steel cross rails"] }, { collectionName: deluxe, productType: "Deluxe Bed Support", sku: "3160-2", size: "Queen Size", colorFinish: "black", basePrice: 90, page: 4, featureTags: ["double steel cross rails"] }, { collectionName: deluxe, productType: "Deluxe Bed Support", sku: "3176-2", size: "King Size", colorFinish: "black", basePrice: 100, page: 4, featureTags: ["double steel cross rails"] }, { collectionName: deluxe, productType: "Deluxe Bed Support", sku: "3172-2", size: "Cal King Size", colorFinish: "black", basePrice: 100, page: 4, featureTags: ["double steel cross rails"] });
    const engauge = "enGauge Bed Support System";
    rows.push({ collectionName: engauge, productType: "Bed Support System", sku: "1139-2", size: "Twin Size", colorFinish: "black", basePrice: 65, page: 5, featureTags: ["2 inch high side rail"] }, { collectionName: engauge, productType: "Bed Support System", sku: "1154-2", size: "Full Size", colorFinish: "black", basePrice: 75, page: 5, featureTags: ["2 inch high side rail"] }, { collectionName: engauge, productType: "Bed Support System", sku: "1160-2", size: "Queen Size", colorFinish: "black", basePrice: 80, page: 5, featureTags: ["2 inch high side rail"] }, { collectionName: engauge, productType: "Bed Support System", sku: "1176-2", size: "King Size", colorFinish: "black", basePrice: 90, page: 5, featureTags: ["2 inch high side rail"] }, { collectionName: engauge, productType: "Bed Support System", sku: "1172-2", size: "Cal King Size", colorFinish: "black", basePrice: 90, page: 5, featureTags: ["2 inch high side rail"] });
    const traditional = "Traditional Under-The-Bed Support Systems";
    rows.push({ collectionName: traditional, productType: "Traditional Bed Frame", sku: "KB2007G", size: "All Size", colorFinish: "", description: "Ultra Premium 7 Leg Bed Frame - All Size", basePrice: 59.95, page: 6, featureTags: ["2 inch side rails", "all size"] }, { collectionName: traditional, productType: "Traditional Bed Frame", sku: "6078G", size: "All Size", colorFinish: "", description: "Premium 6 Leg Bed Frame - All Size", basePrice: 54.95, page: 6, featureTags: ["all size"] }, { collectionName: traditional, productType: "Traditional Bed Frame", sku: "4650G", size: "Twin/Full/Queen", colorFinish: "", description: "Bed Frame - Twin/Full/Queen", basePrice: 45.95, page: 7 }, { collectionName: traditional, productType: "Traditional Bed Frame", sku: "38G", size: "Twin/Full", colorFinish: "", description: "Bed Frame - Twin/Full", basePrice: 29.95, page: 7 });
    const bedbeam = "Bedbeam";
    rows.push({ collectionName: bedbeam, productType: "Bedbeam Support", sku: "F543", size: "Full", description: "Bedbeam 3 3 Leg - Full", basePrice: 75, page: 8 }, { collectionName: bedbeam, productType: "Bedbeam Support", sku: "Q633", size: "Queen", description: "Bedbeam 3 3 Leg - Queen", basePrice: 75, page: 8 }, { collectionName: bedbeam, productType: "Bedbeam Support", sku: "K783", size: "King", description: "Bedbeam 3 3 Leg - King", basePrice: 85, page: 8 }, { collectionName: bedbeam, productType: "Bedbeam Support", sku: "CK723", size: "Cal King", description: "Bedbeam 3 3 Leg - Cal King", basePrice: 85, page: 8 }, { collectionName: bedbeam, productType: "Bedbeam Support", sku: "BB2-456", size: "", description: "Bedbeam 2 2 Leg", basePrice: 65, page: 8 });
    return rows;
}
function buildKnickerbockerPricebookRows() {
    return sourceRows().map(makeRow);
}
async function parseKnickerbockerPricebookPdf(_filePath) {
    return buildKnickerbockerPricebookRows();
}
//# sourceMappingURL=knickerbockerPricebook.js.map