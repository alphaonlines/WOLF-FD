import React, { useEffect, useState } from 'react';
import { LayoutDashboard, CheckSquare, MessageSquare, Sofa, Search, Activity, Star, Moon, Sun, UploadCloud, Monitor, Home, ClipboardList, Bot } from 'lucide-react';
import SalesDashboard from './components/SalesDashboard';
import WorkAdvertising from './components/WorkAdvertising';
import UpdateDatabase from './components/UpdateDatabase';
import KiosksStatus from './components/KiosksStatus';
import DashboardOverview from './components/DashboardOverview';
import CRMWorkspace from './components/CRMWorkspace';
import MessageBoard from './components/MessageBoard';
import WolfBot from './components/WolfBot';
import TaskManager from './components/TaskManager';

enum Tab {
  DASHBOARD = 'DASHBOARD',
  SALES = 'SALES',
  CRM = 'CRM',
  SOCIAL = 'SOCIAL',
  KIOSKS = 'KIOSKS',
  MESSAGE_BOARD = 'MESSAGE_BOARD',
  WOLFBOT = 'WOLFBOT',
  TASKS = 'TASKS',
}

const PASSWORD = "1111";
const STORAGE_KEY = "fd_app_unlocked";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [loadingDarkness, setLoadingDarkness] = useState(0.6);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [headerSearch, setHeaderSearch] = useState("");
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [showRange, setShowRange] = useState(false);
  const [itemSortMetric, setItemSortMetric] = useState<"sales" | "qty">("sales");
  const [updatePanelOpen, setUpdatePanelOpen] = useState(false);
  const [updatePanelClosing, setUpdatePanelClosing] = useState(false);
  const [missingItemData, setMissingItemData] = useState(false);
  const [missingSalesData, setMissingSalesData] = useState(false);
  const [activeFilterLabel, setActiveFilterLabel] = useState<string | null>(null);
  const [showTooltips, setShowTooltips] = useState(() => {
    try {
      const v = localStorage.getItem("fd_tooltips_enabled");
      return v ? v === "true" : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!showLoading) return;
    const t = window.setTimeout(() => setShowLoading(false), 6500);
    return () => window.clearTimeout(t);
  }, [showLoading]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { label?: string } | undefined;
      if (detail?.label) setRangeLabel(detail.label);
    };
    window.addEventListener("fd-range", handler as EventListener);
    return () => window.removeEventListener("fd-range", handler as EventListener);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowRange(window.scrollY > 260);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { missing?: boolean } | undefined;
      setMissingItemData(Boolean(detail?.missing));
    };
    window.addEventListener("fd-items-missing", handler as EventListener);
    return () => window.removeEventListener("fd-items-missing", handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { missing?: boolean } | undefined;
      setMissingSalesData(Boolean(detail?.missing));
    };
    window.addEventListener("fd-sales-missing", handler as EventListener);
    return () => window.removeEventListener("fd-sales-missing", handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { salesperson?: string; store?: string } | undefined;
      const salesperson = detail?.salesperson?.trim() || "";
      const store = detail?.store?.trim() || "";
      const label = salesperson && store
        ? `Salesperson: ${salesperson} · Store: ${store}`
        : salesperson
          ? `Salesperson: ${salesperson}`
          : store
            ? `Store: ${store}`
            : "";
      setActiveFilterLabel(label || null);
    };
    window.addEventListener("fd-filter", handler as EventListener);
    return () => window.removeEventListener("fd-filter", handler as EventListener);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("fd_tooltips_enabled", String(showTooltips));
    } catch {
      // ignore storage failures
    }
  }, [showTooltips]);

  useEffect(() => {
    if (activeTab === Tab.DASHBOARD) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [activeTab]);


  const handleUnlock = () => {
    if (passwordInput === PASSWORD) {
      setLoadingDarkness(Math.min(0.6 + passwordInput.length * 0.06, 0.96));
      setIsUnlocked(true);
      setPasswordInput("");
      setPasswordError(null);
      setShowLoading(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // Ignore storage failures.
      }
      return;
    }
    setPasswordError("Incorrect password.");
  };

  const closeUpdatePanel = () => {
    setUpdatePanelClosing(true);
    window.setTimeout(() => {
      setUpdatePanelOpen(false);
      setUpdatePanelClosing(false);
    }, 220);
  };

  const renderContent = () => {
    switch(activeTab) {
      case Tab.DASHBOARD: return (
        <DashboardOverview
          onNavigate={(tab) => {
            if (tab === "SALES") setActiveTab(Tab.SALES);
            if (tab === "TASKS") setActiveTab(Tab.TASKS);
            if (tab === "CRM") setActiveTab(Tab.CRM);
            if (tab === "SOCIAL") setActiveTab(Tab.SOCIAL);
            if (tab === "KIOSKS") setActiveTab(Tab.KIOSKS);
            if (tab === "UPDATE") setUpdatePanelOpen(true);
          }}
        />
      );
      case Tab.SALES: return (
        <SalesDashboard
          itemSortMetric={itemSortMetric}
          showTooltips={showTooltips}
        />
      );
      case Tab.CRM: return <CRMWorkspace />;
      case Tab.SOCIAL: return <WorkAdvertising />;
      case Tab.KIOSKS: return <KiosksStatus />;
      case Tab.MESSAGE_BOARD: return <MessageBoard />;
      case Tab.WOLFBOT: return <WolfBot />;
      case Tab.TASKS: return <TaskManager />;
      default: return <SalesDashboard itemSortMetric={itemSortMetric} showTooltips={showTooltips} />;
    }
  };

  return (
    <div
      className={`min-h-screen wolf-theme font-sans ${isDarkMode ? "dark text-slate-100" : "text-slate-800"} ${
        isDarkMode
          ? "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_50%),linear-gradient(135deg,#0f172a_0%,#0b1120_50%,#111827_100%)]"
          : "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_55%),linear-gradient(135deg,#f8fafc_0%,#ffffff_45%,#f1f5f9_100%)]"
      }`}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
          :root {
            --wolf-card: rgba(255, 255, 255, 0.88);
            --wolf-border: rgba(148, 163, 184, 0.35);
            --wolf-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
          }
          .dark {
            color-scheme: dark;
          }
          .dark {
            --wolf-card: rgba(15, 23, 42, 0.78);
            --wolf-border: rgba(51, 65, 85, 0.7);
            --wolf-shadow: 0 18px 40px rgba(2, 6, 23, 0.5);
          }
          body {
            font-family: "Space Grotesk", system-ui, sans-serif;
          }
          .wolf-theme h1,
          .wolf-theme h2,
          .wolf-theme h3 {
            font-family: "Fraunces", "Space Grotesk", serif;
            letter-spacing: -0.02em;
          }
          .wolf-theme .bg-white {
            background-color: var(--wolf-card) !important;
            border-color: var(--wolf-border) !important;
          }
          .wolf-theme .shadow-sm {
            box-shadow: var(--wolf-shadow) !important;
          }
          .dark .text-slate-800 { color: #e2e8f0 !important; }
          .dark .text-slate-900 { color: #f1f5f9 !important; }
          .dark .text-slate-950 { color: #f8fafc !important; }
          .dark .text-slate-700 { color: #cbd5f1 !important; }
          .dark .text-slate-600 { color: #cbd5f1 !important; }
          .dark .text-slate-500 { color: #94a3b8 !important; }
          .dark .text-slate-400 { color: #94a3b8 !important; }
          .dark .bg-slate-50 { background-color: rgba(15, 23, 42, 0.9) !important; }
          .dark .bg-slate-100 { background-color: rgba(30, 41, 59, 0.8) !important; }
          .dark .border-slate-100 { border-color: rgba(51, 65, 85, 0.8) !important; }
          .dark .border-slate-200 { border-color: rgba(51, 65, 85, 0.8) !important; }
          .fd-print-only { display: none; }
          @media print {
            body * { visibility: hidden; }
            body { background: #ffffff !important; }
            .fd-print-area,
            .fd-print-area * { visibility: visible; }
            .fd-print-area {
              position: static;
              width: 100%;
              padding: 0 12px !important;
              background: #ffffff !important;
            }
            .fd-print-card {
              break-inside: avoid;
              page-break-inside: avoid;
              margin: 0 0 12px 0;
              padding: 12px !important;
              box-shadow: none !important;
              border: 1px solid #e2e8f0 !important;
              background: #ffffff !important;
            }
            .fd-print-hide { display: none !important; }
            .fd-print-toggle { display: none !important; }
            .fd-print-only { display: block !important; }
            .fd-print-area .grid { display: block !important; }
            .fd-print-area .grid > * { width: 100% !important; margin-bottom: 12px; }
            .fd-print-area table,
            .fd-print-area .recharts-wrapper { page-break-inside: avoid; }
            .fd-print-area thead { display: table-header-group; }
            .fd-print-area tr { break-inside: avoid; page-break-inside: avoid; }
            .fd-print-block { break-inside: avoid; page-break-inside: avoid; }
            .fd-print-block table { break-inside: avoid; page-break-inside: avoid; }
            .fd-print-header {
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #0f172a;
            }
            .fd-print-title {
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
            }
            .fd-print-meta {
              font-size: 12px;
              color: #334155;
              margin-top: 4px;
              display: flex;
              flex-wrap: wrap;
              gap: 8px 16px;
            }
            .fd-print-area a { color: #0f172a !important; text-decoration: none; }
            .fd-print-area .shadow-sm { box-shadow: none !important; }
          }
          @keyframes overlayDarken {
            0% { background-color: rgba(2, 6, 23, 0.15); }
            100% { background-color: rgba(2, 6, 23, 0.55); }
          }
        `}
      </style>
      {!isUnlocked && <LockScreen passwordInput={passwordInput} setPasswordInput={setPasswordInput} passwordError={passwordError} onUnlock={handleUnlock} />}
      {showLoading && <LoadingOverlay darkness={loadingDarkness} />}
      <div className={`flex ${!isUnlocked || showLoading ? 'blur-md' : ''} transition-[filter] duration-500`}>
      
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64' : 'w-20'} fixed h-screen bg-slate-900 text-white transition-all duration-300 ease-in-out z-20 flex flex-col`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-20 w-full flex items-center justify-center border-b border-slate-800 hover:bg-slate-800/60 transition-colors"
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <Sofa className="text-blue-400" />
              <div className="leading-tight text-left">
                <div className="font-bold text-xl tracking-tight">WOLF FD</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Furniture Distributors</div>
                <div className="text-xs text-slate-500">Work Online · Live Free</div>
              </div>
            </div>
          ) : (
            <Sofa className="text-blue-400" size={28} />
          )}
        </button>

        <nav className="flex-1 py-8 px-4 space-y-2">
          <NavItem 
            icon={<Home size={20} />} 
            label="Dashboard" 
            isActive={activeTab === Tab.DASHBOARD} 
            onClick={() => setActiveTab(Tab.DASHBOARD)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Sales Analysis" 
            isActive={activeTab === Tab.SALES} 
            onClick={() => setActiveTab(Tab.SALES)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="CRM" 
            isActive={activeTab === Tab.CRM} 
            onClick={() => setActiveTab(Tab.CRM)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<Activity size={20} />} 
            label="Social Posts" 
            isActive={activeTab === Tab.SOCIAL} 
            onClick={() => setActiveTab(Tab.SOCIAL)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<CheckSquare size={20} />} 
            label="Tasks" 
            isActive={activeTab === Tab.TASKS} 
            onClick={() => setActiveTab(Tab.TASKS)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<Monitor size={20} />} 
            label="AlphaOS" 
            isActive={activeTab === Tab.KIOSKS} 
            onClick={() => setActiveTab(Tab.KIOSKS)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<ClipboardList size={20} />} 
            label="Message Board" 
            isActive={activeTab === Tab.MESSAGE_BOARD} 
            onClick={() => setActiveTab(Tab.MESSAGE_BOARD)}
            isOpen={sidebarOpen}
          />
          <NavItem 
            icon={<Bot size={20} />} 
            label="WOLFbot" 
            isActive={activeTab === Tab.WOLFBOT} 
            onClick={() => setActiveTab(Tab.WOLFBOT)}
            isOpen={sidebarOpen}
          />
          <div className="pt-4 mt-4 border-t border-slate-800" />
          <NavItem
            icon={<Activity size={20} />}
            label="AlphaPulse"
            isActive={false}
            href="https://furnituredistributors.wolf.discount/alphapulse/"
            target="_blank"
            rel="noreferrer"
            isOpen={sidebarOpen}
          />
          <NavItem
            icon={<Star size={20} />}
            label="FD Connect Reviews"
            isActive={false}
            href="https://www.furnituredistributors.net/content/connect"
            target="_blank"
            rel="noreferrer"
            isOpen={sidebarOpen}
          />
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="QuickLinks"
            isActive={false}
            href="https://sites.google.com/view/fdserver/home"
            target="_blank"
            rel="noreferrer"
            isOpen={sidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => {
              if (updatePanelOpen) {
                closeUpdatePanel();
              } else {
                setUpdatePanelOpen(true);
              }
            }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
              updatePanelOpen
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            } ${!sidebarOpen ? 'justify-center' : ''}`}
            title="Update database"
          >
            <UploadCloud size={20} />
            {sidebarOpen && (
              <div className="text-sm font-medium">Update DB</div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-10 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <span>
                {activeTab === Tab.DASHBOARD && 'WOLF FD Dashboard'}
                {activeTab === Tab.SALES && 'Sales Analysis'}
                {activeTab === Tab.CRM && 'CRM'}
                {activeTab === Tab.SOCIAL && 'Social Posts'}
                {activeTab === Tab.KIOSKS && 'AlphaOS Status'}
                {activeTab === Tab.MESSAGE_BOARD && 'Message Board'}
                {activeTab === Tab.WOLFBOT && 'WOLFbot'}
              </span>
              {activeTab === Tab.SALES && showRange && rangeLabel && (
                <span className="text-sm font-semibold text-slate-400">
                  ({rangeLabel})
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === Tab.SALES && (
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search salesperson or store..." 
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const query = headerSearch.trim();
                      if (query) {
                        window.dispatchEvent(new CustomEvent("fd-search", { detail: { query } }));
                        setHeaderSearch("");
                      }
                    }
                  }}
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                />
              </div>
            )}
            {activeTab === Tab.SALES && showRange && rangeLabel && (
              <button
                onClick={() => window.dispatchEvent(new Event("fd-open-range"))}
                className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-white/70 border border-slate-200 text-slate-600 hover:bg-white"
                title="Change date range"
              >
                Range: {rangeLabel}
                <span className="text-slate-400">Edit</span>
              </button>
            )}
            {activeTab === Tab.SALES && activeFilterLabel && (
              <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-white/70 border border-slate-200 text-slate-600">
                {activeFilterLabel}
                <button
                  onClick={() => window.dispatchEvent(new Event("fd-clear-filters"))}
                  className="ml-1 text-slate-400 hover:text-slate-600"
                  title="Clear filters"
                >
                  ✕
                </button>
              </div>
            )}
            {activeTab === Tab.SALES && missingItemData && (
              <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Missing data for items for this date range
              </div>
            )}
            {activeTab === Tab.SALES && missingSalesData && (
              <div className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Missing sales data for this date range
              </div>
            )}
            {activeTab === Tab.SALES && (
              <button
                onClick={() => window.dispatchEvent(new Event("fd-print-request"))}
                className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full border transition-colors bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                title="Print full report"
              >
                Print Report
              </button>
            )}
            {activeTab === Tab.SALES && (
              <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
                <button
                  onClick={() => setItemSortMetric("sales")}
                  className={`px-3 py-1 rounded-full font-semibold ${
                    itemSortMetric === "sales"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Sales $
                </button>
                <button
                  onClick={() => setItemSortMetric("qty")}
                  className={`px-3 py-1 rounded-full font-semibold ${
                    itemSortMetric === "qty"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Qty
                </button>
              </div>
            )}
            <button
              onClick={() => setIsDarkMode((prev) => !prev)}
              className="p-2 rounded-full bg-white/70 hover:bg-white shadow-sm border border-slate-200 text-slate-600"
              title="Toggle night mode"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="p-8">
          {renderContent()}
        </div>

      </main>

      {activeTab === Tab.SALES && (
        <button
          type="button"
          onClick={() => setShowTooltips((prev) => !prev)}
          className={`fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg border text-lg font-bold transition-colors ${
            showTooltips
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
          title={showTooltips ? "Tooltips on" : "Tooltips off"}
        >
          ?
        </button>
      )}
      {updatePanelOpen && (
        <>
          <div
            className={`fixed inset-0 z-20 backdrop-blur-sm animate-[overlayDarken_1.6s_ease_forwards] ${
              updatePanelClosing ? "opacity-0 transition-opacity duration-200" : ""
            }`}
            onClick={closeUpdatePanel}
          />
          <div
            className={`fixed bottom-6 z-30 w-[320px] sm:w-[420px] max-h-[70vh] overflow-y-auto transition-transform duration-200 ${
              sidebarOpen ? 'left-72' : 'left-24'
            } ${updatePanelClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <UpdateDatabase
              onUploadComplete={() => {
                window.dispatchEvent(new Event("fd-refresh-data"));
              }}
            />
          </div>
        </>
      )}
      </div>
    </div>
  );
};

const LoadingOverlay: React.FC<{ darkness: number }> = ({ darkness }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-[loadingExit_6.5s_ease-in-out_forwards] [transform-origin:left_bottom]">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-800/70 backdrop-blur-md" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, rgba(2,6,23,0) 0px, rgba(2,6,23,0) 140px, rgba(2,6,23,${darkness}) 260px)`,
        }}
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-28 -left-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl animate-[floatY_7s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-[floatY_6s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/20 animate-[spinSlow_16s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-300/20 animate-[spinSlow_22s_linear_infinite_reverse]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-5 text-white animate-[fadeIn_0.6s_ease]">
        <style>
          {`
            @keyframes loadbar {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            @keyframes floatY {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(16px); }
            }
            @keyframes halo {
              0%, 100% { opacity: 0.35; transform: scale(0.96); }
              50% { opacity: 0.7; transform: scale(1.04); }
            }
            @keyframes sweep {
              0% { transform: translateX(-60%); opacity: 0; }
              30% { opacity: 0.6; }
              100% { transform: translateX(60%); opacity: 0; }
            }
            @keyframes spinSlow {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
            @keyframes fadeIn {
              0% { opacity: 0; transform: translateY(8px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes loadingExit {
              0% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
              85% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
              100% { opacity: 0; transform: translate3d(-36vw, 32vh, 0) scale(0.25); }
            }
            @keyframes pulseRing {
              0% { transform: scale(0.92); opacity: 0.35; }
              70% { transform: scale(1.05); opacity: 0.6; }
              100% { transform: scale(1.15); opacity: 0; }
            }
            @keyframes glowText {
              0%, 100% { text-shadow: 0 0 12px rgba(59, 130, 246, 0.2); }
              50% { text-shadow: 0 0 22px rgba(96, 165, 250, 0.65); }
            }
            @keyframes floatHint {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(6px); }
            }
          `}
        </style>
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl border border-blue-300/40 shadow-[0_0_30px_rgba(59,130,246,0.45)] animate-[halo_2.6s_ease-in-out_infinite]" />
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-blue-500/20 via-indigo-400/10 to-transparent blur-xl" />
          <div className="w-24 h-24 rounded-3xl bg-slate-900/80 border border-slate-700 flex items-center justify-center shadow-xl text-4xl">
            🐺
          </div>
        </div>
        <div className="text-sm uppercase tracking-[0.3em] text-slate-200">WOLF FD</div>
        <div className="w-64 h-2 rounded-full bg-slate-700/80 overflow-hidden relative">
          <div className="h-full w-1/2 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-200 animate-[loadbar_2s_linear_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[sweep_2s_ease-in-out_infinite]" />
        </div>
        <div className="mt-2 text-center text-sm text-slate-200/90 animate-[floatHint_3s_ease-in-out_infinite]">
          <div className="font-semibold animate-[glowText_2.4s_ease-in-out_infinite]">
            Need to update data?
          </div>
          <div className="text-slate-300/80">
            Click the upload icon in the bottom-left menu to add new files.
          </div>
        </div>
      </div>
      <div className="absolute left-8 bottom-8 flex items-center gap-3 text-slate-100">
        <div className="relative">
          <div className="absolute inset-0 rounded-full border border-blue-400/70 animate-[pulseRing_2s_ease-out_infinite]" />
          <div className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center shadow-lg">
            <UploadCloud size={20} />
          </div>
        </div>
        <div className="text-sm font-medium">
          Click this to upload new files
          <div className="text-xs text-slate-400">Bottom-left menu</div>
        </div>
      </div>
    </div>
  );
};

type LockScreenProps = {
  passwordInput: string;
  setPasswordInput: (value: string) => void;
  passwordError: string | null;
  onUnlock: () => void;
};

const LockScreen: React.FC<LockScreenProps> = ({ passwordInput, setPasswordInput, passwordError, onUnlock }) => {
  const darkness = Math.min(0.6 + passwordInput.length * 0.06, 0.96);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-800/70 backdrop-blur-md" />
      <div
        className="absolute inset-0 transition-colors duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, rgba(2,6,23,0) 0px, rgba(2,6,23,0) 140px, rgba(2,6,23,${darkness}) 260px)`,
        }}
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <style>
          {`
            @keyframes breatheGlow {
              0%, 100% { opacity: 0.35; transform: scale(0.98); }
              50% { opacity: 0.8; transform: scale(1.02); }
            }
            @keyframes orbitA {
              0%, 100% { transform: translate(-50%, -50%) rotate(0deg) translateX(10px); opacity: 0.6; }
              50% { transform: translate(-50%, -50%) rotate(180deg) translateX(22px); opacity: 0.35; }
            }
            @keyframes orbitB {
              0%, 100% { transform: translate(-50%, -50%) rotate(0deg) translateX(-14px); opacity: 0.45; }
              50% { transform: translate(-50%, -50%) rotate(-180deg) translateX(-26px); opacity: 0.7; }
            }
          `}
        </style>
        <div className="absolute -top-28 -left-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl animate-[floatY_7s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-[floatY_6s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] rounded-full border border-blue-400/20 animate-[orbitA_14s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/2 h-[360px] w-[360px] rounded-full border border-indigo-300/25 animate-[orbitB_12s_ease-in-out_infinite]" />
      </div>
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl text-slate-100">
        <div className="absolute -inset-2 rounded-[28px] bg-blue-500/20 blur-2xl animate-[breatheGlow_3.8s_ease-in-out_infinite] pointer-events-none" />
        <div className="absolute -inset-1 rounded-[26px] border border-blue-400/30 animate-[breatheGlow_3.8s_ease-in-out_infinite] pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-slate-950/90 border border-slate-700 text-white flex items-center justify-center text-2xl shadow-lg">
            🐺
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">WOLF FD Locked</h2>
            <p className="text-sm text-slate-400">Enter the passcode to continue.</p>
          </div>
        </div>
        <form
          className="relative z-10 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onUnlock();
          }}
        >
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Passcode"
            autoFocus
            className="px-3 py-2 rounded-lg text-sm bg-slate-950/70 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-100"
          >
            Unlock
          </button>
          {passwordError && <div className="text-xs text-rose-300">{passwordError}</div>}
        </form>
      </div>
    </div>
  );
};

// Helper Component for Navigation Items
type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isOpen: boolean;
} & (
  | {
      onClick: () => void;
      href?: never;
      target?: never;
      rel?: never;
    }
  | {
      href: string;
      target?: string;
      rel?: string;
      onClick?: never;
    }
);

const NavItem: React.FC<NavItemProps> = (props) => {
  const { icon, label, isActive, isOpen } = props;
  const className = `
        w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all
        ${isActive 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }
        ${!isOpen && 'justify-center'}
      `;

  if ('href' in props) {
    return (
      <a
        href={props.href}
        target={props.target}
        rel={props.rel}
        className={className}
        title={!isOpen ? label : ''}
      >
        {icon}
        {isOpen && <span className="font-medium text-sm">{label}</span>}
      </a>
    );
  }

  return (
    <button
      onClick={props.onClick}
      className={className}
      title={!isOpen ? label : ''}
    >
      {icon}
      {isOpen && <span className="font-medium text-sm">{label}</span>}
    </button>
  );
};

export default App;
