"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUltracomfortChairRows = parseUltracomfortChairRows;
exports.parseUltracomfortAccessoryRows = parseUltracomfortAccessoryRows;
exports.parseUltracomfortWorkbookRows = parseUltracomfortWorkbookRows;
exports.parseUltracomfortWorkbook = parseUltracomfortWorkbook;
const xlsx_1 = __importDefault(require("xlsx"));
const MANUFACTURER = "UltraComfort";
const MANUFACTURER_SLUG = "ultracomfort";
const CHAIR_SHEETS = [
    "Import 1 Zone",
    "Import 1 Zone b",
    "Domestic 2 Zone",
    "Domestic 559",
    "Import 4 Zone",
    "Domestic 4 Zone",
    "Domestic 5 Zone",
    "UltraCozy Import",
];
const ACCESSORY_SHEETS = ["Accessories", "Grommet Accessories"];
function cleanText(value) {
    return String(value ?? "")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function parseMoney(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const text = cleanText(value);
    if (!text || /^N\/?A$/i.test(text) || /^N\/C$/i.test(text) || /^STD$/i.test(text))
        return null;
    const match = text.match(/\$?\s*(-?\d[\d,]*(?:\.\d+)?)/);
    if (!match)
        return null;
    const parsed = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}
function slugPart(value, maxLength = 80) {
    return cleanText(value)
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
        const text = cleanText(value);
        const key = text.toLowerCase();
        if (!text || seen.has(key))
            return;
        seen.add(key);
        out.push(text);
    });
    return out;
}
function isModelCode(value) {
    return /^UC\d{3}(?:-?[A-Z]{2,3}|[A-Z]{3})?$/i.test(cleanText(value));
}
function normalizeModelCode(value) {
    return cleanText(value)
        .toUpperCase()
        .replace(/^(UC\d{3})([A-Z]{3})$/, "$1-$2");
}
function cleanModelName(value) {
    return cleanText(value).replace(/^"+|"+$/g, "");
}
function parseDimensionValue(value, label) {
    const match = cleanText(value).match(new RegExp(`^${label}\\s*([0-9]+(?:\\.[0-9]+)?)`, "i"));
    if (!match)
        return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}
