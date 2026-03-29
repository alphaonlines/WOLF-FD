import React, { useEffect, useState } from "react";
import { Receipt, Search } from "lucide-react";
import ProductSearchWorkspace from "./ProductSearchWorkspace";

export type ShopSubTab = "search" | "pos";

type ShopWorkspaceProps = {
  isDarkMode: boolean;
  requestedSubTab?: ShopSubTab;
  requestedSubTabToken?: number;
  onOpenUploadArea: () => void;
};

const ShopWorkspace: React.FC<ShopWorkspaceProps> = ({
  isDarkMode,
  requestedSubTab = "search",
  requestedSubTabToken,
  onOpenUploadArea,
}) => {
  const [subTab, setSubTab] = useState<ShopSubTab>(requestedSubTab);

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  const divider = isDarkMode ? "border-slate-800" : "border-slate-200";

  const tabBtn = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
      active
        ? isDarkMode
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : isDarkMode
          ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2 px-6 py-3 border-b ${divider} flex-wrap`}>
        <button className={tabBtn(subTab === "search")} onClick={() => setSubTab("search")}>
          <Search size={15} /> Product Search
        </button>
        <button className={tabBtn(subTab === "pos")} onClick={() => setSubTab("pos")}>
          <Receipt size={15} /> POS
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {subTab === "search" ? (
          <div className="h-full overflow-auto p-5 lg:p-7">
            <ProductSearchWorkspace isDarkMode={isDarkMode} onOpenUploadArea={onOpenUploadArea} />
          </div>
        ) : (
          <ShopPosPage isDarkMode={isDarkMode} />
        )}
      </div>
    </div>
  );
};

const ShopPosPage: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const panelClassName = isDarkMode
    ? "rounded-3xl border border-slate-800 bg-slate-950 shadow-[0_14px_30px_rgba(2,6,23,0.16)]"
    : "rounded-3xl border border-slate-200/80 bg-slate-50/90 shadow-sm";
  const accentClassName = isDarkMode
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const mutedClassName = isDarkMode ? "text-slate-400" : "text-slate-600";

  return (
    <div className="h-full overflow-auto p-5 lg:p-7">
      <div className="space-y-5">
        <section className={`${panelClassName} p-5 md:p-6`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-500">Shop POS</div>
              <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                POS workspace is ready for the next connection
              </h2>
              <p className={`mt-2 max-w-3xl text-sm leading-6 ${mutedClassName}`}>
                This page is reserved for the live POS workflow inside Shop. For now, sales reporting stays in Pulse and catalog lookup stays in Product Search until we wire the POS actions and transaction views here.
              </p>
            </div>
            <a
              href="https://furnituredistributors.wolf.discount/fd/"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${accentClassName}`}
            >
              Open Current FD App
            </a>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className={`${panelClassName} p-5`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Planned</div>
            <div className={`mt-3 text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Transaction lookup</div>
            <p className={`mt-2 text-sm leading-6 ${mutedClassName}`}>
              Search receipts, ticket details, customer purchase history, and item-level transaction records from one page.
            </p>
          </div>
          <div className={`${panelClassName} p-5`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Planned</div>
            <div className={`mt-3 text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Register actions</div>
            <p className={`mt-2 text-sm leading-6 ${mutedClassName}`}>
              Hold the POS controls, payment flow shortcuts, and operational actions that belong in a dedicated shop module instead of analytics.
            </p>
          </div>
          <div className={`${panelClassName} p-5`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Planned</div>
            <div className={`mt-3 text-lg font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Store support</div>
            <p className={`mt-2 text-sm leading-6 ${mutedClassName}`}>
              Build toward store-level views for live floor support, lookup tools, and POS follow-through without mixing them into Den or Pulse.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ShopWorkspace;
