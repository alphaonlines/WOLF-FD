import React, { useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart2, CheckCircle2, Clock, ExternalLink, Eye, FileSpreadsheet, Globe, Layers, MousePointerClick, RefreshCw, RotateCcw, Star, TrendingUp, UploadCloud, UserPlus, Users } from "lucide-react";
import SalesDashboard from "./SalesDashboard";
import { getPosApiBaseUrl } from "../services/posBackendApi";

type PulseWorkspaceProps = {
  isDarkMode: boolean;
  requestedSubTab?: PulseSubTab;
  requestedSubTabToken?: number;
  onSubTabChange?: (subTab: PulseSubTab) => void;
  itemSortMetric: "sales" | "qty";
  showTooltips: boolean;
  hideTabBar?: boolean;
};

export type PulseSubTab = "sales" | "marketing" | "alphapulse" | "website";

const ALPHAPULSE_URL = "https://furnituredistributors.wolf.discount/alphapulse/";
const PULSE_ORGANIC_URL = "/fd/pulse-organic/";

type PulsePaneBoundaryProps = {
  children: React.ReactNode;
  isDarkMode: boolean;
  label: string;
  onReset: () => void;
};

type PulsePaneBoundaryState = {
  hasError: boolean;
};

class PulsePaneBoundary extends React.Component<PulsePaneBoundaryProps, PulsePaneBoundaryState> {
  state: PulsePaneBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PulsePaneBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Pulse pane crashed", this.props.label, error);
  }

  componentDidUpdate(prevProps: PulsePaneBoundaryProps) {
    if (prevProps.label !== this.props.label && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="h-full overflow-auto p-5 lg:p-7">
        <div className={`rounded-3xl border p-6 ${
          this.props.isDarkMode ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Pulse</div>
          <h2 className="mt-2 text-2xl font-semibold">{this.props.label} hit a rendering error</h2>
          <p className={`mt-3 text-sm leading-6 ${this.props.isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            This tab failed to render, but the rest of Pulse is still available. Use the button below to jump back to the Sales page.
          </p>
          <button
            type="button"
            onClick={this.props.onReset}
            className={`mt-5 inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              this.props.isDarkMode
                ? "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/18"
                : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
            }`}
          >
            Back to Sales
          </button>
        </div>
      </div>
    );
  }
}

const PulseWorkspace: React.FC<PulseWorkspaceProps> = ({
  isDarkMode,
  requestedSubTab = "sales",
  requestedSubTabToken,
  onSubTabChange,
  itemSortMetric,
  showTooltips,
  hideTabBar = false,
}) => {
  const [subTab, setSubTab] = useState<PulseSubTab>(requestedSubTab);

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  useEffect(() => {
    onSubTabChange?.(subTab);
  }, [onSubTabChange, subTab]);

  const divider = isDarkMode ? "border-slate-800" : "border-slate-200";
  const stickyBarClass = isDarkMode
    ? "sticky top-20 z-20 border-b border-slate-800 bg-[#121b27]/94 backdrop-blur-xl"
    : "sticky top-20 z-20 border-b border-slate-200 bg-white/92 backdrop-blur-xl";

  const tabBtn = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
      active
        ? isDarkMode
          ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
          : "bg-sky-50 text-sky-600 border border-sky-200"
        : isDarkMode
        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar - hidden when shown in header */}
      {!hideTabBar && (
      <div className={`flex items-center gap-2 px-6 py-3 ${divider} ${stickyBarClass} flex-wrap`}>
        <button className={tabBtn(subTab === "sales")} onClick={() => setSubTab("sales")}>
          <BarChart2 size={15} /> Sales Analysis
        </button>
        <button className={tabBtn(subTab === "website")} onClick={() => setSubTab("website")}>
          <Globe size={15} /> Website
        </button>
        <button className={tabBtn(subTab === "marketing")} onClick={() => setSubTab("marketing")}>
          <TrendingUp size={15} /> Organic + GA4
        </button>
        <button className={tabBtn(subTab === "alphapulse")} onClick={() => setSubTab("alphapulse")}>
          <BarChart2 size={15} /> AlphaPulse
        </button>
      </div>
      )}

      {/* Content */}
      <PulsePaneBoundary isDarkMode={isDarkMode} label={subTab} onReset={() => setSubTab("sales")}>
        <div className="flex-1 overflow-hidden">
        {subTab === "sales" && (
          <div className="h-full overflow-auto p-5 lg:p-7">
            <SalesDashboard isDarkMode={isDarkMode} itemSortMetric={itemSortMetric} showTooltips={showTooltips} />
          </div>
        )}
        {subTab === "website" && <WebsitePage isDarkMode={isDarkMode} />}
        {subTab === "marketing" && (
          <div className="h-full w-full overflow-hidden">
            <iframe
              src={PULSE_ORGANIC_URL}
              title="FD Pulse Organic + GA4"
              className="h-full w-full border-none bg-slate-950"
              style={{ height: "100vh" }}
            />
          </div>
        )}
        {subTab === "alphapulse" && (
          <div className="h-full w-full overflow-hidden">
            <iframe
              src={ALPHAPULSE_URL}
              title="AlphaPulse Analytics"
              className="w-full h-full border-none"
              style={{ height: "100vh" }}
            />
          </div>
        )}
        </div>
      </PulsePaneBoundary>
    </div>
  );
};


