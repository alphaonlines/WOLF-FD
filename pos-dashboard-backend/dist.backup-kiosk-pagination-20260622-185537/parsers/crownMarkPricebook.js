"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCrownMarkPricebookText = parseCrownMarkPricebookText;
exports.parseCrownMarkPricebookPdf = parseCrownMarkPricebookPdf;
const MANUFACTURER = "Crown Mark";
const MANUFACTURER_SLUG = "crown-mark";
const FINISH_CODE_MAP = {
    AB: { label: "Antique Black", family: "black" },
    BK: { label: "Black", family: "black" },
    BMBL: { label: "Black Marble", family: "black" },
    BN: { label: "Brown", family: "brown" },
    BRN: { label: "Brown", family: "brown" },
    BSL: { label: "Beige Slate", family: "beige" },
    CC: { label: "Chocolate", family: "brown" },
    CG: { label: "Champagne", family: "gold" },
    CH: { label: "Chrome", family: "silver" },
    CR: { label: "Chrome", family: "silver" },
    DV: { label: "Dove", family: "gray" },
    GL: { label: "Glass", family: "clear" },
    GR: { label: "Gray", family: "gray" },
    GW: { label: "Gray Wash", family: "gray" },
    GY: { label: "Gray", family: "gray" },
    IV: { label: "Ivory", family: "white" },
    LG: { label: "Light Gray", family: "gray" },
    MBL: { label: "Marble", family: "white" },
    MV: { label: "Mauve", family: "purple" },
    NAT: { label: "Natural", family: "natural" },
    OT: { label: "Oatmeal", family: "beige" },
    PK: { label: "Pink", family: "pink" },
    PU: { label: "Purple", family: "purple" },
    PW: { label: "Pewter", family: "gray" },
    RB: { label: "Rustic Brown", family: "brown" },
    SV: { label: "Silver", family: "silver" },
    WC: { label: "Weathered Charcoal", family: "gray" },
    WG: { label: "White/Gray", family: "gray" },
    WH: { label: "White", family: "white" },
    WO: { label: "Weathered Oak", family: "brown" },
};
function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeSku(value) {
    return normalizeText(value).toUpperCase();
}
function parseMoney(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    const text = normalizeText(value);
    if (!text)
        return null;
    const cleaned = text.replace(/[,$\s]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}
function slugPart(value, maxLength = 70) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/\+/g, " PLUS ")
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
function parsePriceLine(rawLine, sourceLineNumber) {
    const line = rawLine.replace(/\f/g, "").replace(/\s+$/g, "");
    const match = line.match(/^\s*(?<item>.+?)\s+\$\s*(?<price>[0-9][0-9,]*(?:\.\d{2})?)\s*$/);
    if (!match?.groups)
        return null;
    const rawItem = normalizeText(match.groups.item);
    const basePrice = parseMoney(match.groups.price);
    if (!rawItem || basePrice === null)
        return null;
    if (/^ITEM\b|BASE PRICE|CMI\/CME/i.test(rawItem))
        return null;
    return { rawItem, basePrice, sourceLineNumber };
}
function isPackageLabel(rawItem) {
    const item = normalizeSku(rawItem);
    if (item === "SET" || item === "H/B")
        return true;
    if (/^\d+\s*-\s*P\b/.test(item))
        return true;
    if (/^\d+C\s*\+\s*\d+E$/.test(item))
        return true;
    if (/^(?:K|Q|F|T)\s+BED\b/.test(item))
        return true;
    if (/^(?:KING|QUEEN|FULL|TWIN)\s+BED\b/.test(item))
        return true;
    if (/\bBED\s+WITH\b/.test(item))
        return true;
    return false;
}
function isPriceAdjustmentLabel(rawItem) {
    return /\bdifferent\b/i.test(rawItem) || /\badjust(?:ment)?\b/i.test(rawItem);
}
function isConcreteItemCode(rawItem) {
    const item = normalizeSku(rawItem);
    if (!item || /\s/.test(item) || isPackageLabel(item) || isPriceAdjustmentLabel(item))
        return false;
    if (!/[0-9]/.test(item))
        return false;
    if (/^\d+C\+\d+E$/.test(item))
        return false;
    return /^[A-Z0-9][A-Z0-9./&+-]*$/.test(item);
}
function extractCollectionCode(rawItem) {
    const item = normalizeSku(rawItem);
    if (!isConcreteItemCode(item))
        return "";
    const bedroomMatch = item.match(/^(B\d{3,5}[A-Z]*)/);
    if (bedroomMatch)
        return bedroomMatch[1];
    const numericMatch = item.match(/^(\d{3,5})([A-Z]*)/);
    if (numericMatch) {
        const digits = numericMatch[1];
        let suffix = numericMatch[2] || "";
        if (suffix === "SET")
            suffix = "";
        if (suffix.endsWith("SET"))
            suffix = suffix.slice(0, -3);
        if (suffix === "S" || suffix === "T")
            suffix = "";
        if (suffix.length > 1 && suffix.endsWith("T"))
            suffix = suffix.slice(0, -1);
        return `${digits}${suffix}`;
    }
    const alphaNumericMatch = item.match(/^([A-Z]+\d{3,5}[A-Z]*)/);
    return alphaNumericMatch?.[1] || "";
}
function getPackageCollectionCode(rawItem, currentCollectionCode) {
    const item = normalizeSku(rawItem);
    const embedded = item.match(/(?:^|[-\s])(B?\d{3,5}[A-Z]{0,3})(?:$|[-\s])/);
    if (embedded?.[1] && !/^\d+-P$/i.test(embedded[1]))
        return embedded[1];
    return currentCollectionCode || "CROWNMARK";
}
function extractSetPieceCount(rawItem) {
    const item = normalizeSku(rawItem);
    const pieceMatch = item.match(/^(\d+)\s*-\s*P\b/);
    if (pieceMatch)
        return Number(pieceMatch[1]);
    const plusMatch = item.match(/^(\d+)C\s*\+\s*(\d+)E$/);
    if (plusMatch)
        return Number(plusMatch[1]) + Number(plusMatch[2]);
    const pcMatch = item.match(/\b(\d+)\s*PCS?\b/);
    if (pcMatch)
        return Number(pcMatch[1]);
    return null;
}
function detectCategory(rawItem, collectionCode) {
    const item = normalizeSku(rawItem);
    const collection = normalizeSku(collectionCode);
    if (/DESK/.test(item))
        return "Home Office";
    if (/^B\d/.test(collection) || /^B\d/.test(item) || /\bBED\b|HBFB|HB|FB|RAIL|POST|DECK/.test(item)) {
        return "Bedroom";
    }
    if (/SHADE|LAMP/.test(item) || /^6\d{3}/.test(collection) || /^6\d{3}/.test(item))
        return "Lighting";
    if (/^4\d{3}/.test(collection) || /^4\d{3}/.test(item) || /^\d+C\+\d+E$/.test(item) || item === "SET") {
        return "Occasional";
    }
    if (/BENCH|SERVER|\bSB\b|^\d{3,5}/.test(item) || /^\d{3,5}/.test(collection))
        return "Dining";
    return "Furniture";
}
function looksLikeDiningChair(rawItem) {
    const item = normalizeSku(rawItem);
    return /(?:^|-)S(?:-\d+)?$/.test(item) || /^\d{3,5}[A-Z]{0,3}S(?:-\d+)?$/.test(item);
}
function detectProductType(rawItem, category, isSet) {
    const item = normalizeSku(rawItem);
    if (isPriceAdjustmentLabel(item))
        return "Price Adjustment";
    if (isSet) {
        if (/\bBED\b/.test(item))
            return "Bed Package";
        if (category === "Bedroom")
            return "Bedroom Package";
        if (category === "Occasional")
            return "Occasional Table Set";
        if (category === "Dining")
            return "Dining Package";
        return "Set";
    }
    if (/BENCH/.test(item))
        return "Bench";
    if (/SERVER|(?:^|-)SB$/.test(item))
        return "Server";
    if (/DESK/.test(item))
        return "Desk";
    if (/SHADE|LAMP/.test(item))
        return "Lamp";
    if (/\bBED\b|HBFB|HB|FB|RAIL|POST|DECK/.test(item))
        return "Bed Component";
    if (/TOP|BASE|LEG|(?:^|-)T(?:-|$)|T-\d/.test(item))
        return category === "Occasional" ? "Table Component" : "Dining Table";
    if (looksLikeDiningChair(item))
        return "Dining Chair";
    if (category === "Bedroom")
        return "Bedroom Item";
    if (category === "Occasional")
        return "Occasional Item";
    if (category === "Lighting")
        return "Lighting";
    return "Furniture Item";
}
function detectColorFinish(rawItem) {
    const tokens = normalizeSku(rawItem)
        .split(/[-\s/()]+/)
        .map((token) => token.replace(/[^A-Z0-9]/g, ""))
        .filter(Boolean);
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        const finish = FINISH_CODE_MAP[token];
        if (finish)
            return { colorFinish: finish.label, colorFamily: finish.family };
    }
    return { colorFinish: "", colorFamily: "" };
}
function detectMaterial(rawItem, category) {
    const item = normalizeSku(rawItem);
    if (/GL|GLASS/.test(item))
        return "Glass";
    if (/METAL|CHROME|\bCR\b/.test(item))
        return "Metal";
    if (category === "Dining" || category === "Bedroom" || category === "Occasional" || category === "Home Office")
        return "Wood";
    return "";
}
function detectShape(rawItem) {
    const item = normalizeSku(rawItem);
    if (/\bRD\b|ROUND|\d+RD/.test(item))
        return "round";
    if (/SQUARE/.test(item))
        return "square";
    if (/RECT|\d{2,4}\d{2}/.test(item))
        return "rectangular";
    return "";
}
function makeGeneratedSku(collectionCode, rawItem, isSet, sourceLineNumber) {
    const collection = slugPart(collectionCode || "CROWNMARK", 35) || "CROWNMARK";
    const item = slugPart(rawItem, 45) || "ITEM";
    return ["CROWNMARK", collection, isSet ? "SET" : "ITEM", item, String(sourceLineNumber)].join("-");
}
function makeCatalogRow(input) {
    const category = detectCategory(input.rawItem, input.collectionCode);
    const productType = detectProductType(input.rawItem, category, input.isSet);
    const color = detectColorFinish(input.rawItem);
    const description = input.isSet && !isPriceAdjustmentLabel(input.rawItem) ? `Package ${input.rawItem}` : input.rawItem;
    const collectionName = input.collectionCode === "CROWNMARK" ? "Crown Mark" : `Crown Mark ${input.collectionCode}`;
    const featureTags = [input.isSet ? "Set" : "", input.generatedSku ? "Generated SKU" : "", productType].filter(Boolean);
    const sourceNoteParts = [
        `Crown Mark PDF line ${input.sourceLineNumber}`,
        "Item-only price list: source provides item code/label and CMI/CME base price only",
        `Raw item: ${input.rawItem}`,
        input.generatedSku ? "Generated SKU from non-unique package/label row" : "",
    ];
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: input.collectionCode,
        collectionName,
        category,
        productType,
        sku: input.sku,
        description,
        colorFinish: color.colorFinish,
        colorFamily: color.colorFamily,
        material: detectMaterial(input.rawItem, category),
        shape: detectShape(input.rawItem),
        dimensionsText: "",
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: input.basePrice,
        isSet: input.isSet,
        setPieceCount: input.setPieceCount,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags,
        imageUrls: [],
        searchKeywords: uniqueKeywords([
            MANUFACTURER,
            input.collectionCode,
            collectionName,
            input.sku,
            input.rawItem,
            description,
            category,
            productType,
            color.colorFinish,
            color.colorFamily,
        ]),
        sourceNote: sourceNoteParts.filter(Boolean).join("; "),
        sourceSortOrder: input.sourceLineNumber,
    };
}
function parseCrownMarkPricebookText(text) {
    const rows = [];
    const seenConcreteRows = new Set();
    let currentCollectionCode = "";
    text.split(/\r?\n/).forEach((rawLine, index) => {
        const sourceLineNumber = index + 1;
        const parsed = parsePriceLine(rawLine, sourceLineNumber);
        if (!parsed)
            return;
        const rawItem = parsed.rawItem;
        const concrete = isConcreteItemCode(rawItem);
        const extractedCollectionCode = concrete ? extractCollectionCode(rawItem) : "";
        if (extractedCollectionCode)
            currentCollectionCode = extractedCollectionCode;
        const isSet = isPackageLabel(rawItem) || (concrete && /SET(?:-|$)/i.test(rawItem));
        const generatedSku = !concrete;
        const collectionCode = generatedSku
            ? getPackageCollectionCode(rawItem, currentCollectionCode)
            : extractedCollectionCode || currentCollectionCode || "CROWNMARK";
        const sku = generatedSku ? makeGeneratedSku(collectionCode, rawItem, isSet, sourceLineNumber) : normalizeSku(rawItem);
        if (!generatedSku) {
            const concreteKey = `${sku}|${parsed.basePrice}`;
            if (seenConcreteRows.has(concreteKey))
                return;
            seenConcreteRows.add(concreteKey);
        }
        rows.push(makeCatalogRow({
            rawItem,
            sku,
            collectionCode,
            basePrice: parsed.basePrice,
            isSet,
            setPieceCount: isSet ? extractSetPieceCount(rawItem) : null,
            generatedSku,
            sourceLineNumber,
        }));
    });
    return rows.filter((row) => row.sku && row.description && row.category && row.basePrice !== null && row.basePrice !== undefined);
}
async function parseCrownMarkPricebookPdf(filePath, execFileAsync) {
    const result = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { timeout: 120000 });
    const text = String(result.stdout || "");
    if (!text.trim())
        throw new Error("Crown Mark parser could not extract text from PDF.");
    return parseCrownMarkPricebookText(text);
}
//# sourceMappingURL=crownMarkPricebook.js.map