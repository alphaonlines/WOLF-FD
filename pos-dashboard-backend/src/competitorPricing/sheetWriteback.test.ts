import { describe, expect, it, vi } from 'vitest';
import { columnLetter, parseSpreadsheetId, writeCompetitorPricingResultsToSheet } from './sheetWriteback';
import type { CompetitorPricingResultRow } from './types';

const resultRow: CompetitorPricingResultRow = {
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
  furnitureFair: {
    competitor: 'FurnitureFairNC',
    title: 'Groovy Navy 8642-61',
    price: '$479.99',
    url: 'https://furniture-fair.net/products/groovy-navy-8642-61',
    confidence: 'high',
    matchedTokens: ['8642-61'],
    notes: [],
  },
  lowestReliableCompetitorPrice: '$499.99',
  storeMinusLowest: '$99.01',
  recommendation: 'you are $99.01 higher than Furniture4LessNC',
  checkedAt: '2026-06-09T00:00:00.000Z',
};

function makeFetch(headers = ['Vendor', 'SKU', 'Description', ...Array(14).fill(''), 'AHS COMP PRICE', 'FFL/ OTHER COMP PRICE', 'FURNITURE FAIR COMP PRICE']) {
  const calls: Array<{ url: string; init?: RequestInit; body?: any }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
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
      } as any;
    }
    if (url.includes('/values/') && !url.includes('batchUpdate')) {
      return {
        ok: true,
        json: async () => ({ values: [headers] }),
        text: async () => '',
        status: 200,
        statusText: 'OK',
      } as any;
    }
    return {
      ok: true,
      json: async () => ({}),
      text: async () => '',
      status: 200,
      statusText: 'OK',
    } as any;
  });
  return { fetchImpl, calls };
}

describe('sheetWriteback', () => {
  it('parses spreadsheet IDs from URL or raw ID', () => {
    expect(parseSpreadsheetId('https://docs.google.com/spreadsheets/d/abc-123_DEF456/edit#gid=0')).toBe('abc-123_DEF456');
    expect(parseSpreadsheetId('abcdefghijklmnopqrstuvwxyz123456')).toBe('abcdefghijklmnopqrstuvwxyz123456');
  });

  it('converts zero-based column indexes to A1 letters', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
  });

  it('plans writes to all three comp price columns and skips low-confidence rows in dry-run mode', async () => {
    const { fetchImpl, calls } = makeFetch();
    const lowOnly = { ...resultRow, sourceRow: 3, ashley: undefined, furnitureFair: undefined, furniture4Less: { ...resultRow.furniture4Less!, confidence: 'low' as const } };

    const summary = await writeCompetitorPricingResultsToSheet(
      [resultRow, lowOnly],
      { spreadsheetIdOrUrl: 'https://docs.google.com/spreadsheets/d/sheet123/edit', sheetName: 'STORE MOVES AND PRICING', dryRun: true },
      { token: 'token', fetchImpl: fetchImpl as any }
    );

    expect(summary.updatedRows).toBe(1);
    expect(summary.updatedCells).toBe(3);
    expect(summary.columns).toEqual({ ahsCompColumn: 'R', fflCompColumn: 'S', furnitureFairCompColumn: 'T' });
    expect(summary.skippedRows).toEqual([{ sourceRow: 3, sku: '8642-61', reason: 'no high/medium confidence competitor price' }]);
    expect(calls.some((call) => call.url.includes('batchUpdate'))).toBe(false);
  });

  it('writes values, colors comp price cells, and adds notes through Sheets batch APIs', async () => {
    const { fetchImpl, calls } = makeFetch();

    await writeCompetitorPricingResultsToSheet(
      [resultRow],
      { spreadsheetIdOrUrl: 'abcdefghijklmnopqrstuvwxyz123456', sheetName: 'STORE MOVES AND PRICING' },
      { token: 'token', fetchImpl: fetchImpl as any }
    );

    const valuesCall = calls.find((call) => call.url.endsWith('/values:batchUpdate'));
    expect(valuesCall?.body.data).toEqual([
      { range: "'STORE MOVES AND PRICING'!R2", values: [['$579.99']] },
      { range: "'STORE MOVES AND PRICING'!S2", values: [['$499.99']] },
      { range: "'STORE MOVES AND PRICING'!T2", values: [['$479.99']] },
    ]);

    const formatCall = calls.find((call) => call.url.endsWith(':batchUpdate') && !call.url.includes('/values:batchUpdate'));
    expect(formatCall?.body.requests.length).toBe(6);
    expect(JSON.stringify(formatCall?.body)).toContain('Competitor Pricing Workbench');
    expect(JSON.stringify(formatCall?.body)).toContain('backgroundColor');
  });
});
