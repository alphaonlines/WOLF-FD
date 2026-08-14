import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Tag, ExternalLink, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { CompetitorPricingCompetitorMatch, CompetitorPricingResultRow } from '../types/competitorPricing';
import { getLatestCompetitorPricingResults } from '../services/competitorPricingLatestApi';

type SortField = 'vendor' | 'sku' | 'description' | 'storePrice' | 'ashleyPrice' | 'fflPrice' | 'furnitureFairPrice' | 'lowestComp' | 'diff' | 'confidence';
type SortDir = 'asc' | 'desc';

type Props = {
  isDarkMode?: boolean;
};

function parsePrice(p: string): number {
  if (!p) return -1;
  const cleaned = p.replace(/[$,]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? -1 : n;
}

function fmtPrice(p: number): string {
  if (p < 0) return '—';
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CONFIDENCE_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

function reliableMatchPrice(match: CompetitorPricingCompetitorMatch | undefined): number {
  if (!match || !['high', 'medium'].includes(match.confidence)) return -1;
  return parsePrice(match.price || '');
}


const GENERIC_MATCH_TITLE_RE = /^(skip to content|view all products|read more reviews at:?|google|access to this page has been denied)$/i;

function cleanMatchTitle(title: string | undefined): string {
  const cleaned = String(title || '').replace(/\s+/g, ' ').trim();
  if (!cleaned || GENERIC_MATCH_TITLE_RE.test(cleaned)) return '';
  return cleaned;
}

function competitorLinkLabel(competitor: 'Ashley' | 'Furniture4Less' | 'FurnitureFair', match: CompetitorPricingCompetitorMatch | undefined): string {
  const title = cleanMatchTitle(match?.title);
  if (title) return title;
  const url = String(match?.url || '');
  try {
    const u = new URL(url);
    if (/\/products?\//i.test(u.pathname)) return 'Open product page';
    if (/\/search/i.test(u.pathname)) return 'Open search results';
    if (/\/collections?\//i.test(u.pathname)) return 'Open collection page';
  } catch {}
  return `Open ${competitor} page`;
}

export default function CompetitorPricingResultsViewer({ isDarkMode = false }: Props) {
  const [results, setResults] = useState<CompetitorPricingResultRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('vendor');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLatestCompetitorPricingResults();
      setResults(data.results || []);
      setGeneratedAt(data.generatedAt);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadResults(); }, [loadResults]);

  const vendors = useMemo(() => {
    const v = new Set(results.map(r => r.vendor).filter(Boolean));
    return ['ALL', ...Array.from(v).sort()];
  }, [results]);

  const filtered = useMemo(() => {
    let rows = [...results];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(r =>
        r.vendor.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    if (vendorFilter !== 'ALL') {
      rows = rows.filter(r => r.vendor === vendorFilter);
    }
    if (confidenceFilter !== 'ALL') {
      rows = rows.filter(r => {
        const aConf = r.ashley?.confidence || 'none';
        const fConf = r.furniture4Less?.confidence || 'none';
        const fairConf = r.furnitureFair?.confidence || 'none';
        const best = [aConf, fConf, fairConf].sort((a, b) => CONFIDENCE_ORDER[b] - CONFIDENCE_ORDER[a])[0];
        return best === confidenceFilter;
      });
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'vendor': cmp = a.vendor.localeCompare(b.vendor); break;
        case 'sku': cmp = a.sku.localeCompare(b.sku); break;
        case 'description': cmp = a.description.localeCompare(b.description); break;
        case 'storePrice': cmp = parsePrice(a.storePrice) - parsePrice(b.storePrice); break;
        case 'ashleyPrice': cmp = reliableMatchPrice(a.ashley) - reliableMatchPrice(b.ashley); break;
        case 'fflPrice': cmp = reliableMatchPrice(a.furniture4Less) - reliableMatchPrice(b.furniture4Less); break;
        case 'furnitureFairPrice': cmp = reliableMatchPrice(a.furnitureFair) - reliableMatchPrice(b.furnitureFair); break;
        case 'lowestComp': cmp = parsePrice(a.lowestReliableCompetitorPrice) - parsePrice(b.lowestReliableCompetitorPrice); break;
        case 'diff': cmp = parsePrice(a.storeMinusLowest) - parsePrice(b.storeMinusLowest); break;
        case 'confidence': {
          const aBest = Math.max(CONFIDENCE_ORDER[a.ashley?.confidence || 'none'] || 0, CONFIDENCE_ORDER[a.furniture4Less?.confidence || 'none'] || 0, CONFIDENCE_ORDER[a.furnitureFair?.confidence || 'none'] || 0);
          const bBest = Math.max(CONFIDENCE_ORDER[b.ashley?.confidence || 'none'] || 0, CONFIDENCE_ORDER[b.furniture4Less?.confidence || 'none'] || 0, CONFIDENCE_ORDER[b.furnitureFair?.confidence || 'none'] || 0);
          cmp = aBest - bBest;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [results, search, vendorFilter, confidenceFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const confidenceBadge = (conf: string) => {
    const cls = conf === 'high' ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
      : conf === 'medium' ? (isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700')
      : conf === 'low' ? (isDarkMode ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700')
      : (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500');
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{conf || 'none'}</span>;
  };

  const card = isDarkMode ? 'border-slate-700 bg-slate-900/70 text-slate-100' : 'border-slate-200 bg-white text-slate-900';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = isDarkMode ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400';
  const thCls = isDarkMode ? 'bg-slate-950/60 text-slate-300' : 'bg-slate-50 text-slate-600';
  const rowCls = isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50/80';
  const linkCls = isDarkMode ? 'text-sky-400 hover:text-sky-300' : 'text-sky-600 hover:text-sky-700';

  const withComp = results.filter(r => r.ashley?.confidence === 'high' || r.ashley?.confidence === 'medium' || r.furniture4Less?.confidence === 'high' || r.furniture4Less?.confidence === 'medium' || r.furnitureFair?.confidence === 'high' || r.furnitureFair?.confidence === 'medium').length;
  const higherCount = results.filter(r => { const d = parsePrice(r.storeMinusLowest); return d > 0; }).length;
  const lowerCount = results.filter(r => { const d = parsePrice(r.storeMinusLowest); return d < 0; }).length;

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className={`rounded-3xl border p-6 shadow-sm ${card}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.22em] ${muted}`}>Price Intelligence</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Competitor Pricing Results</h2>
            <p className={`mt-2 text-sm ${muted}`}>
              {generatedAt ? `Last updated: ${new Date(generatedAt).toLocaleString()}` : 'No results available yet.'}
              {results.length > 0 && ` · ${results.length} products · ${withComp} with matches`}
            </p>
          </div>
          <button onClick={loadResults} disabled={loading} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition border ${isDarkMode ? 'border-slate-700 text-slate-100 hover:bg-slate-800 disabled:opacity-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50'}`}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        {results.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className={`text-xs font-bold uppercase tracking-wider ${muted}`}>Products</div>
              <div className="mt-2 text-2xl font-bold">{results.length}</div>
            </div>
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 size={12} className="text-emerald-500" /> <span className={muted}>With Match</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-500">{withComp}</div>
            </div>
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <XCircle size={12} className="text-rose-500" /> <span className={muted}>Price Higher</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-500">{higherCount}</div>
            </div>
            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                <ArrowDown size={12} className="text-sky-500" /> <span className={muted}>Price Lower</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-sky-500">{lowerCount}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${inputCls}`}>
          <Search size={14} className="opacity-40 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, SKU, description..." className="w-full min-w-[200px] border-none bg-transparent text-sm outline-none" />
        </div>
        <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} className={`rounded-xl border px-3 py-2 text-sm ${inputCls}`}>
          {vendors.map(v => <option key={v} value={v}>{v === 'ALL' ? 'All Vendors' : v}</option>)}
        </select>
        <select value={confidenceFilter} onChange={e => setConfidenceFilter(e.target.value)} className={`rounded-xl border px-3 py-2 text-sm ${inputCls}`}>
          <option value="ALL">All Confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="none">No Match</option>
        </select>
        <span className={`text-xs ${muted}`}>{filtered.length} of {results.length} rows</span>
      </div>

      {/* Error */}
      {error && <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${isDarkMode ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}><AlertTriangle size={14} className="inline mr-2" />{error}</div>}

      {/* Loading */}
      {loading && <div className={`rounded-2xl border p-10 text-center text-sm ${card} ${muted}`}><RefreshCw size={18} className="animate-spin mx-auto mb-3" />Loading comparison results…</div>}

      {/* Empty */}
      {!loading && !error && results.length === 0 && (
        <div className={`rounded-2xl border p-10 text-center text-sm ${card} ${muted}`}>
          <Tag size={24} className="mx-auto mb-3 opacity-40" />
          No competitor pricing results available yet. Run a comparison job to see results here.
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className={`rounded-3xl border shadow-sm overflow-hidden ${card}`}>
          <div className={`border-b px-4 py-3 text-xs ${muted}`}>
            Results are laid out to fit the dashboard width. Vendor/SKU, item details, competitor matches, and recommendation text wrap instead of clipping.
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[22%]" />
                <col className="w-[11%]" />
                <col className="w-[27%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className={thCls}>
                <tr>
                  <th className="px-3 py-3 font-semibold cursor-pointer select-none align-top" onClick={() => toggleSort('vendor')}>
                    <span className="inline-flex items-center gap-1">Vendor / SKU<SortIcon field="vendor" /></span>
                  </th>
                  <th className="px-3 py-3 font-semibold cursor-pointer select-none align-top" onClick={() => toggleSort('description')}>
                    <span className="inline-flex items-center gap-1">Item<SortIcon field="description" /></span>
                  </th>
                  <th className="px-3 py-3 font-semibold cursor-pointer select-none align-top" onClick={() => toggleSort('storePrice')}>
                    <span className="inline-flex items-center gap-1">Store<SortIcon field="storePrice" /></span>
                  </th>
                  <th className="px-3 py-3 font-semibold align-top">Comp Matches</th>
                  <th className="px-3 py-3 font-semibold cursor-pointer select-none align-top" onClick={() => toggleSort('diff')}>
                    <span className="inline-flex items-center gap-1">Lowest / Diff<SortIcon field="diff" /></span>
                  </th>
                  <th className="px-3 py-3 font-semibold cursor-pointer select-none align-top" onClick={() => toggleSort('confidence')}>
                    <span className="inline-flex items-center gap-1">Status / Note<SortIcon field="confidence" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/10">
                {filtered.slice(0, 500).map((row, i) => {
                  const storeP = parsePrice(row.storePrice);
                  const aPrice = reliableMatchPrice(row.ashley);
                  const fPrice = reliableMatchPrice(row.furniture4Less);
                  const fairPrice = reliableMatchPrice(row.furnitureFair);
                  const lowP = parsePrice(row.lowestReliableCompetitorPrice);
                  const diff = parsePrice(row.storeMinusLowest);
                  const aConf = row.ashley?.confidence || 'none';
                  const fConf = row.furniture4Less?.confidence || 'none';
                  const fairConf = row.furnitureFair?.confidence || 'none';
                  const bestConf = [aConf, fConf, fairConf].sort((a, b) => CONFIDENCE_ORDER[b] - CONFIDENCE_ORDER[a])[0];
                  const diffColor = diff > 0 ? 'text-rose-500' : diff < 0 ? 'text-emerald-500' : muted;
                  const ashleyUrl = row.ashley?.url || '';
                  const fflUrl = row.furniture4Less?.url || '';
                  const fairUrl = row.furnitureFair?.url || '';
                  const ashleyTitle = cleanMatchTitle(row.ashley?.title);
                  const fflTitle = cleanMatchTitle(row.furniture4Less?.title);
                  const fairTitle = cleanMatchTitle(row.furnitureFair?.title);
                  return (
                    <tr key={`${row.sku}-${i}`} className={rowCls}>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold break-words">{row.vendor || '—'}</div>
                        <div className={`mt-1 font-mono text-[11px] leading-4 break-all ${muted}`}>{row.sku || '—'}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="whitespace-normal break-words leading-5">{row.description || '—'}</div>
                        {!!row.remarks && <div className={`mt-1 text-[11px] leading-4 whitespace-normal break-words ${muted}`}>Remarks: {row.remarks}</div>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold">{fmtPrice(storeP)}</div>
                        {!!row.regularPrice && <div className={`mt-1 text-[11px] ${muted}`}>Reg: {row.regularPrice}</div>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-2">
                          <div className={`rounded-xl border px-2.5 py-2 ${isDarkMode ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'}`}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wide">Ashley</span>
                              {confidenceBadge(aConf)}
                            </div>
                            <div className="mt-1 font-semibold">{aPrice >= 0 ? fmtPrice(aPrice) : '—'}</div>
                            {ashleyUrl ? (
                              <a href={ashleyUrl} target="_blank" rel="noreferrer" className={`mt-1 inline-flex max-w-full items-start gap-1 text-[11px] leading-4 whitespace-normal break-words ${linkCls}`}>
                                <span className="min-w-0 break-words">{competitorLinkLabel('Ashley', row.ashley)}</span>
                                <ExternalLink size={11} className="mt-0.5 shrink-0" />
                              </a>
                            ) : ashleyTitle ? (
                              <div className={`mt-1 text-[11px] leading-4 whitespace-normal break-words ${muted}`}>{ashleyTitle}</div>
                            ) : (
                              <div className={`mt-1 text-[11px] leading-4 ${muted}`}>No competitor page found</div>
                            )}
                          </div>
                          <div className={`rounded-xl border px-2.5 py-2 ${isDarkMode ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'}`}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wide">Furniture4Less</span>
                              {confidenceBadge(fConf)}
                            </div>
                            <div className="mt-1 font-semibold">{fPrice >= 0 ? fmtPrice(fPrice) : '—'}</div>
                            {fflUrl ? (
                              <a href={fflUrl} target="_blank" rel="noreferrer" className={`mt-1 inline-flex max-w-full items-start gap-1 text-[11px] leading-4 whitespace-normal break-words ${linkCls}`}>
                                <span className="min-w-0 break-words">{competitorLinkLabel('Furniture4Less', row.furniture4Less)}</span>
                                <ExternalLink size={11} className="mt-0.5 shrink-0" />
                              </a>
                            ) : fflTitle ? (
                              <div className={`mt-1 text-[11px] leading-4 whitespace-normal break-words ${muted}`}>{fflTitle}</div>
                            ) : (
                              <div className={`mt-1 text-[11px] leading-4 ${muted}`}>No competitor page found</div>
                            )}
                          </div>
                          <div className={`rounded-xl border px-2.5 py-2 ${isDarkMode ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50/70'}`}>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wide">Furniture Fair</span>
                              {confidenceBadge(fairConf)}
                            </div>
                            <div className="mt-1 font-semibold">{fairPrice >= 0 ? fmtPrice(fairPrice) : '—'}</div>
                            {fairUrl ? (
                              <a href={fairUrl} target="_blank" rel="noreferrer" className={`mt-1 inline-flex max-w-full items-start gap-1 text-[11px] leading-4 whitespace-normal break-words ${linkCls}`}>
                                <span className="min-w-0 break-words">{competitorLinkLabel('FurnitureFair', row.furnitureFair)}</span>
                                <ExternalLink size={11} className="mt-0.5 shrink-0" />
                              </a>
                            ) : fairTitle ? (
                              <div className={`mt-1 text-[11px] leading-4 whitespace-normal break-words ${muted}`}>{fairTitle}</div>
                            ) : (
                              <div className={`mt-1 text-[11px] leading-4 ${muted}`}>No competitor page found</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold">{fmtPrice(lowP)}</div>
                        <div className={`mt-1 font-semibold ${diffColor}`}>
                          {diff >= 0 ? `+${fmtPrice(diff)}` : fmtPrice(Math.abs(diff))}
                          {diff > 0 && ' ↑'}
                          {diff < 0 && ' ↓'}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div>{confidenceBadge(bestConf)}</div>
                        <div className={`mt-2 text-xs leading-4 whitespace-normal break-words ${muted}`} title={row.recommendation}>{row.recommendation || '—'}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 500 && <div className={`px-4 py-3 text-xs text-center ${muted}`}>Showing first 500 of {filtered.length} results. Use filters to narrow down.</div>}
        </div>
      )}
    </section>
  );
}
