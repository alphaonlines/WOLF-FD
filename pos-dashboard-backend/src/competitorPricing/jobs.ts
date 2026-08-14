import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  CompetitorPricingCompetitorMatch,
  CompetitorPricingInputRow,
  CompetitorPricingJobStatus,
  CompetitorPricingResultRow,
  CompetitorPricingRunMode,
} from './types';
import { ensureDir, getCompetitorPricingDataDir } from './cache';
import { lookupAshley, lookupFurniture4Less, lookupFurnitureFair } from './competitors';
import { priceToNumber } from './matching';

function jobDir(jobId: string): string {
  return path.join(getCompetitorPricingDataDir(), 'jobs', jobId);
}

function uploadsDir(jobId: string): string {
  return path.join(getCompetitorPricingDataDir(), 'uploads', jobId);
}

function statusPath(jobId: string): string {
  return path.join(jobDir(jobId), 'status.json');
}

function resultsJsonPath(jobId: string): string {
  return path.join(jobDir(jobId), 'results.json');
}

function resultsCsvPath(jobId: string): string {
  return path.join(jobDir(jobId), 'results.csv');
}

function latestResultsPath(): string {
  return path.join(getCompetitorPricingDataDir(), 'latest-results.json');
}

function inputRowsPath(jobId: string): string {
  return path.join(uploadsDir(jobId), 'normalized-input.json');
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as T;
}

