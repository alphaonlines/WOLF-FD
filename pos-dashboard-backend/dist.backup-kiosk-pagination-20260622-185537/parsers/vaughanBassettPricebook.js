"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseVaughanBassettPricebookText = parseVaughanBassettPricebookText;
exports.parseVaughanBassettPricebookPdf = parseVaughanBassettPricebookPdf;
exports.parseVaughanBassettReferenceNotes = parseVaughanBassettReferenceNotes;
const MANUFACTURER = "Vaughan Bassett";
const MANUFACTURER_SLUG = "vaughan-bassett";
function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/[“”]/g, "\"")
        .replace(/\s+/g, " ")
        .trim();
}
function slugPart(value, maxLength = 80) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, maxLength);
}
function parseMoney(value) {
    const cleaned = normalizeText(value).replace(/[,$]/g, "").replace(/[^\d.-]/g, "");
    if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.")
        return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}
function parseMeasurementPart(value) {
    const text = normalizeText(value).replace(/[HhWwDdLl"]/g, "").trim();
    if (!text)
        return null;
    const mixed = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
        const whole = Number(mixed[1]);
        const numerator = Number(mixed[2]);
        const denominator = Number(mixed[3]);
        if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator) {
            return whole + numerator / denominator;
        }
    }
    const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fraction) {
        const numerator = Number(fraction[1]);
        const denominator = Number(fraction[2]);
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator)
            return numerator / denominator;
    }
    const parsed = Number(text.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}
