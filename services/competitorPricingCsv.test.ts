import { describe, expect, it } from 'vitest';
import {
  classifyPricingRow,
  competitorPricingRowsToCsv,
  detectCompetitorPricingColumns,
  extractCompetitorPricingRows,
  normalizeHeader,
  parseFirstStorePrice,
} from './competitorPricingCsv';

const header = [
  'fb476',
  'D',
  'CONTAINER ONLY',
  'MFG BEST SELLER',
  '',
  'WEB DESCR',
  'SKUs                                              (How to Set Up on Floor)',
  'DESCRIPTION',
  'SALES PRICE (STARBURST)',
  'FD5',
  'FD7',
  'G1',
  'CAMP',
  'BASE',
  'REMARKS',
  '335 COST',
  'WHSE COST',
  'AHS COMP PRICE',
  'FFL/ OTHER COMP PRICE',
  'FURNITURE FAIR COMP PRICE',
  'STAR BURST',
  'STARBURST PRICE',
  'STAR BURST GPM%',
  'REG PRICE',
  'GPM%',
];

describe('competitorPricingCsv', () => {
  it('normalizes noisy headers', () => {
    expect(normalizeHeader(' SKUs      (How to Set Up on Floor) ')).toBe('skus how to set up on floor');
  });

  it('detects observed STORE MOVES columns', () => {
    expect(detectCompetitorPricingColumns(header)).toEqual({
      vendor: 'fb476',
      sku: 'SKUs                                              (How to Set Up on Floor)',
      description: 'DESCRIPTION',
      storePrice: 'SALES PRICE (STARBURST)',
      regularPrice: 'REG PRICE',
      ahsCompPrice: 'AHS COMP PRICE',
      fflCompPrice: 'FFL/ OTHER COMP PRICE',
      furnitureFairCompPrice: 'FURNITURE FAIR COMP PRICE',
      remarks: 'REMARKS',
    });
  });

  it('parses the first store price from mixed text', () => {
    expect(parseFirstStorePrice('Queen Bed $1,399 K $1,599')).toBe('$1,399');
  });

  it('classifies Ashley-family rows as ashley', () => {
    expect(classifyPricingRow({ vendor: 'Ashley', sku: 'B076-280', storePriceText: '$199' })).toBe('ashley');
    expect(classifyPricingRow({ vendor: 'Benchcraft', sku: '1234-56', storePriceText: '$299' })).toBe('ashley');
  });

  it('classifies non-Ashley rows as non_ashley', () => {
    expect(classifyPricingRow({ vendor: 'Albany', sku: '8642-61', storePriceText: '$1499' })).toBe('non_ashley');
  });

  it('classifies set rows and multi-price rows as manual_review', () => {
    expect(classifyPricingRow({ vendor: 'Ashley', sku: 'B1050-31/36/46/54/57/96/92', storePriceText: '7PC Q $1,399 K $1,599' })).toBe('manual_review');
    expect(classifyPricingRow({ vendor: 'Albany', sku: '8642-61', storePriceText: 'Sofa $799 Otto $299' })).toBe('manual_review');
    expect(classifyPricingRow({ vendor: 'Albany', sku: '', storePriceText: '$799' })).toBe('manual_review');
  });

  it('extracts normalized rows while preserving sheet row numbers', () => {
    const rows = extractCompetitorPricingRows([
      header,
      ['NEW PRODUCT', '', '', 'X', 'FTD', '', 'CLEARANCE', 'BEST SELLER', 'NEWEST PRICE CHANGES'],
      ['Albany', 'SS', '', '', 'X', '', '8642-61', 'Groovy Navy', '$1,499', '', '', '', '', '', 'Need movement', '', '$714', 'N/A', 'FF $1,399', 'FAIR $1,299', '', '', '', '$1,799'],
      ['Ashley', 'S', '', '', 'X', '', 'B076-280', 'Trentlore', 'Twin Metal DayBed $199', '', '', '', '', '', "DISCO'D", '', '$100', 'N/A', 'N/A', 'N/A', '', '', '', '$299'],
      ['Ashley', 'SS', '', '', 'REGULAR PRICE', '', 'B1050-31/36/46/54/57/96/92', 'Hyana', '7PC Q $1,399 K $1,599', '', '', '', '', '', 'Matches B200 BR', '', '$900', '$1,996', '$1,056', '$1,049', '', '', '', '$1,599'],
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ sourceRow: 3, vendor: 'Albany', sku: '8642-61', bucket: 'non_ashley', storePrice: '$1,499', existingFurnitureFairCompPrice: 'FAIR $1,299' });
    expect(rows[1]).toMatchObject({ sourceRow: 4, vendor: 'Ashley', sku: 'B076-280', bucket: 'ashley', storePrice: '$199' });
    expect(rows[2].bucket).toBe('manual_review');
    expect(rows[2].rowNotes.join(' ')).toMatch(/slash-combined|multiple prices|set/i);
  });

  it('exports normalized rows as CSV', () => {
    const rows = extractCompetitorPricingRows([
      header,
      ['Albany', 'SS', '', '', 'X', '', '8642-61', 'Groovy Navy', '$1,499', '', '', '', '', '', 'Need, movement', '', '$714', 'N/A', 'FF $1,399', 'FAIR $1,299', '', '', '', '$1,799'],
    ]);
    const csv = competitorPricingRowsToCsv(rows);
    expect(csv).toContain('sourceRow,bucket,vendor,sku');
    expect(csv).toContain('8642-61');
    expect(csv).toContain('"Need, movement"');
  });
});