async function publishLatestResults(results: CompetitorPricingResultRow[]): Promise<void> {
  const destination = latestResultsPath();
  const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await ensureDir(path.dirname(destination));
  try {
    await fs.writeFile(temporary, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

function selectRows(rows: CompetitorPricingInputRow[], mode: CompetitorPricingRunMode): CompetitorPricingInputRow[] {
  switch (mode) {
    case 'non_ashley_first':
      return rows.filter((row) => row.bucket === 'non_ashley');
    case 'ashley_only':
      return rows.filter((row) => row.bucket === 'ashley');
    case 'manual_review':
      return rows.filter((row) => row.bucket === 'manual_review');
    case 'all_reliable_rows':
      return rows.filter((row) => row.bucket !== 'manual_review');
    default:
      return [];
  }
}

function emptyMatch(competitor: 'Ashley' | 'Furniture4LessNC' | 'FurnitureFairNC', notes: string[]): CompetitorPricingCompetitorMatch {
  return { competitor, title: '', price: '', url: '', confidence: 'none', matchedTokens: [], notes };
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function reliablePrice(match: CompetitorPricingCompetitorMatch | undefined): number | null {
  if (!match || !['high', 'medium'].includes(match.confidence)) return null;
  return priceToNumber(match.price);
}

function buildRecommendation(storePrice: number | null, matches: Array<{ name: string; price: number }>): {
  lowestReliableCompetitorPrice: string;
  storeMinusLowest: string;
  recommendation: string;
} {
  if (!matches.length) {
    return { lowestReliableCompetitorPrice: '', storeMinusLowest: '', recommendation: 'no reliable competitor match found' };
  }
  const lowest = matches.sort((a, b) => a.price - b.price)[0];
  if (storePrice === null) {
    return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: '', recommendation: `competitor found at ${lowest.name}; store price unavailable` };
  }
  const diff = storePrice - lowest.price;
  if (diff > 0) {
    return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: formatMoney(diff), recommendation: `you are ${formatMoney(diff)} higher than ${lowest.name}` };
  }
  if (diff < 0) {
    return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: formatMoney(diff), recommendation: `you are ${formatMoney(Math.abs(diff))} lower than ${lowest.name}` };
  }
  return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: formatMoney(0), recommendation: `you match ${lowest.name}` };
}

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function resultRowsToCsv(rows: CompetitorPricingResultRow[]): string {
  const headers = [
    'source_row',
    'bucket',
    'vendor',
    'sku',
    'description',
    'store_price_text',
    'store_price',
    'regular_price',
    'existing_ahs_comp_price',
    'existing_ffl_comp_price',
    'existing_furniture_fair_comp_price',
    'ashley_title',
    'ashley_price',
    'ashley_confidence',
    'ashley_url',
    'furniture4less_title',
    'furniture4less_price',
    'furniture4less_confidence',
    'furniture4less_url',
    'furniture_fair_title',
    'furniture_fair_price',
    'furniture_fair_confidence',
    'furniture_fair_url',
    'lowest_reliable_competitor_price',
    'store_minus_lowest',
    'recommendation',
    'notes',
    'checked_at',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      row.sourceRow,
      row.bucket,
      row.vendor,
      row.sku,
      row.description,
      row.storePriceText,
      row.storePrice,
      row.regularPrice,
      row.existingAhsCompPrice,
      row.existingFflCompPrice,
      row.existingFurnitureFairCompPrice || '',
      row.ashley?.title || '',
      row.ashley?.price || '',
      row.ashley?.confidence || '',
      row.ashley?.url || '',
      row.furniture4Less?.title || '',
      row.furniture4Less?.price || '',
      row.furniture4Less?.confidence || '',
      row.furniture4Less?.url || '',
      row.furnitureFair?.title || '',
      row.furnitureFair?.price || '',
      row.furnitureFair?.confidence || '',
      row.furnitureFair?.url || '',
      row.lowestReliableCompetitorPrice,
      row.storeMinusLowest,
      row.recommendation,
      [...(row.rowNotes || []), ...(row.ashley?.notes || []), ...(row.furniture4Less?.notes || []), ...(row.furnitureFair?.notes || [])].join('; '),
      row.checkedAt,
    ].map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export async function createCompetitorPricingJob(args: {
  rows: CompetitorPricingInputRow[];
  mode: CompetitorPricingRunMode;
}): Promise<CompetitorPricingJobStatus> {
  const selectedRows = selectRows(args.rows, args.mode);
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const status: CompetitorPricingJobStatus = {
    jobId,
    status: 'queued',
    mode: args.mode,
    totalRows: selectedRows.length,
    processedRows: 0,
    startedAt: now,
  };
  await writeJson(inputRowsPath(jobId), selectedRows);
  await writeJson(statusPath(jobId), status);
  return status;
}

export async function getCompetitorPricingJob(jobId: string): Promise<CompetitorPricingJobStatus> {
  return readJson<CompetitorPricingJobStatus>(statusPath(jobId));
}

export async function getCompetitorPricingResultPath(jobId: string, format: 'csv' | 'json'): Promise<string> {
  const file = format === 'csv' ? resultsCsvPath(jobId) : resultsJsonPath(jobId);
  await fs.access(file);
  return file;
}

export async function getCompetitorPricingResults(jobId: string): Promise<CompetitorPricingResultRow[]> {
  return readJson<CompetitorPricingResultRow[]>(resultsJsonPath(jobId));
}

async function updateStatus(jobId: string, patch: Partial<CompetitorPricingJobStatus>): Promise<CompetitorPricingJobStatus> {
  const current = await getCompetitorPricingJob(jobId);
  const next = { ...current, ...patch };
  await writeJson(statusPath(jobId), next);
  return next;
}

export async function runCompetitorPricingJob(jobId: string, options: { publishLatest?: boolean } = {}): Promise<void> {
  await updateStatus(jobId, { status: 'running' });
  const rows = await readJson<CompetitorPricingInputRow[]>(inputRowsPath(jobId));
  const results: CompetitorPricingResultRow[] = [];

  try {
    for (const row of rows) {
      const ashley = row.bucket === 'ashley' ? await lookupAshley(row) : emptyMatch('Ashley', ['Ashley lookup skipped for this run mode']);
      const furniture4Less = row.bucket === 'manual_review'
        ? emptyMatch('Furniture4LessNC', ['manual-review row skipped for automatic lookup'])
        : await lookupFurniture4Less(row);
      const furnitureFair = row.bucket === 'manual_review'
        ? emptyMatch('FurnitureFairNC', ['manual-review row skipped for automatic lookup'])
        : await lookupFurnitureFair(row);
      const reliable = [
        { name: 'Ashley', price: reliablePrice(ashley) },
        { name: 'Furniture4LessNC', price: reliablePrice(furniture4Less) },
        { name: 'Furniture Fair', price: reliablePrice(furnitureFair) },
      ].filter((entry): entry is { name: string; price: number } => typeof entry.price === 'number' && Number.isFinite(entry.price));
      const comparison = buildRecommendation(priceToNumber(row.storePrice), reliable);
      results.push({
        ...row,
        ashley,
        furniture4Less,
        furnitureFair,
        ...comparison,
        checkedAt: new Date().toISOString(),
      });
      await updateStatus(jobId, { processedRows: results.length });
    }

    await writeJson(resultsJsonPath(jobId), results);
    await fs.writeFile(resultsCsvPath(jobId), resultRowsToCsv(results));
    if (options.publishLatest) await publishLatestResults(results);
    await updateStatus(jobId, {
      status: 'completed',
      processedRows: results.length,
      completedAt: new Date().toISOString(),
      resultCsvPath: resultsCsvPath(jobId),
      resultJsonPath: resultsJsonPath(jobId),
    });
  } catch (err: any) {
    await writeJson(resultsJsonPath(jobId), results).catch(() => undefined);
    await updateStatus(jobId, { status: 'failed', error: String(err?.message || err), completedAt: new Date().toISOString() });
    throw err;
  }
}

export const __testing = { selectRows, jobDir, inputRowsPath, statusPath, resultsCsvPath, resultsJsonPath, latestResultsPath };