function collectBlockText(rows, rowIndex, modelCol) {
    const notes = [];
    for (let r = rowIndex + 3; r <= rowIndex + 6 && r < rows.length; r += 1) {
        for (let c = modelCol; c < Math.min((rows[r] || []).length, modelCol + 8); c += 1) {
            const text = cleanText(rows[r]?.[c]);
            if (!text || isModelCode(text))
                continue;
            if (/^H\s*\d/i.test(text) || /^W\s*\d/i.test(text) || /^D\s*\d?/i.test(text))
                continue;
            if (/^(Domestic|Import)$/i.test(text))
                continue;
            if (/^\$/.test(text) || /^\d+(?:\.\d+)?$/.test(text) || /^N\/?A$/i.test(text) || /^N\/C$/i.test(text) || /^STD$/i.test(text))
                continue;
            notes.push(text);
        }
    }
    return uniqueKeywords(notes);
}
function extractOrigin(rows, rowIndex, modelCol) {
    for (let r = rowIndex + 3; r <= rowIndex + 6 && r < rows.length; r += 1) {
        const text = cleanText(rows[r]?.[modelCol]);
        if (/^(Domestic|Import)$/i.test(text))
            return text;
    }
    return "";
}
function extractWeightCapacity(notes) {
    return notes.find((note) => /weight capacity/i.test(note)) || "";
}
function extractStandardCovers(notes) {
    const index = notes.findIndex((note) => /(standard|std|available) covers?/i.test(note));
    if (index < 0)
        return "";
    const value = notes[index];
    const next = notes[index + 1] || "";
    if (/covers?\s*:\s*$/i.test(value) && /^[A-Z]{2,4}(?:[,/ ]+[A-Z]{2,4})+$/i.test(next))
        return `${value} ${next}`;
    return value;
}
function optionNotesForBlock(rows, rowIndex, modelCol) {
    const notes = [];
    for (let r = rowIndex; r <= rowIndex + 5 && r < rows.length; r += 1) {
        for (let c = modelCol + 4; c < (rows[r] || []).length; c += 1) {
            const text = cleanText(rows[r]?.[c]);
            if (!text || /^price$/i.test(text) || /available options/i.test(text))
                continue;
            if (/^\$/.test(text) || /^\d+(?:\.\d+)?$/.test(text) || /^N\/?A$/i.test(text) || /^N\/C$/i.test(text) || /^STD$/i.test(text))
                continue;
            notes.push(text.replace(/\*+$/g, "").trim());
        }
    }
    return uniqueKeywords(notes);
}
function buildChairBlock(rows, rowIndex, modelCol, sheetName) {
    const modelCode = normalizeModelCode(cleanText(rows[rowIndex]?.[modelCol]));
    const explicitModelName = cleanModelName(cleanText(rows[rowIndex + 1]?.[modelCol]));
    const modelName = explicitModelName || (/UltraCozy/i.test(sheetName) ? modelCode : "");
    const size = cleanText(rows[rowIndex + 2]?.[modelCol]);
    if (!modelCode || !modelName || !size)
        return null;
    const hText = cleanText(rows[rowIndex + 3]?.[modelCol]);
    const wText = cleanText(rows[rowIndex + 4]?.[modelCol]);
    const dText = cleanText(rows[rowIndex + 5]?.[modelCol]);
    const notes = collectBlockText(rows, rowIndex, modelCol);
    return {
        sheetName,
        rowIndex,
        modelCode,
        modelName,
        size,
        widthInches: parseDimensionValue(wText, "W"),
        depthInches: parseDimensionValue(dText, "D"),
        heightInches: parseDimensionValue(hText, "H"),
        origin: extractOrigin(rows, rowIndex, modelCol),
        weightCapacity: extractWeightCapacity(notes),
        standardCovers: extractStandardCovers(notes),
        blockNotes: notes,
        optionNotes: optionNotesForBlock(rows, rowIndex, modelCol),
    };
}
function coverLabel(headerValue, subHeaderValue) {
    const header = cleanText(headerValue);
    const subHeader = cleanText(subHeaderValue);
    if (!header || /available options|price/i.test(header))
        return "";
    if (/^covers?$/i.test(subHeader))
        return `${header} Covers`;
    if (subHeader && !/^N\/?A$/i.test(subHeader) && !/available options|price/i.test(subHeader))
        return `${header} ${subHeader}`;
    return header;
}
function productTypeForSheet(sheetName) {
    if (/UltraCozy/i.test(sheetName)) {
        return { category: "Power Recliners", productType: "Power Recliner", collectionPrefix: "UltraCozy" };
    }
    if (/Domestic\s+559/i.test(sheetName)) {
        return { category: "Lift Chairs", productType: "2-Zone Lift Chair", collectionPrefix: "UltraComfort" };
    }
    const zoneMatch = sheetName.match(/(\d)\s*Zone/i);
    const zone = zoneMatch ? `${zoneMatch[1]}-Zone` : "Lift";
    return { category: "Lift Chairs", productType: `${zone} Lift Chair`, collectionPrefix: "UltraComfort" };
}
function dimensionsText(block) {
    const parts = [`Size ${block.size}`];
    if (block.heightInches !== null)
        parts.push(`H ${block.heightInches}"`);
    if (block.widthInches !== null)
        parts.push(`W ${block.widthInches}"`);
    if (block.depthInches !== null)
        parts.push(`D ${block.depthInches}"`);
    if (block.weightCapacity)
        parts.push(block.weightCapacity);
    return parts.join("; ");
}
function makeChairRow(block, cover, price, sourceSortOrder) {
    const type = productTypeForSheet(block.sheetName);
    const collectionName = `${type.collectionPrefix} ${block.modelName}`;
    const sku = `${block.modelCode}-${slugPart(block.size, 24)}-${slugPart(cover, 40)}`;
    const coverText = cover.replace(/\s+/g, " ").trim();
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: slugPart(collectionName, 60),
        collectionName,
        category: type.category,
        productType: type.productType,
        sku,
        description: `${block.modelName} ${type.productType} - ${block.size} - ${coverText}`,
        colorFinish: block.standardCovers,
        colorFamily: "",
        material: /leather|brisa/i.test(coverText) ? coverText : "Upholstery",
        shape: "Recliner",
        dimensionsText: dimensionsText(block),
        widthInches: block.widthInches,
        depthInches: block.depthInches,
        heightInches: block.heightInches,
        cubes: null,
        weightLbs: null,
        basePrice: price,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: coverText,
        hardwareOptions: block.optionNotes,
        cushionOptions: [],
        featureTags: uniqueKeywords([type.category, type.productType, block.sheetName, block.origin, coverText, block.weightCapacity]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([
            MANUFACTURER,
            collectionName,
            block.modelCode,
            block.modelName,
            block.size,
            coverText,
            block.standardCovers,
            ...block.optionNotes,
            ...block.blockNotes,
        ]),
        sourceNote: uniqueKeywords([`Sheet ${block.sheetName}`, block.origin, block.standardCovers, ...block.blockNotes]).join("; "),
        sourceSortOrder,
    };
}
function parseUltracomfortChairRows(rows, sheetName, sourceOffset = 0) {
    const parsedRows = [];
    rows.forEach((rawRow, index) => {
        const row = rawRow.map(cleanText);
        const modelCol = row.findIndex(isModelCode);
        if (modelCol < 0)
            return;
        const block = buildChairBlock(rows, index, modelCol, sheetName);
        if (!block)
            return;
        const headerRow = rows[index] || [];
        const subHeaderRow = rows[index + 1] || [];
        const priceRow = rows[index + 2] || [];
        for (let col = modelCol + 1; col < priceRow.length; col += 1) {
            const price = parseMoney(priceRow[col]);
            if (price === null)
                continue;
            const label = coverLabel(headerRow[col], subHeaderRow[col]);
            if (!label)
                continue;
            parsedRows.push(makeChairRow(block, label, price, sourceOffset + index * 100 + col));
        }
    });
    return parsedRows;
}
function parseEmbeddedPrice(text) {
    const match = cleanText(text).match(/^(.*?)\s*\$\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:\/\s*pair)?$/i);
    if (!match)
        return null;
    const name = cleanText(match[1]);
    const price = parseMoney(match[2]);
    if (!name || price === null)
        return null;
    return { name, price };
}
function makeAccessoryRow(name, price, sheetName, sourceSortOrder, note = "") {
    const description = `${name} - ${sheetName}`;
    return {
        manufacturer: MANUFACTURER,
        manufacturerSlug: MANUFACTURER_SLUG,
        collectionCode: "ULTRACOMFORT-ACCESSORIES",
        collectionName: "UltraComfort Accessories",
        category: "Accessories",
        productType: /grommet/i.test(sheetName) ? "Grommet Accessory" : "Lift Chair Accessory",
        sku: `UC-ACCESSORY-${slugPart(name, 70)}`,
        description,
        colorFinish: "",
        colorFamily: "",
        material: "Accessory",
        shape: "",
        dimensionsText: "",
        widthInches: null,
        depthInches: null,
        heightInches: null,
        cubes: null,
        weightLbs: null,
        basePrice: price,
        isSet: false,
        setPieceCount: null,
        isSwatch: false,
        isSample: false,
        isNewProduct: false,
        upholsteryCover: "",
        hardwareOptions: [],
        cushionOptions: [],
        featureTags: uniqueKeywords(["Accessories", sheetName, name]),
        imageUrls: [],
        searchKeywords: uniqueKeywords([MANUFACTURER, "UltraComfort Accessories", name, sheetName, note]),
        sourceNote: uniqueKeywords([`Sheet ${sheetName}`, note]).join("; "),
        sourceSortOrder,
    };
}
function parseUltracomfortAccessoryRows(rows, sheetName, sourceOffset = 0) {
    const parsedRows = [];
    const previousTextByColumn = new Map();
    rows.forEach((row, rowIndex) => {
        for (let col = 0; col < row.length; col += 1) {
            const text = cleanText(row[col]);
            if (!text)
                continue;
            const separatePrice = parseMoney(row[col + 1]);
            if (separatePrice !== null && text.length < 90 && !/^Accessories$/i.test(text)) {
                const note = cleanText(row[col + 2]);
                parsedRows.push(makeAccessoryRow(text, separatePrice, sheetName, sourceOffset + rowIndex * 100 + col, note));
                continue;
            }
            const embedded = parseEmbeddedPrice(text);
            if (embedded && embedded.name.length < 90) {
                const prior = previousTextByColumn.get(col) || "";
                const name = /^(with|non-charging)/i.test(embedded.name) && prior ? `${prior} ${embedded.name}` : embedded.name;
                parsedRows.push(makeAccessoryRow(name, embedded.price, sheetName, sourceOffset + rowIndex * 100 + col));
                continue;
            }
            if (!/\$/.test(text) && text.length < 90 && !/^\d+$/.test(text) && !/^Part Number$/i.test(text)) {
                previousTextByColumn.set(col, text);
            }
        }
    });
    const deduped = new Map();
    parsedRows.forEach((row) => {
        if (!deduped.has(row.sku))
            deduped.set(row.sku, row);
    });
    return [...deduped.values()];
}
function parseUltracomfortWorkbookRows(sheetRows) {
    const rows = [];
    CHAIR_SHEETS.forEach((sheetName, sheetIndex) => {
        const sheet = sheetRows[sheetName];
        if (sheet)
            rows.push(...parseUltracomfortChairRows(sheet, sheetName, (sheetIndex + 1) * 10000));
    });
    ACCESSORY_SHEETS.forEach((sheetName, sheetIndex) => {
        const sheet = sheetRows[sheetName];
        if (sheet)
            rows.push(...parseUltracomfortAccessoryRows(sheet, sheetName, 100000 + (sheetIndex + 1) * 10000));
    });
    return rows;
}
async function parseUltracomfortWorkbook(filePath) {
    const workbook = xlsx_1.default.readFile(filePath, { dense: true });
    const sheetRows = {};
    [...CHAIR_SHEETS, ...ACCESSORY_SHEETS].forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet)
            return;
        sheetRows[sheetName] = xlsx_1.default.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    });
    return parseUltracomfortWorkbookRows(sheetRows);
}
//# sourceMappingURL=ultracomfortPricebook.js.map