import React, { useEffect, useState } from "react";
import { Activity, BarChart2, Globe, Monitor, Star } from "lucide-react";
import type { AuthUser } from "../types";
import SalesDashboard from "./SalesDashboard";
import KiosksStatus from "./KiosksStatus";
import WorkAdvertising from "./WorkAdvertising";

type PulseWorkspaceProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
  requestedSubTab?: PulseSubTab;
  requestedSubTabToken?: number;
};

export type PulseSubTab = "sales" | "alphaos" | "website" | "social" | "reviews";

const FD_REVIEWS_URL = "https://www.furnituredistributors.net/content/connect";

const PulseWorkspace: React.FC<PulseWorkspaceProps> = ({
  authUser,
  isDarkMode,
  requestedSubTab = "sales",
  requestedSubTabToken,
}) => {
  const [subTab, setSubTab] = useState<PulseSubTab>(requestedSubTab);

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  const divider = isDarkMode ? "border-slate-800" : "border-slate-200";

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
      {/* Sub-tab bar */}
      <div className={`flex items-center gap-2 px-6 py-3 border-b ${divider} flex-wrap`}>
        <button className={tabBtn(subTab === "sales")} onClick={() => setSubTab("sales")}>
          <BarChart2 size={15} /> Sales Analysis
        </button>
        <button className={tabBtn(subTab === "alphaos")} onClick={() => setSubTab("alphaos")}>
          <Monitor size={15} /> AlphaOS / Kiosks
        </button>
        <button className={tabBtn(subTab === "website")} onClick={() => setSubTab("website")}>
          <Globe size={15} /> Website
        </button>
        <button className={tabBtn(subTab === "social")} onClick={() => setSubTab("social")}>
          <Activity size={15} /> Social Analytics
        </button>
        <button className={tabBtn(subTab === "reviews")} onClick={() => setSubTab("reviews")}>
          <Star size={15} /> FD Connect Reviews
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {subTab === "sales" && (
          <div className="h-full overflow-auto p-5 lg:p-7">
            <SalesDashboard itemSortMetric="sales" showTooltips />
          </div>
        )}
        {subTab === "alphaos" && <KiosksStatus />}
        {subTab === "website" && <WebsitePage isDarkMode={isDarkMode} />}
        {subTab === "social" && (
          <WorkAdvertising
            authUser={authUser}
            onOpenSocialIntegrations={() => {}}
          />
        )}
        {subTab === "reviews" && <ReviewsPage isDarkMode={isDarkMode} />}
      </div>
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
        Web traffic, conversions, and page performance will appear here once the AlphaPulse analytics integration is configured.
      </p>
    </div>
    <a
      href="https://furnituredistributors.wolf.discount/alphapulse/"
      target="_blank"
      rel="noreferrer"
      className={`mt-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
        isDarkMode
          ? "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
          : "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100"
      }`}
    >
      Open AlphaPulse →
    </a>
  </div>
);

// ── FD Connect Reviews ───────────────────────────────────
const ReviewsPage: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div className="flex flex-col h-full">
    <iframe
      src={FD_REVIEWS_URL}
      title="FD Connect Reviews"
      className="flex-1 w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
    <div className={`flex items-center justify-between px-4 py-2 text-xs border-t ${
      isDarkMode ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400"
    }`}>
      <span>furnituredistributors.net/content/connect</span>
      <a
        href={FD_REVIEWS_URL}
        target="_blank"
        rel="noreferrer"
        className={`font-semibold ${isDarkMode ? "text-sky-400 hover:text-sky-300" : "text-sky-500 hover:text-sky-600"}`}
      >
        Open in new tab ↗
      </a>
    </div>
  </div>
);

export default PulseWorkspace;
