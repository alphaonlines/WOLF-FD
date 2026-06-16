import type { Express, Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getCompetitorPricingDataDir } from '../competitorPricing/cache';

export function registerCompetitorPricingLatestRoutes(app: Express): void {
  const latestResultsPath = path.join(getCompetitorPricingDataDir(), 'latest-results.json');

  app.get('/api/competitor-pricing/latest', async (_req: Request, res: Response) => {
    try {
      const raw = await fs.readFile(latestResultsPath, 'utf8');
      const data = JSON.parse(raw);
      res.json({ ok: true, results: data.results, generatedAt: data.generatedAt, totalRows: data.results?.length ?? 0 });
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        res.json({ ok: true, results: [], generatedAt: null, totalRows: 0, message: 'No comparison results available yet.' });
        return;
      }
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  });
}