// Website Analytics
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type WebsitePreset = "7d" | "30d" | "90d" | "thisMonth" | "lastMonth" | "ytd" | "custom";
type CompareMode = "previous" | "custom";
type GA4Summary = {
  sessions: number;
  users: number;
  newUsers: number;
  pageViews: number;
  engagedSessions: number;
  engagementRate: number;
  bounceRate: number;
  avgSessionDuration: number;
  eventCount: number;
  pagesPerSession: number;
};
type GA4Page = { title: string; path: string; views: number; users: number; avgSessionDuration: number };
type GA4Channel = { channel: string; sessions: number; users: number; engagementRate: number };
type GA4Device = { device: string; sessions: number; users: number; engagementRate: number };
type GA4City = { city: string; users: number; sessions: number };
type GA4Referrer = { source: string; sessions: number; users: number };
type GA4Daily = { date: string; sessions: number; users: number; pageViews: number };
type GA4RangeData = {
  range: { startDate: string; endDate: string };
  summary: GA4Summary;
  topPages: GA4Page[];
  channels: GA4Channel[];
  devices: GA4Device[];
  cities: GA4City[];
  referrers: GA4Referrer[];
  daily: GA4Daily[];
};
type GA4Data = { current: GA4RangeData; compare: GA4RangeData | null; fetchedAt: number; cached?: boolean };

function isoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysYmd(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return isoDateLocal(next);
}

function daysInclusive(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  return Math.max(1, Math.round((b - a) / MS_PER_DAY) + 1);
}

function getPresetRange(preset: WebsitePreset) {
  const today = new Date();
  const end = isoDateLocal(today);
  if (preset === "7d") return { start: isoDateLocal(new Date(today.getTime() - 6 * MS_PER_DAY)), end };
  if (preset === "90d") return { start: isoDateLocal(new Date(today.getTime() - 89 * MS_PER_DAY)), end };
  if (preset === "thisMonth") return { start: isoDateLocal(new Date(today.getFullYear(), today.getMonth(), 1)), end };
  if (preset === "lastMonth") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: isoDateLocal(start), end: isoDateLocal(last) };
  }
  if (preset === "ytd") return { start: isoDateLocal(new Date(today.getFullYear(), 0, 1)), end };
  return { start: isoDateLocal(new Date(today.getTime() - 29 * MS_PER_DAY)), end };
}

function previousRange(start: string, end: string) {
  const days = daysInclusive(start, end);
  const compareEnd = addDaysYmd(start, -1);
  return { start: addDaysYmd(compareEnd, -(days - 1)), end: compareEnd };
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number) {
  return `${Number.isFinite(n) ? n.toFixed(1) : "0.0"}%`;
}

function fmtSecs(s: number) {
  const safe = Number.isFinite(s) ? s : 0;
  const m = Math.floor(safe / 60);
  const sec = Math.round(safe % 60);
  return `${m}m ${sec}s`;
}

function fmtShortDate(d: string) {
  const compact = d.replace(/-/g, "");
  return `${compact.slice(4, 6)}/${compact.slice(6, 8)}`;
}

