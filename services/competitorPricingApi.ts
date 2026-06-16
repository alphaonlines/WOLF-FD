import type {
  CompetitorPricingInputRow,
  CompetitorPricingJobStatus,
  CompetitorPricingRunMode,
  CompetitorPricingSheetWritebackSummary,
} from '../types/competitorPricing';
import { getPosApiBaseUrl } from './posBackendApi';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => null) as any;
    throw new Error(error?.error || `POS API ${res.status} for ${path}`);
  }
  return await res.json() as T;
}

export async function createCompetitorPricingJob(args: {
  mode: CompetitorPricingRunMode;
  rows: CompetitorPricingInputRow[];
}): Promise<CompetitorPricingJobStatus> {
  const json = await fetchJson<{ ok: boolean; job: CompetitorPricingJobStatus }>('/api/competitor-pricing/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return json.job;
}

export async function getCompetitorPricingJob(jobId: string): Promise<CompetitorPricingJobStatus> {
  const json = await fetchJson<{ ok: boolean; job: CompetitorPricingJobStatus }>(`/api/competitor-pricing/jobs/${encodeURIComponent(jobId)}`);
  return json.job;
}

export function getCompetitorPricingDownloadUrl(jobId: string, format: 'csv' | 'json'): string {
  const baseUrl = getPosApiBaseUrl();
  return `${baseUrl}/api/competitor-pricing/jobs/${encodeURIComponent(jobId)}/results.${format}`;
}

export async function writeCompetitorPricingToGoogleSheet(args: {
  jobId: string;
  spreadsheetIdOrUrl: string;
  sheetName?: string;
  dryRun?: boolean;
}): Promise<CompetitorPricingSheetWritebackSummary> {
  const json = await fetchJson<{ ok: boolean; writeback: CompetitorPricingSheetWritebackSummary }>(
    `/api/competitor-pricing/jobs/${encodeURIComponent(args.jobId)}/sheet-writeback`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetIdOrUrl: args.spreadsheetIdOrUrl,
        sheetName: args.sheetName,
        dryRun: args.dryRun,
      }),
    }
  );
  return json.writeback;
}
