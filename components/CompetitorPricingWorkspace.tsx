import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Play, Table2 } from 'lucide-react';
import type {
  CompetitorPricingInputRow,
  CompetitorPricingJobStatus,
  CompetitorPricingRunMode,
  CompetitorPricingSheetWritebackSummary,
} from '../types/competitorPricing';
import {
  competitorPricingRowsToCsv,
  detectCompetitorPricingColumns,
  extractCompetitorPricingRows,
} from '../services/competitorPricingCsv';
import {
  createCompetitorPricingJob,
  getCompetitorPricingDownloadUrl,
  getCompetitorPricingJob,
  writeCompetitorPricingToGoogleSheet,
} from '../services/competitorPricingApi';
import CompetitorPricingResultsViewer from './CompetitorPricingResultsViewer';

type Props = {
  isDarkMode?: boolean;
};

type BucketCounts = Record<CompetitorPricingInputRow['bucket'], number>;

const MODE_LABELS: Record<CompetitorPricingRunMode, string> = {
  non_ashley_first: 'Non-Ashley first',
  ashley_only: 'Ashley / Ashley-family',
  manual_review: 'Manual review',
  all_reliable_rows: 'All reliable rows',
};

function bucketCounts(rows: CompetitorPricingInputRow[]): BucketCounts {
  return rows.reduce<BucketCounts>((acc, row) => {
    acc[row.bucket] += 1;
    return acc;
  }, { non_ashley: 0, ashley: 0, manual_review: 0 });
}

async function parseWorkbookFile(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No sheet found in uploaded file.');
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][];
}

function exportTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rowsForMode(rows: CompetitorPricingInputRow[], mode: CompetitorPricingRunMode): CompetitorPricingInputRow[] {
  if (mode === 'non_ashley_first') return rows.filter((row) => row.bucket === 'non_ashley');
  if (mode === 'ashley_only') return rows.filter((row) => row.bucket === 'ashley');
  if (mode === 'manual_review') return rows.filter((row) => row.bucket === 'manual_review');
  return rows.filter((row) => row.bucket !== 'manual_review');
}

