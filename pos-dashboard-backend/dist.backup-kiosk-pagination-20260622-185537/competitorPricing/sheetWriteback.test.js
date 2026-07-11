"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sheetWriteback_1 = require("./sheetWriteback");
const resultRow = {
    sourceRow: 2,
    vendor: 'Albany',
    sku: '8642-61',
    description: 'Groovy Navy',
    storePriceText: '$599',
    storePrice: '$599',
    regularPrice: '$799',
    existingAhsCompPrice: '',
    existingFflCompPrice: '',
    remarks: '',
    bucket: 'non_ashley',
    rowNotes: [],
    ashley: {
        competitor: 'Ashley',
        title: 'Ashley listing',
        price: '$579.99',
        url: 'https://www.ashleyfurniture.com/p/8642-61.html',
        confidence: 'medium',
        matchedTokens: ['8642'],
        notes: [],
    },
    furniture4Less: {
        competitor: 'Furniture4LessNC',
        title: 'Groovy Navy 8642-61',
        price: '$499.99',
        url: 'https://furniture4lessnc.com/products/groovy-navy',
        confidence: 'high',
        matchedTokens: ['8642-61'],
        notes: [],
    },
    lowestReliableCompetitorPrice: '$499.99',
    storeMinusLowest: '$99.01',
    recommendation: 'you are $99.01 higher than Furniture4LessNC',
    checkedAt: '2026-06-09T00:00:00.000Z',
};
function makeFetch(headers = ['Vendor', 'SKU', 'Description', ...Array(14).fill(''), 'AHS COMP PRICE', 'FFL/ OTHER COMP PRICE']) {
    const calls = [];
    const fetchImpl = vitest_1.vi.fn(async (url, init) => {
        calls.push({ url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (url.includes('?fields=')) {
            return {
                ok: true,
                json: async () => ({
                    sheets: [{ properties: { sheetId: 123, title: 'STORE MOVES AND PRICING', gridProperties: { rowCount: 200, columnCount: 26 } } }],
                }),
                text: async () => '',
                status: 200,
                statusText: 'OK',
            };
        }
        if (url.includes('/values/') && !url.includes('batchUpdate')) {
            return {
                ok: true,
                json: async () => ({ values: [headers] }),
                text: async () => '',
                status: 200,
                statusText: 'OK',
            };
        }
        return {
            ok: true,
            json: async () => ({}),
            text: async () => '',
            status: 200,
            statusText: 'OK',
        };
    });
    return { fetchImpl, calls };
}
(0, vitest_1.describe)('sheetWriteback', () => {
    (0, vitest_1.it)('parses spreadsheet IDs from URL or raw ID', () => {
        (0, vitest_1.expect)((0, sheetWriteback_1.parseSpreadsheetId)('https://docs.google.com/spreadsheets/d/abc-123_DEF456/edit#gid=0')).toBe('abc-123_DEF456');
        (0, vitest_1.expect)((0, sheetWriteback_1.parseSpreadsheetId)('abcdefghijklmnopqrstuvwxyz123456')).toBe('abcdefghijklmnopqrstuvwxyz123456');
    });
    (0, vitest_1.it)('converts zero-based column indexes to A1 letters', () => {
        (0, vitest_1.expect)((0, sheetWriteback_1.columnLetter)(0)).toBe('A');
        (0, vitest_1.expect)((0, sheetWriteback_1.columnLetter)(25)).toBe('Z');
        (0, vitest_1.expect)((0, sheetWriteback_1.columnLetter)(26)).toBe('AA');
    });
    (0, vitest_1.it)('plans writes to both comp price columns and skips low-confidence rows in dry-run mode', async () => {
        const { fetchImpl, calls } = makeFetch();
        const lowOnly = { ...resultRow, sourceRow: 3, ashley: undefined, furniture4Less: { ...resultRow.furniture4Less, confidence: 'low' } };
        const summary = await (0, sheetWriteback_1.writeCompetitorPricingResultsToSheet)([resultRow, lowOnly], { spreadsheetIdOrUrl: 'https://docs.google.com/spreadsheets/d/sheet123/edit', sheetName: 'STORE MOVES AND PRICING', dryRun: true }, { token: 'token', fetchImpl: fetchImpl });
        (0, vitest_1.expect)(summary.updatedRows).toBe(1);
        (0, vitest_1.expect)(summary.updatedCells).toBe(2);
        (0, vitest_1.expect)(summary.columns).toEqual({ ahsCompColumn: 'R', fflCompColumn: 'S' });
        (0, vitest_1.expect)(summary.skippedRows).toEqual([{ sourceRow: 3, sku: '8642-61', reason: 'no high/medium confidence competitor price' }]);
        (0, vitest_1.expect)(calls.some((call) => call.url.includes('batchUpdate'))).toBe(false);
    });
    (0, vitest_1.it)('writes values, colors comp price cells, and adds notes through Sheets batch APIs', async () => {
        const { fetchImpl, calls } = makeFetch();
        await (0, sheetWriteback_1.writeCompetitorPricingResultsToSheet)([resultRow], { spreadsheetIdOrUrl: 'abcdefghijklmnopqrstuvwxyz123456', sheetName: 'STORE MOVES AND PRICING' }, { token: 'token', fetchImpl: fetchImpl });
        const valuesCall = calls.find((call) => call.url.endsWith('/values:batchUpdate'));
        (0, vitest_1.expect)(valuesCall?.body.data).toEqual([
            { range: "'STORE MOVES AND PRICING'!R2", values: [['$579.99']] },
            { range: "'STORE MOVES AND PRICING'!S2", values: [['$499.99']] },
        ]);
        const formatCall = calls.find((call) => call.url.endsWith(':batchUpdate') && !call.url.includes('/values:batchUpdate'));
        (0, vitest_1.expect)(formatCall?.body.requests.length).toBe(4);
        (0, vitest_1.expect)(JSON.stringify(formatCall?.body)).toContain('Competitor Pricing Workbench');
        (0, vitest_1.expect)(JSON.stringify(formatCall?.body)).toContain('backgroundColor');
    });
});
//# sourceMappingURL=sheetWriteback.test.js.map