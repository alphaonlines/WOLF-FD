import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompetitorPricingInputRow } from './types';
import { createCompetitorPricingJob, getCompetitorPricingJob, resultRowsToCsv, runCompetitorPricingJob } from './jobs';
import { lookupAshley, lookupFurniture4Less, lookupFurnitureFair } from './competitors';

vi.mock('./competitors', () => ({
  lookupAshley: vi.fn(),
  lookupFurniture4Less: vi.fn(),
  lookupFurnitureFair: vi.fn(),
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
    vi.mocked(lookupFurnitureFair).mockReset();
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
    vi.mocked(lookupFurnitureFair).mockResolvedValue({
      competitor: 'FurnitureFairNC',
      title: '',
      price: '',
      url: '',
      confidence: 'none',
      matchedTokens: [],
      notes: ['no Furniture Fair match'],
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
    expect(lookupFurnitureFair).toHaveBeenCalledTimes(1);
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

  it('includes reliable Furniture Fair prices in the lowest-price calculation', async () => {
    vi.mocked(lookupFurnitureFair).mockResolvedValueOnce({
      competitor: 'FurnitureFairNC',
      title: 'Liberty Summer House Door Dresser & Mirror',
      price: '$449.00',
      url: 'https://furniture-fair.net/products/607-br32',
      confidence: 'high',
      matchedTokens: ['607-BR32'],
      notes: [],
    });
    const job = await createCompetitorPricingJob({ rows, mode: 'non_ashley_first' });
    await runCompetitorPricingJob(job.jobId);
    const results = JSON.parse(await fs.readFile(path.join(tmpRoot, 'jobs', job.jobId, 'results.json'), 'utf8'));
    expect(results[0].furnitureFair.price).toBe('$449.00');
    expect(results[0].lowestReliableCompetitorPrice).toBe('$449.00');
    expect(results[0].storeMinusLowest).toBe('$150.00');
  });

  it('does not publish Shop-style jobs as the bulk latest results', async () => {
    const latest = path.join(tmpRoot, 'latest-results.json');
    await fs.mkdir(tmpRoot, { recursive: true });
    await fs.writeFile(latest, JSON.stringify({ generatedAt: 'old', results: [{ sku: 'BULK-OLD' }] }));
    const job = await createCompetitorPricingJob({ rows, mode: 'non_ashley_first' });

    await runCompetitorPricingJob(job.jobId);

    expect(JSON.parse(await fs.readFile(latest, 'utf8'))).toEqual({
      generatedAt: 'old',
      results: [{ sku: 'BULK-OLD' }],
    });
  });

  it('atomically publishes bulk job results when explicitly requested', async () => {
    const job = await createCompetitorPricingJob({ rows, mode: 'non_ashley_first' });

    await runCompetitorPricingJob(job.jobId, { publishLatest: true });

    const latest = JSON.parse(await fs.readFile(path.join(tmpRoot, 'latest-results.json'), 'utf8'));
    expect(latest.generatedAt).toBeTruthy();
    expect(latest.results).toHaveLength(1);
    expect(latest.results[0].sku).toBe('8642-61');
  });

  it('writes result CSV with source row, Furniture Fair, and recommendation columns', () => {
    const csv = resultRowsToCsv([{
      ...rows[0],
      furnitureFair: {
        competitor: 'FurnitureFairNC',
        title: 'Liberty Summer House Door Dresser & Mirror',
        price: '$449.00',
        url: 'https://furniture-fair.net/products/607-br32',
        confidence: 'high',
        matchedTokens: ['607-BR32'],
        notes: [],
      },
      lowestReliableCompetitorPrice: '$449.00',
      storeMinusLowest: '$150.00',
      recommendation: 'you are higher',
      checkedAt: 'now',
    }]);
    expect(csv).toContain('source_row,bucket,vendor,sku');
    expect(csv).toContain('furniture_fair_title,furniture_fair_price,furniture_fair_confidence,furniture_fair_url');
    expect(csv).toContain('Liberty Summer House Door Dresser & Mirror');
    expect(csv).toContain('you are higher');
  });
});