function parseDimensionsFromText(text) {
    const dimensionMatch = normalizeText(text).match(/(\d+(?:\s+\d+\/\d+|\.\d+)?(?:\s*[xX]\s*\d+(?:\s+\d+\/\d+|\.\d+)?){1,3}\s*[Hh]?)/);
    if (!dimensionMatch) {
        return { dimensionsText: "", widthInches: null, depthInches: null, heightInches: null, description: normalizeText(text) };
    }
    const dimensionsText = normalizeText(dimensionMatch[1]);
    const parts = dimensionsText.split(/\s*[xX]\s*/).map(parseMeasurementPart);
    const before = normalizeText(text.slice(0, dimensionMatch.index));
    const after = normalizeText(text.slice((dimensionMatch.index || 0) + dimensionMatch[0].length));
    return {
        dimensionsText,
        widthInches: parts[0] ?? null,
        depthInches: parts[1] ?? null,
        heightInches: parts[2] ?? null,
        description: normalizeText(`${before} ${after}`),
    };
}
function detectCategory(collectionName, description) {
    const lower = `${collectionName} ${description}`.toLowerCase();
    if (/dining|table|chair|bench|server|buffet/.test(lower))
        return "Dining";
    if (/bookcase/.test(lower))
        return "Bookcases";
    if (/desk|office|file/.test(lower))
        return "Home Office";
    if (/bed|dresser|mirror|chest|night|headboard|footboard|rails|slat|wardrobe|bedroom|collection/.test(lower))
        return "Bedroom";
    return "Furniture";
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
function isNoiseLine(line) {
    return !line ||
        /^PRICE LIST$/i.test(line) ||
        /^April \d{4}$/i.test(line) ||
        /^PHONE NUMBERS/i.test(line) ||
        /^Factory:/i.test(line) ||
        /^Fax /i.test(line) ||
        /^Email Orders:/i.test(line) ||
        /^VAUGHAN-BASSETT FURNITURE COMPANY$/i.test(line) ||
        /^\d+ East Grayson/i.test(line) ||
        /^Phone:/i.test(line) ||
        /^www\./i.test(line) ||
        /^Price List Effective/i.test(line) ||
        /^Subject To Change/i.test(line) ||
        /^Item\s+Description/i.test(line) ||
        /^Warehouse\b/i.test(line) ||
        /^Terms:/i.test(line) ||
        /^Introduction Date:/i.test(line) ||
        /^Page\s+\d+/i.test(line) ||
        /^\*The Elite series/i.test(line) ||
        /^Available shipping/i.test(line) ||
        /^Collections By Warehouse/i.test(line);
}
function detectCollectionLine(line) {
    const text = normalizeText(line).replace(/^"|"$/g, "");
    if (isNoiseLine(text) || /\d+\.\d{2}/.test(text) || /^-/.test(text) || /^Suite No\./i.test(text))
        return "";
    if (/^(Combination|Combinations|Bed Combinations|Arched Bed|Mantel Bed|Upholstered Bed|P\.O\.P Sales Materials):?$/i.test(text))
        return "";
    if (/^[A-Z][A-Z0-9 &.'\-/]+$/.test(text) && text.length >= 4 && text.length <= 80)
        return text;
    if (/(Collection|Fundamentals|Bonanza|Dovetail|Bungalow|Farmhouse|Heritage|Maple Road|Custom Express|Crafted|Pure Maple|Joinery|NordHaven|Mercer Street)/i.test(text) && text.length <= 90)
        return text;
    return "";
}
function makeRow(input) {
    const category = detectCategory(input.context.collectionName, input.description);
    const sourceNoteParts = [`Vaughan Bassett PDF line ${input.sourceLineNumber}`];
    if (input.comboPrice !== null && input.comboPrice !== undefined)
        sourceNoteParts.push(`Bed combo/with rails ${input.comboPrice}`);
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: input.context.suiteCode || slugPart(input.context.collectionName, 30),
        collectionName: input.context.collectionName || "Vaughan Bassett",
        category,
        productType: input.isSet ? "Set/Package" : input.description,
        sku: input.sku,
        description: input.description,
        colorFinish: input.context.colorFinish,
        colorFamily: "",
        material: "Wood",
        shape: "",
        dimensionsText: input.dimensionsText || "",
        widthInches: input.widthInches ?? null,
        depthInches: input.depthInches ?? null,
        heightInches: input.heightInches ?? null,
        cubes: null,
        weightLbs: null,
        basePrice: input.basePrice,
        isSet: input.isSet,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: [input.isSet ? "Set" : "", input.context.colorFinish].filter(Boolean),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, input.context.collectionName, input.context.suiteCode, input.context.colorFinish, input.sku, input.description, category]),
        sourceNote: sourceNoteParts.join("; "),
        sourceSortOrder: input.sourceLineNumber,
    };
}
function parseItemLine(line, sourceLineNumber, context) {
    const itemMatch = line.match(/^\s*((?:[A-Z]{1,3}-)?-?[A-Z0-9]{2,6}[A-Z]?)\s+(.+)$/);
    if (!itemMatch)
        return null;
    const rawItem = normalizeText(itemMatch[1]).replace(/^-/, "");
    const rest = normalizeText(itemMatch[2]);
    const priceMatches = [...rest.matchAll(/\b(\d+(?:,\d{3})*\.\d{2})\b/g)];
    if (!priceMatches.length)
        return null;
    const price = parseMoney(priceMatches[0][1]);
    if (price === null || price <= 0)
        return null;
    const comboPrice = priceMatches.length > 1 ? parseMoney(priceMatches[1][1]) : null;
    const beforePrice = rest.slice(0, priceMatches[0].index).trim();
    const dims = parseDimensionsFromText(beforePrice);
    const description = dims.description || beforePrice;
    if (!description)
        return null;
    const sku = `${context.suiteCode || "VB"}-${rawItem}`.replace(/--+/g, "-");
    return makeRow({ context, sku, description, basePrice: price, ...dims, isSet: false, sourceLineNumber, comboPrice });
}
function parseSetLine(line, sourceLineNumber, context) {
    const priceMatch = line.match(/\$?\s*(\d+(?:,\d{3})*\.\d{2})\s*$/);
    if (!priceMatch)
        return null;
    const basePrice = parseMoney(priceMatch[1]);
    if (basePrice === null || basePrice <= 0)
        return null;
    const description = normalizeText(line.slice(0, priceMatch.index)).replace(/^[-–]+\s*/, "");
    if (!description || description.length < 3)
        return null;
    if (!/[A-Za-z]/.test(description) && !/\d{3}/.test(description))
        return null;
    const sku = [context.suiteCode || "VB", "SET", slugPart(description, 60), String(sourceLineNumber)].filter(Boolean).join("-");
    return makeRow({ context, sku, description, basePrice, isSet: true, sourceLineNumber });
}
function parseVaughanBassettPricebookText(text) {
    const rows = [];
    const lines = String(text || "").split(/\r?\n/);
    let currentCollection = "Vaughan Bassett";
    let currentSuiteCode = "VB";
    let currentColor = "";
    let suiteSeenForCollection = false;
    lines.forEach((rawLine, index) => {
        const sourceLineNumber = index + 1;
        const line = normalizeText(rawLine);
        if (isNoiseLine(line))
            return;
        const suiteMatch = line.match(/Suite No\.\s*([A-Z0-9]+)\s*-\s*(.+)$/i) || line.match(/^([A-Z0-9]{2,4})\s*-\s*(.+)$/);
        if (suiteMatch && !/\d+\.\d{2}/.test(line)) {
            if (!suiteSeenForCollection) {
                currentSuiteCode = suiteMatch[1].toUpperCase();
                currentColor = normalizeText(suiteMatch[2]);
                suiteSeenForCollection = true;
            }
            return;
        }
        const collection = detectCollectionLine(line);
        if (collection) {
            currentCollection = collection;
            suiteSeenForCollection = false;
            return;
        }
        const context = { collectionName: currentCollection, suiteCode: currentSuiteCode, colorFinish: currentColor };
        const itemRow = parseItemLine(line, sourceLineNumber, context);
        if (itemRow) {
            rows.push(itemRow);
            return;
        }
        const setRow = parseSetLine(line, sourceLineNumber, context);
        if (setRow)
            rows.push(setRow);
    });
    const seen = new Set();
    return rows.filter((row) => {
        if (!row.sku || !row.description || !row.category || row.basePrice === null || row.basePrice === undefined)
            return false;
        const key = `${row.sku}|${row.sourceSortOrder}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
async function parseVaughanBassettPricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    const text = String(result.stdout || "");
    if (!text.trim())
        throw new Error("Vaughan Bassett parser could not extract text from PDF.");
    return parseVaughanBassettPricebookText(text);
}
function parseVaughanBassettReferenceNotes(_buffer) {
    return [];
}
//# sourceMappingURL=vaughanBassettPricebook.js.map