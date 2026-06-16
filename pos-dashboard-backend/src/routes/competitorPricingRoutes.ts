import type { Express, Request, Response } from 'express';
import {
  createCompetitorPricingJob,
  getCompetitorPricingJob,
  getCompetitorPricingResultPath,
  getCompetitorPricingResults,
  runCompetitorPricingJob,
} from '../competitorPricing/jobs';
import { writeCompetitorPricingResultsToSheet } from '../competitorPricing/sheetWriteback';
import type { CompetitorPricingInputRow, CompetitorPricingRunMode } from '../competitorPricing/types';

const VALID_MODES = new Set<CompetitorPricingRunMode>([
  'non_ashley_first',
  'ashley_only',
  'manual_review',
  'all_reliable_rows',
]);

function validateRows(rows: unknown): rows is CompetitorPricingInputRow[] {
  return Array.isArray(rows) && rows.every((row: any) =>
    row &&
    typeof row.sourceRow === 'number' &&
    typeof row.vendor === 'string' &&
    typeof row.sku === 'string' &&
    typeof row.description === 'string' &&
    typeof row.storePriceText === 'string' &&
    typeof row.storePrice === 'string' &&
    ['non_ashley', 'ashley', 'manual_review'].includes(row.bucket)
  );
}

export function registerCompetitorPricingRoutes(app: Express): void {
  app.post('/api/competitor-pricing/jobs', async (req: Request, res: Response) => {
    const mode = req.body?.mode as CompetitorPricingRunMode;
    const rows = req.body?.rows;
    if (!VALID_MODES.has(mode)) {
      res.status(400).json({ ok: false, error: 'invalid mode' });
      return;
    }
    if (!validateRows(rows) || rows.length === 0) {
      res.status(400).json({ ok: false, error: 'rows are required' });
      return;
    }
    if (rows.length > 600) {
      res.status(400).json({ ok: false, error: 'too many rows; max 600' });
      return;
    }

    const status = await createCompetitorPricingJob({ rows, mode });
    Promise.resolve(runCompetitorPricingJob(status.jobId)).catch((err) => {
      console.error('[competitor-pricing] job failed', status.jobId, err);
    });
    res.json({ ok: true, job: status });
  });

  app.get('/api/competitor-pricing/jobs/:jobId', async (req: Request, res: Response) => {
    try {
      res.json({ ok: true, job: await getCompetitorPricingJob(req.params.jobId) });
    } catch {
      res.status(404).json({ ok: false, error: 'job not found' });
    }
  });

  app.get('/api/competitor-pricing/jobs/:jobId/results.csv', async (req: Request, res: Response) => {
    try {
      const file = await getCompetitorPricingResultPath(req.params.jobId, 'csv');
      res.download(file, `competitor-pricing-${req.params.jobId}.csv`);
    } catch {
      res.status(404).json({ ok: false, error: 'result not found' });
    }
  });

  app.get('/api/competitor-pricing/jobs/:jobId/results.json', async (req: Request, res: Response) => {
    try {
      res.sendFile(await getCompetitorPricingResultPath(req.params.jobId, 'json'));
    } catch {
      res.status(404).json({ ok: false, error: 'result not found' });
    }
  });

  app.post('/api/competitor-pricing/jobs/:jobId/sheet-writeback', async (req: Request, res: Response) => {
    const spreadsheetIdOrUrl = String(req.body?.spreadsheetIdOrUrl || '').trim();
    const sheetName = typeof req.body?.sheetName === 'string' && req.body.sheetName.trim()
      ? req.body.sheetName.trim()
      : undefined;
    const dryRun = Boolean(req.body?.dryRun);

    if (!spreadsheetIdOrUrl) {
      res.status(400).json({ ok: false, error: 'spreadsheetIdOrUrl is required' });
      return;
    }

    try {
      const results = await getCompetitorPricingResults(req.params.jobId);
      const writeback = await writeCompetitorPricingResultsToSheet(results, { spreadsheetIdOrUrl, sheetName, dryRun });
      res.json({ ok: true, writeback });
    } catch (err: any) {
      const message = String(err?.message || err);
      const status = /result|job|not found/i.test(message) ? 404 : /required|parse|configured|Sheet tab/i.test(message) ? 400 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  });
}
