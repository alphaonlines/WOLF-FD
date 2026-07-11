"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLeatherItaliaPricebookText = parseLeatherItaliaPricebookText;
exports.parseLeatherItaliaPricebookPdf = parseLeatherItaliaPricebookPdf;
const MANUFACTURER = "Leather Italia";
const MANUFACTURER_SLUG = "leather-italia";
const ROW_PATTERN = /^(?:(NC ONLY|NC|CA)\s+)?([A-Z0-9][A-Z0-9-]+)\s+(.+?)\s+\$\s*([0-9,]+)\s+\$\s*([0-9,]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9]+)\s+([0-9]+)\s+(.+?)\s*$/;
function normalizeText(value) {
    return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function parseNumber(value) {
    const parsed = Number(normalizeText(value).replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
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
function toTitleCase(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}
function parseLine(line, sourceLineNumber) {
    const normalized = normalizeText(line);
    const match = normalized.match(ROW_PATTERN);
    if (!match)
        return null;
    const whsePrice = parseNumber(match[4]);
    const fobPrice = parseNumber(match[5]);
    const length = parseNumber(match[6]);
    const depth = parseNumber(match[7]);
    const height = parseNumber(match[8]);
    const cubes = parseNumber(match[9]);
    const weight = parseNumber(match[10]);
    const loadability = parseNumber(match[11]);
    if ([whsePrice, fobPrice, length, depth, height, cubes, weight, loadability].some((value) => value === null))
        return null;
    return {
        warehouseFlag: match[1] || "",
        sku: match[2],
        description: normalizeText(match[3]),
        whsePrice: whsePrice,
        fobPrice: fobPrice,
        length: length,
        depth: depth,
        height: height,
        cubes: cubes,
        weight: weight,
        loadability: loadability,
        factory: normalizeText(match[12]),
        sourceLineNumber,
    };
}
function collectionName(description) {
    const match = normalizeText(description).match(/^([A-Z0-9]+)\s+([A-Z][A-Z0-9-]+)/);
    if (!match)
        return "Leather Italia";
    return toTitleCase(`${match[1]} ${match[2]}`);
}
function detectCategory(description) {
    const value = description.toLowerCase();
    if (value.includes("sectional"))
        return "Sectionals";
    if (value.includes("ottoman"))
        return "Ottomans";
    return "Upholstery";
}
function detectProductType(description) {
    const value = description.toLowerCase();
    if (value.includes("wedge"))
        return "Wedge";
    if (value.includes("armless"))
        return "Armless Chair";
    if (value.includes("laf"))
        return "LAF Sectional Piece";
    if (value.includes("raf"))
        return "RAF Sectional Piece";
    if (value.includes("console loveseat") || value.includes("loveseat console"))
        return "Console Loveseat";
    if (value.includes("loveseat") || value.includes("love "))
        return "Loveseat";
    if (value.includes("sofa"))
        return "Sofa";
    if (value.includes("ottoman"))
        return "Ottoman";
    if (value.includes("glider recliner"))
        return "Glider Recliner";
    if (value.includes("recliner"))
        return "Recliner";
    if (value.includes("chair"))
        return "Chair";
    return "Upholstery Item";
}
function detectColorFinish(description) {
    const text = normalizeText(description);
    const knownColors = [
        "SADDLE", "GREY", "GRAY", "CAMEL", "GRANITE", "OCEAN BLUE", "MARCO", "RUSTIC BROWN", "BLUE", "BROWN", "TAUPE", "CHARCOAL", "SANDY BROWN", "CREAM", "ICE", "DESERT", "BEIGE", "LIGHT GREY", "STONE", "HIGHLAND SADDLE", "TOBACCO BROWN"
    ];
    for (const color of knownColors.sort((a, b) => b.length - a.length)) {
        if (text.toUpperCase().endsWith(color))
            return toTitleCase(color);
    }
    return "";
}
function makeRow(parsed, index) {
    const collection = collectionName(parsed.description);
    const productType = detectProductType(parsed.description);
    const category = detectCategory(parsed.description);
    const colorFinish = detectColorFinish(parsed.description);
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: slugPart(collection, 60),
        collectionName: collection,
        category,
        productType,
        sku: parsed.sku,
        description: parsed.description,
        colorFinish,
        colorFamily: colorFinish,
        material: "Leather/Upholstery",
        shape: "",
        dimensionsText: `${parsed.length}L x ${parsed.depth}D x ${parsed.height}H`,
        widthInches: parsed.length,
        depthInches: parsed.depth,
        heightInches: parsed.height,
        cubes: parsed.cubes,
        weightLbs: parsed.weight,
        basePrice: parsed.whsePrice,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: colorFinish,
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords([category, productType, parsed.factory, parsed.warehouseFlag]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, parsed.sku, parsed.description, collection, category, productType, colorFinish, parsed.factory]),
        sourceNote: uniqueKeywords([`WHSE ${parsed.whsePrice}`, `FOB ${parsed.fobPrice}`, parsed.warehouseFlag, `Factory ${parsed.factory}`, `Loadability ${parsed.loadability}`]).join("; "),
        sourceSortOrder: parsed.sourceLineNumber * 100 + index,
    };
}
function parseLeatherItaliaPricebookText(text) {
    const rows = [];
    text.replace(/\f/g, "\n").split(/\r?\n/).forEach((line, index) => {
        const parsed = parseLine(line, index + 1);
        if (parsed)
            rows.push(makeRow(parsed, rows.length));
    });
    return rows.filter((row) => row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
}
async function parseLeatherItaliaPricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    return parseLeatherItaliaPricebookText(String(result.stdout || ""));
}
//# sourceMappingURL=leatherItaliaPricebook.js.map