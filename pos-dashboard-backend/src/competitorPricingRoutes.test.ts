import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCompetitorPricingRoutes } from './routes/competitorPricingRoutes';
import { createCompetitorPricingJob, getCompetitorPricingJob, getCompetitorPricingResultPath, getCompetitorPricingResults, runCompetitorPricingJob } from './competitorPricing/jobs';
import { writeCompetitorPricingResultsToSheet } from './competitorPricing/sheetWriteback';

vi.mock('./competitorPricing/jobs', () => ({
  createCompetitorPricingJob: vi.fn(),
  getCompetitorPricingJob: vi.fn(),
  getCompetitorPricingResultPath: vi.fn(),
  getCompetitorPricingResults: vi.fn(),
  runCompetitorPricingJob: vi.fn(),
}));

vi.mock('./competitorPricing/sheetWriteback', () => ({
  writeCompetitorPricingResultsToSheet: vi.fn(),
}));

function app() {
  const instance = express();
  instance.use(express.json({ limit: '5mb' }));
  registerCompetitorPricingRoutes(instance);
  return instance;
}

const row = {
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
};

describe('competitorPricingRoutes', () => {
  beforeEach(() => {
    vi.mocked(createCompetitorPricingJob).mockReset();
    vi.mocked(getCompetitorPricingJob).mockReset();
    vi.mocked(getCompetitorPricingResultPath).mockReset();
    vi.mocked(getCompetitorPricingResults).mockReset();
    vi.mocked(writeCompetitorPricingResultsToSheet).mockReset();
    vi.mocked(runCompetitorPricingJob).mockReset();
  });

  it('rejects empty rows', async () => {
    const res = await request(app()).post('/api/competitor-pricing/jobs').send({ mode: 'non_ashley_first', rows: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rows/i);
  });

  it('accepts rows and returns a job id', async () => {
    vi.mocked(createCompetitorPricingJob).mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
      mode: 'non_ashley_first',
      totalRows: 1,
      processedRows: 0,
      startedAt: 'now',
    });
    const res = await request(app()).post('/api/competitor-pricing/jobs').send({ mode: 'non_ashley_first', rows: [row] });
    expect(res.status).toBe(200);
    expect(res.body.job.jobId).toBe('job-1');
    expect(runCompetitorPricingJob).toHaveBeenCalledWith('job-1', { publishLatest: true });
  });

  it('returns job status', async () => {
    vi.mocked(getCompetitorPricingJob).mockResolvedValue({
      jobId: 'job-1',
      status: 'running',
      mode: 'non_ashley_first',
      totalRows: 3,
      processedRows: 1,
      startedAt: 'now',
    });
    const res = await request(app()).get('/api/competitor-pricing/jobs/job-1');
    expect(res.status).toBe(200);
    expect(res.body.job.processedRows).toBe(1);
  });

  it('404s missing result downloads', async () => {
    vi.mocked(getCompetitorPricingResultPath).mockRejectedValue(new Error('missing'));
    const res = await request(app()).get('/api/competitor-pricing/jobs/nope/results.csv');
    expect(res.status).toBe(404);
  });

  it('writes completed job results back to Google Sheets', async () => {
    const results = [{ sourceRow: 2, sku: '8642-61' } as any];
    vi.mocked(getCompetitorPricingResults).mockResolvedValue(results);
    vi.mocked(writeCompetitorPricingResultsToSheet).mockResolvedValue({
      spreadsheetId: 'sheet-1',
      sheetName: 'STORE MOVES AND PRICING',
      sheetId: 123,
      dryRun: false,
      updatedRows: 1,
      updatedCells: 1,
      skippedRows: [],
      columns: { ahsCompColumn: 'R', fflCompColumn: 'S', furnitureFairCompColumn: 'T' },
    });

    const res = await request(app())
      .post('/api/competitor-pricing/jobs/job-1/sheet-writeback')
      .send({ spreadsheetIdOrUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit', sheetName: 'STORE MOVES AND PRICING' });

    expect(res.status).toBe(200);
    expect(res.body.writeback.updatedCells).toBe(1);
    expect(getCompetitorPricingResults).toHaveBeenCalledWith('job-1');
    expect(writeCompetitorPricingResultsToSheet).toHaveBeenCalledWith(results, {
      spreadsheetIdOrUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
      sheetName: 'STORE MOVES AND PRICING',
      dryRun: false,
    });
  });
});
