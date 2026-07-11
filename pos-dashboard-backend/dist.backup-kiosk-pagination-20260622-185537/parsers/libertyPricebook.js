"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLibertyPricebookPdf = parseLibertyPricebookPdf;
exports.parseLibertyReferenceNotesFromPdf = parseLibertyReferenceNotesFromPdf;
const CATEGORY_MAP = {
    Accents: "Accents",
    Bedroom: "Bedroom",
    Dining: "Dining",
    "Home Office": "Home Office",
    "Home Entertainment": "Entertainment",
    Entertainment: "Entertainment",
    Occasional: "Occasional",
    Motion: "Motion Upholstery",
    Upholstery: "Upholstery",
    Youth: "Youth Bedroom",
    "Youth Bedroom": "Youth Bedroom",
};
const ITEM_LINE_PATTERN = /^(S\s+)?([A-Z0-9][A-Z0-9-]+)\s+(.+?)\s{2,}(W\d+(?:\.\d+)?\s+x\s+D\d+(?:\.\d+)?\s+x\s+H\d+(?:\.\d+)?)\s+([\d.]+)\s+([\d.]+)\s+\$([\d,]+\.\d{2})\s*$/i;
const SET_LINE_PATTERN = /^(?:Opt\s+)?(.+?)\s+\(([A-Z0-9-]+)\)\s+([\d.]+)\s+([\d.]+)\s+\$([\d,]+\.\d{2})\s*$/i;
function splitColumns(line) {
    return line
        .replace(/\f/g, "")
        .split(/\s{2,}/)
        .map((segment) => segment.trim())
        .filter(Boolean);
}
function normalizeLine(line) {
    return line.replace(/\f/g, "").replace(/\s+$/g, "");
}
function parseDecimal(value) {
    if (!value)
        return null;
    const normalized = String(value).replace(/,/g, "").trim();
    if (!normalized)
        return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}
