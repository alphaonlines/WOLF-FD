import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompetitorPricingInputRow } from './types';
import { createCompetitorPricingJob, getCompetitorPricingJob, resultRowsToCsv, runCompetitorPricingJob } from './jobs';
import { lookupAshley, lookupFurniture4Less } from './competitors';

vi.mock('./competitors', () => ({
  lookupAshley: vi.fn(),
  lookupFurniture4Less: vi.fn(),
}));

const tmpRoot = path.join(process.cwd(), 'tmp-competitor-pricing-jobs-test');
process.env.COMPETITOR_PRICING_DATA_DIR = tmpRoot;

const rows: CompetitorPricingInputRow[] = [
  {
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
  },
  {
    sourceRow: 3,
    vendor: 'Ashley',
    sku: 'B076-280',
    description: 'Trentlore',
    storePriceText: '$199',
    storePrice: '$199',
    regularPrice: '$299',
    existingAhsCompPrice: '',
    existingFflCompPrice: '',
    remarks: '',
    bucket: 'ashley',
    rowNotes: [],
  },
  {
    sourceRow: 4,
    vendor: 'Ashley',
    sku: 'B1050-31/36',
    description: 'Hyana',
    storePriceText: '7PC $1,399 K $1,599',
    storePrice: '$1,399',
    regularPrice: '$1,599',
    existingAhsCompPrice: '',
    existingFflCompPrice: '',
    remarks: '',
    bucket: 'manual_review',
    rowNotes: ['multi-component row'],
  },
];

describe('competitorPricing jobs', () => {
  beforeEach(() => {
    vi.mocked(lookupAshley).mockReset();
    vi.mocked(lookupFurniture4Less).mockReset();
    vi.mocked(lookupFurniture4Less).mockResolvedValue({
      competitor: 'Furniture4LessNC',
      title: 'Groovy Navy sofa 8642-61',
      price: '$499.00',
      url: 'https://furniture4lessnc.com/products/groovy',
      confidence: 'high',
      matchedTokens: ['8642-61'],
      notes: [],
    });
    vi.mocked(lookupAshley).mockResolvedValue({
      competitor: 'Ashley',
      title: 'Trentlore B076-280',
      price: '$179.99',
      url: 'https://www.ashleyfurniture.com/p/trentlore/B076-280.html',
      confidence: 'high',
      matchedTokens: ['B076-280'],
      notes: [],
    });
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('non_ashley_first mode selects only non-Ashley rows', async () => {
    const job = await createCompetitorPricingJob({ rows, mode: 'non_ashley_first' });
    expect(job.totalRows).toBe(1);
    await runCompetitorPricingJob(job.jobId);
    const status = await getCompetitorPricingJob(job.jobId);
    expect(status.status).toBe('completed');
    expect(status.processedRows).toBe(1);
    expect(lookupAshley).not.toHaveBeenCalled();
    expect(lookupFurniture4Less).toHaveBeenCalledTimes(1);
  });

  it('ashley_only mode selects only Ashley rows and uses high/medium matches for lowest price', async () => {
    const job = await createCompetitorPricingJob({ rows, mode: 'ashley_only' });
    expect(job.totalRows).toBe(1);
    await runCompetitorPricingJob(job.jobId);
    const results = JSON.parse(await fs.readFile(path.join(tmpRoot, 'jobs', job.jobId, 'results.json'), 'utf8'));
    expect(results[0].lowestReliableCompetitorPrice).toBe('$179.99');
    expect(results[0].storeMinusLowest).toBe('$19.01');
  });

  it('does not use low confidence matches in lowest price calculations', async () => {
    vi.mocked(lookupFurniture4Less).mockResolvedValueOnce({
      competitor: 'Furniture4LessNC',
      title: 'Wrong product',
      price: '$1.00',
      url: 'https://furniture4lessnc.com/products/wrong',
      confidence: 'low',
      matchedTokens: [],
      notes: [],
    });
    const job = await createCompetitorPricingJob({ rows, mode: 'non_ashley_first' });
    await runCompetitorPricingJob(job.jobId);
    const results = JSON.parse(await fs.readFile(path.join(tmpRoot, 'jobs', job.jobId, 'results.json'), 'utf8'));
    expect(results[0].lowestReliableCompetitorPrice).toBe('');
    expect(results[0].recommendation).toMatch(/no reliable/i);
  });

  it('writes result CSV with source row and recommendation columns', () => {
    const csv = resultRowsToCsv([{ ...rows[0], lowestReliableCompetitorPrice: '$499.00', storeMinusLowest: '$100.00', recommendation: 'you are higher', checkedAt: 'now' }]);
    expect(csv).toContain('source_row,bucket,vendor,sku');
    expect(csv).toContain('you are higher');
  });
});
