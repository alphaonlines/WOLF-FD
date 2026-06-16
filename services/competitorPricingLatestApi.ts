import type { CompetitorPricingResultRow } from '../types/competitorPricing';
import { getPosApiBaseUrl } from './posBackendApi';

export async function getLatestCompetitorPricingResults(): Promise<{
  results: CompetitorPricingResultRow[];
  generatedAt: string | null;
  totalRows: number;
  message?: string;
}> {
  const baseUrl = getPosApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/competitor-pricing/latest`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status} for /api/competitor-pricing/latest`);
  const json = await res.json() as { ok: boolean; results: CompetitorPricingResultRow[]; generatedAt: string | null; totalRows: number; message?: string };
  return json;
}