function parseMoney(value) {
    if (!value)
        return null;
    return parseDecimal(String(value).replace(/\$/g, ""));
}
function parseDimensions(dimensionsText) {
    const match = dimensionsText.match(/W(\d+(?:\.\d+)?)\s+x\s+D(\d+(?:\.\d+)?)\s+x\s+H(\d+(?:\.\d+)?)/i);
    return {
        widthInches: match ? parseDecimal(match[1]) : null,
        depthInches: match ? parseDecimal(match[2]) : null,
        heightInches: match ? parseDecimal(match[3]) : null,
    };
}
function detectColorFinish(rawDescription, swatchName) {
    const explicit = rawDescription.match(/-\s*([A-Za-z][A-Za-z /&-]+)$/);
    if (explicit)
        return explicit[1].trim();
    if (/\bswatch\b/i.test(rawDescription))
        return rawDescription.replace(/\s+swatch$/i, "").trim();
    return swatchName.trim();
}
function detectColorFamily(input) {
    const value = input.toLowerCase();
    const families = [
        "white",
        "black",
        "green",
        "blue",
        "gray",
        "grey",
        "brown",
        "tan",
        "beige",
        "cream",
        "oatmeal",
        "honey",
        "navy",
        "sand",
        "coal",
        "oak",
    ];
    for (const family of families) {
        if (value.includes(family))
            return family === "grey" ? "gray" : family;
    }
    return "";
}
function detectMaterial(text) {
    const value = text.toLowerCase();
    if (value.includes("glass"))
        return "glass";
    if (value.includes("metal"))
        return "metal";
    if (value.includes("leather"))
        return "leather";
    if (value.includes("fabric") || value.includes("swatch") || value.includes("uph"))
        return "fabric";
    if (value.includes("wood") ||
        value.includes("oak") ||
        value.includes("drawer") ||
        value.includes("table") ||
        value.includes("cabinet") ||
        value.includes("bookcase") ||
        value.includes("dresser") ||
        value.includes("night stand") ||
        value.includes("nightstand") ||
        value.includes("server") ||
        value.includes("buffet") ||
        value.includes("console") ||
        value.includes("bed")) {
        return "wood";
    }
    return "";
}
function detectShape(text) {
    const value = text.toLowerCase();
    if (value.includes("round"))
        return "round";
    if (value.includes("oval"))
        return "oval";
    if (value.includes("square"))
        return "square";
    if (value.includes("rectangle") || value.includes("rectangular"))
        return "rectangular";
    return "";
}
function detectProductType(text, isSet, isSwatch) {
    const value = text.toLowerCase();
    if (isSwatch)
        return "swatch";
    if (value.includes("sectional"))
        return "sectional";
    if (value.includes("loveseat"))
        return "loveseat";
    if (value.includes("sofa"))
        return "sofa";
    if (value.includes("sleeper"))
        return "sleeper";
    if (value.includes("recliner"))
        return "recliner";
    if (value.includes("cocktail table"))
        return "cocktail table";
    if (value.includes("end table"))
        return "end table";
    if (value.includes("chair side") || value.includes("chairside"))
        return "chairside table";
    if (value.includes("sofa table"))
        return "sofa table";
    if (value.includes("console"))
        return "console";
    if (value.includes("cabinet"))
        return "cabinet";
    if (value.includes("bookcase"))
        return "bookcase";
    if (value.includes("bed"))
        return "bed";
    if (value.includes("dresser"))
        return "dresser";
    if (value.includes("chest"))
        return "chest";
    if (value.includes("night stand") || value.includes("nightstand"))
        return "nightstand";
    if (value.includes("mirror"))
        return "mirror";
    if (value.includes("bench"))
        return "bench";
    if (value.includes("server"))
        return "server";
    if (value.includes("buffet"))
        return "buffet";
    if (value.includes("desk"))
        return "desk";
    if (value.includes("bookcase"))
        return "bookcase";
    if (isSet)
        return "set";
    return "";
}
function detectHardwareOptions(text) {
    const value = text.toLowerCase();
    const matches = [];
    if (value.includes("custom hardware"))
        matches.push("custom hardware");
    if (value.includes("bronze hardware"))
        matches.push("bronze hardware");
    if (value.includes("nickel hardware"))
        matches.push("nickel hardware");
    return matches;
}
function detectCushionOptions(text) {
    const value = text.toLowerCase();
    const matches = [];
    if (value.includes("reversible cushion"))
        matches.push("reversible cushion");
    if (value.includes("attached cushion"))
        matches.push("attached cushion");
    if (value.includes("loose cushion"))
        matches.push("loose cushion");
    if (value.includes("memory foam"))
        matches.push("memory foam");
    return matches;
}
function detectFeatureTags(text, dimensionsText) {
    const value = `${text} ${dimensionsText}`.toLowerCase();
    const tags = new Set();
    [
        "round",
        "storage",
        "swivel",
        "power",
        "recliner",
        "sleeper",
        "sectional",
        "console",
        "trundle",
        "day bed",
        "bookcase",
        "tv stand",
        "set",
        "new product",
        "sample",
        "glass",
        "wood",
        "metal",
    ].forEach((tag) => {
        if (value.includes(tag))
            tags.add(tag);
    });
    return [...tags];
}
function tokenizeSearchKeywords(values) {
    const keywords = new Set();
    for (const value of values) {
        const normalized = String(value ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9" ]+/g, " ")
            .trim();
        if (!normalized)
            continue;
        keywords.add(normalized);
        normalized.split(/\s+/).forEach((token) => {
            if (token.length >= 2)
                keywords.add(token);
        });
    }
    return [...keywords];
}
function buildSearchKeywords(params) {
    const { widthInches } = params;
    const widthTokens = widthInches !== null
        ? [`${widthInches}"`, `${widthInches} inch`, `${widthInches} inches`, `w${widthInches}`]
        : [];
    return tokenizeSearchKeywords([
        params.sku,
        params.collectionCode,
        params.collectionName,
        params.category,
        params.description,
        params.colorFinish,
        params.colorFamily,
        params.material,
        params.productType,
        params.shape,
        params.dimensionsText,
        ...widthTokens,
        ...params.featureTags,
    ]);
}
function buildSourceNote(parts) {
    return parts.filter(Boolean).join(" | ");
}
async function parseLibertyPricebookPdf(absolutePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", absolutePath, "-"], { timeout: 120000 });
    const text = String(result.stdout ?? "");
    const lines = text.split(/\r?\n/);
    let currentCategory = "";
    let currentCollection = null;
    let sortOrder = 0;
    const rows = new Map();
    for (const rawLine of lines) {
        const normalized = normalizeLine(rawLine);
        const trimmed = normalized.trim();
        if (!trimmed)
            continue;
        if (trimmed.startsWith("*S=") || trimmed === "www.mylibertyfurniture.com")
            continue;
        if (trimmed === "Sku Number" || trimmed.startsWith("Sku Number ") || trimmed.startsWith("Description"))
            continue;
        if (trimmed === "Dimensions" || trimmed === "Cubes" || trimmed === "Weight" || trimmed === "Price")
            continue;
        if (CATEGORY_MAP[trimmed]) {
            currentCategory = CATEGORY_MAP[trimmed];
            currentCollection = null;
            continue;
        }
        const collectionParts = splitColumns(normalized);
        if (collectionParts.length >= 2) {
            const codeCandidate = collectionParts[0];
            const looksLikeCollectionCode = /^[A-Z0-9][A-Z0-9-]+$/.test(codeCandidate);
            const hasMetrics = /\$[\d,]+\.\d{2}/.test(trimmed) || /\bW\d+/i.test(trimmed);
            if (looksLikeCollectionCode && !hasMetrics) {
                currentCollection = {
                    code: codeCandidate,
                    name: collectionParts[1],
                    category: currentCategory,
                    isNewProduct: collectionParts.some((part) => /new product/i.test(part)),
                    swatchName: "",
                };
                continue;
            }
        }
        const itemMatch = normalized.match(ITEM_LINE_PATTERN);
        if (itemMatch && currentCollection) {
            const isSample = Boolean(itemMatch[1]);
            const sku = itemMatch[2].trim();
            const rawDescription = itemMatch[3].trim().replace(/\s+/g, " ");
            const dimensionsText = itemMatch[4].trim();
            const cubes = parseDecimal(itemMatch[5]);
            const weightLbs = parseDecimal(itemMatch[6]);
            const basePrice = parseMoney(itemMatch[7]);
            const isSwatch = /swatch$/i.test(rawDescription);
            if (isSwatch && !currentCollection.swatchName) {
                currentCollection.swatchName = rawDescription.replace(/\s+swatch$/i, "").trim();
            }
            const colorFinish = detectColorFinish(rawDescription, currentCollection.swatchName);
            const colorFamily = detectColorFamily(colorFinish || rawDescription);
            const material = detectMaterial(`${rawDescription} ${currentCollection.category}`);
            const shape = detectShape(rawDescription);
            const productType = detectProductType(rawDescription, false, isSwatch);
            const { widthInches, depthInches, heightInches } = parseDimensions(dimensionsText);
            const featureTags = detectFeatureTags(`${rawDescription} ${currentCollection.isNewProduct ? "new product" : ""} ${isSample ? "sample" : ""}`, dimensionsText);
            const hardwareOptions = detectHardwareOptions(rawDescription);
            const cushionOptions = detectCushionOptions(rawDescription);
            const searchKeywords = buildSearchKeywords({
                sku,
                collectionCode: currentCollection.code,
                collectionName: currentCollection.name,
                category: currentCollection.category,
                description: rawDescription,
                colorFinish,
                colorFamily,
                material,
                productType,
                shape,
                dimensionsText,
                widthInches,
                featureTags,
            });
            const key = [
                currentCollection.code,
                sku,
                rawDescription.toLowerCase(),
                isSwatch ? "swatch" : "item",
                isSample ? "sample" : "stock",
            ].join("|");
            if (!rows.has(key)) {
                rows.set(key, {
                    manufacturer: "Liberty",
                    manufacturerSlug: "liberty",
                    collectionCode: currentCollection.code,
                    collectionName: currentCollection.name,
                    category: currentCollection.category || "Uncategorized",
                    productType,
                    sku,
                    description: rawDescription,
                    colorFinish,
                    colorFamily,
                    material,
                    shape,
                    dimensionsText,
                    widthInches,
                    depthInches,
                    heightInches,
                    cubes,
                    weightLbs,
                    basePrice,
                    isSet: false,
                    setPieceCount: null,
                    isSwatch,
                    isSample,
                    isNewProduct: currentCollection.isNewProduct,
                    upholsteryCover: isSwatch ? rawDescription.replace(/\s+swatch$/i, "").trim() : currentCollection.swatchName,
                    hardwareOptions,
                    cushionOptions,
                    featureTags,
                    searchKeywords,
                    imageUrls: [],
                    sourceNote: buildSourceNote([
                        `Collection ${currentCollection.name}`,
                        currentCollection.category,
                        dimensionsText,
                        isSample ? "Sample item" : "",
                        currentCollection.isNewProduct ? "New product" : "",
                    ]),
                    sourceSortOrder: ++sortOrder,
                });
            }
            continue;
        }
        const setMatch = normalized.match(SET_LINE_PATTERN);
        if (setMatch && currentCollection) {
            const rawDescription = setMatch[1].trim().replace(/\s+/g, " ");
            const sku = setMatch[2].trim();
            const cubes = parseDecimal(setMatch[3]);
            const weightLbs = parseDecimal(setMatch[4]);
            const basePrice = parseMoney(setMatch[5]);
            const pieceCountMatch = rawDescription.match(/(\d+)\s+Piece/i);
            const setPieceCount = pieceCountMatch ? Number(pieceCountMatch[1]) : null;
            const productType = detectProductType(rawDescription, true, false);
            const featureTags = detectFeatureTags(rawDescription, "");
            const colorFinish = currentCollection.swatchName;
            const colorFamily = detectColorFamily(colorFinish);
            const material = detectMaterial(`${rawDescription} ${currentCollection.category}`);
            const shape = detectShape(rawDescription);
            const searchKeywords = buildSearchKeywords({
                sku,
                collectionCode: currentCollection.code,
                collectionName: currentCollection.name,
                category: currentCollection.category,
                description: rawDescription,
                colorFinish,
                colorFamily,
                material,
                productType,
                shape,
                dimensionsText: "",
                widthInches: null,
                featureTags,
            });
            const key = [currentCollection.code, sku, rawDescription.toLowerCase(), "set"].join("|");
            if (!rows.has(key)) {
                rows.set(key, {
                    manufacturer: "Liberty",
                    manufacturerSlug: "liberty",
                    collectionCode: currentCollection.code,
                    collectionName: currentCollection.name,
                    category: currentCollection.category || "Uncategorized",
                    productType,
                    sku,
                    description: rawDescription,
                    colorFinish,
                    colorFamily,
                    material,
                    shape,
                    dimensionsText: "",
                    widthInches: null,
                    depthInches: null,
                    heightInches: null,
                    cubes,
                    weightLbs,
                    basePrice,
                    isSet: true,
                    setPieceCount,
                    isSwatch: false,
                    isSample: false,
                    isNewProduct: currentCollection.isNewProduct,
                    upholsteryCover: currentCollection.swatchName,
                    hardwareOptions: [],
                    cushionOptions: [],
                    featureTags,
                    searchKeywords,
                    imageUrls: [],
                    sourceNote: buildSourceNote([
                        `Collection ${currentCollection.name}`,
                        currentCollection.category,
                        "Set bundle",
                    ]),
                    sourceSortOrder: ++sortOrder,
                });
            }
        }
    }
    return [...rows.values()].sort((left, right) => left.sourceSortOrder - right.sourceSortOrder);
}
async function parseLibertyReferenceNotesFromPdf(absolutePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", [absolutePath, "-"], { timeout: 120000 });
    const text = String(result.stdout ?? "");
    const notes = [];
    const pushNote = (noteType, title, content) => {
        const normalized = content.replace(/\f/g, " ").replace(/\s+/g, " ").trim();
        if (!normalized)
            return;
        notes.push({
            manufacturer: "Liberty",
            manufacturerSlug: "liberty",
            noteType,
            title,
            content: normalized,
            sourceSortOrder: notes.length + 1,
        });
    };
    const returnPolicyMatch = text.match(/Return Authorization Policy([\s\S]*?)Website Information:/i);
    if (returnPolicyMatch) {
        pushNote("return_policy", "Return Authorization Policy", returnPolicyMatch[1]);
        const warrantyMatch = returnPolicyMatch[1].match(/Manufacturers warranty is one year from the date of invoice[\s\S]*?(?=\d\)|$)/i);
        if (warrantyMatch) {
            pushNote("warranty", "Warranty Summary", warrantyMatch[0]);
        }
        const freightMatch = returnPolicyMatch[1].match(/Freight Damage:[\s\S]*?(?=\d\)|$)/i);
        if (freightMatch) {
            pushNote("freight_policy", "Freight Damage Guidance", freightMatch[0]);
        }
    }
    const websiteMatch = text.match(/Website Information:([\s\S]*?)\*S= Sample Item/i);
    if (websiteMatch) {
        pushNote("website_info", "Website Information", websiteMatch[1]);
    }
    return notes;
}
//# sourceMappingURL=libertyPricebook.js.map