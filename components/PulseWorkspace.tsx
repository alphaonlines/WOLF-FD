import React, { useEffect, useState } from "react";
import { BarChart2, ExternalLink, Globe, Monitor, Star } from "lucide-react";
import SalesDashboard from "./SalesDashboard";
import KiosksStatus from "./KiosksStatus";

type PulseWorkspaceProps = {
  isDarkMode: boolean;
  requestedSubTab?: PulseSubTab;
  requestedSubTabToken?: number;
  onSubTabChange?: (subTab: PulseSubTab) => void;
  itemSortMetric: "sales" | "qty";
  showTooltips: boolean;
  hideTabBar?: boolean;
};

export type PulseSubTab = "sales" | "alphaos" | "alphapulse" | "website" | "reviews";

const FD_REVIEWS_URL = "https://www.furnituredistributors.net/content/connect";
const ALPHAPULSE_URL = "https://furnituredistributors.wolf.discount/alphapulse/";

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
        <button className={tabBtn(subTab === "alphaos")} onClick={() => setSubTab("alphaos")}>
          <Monitor size={15} /> AlphaOS / Kiosks
        </button>
        <button className={tabBtn(subTab === "website")} onClick={() => setSubTab("website")}>
          <Globe size={15} /> Website
        </button>
        <a
          href={ALPHAPULSE_URL}
          target="_blank"
          rel="noreferrer"
          className={tabBtn(false)}
        >
          <ExternalLink size={15} /> Analytics
        </a>
        <a
          href={FD_REVIEWS_URL}
          target="_blank"
          rel="noreferrer"
          className={tabBtn(false)}
        >
          <ExternalLink size={15} /> FD Connect
        </a>
      </div>
      )}

      {/* Content */}
      <PulsePaneBoundary isDarkMode={isDarkMode} label={subTab} onReset={() => setSubTab("sales")}>
        <div className="flex-1 overflow-hidden">
        {subTab === "sales" && (
          <div className="h-full overflow-auto p-5 lg:p-7">
            <SalesDashboard itemSortMetric={itemSortMetric} showTooltips={showTooltips} />
          </div>
        )}
        {subTab === "alphaos" && <KiosksStatus />}
        {subTab === "website" && <WebsitePage isDarkMode={isDarkMode} />}
        </div>
      </PulsePaneBoundary>
    </div>
  );
};

// ── Website placeholder ──────────────────────────────────
const WebsitePage: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
    <div className={`rounded-2xl p-4 ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
      <Globe size={36} className={isDarkMode ? "text-sky-400" : "text-sky-500"} />
    </div>
    <div>
      <p className={`font-semibold text-lg ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
        Website Analytics
      </p>
      <p className={`text-sm mt-1 max-w-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        Web traffic, conversions, and page performance will appear here once the Analytics integration is configured.
      </p>
    </div>
    <a
      href={ALPHAPULSE_URL}
      target="_blank"
      rel="noreferrer"
      className={`mt-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
        isDarkMode
          ? "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
          : "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100"
      }`}
    >
      Open Analytics →
    </a>
  </div>
);

export default PulseWorkspace;
