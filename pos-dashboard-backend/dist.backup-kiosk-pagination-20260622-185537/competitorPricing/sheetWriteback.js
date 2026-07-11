"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testing = void 0;
exports.parseSpreadsheetId = parseSpreadsheetId;
exports.columnLetter = columnLetter;
exports.writeCompetitorPricingResultsToSheet = writeCompetitorPricingResultsToSheet;
const node_fs_1 = __importDefault(require("node:fs"));
const google_auth_library_1 = require("google-auth-library");
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_AHS_HEADER = 'AHS COMP PRICE';
const DEFAULT_FFL_HEADER = 'FFL/ OTHER COMP PRICE';
const UPDATED_CELL_COLOR = { red: 0.85, green: 0.94, blue: 0.83 };
const HEADER_CELL_COLOR = { red: 0.65, green: 0.82, blue: 0.58 };
function normalizeHeader(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function parseSpreadsheetId(input) {
    const value = String(input || '').trim();
    if (!value)
        throw new Error('Google Sheet URL or spreadsheet ID is required.');
    const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match)
        return match[1];
    const idOnly = value.match(/^[a-zA-Z0-9-_]{20,}$/);
    if (idOnly)
        return value;
    throw new Error('Could not parse a Google spreadsheet ID from the provided value.');
}
function columnLetter(indexZeroBased) {
    let n = indexZeroBased + 1;
    let out = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
    }
    return out;
}
function quoteSheetName(sheetName) {
    return `'${String(sheetName).replace(/'/g, "''")}'`;
}
function isReliableMatch(match) {
    return Boolean(match?.price && ['high', 'medium'].includes(match.confidence));
}
function matchNote(match, result) {
    return [
        `Competitor Pricing Workbench`,
        `SKU: ${result.sku}`,
        `Competitor: ${match.competitor}`,
        `Price: ${match.price}`,
        `Confidence: ${match.confidence}`,
        match.title ? `Title: ${match.title}` : '',
        match.url ? `URL: ${match.url}` : '',
        result.recommendation ? `Recommendation: ${result.recommendation}` : '',
        result.checkedAt ? `Checked: ${result.checkedAt}` : '',
    ].filter(Boolean).join('\n');
}
function findHeaderIndex(headers, preferredHeader, aliases) {
    const exact = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(preferredHeader));
    if (exact >= 0)
        return exact;
    return headers.findIndex((header) => aliases.some((alias) => alias.test(normalizeHeader(header))));
}
function loadServiceAccountCredentials() {
    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const rawB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
    const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let parsed = null;
    if (rawJson)
        parsed = JSON.parse(rawJson);
    else if (rawB64)
        parsed = JSON.parse(Buffer.from(rawB64, 'base64').toString('utf8'));
    else if (file)
        parsed = JSON.parse(node_fs_1.default.readFileSync(file, 'utf8'));
    if (!parsed)
        return null;
    if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Google service account credentials are missing client_email or private_key.');
    }
    return {
        client_email: String(parsed.client_email),
        private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
    };
}
async function getSheetsAccessToken() {
    if (process.env.GOOGLE_SHEETS_ACCESS_TOKEN)
        return process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
    const credentials = loadServiceAccountCredentials();
    if (!credentials) {
        throw new Error('Google Sheets write-back is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SERVICE_ACCOUNT_JSON_B64, GOOGLE_SERVICE_ACCOUNT_FILE, GOOGLE_APPLICATION_CREDENTIALS, or GOOGLE_SHEETS_ACCESS_TOKEN, and share the Sheet with that account.');
    }
    const jwt = new google_auth_library_1.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [SHEETS_SCOPE],
    });
    const authorized = await jwt.authorize();
    if (!authorized.access_token)
        throw new Error('Google Sheets authorization did not return an access token.');
    return authorized.access_token;
}
async function sheetsFetch(token, path, init = {}, fetchImpl = fetch) {
    const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {}),
        },
    });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Google Sheets API ${response.status}: ${body || response.statusText}`);
    }
    return await response.json();
}
async function getSheetProperties(spreadsheetId, requestedSheetName, token, fetchImpl) {
    const metadata = await sheetsFetch(token, `${spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`, {}, fetchImpl);
    const sheets = metadata.sheets || [];
    if (!sheets.length)
        throw new Error('Spreadsheet has no sheets.');
    const requested = requestedSheetName?.trim();
    const match = requested
        ? sheets.find((sheet) => sheet.properties.title === requested)
        : sheets[0];
    if (!match)
        throw new Error(`Sheet tab not found: ${requested}`);
    return match.properties;
}
async function readHeaders(spreadsheetId, sheetName, token, fetchImpl) {
    const range = encodeURIComponent(`${quoteSheetName(sheetName)}!1:1`);
    const response = await sheetsFetch(token, `${spreadsheetId}/values/${range}`, {}, fetchImpl);
    return (response.values?.[0] || []).map((value) => String(value || '').trim());
}
async function batchUpdate(spreadsheetId, token, requests, fetchImpl) {
    if (!requests.length)
        return;
    await sheetsFetch(token, `${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ requests }),
    }, fetchImpl);
}
async function batchValuesUpdate(spreadsheetId, token, data, fetchImpl) {
    if (!data.length)
        return;
    await sheetsFetch(token, `${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    }, fetchImpl);
}
async function ensureCompColumns(args) {
    let headers = [...args.headers];
    let ahsIndex = findHeaderIndex(headers, args.ahsHeader, [/ahs\s*comp/i]);
    let fflIndex = findHeaderIndex(headers, args.fflHeader, [/ffl/i, /other\s*comp/i, /furniture\s*4\s*less/i]);
    const headerUpdates = [];
    const reserveColumn = (header) => {
        const index = headers.length;
        headers[index] = header;
        headerUpdates.push({ range: `${quoteSheetName(args.sheet.title)}!${columnLetter(index)}1`, values: [[header]] });
        return index;
    };
    if (ahsIndex < 0)
        ahsIndex = reserveColumn(args.ahsHeader);
    if (fflIndex < 0)
        fflIndex = reserveColumn(args.fflHeader);
    const requiredColumns = Math.max(ahsIndex, fflIndex) + 1;
    const columnCount = args.sheet.gridProperties?.columnCount || headers.length || requiredColumns;
    if (!args.dryRun && requiredColumns > columnCount) {
        await batchUpdate(args.spreadsheetId, args.token, [{
                appendDimension: {
                    sheetId: args.sheet.sheetId,
                    dimension: 'COLUMNS',
                    length: requiredColumns - columnCount,
                },
            }], args.fetchImpl);
    }
    if (!args.dryRun) {
        await batchValuesUpdate(args.spreadsheetId, args.token, headerUpdates, args.fetchImpl);
    }
    return { ahsIndex, fflIndex };
}
function planCellUpdates(results, columns) {
    const updates = [];
    const skippedRows = [];
    for (const result of results) {
        let rowUpdateCount = 0;
        if (isReliableMatch(result.ashley)) {
            updates.push({
                sourceRow: result.sourceRow,
                sku: result.sku,
                columnIndex: columns.ahsIndex,
                price: result.ashley.price,
                note: matchNote(result.ashley, result),
            });
            rowUpdateCount += 1;
        }
        if (isReliableMatch(result.furniture4Less)) {
            updates.push({
                sourceRow: result.sourceRow,
                sku: result.sku,
                columnIndex: columns.fflIndex,
                price: result.furniture4Less.price,
                note: matchNote(result.furniture4Less, result),
            });
            rowUpdateCount += 1;
        }
        if (!rowUpdateCount) {
            skippedRows.push({ sourceRow: result.sourceRow, sku: result.sku, reason: 'no high/medium confidence competitor price' });
        }
    }
    return { updates, skippedRows };
}
function formatRequests(sheetId, updates, columns) {
    const headerColumns = Array.from(new Set([columns.ahsIndex, columns.fflIndex]));
    const headerRequests = headerColumns.map((columnIndex) => ({
        repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
            cell: {
                userEnteredFormat: {
                    backgroundColor: HEADER_CELL_COLOR,
                    textFormat: { bold: true },
                },
            },
            fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold',
        },
    }));
    const cellRequests = updates.map((update) => ({
        repeatCell: {
            range: {
                sheetId,
                startRowIndex: update.sourceRow - 1,
                endRowIndex: update.sourceRow,
                startColumnIndex: update.columnIndex,
                endColumnIndex: update.columnIndex + 1,
            },
            cell: {
                note: update.note,
                userEnteredFormat: { backgroundColor: UPDATED_CELL_COLOR },
            },
            fields: 'note,userEnteredFormat.backgroundColor',
        },
    }));
    return [...headerRequests, ...cellRequests];
}
async function writeCompetitorPricingResultsToSheet(results, request, context = {}) {
    if (!results.length)
        throw new Error('No competitor pricing results are available to write back.');
    const spreadsheetId = parseSpreadsheetId(request.spreadsheetIdOrUrl);
    const token = context.token || await getSheetsAccessToken();
    const fetchImpl = context.fetchImpl || fetch;
    const ahsHeader = request.ahsCompHeader || DEFAULT_AHS_HEADER;
    const fflHeader = request.fflCompHeader || DEFAULT_FFL_HEADER;
    const sheet = await getSheetProperties(spreadsheetId, request.sheetName, token, fetchImpl);
    const headers = await readHeaders(spreadsheetId, sheet.title, token, fetchImpl);
    const columns = await ensureCompColumns({
        spreadsheetId,
        sheet,
        token,
        headers,
        ahsHeader,
        fflHeader,
        dryRun: Boolean(request.dryRun),
        fetchImpl,
    });
    const { updates, skippedRows } = planCellUpdates(results, columns);
    if (!request.dryRun) {
        const valueUpdates = updates.map((update) => ({
            range: `${quoteSheetName(sheet.title)}!${columnLetter(update.columnIndex)}${update.sourceRow}`,
            values: [[update.price]],
        }));
        await batchValuesUpdate(spreadsheetId, token, valueUpdates, fetchImpl);
        await batchUpdate(spreadsheetId, token, formatRequests(sheet.sheetId, updates, columns), fetchImpl);
    }
    return {
        spreadsheetId,
        sheetName: sheet.title,
        sheetId: sheet.sheetId,
        dryRun: Boolean(request.dryRun),
        updatedRows: new Set(updates.map((update) => update.sourceRow)).size,
        updatedCells: updates.length,
        skippedRows,
        columns: {
            ahsCompColumn: columnLetter(columns.ahsIndex),
            fflCompColumn: columnLetter(columns.fflIndex),
        },
    };
}
exports.__testing = {
    findHeaderIndex,
    planCellUpdates,
    quoteSheetName,
};
//# sourceMappingURL=sheetWriteback.js.map