function fmtRange(start: string, end: string) {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${new Date(`${end}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function deltaPct(current: number, previous?: number | null) {
  if (!previous || !Number.isFinite(previous)) return null;
  return ((current - previous) / previous) * 100;
}

const CHANNEL_COLORS: Record<string, string> = {
  "Organic Search": "#10b981",
  Direct: "#3b82f6",
  Referral: "#8b5cf6",
  "Paid Search": "#f59e0b",
  "Organic Social": "#ec4899",
  Email: "#06b6d4",
  Unassigned: "#94a3b8",
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  Sessions: "Visits to the website during the selected range. One person can create more than one session.",
  Users: "Unique active visitors Google Analytics counted during the selected range.",
  "New Users": "Visitors who appear to be visiting the site for the first time in GA4.",
  "Page Views": "Total pages viewed. Repeated views of the same page are counted.",
  Engaged: "Sessions that lasted long enough or had meaningful interaction according to GA4 engagement rules.",
  Engagement: "Percent of sessions that were engaged. Higher usually means visitors are finding useful content.",
  Bounce: "Percent of sessions that were not engaged. Lower usually means visitors are sticking around or interacting.",
  "Avg. Session": "Average time visitors spent in a session during the selected range.",
  "Pages / Session": "Average number of pages viewed per visit. Higher can mean deeper browsing.",
  Events: "All tracked GA4 events, such as page views and other configured interactions.",
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  "Date Range": "Choose the website traffic period to analyze. Compare shows the same metrics against another period.",
  "Daily Trend": "A day-by-day view of traffic volume. Blue is sessions, green is users, and purple is page views.",
  "Top Pages": "Pages receiving the most views, with visitor count and average time on each page.",
  "Traffic Sources": "How visitors arrived, grouped by GA4 channel such as Organic Search, Direct, Referral, or Paid Search.",
  Devices: "Website traffic by device category, useful for seeing whether mobile or desktop shoppers dominate.",
  "Top Cities": "Cities with the most active users, useful for local market awareness and campaign targeting.",
  "Source / Medium": "More specific traffic origins, such as google / organic, direct / none, or referral sources.",
};

type WebsiteTooltipProps = { label: string; description: string; children: React.ReactNode; isDarkMode: boolean };

const WebsiteTooltip: React.FC<WebsiteTooltipProps> = ({ label, description, children, isDarkMode }) => (
  <div className="group relative min-w-0" title={`${label}: ${description}`}>
    {children}
    <div
      className={`pointer-events-none absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border px-3 py-2 text-xs leading-5 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
        isDarkMode
          ? "border-slate-700 bg-slate-950 text-slate-200"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <div className="font-semibold text-sky-500">{label}</div>
      <div className="mt-0.5">{description}</div>
    </div>
  </div>
);


type MarketingUpload = {
  originalName: string;
  storedName?: string;
  source: string;
  reportKey: string | null;
  reportLabel: string;
  uploadedAt: string;
  sizeBytes: number;
  rowCount: number;
  headers: string[];
  missingRequiredColumns: string[];
  warning?: string | null;
};

type MarketingReport = {
  key: string;
  source: string;
  label: string;
  fileName: string;
  requiredColumns: string[];
  optionalColumns: string[];
  upload: MarketingUpload | null;
};

type MarketingStatus = {
  ok: boolean;
  generatedAt: string;
  expectedReports: number;
  uploadedReports: number;
  missingReports: number;
  reports: MarketingReport[];
};

const MarketingAnalyticsPage: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const [status, setStatus] = React.useState<MarketingStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null);

  const loadStatus = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${getPosApiBaseUrl()}/api/marketing-analytics/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStatus(d);
        else setError(d.error || "Marketing analytics status failed");
      })
      .catch((e) => setError(e.message || "Marketing analytics status failed"))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file, file.name));
    setUploading(true);
    setUploadMessage(null);
    setError(null);
    try {
      const res = await fetch(`${getPosApiBaseUrl()}/api/marketing-analytics/import-upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `Upload failed (${res.status})`);
      setUploadMessage(`Uploaded ${json.uploaded?.length || 0} file(s). ${json.uploadedReports || 0}/${json.expectedReports || 10} reports now staged.`);
      loadStatus();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const card = isDarkMode ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200";
  const panel = isDarkMode ? "bg-slate-900/70 border-slate-700" : "bg-white border-slate-200";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const heading = isDarkMode ? "text-slate-100" : "text-slate-800";
  const softBg = isDarkMode ? "bg-slate-950/70" : "bg-slate-50";
  const reports = status?.reports || [];
  const googleAdsReports = reports.filter((report) => report.source === "Google Ads");
  const ga4Reports = reports.filter((report) => report.source === "GA4");
  const uploadedReports = status?.uploadedReports || 0;
  const expectedReports = status?.expectedReports || 10;
  const missingReports = status?.missingReports ?? expectedReports;

  const statCard = (label: string, value: string, detail: string, icon: React.ReactNode, accent: string) => (
    <div className={`rounded-2xl border p-4 ${card}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className={`rounded-xl p-2 ${isDarkMode ? "bg-slate-950" : "bg-slate-50"} ${accent}`}>{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${heading}`}>{value}</div>
      <div className={`mt-0.5 text-xs font-semibold uppercase tracking-wider ${muted}`}>{label}</div>
      <p className={`mt-2 text-xs leading-5 ${muted}`}>{detail}</p>
    </div>
  );

  const renderReportCard = (report: MarketingReport) => {
    const upload = report.upload;
    const missingColumns = upload?.missingRequiredColumns || [];
    const ready = !!upload && !missingColumns.length && !upload.warning;
    return (
      <div key={report.key} className={`rounded-2xl border p-4 ${card}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${heading}`}>{report.label}</p>
            <p className={`mt-0.5 truncate text-xs ${muted}`}>{report.fileName}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
            ready
              ? "bg-emerald-500/10 text-emerald-500"
              : upload
                ? "bg-amber-500/10 text-amber-500"
                : "bg-slate-500/10 text-slate-500"
          }`}>
            {ready ? <CheckCircle2 size={12} /> : upload ? <AlertTriangle size={12} /> : <FileSpreadsheet size={12} />}
            {ready ? "Ready" : upload ? "Check columns" : "Missing"}
          </span>
        </div>
        {upload ? (
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs leading-5 ${softBg}`}>
            <p className={`truncate font-semibold ${heading}`}>{upload.originalName}</p>
            <p className={muted}>{fmtNum(upload.rowCount)} rows / {upload.headers.length} headers / {new Date(upload.uploadedAt).toLocaleString()}</p>
            {missingColumns.length ? <p className="mt-1 text-amber-500">Missing: {missingColumns.slice(0, 5).join(", ")}{missingColumns.length > 5 ? "..." : ""}</p> : null}
            {upload.warning ? <p className="mt-1 text-amber-500">{upload.warning}</p> : null}
          </div>
        ) : (
          <p className={`mt-3 text-xs leading-5 ${muted}`}>Waiting for export. Required columns: {report.requiredColumns.slice(0, 5).join(", ")}{report.requiredColumns.length > 5 ? "..." : ""}</p>
        )}
      </div>
    );
  };

  return (
    <div className={`h-full overflow-auto p-5 lg:p-7 ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">Pulse / Marketing Analytics</p>
            <h2 className={`mt-0.5 text-2xl font-semibold ${heading}`}>Google Ads + GA4 Import Control</h2>
            <p className={`mt-1 max-w-3xl text-sm ${muted}`}>Manual CSV/XLSX intake for the first dashboard import. GA4 live website metrics already run in the Website tab; this tab stages the export files needed to connect ad spend, traffic, leads, campaigns, landing pages, and search terms.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadStatus}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                isDarkMode ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <a href="https://ads.google.com" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${isDarkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>Open Ads <ExternalLink size={13} /></a>
            <a href="https://analytics.google.com" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${isDarkMode ? "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20" : "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100"}`}>Open GA4 <ExternalLink size={13} /></a>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {statCard("Reports staged", `${uploadedReports}/${expectedReports}`, "Expected first-run exports across Google Ads and GA4.", <FileSpreadsheet size={18} />, "text-sky-500")}
          {statCard("Missing", String(missingReports), "Download these before the importer can normalize the full dashboard set.", <AlertTriangle size={18} />, missingReports ? "text-amber-500" : "text-emerald-500")}
          {statCard("Google Ads", `${googleAdsReports.filter((r) => r.upload).length}/${googleAdsReports.length}`, "API automation is blocked until credentials/token are clean, so CSV is the safe feed right now.", <TrendingUp size={18} />, "text-amber-500")}
          {statCard("GA4", `${ga4Reports.filter((r) => r.upload).length}/${ga4Reports.length}`, "CSV exports plus the live Website tab give both manual and API visibility.", <Globe size={18} />, "text-emerald-500")}
        </div>

        <div className={`rounded-2xl border p-4 ${panel}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className={`text-sm font-semibold ${heading}`}>Upload first-run export files</p>
              <p className={`mt-1 text-xs ${muted}`}>Accepts CSV, XLSX, or XLS. Use the folder set from the handoff: FD_Analytics_Exports_2026-06-02.</p>
            </div>
            <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${isDarkMode ? "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20" : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"}`}>
              <UploadCloud size={16} /> {uploading ? "Uploading..." : "Choose files"}
              <input type="file" multiple accept=".csv,.xlsx,.xls" disabled={uploading} onChange={(event) => void uploadFiles(event.target.files)} className="hidden" />
            </label>
          </div>
          {uploadMessage ? <p className="mt-3 text-xs font-semibold text-emerald-500">{uploadMessage}</p> : null}
          {error ? <p className="mt-3 text-xs font-semibold text-rose-500">{error}</p> : null}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center"><div className={`text-sm ${muted}`}>Loading marketing import status...</div></div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <p className={`text-xs font-semibold uppercase tracking-widest ${muted}`}>Google Ads exports</p>
              {googleAdsReports.map(renderReportCard)}
            </div>
            <div className="space-y-3">
              <p className={`text-xs font-semibold uppercase tracking-widest ${muted}`}>GA4 exports</p>
              {ga4Reports.map(renderReportCard)}
            </div>
          </div>
        )}

        <div className={`rounded-2xl border p-4 text-xs leading-6 ${panel} ${muted}`}>
          <p className={`mb-2 text-sm font-semibold ${heading}`}>First-run order</p>
          <p>1. Export Google Ads Campaigns, Ad Groups, Keywords, Search Terms, and Ads using the same date range.</p>
          <p>2. Export GA4 Traffic Acquisition, User Acquisition, Landing Pages, Events, and Key Events using the same date range.</p>
          <p>3. Upload the ten files here. The tab checks file names, headers, row counts, and missing reports before deeper database normalization.</p>
          {status?.generatedAt ? <p className="mt-2">Status generated {new Date(status.generatedAt).toLocaleString()}.</p> : null}
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ label: string; mutedClass: string; isDarkMode: boolean; className?: string }> = ({
  label,
  mutedClass,
  isDarkMode,
  className = "",
}) => (
  <WebsiteTooltip label={label} description={SECTION_DESCRIPTIONS[label] || "Website analytics detail."} isDarkMode={isDarkMode}>
    <p className={`${className} text-xs font-semibold uppercase tracking-widest ${mutedClass}`}>{label}</p>
  </WebsiteTooltip>
);

const WebsitePage: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const [data, setData] = React.useState<GA4Data | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [preset, setPreset] = React.useState<WebsitePreset>("30d");
  const defaultRange = React.useMemo(() => getPresetRange("30d"), []);
  const [startDate, setStartDate] = React.useState(defaultRange.start);
  const [endDate, setEndDate] = React.useState(defaultRange.end);
  const [compareEnabled, setCompareEnabled] = React.useState(false);
  const [compareMode, setCompareMode] = React.useState<CompareMode>("previous");
  const initialCompare = previousRange(defaultRange.start, defaultRange.end);
  const [compareStart, setCompareStart] = React.useState(initialCompare.start);
  const [compareEnd, setCompareEnd] = React.useState(initialCompare.end);

  React.useEffect(() => {
    if (preset === "custom") return;
    const next = getPresetRange(preset);
    setStartDate(next.start);
    setEndDate(next.end);
    if (compareMode === "previous") {
      const prev = previousRange(next.start, next.end);
      setCompareStart(prev.start);
      setCompareEnd(prev.end);
    }
  }, [compareMode, preset]);

  React.useEffect(() => {
    if (compareMode !== "previous") return;
    const prev = previousRange(startDate, endDate);
    setCompareStart(prev.start);
    setCompareEnd(prev.end);
  }, [compareMode, endDate, startDate]);

  const loadAnalytics = React.useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ start: startDate, end: endDate });
    if (compareEnabled) {
      params.set("compareStart", compareStart);
      params.set("compareEnd", compareEnd);
    }
    fetch(`${getPosApiBaseUrl()}/api/ga4-website-stats?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d);
          setError(null);
        } else {
          setError(d.error || "Failed to load analytics");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [compareEnabled, compareEnd, compareStart, endDate, startDate]);

  React.useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const card = isDarkMode ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200";
  const panel = isDarkMode ? "bg-slate-900/70 border-slate-700" : "bg-white border-slate-200";
  const input = isDarkMode
    ? "border-slate-700 bg-slate-950 text-slate-100"
    : "border-slate-200 bg-slate-50 text-slate-800";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const heading = isDarkMode ? "text-slate-100" : "text-slate-800";
  const softBg = isDarkMode ? "bg-slate-950/70" : "bg-slate-50";

  const current = data?.current;
  const summary = current?.summary;
  const compareSummary = data?.compare?.summary || null;
  const daily = current?.daily || [];
  const topPages = current?.topPages || [];
  const channels = current?.channels || [];
  const devices = current?.devices || [];
  const cities = current?.cities || [];
  const referrers = current?.referrers || [];
  const maxDaily = Math.max(...daily.map((s) => Math.max(s.sessions, s.users, s.pageViews)), 1);
  const totalChannels = channels.reduce((a, c) => a + c.sessions, 0) || 1;

  const metricCards = summary ? [
    { label: "Sessions", value: fmtNum(summary.sessions), compare: compareSummary?.sessions, raw: summary.sessions, icon: Activity, helpful: "higher" },
    { label: "Users", value: fmtNum(summary.users), compare: compareSummary?.users, raw: summary.users, icon: Users, helpful: "higher" },
    { label: "New Users", value: fmtNum(summary.newUsers), compare: compareSummary?.newUsers, raw: summary.newUsers, icon: UserPlus, helpful: "higher" },
    { label: "Page Views", value: fmtNum(summary.pageViews), compare: compareSummary?.pageViews, raw: summary.pageViews, icon: Eye, helpful: "higher" },
    { label: "Engaged", value: fmtNum(summary.engagedSessions), compare: compareSummary?.engagedSessions, raw: summary.engagedSessions, icon: MousePointerClick, helpful: "higher" },
    { label: "Engagement", value: fmtPct(summary.engagementRate), compare: compareSummary?.engagementRate, raw: summary.engagementRate, icon: TrendingUp, helpful: "higher" },
    { label: "Bounce", value: fmtPct(summary.bounceRate), compare: compareSummary?.bounceRate, raw: summary.bounceRate, icon: RotateCcw, helpful: "lower" },
    { label: "Avg. Session", value: fmtSecs(summary.avgSessionDuration), compare: compareSummary?.avgSessionDuration, raw: summary.avgSessionDuration, icon: Clock, helpful: "higher" },
    { label: "Pages / Session", value: summary.pagesPerSession.toFixed(2), compare: compareSummary?.pagesPerSession, raw: summary.pagesPerSession, icon: Layers, helpful: "higher" },
    { label: "Events", value: fmtNum(summary.eventCount), compare: compareSummary?.eventCount, raw: summary.eventCount, icon: BarChart2, helpful: "higher" },
  ] : [];

  const renderDelta = (raw: number, compare: number | undefined, helpful: string) => {
    const delta = deltaPct(raw, compare);
    if (delta === null) return <span className={`text-[11px] ${muted}`}>No compare</span>;
    const isGood = helpful === "lower" ? delta <= 0 : delta >= 0;
    return (
      <span className={`text-[11px] font-semibold ${isGood ? "text-emerald-500" : "text-rose-500"}`}>
        {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs B
      </span>
    );
  };

  const setPresetRange = (nextPreset: WebsitePreset) => {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;
    const next = getPresetRange(nextPreset);
    setStartDate(next.start);
    setEndDate(next.end);
  };

  const tableRow = (label: string, value: string, detail?: string) => (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl px-3 py-2 ${softBg}`}>
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${heading}`}>{label}</p>
        {detail ? <p className={`truncate text-xs ${muted}`}>{detail}</p> : null}
      </div>
      <p className="text-sm font-bold text-sky-500">{value}</p>
    </div>
  );

  return (
    <div className={`h-full overflow-auto p-5 lg:p-7 ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">Pulse / Website</p>
            <h2 className={`mt-0.5 text-2xl font-semibold ${heading}`}>Furniture Distributors Website Analytics</h2>
            <p className={`mt-1 text-sm ${muted}`}>{fmtRange(startDate, endDate)}{compareEnabled ? ` vs ${fmtRange(compareStart, compareEnd)}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadAnalytics}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                isDarkMode ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                isDarkMode ? "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20" : "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100"
              }`}
            >
              Open GA4 <ExternalLink size={13} />
            </a>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${panel}`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <WebsiteTooltip label="Date Range" description={SECTION_DESCRIPTIONS["Date Range"]} isDarkMode={isDarkMode}>
                <p className={`text-sm font-semibold ${heading}`}>Date Range</p>
              </WebsiteTooltip>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${!compareEnabled ? "border-slate-900 bg-slate-900 text-white" : `${input} hover:border-slate-400`}`}
                  onClick={() => setCompareEnabled(false)}
                >
                  Range Only
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${compareEnabled ? "border-slate-900 bg-slate-900 text-white" : `${input} hover:border-slate-400`}`}
                  onClick={() => setCompareEnabled(true)}
                >
                  Compare
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[220px_1fr_1fr]">
              <label className="space-y-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Preset</span>
                <select value={preset} onChange={(e) => setPresetRange(e.target.value as WebsitePreset)} className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="thisMonth">This month</option>
                  <option value="lastMonth">Last month</option>
                  <option value="ytd">Year to date</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Start</span>
                <input type="date" value={startDate} onChange={(e) => { setPreset("custom"); setStartDate(e.target.value); }} className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
              </label>
              <label className="space-y-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>End</span>
                <input type="date" value={endDate} min={startDate} onChange={(e) => { setPreset("custom"); setEndDate(e.target.value); }} className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`} />
              </label>
            </div>

            {compareEnabled ? (
              <div className="grid gap-3 border-t border-slate-200/60 pt-4 dark:border-slate-700 lg:grid-cols-[220px_1fr_1fr]">
                <label className="space-y-1">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Compare mode</span>
                  <select value={compareMode} onChange={(e) => setCompareMode(e.target.value as CompareMode)} className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}>
                    <option value="previous">Previous period</option>
                    <option value="custom">Custom compare</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Compare start</span>
                  <input type="date" value={compareStart} disabled={compareMode === "previous"} onChange={(e) => setCompareStart(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-60 ${input}`} />
                </label>
                <label className="space-y-1">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Compare end</span>
                  <input type="date" value={compareEnd} min={compareStart} disabled={compareMode === "previous"} onChange={(e) => setCompareEnd(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-60 ${input}`} />
                </label>
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className={`text-sm ${muted}`}>Loading analytics...</div>
          </div>
        ) : error ? (
          <div className={`rounded-2xl border p-6 text-center ${isDarkMode ? "border-rose-500/30 bg-rose-500/10" : "border-rose-200 bg-rose-50"}`}>
            <p className="text-sm font-semibold text-rose-500">Could not load analytics</p>
            <p className={`mx-auto mt-2 max-w-xl text-xs ${muted}`}>{error}</p>
          </div>
        ) : data && summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {metricCards.map(({ label, value, compare, raw, icon: Icon, helpful }) => (
                <WebsiteTooltip key={label} label={label} description={METRIC_DESCRIPTIONS[label] || "Website performance metric."} isDarkMode={isDarkMode}>
                <div className={`rounded-2xl border p-4 ${card}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`rounded-xl p-2 ${isDarkMode ? "bg-slate-950 text-sky-300" : "bg-sky-50 text-sky-600"}`}>
                      <Icon size={17} />
                    </div>
                    {compareEnabled ? renderDelta(raw, compare, helpful) : null}
                  </div>
                  <div className={`text-2xl font-bold ${heading}`}>{value}</div>
                  <div className={`mt-0.5 text-xs ${muted}`}>{label}</div>
                </div>
                </WebsiteTooltip>
              ))}
            </div>

            <div className={`rounded-2xl border p-4 ${card}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <SectionTitle label="Daily Trend" mutedClass={muted} isDarkMode={isDarkMode} />
                <div className={`text-xs ${muted}`}>Sessions, users, and views across selected range</div>
              </div>
              <div className="flex h-44 items-end gap-1 overflow-x-auto pb-2">
                {daily.map((day) => (
                  <div key={day.date} className="flex min-w-[18px] flex-1 flex-col items-center gap-1">
                    <div className="flex h-36 w-full items-end gap-0.5">
                      <div className="flex-1 rounded-t bg-sky-500" style={{ height: `${Math.max(3, (day.sessions / maxDaily) * 132)}px` }} title={`${day.sessions} sessions`} />
                      <div className="flex-1 rounded-t bg-emerald-500" style={{ height: `${Math.max(3, (day.users / maxDaily) * 132)}px` }} title={`${day.users} users`} />
                      <div className="flex-1 rounded-t bg-violet-500" style={{ height: `${Math.max(3, (day.pageViews / maxDaily) * 132)}px` }} title={`${day.pageViews} views`} />
                    </div>
                    <span className={`text-[9px] ${muted}`}>{fmtShortDate(day.date)}</span>
                  </div>
                ))}
              </div>
              <div className={`mt-2 flex flex-wrap gap-4 text-xs ${muted}`}>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Sessions</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Users</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /> Views</span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <div className={`rounded-2xl border p-4 ${card}`}>
                <SectionTitle label="Top Pages" mutedClass={muted} isDarkMode={isDarkMode} className="mb-3" />
                <div className="space-y-2">
                  {topPages.map((p) => tableRow(p.title, fmtNum(p.views), `${p.path} / ${fmtNum(p.users)} users / ${fmtSecs(p.avgSessionDuration)} avg`))}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${card}`}>
                <SectionTitle label="Traffic Sources" mutedClass={muted} isDarkMode={isDarkMode} className="mb-3" />
                <div className="space-y-3">
                  {channels.map((c) => {
                    const pct = Math.round((c.sessions / totalChannels) * 100);
                    const color = CHANNEL_COLORS[c.channel] || "#94a3b8";
                    return (
                      <div key={c.channel}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span className={`font-semibold ${heading}`}>{c.channel}</span>
                          <span className={muted}>{fmtNum(c.sessions)} / {fmtPct(c.engagementRate)}</span>
                        </div>
                        <div className={`h-2 rounded-full ${isDarkMode ? "bg-slate-700" : "bg-slate-100"}`}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className={`rounded-2xl border p-4 ${card}`}>
                <SectionTitle label="Devices" mutedClass={muted} isDarkMode={isDarkMode} className="mb-3" />
                <div className="space-y-2">
                  {devices.map((d) => tableRow(d.device, fmtNum(d.sessions), `${fmtNum(d.users)} users / ${fmtPct(d.engagementRate)} engaged`))}
                </div>
              </div>
              <div className={`rounded-2xl border p-4 ${card}`}>
                <SectionTitle label="Top Cities" mutedClass={muted} isDarkMode={isDarkMode} className="mb-3" />
                <div className="space-y-2">
                  {cities.map((c) => tableRow(c.city, fmtNum(c.users), `${fmtNum(c.sessions)} sessions`))}
                </div>
              </div>
              <div className={`rounded-2xl border p-4 ${card}`}>
                <SectionTitle label="Source / Medium" mutedClass={muted} isDarkMode={isDarkMode} className="mb-3" />
                <div className="space-y-2">
                  {referrers.map((r) => tableRow(r.source, fmtNum(r.sessions), `${fmtNum(r.users)} users`))}
                </div>
              </div>
            </div>

            <p className={`text-center text-xs ${muted}`}>
              Data refreshes every 5 minutes / Property ID 257030674 / {data.cached ? "cached" : "fresh"} / fetched {new Date(data.fetchedAt).toLocaleTimeString()}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};
export default PulseWorkspace;
