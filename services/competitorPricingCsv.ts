import type { CompetitorPricingColumnMap, CompetitorPricingInputRow } from '../types/competitorPricing';

const ASHLEY_VENDOR_ALIASES = [
  'ashley',
  'benchcraft',
  'signature design',
  'signature design by ashley',
  'sierra sleep',
  'millennium',
];

const PRICE_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

const HEADER_ALIASES: Record<keyof CompetitorPricingColumnMap, RegExp[]> = {
  vendor: [/^vendor$/i, /^mfg$/i, /^manufacturer$/i, /^fb\d+/i, /^brand$/i],
  sku: [/sku/i, /model/i, /item\s*#?/i],
  description: [/^description$/i, /web\s*descr/i, /^desc$/i, /product\s*name/i],
  storePrice: [/sales\s*price/i, /starburst/i, /^price$/i, /store\s*price/i],
  regularPrice: [/reg\s*price/i, /regular\s*price/i],
  ahsCompPrice: [/ahs\s*comp/i],
  fflCompPrice: [/ffl/i, /other\s*comp/i, /furniture\s*4\s*less/i],
  furnitureFairCompPrice: [/furniture\s*fair\s*comp/i, /furniture\s*fair\s*price/i],
  remarks: [/remarks?/i, /notes?/i],
};

export function normalizeHeader(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim()
    .toLowerCase();
}

function firstMatchingHeader(headers: string[], key: keyof CompetitorPricingColumnMap): string | undefined {
  const patterns = HEADER_ALIASES[key];
  for (const pattern of patterns) {
    const match = headers.find((header) => pattern.test(normalizeHeader(header)));
    if (match) return match;
  }
  return undefined;
}

export function detectCompetitorPricingColumns(headers: string[]): CompetitorPricingColumnMap {
  const vendor = firstMatchingHeader(headers, 'vendor') || headers[0] || 'Vendor';
  const sku = firstMatchingHeader(headers, 'sku');
  const description = firstMatchingHeader(headers, 'description');
  const storePrice = firstMatchingHeader(headers, 'storePrice');

  if (!sku || !description || !storePrice) {
    throw new Error('Could not detect required competitor pricing columns: SKU, description, and store price are required.');
  }

  return {
    vendor,
    sku,
    description,
    storePrice,
    regularPrice: firstMatchingHeader(headers, 'regularPrice'),
    ahsCompPrice: firstMatchingHeader(headers, 'ahsCompPrice'),
    fflCompPrice: firstMatchingHeader(headers, 'fflCompPrice'),
    furnitureFairCompPrice: firstMatchingHeader(headers, 'furnitureFairCompPrice'),
    remarks: firstMatchingHeader(headers, 'remarks'),
  };
}

function priceMatches(value: string): string[] {
  return String(value || '').match(PRICE_RE) || [];
}

export function parseFirstStorePrice(value: string): string {
  return priceMatches(value)[0]?.replace(/\s+/g, '') || '';
}

function hasAshleyVendor(vendor: string): boolean {
  const normalized = String(vendor || '').toLowerCase();
  return ASHLEY_VENDOR_ALIASES.some((alias) => normalized.includes(alias));
}

function isManualReviewRow(row: Pick<CompetitorPricingInputRow, 'vendor' | 'sku' | 'storePriceText'>): boolean {
  const sku = String(row.sku || '').trim();
  const priceText = String(row.storePriceText || '').trim();
  if (!sku || !priceText || !parseFirstStorePrice(priceText)) return true;
  if (/\//.test(sku)) return true;
  if (/\b\d+\s*pc\b/i.test(`${sku} ${priceText}`)) return true;
  if (/\bset\b/i.test(`${sku} ${priceText}`)) return true;
  if (priceMatches(priceText).length > 1) return true;
  return false;
}

export function classifyPricingRow(
  row: Pick<CompetitorPricingInputRow, 'vendor' | 'sku' | 'storePriceText'>
): CompetitorPricingInputRow['bucket'] {
  if (isManualReviewRow(row)) return 'manual_review';
  return hasAshleyVendor(row.vendor) ? 'ashley' : 'non_ashley';
}

function valueAt(row: string[], headerIndex: Record<string, number>, header?: string): string {
  if (!header) return '';
  const index = headerIndex[header];
  if (index === undefined) return '';
  return String(row[index] ?? '').trim();
}

function rowNotesFor(row: Pick<CompetitorPricingInputRow, 'sku' | 'storePriceText' | 'bucket'>): string[] {
  const notes: string[] = [];
  if (!row.sku) notes.push('missing SKU/model');
  if (!parseFirstStorePrice(row.storePriceText)) notes.push('missing store price');
  if (/\//.test(row.sku)) notes.push('slash-combined SKU or multi-component row');
  if (/\b\d+\s*pc\b/i.test(`${row.sku} ${row.storePriceText}`)) notes.push('set or multi-piece row');
  if (priceMatches(row.storePriceText).length > 1) notes.push('multiple prices in store price text');
  if (row.bucket === 'manual_review' && !notes.length) notes.push('manual review required');
  return notes;
}

export function extractCompetitorPricingRows(
  rawRows: string[][],
  columnMap?: CompetitorPricingColumnMap
): CompetitorPricingInputRow[] {
  if (!rawRows.length) return [];
  const headers = rawRows[0].map((header) => String(header || '').trim());
  const map = columnMap || detectCompetitorPricingColumns(headers);
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

  return rawRows.slice(1).flatMap((row, index) => {
    const sku = valueAt(row, headerIndex, map.sku);
    const description = valueAt(row, headerIndex, map.description);
    const storePriceText = valueAt(row, headerIndex, map.storePrice);
    if (!sku && !description && !storePriceText) return [];
    if (!/\d/.test(sku)) return [];

    const draft = {
      sourceRow: index + 2,
      vendor: valueAt(row, headerIndex, map.vendor),
      sku,
      description,
      storePriceText,
      storePrice: parseFirstStorePrice(storePriceText),
      regularPrice: valueAt(row, headerIndex, map.regularPrice),
      existingAhsCompPrice: valueAt(row, headerIndex, map.ahsCompPrice),
      existingFflCompPrice: valueAt(row, headerIndex, map.fflCompPrice),
      existingFurnitureFairCompPrice: valueAt(row, headerIndex, map.furnitureFairCompPrice),
      remarks: valueAt(row, headerIndex, map.remarks),
      bucket: 'non_ashley' as CompetitorPricingInputRow['bucket'],
      rowNotes: [] as string[],
    };
    draft.bucket = classifyPricingRow(draft);
    draft.rowNotes = rowNotesFor(draft);
    return [draft];
  });
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function competitorPricingRowsToCsv(rows: CompetitorPricingInputRow[]): string {
  const headers = [
    'sourceRow',
    'bucket',
    'vendor',
    'sku',
    'description',
    'storePriceText',
    'storePrice',
    'regularPrice',
    'existingAhsCompPrice',
    'existingFflCompPrice',
    'existingFurnitureFairCompPrice',
    'remarks',
    'rowNotes',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(key === 'rowNotes' ? row.rowNotes.join('; ') : (row as any)[key])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
