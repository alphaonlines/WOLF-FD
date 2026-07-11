"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBenchmasterPricebookText = parseBenchmasterPricebookText;
exports.parseBenchmasterPricebookPdf = parseBenchmasterPricebookPdf;
const MANUFACTURER = "BenchMaster";
const MANUFACTURER_SLUG = "benchmaster";
const SECTION_NAMES = ["Value Line", "Trend Line", "Caribbean Line", "Euro Line", "Glider", "Power Line", "Accessories"];
const PRICE_PATTERN = /\$\s*([0-9][0-9,]*(?:\.\d{2})?)\s*$/;
const SKU_PATTERN = /\b(T\d{3}A?|(?:[A-Z]?\d{4,5}[A-Z]{0,3}|\d{3,5}[A-Z]{1,3})(?:[+\/][A-Z]?\d{3,5}[A-Z]{0,3})?|[A-Z]{2,}\d{3,5}[A-Z]{0,3})\b/;
function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\*+/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function parseMoney(value) {
    const parsed = Number(normalizeText(value).replace(/[,$]/g, ""));
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
function firstColumn(rawLine) {
    const trimmed = rawLine.trim();
    const first = trimmed.split(/\s{2,}/)[0] || "";
    return normalizeText(first);
}
function lineWithoutPrice(rawLine) {
    return normalizeText(rawLine.replace(PRICE_PATTERN, "").replace(/\$\s*$/, ""));
}
function sectionHeadingFromLine(rawLine) {
    const first = firstColumn(rawLine);
    if (!first || /\$/.test(rawLine) || /\(|&Flip/i.test(first))
        return "";
    const found = SECTION_NAMES.find((section) => first === section || first.startsWith(`${section} `));
    return found || "";
}
function isFinishText(text) {
    return /^(?:,\s*)?\d+\s+(?:Chestnut|Walnut|Slate|Sliver|Silver|Light|Natural)\b/i.test(text);
}
function cleanFeatureText(text) {
    return normalizeText(text)
        .replace(/^,\s*/, "")
        .replace(/\bComing\s+[A-Za-z]+\s+\d{4}\b/gi, "")
        .replace(/^NEW\b/i, "")
        .trim();
}
function isNoiseCandidate(text) {
    const value = normalizeText(text);
    if (!value)
        return true;
    if (/\$|Unit Cost|Extended Cost|Customer|Business Name|Phone|Order Form|PO #|Total:|Toll Free|All Products|Wood Finish|Special Instruction/i.test(value))
        return true;
    if (/^(?:NEW|Fabric|Leather|Leather \/ VM|Top Grain|Glove Soft|Manual|Adj\.?|Storage Ottoman|Power Lumbar|USB|Ports|Headrest|Mechanism|Massage|Patended|Coming|Wide Seat|Table)\b/i.test(value))
        return true;
    if (/Polyester|Culp|HK\d|KM\d|Walnut #|Slate #|Mushroom|Light Grey|Steel Blue|Khaki|Cocoa|Saddle|Ocean Blue|Lt\. Grey|Taupe|Kona Brown|Iron Grey|Cream|Orange|Snow White|Pastel Blue/i.test(value))
        return true;
    if (isFinishText(value))
        return true;
    if (SECTION_NAMES.some((section) => value === section || value.startsWith(`${section} `)))
        return true;
    if (SKU_PATTERN.test(value))
        return true;
    if (/^\d+$/.test(value))
        return true;
    return false;
}
function findSku(lines, priceIndex, beforePrice) {
    if (/^Riser$/i.test(beforePrice))
        return { sku: "RISER", lineIndex: priceIndex, rest: "Riser" };
    const offsets = [0, -1, -2, 1, 2, 3, -3, -4, 4];
    for (const offset of offsets) {
        const lineIndex = priceIndex + offset;
        if (lineIndex < 0 || lineIndex >= lines.length)
            continue;
        const text = normalizeText(lines[lineIndex]);
        if (!text || /HK\d|KM\d|Culp|Unit Cost|Extended Cost|Customer|Phone|Total/i.test(text))
            continue;
        if (lineIndex === priceIndex && /Coming|Euro Line|Trend Line\(|Flip-up|Version/i.test(text))
            continue;
        const match = text.match(SKU_PATTERN);
        if (!match)
            continue;
        const sku = match[1].toUpperCase();
        if (/^HK|^KM|^TPX/i.test(sku))
            continue;
        if (/^(?:19|20)\d{2}$/.test(sku) && /Coming|Version|Date/i.test(text))
            continue;
        const rest = normalizeText(text.slice((match.index || 0) + match[0].length));
        return { sku, lineIndex, rest };
    }
    return null;
}
function findProductName(rawLines, priceIndex) {
    for (let index = priceIndex; index >= Math.max(0, priceIndex - 9); index -= 1) {
        if (/\$/.test(rawLines[index]))
            continue;
        const candidate = firstColumn(rawLines[index]);
        if (!isNoiseCandidate(candidate))
            return candidate;
    }
    return "BenchMaster Item";
}
function nearbyFinish(lines, priceIndex, beforePrice) {
    if (isFinishText(beforePrice))
        return cleanFeatureText(beforePrice);
    for (const offset of [1, -1, 2, -2, 3]) {
        const lineIndex = priceIndex + offset;
        if (lineIndex < 0 || lineIndex >= lines.length)
            continue;
        const text = normalizeText(lines[lineIndex]);
        if (isFinishText(text))
            return cleanFeatureText(text);
        const match = text.match(/\b(\d+\s+(?:Chestnut|Walnut|Slate|Sliver|Silver))\b/i);
        if (match)
            return cleanFeatureText(match[1]);
    }
    return "";
}
function detectMaterial(windowText) {
    if (/leather/i.test(windowText))
        return "Leather";
    if (/fabric|polyester|Culp/i.test(windowText))
        return "Fabric";
    return "";
}
function productTypeFor(section, description) {
    if (section === "Accessories" || /^T\d{3}|^0\d{3}|RISER/.test(description))
        return "Accessory";
    if (section === "Power Line")
        return "Power Recliner";
    if (/glide|glider/i.test(description))
        return "Glider Recliner";
    return "Recliner";
}
function makeDescription(input) {
    const { section, skuHit, productName, beforePrice, finish, lines, priceIndex } = input;
    if (section === "Accessories" || /^T\d{3}A?$/.test(skuHit.sku) || /^0\d{3}$/.test(skuHit.sku) || skuHit.sku === "RISER") {
        if (skuHit.sku === "RISER")
            return "Riser";
        const parts = [skuHit.sku, skuHit.rest];
        if (beforePrice && !PRICE_PATTERN.test(beforePrice) && !/Euro Line|Trend Line\(|Flip-up/i.test(beforePrice) && !parts.includes(beforePrice))
            parts.push(beforePrice);
        if (!skuHit.rest && priceIndex + 1 < lines.length) {
            const next = lineWithoutPrice(lines[priceIndex + 1]);
            if (next && !SKU_PATTERN.test(next) && !isNoiseCandidate(next))
                parts.push(next);
        }
        return normalizeText(parts.filter(Boolean).join(" "));
    }
    const parts = [productName];
    const skuRest = cleanFeatureText(skuHit.rest);
    if (skuRest && !isFinishText(skuRest) && !/^(?:Storage Ottoman &)?$/i.test(skuRest))
        parts.push(skuRest);
    const feature = cleanFeatureText(beforePrice);
    if (feature && !isFinishText(feature) && !/^\$?$/.test(feature) && !/^Fabric$/i.test(feature))
        parts.push(feature);
    if (finish && !parts.some((part) => part.toLowerCase().includes(finish.toLowerCase())))
        parts.push(finish);
    return uniqueKeywords(parts).join(" - ");
}
function parseBenchmasterPricebookText(text) {
    const rawLines = text.replace(/\f/g, "\n").split(/\r?\n/);
    const normalizedLines = rawLines.map(normalizeText);
    const rows = [];
    let section = "BenchMaster Warehouse Line";
    rawLines.forEach((rawLine, index) => {
        const heading = sectionHeadingFromLine(rawLine);
        if (heading)
            section = heading;
        const normalized = normalizedLines[index];
        const priceMatch = normalized.match(PRICE_PATTERN);
        if (!priceMatch || /Total:/i.test(normalized))
            return;
        const basePrice = parseMoney(priceMatch[1]);
        if (basePrice === null || basePrice <= 0)
            return;
        const beforePrice = lineWithoutPrice(rawLine);
        const skuHit = findSku(rawLines, index, beforePrice);
        if (!skuHit)
            return;
        const productName = findProductName(rawLines, index);
        const finish = nearbyFinish(rawLines, index, beforePrice);
        const windowText = normalizedLines.slice(Math.max(0, index - 8), Math.min(normalizedLines.length, index + 5)).join(" ");
        const description = makeDescription({ section, skuHit, productName, beforePrice, finish, lines: rawLines, priceIndex: index });
        if (!description || /Unit Cost|Extended Cost/i.test(description))
            return;
        const productType = productTypeFor(section, description);
        const category = productType === "Accessory" ? "Accessories" : "Motion Upholstery";
        rows.push({
            manufacturer: MANUFACTURER,
            manufacturerSlug: MANUFACTURER_SLUG,
            collectionCode: slugPart(section || "BenchMaster"),
            collectionName: section || "BenchMaster",
            category,
            productType,
            sku: skuHit.sku,
            description,
            colorFinish: finish,
            colorFamily: "",
            material: detectMaterial(windowText),
            shape: "",
            dimensionsText: "",
            widthInches: null,
            depthInches: null,
            heightInches: null,
            cubes: null,
            weightLbs: null,
            basePrice,
            isSet: false,
            setPieceCount: null,
            isSwatch: false,
            isSample: false,
            isNewProduct: /Coming|NEW/i.test(windowText),
            upholsteryCover: "",
            hardwareOptions: [],
            cushionOptions: [],
            featureTags: uniqueKeywords([section, productType, finish]),
            imageUrls: [],
            searchKeywords: uniqueKeywords([MANUFACTURER, section, skuHit.sku, description, productType, category, finish]),
            sourceNote: `BenchMaster warehouse order form line ${index + 1}`,
            sourceSortOrder: index + 1,
        });
    });
    const seen = new Set();
    return rows.filter((row) => {
        const key = row.sku.toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return Boolean(row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
    });
}
async function parseBenchmasterPricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    return parseBenchmasterPricebookText(String(result.stdout || ""));
}
//# sourceMappingURL=benchmasterPricebook.js.map