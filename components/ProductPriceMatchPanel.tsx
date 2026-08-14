import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, SearchCheck, ShieldCheck } from "lucide-react";
import type { ManufacturerCatalogItem } from "../types";
import type { CompetitorPricingCompetitorMatch } from "../types/competitorPricing";
import type { ProductPriceMatchSummary } from "../types/productPriceMatch";
import { fetchProductPriceMatchSummary, runProductPriceMatch } from "../services/productPriceMatchApi";

type ProductPriceMatchPanelProps = {
  item: ManufacturerCatalogItem;
  sellingPrice: number | null;
  isDarkMode: boolean;
};

const money = (value: number | null) =>
  value === null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const when = (value?: string | null) => {
  if (!value) return "Not checked";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not checked" : parsed.toLocaleString();
};

const isActive = (status?: string | null) => status === "queued" || status === "running";

const ProductPriceMatchPanel: React.FC<ProductPriceMatchPanelProps> = ({ item, sellingPrice, isDarkMode }) => {
  const [summary, setSummary] = useState<ProductPriceMatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellingPriceText, setSellingPriceText] = useState(sellingPrice ? sellingPrice.toFixed(2) : "");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const requestSequenceRef = useRef(0);

  const loadSummary = useCallback(async (quiet = false) => {
    const requestSequence = ++requestSequenceRef.current;
    if (!quiet) setLoading(true);
    try {
      const next = await fetchProductPriceMatchSummary(item.id);
      if (requestSequence === requestSequenceRef.current) {
        setSummary(next);
        setError(null);
      }
    } catch (err: any) {
      if (requestSequence === requestSequenceRef.current) {
        setError(String(err?.message || err || "Unable to load Price Match history"));
      }
    } finally {
      if (!quiet && requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    requestSequenceRef.current += 1;
    setSummary(null);
    setError(null);
    setStarting(false);
    setShowAllHistory(false);
    setSellingPriceText(sellingPrice ? sellingPrice.toFixed(2) : "");
    void loadSummary();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [item.id, loadSummary, sellingPrice]);

  useEffect(() => {
    if (!isActive(summary?.latestAttempt?.status)) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      await loadSummary(true);
      if (!cancelled) timer = window.setTimeout(() => void poll(), 2500);
    };
    timer = window.setTimeout(() => void poll(), 2500);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [loadSummary, summary?.latestAttempt?.status]);

  const parsedSellingPrice = Number(sellingPriceText);
  const hasValidSellingPrice = Number.isFinite(parsedSellingPrice) && parsedSellingPrice > 0;

  const handleRun = async () => {
    if (!hasValidSellingPrice) {
      setError("Enter the actual customer selling price before running Price Match.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const run = await runProductPriceMatch(item.id, parsedSellingPrice);
      setSummary((current) => ({
        ok: true,
        latestAttempt: run,
        lastSuccess: current?.lastSuccess ?? null,
        history: [run, ...(current?.history ?? []).filter((entry) => entry.id !== run.id)],
      }));
    } catch (err: any) {
      setError(String(err?.message || err || "Unable to start Price Match"));
    } finally {
      setStarting(false);
    }
  };

  const latest = summary?.latestAttempt ?? null;
  const lastSuccess = summary?.lastSuccess ?? null;
  const result = lastSuccess?.result ?? null;
  const active = starting || isActive(latest?.status);
  const panel = isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-600";

  const renderMatch = (label: string, match?: CompetitorPricingCompetitorMatch) => {
    const reliablePrice = match && ["high", "medium"].includes(match.confidence) ? match.price : "";
    return (
      <div className={`rounded-2xl border p-4 ${panel}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{label}</div>
            <div className={`mt-1 text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-950"}`}>
              {reliablePrice || "No reliable price"}
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            match?.confidence === "high"
              ? (isDarkMode ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-100 text-emerald-800")
              : match?.confidence === "medium"
                ? (isDarkMode ? "bg-amber-400/15 text-amber-200" : "bg-amber-100 text-amber-800")
                : (isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600")
          }`}>
            {match?.confidence || "none"} confidence
          </span>
        </div>
        {match?.title && <div className={`mt-2 text-sm ${muted}`}>{match.title}</div>}
        {match?.matchedTokens?.length ? (
          <div className={`mt-2 text-xs ${muted}`}>Matched: {match.matchedTokens.join(", ")}</div>
        ) : null}
        {match?.url ? (
          <a href={match.url} target="_blank" rel="noreferrer"
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${isDarkMode ? "bg-sky-400/10 text-sky-200 hover:bg-sky-400/20" : "bg-sky-100 text-sky-800 hover:bg-sky-200"}`}>
            Open competitor page <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${isDarkMode ? "border-violet-700/60 bg-violet-950/40" : "border-violet-200 bg-violet-50"}`}>
        <div>
          <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDarkMode ? "text-violet-300" : "text-violet-700"}`}>Selected item only</div>
          <div className={`mt-1 text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-950"}`}>
            {item.manufacturer} · SKU {item.sku || "—"}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={`price-match-selling-price-${item.id}`} className={`block text-xs font-semibold uppercase tracking-wide ${muted}`}>
              Customer selling price to compare
            </label>
            <div className={`mt-2 flex min-h-11 items-center rounded-xl border px-3 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 ${isDarkMode ? "border-slate-700 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-950"}`}>
              <span aria-hidden="true" className={`mr-1 text-sm ${muted}`}>$</span>
              <input
                id={`price-match-selling-price-${item.id}`}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={sellingPriceText}
                onChange={(event) => setSellingPriceText(event.target.value)}
                disabled={active}
                aria-describedby={`price-match-selling-price-help-${item.id}`}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <p id={`price-match-selling-price-help-${item.id}`} className={`mt-1 text-xs ${muted}`}>
              {sellingPrice
                ? `Prefilled with Shop suggested retail (${money(sellingPrice)}). Confirm the actual customer price before running.`
                : "Enter the actual customer price before running."}
            </p>
          </div>
          <button type="button" onClick={handleRun} disabled={active || !hasValidSellingPrice}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${isDarkMode ? "bg-violet-500 text-white hover:bg-violet-400" : "bg-violet-600 text-white hover:bg-violet-700"}`}>
            <RefreshCw size={15} className={active ? "animate-spin" : ""} />
            {active ? "Checking…" : lastSuccess ? "Refresh Price Match" : "Run Price Match"}
          </button>
        </div>
        {!hasValidSellingPrice && sellingPriceText !== "" && (
          <div className={`mt-3 flex items-start gap-2 text-sm ${isDarkMode ? "text-amber-200" : "text-amber-800"}`}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Enter a selling price greater than zero.
          </div>
        )}
      </div>

      <div aria-live="polite">
        {error && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${isDarkMode ? "border-rose-800 bg-rose-950/50 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{error}</div>
        )}
        {latest?.status === "failed" && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${isDarkMode ? "border-amber-800 bg-amber-950/45 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <strong>Latest refresh failed:</strong> {latest.error || "No error detail was returned."}
            {lastSuccess && <span> The successful result from {when(lastSuccess.checkedAt || lastSuccess.completedAt)} is still shown below.</span>}
          </div>
        )}
      </div>

      {loading ? (
        <div className={`rounded-2xl border px-4 py-8 text-center text-sm ${panel} ${muted}`}>Loading Price Match history…</div>
      ) : result ? (
        <>
          <div className={`rounded-2xl border p-4 ${isDarkMode ? "border-emerald-800 bg-emerald-950/35" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldCheck size={19} className="mt-0.5 text-emerald-500" />
                <div>
                  <div className={`text-sm font-bold ${isDarkMode ? "text-emerald-100" : "text-emerald-900"}`}>Last successful comparison</div>
                  <div className={`mt-1 text-xs ${muted}`}>Checked {when(result.checkedAt || lastSuccess?.checkedAt)} · Selling price {money(lastSuccess?.sellingPrice ?? null)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs uppercase tracking-wide ${muted}`}>Store vs. lowest</div>
                <div className={`mt-1 text-lg font-bold ${isDarkMode ? "text-emerald-200" : "text-emerald-900"}`}>{result.storeMinusLowest || "—"}</div>
              </div>
            </div>
            {result.recommendation && <div className={`mt-3 text-sm ${isDarkMode ? "text-emerald-100" : "text-emerald-900"}`}>{result.recommendation}</div>}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {renderMatch("Ashley", result.ashley)}
            {renderMatch("Furniture 4 Less", result.furniture4Less)}
            {renderMatch("Furniture Fair", result.furnitureFair)}
          </div>
        </>
      ) : (
        <div className={`rounded-2xl border px-4 py-8 text-center ${panel}`}>
          <SearchCheck size={26} className={`mx-auto ${muted}`} />
          <div className={`mt-2 text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>No saved Price Match yet</div>
          <div className={`mt-1 text-xs ${muted}`}>Run it once to save competitor prices, links, confidence, and checked time for this SKU.</div>
        </div>
      )}

      {(summary?.history.length ?? 0) > 0 && (
        <div className={`rounded-2xl border ${panel}`}>
          <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Attempt history</div>
            {(summary?.history.length ?? 0) > 8 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((value) => !value)}
                aria-expanded={showAllHistory}
                className={`text-xs font-bold hover:underline ${isDarkMode ? "text-violet-300" : "text-violet-700"}`}
              >
                {showAllHistory ? "Show recent" : `Show all ${summary!.history.length}`}
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {summary!.history.slice(0, showAllHistory ? summary!.history.length : 8).map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className={`font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>{run.status}</div>
                  <div className={`text-xs ${muted}`}>{when(run.checkedAt || run.completedAt || run.createdAt)}</div>
                </div>
                <div className={`text-right text-xs ${muted}`}>{money(run.sellingPrice)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPriceMatchPanel;