export default function CompetitorPricingWorkspace({ isDarkMode = false }: Props) {
  const [rows, setRows] = useState<CompetitorPricingInputRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<CompetitorPricingRunMode>('non_ashley_first');
  const [job, setJob] = useState<CompetitorPricingJobStatus | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('STORE MOVES AND PRICING');
  const [writeback, setWriteback] = useState<CompetitorPricingSheetWritebackSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isWritingSheet, setIsWritingSheet] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'run' | 'results'>('results');

  const counts = useMemo(() => bucketCounts(rows), [rows]);
  const selectedRows = useMemo(() => rowsForMode(rows, selectedMode), [rows, selectedMode]);
  const previewRows = rows.slice(0, 25);

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        setJob(await getCompetitorPricingJob(job.jobId));
      } catch (err: any) {
        setError(String(err?.message || err));
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [job?.jobId, job?.status]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setJob(null);
    setWriteback(null);
    setIsParsing(true);
    try {
      const rawRows = await parseWorkbookFile(file);
      const columnMap = detectCompetitorPricingColumns(rawRows[0] || []);
      const extracted = extractCompetitorPricingRows(rawRows, columnMap);
      setDetectedColumns(Object.values(columnMap).filter(Boolean));
      setRows(extracted);
      setSelectedMode('non_ashley_first');
    } catch (err: any) {
      setRows([]);
      setDetectedColumns([]);
      setError(String(err?.message || err));
    } finally {
      setIsParsing(false);
    }
  };

  const startJob = async () => {
    setError(null);
    setWriteback(null);
    setIsStarting(true);
    try {
      const created = await createCompetitorPricingJob({ mode: selectedMode, rows: selectedRows });
      setJob(created);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setIsStarting(false);
    }
  };

  const writeBackToSheet = async () => {
    if (!job) return;
    setError(null);
    setIsWritingSheet(true);
    try {
      const summary = await writeCompetitorPricingToGoogleSheet({
        jobId: job.jobId,
        spreadsheetIdOrUrl: sheetUrl,
        sheetName: sheetName.trim() || undefined,
      });
      setWriteback(summary);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setIsWritingSheet(false);
    }
  };

  const cardClass = isDarkMode
    ? 'border-slate-700 bg-slate-900/70 text-slate-100'
    : 'border-slate-200 bg-white/85 text-slate-900';
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const buttonBase = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
  const subTabBase = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition';

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6 lg:p-8" data-testid="competitor-pricing-workspace">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setActiveSubTab('results')} className={`${subTabBase} ${activeSubTab === 'results' ? (isDarkMode ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-sky-50 text-sky-700 border border-sky-200') : (isDarkMode ? 'border border-slate-700 text-slate-400 hover:text-slate-200' : 'border border-slate-200 text-slate-500 hover:text-slate-700')}`}>
          <Table2 size={14} /> Results
        </button>
        <button type="button" onClick={() => setActiveSubTab('run')} className={`${subTabBase} ${activeSubTab === 'run' ? (isDarkMode ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-sky-50 text-sky-700 border border-sky-200') : (isDarkMode ? 'border border-slate-700 text-slate-400 hover:text-slate-200' : 'border border-slate-200 text-slate-500 hover:text-slate-700')}`}>
          <Play size={14} /> Run Job
        </button>
      </div>

      {activeSubTab === 'results' && (
        <CompetitorPricingResultsViewer isDarkMode={isDarkMode} />
      )}

      {activeSubTab === 'run' && (
        <>
          <div className={`rounded-3xl border p-6 shadow-sm ${cardClass}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.22em] ${mutedText}`}>Price Intelligence</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">Competitor Pricing</h2>
                <p className={`mt-3 max-w-3xl text-sm leading-6 ${mutedText}`}>
                  Upload the STORE MOVES AND PRICING CSV/XLSX, split it into Non-Ashley, Ashley, and manual-review rows, then run the Non-Ashley batch first for a faster first report.
                </p>
              </div>
              <label className={`${buttonBase} cursor-pointer bg-slate-950 text-white hover:bg-slate-800`}>
                Upload CSV/XLSX
                <input className="sr-only" type="file" accept=".csv,.xls,.xlsx" onChange={handleUpload} aria-label="Upload pricing CSV or workbook" />
              </label>
            </div>
            {isParsing && <p className={`mt-4 text-sm ${mutedText}`}>Parsing upload…</p>}
            {error && <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <button type="button" onClick={() => setSelectedMode('non_ashley_first')} className={`rounded-3xl border p-5 text-left shadow-sm ${cardClass} ${selectedMode === 'non_ashley_first' ? 'ring-2 ring-emerald-400' : ''}`}>
              <div className={`text-xs font-bold uppercase tracking-[0.18em] ${mutedText}`}>Non-Ashley first</div>
              <div className="mt-3 text-4xl font-bold">{counts.non_ashley}</div>
              <p className={`mt-2 text-sm ${mutedText}`}>Recommended first run. Skips Ashley-family and manual-review set rows.</p>
            </button>
            <button type="button" onClick={() => setSelectedMode('ashley_only')} className={`rounded-3xl border p-5 text-left shadow-sm ${cardClass} ${selectedMode === 'ashley_only' ? 'ring-2 ring-sky-400' : ''}`}>
              <div className={`text-xs font-bold uppercase tracking-[0.18em] ${mutedText}`}>Ashley / Ashley-family</div>
              <div className="mt-3 text-4xl font-bold">{counts.ashley}</div>
              <p className={`mt-2 text-sm ${mutedText}`}>Runs the Ashley SearXNG + product-page scrape flow later.</p>
            </button>
            <button type="button" onClick={() => setSelectedMode('manual_review')} className={`rounded-3xl border p-5 text-left shadow-sm ${cardClass} ${selectedMode === 'manual_review' ? 'ring-2 ring-amber-400' : ''}`}>
              <div className={`text-xs font-bold uppercase tracking-[0.18em] ${mutedText}`}>Manual review</div>
              <div className="mt-3 text-4xl font-bold">{counts.manual_review}</div>
              <p className={`mt-2 text-sm ${mutedText}`}>Set, slash-SKU, and multi-price rows. Kept out of automatic pricing.</p>
            </button>
          </div>

          <div className={`rounded-3xl border p-5 shadow-sm ${cardClass}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-bold">Run selected batch</h3>
                <p className={`mt-1 text-sm ${mutedText}`}>
                  Non-Ashley first skips Ashley-family rows and manual-review set rows. This is intended to get the first competitor report faster. Ashley rows can be run after this batch finishes.
                </p>
                <p className={`mt-2 text-sm font-semibold ${mutedText}`}>{selectedRows.length} rows selected for {MODE_LABELS[selectedMode]}.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${buttonBase} border ${isDarkMode ? 'border-slate-700 text-slate-100 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`} disabled={!rows.length} onClick={() => exportTextFile('competitor-pricing-preview.csv', competitorPricingRowsToCsv(rows), 'text/csv')}>
                  Export Preview CSV
                </button>
                <button type="button" className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={!selectedRows.length || isStarting} onClick={startJob}>
                  {isStarting ? 'Starting…' : selectedMode === 'non_ashley_first' ? 'Run Non-Ashley First' : `Run ${MODE_LABELS[selectedMode]}`}
                </button>
              </div>
            </div>

            {job && (
              <div className={`mt-5 rounded-2xl border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-bold">Job {job.jobId}</div>
                    <div className={`text-sm ${mutedText}`}>Status: {job.status} · {job.processedRows}/{job.totalRows} rows processed</div>
                  </div>
                  {job.status === 'completed' && (
                    <div className="flex flex-wrap gap-2">
                      <a className={`${buttonBase} bg-slate-950 text-white`} href={getCompetitorPricingDownloadUrl(job.jobId, 'csv')}>Download CSV</a>
                      <a className={`${buttonBase} border ${isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-300 text-slate-700'}`} href={getCompetitorPricingDownloadUrl(job.jobId, 'json')}>Download JSON</a>
                    </div>
                  )}
                </div>
                {job.error && <p className="mt-3 text-sm font-semibold text-rose-600">{job.error}</p>}
                {job.status === 'completed' && (
                  <div className={`mt-4 rounded-2xl border p-4 ${isDarkMode ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/80'}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <label className="flex-1 text-sm font-semibold">
                        Google Sheet URL or ID
                        <input
                          value={sheetUrl}
                          onChange={(event) => setSheetUrl(event.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                        />
                      </label>
                      <label className="w-full text-sm font-semibold lg:w-72">
                        Tab name
                        <input
                          value={sheetName}
                          onChange={(event) => setSheetName(event.target.value)}
                          placeholder="STORE MOVES AND PRICING"
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
                        />
                      </label>
                      <button type="button" className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={!sheetUrl.trim() || isWritingSheet} onClick={writeBackToSheet}>
                        {isWritingSheet ? 'Writing…' : 'Write to Google Sheet'}
                      </button>
                    </div>
                    <p className={`mt-3 text-xs leading-5 ${mutedText}`}>
                      Writes high/medium confidence Ashley, Furniture4LessNC, and Furniture Fair prices to dedicated comp-price columns, then colors those cells green and adds source notes.
                    </p>
                    {writeback && (
                      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-emerald-800">
                        Updated {writeback.updatedCells} comp-price cells across {writeback.updatedRows} rows on {writeback.sheetName}.
                        {' '}AHS column: {writeback.columns.ahsCompColumn}; FFL/other column: {writeback.columns.fflCompColumn}; Furniture Fair column: {writeback.columns.furnitureFairCompColumn}.
                        {!!writeback.skippedRows.length && ` Skipped ${writeback.skippedRows.length} rows without reliable prices.`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`rounded-3xl border shadow-sm ${cardClass}`}>
            <div className="flex flex-col gap-2 border-b border-slate-200/20 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-bold">Upload preview</h3>
                <p className={`text-sm ${mutedText}`}>{rows.length ? `${rows.length} product rows extracted. Showing first ${previewRows.length}.` : 'Upload a CSV/XLSX to preview rows.'}</p>
              </div>
              {!!detectedColumns.length && <p className={`max-w-3xl text-xs ${mutedText}`}>Detected: {detectedColumns.join(' · ')}</p>}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/20 text-left text-sm">
                <thead className={isDarkMode ? 'bg-slate-950/60 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                  <tr>
                    {['Row', 'Bucket', 'Vendor', 'SKU', 'Description', 'Store Price', 'Reg Price', 'AHS Comp', 'FFL Comp', 'Furniture Fair Comp', 'Notes'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/10">
                  {previewRows.map((row) => (
                    <tr key={`${row.sourceRow}-${row.sku}`}>
                      <td className="px-4 py-3">{row.sourceRow}</td>
                      <td className="px-4 py-3">{row.bucket}</td>
                      <td className="px-4 py-3">{row.vendor}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.sku}</td>
                      <td className="px-4 py-3">{row.description}</td>
                      <td className="px-4 py-3">{row.storePriceText}</td>
                      <td className="px-4 py-3">{row.regularPrice}</td>
                      <td className="px-4 py-3">{row.existingAhsCompPrice}</td>
                      <td className="px-4 py-3">{row.existingFflCompPrice}</td>
                      <td className="px-4 py-3">{row.existingFurnitureFairCompPrice}</td>
                      <td className="px-4 py-3">{row.rowNotes.join('; ')}</td>
                    </tr>
                  ))}
                  {!previewRows.length && (
                    <tr>
                      <td colSpan={11} className={`px-4 py-10 text-center ${mutedText}`}>No rows loaded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
