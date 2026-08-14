import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Database, Loader2, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react";
import {
  getPosApiBaseUrl,
  fetchPro1stTrend,
  fetchSalespeopleBySaleIds,
  setActivePosDateBasis,
  fetchSalesAnalysisRange,
  fetchSalesAnalysisReport,
  type PosDateBasis,
} from "../services/posBackendApi";
import { latestDeliveredRange } from "./salesAnalysisRange";
import { SalesData, StoreData } from "../types";
import {
  addDaysYmd,
  dayOptions,
  formatMonthLabel,
  formatDateLong,
  formatRangeLabel,
  formatShortDate,
  getCurrentMonthToDateRange,
  getMetricComparisonDisplay,
  getSimplifiedRange,
  monthOptions,
  pctChange,
  safeDiv,
  salespersonLabel,
} from "./salesUtils";
import SortableItem from "./sales/SortableItem";
import SalesPrintDialog from "./sales/SalesPrintDialog";
import SalesReportCard from "./sales/SalesReportCard";
import SalespersonDetailCard, { type SalespersonTicketRow } from "./sales/SalespersonDetailCard";
import TopManufacturersCard from "./sales/TopManufacturersCard";
import {
  openSalesPrintWindowShell,
  renderSalesPrintError,
  renderSalesPrintWindow,
} from "./sales/openSalesPrintWindow";
import {
  computeReportTotals,
  type ReportSummaryRow,
  withReportPercentages,
} from "./salesReportUtils";
import ModuleTourOverlay, { type ModuleTourStep } from "./app/ModuleTourOverlay";

type SalespersonPoint = SalesData & {
  fullName: string;
};

type Summary = {
  sales: number;
  lines: number;
};

type ReportRowsState = {
  rows: ReportSummaryRow[];
  distinctTicketCount: number;
  availableCategories: string[];
  availableManufacturers: string[];
};

type BestSellerRow = {
  itemDescription: string;
  category: string;
  manufacturer: string;
  itemNo: string;
  qty: number;
  sales: number;
  saleIds: string[];
};

type TopCategoryRow = { category: string; qty: number; sales: number };
type TopManufacturerRow = { manufacturer: string; qty: number; sales: number };

type Pro1stStats = {
  totalSales: number;
  proSales: number;
  attachRate: number;
  saleIds: string[];
  saleIdsLow: string[];
  saleIdsMid: string[];
  saleIdsHigh: string[];
};

const EMPTY_PRO1ST_STATS: Pro1stStats = {
  totalSales: 0,
  proSales: 0,
  attachRate: 0,
  saleIds: [],
  saleIdsLow: [],
  saleIdsMid: [],
  saleIdsHigh: [],
};

type TrendPoint = {
  day: string;
  furnitureSales: number;
  mattressBoxSpringAdjustableSales: number;
  averageDailyAdSpend: number | null;
};

type DisplayTrendPoint = TrendPoint & {
  compareDay?: string;
  compareFurnitureSales?: number | null;
  compareAverageDailyAdSpend?: number | null;
};

type RangeMode = "preset" | "custom";

type SalesDashboardProps = {
  itemSortMetric: "sales" | "qty";
  showTooltips?: boolean;
  tourStorageKey?: string;
  enableTourAutoStart?: boolean;
  tourReplayToken?: number;
  isDarkMode?: boolean;
};

const DEFAULT_STAT_CARD_ORDER = ["range-selector", "sales-overview", "finance-overview"];
const DEFAULT_DASHBOARD_CARD_ORDER = [
  ...DEFAULT_STAT_CARD_ORDER,
  "sales-report",
  "best-sellers",
  "top-categories",
  "top-manufacturers",
  "pro1st-attach",
  "salesperson-performance",
  "store-performance",
  "sales-trend",
];
const DASHBOARD_CARD_SPANS: Record<string, string> = {
  "range-selector": "md:col-span-2 xl:col-span-4",
  "sales-overview": "md:col-span-2 xl:col-span-4",
  "finance-overview": "md:col-span-2 xl:col-span-4",
  "sales-report": "md:col-span-6 xl:col-span-12",
  "best-sellers": "md:col-span-3 xl:col-span-6",
  "top-categories": "md:col-span-3 xl:col-span-6",
  "top-manufacturers": "md:col-span-3 xl:col-span-6",
  "pro1st-attach": "md:col-span-3 xl:col-span-6",
  "salesperson-performance": "md:col-span-3 xl:col-span-6",
  "store-performance": "md:col-span-3 xl:col-span-6",
  "sales-trend": "md:col-span-6 xl:col-span-12",
};
const SALES_ANALYSIS_TOUR_STEPS: ModuleTourStep[] = [
  {
    targetSelector: '[data-tour-id="sales-date-range"]',
    title: "Choose the report window",
    description: "Pick a preset range or a custom start and end date. Use Compare when you want this period measured against another one.",
  },
  {
    targetSelector: '[data-tour-id="sales-overview"]',
    title: "Read the floor at a glance",
    description: "This card summarizes sales, ticket count, and average ticket for the selected delivered-date range.",
  },
  {
    targetSelector: '[data-tour-id="sales-report-card"]',
    title: "Work the full report",
    description: "This is the main investigation table for drilling into stores, salespeople, manufacturers, and categories.",
  },
  {
    targetSelector: '[data-tour-id="sales-best-sellers"]',
    title: "Find what is moving",
    description: "Best sellers, categories, manufacturers, and Pro1st attach rate help you see what products are driving the numbers.",
  },
  {
    targetSelector: '[data-tour-id="sales-performance"]',
    title: "Compare people and stores",
    description: "Click a salesperson or store bar to filter the rest of the page to that person or location.",
  },
];

const normalizeStatCardOrder = (value: unknown): string[] => {
  const allowed = new Set(["range-selector", "sales-overview", "finance-overview"]);
  const legacyMap: Record<string, string> = {
    transactions: "sales-overview",
    "total-sales": "sales-overview",
    "avg-ticket": "sales-overview",
    "average-ticket": "sales-overview",
    "financed-amount": "finance-overview",
    "financed-transactions": "finance-overview",
  };

  const raw = Array.isArray(value) ? value.map((entry) => String(entry)) : DEFAULT_STAT_CARD_ORDER;
  const normalized = raw
    .map((entry) => legacyMap[entry] ?? entry)
    .filter((entry) => allowed.has(entry));
  const deduped = Array.from(new Set(normalized));

  for (const entry of DEFAULT_STAT_CARD_ORDER) {
    if (!deduped.includes(entry)) deduped.push(entry);
  }

  return deduped;
};

const normalizeDashboardCardOrder = (value: unknown): string[] => {
  const allowed = new Set(DEFAULT_DASHBOARD_CARD_ORDER);
  const raw = Array.isArray(value) ? value.map((entry) => String(entry)) : DEFAULT_DASHBOARD_CARD_ORDER;
  const normalized = raw.filter((entry) => allowed.has(entry));
  const deduped = Array.from(new Set(normalized));

  for (const entry of DEFAULT_DASHBOARD_CARD_ORDER) {
    if (!deduped.includes(entry)) deduped.push(entry);
  }

  return deduped;
};

const sortReportRows = (rows: ReportSummaryRow[], itemSortMetric: "sales" | "qty"): ReportSummaryRow[] =>
  [...rows].sort((a, b) => {
    if (itemSortMetric === "qty") {
      return (
        Number(b.ticketCount || 0) - Number(a.ticketCount || 0) ||
        Number(b.units || 0) - Number(a.units || 0) ||
        Number(b.totalRetail || 0) - Number(a.totalRetail || 0) ||
        String(a.label || "").localeCompare(String(b.label || ""))
      );
    }
    return (
      Number(b.totalRetail || 0) - Number(a.totalRetail || 0) ||
      Number(b.ticketCount || 0) - Number(a.ticketCount || 0) ||
      Number(b.units || 0) - Number(a.units || 0) ||
      String(a.label || "").localeCompare(String(b.label || ""))
    );
  });

const bestSellerKeyFor = (row: Pick<BestSellerRow, "itemNo" | "itemDescription" | "category" | "manufacturer">) =>
  `${row.itemNo}||${row.itemDescription}||${row.category}||${row.manufacturer}`;

const SalesDashboard: React.FC<SalesDashboardProps> = ({
  itemSortMetric,
  showTooltips = false,
  tourStorageKey = "fd-tour-sales-analysis",
  enableTourAutoStart = true,
  tourReplayToken = 0,
  isDarkMode = true,
}) => {
  const [salesData, setSalesData] = useState<SalespersonPoint[]>([]);
  const [salesDataCompare, setSalesDataCompare] = useState<SalespersonPoint[]>([]);
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const [storeDataCompare, setStoreDataCompare] = useState<StoreData[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [trendCompareData, setTrendCompareData] = useState<TrendPoint[]>([]);
  const [trendFocusDay, setTrendFocusDay] = useState<string | null>(null);
  const trendPrevRangeRef = useRef<{ year: number; month: string; day: string } | null>(null);
  const [summary, setSummary] = useState<Summary>({ sales: 0, lines: 0 });
  const [summaryCompare, setSummaryCompare] = useState<Summary>({ sales: 0, lines: 0 });
  const [dateBasis, setDateBasis] = useState<PosDateBasis>("delivered");
  const dateBasisLabel = dateBasis === "written" ? "written sale date" : "delivered date";
  const dateBasisShortLabel = dateBasis === "written" ? "Written" : "Delivered";

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("fd-sales-basis", {
        detail: { basis: dateBasis, label: dateBasisShortLabel, basisLabel: dateBasisLabel },
      })
    );
  }, [dateBasis, dateBasisLabel, dateBasisShortLabel]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { basis?: PosDateBasis } | undefined;
      if (detail?.basis === "delivered" || detail?.basis === "written") {
        setDateBasis(detail.basis);
      }
    };
    window.addEventListener("fd-set-sales-basis", handler as EventListener);
    return () => window.removeEventListener("fd-set-sales-basis", handler as EventListener);
  }, []);

  const [initialMonthToDate] = useState(() => getCurrentMonthToDateRange());
  
  const [yearA, setYearA] = useState<number>(initialMonthToDate.year);
  const [monthA, setMonthA] = useState<string>(initialMonthToDate.month);
  const [dayA, setDayA] = useState<string>("ALL");
  const [rangeModeA, setRangeModeA] = useState<RangeMode>("custom");
  const [customStartA, setCustomStartA] = useState<string>(initialMonthToDate.start);
  const [customEndA, setCustomEndA] = useState<string>(initialMonthToDate.endInclusive);

  const [dashboardCardOrder, setDashboardCardOrder] = useState<string[]>(() => {
    try {
      const savedDashboardOrder = localStorage.getItem("fd-sales-analysis-card-order");
      if (savedDashboardOrder) {
        return normalizeDashboardCardOrder(JSON.parse(savedDashboardOrder));
      }
      const savedStatOrder = localStorage.getItem("fd-stat-card-order");
      if (savedStatOrder) {
        return normalizeDashboardCardOrder([
          ...normalizeStatCardOrder(JSON.parse(savedStatOrder)),
          ...DEFAULT_DASHBOARD_CARD_ORDER.filter((id) => !DEFAULT_STAT_CARD_ORDER.includes(id)),
        ]);
      }
    } catch (e) {}
    return DEFAULT_DASHBOARD_CARD_ORDER;
  });
  const [showSalesTour, setShowSalesTour] = useState(false);

  useEffect(() => {
    localStorage.setItem("fd-sales-analysis-card-order", JSON.stringify(dashboardCardOrder));
  }, [dashboardCardOrder]);

  useEffect(() => {
    if (!enableTourAutoStart) {
      return;
    }
    try {
      if (!localStorage.getItem(tourStorageKey)) {
        const timer = window.setTimeout(() => setShowSalesTour(true), 900);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Manual tour replay still works if localStorage is unavailable.
    }
  }, [tourStorageKey, enableTourAutoStart]);

  useEffect(() => {
    if (tourReplayToken > 0) {
      setShowSalesTour(true);
    }
  }, [tourReplayToken]);

  const completeSalesTour = () => {
    try {
      localStorage.setItem(tourStorageKey, "1");
    } catch {}
    setShowSalesTour(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDashboardCardOrder((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const [yearB, setYearB] = useState<number | null>(null);
  const [monthB, setMonthB] = useState<string>("ALL");
  const [dayB, setDayB] = useState<string>("ALL");
  const [rangeModeB, setRangeModeB] = useState<RangeMode>("preset");
  const [customStartB, setCustomStartB] = useState<string>("");
  const [customEndB, setCustomEndB] = useState<string>("");
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);

  const [compareHint, setCompareHint] = useState("");
  const printGeneratedAt = useMemo(() => new Date(), []);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedTrendDay, setSelectedTrendDay] = useState<string | null>(null);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRange, setCurrentRange] = useState<{ start: string; endExclusive: string }>({
    start: "1900-01-01",
    endExclusive: "2100-01-01",
  });
  const [error, setError] = useState<string | null>(null);
  const [canonicalMonthLabel, setCanonicalMonthLabel] = useState("");
  const [canonicalWarnings, setCanonicalWarnings] = useState({ openDeliveredTickets: 0, duplicateItemLines: 0, twoPersonTickets: 0 });
  const [canonicalMissingCostCount, setCanonicalMissingCostCount] = useState(0);
  const [canonicalDetail, setCanonicalDetail] = useState<{ total: number; page: number; pageSize: number; rows: any[] }>({ total: 0, page: 1, pageSize: 100, rows: [] });
  const [canonicalDetailLoading, setCanonicalDetailLoading] = useState(false);
  const [finance, setFinance] = useState({
    financedLines: 0,
    financedAmount: 0,
    financeFee: 0,
    financeBalance: 0,
  });
  const [financeCompare, setFinanceCompare] = useState({
    financedLines: 0,
    financedAmount: 0,
    financeFee: 0,
    financeBalance: 0,
  });
  const [lowMarginData, setLowMarginData] = useState<Array<{
    saleId: string;
    saleDate: string;
    salesperson: string;
    grandTotal: number;
    profit: number;
    marginPct: number | null;
  }>>([]);
  const [lowMarginSort, setLowMarginSort] = useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'marginPct', direction: 'asc' });
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
    "best-sellers": true,
    "top-categories": true,
    "top-manufacturers": true,
    "pro1st-attach": true,
  });
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printIncludeLowMargin, setPrintIncludeLowMargin] = useState(true);
  const [printIncludeStore, setPrintIncludeStore] = useState(true);
  const [printIncludeSalesperson, setPrintIncludeSalesperson] = useState(true);
  const [printIncludeManufacturer, setPrintIncludeManufacturer] = useState(true);
  const [printIncludeCategory, setPrintIncludeCategory] = useState(true);
  const [printLoading, setPrintLoading] = useState(false);
  const [printData, setPrintData] = useState<{
    lowMarginRows: typeof lowMarginData;
    storeRows: ReportSummaryRow[];
    storeDistinctTicketCount: number;
    salespersonRows: ReportSummaryRow[];
    salespersonDistinctTicketCount: number;
    storeOverallRows: ReportSummaryRow[];
    salespersonOverallRows: ReportSummaryRow[];
    manufacturerBreakdowns: Array<{
      label: string;
      storeRows: ReportSummaryRow[];
      salespersonRows: ReportSummaryRow[];
    }>;
    categoryBreakdowns: Array<{
      label: string;
      storeRows: ReportSummaryRow[];
      salespersonRows: ReportSummaryRow[];
    }>;
  } | null>(null);
  const [reportMode, setReportMode] = useState<"totals" | "lowest">("totals");
  const [reportDimension, setReportDimension] = useState<"salesperson" | "store">("salesperson");
  const [reportCategories, setReportCategories] = useState<string[]>([]);
  const [reportManufacturer, setReportManufacturer] = useState<string>("ALL");
  const [reportData, setReportData] = useState<ReportRowsState>({
    rows: [],
    distinctTicketCount: 0,
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportDataSalesperson, setReportDataSalesperson] = useState<ReportRowsState>({
    rows: [],
    distinctTicketCount: 0,
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportDataStore, setReportDataStore] = useState<ReportRowsState>({
    rows: [],
    distinctTicketCount: 0,
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportDataSalespersonCompare, setReportDataSalespersonCompare] = useState<ReportRowsState>({
    rows: [],
    distinctTicketCount: 0,
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportDataStoreCompare, setReportDataStoreCompare] = useState<ReportRowsState>({
    rows: [],
    distinctTicketCount: 0,
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportOverallTotals, setReportOverallTotals] = useState<{ totalRetail: number; totalUnits: number }>({
    totalRetail: 0,
    totalUnits: 0,
  });
  const [reportOverallTotalsCompare, setReportOverallTotalsCompare] = useState<{ totalRetail: number; totalUnits: number }>({
    totalRetail: 0,
    totalUnits: 0,
  });
  const [reportOverallRowsSalesperson, setReportOverallRowsSalesperson] = useState<ReportSummaryRow[]>([]);
  const [reportOverallRowsStore, setReportOverallRowsStore] = useState<ReportSummaryRow[]>([]);
  const [reportOverallRowsSalespersonCompare, setReportOverallRowsSalespersonCompare] = useState<ReportSummaryRow[]>([]);
  const [reportOverallRowsStoreCompare, setReportOverallRowsStoreCompare] = useState<ReportSummaryRow[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSellerRow[]>([]);
  const [bestSellersCompare, setBestSellersCompare] = useState<BestSellerRow[]>([]);
  const [salespersonTickets, setSalespersonTickets] = useState<SalespersonTicketRow[]>([]);
  const [trendDayTickets, setTrendDayTickets] = useState<SalespersonTicketRow[]>([]);
  const [trendDayTicketsLoading, setTrendDayTicketsLoading] = useState(false);
  const [trendDayTicketsError, setTrendDayTicketsError] = useState<string | null>(null);
  const [topCategories, setTopCategories] = useState<TopCategoryRow[]>([]);
  const [topCategoriesCompare, setTopCategoriesCompare] = useState<TopCategoryRow[]>([]);
  const [topManufacturers, setTopManufacturers] = useState<TopManufacturerRow[]>([]);
  const [topManufacturersCompare, setTopManufacturersCompare] = useState<TopManufacturerRow[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryItems, setCategoryItems] = useState<Record<string, Array<{
    itemDescription: string;
    manufacturer: string;
    itemNo: string;
    qty: number;
    sales: number;
    saleIds: string[];
  }>>>({});
  const [categoryLoading, setCategoryLoading] = useState<Record<string, boolean>>({});
  const [expandedManufacturers, setExpandedManufacturers] = useState<Record<string, boolean>>({});
  const [manufacturerItems, setManufacturerItems] = useState<Record<string, Array<{
    itemDescription: string;
    category: string;
    itemNo: string;
    qty: number;
    sales: number;
    saleIds: string[];
  }>>>({});
  const [manufacturerLoading, setManufacturerLoading] = useState<Record<string, boolean>>({});
  const [pro1stStats, setPro1stStats] = useState<Pro1stStats>(EMPTY_PRO1ST_STATS);
  const [pro1stStatsCompare, setPro1stStatsCompare] = useState<Pro1stStats>(EMPTY_PRO1ST_STATS);
  const [salePeopleMap, setSalePeopleMap] = useState<Record<string, string>>({});
  const salespersonDetailRef = useRef<HTMLDivElement | null>(null);

  const isCardCollapsed = (id: string) => !!collapsedCards[id];
  const toggleCard = (id: string) => {
    setCollapsedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const renderCardToggle = (id: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleCard(id);
      }}
      className="fd-print-hide text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-3 py-1"
      title={isCardCollapsed(id) ? "Expand card" : "Minimize card"}
    >
      {isCardCollapsed(id) ? "Expand" : "Minimize"}
    </button>
  );

  const renderHelp = (text: string) => {
    if (!showTooltips) return null;
    return (
      <span
        className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold"
        title={text}
      >
        ?
      </span>
    );
  };

  const yearOptions = useMemo(() => {
    const years = new Set<number>(availableYears);
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y -= 1) {
      years.add(y);
    }
    years.add(2023);
    return Array.from(years).sort((a, b) => a - b).map(String);
  }, [availableYears]);

  const sortedLowMarginData = useMemo(() => {
    return [...lowMarginData].sort((a, b) => {
      const aVal = a[lowMarginSort.column as keyof typeof a];
      const bVal = b[lowMarginSort.column as keyof typeof b];
      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (aVal === null || bVal === null) {
        cmp = aVal === null ? (bVal === null ? 0 : 1) : -1;
      }
      return lowMarginSort.direction === 'asc' ? cmp : -cmp;
    });
  }, [lowMarginData, lowMarginSort]);

  const reportTotals = useMemo(() => {
    return computeReportTotals(reportData.rows, reportData.distinctTicketCount);
  }, [reportData.rows, reportData.distinctTicketCount]);
  const currentReportOverallRows = useMemo(
    () => (reportDimension === "store" ? reportOverallRowsStore : reportOverallRowsSalesperson),
    [reportDimension, reportOverallRowsSalesperson, reportOverallRowsStore]
  );
  const currentCompareReportData = useMemo(
    () => (reportDimension === "store" ? reportDataStoreCompare : reportDataSalespersonCompare),
    [reportDimension, reportDataSalespersonCompare, reportDataStoreCompare]
  );
  const currentCompareReportOverallRows = useMemo(
    () => (reportDimension === "store" ? reportOverallRowsStoreCompare : reportOverallRowsSalespersonCompare),
    [reportDimension, reportOverallRowsSalespersonCompare, reportOverallRowsStoreCompare]
  );
  const currentReportOverallMap = useMemo(
    () => new Map(currentReportOverallRows.map((row) => [row.label, row])),
    [currentReportOverallRows]
  );
  const currentCompareReportOverallMap = useMemo(
    () => new Map(currentCompareReportOverallRows.map((row) => [row.label, row])),
    [currentCompareReportOverallRows]
  );

  const reportRowsWithPct = useMemo(() => {
    return sortReportRows(
      withReportPercentages(reportData.rows, reportTotals, currentReportOverallMap, reportOverallTotals),
      itemSortMetric
    );
  }, [reportData.rows, reportTotals, currentReportOverallMap, reportOverallTotals, itemSortMetric]);

  const reportTotalsCompare = useMemo(() => {
    return computeReportTotals(currentCompareReportData.rows, currentCompareReportData.distinctTicketCount);
  }, [currentCompareReportData.rows, currentCompareReportData.distinctTicketCount]);

  const reportRowsWithPctCompare = useMemo(() => {
    return sortReportRows(
      withReportPercentages(
        currentCompareReportData.rows,
        reportTotalsCompare,
        currentCompareReportOverallMap,
        reportOverallTotalsCompare
      ),
      itemSortMetric
    );
  }, [currentCompareReportData.rows, reportTotalsCompare, currentCompareReportOverallMap, reportOverallTotalsCompare, itemSortMetric]);

  const bestSellersCompareMap = useMemo(
    () => new Map(bestSellersCompare.map((row) => [bestSellerKeyFor(row), row])),
    [bestSellersCompare]
  );
  const topCategoriesCompareMap = useMemo(
    () => new Map(topCategoriesCompare.map((row) => [row.category, row])),
    [topCategoriesCompare]
  );
  const salesDataCompareMap = useMemo(
    () => new Map(salesDataCompare.map((row) => [row.fullName, row])),
    [salesDataCompare]
  );
  const storeDataCompareMap = useMemo(
    () => new Map(storeDataCompare.map((row) => [row.storeName, row])),
    [storeDataCompare]
  );

  const salesPerformanceData = useMemo(
    () =>
      salesData.map((row) => ({
        ...row,
        compareSales: Number(salesDataCompareMap.get(row.fullName)?.sales || 0),
      })),
    [salesData, salesDataCompareMap]
  );

  const storePerformanceData = useMemo(
    () =>
      storeData.map((row) => ({
        ...row,
        compareRevenue: Number(storeDataCompareMap.get(row.storeName)?.revenue || 0),
      })),
    [storeData, storeDataCompareMap]
  );

  const printLowMarginRows = useMemo(() => (printData?.lowMarginRows ?? sortedLowMarginData), [printData, sortedLowMarginData]);
  const printStoreBaseRows = useMemo(() => (printData?.storeRows ?? reportDataStore.rows), [printData, reportDataStore.rows]);
  const printSalesBaseRows = useMemo(() => (printData?.salespersonRows ?? reportDataSalesperson.rows), [printData, reportDataSalesperson.rows]);
  const printStoreOverallRows = useMemo(() => (printData?.storeOverallRows ?? reportOverallRowsStore), [printData, reportOverallRowsStore]);
  const printSalesOverallRows = useMemo(() => (printData?.salespersonOverallRows ?? reportOverallRowsSalesperson), [printData, reportOverallRowsSalesperson]);
  const printStoreOverallMap = useMemo(() => new Map(printStoreOverallRows.map((row) => [row.label, row])), [printStoreOverallRows]);
  const printSalesOverallMap = useMemo(() => new Map(printSalesOverallRows.map((row) => [row.label, row])), [printSalesOverallRows]);
  const printTotalsStore = useMemo(
    () => computeReportTotals(printStoreBaseRows, printData?.storeDistinctTicketCount),
    [printStoreBaseRows, printData?.storeDistinctTicketCount]
  );
  const printTotalsSalesperson = useMemo(
    () => computeReportTotals(printSalesBaseRows, printData?.salespersonDistinctTicketCount),
    [printSalesBaseRows, printData?.salespersonDistinctTicketCount]
  );
  const printOverallTotals = useMemo(() => computeReportTotals(printStoreOverallRows), [printStoreOverallRows]);
  const printRowsWithPctStore = useMemo(() => {
    return sortReportRows(
      withReportPercentages(printStoreBaseRows, printTotalsStore, printStoreOverallMap, printOverallTotals),
      itemSortMetric
    );
  }, [printStoreBaseRows, printTotalsStore, printStoreOverallMap, printOverallTotals, itemSortMetric]);
  const printRowsWithPctSalesperson = useMemo(() => {
    return sortReportRows(
      withReportPercentages(printSalesBaseRows, printTotalsSalesperson, printSalesOverallMap, printOverallTotals),
      itemSortMetric
    );
  }, [printSalesBaseRows, printTotalsSalesperson, printSalesOverallMap, printOverallTotals, itemSortMetric]);
  const printOverallRetailTotal = Number(printOverallTotals.totalRetail || 0);
  const printOverallUnitsTotal = Number(printOverallTotals.totalUnits || 0);

  const printLowMarginFiltered = useMemo(() => {
    return printLowMarginRows.filter((row) => {
      const total = Number(row.grandTotal || 0);
      const profit = Number(row.profit || 0);
      const margin = row.marginPct === null ? 0 : Number(row.marginPct || 0);
      return !(total === 0 && profit === 0 && margin === 0);
    });
  }, [printLowMarginRows]);

  const printStoreFiltered = useMemo(() => {
    return printRowsWithPctStore.filter((row) => {
      const retail = Number(row.totalRetail || 0);
      const units = Number(row.units || 0);
      const tickets = Number(row.ticketCount || 0);
      const retailPct = Number(row.retailPct || 0);
      const unitsPct = Number(row.unitsPct || 0);
      return !(retail === 0 && units === 0 && tickets === 0) && !(retailPct === 0 && unitsPct === 0);
    });
  }, [printRowsWithPctStore]);

  const printSalespersonFiltered = useMemo(() => {
    return printRowsWithPctSalesperson.filter((row) => {
      const retail = Number(row.totalRetail || 0);
      const units = Number(row.units || 0);
      const tickets = Number(row.ticketCount || 0);
      const retailPct = Number(row.retailPct || 0);
      const unitsPct = Number(row.unitsPct || 0);
      return !(retail === 0 && units === 0 && tickets === 0) && !(retailPct === 0 && unitsPct === 0);
    });
  }, [printRowsWithPctSalesperson]);

  useEffect(() => {
    const next = reportDimension === "store" ? reportDataStore : reportDataSalesperson;
    setReportData({
      rows: next.rows,
      distinctTicketCount: next.distinctTicketCount,
      availableCategories: next.availableCategories,
      availableManufacturers: next.availableManufacturers,
    });
  }, [reportDimension, reportDataSalesperson, reportDataStore]);

  const formatMarginPct = (value: number | null) => {
    if (!Number.isFinite(value as number)) return "N/A";
    return `${(value as number).toFixed(1)}%`;
  };

  const activeReportCategories = useMemo(
    () => reportCategories.map((category) => category.trim()).filter(Boolean),
    [reportCategories]
  );

  const reportCategoryOptions = useMemo(() => {
    const values = [...reportData.availableCategories, ...activeReportCategories].filter((v) => v && String(v).trim());
    return ["ALL", ...Array.from(new Set(values))];
  }, [reportData.availableCategories, activeReportCategories]);

  const reportManufacturerOptions = useMemo(() => {
    const values = [...reportData.availableManufacturers, reportManufacturer]
      .filter((v) => v && String(v).trim() && v !== "ALL");
    return ["ALL", ...Array.from(new Set(values))];
  }, [reportData.availableManufacturers, reportManufacturer]);

  const resolveCustomRange = (start: string, end: string) => {
    if (!start || !end || start > end) return null;
    return { start, endExclusive: addDaysYmd(end, 1) };
  };

  const resolveRange = (
    mode: RangeMode,
    year: number | null,
    month: string,
    day: string,
    customStart: string,
    customEnd: string
  ) => {
    if (mode === "custom") {
      return resolveCustomRange(customStart, customEnd);
    }
    if (!year) return null;
    return getSimplifiedRange(year, month, day);
  };

  const currentRangeInput = useMemo(
    () => resolveRange(rangeModeA, yearA, monthA, dayA, customStartA, customEndA),
    [rangeModeA, yearA, monthA, dayA, customStartA, customEndA]
  );
  const compareRangeInput = useMemo(
    () => (compareEnabled ? resolveRange(rangeModeB, yearB, monthB, dayB, customStartB, customEndB) : null),
    [compareEnabled, rangeModeB, yearB, monthB, dayB, customStartB, customEndB]
  );
  const rangeSelectionKeyA = useMemo(
    () =>
      rangeModeA === "custom"
        ? `custom:${customStartA}:${customEndA}`
        : `preset:${yearA}:${monthA}:${dayA}`,
    [rangeModeA, customStartA, customEndA, yearA, monthA, dayA]
  );

  const switchRangeAToCustom = () => {
    const baseRange = resolveRange("preset", yearA, monthA, dayA, "", "");
    if (baseRange) {
      setCustomStartA(baseRange.start);
      setCustomEndA(addDaysYmd(baseRange.endExclusive, -1));
    }
    setRangeModeA("custom");
  };

  const switchRangeBToCustom = () => {
    const baseRange = resolveRange("preset", yearB, monthB, dayB, "", "");
    if (baseRange) {
      setCustomStartB(baseRange.start);
      setCustomEndB(addDaysYmd(baseRange.endExclusive, -1));
    } else if (currentRangeInput) {
      setCustomStartB(currentRangeInput.start);
      setCustomEndB(addDaysYmd(currentRangeInput.endExclusive, -1));
    }
    setRangeModeB("custom");
  };

  useEffect(() => {
    if (!trendFocusDay) return;
    if (!currentRangeInput) {
      setTrendFocusDay(null);
      setSelectedTrendDay(null);
      trendPrevRangeRef.current = null;
      return;
    }
    if (!(trendFocusDay >= currentRangeInput.start && trendFocusDay < currentRangeInput.endExclusive)) {
      setTrendFocusDay(null);
      setSelectedTrendDay(null);
      trendPrevRangeRef.current = null;
    }
  }, [currentRangeInput, trendFocusDay]);

  useEffect(() => {
    fetchSalesAnalysisRange()
      .then(({ deliveredDateMin, deliveredDateMax }) => {
        if (!deliveredDateMax) return;
        setCanonicalMonthLabel(new Date(`${deliveredDateMax}T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
        const latest = latestDeliveredRange(deliveredDateMax, new Date().toLocaleDateString("en-CA"));
        if (!latest) return;
        setAvailableYears(Array.from(new Set([deliveredDateMin, deliveredDateMax].filter(Boolean).map((value) => Number(String(value).slice(0, 4))))).sort());
        setYearA(Number(deliveredDateMax.slice(0, 4)));
        setRangeModeA("custom");
        setCustomStartA(latest.start);
        setCustomEndA(latest.endInclusive);
        setYearB(null);
      })
      .catch(() => {
        // ignore; UI still works with manual year values
      });
  }, [dateBasis]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setActivePosDateBasis(dateBasis);
    try {
      const salesperson = selectedSalesperson ? selectedSalesperson : undefined;
      const location = selectedStore ? selectedStore : undefined;

      const currentRange = currentRangeInput;
      if (!currentRange) {
        setError("Invalid date range. Adjust the selected range and try again.");
        setLoading(false);
        return;
      }

      const compareRange = compareRangeInput;
      if (compareRange) {
        setCompareHint(`vs ${formatRangeLabel(compareRange)}`);
      } else {
        setCompareHint("");
      }

      // Canonical Sales Analysis replaces the legacy endpoint fan-out while the
      // established card rendering and interactions below continue to consume
      // their existing view models.
      const canonicalParams = {
        start: currentRange.start,
        endInclusive: addDaysYmd(currentRange.endExclusive, -1),
        page: 1,
        pageSize: 100,
        salesperson,
        store: location,
        manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
        category: activeReportCategories.length === 1 ? activeReportCategories[0] : undefined,
      };
      const [canonical, canonicalCompare] = await Promise.all([
        fetchSalesAnalysisReport(canonicalParams),
        compareRange ? fetchSalesAnalysisReport({ ...canonicalParams, start: compareRange.start, endInclusive: addDaysYmd(compareRange.endExclusive, -1) }) : Promise.resolve(null),
      ]);
      const reportRows = (dimension: "salesperson" | "store", payload: any): ReportSummaryRow[] =>
        (payload?.series?.[dimension] || []).map((row: any) => ({
          label: row.label, ticketCount: Number(row.ticketCount || 0), totalRetail: Number(row.sales || 0),
          pro1stSales: 0, units: Number(row.quantity || 0), avgMarginPct: row.marginPct == null ? null : Number(row.marginPct),
        }));
      const sellerRows = (payload: any): BestSellerRow[] => (payload?.series?.item || []).slice(0, 15).map((row: any) => ({
        itemDescription: row.description || row.label, category: row.category || "(unknown)", manufacturer: row.manufacturer || "(unknown)",
        itemNo: row.label, qty: Number(row.quantity || 0), sales: Number(row.sales || 0), saleIds: [],
      }));
      const simpleRows = (dimension: "category" | "manufacturer", payload: any) =>
        (payload?.series?.[dimension] || []).slice(0, 8).map((row: any) => ({ [dimension]: row.label, qty: Number(row.quantity || 0), sales: Number(row.sales || 0) }));
      const peopleRows = reportRows("salesperson", canonical);
      const storeRows = reportRows("store", canonical);
      const comparePeopleRows = reportRows("salesperson", canonicalCompare);
      const compareStoreRows = reportRows("store", canonicalCompare);
      const categories = (canonical?.series?.category || []).map((row: any) => row.label);
      const manufacturers = (canonical?.series?.manufacturer || []).map((row: any) => row.label);
      const stateFor = (rows: ReportSummaryRow[]) => ({ rows, distinctTicketCount: Number(canonical?.summary?.ticketCount || 0), availableCategories: categories, availableManufacturers: manufacturers });
      setCurrentRange(currentRange);
      setSalesData(peopleRows.map((r) => ({ name: salespersonLabel(r.label), fullName: r.label, sales: r.totalRetail, margin: r.avgMarginPct || 0, itemsSold: r.units })));
      setSalesDataCompare(comparePeopleRows.map((r) => ({ name: salespersonLabel(r.label), fullName: r.label, sales: r.totalRetail, margin: r.avgMarginPct || 0, itemsSold: r.units })));
      setStoreData(storeRows.map((r) => ({ storeName: r.label, revenue: r.totalRetail, profit: Number(canonical.series.store.find((x: any) => x.label === r.label)?.profit || 0) })));
      setStoreDataCompare(compareStoreRows.map((r) => ({ storeName: r.label, revenue: r.totalRetail, profit: Number(canonicalCompare?.series?.store?.find((x: any) => x.label === r.label)?.profit || 0) })));
      setSummary({ sales: Number(canonical.summary.itemSales || 0), lines: Number(canonical.summary.ticketCount || 0) });
      setSummaryCompare({ sales: Number(canonicalCompare?.summary?.itemSales ?? canonical.summary.itemSales ?? 0), lines: Number(canonicalCompare?.summary?.ticketCount ?? canonical.summary.ticketCount ?? 0) });
      const financeState = (payload: any) => ({ financedLines: Number(payload?.summary?.financedTicketCount || 0), financedAmount: Number(payload?.summary?.financeAmount || 0), financeFee: Number(payload?.summary?.financeFee || 0), financeBalance: 0 });
      setFinance(financeState(canonical)); setFinanceCompare(financeState(canonicalCompare || canonical));
      setLowMarginData((canonical.detail?.rows || []).filter((row: any) => row.profit != null && row.sales).map((row: any) => ({ saleId: row.saleId, saleDate: row.deliveredDate, salesperson: row.salesperson, grandTotal: row.sales, profit: row.profit, marginPct: row.profit / row.sales * 100 })).sort((a: any, b: any) => a.marginPct - b.marginPct));
      setReportDataSalesperson(stateFor(peopleRows)); setReportDataStore(stateFor(storeRows));
      setReportOverallRowsSalesperson(peopleRows); setReportOverallRowsStore(storeRows);
      setReportDataSalespersonCompare({ ...stateFor(comparePeopleRows), distinctTicketCount: Number(canonicalCompare?.summary?.ticketCount || 0) });
      setReportDataStoreCompare({ ...stateFor(compareStoreRows), distinctTicketCount: Number(canonicalCompare?.summary?.ticketCount || 0) });
      setReportOverallRowsSalespersonCompare(comparePeopleRows); setReportOverallRowsStoreCompare(compareStoreRows);
      setReportOverallTotals({ totalRetail: Number(canonical.summary.itemSales || 0), totalUnits: Number(canonical.summary.quantity || 0) });
      setReportOverallTotalsCompare({ totalRetail: Number(canonicalCompare?.summary?.itemSales || 0), totalUnits: Number(canonicalCompare?.summary?.quantity || 0) });
      setReportData(reportDimension === "store" ? stateFor(storeRows) : stateFor(peopleRows));
      setBestSellers(sellerRows(canonical)); setBestSellersCompare(sellerRows(canonicalCompare));
      setTopCategories(simpleRows("category", canonical) as TopCategoryRow[]); setTopCategoriesCompare(simpleRows("category", canonicalCompare) as TopCategoryRow[]);
      setTopManufacturers(simpleRows("manufacturer", canonical) as TopManufacturerRow[]); setTopManufacturersCompare(simpleRows("manufacturer", canonicalCompare) as TopManufacturerRow[]);
      const proState = (payload: any): Pro1stStats => ({ totalSales: Number(payload?.pro1st?.eligibleSales || 0), proSales: Number(payload?.pro1st?.sales || 0), attachRate: Number(payload?.pro1st?.penetrationPct || 0), saleIds: [], saleIdsLow: [], saleIdsMid: [], saleIdsHigh: [] });
      setPro1stStats(proState(canonical)); setPro1stStatsCompare(proState(canonicalCompare));
      setSalespersonTickets([]);
      setTrendData((canonical.series.day || []).map((row: any) => ({ day: row.label, furnitureSales: Number(row.sales || 0), mattressBoxSpringAdjustableSales: 0, averageDailyAdSpend: null })));
      setTrendCompareData((canonicalCompare?.series?.day || []).map((row: any) => ({ day: row.label, furnitureSales: Number(row.sales || 0), mattressBoxSpringAdjustableSales: 0, averageDailyAdSpend: null })));
      setExpandedManufacturers({}); setManufacturerItems({}); setManufacturerLoading({}); setExpandedCategories({}); setCategoryItems({}); setCategoryLoading({});
      setCanonicalWarnings({
        openDeliveredTickets: Number(canonical?.warnings?.openDeliveredTickets || 0),
        duplicateItemLines: Number(canonical?.warnings?.duplicateItemLines || 0),
        twoPersonTickets: Number(canonical?.warnings?.twoPersonTickets || 0),
      });
      setCanonicalMissingCostCount(Number(canonical?.missingCosts?.count || 0));
      setCanonicalDetail({ total: Number(canonical?.detail?.total || 0), page: Number(canonical?.detail?.page || 1), pageSize: Number(canonical?.detail?.pageSize || 100), rows: canonical?.detail?.rows || [] });
    } catch (e) {
      console.error(e);
      setError(`Couldn’t load POS data. Confirm the backend API is running at ${getPosApiBaseUrl()}`);
      // Reset all data on error
      setSalesData([]);
      setSalesDataCompare([]);
      setStoreData([]);
      setStoreDataCompare([]);
      setSummary({ sales: 0, lines: 0 });
      setSummaryCompare({ sales: 0, lines: 0 });
      setFinance({
        financedLines: 0,
        financedAmount: 0,
        financeFee: 0,
        financeBalance: 0,
      });
      setFinanceCompare({
        financedLines: 0,
        financedAmount: 0,
        financeFee: 0,
        financeBalance: 0,
      });
      setLowMarginData([]);
      setReportData({
        rows: [],
        distinctTicketCount: 0,
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportDataSalesperson({
        rows: [],
        distinctTicketCount: 0,
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportDataStore({
        rows: [],
        distinctTicketCount: 0,
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportDataSalespersonCompare({
        rows: [],
        distinctTicketCount: 0,
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportDataStoreCompare({
        rows: [],
        distinctTicketCount: 0,
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportOverallRowsSalesperson([]);
      setReportOverallRowsStore([]);
      setReportOverallRowsSalespersonCompare([]);
      setReportOverallRowsStoreCompare([]);
      setReportOverallTotals({ totalRetail: 0, totalUnits: 0 });
      setReportOverallTotalsCompare({ totalRetail: 0, totalUnits: 0 });
      setBestSellers([]);
      setBestSellersCompare([]);
      setTopCategories([]);
      setTopCategoriesCompare([]);
      setTopManufacturers([]);
      setTopManufacturersCompare([]);
      setPro1stStats(EMPTY_PRO1ST_STATS);
      setPro1stStatsCompare(EMPTY_PRO1ST_STATS);
      setSalespersonTickets([]);
      setExpandedManufacturers({});
      setManufacturerItems({});
      setManufacturerLoading({});
      setExpandedCategories({});
      setCategoryItems({});
      setCategoryLoading({});
      setSalePeopleMap({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    currentRangeInput,
    compareRangeInput,
    compareEnabled,
    selectedSalesperson,
    selectedStore,
    itemSortMetric,
    reportDimension,
    activeReportCategories,
    reportManufacturer,
    dateBasis,
  ]);

  useEffect(() => {
    const handler = () => {
      setPrintDialogOpen(true);
    };
    window.addEventListener("fd-print-request", handler as EventListener);
    return () => window.removeEventListener("fd-print-request", handler as EventListener);
  }, []);

  const runPrint = async () => {
    setPrintLoading(true);
    setActivePosDateBasis(dateBasis);
    const printWindow = openSalesPrintWindowShell();
    try {
      const currentRange = currentRangeInput;
      if (!currentRange) return;
      const salesperson = selectedSalesperson ? selectedSalesperson : undefined;
      const location = selectedStore ? selectedStore : undefined;

      const canonicalRows = (payload: any, dimension: "store" | "salesperson"): ReportSummaryRow[] =>
        (payload?.series?.[dimension] || []).map((row: any) => ({
          label: row.label,
          ticketCount: Number(row.ticketCount || 0),
          totalRetail: Number(row.sales || 0),
          pro1stSales: 0,
          units: Number(row.quantity || 0),
          avgMarginPct: row.marginPct == null ? null : Number(row.marginPct),
        }));
      const canonicalRequest = (extra: Record<string, unknown> = {}) => fetchSalesAnalysisReport({
        start: currentRange.start,
        endInclusive: addDaysYmd(currentRange.endExclusive, -1),
        page: 1,
        pageSize: 500,
        salesperson,
        store: location,
        ...extra,
      });
      const [filteredReport, overallReport] = await Promise.all([
        canonicalRequest({
          manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
          category: activeReportCategories.length === 1 ? activeReportCategories[0] : undefined,
        }),
        canonicalRequest(),
      ]);
      const storeSummary = { rows: canonicalRows(filteredReport, "store"), distinctTicketCount: Number(filteredReport.summary?.ticketCount || 0) };
      const salespersonSummary = { rows: canonicalRows(filteredReport, "salesperson"), distinctTicketCount: Number(filteredReport.summary?.ticketCount || 0) };
      const storeOverallSummary = { rows: canonicalRows(overallReport, "store"), distinctTicketCount: Number(overallReport.summary?.ticketCount || 0) };
      const salespersonOverallSummary = { rows: canonicalRows(overallReport, "salesperson"), distinctTicketCount: Number(overallReport.summary?.ticketCount || 0) };
      const lowMarginSummary = { rows: (filteredReport.detail?.rows || [])
        .filter((row: any) => row.profit != null && row.sales)
        .map((row: any) => ({ saleId: row.saleId, saleDate: row.deliveredDate, salesperson: row.salesperson,
          grandTotal: Number(row.sales || 0), profit: Number(row.profit || 0), marginPct: Number(row.profit || 0) / Number(row.sales || 1) * 100 })) };

      const manufacturers = reportManufacturerOptions.filter((m) => m && m !== "ALL");
      const categories = reportCategoryOptions.filter((c) => c && c !== "ALL");

      const manufacturerBreakdowns = printIncludeManufacturer
        ? await Promise.all(manufacturers.map(async (m) => {
            const payload = await canonicalRequest({ manufacturer: m });
            return { label: m, storeRows: canonicalRows(payload, "store"), salespersonRows: canonicalRows(payload, "salesperson") };
          }))
        : [];

      const categoryBreakdowns = printIncludeCategory
        ? await Promise.all(categories.map(async (c) => {
            const payload = await canonicalRequest({ category: c });
            return { label: c, storeRows: canonicalRows(payload, "store"), salespersonRows: canonicalRows(payload, "salesperson") };
          }))
        : [];

      setPrintData({
        lowMarginRows: lowMarginSummary.rows,
        storeRows: storeSummary.rows,
        storeDistinctTicketCount: storeSummary.distinctTicketCount,
        salespersonRows: salespersonSummary.rows,
        salespersonDistinctTicketCount: salespersonSummary.distinctTicketCount,
        storeOverallRows: storeOverallSummary.rows,
        salespersonOverallRows: salespersonOverallSummary.rows,
        manufacturerBreakdowns,
        categoryBreakdowns,
      });
      setPrintDialogOpen(false);
      if (printWindow) {
        renderSalesPrintWindow(printWindow, {
        rangeLabel: printRangeA,
        compareLabel: printRangeB || undefined,
        generatedAt: new Date(),
        selectedSalesperson,
        selectedStore,
        drilldownProps: {
          printIncludeManufacturer,
          printIncludeCategory,
          printData: {
            manufacturerBreakdowns,
            categoryBreakdowns,
          },
          printStoreOverallMap: new Map(storeOverallSummary.rows.map((row) => [row.label, row])),
          printSalesOverallMap: new Map(salespersonOverallSummary.rows.map((row) => [row.label, row])),
          printOverallTotals: computeReportTotals(storeOverallSummary.rows),
        },
        coreProps: {
          printIncludeLowMargin,
          printIncludeStore,
          printIncludeSalesperson,
          printLowMarginFiltered: lowMarginSummary.rows.filter((row) => {
            const total = Number(row.grandTotal || 0);
            const profit = Number(row.profit || 0);
            const margin = row.marginPct === null ? 0 : Number(row.marginPct || 0);
            return !(total === 0 && profit === 0 && margin === 0);
          }),
          printStoreFiltered: sortReportRows(
            withReportPercentages(
              storeSummary.rows,
              computeReportTotals(storeSummary.rows, storeSummary.distinctTicketCount),
              new Map(storeOverallSummary.rows.map((row) => [row.label, row])),
              computeReportTotals(storeOverallSummary.rows)
            ).filter((row) => {
              const retail = Number(row.totalRetail || 0);
              const units = Number(row.units || 0);
              const tickets = Number(row.ticketCount || 0);
              const retailPct = Number(row.retailPct || 0);
              const unitsPct = Number(row.unitsPct || 0);
              return !(retail === 0 && units === 0 && tickets === 0) && !(retailPct === 0 && unitsPct === 0);
            }),
            itemSortMetric
          ),
          printSalespersonFiltered: sortReportRows(
            withReportPercentages(
              salespersonSummary.rows,
              computeReportTotals(salespersonSummary.rows, salespersonSummary.distinctTicketCount),
              new Map(salespersonOverallSummary.rows.map((row) => [row.label, row])),
              computeReportTotals(storeOverallSummary.rows)
            ).filter((row) => {
              const retail = Number(row.totalRetail || 0);
              const units = Number(row.units || 0);
              const tickets = Number(row.ticketCount || 0);
              const retailPct = Number(row.retailPct || 0);
              const unitsPct = Number(row.unitsPct || 0);
              return !(retail === 0 && units === 0 && tickets === 0) && !(retailPct === 0 && unitsPct === 0);
            }),
            itemSortMetric
          ),
          printTotalsStore: computeReportTotals(storeSummary.rows, storeSummary.distinctTicketCount),
          printTotalsSalesperson: computeReportTotals(
            salespersonSummary.rows,
            salespersonSummary.distinctTicketCount
          ),
          printOverallRetailTotal: Number(computeReportTotals(storeOverallSummary.rows).totalRetail || 0),
          printOverallUnitsTotal: Number(computeReportTotals(storeOverallSummary.rows).totalUnits || 0),
          saleLabel,
          formatShortDate,
          formatMarginPct,
        },
        });
      }
    } catch (error) {
      if (printWindow) {
        const message = error instanceof Error ? error.message : "The report could not be loaded. Please try again.";
        renderSalesPrintError(printWindow, message);
      }
      console.error("Sales Analysis print failed", error);
    } finally {
      setPrintLoading(false);
    }
  };

  const normalizeTrendRows = (proRows: Awaited<ReturnType<typeof fetchPro1stTrend>>): TrendPoint[] =>
    proRows
      .filter((r) => r.day)
      .map((r) => ({
        day: String(r.day).includes("T") ? String(r.day).slice(0, 10) : String(r.day),
        furnitureSales: Number.isFinite(r.furnitureSales) ? r.furnitureSales : 0,
        mattressBoxSpringAdjustableSales: Number.isFinite(r.mattressBoxSpringAdjustableSales)
          ? r.mattressBoxSpringAdjustableSales
          : 0,
        averageDailyAdSpend:
          r.averageDailyAdSpend === null || r.averageDailyAdSpend === undefined
            ? null
            : Number.isFinite(r.averageDailyAdSpend)
              ? r.averageDailyAdSpend
              : 0,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

  useEffect(() => {
    // Trend series is populated by the canonical report call in loadData.
  }, [currentRangeInput, compareRangeInput, selectedSalesperson, selectedStore, dateBasis]);

  const displayTrendData = useMemo<DisplayTrendPoint[]>(() => {
    const rangeStart = currentRange.start;
    const rangeEnd = currentRange.endExclusive;
    const inRange = (day: string) => day >= rangeStart && day < rangeEnd;
    const filtered = trendData.filter((row) => row.day && inRange(row.day));
    const visible = trendFocusDay ? filtered.filter((row) => row.day === trendFocusDay) : filtered;
    if (!compareRangeInput || !trendCompareData.length) return visible;
    const compareRows = trendCompareData.filter((row) => row.day);
    return visible.map((row) => {
      const currentIndex = filtered.findIndex((candidate) => candidate.day === row.day);
      const compareRow = currentIndex >= 0 ? compareRows[currentIndex] : undefined;
      return {
        ...row,
        compareDay: compareRow?.day,
        compareFurnitureSales: compareRow ? compareRow.furnitureSales : null,
        compareAverageDailyAdSpend: compareRow ? compareRow.averageDailyAdSpend : null,
      };
    });
  }, [trendData, trendCompareData, trendFocusDay, currentRange.start, currentRange.endExclusive, compareRangeInput]);
  const trendXAxisPadding = displayTrendData.length <= 2 ? { left: 80, right: 80 } : { left: 10, right: 10 };

  const revenuePct = pctChange(summary.sales, summaryCompare.sales);
  const linesPct = pctChange(summary.lines, summaryCompare.lines);

  const revenueUp = revenuePct >= 0;
  const linesUp = linesPct >= 0;
  const financePenetration = summary.lines > 0 ? (finance.financedLines / summary.lines) * 100 : 0;
  const financeAmountPctOfSales = summary.sales > 0 ? (finance.financedAmount / summary.sales) * 100 : 0;
  const financePenetrationCompare =
    summaryCompare.lines > 0 ? (financeCompare.financedLines / summaryCompare.lines) * 100 : 0;
  const financeAmountPctOfSalesCompare =
    summaryCompare.sales > 0 ? (financeCompare.financedAmount / summaryCompare.sales) * 100 : 0;
  const hasCompare = compareHint.trim().length > 0;
  const financedLinesPct = pctChange(finance.financedLines, financeCompare.financedLines);
  const financedAmountPct = pctChange(finance.financedAmount, financeCompare.financedAmount);

  const financedLinesUp = financedLinesPct >= 0;
  const financedAmountUp = financedAmountPct >= 0;

  const avgTicket = safeDiv(summary.sales, summary.lines);
  const avgTicketCompare = safeDiv(summaryCompare.sales, summaryCompare.lines);

  const avgTicketPct = pctChange(avgTicket, avgTicketCompare);

  const avgTicketUp = avgTicketPct >= 0;
  const formatCompareCurrency = (value: number) =>
    `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatCompareNumber = (value: number) =>
    Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const renderMetricComparison = (current: number, previous: number, previousLabel: string) => {
    if (!hasCompare) return null;
    const display = getMetricComparisonDisplay(current, previous, `vs ${previousLabel}`);
    const isUp = display.direction === "up";
    return (
      <div className={`mt-2 flex items-center text-xs ${isUp ? "text-green-600" : "text-red-500"}`}>
        {isUp ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
        <span className="font-medium">{display.absLabel}</span>
        <span className="ml-1">{display.compareLabel}</span>
      </div>
    );
  };
  const salesOverviewPrimaryIsQty = itemSortMetric === "qty";
  const salesOverviewPrimaryLabel = salesOverviewPrimaryIsQty ? "Transactions" : "Total Sales";
  const salesOverviewPrimaryValue = salesOverviewPrimaryIsQty
    ? summary.lines.toLocaleString()
    : `$${summary.sales.toLocaleString()}`;
  const salesOverviewPrimaryPct = salesOverviewPrimaryIsQty ? linesPct : revenuePct;
  const salesOverviewPrimaryUp = salesOverviewPrimaryIsQty ? linesUp : revenueUp;
  const financeOverviewPrimaryIsQty = itemSortMetric === "qty";
  const financeOverviewPrimaryLabel = financeOverviewPrimaryIsQty ? "Financed Transactions" : "Financed Amount";
  const financeOverviewPrimaryValue = financeOverviewPrimaryIsQty
    ? finance.financedLines.toLocaleString()
    : `$${finance.financedAmount.toLocaleString()}`;
  const financeOverviewPrimaryPct = financeOverviewPrimaryIsQty ? financedLinesPct : financedAmountPct;
  const financeOverviewPrimaryUp = financeOverviewPrimaryIsQty ? financedLinesUp : financedAmountUp;
  const rangeLabel = useMemo(() => {
    if (!currentRangeInput) return "Invalid Range";
    if (currentRangeInput.start === addDaysYmd(currentRangeInput.endExclusive, -1)) {
      return formatShortDate(currentRangeInput.start);
    }
    return formatRangeLabel(currentRangeInput);
  }, [currentRangeInput]);

  const printRangeA = useMemo(() => {
    const r = currentRangeInput;
    return r ? formatRangeLabel(r) : "";
  }, [currentRangeInput]);

  const printRangeB = useMemo(() => {
    const r = compareRangeInput;
    return r ? formatRangeLabel(r) : "";
  }, [compareRangeInput]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fd-range", { detail: { label: rangeLabel } }));
  }, [rangeLabel]);

  useEffect(() => {
    const handler = () => {
      const el = document.getElementById("fd-range-selector");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      (el as HTMLSelectElement).focus?.();
    };
    window.addEventListener("fd-open-range", handler as EventListener);
    return () => window.removeEventListener("fd-open-range", handler as EventListener);
  }, []);
  const saleLink = (saleId: string) =>
    `https://www.gimmethebest.net/furnituredistributors/online/sale_rec_502.asp?saleid=${saleId.padStart(5, "0")}&type=1`;
  const limitSaleLinks = (ids: string[], max = 6) => {
    const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
    return { ids: unique.slice(0, max), remaining: Math.max(0, unique.length - max) };
  };
  const saleLabel = (saleId: string, salesperson?: string) => {
    const name = salesperson ?? salePeopleMap[saleId] ?? "";
    const initials = name ? salespersonLabel(name) : "";
    return initials ? `${saleId} · ${initials}` : saleId;
  };
  const syncSalePeople = async (ids: string[]) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    const missing = unique.filter((id) => !(id in salePeopleMap));
    if (!missing.length) return;
    try {
      const map = await fetchSalespeopleBySaleIds(missing);
      setSalePeopleMap((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.error(e);
    }
  };
  const normalizeName = (value: string | null | undefined) => String(value || "").trim();
  const selectSalesperson = (name: string) => {
    const next = normalizeName(name);
    setSelectedSalesperson((prev) => (normalizeName(prev) === next ? null : next));
    setSelectedStore(null);
    setSelectedTrendDay(null);
    setSearchHint(null);
  };
  const openSalespersonDetail = (name: string) => {
    const next = normalizeName(name);
    if (!next) return;
    setSelectedSalesperson(next);
    setSelectedStore(null);
    setSelectedTrendDay(null);
    setSearchHint(null);
  };
  const openStoreDetail = (name: string) => {
    const next = normalizeName(name);
    if (!next) return;
    setSelectedStore(next);
    setSelectedSalesperson(null);
    setSelectedTrendDay(null);
    setSearchHint(null);
  };
  const selectStore = (name: string) => {
    const next = normalizeName(name);
    setSelectedStore((prev) => (normalizeName(prev) === next ? null : next));
    setSelectedSalesperson(null);
    setSelectedTrendDay(null);
    setSearchHint(null);
  };

  useEffect(() => {
    if ((!selectedSalesperson && !selectedStore && !selectedTrendDay) || !salespersonDetailRef.current) return;
    window.requestAnimationFrame(() => {
      salespersonDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedSalesperson, selectedStore, selectedTrendDay]);

  useEffect(() => {
    if (!selectedTrendDay) {
      setTrendDayTickets([]);
      setTrendDayTicketsError(null);
      return;
    }
    let cancelled = false;
    const dayEnd = addDaysYmd(selectedTrendDay, 1);
    setTrendDayTicketsLoading(true);
    setTrendDayTicketsError(null);
    setActivePosDateBasis(dateBasis);
    fetchSalesAnalysisReport({
      start: selectedTrendDay,
      endInclusive: selectedTrendDay,
      salesperson: selectedSalesperson || undefined,
      store: selectedStore || undefined,
      pageSize: 500,
    })
      .then((payload) => {
        const rows = (payload.detail?.rows || []).map((row: any) => ({ saleId: row.saleId, saleDate: row.deliveredDate,
          salesperson: row.salesperson || "", location: row.store || "", receiptNo: "", customerName: "",
          grandTotal: Number(row.sales || 0), profit: Number(row.profit || 0), marginPct: row.profit == null || !row.sales ? null : row.profit / row.sales * 100,
          pro1stSales: 0, pro1stPct: null }));
        if (!cancelled) setTrendDayTickets(rows);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setTrendDayTickets([]);
          setTrendDayTicketsError("Couldn’t load tickets for that day.");
        }
      })
      .finally(() => {
        if (!cancelled) setTrendDayTicketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTrendDay, selectedSalesperson, selectedStore, dateBasis]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { query?: string } | undefined;
      const query = detail?.query?.trim();
      if (!query) return;
      const q = query.toLowerCase();
      if (/^\d{3,}$/.test(query)) {
        window.open(saleLink(query), "_blank", "noopener,noreferrer");
        setSearchHint(`Opened ticket ${query}.`);
        return;
      }
      const salespersonMatch = salesData.find((s) => s.fullName.toLowerCase().includes(q));
      if (salespersonMatch) {
        selectSalesperson(salespersonMatch.fullName);
        return;
      }
      const storeMatch = storeData.find((s) => s.storeName.toLowerCase().includes(q));
      if (storeMatch) {
        selectStore(storeMatch.storeName);
        return;
      }
      setSearchHint(`No salesperson or store matched "${query}".`);
    };
    window.addEventListener("fd-search", handler as EventListener);
    return () => window.removeEventListener("fd-search", handler as EventListener);
  }, [salesData, storeData]);
  const toggleManufacturer = async (name: string) => {
    if (!name) return;
    setExpandedManufacturers((prev) => ({ ...prev, [name]: !prev[name] }));
    if (manufacturerItems[name]) return;
    setManufacturerLoading((prev) => ({ ...prev, [name]: true }));
    try {
      const payload = await fetchSalesAnalysisReport({
        start: currentRange.start,
        endInclusive: addDaysYmd(currentRange.endExclusive, -1),
        manufacturer: name,
        pageSize: 500,
        store: selectedStore || undefined,
        salesperson: selectedSalesperson || undefined,
      });
      const list = (payload.series?.item || []).slice(0, 10).map((row: any) => ({ itemNo: row.label, itemDescription: row.description || row.label,
        category: row.category || "(unknown)", manufacturer: name, qty: Number(row.quantity || 0), sales: Number(row.sales || 0), saleIds: [] }));
      setManufacturerItems((prev) => ({ ...prev, [name]: list }));
      const ids = list.flatMap((item) => item.saleIds || []);
      void syncSalePeople(ids);
    } catch (e) {
      console.error(e);
    } finally {
      setManufacturerLoading((prev) => ({ ...prev, [name]: false }));
    }
  };
  const toggleCategory = async (name: string) => {
    if (!name) return;
    setExpandedCategories((prev) => ({ ...prev, [name]: !prev[name] }));
    if (categoryItems[name]) return;
    setCategoryLoading((prev) => ({ ...prev, [name]: true }));
    try {
      const payload = await fetchSalesAnalysisReport({
        start: currentRange.start,
        endInclusive: addDaysYmd(currentRange.endExclusive, -1),
        category: name,
        pageSize: 500,
        store: selectedStore || undefined,
        salesperson: selectedSalesperson || undefined,
      });
      const list = (payload.series?.item || []).slice(0, 10).map((row: any) => ({ itemNo: row.label, itemDescription: row.description || row.label,
        category: name, manufacturer: row.manufacturer || "(unknown)", qty: Number(row.quantity || 0), sales: Number(row.sales || 0), saleIds: [] }));
      setCategoryItems((prev) => ({ ...prev, [name]: list }));
      const ids = list.flatMap((item) => item.saleIds || []);
      void syncSalePeople(ids);
    } catch (e) {
      console.error(e);
    } finally {
      setCategoryLoading((prev) => ({ ...prev, [name]: false }));
    }
  };

  useEffect(() => {
    const handler = () => {
      void loadData();
    };
    window.addEventListener("fd-refresh-data", handler);
    return () => window.removeEventListener("fd-refresh-data", handler);
  }, [currentRangeInput, compareRangeInput, compareEnabled, selectedSalesperson, selectedStore, itemSortMetric, dateBasis]);

  const hasItemData = pro1stStats.totalSales > 0;
  const missingItemData = summary.lines > 0 && !hasItemData;
  const missingSalesData = summary.lines === 0 || summary.sales === 0;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fd-items-missing", { detail: { missing: missingItemData } }));
  }, [missingItemData]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fd-sales-missing", { detail: { missing: missingSalesData } }));
  }, [missingSalesData]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("fd-filter", {
        detail: { salesperson: selectedSalesperson || "", store: selectedStore || "" },
      })
    );
  }, [selectedSalesperson, selectedStore]);

  useEffect(() => {
    const handler = () => {
      setSelectedSalesperson(null);
      setSelectedStore(null);
      setSelectedTrendDay(null);
      setSearchHint(null);
    };
    window.addEventListener("fd-clear-filters", handler as EventListener);
    return () => window.removeEventListener("fd-clear-filters", handler as EventListener);
  }, []);

  const renderStatCard = (id: string) => {
    switch (id) {
      case "range-selector":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center space-y-4 relative fd-print-card h-full"
            data-print-id="range-selector"
            data-tour-id="sales-date-range"
           
           
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Date Range</p>
              {renderCardToggle("range-selector")}
            </div>
            {!isCardCollapsed("range-selector") && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      !compareEnabled
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompareEnabled(false);
                      setYearB(null);
                      setMonthB("ALL");
                      setDayB("ALL");
                    }}
                  >
                    Range Only
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      compareEnabled
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompareEnabled(true);
                    }}
                  >
                    Compare
                  </button>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Range A (Main)</label>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        rangeModeA === "preset"
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => setRangeModeA("preset")}
                    >
                      Preset
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        rangeModeA === "custom"
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={switchRangeAToCustom}
                    >
                      Custom
                    </button>
                  </div>
                  {rangeModeA === "preset" ? (
                    <div className="grid grid-cols-3 gap-2">
                      <select value={yearA} onChange={(e) => setYearA(Number(e.target.value))} className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2">
                        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select value={monthA} onChange={(e) => { setMonthA(e.target.value); if (e.target.value === "ALL") setDayA("ALL"); }} className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2">
                        <option value="ALL">All Months</option>
                        {monthOptions.map((m) => <option key={m} value={m}>{new Date(2024, parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "short" })}</option>)}
                      </select>
                      <select value={dayA} onChange={(e) => setDayA(e.target.value)} disabled={monthA === "ALL"} className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 disabled:opacity-50">
                        <option value="ALL">All Days</option>
                        {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={customStartA}
                        onChange={(e) => setCustomStartA(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
                      />
                      <input
                        type="date"
                        value={customEndA}
                        min={customStartA || undefined}
                        onChange={(e) => setCustomEndA(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
                      />
                    </div>
                  )}
                </div>
                {compareEnabled && (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Range B (Compare)</label>
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          rangeModeB === "preset"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                        onClick={() => setRangeModeB("preset")}
                      >
                        Preset
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          rangeModeB === "custom"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                        onClick={switchRangeBToCustom}
                      >
                        Custom
                      </button>
                    </div>
                    {rangeModeB === "preset" ? (
                      <div className="grid grid-cols-3 gap-2">
                        <select value={yearB || ""} onChange={(e) => setYearB(e.target.value ? Number(e.target.value) : null)} className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2">
                          <option value="">None</option>
                          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={monthB} onChange={(e) => { setMonthB(e.target.value); if (e.target.value === "ALL") setDayB("ALL"); }} disabled={!yearB} className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 disabled:opacity-50">
                          <option value="ALL">All Months</option>
                          {monthOptions.map((m) => <option key={m} value={m}>{new Date(2024, parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "short" })}</option>)}
                        </select>
                        <select value={dayB} onChange={(e) => setDayB(e.target.value)} disabled={!yearB || monthB === "ALL"} className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 disabled:opacity-50">
                          <option value="ALL">All Days</option>
                          {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={customStartB}
                          onChange={(e) => setCustomStartB(e.target.value)}
                          className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
                        />
                        <input
                          type="date"
                          value={customEndB}
                          min={customStartB || undefined}
                          onChange={(e) => setCustomEndB(e.target.value)}
                          className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case "sales-overview":
      case "transactions":
      case "total-sales":
      case "avg-ticket":
      case "average-ticket":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card h-full"
            data-print-id="sales-overview"
            data-tour-id="sales-overview"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Sales Overview
                {renderHelp(
                  "The main number follows the header toggle: Sales shows revenue first, and QTY shows transaction count first."
                )}
              </p>
              {renderCardToggle("sales-overview")}
            </div>
            {!isCardCollapsed("sales-overview") && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {salesOverviewPrimaryLabel}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800">{salesOverviewPrimaryValue}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {salesOverviewPrimaryIsQty ? "QTY mode is showing transaction count first." : "Sales mode is showing revenue first."}
                    </p>
                    {hasCompare && (
                      <div className={`flex items-center text-sm mt-2 ${salesOverviewPrimaryUp ? "text-green-600" : "text-red-500"}`}>
                        {salesOverviewPrimaryUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                        <span className="font-medium">{Math.abs(salesOverviewPrimaryPct).toFixed(1)}%</span>
                        <span className="ml-1">
                          vs {salesOverviewPrimaryIsQty ? formatCompareNumber(summaryCompare.lines) : formatCompareCurrency(summaryCompare.sales)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`p-3 rounded-full ${salesOverviewPrimaryIsQty ? "bg-slate-50 text-slate-700" : "bg-blue-50 text-blue-600"}`}>
                    {salesOverviewPrimaryIsQty ? <Database size={24} /> : <ShoppingBag size={24} />}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {salesOverviewPrimaryIsQty ? "Total Sales" : "Transactions"}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-800">
                      {salesOverviewPrimaryIsQty ? `$${summary.sales.toLocaleString()}` : summary.lines.toLocaleString()}
                    </div>
                    {renderMetricComparison(
                      salesOverviewPrimaryIsQty ? summary.sales : summary.lines,
                      salesOverviewPrimaryIsQty ? summaryCompare.sales : summaryCompare.lines,
                      salesOverviewPrimaryIsQty ? formatCompareCurrency(summaryCompare.sales) : formatCompareNumber(summaryCompare.lines)
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Average Ticket</div>
                    <div className="mt-1 text-lg font-semibold text-slate-800">
                      ${avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    {renderMetricComparison(avgTicket, avgTicketCompare, formatCompareCurrency(avgTicketCompare))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "finance-overview":
      case "financed-amount":
      case "financed-transactions":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card h-full"
            data-print-id="finance-overview"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Finance Overview
                {renderHelp(
                  "The main number follows the header toggle: Sales shows financed dollars first, and QTY shows financed transaction count first."
                )}
              </p>
              {renderCardToggle("finance-overview")}
            </div>
            {!isCardCollapsed("finance-overview") && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {financeOverviewPrimaryLabel}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800">{financeOverviewPrimaryValue}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {financeOverviewPrimaryIsQty
                        ? `${financePenetration.toFixed(1)}% of transactions financed`
                        : `${financeAmountPctOfSales.toFixed(1)}% of sales financed`}
                    </p>
                    {hasCompare && (
                      <div className={`flex items-center text-sm mt-2 ${financeOverviewPrimaryUp ? "text-green-600" : "text-red-500"}`}>
                        {financeOverviewPrimaryUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                        <span className="font-medium">{Math.abs(financeOverviewPrimaryPct).toFixed(1)}%</span>
                        <span className="ml-1">
                          vs {financeOverviewPrimaryIsQty ? formatCompareNumber(financeCompare.financedLines) : formatCompareCurrency(financeCompare.financedAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`p-3 rounded-full ${financeOverviewPrimaryIsQty ? "bg-slate-50 text-slate-700" : "bg-emerald-50 text-emerald-600"}`}>
                    {financeOverviewPrimaryIsQty ? <Database size={24} /> : <ShoppingBag size={24} />}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {financeOverviewPrimaryIsQty ? "Financed Amount" : "Financed Transactions"}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-800">
                      {financeOverviewPrimaryIsQty ? `$${finance.financedAmount.toLocaleString()}` : finance.financedLines.toLocaleString()}
                    </div>
                    {renderMetricComparison(
                      financeOverviewPrimaryIsQty ? finance.financedAmount : finance.financedLines,
                      financeOverviewPrimaryIsQty ? financeCompare.financedAmount : financeCompare.financedLines,
                      financeOverviewPrimaryIsQty ? formatCompareCurrency(financeCompare.financedAmount) : formatCompareNumber(financeCompare.financedLines)
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Finance Cost</div>
                    <div className="mt-1 text-lg font-semibold text-slate-800">
                      ${finance.financeFee.toLocaleString()}
                    </div>
                    {renderMetricComparison(finance.financeFee, financeCompare.financeFee, formatCompareCurrency(financeCompare.financeFee))}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {financeOverviewPrimaryIsQty ? "Sales Financed" : "Transaction Penetration"}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-800">
                      {financeOverviewPrimaryIsQty ? `${financeAmountPctOfSales.toFixed(1)}%` : `${financePenetration.toFixed(1)}%`}
                    </div>
                    {renderMetricComparison(
                      financeOverviewPrimaryIsQty ? financeAmountPctOfSales : financePenetration,
                      financeOverviewPrimaryIsQty ? financeAmountPctOfSalesCompare : financePenetrationCompare,
                      `${(financeOverviewPrimaryIsQty ? financeAmountPctOfSalesCompare : financePenetrationCompare).toFixed(1)}%`
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const loadCanonicalDetailPage = async (page: number) => {
    const range = currentRangeInput;
    if (!range || page < 1) return;
    setCanonicalDetailLoading(true);
    try {
      const payload = await fetchSalesAnalysisReport({
        start: range.start,
        endInclusive: addDaysYmd(range.endExclusive, -1),
        page,
        pageSize: canonicalDetail.pageSize,
        salesperson: selectedSalesperson || undefined,
        store: selectedStore || undefined,
        manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
        category: activeReportCategories.length === 1 ? activeReportCategories[0] : undefined,
      });
      setCanonicalDetail({
        total: Number(payload?.detail?.total || 0),
        page: Number(payload?.detail?.page || page),
        pageSize: Number(payload?.detail?.pageSize || canonicalDetail.pageSize),
        rows: payload?.detail?.rows || [],
      });
    } catch (e) {
      console.error(e);
      setError(`Couldnâ€™t load sales detail from ${getPosApiBaseUrl()}`);
    } finally {
      setCanonicalDetailLoading(false);
    }
  };

  const renderDashboardCard = (id: string) => {
    switch (id) {
      case "range-selector":
      case "sales-overview":
      case "finance-overview":
        return renderStatCard(id);
      case "sales-report":
        return (
      <div data-tour-id="sales-report-card">
        <SalesReportCard
          collapsed={isCardCollapsed("sales-report")}
          renderHelp={renderHelp}
          cardToggle={renderCardToggle("sales-report")}
          itemSortMetric={itemSortMetric}
          reportMode={reportMode}
          setReportMode={setReportMode}
          reportDimension={reportDimension}
          setReportDimension={setReportDimension}
          reportCategories={activeReportCategories}
          setReportCategories={setReportCategories}
          reportManufacturer={reportManufacturer}
          setReportManufacturer={setReportManufacturer}
          reportCategoryOptions={reportCategoryOptions}
          reportManufacturerOptions={reportManufacturerOptions}
          reportRowsWithPct={reportRowsWithPct}
          compareRowsWithPct={reportRowsWithPctCompare}
          reportTotals={reportTotals}
          compareTotals={reportTotalsCompare}
          reportOverallTotals={reportOverallTotals}
          compareOverallTotals={reportOverallTotalsCompare}
          compareHint={compareHint}
          formatMarginPct={formatMarginPct}
          lowMarginRows={printData?.lowMarginRows ?? sortedLowMarginData}
          lowMarginSort={lowMarginSort}
          setLowMarginSort={setLowMarginSort}
          saleLink={saleLink}
          saleLabel={saleLabel}
          selectedSalesperson={selectedSalesperson}
          selectedStore={selectedStore}
          onSelectSalesperson={openSalespersonDetail}
          onSelectStore={openStoreDetail}
          canonicalMonthLabel={canonicalMonthLabel}
          canonicalWarnings={canonicalWarnings}
          canonicalMissingCostCount={canonicalMissingCostCount}
          canonicalDetail={canonicalDetail}
          canonicalDetailLoading={canonicalDetailLoading}
          onCanonicalDetailPage={loadCanonicalDetailPage}
        />
      </div>
        );
      case "best-sellers":
        return (
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="best-sellers"
          data-tour-id="sales-best-sellers"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div 
              onClick={() => toggleCard("best-sellers")}
              className="cursor-pointer flex-1"
            >
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Best Sellers
                <span className={`text-xs font-normal ${isCardCollapsed("best-sellers") ? "text-slate-400" : "hidden"}`}>(collapsed — click to expand)</span>
                {renderHelp("Based on item report: totals by item description with qty and sales summed in the selected range.")}
              </h3>
              <p className="text-sm text-slate-500">
                Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"} for the selected range.
              </p>
            </div>
            {renderCardToggle("best-sellers")}
          </div>
          {!isCardCollapsed("best-sellers") && (
            bestSellers.length ? (
              <div className="space-y-4">
                {bestSellers.map((item, idx) => {
                  const { ids, remaining } = limitSaleLinks(item.saleIds);
                  const compareItem = bestSellersCompareMap.get(bestSellerKeyFor(item));
                  const primaryValue = itemSortMetric === "qty" ? Number(item.qty || 0) : Number(item.sales || 0);
                  const comparePrimaryValue = itemSortMetric === "qty" ? Number(compareItem?.qty || 0) : Number(compareItem?.sales || 0);
                  return (
                    <div key={`${item.itemDescription}-${idx}`} className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{item.itemDescription || "Unnamed Item"}</div>
                          <div className="text-xs text-slate-500">
                            {(item.category || "Uncategorized").toUpperCase()}
                            {item.manufacturer ? ` · ${item.manufacturer}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-800">{item.qty.toLocaleString()} qty</div>
                          <div className="text-xs text-slate-500">${item.sales.toLocaleString()}</div>
                          {renderMetricComparison(
                            primaryValue,
                            comparePrimaryValue,
                            itemSortMetric === "qty" ? formatCompareNumber(comparePrimaryValue) : formatCompareCurrency(comparePrimaryValue)
                          )}
                        </div>
                      </div>
                      {ids.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {ids.map((sid) => (
                            <a
                              key={sid}
                              href={saleLink(sid)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                            >
                              {saleLabel(sid)}
                            </a>
                          ))}
                          {remaining > 0 && (
                            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                              +{remaining} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No item data available for this range.</p>
            )
          )}
        </div>
        );
      case "top-categories":
        return (
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="top-categories"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div 
              onClick={() => toggleCard("top-categories")}
              className="cursor-pointer flex-1"
            >
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Top Categories
                <span className={`text-xs font-normal ${isCardCollapsed("top-categories") ? "text-slate-400" : "hidden"}`}>(collapsed — click to expand)</span>
                {renderHelp("Based on item report: category totals for qty and sales in the selected range.")}
              </h3>
              <p className="text-sm text-slate-500">
                Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"}.
              </p>
            </div>
            {renderCardToggle("top-categories")}
          </div>
          {!isCardCollapsed("top-categories") && (
            topCategories.length ? (
              <div className="space-y-4">
                {topCategories.map((row) => {
                  const isOpen = !!expandedCategories[row.category];
                  const items = categoryItems[row.category] || [];
                  const loading = categoryLoading[row.category];
                  const compareRow = topCategoriesCompareMap.get(row.category);
                  const primaryValue = itemSortMetric === "qty" ? Number(row.qty || 0) : Number(row.sales || 0);
                  const comparePrimaryValue = itemSortMetric === "qty" ? Number(compareRow?.qty || 0) : Number(compareRow?.sales || 0);
                  return (
                    <div
                      key={row.category}
                      className={`border rounded-lg transition-colors ${
                        isOpen ? "border-blue-200 bg-blue-50/60" : "border-slate-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(row.category)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                          isOpen ? "hover:bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{row.category}</div>
                          <div className="text-xs text-slate-500">{row.qty.toLocaleString()} qty</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-800">${row.sales.toLocaleString()}</div>
                          {renderMetricComparison(
                            primaryValue,
                            comparePrimaryValue,
                            itemSortMetric === "qty" ? formatCompareNumber(comparePrimaryValue) : formatCompareCurrency(comparePrimaryValue)
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          {loading ? (
                            <div className="text-xs text-slate-500">Loading top items…</div>
                          ) : items.length ? (
                            <div className="space-y-3">
                              {items.map((item) => {
                                const { ids, remaining } = limitSaleLinks(item.saleIds);
                                return (
                                  <div key={`${row.category}-${item.itemNo}-${item.itemDescription}`} className="flex flex-col gap-1">
                                    <div className="flex items-start justify-between gap-4 text-sm">
                                      <div>
                                        <div className="font-semibold text-slate-800">{item.itemDescription || "Unnamed Item"}</div>
                                        <div className="text-xs text-slate-500">
                                          {item.manufacturer ? item.manufacturer : "Unknown brand"}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-semibold text-slate-800">{item.qty.toLocaleString()} qty</div>
                                        <div className="text-xs text-slate-500">${item.sales.toLocaleString()}</div>
                                      </div>
                                    </div>
                                    {ids.length > 0 && (
                                      <div className="flex flex-wrap gap-2 text-xs">
                                        {ids.map((sid) => (
                                          <a
                                            key={sid}
                                            href={saleLink(sid)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                                          >
                                          {saleLabel(sid)}
                                          </a>
                                        ))}
                                        {remaining > 0 && (
                                          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                                            +{remaining} more
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">No items for this category.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No category data available for this range.</p>
            )
          )}
        </div>
        );
      case "top-manufacturers":
        return (
        <TopManufacturersCard
          collapsed={isCardCollapsed("top-manufacturers")}
          renderHelp={renderHelp}
          cardToggle={renderCardToggle("top-manufacturers")}
          itemSortMetric={itemSortMetric}
          topManufacturers={topManufacturers}
          compareManufacturers={topManufacturersCompare}
          renderMetricComparison={renderMetricComparison}
          expandedManufacturers={expandedManufacturers}
          manufacturerItems={manufacturerItems}
          manufacturerLoading={manufacturerLoading}
          onToggleManufacturer={toggleManufacturer}
          limitSaleLinks={limitSaleLinks}
          saleLink={saleLink}
          saleLabel={saleLabel}
        />
        );
      case "pro1st-attach":
        return (
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="pro1st-attach"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div 
              onClick={() => toggleCard("pro1st-attach")}
              className="cursor-pointer flex-1"
            >
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Pro1st Attach Rate
                <span className={`text-xs font-normal ${isCardCollapsed("pro1st-attach") ? "text-slate-400" : "hidden"}`}>(collapsed — click to expand)</span>
                {renderHelp("Based on item report: Pro1st item sales ÷ total item sales for the range.")}
              </h3>
              <p className="text-sm text-slate-500">Sales orders that include Pro1st</p>
            </div>
            {renderCardToggle("pro1st-attach")}
          </div>
          {!isCardCollapsed("pro1st-attach") && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {hasItemData ? `${pro1stStats.attachRate.toFixed(1)}%` : "—"}
                  </div>
                  {renderMetricComparison(pro1stStats.attachRate, pro1stStatsCompare.attachRate, `${pro1stStatsCompare.attachRate.toFixed(1)}%`)}
                  <div className="text-xs text-slate-500">
                    {hasItemData ? `$${pro1stStats.proSales.toLocaleString()} of $${pro1stStats.totalSales.toLocaleString()}` : "No item data in this range"}
                  </div>
                  {renderMetricComparison(pro1stStats.proSales, pro1stStatsCompare.proSales, formatCompareCurrency(pro1stStatsCompare.proSales))}
                </div>
              </div>
              {pro1stStats.saleIds.length ? (
                (() => {
                  const tier = (label: string, ids: string[]) => {
                    const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
                    return (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-500">{label}</div>
                        {unique.length ? (
                          <div className="flex flex-wrap gap-2 text-xs max-h-32 overflow-y-auto pr-1">
                            {unique.map((sid) => (
                              <a
                                key={sid}
                                href={saleLink(sid)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                              >
                                {saleLabel(sid)}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">No tickets in this tier.</div>
                        )}
                      </div>
                    );
                  };
                  return (
                    <div className="space-y-4">
                      {tier("200+ profit", pro1stStats.saleIdsHigh)}
                      {tier("100-200 profit", pro1stStats.saleIdsMid)}
                      {tier("Below 100 profit", pro1stStats.saleIdsLow)}
                    </div>
                  );
                })()
              ) : (
                <p className="text-sm text-slate-500">No Pro1st sales detected for this range.</p>
              )}
            </>
          )}
        </div>
        );
      case "salesperson-performance":
        return (
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="salesperson-performance"
          data-tour-id="sales-performance"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Salesperson Performance
                {renderHelp("Based on sales report: revenue by salesperson for the selected range.")}
              </h3>
              <p className="text-sm text-slate-500">Revenue by associate</p>
            </div>
            {renderCardToggle("salesperson-performance")}
          </div>
          {!isCardCollapsed("salesperson-performance") && (
            <div className="h-80 w-full" data-no-print-toggle>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={salesPerformanceData}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  onClick={(evt: any) => {
                    if (evt?.activePayload?.length) return;
                    if (selectedSalesperson) {
                      setSelectedSalesperson(null);
                      setSearchHint(null);
                    }
                  }}
                >
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} interval={0} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b" }}
                    tickFormatter={(v: number) => `$${Number(v).toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    labelFormatter={(_label: any, payload: any[]) => {
                      const p = payload?.[0]?.payload as SalespersonPoint | undefined;
                      return p?.fullName || _label;
                    }}
                    formatter={(value: number) => [`$${Number(value).toLocaleString()}`, undefined]}
                  />
                  <Legend iconType="circle" />
                  <Bar
                    dataKey="sales"
                    name="Total Sales"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    barSize={hasCompare ? 18 : 30}
                    onClick={(data: any) => {
                      const name = data?.payload?.fullName;
                      if (name) selectSalesperson(name);
                    }}
                  />
                  {hasCompare && (
                    <Bar
                      dataKey="compareSales"
                      name={`Compare Sales ${compareHint}`}
                      fill="#93c5fd"
                      radius={[4, 4, 0, 0]}
                      barSize={18}
                      onClick={(data: any) => {
                        const name = data?.payload?.fullName;
                        if (name) selectSalesperson(name);
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        );
      case "store-performance":
        return (
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="store-performance"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Store Performance
                {renderHelp("Based on sales report: revenue by store/location for the selected range.")}
              </h3>
              <p className="text-sm text-slate-500">Revenue by location</p>
            </div>
            {renderCardToggle("store-performance")}
          </div>
          {!isCardCollapsed("store-performance") && (
            <div className="h-80 w-full" data-no-print-toggle>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={storePerformanceData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  onClick={(evt: any) => {
                    if (evt?.activePayload?.length) return;
                    if (selectedStore) {
                      setSelectedStore(null);
                      setSelectedTrendDay(null);
                      setSearchHint(null);
                    }
                  }}
                >
                  <CartesianGrid stroke="#f1f5f9" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="storeName"
                    type="category"
                    width={120}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 13 }}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number) => [`$${Number(value).toLocaleString()}`, undefined]}
                  />
                  <Legend />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                    barSize={hasCompare ? 14 : 20}
                    onClick={(data: any) => {
                      const name = data?.payload?.storeName;
                      if (name) selectStore(name);
                    }}
                  />
                  {hasCompare && (
                    <Bar
                      dataKey="compareRevenue"
                      name={`Compare Revenue ${compareHint}`}
                      fill="#a5b4fc"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                      onClick={(data: any) => {
                        const name = data?.payload?.storeName;
                        if (name) selectStore(name);
                      }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        );
      case "sales-trend":
        return (
      <div
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
        data-print-id="sales-trend"
       
       
      >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Sales Trend
                {renderHelp(
                  "Based on sales report: combined non-Pro1st furniture sales for the selected range, with average daily advertising spend from the 2026 advertising schedule."
                )}
              </h3>
              <p className="text-sm text-slate-500">
                Trend mirrors the selected date range{compareRangeInput ? "; compare adds matched-period sales and ad-spend lines." : "."}
              </p>
            </div>
            {renderCardToggle("sales-trend")}
          </div>
        {!isCardCollapsed("sales-trend") && (
        <div className="h-80 w-full" data-no-print-toggle>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={displayTrendData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              onClick={(evt: any) => {
                const payloadDay =
                  evt?.activePayload?.[0]?.payload?.day ??
                  evt?.activePayload?.[1]?.payload?.day ??
                  evt?.activeLabel;
                if (!payloadDay) {
                  if (trendFocusDay && trendPrevRangeRef.current) {
                    const prev = trendPrevRangeRef.current;
                    setYearA(prev.year);
                    setMonthA(prev.month);
                    setDayA(prev.day);
                    setTrendFocusDay(null);
                    setSelectedTrendDay(null);
                    trendPrevRangeRef.current = null;
                    window.dispatchEvent(new Event("fd-open-range"));
                  }
                  return;
                }
                const day = String(payloadDay).includes("T")
                  ? String(payloadDay).slice(0, 10)
                  : String(payloadDay);
                if (!day || !day.includes("-")) return;
                if (trendFocusDay === day && trendPrevRangeRef.current) {
                  const prev = trendPrevRangeRef.current;
                  setYearA(prev.year);
                  setMonthA(prev.month);
                  setDayA(prev.day);
                  setTrendFocusDay(null);
                  setSelectedTrendDay(null);
                  trendPrevRangeRef.current = null;
                  window.dispatchEvent(new Event("fd-open-range"));
                  return;
                }
                const [y, m, d] = day.split("-");
                if (!y || !m || !d) return;
                if (!trendFocusDay) {
                  trendPrevRangeRef.current = { year: yearA, month: monthA, day: dayA };
                }
                setYearA(Number(y));
                setMonthA(m);
                setDayA(d);
                setTrendFocusDay(day);
                setSelectedTrendDay(day);
                setSearchHint(null);
                window.dispatchEvent(new Event("fd-open-range"));
              }}
            >
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                padding={trendXAxisPadding}
                tickFormatter={(v: string) => formatShortDate(String(v).includes("T") ? String(v).slice(0, 10) : String(v))}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b" }}
                tickFormatter={(v: number) => `$${Number(v).toLocaleString()}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#f97316" }}
                tickFormatter={(v: number) => `$${Number(v).toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(label: string) =>
                  formatShortDate(String(label).includes("T") ? String(label).slice(0, 10) : String(label))
                }
                formatter={(value: number | null, name: string) => [
                  value === null || value === undefined ? "—" : `$${Number(value).toLocaleString()}`,
                  name,
                ]}
              />
              <Legend iconType="circle" />
              <Line
                type="monotone"
                dataKey="furnitureSales"
                name={`${dateBasisShortLabel} Furniture Sales`}
                yAxisId="left"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
              />
              {compareRangeInput && (
                <Line
                  type="monotone"
                  dataKey="compareFurnitureSales"
                  name={`Compared ${dateBasisShortLabel} Furniture Sales`}
                  yAxisId="left"
                  stroke="#22c55e"
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                />
              )}
              <Line
                type="monotone"
                dataKey="averageDailyAdSpend"
                name="Avg Daily Ad Spend"
                yAxisId="right"
                stroke="#f97316"
                strokeWidth={3}
                strokeDasharray="6 4"
                dot={false}
              />
              {compareRangeInput && (
                <Line
                  type="monotone"
                  dataKey="compareAverageDailyAdSpend"
                  name="Compared Avg Daily Ad Spend"
                  yAxisId="right"
                  stroke="#a855f7"
                  strokeWidth={3}
                  strokeDasharray="2 5"
                  dot={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
        );
      default:
        return null;
    }
  };

  if (loading && salesData.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Loading business analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="space-y-6">
      {(selectedSalesperson || selectedStore || selectedTrendDay || searchHint) && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center fd-print-hide">
          <div className="text-sm font-semibold text-slate-800">Active Filters</div>
          {selectedSalesperson && (
            <span className="px-3 py-1 text-xs rounded-full bg-blue-50 text-blue-700">
              Salesperson: {selectedSalesperson}
            </span>
          )}
          {selectedStore && (
            <span className="px-3 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700">
              Store: {selectedStore}
            </span>
          )}
          {selectedTrendDay && (
            <span className="px-3 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700">
              Day: {formatShortDate(selectedTrendDay)}
            </span>
          )}
          {searchHint && (
            <span className="text-xs text-amber-600">{searchHint}</span>
          )}
          {(selectedSalesperson || selectedStore || selectedTrendDay || searchHint) && (
            <button
              onClick={() => {
                setSelectedSalesperson(null);
                setSelectedStore(null);
                setSelectedTrendDay(null);
                setSearchHint(null);
              }}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 fd-print-hide">
          {error}
        </div>
      )}


      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={dashboardCardOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-6">
            {dashboardCardOrder.map((id) => (
              <SortableItem key={id} id={id} className={`${DASHBOARD_CARD_SPANS[id] ?? "md:col-span-6 xl:col-span-12"} h-full`}>
                {renderDashboardCard(id)}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {(selectedSalesperson || selectedStore || selectedTrendDay) && (
        <div ref={salespersonDetailRef}>
          {selectedTrendDay && trendDayTicketsLoading && (
            <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              Loading sales for {formatShortDate(selectedTrendDay)}…
            </div>
          )}
          {selectedTrendDay && trendDayTicketsError && (
            <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
              {trendDayTicketsError}
            </div>
          )}
          <SalespersonDetailCard
            selectedSalesperson={selectedTrendDay ? undefined : selectedSalesperson || undefined}
            selectedStore={selectedTrendDay ? undefined : selectedStore || undefined}
            selectedDay={selectedTrendDay || undefined}
            salespersonTickets={selectedTrendDay ? trendDayTickets : salespersonTickets}
            saleLink={saleLink}
            saleLabel={saleLabel}
          />
        </div>
      )}

      <SalesPrintDialog
        open={printDialogOpen}
        printIncludeLowMargin={printIncludeLowMargin}
        printIncludeStore={printIncludeStore}
        printIncludeSalesperson={printIncludeSalesperson}
        printIncludeManufacturer={printIncludeManufacturer}
        printIncludeCategory={printIncludeCategory}
        printLoading={printLoading}
        setPrintIncludeLowMargin={setPrintIncludeLowMargin}
        setPrintIncludeStore={setPrintIncludeStore}
        setPrintIncludeSalesperson={setPrintIncludeSalesperson}
        setPrintIncludeManufacturer={setPrintIncludeManufacturer}
        setPrintIncludeCategory={setPrintIncludeCategory}
        onClose={() => setPrintDialogOpen(false)}
        onPrint={runPrint}
      />
      {showSalesTour && (
        <ModuleTourOverlay
          isDarkMode={isDarkMode}
          steps={SALES_ANALYSIS_TOUR_STEPS}
          onClose={completeSalesTour}
          onComplete={completeSalesTour}
        />
      )}
      </div>
    </div>
  );
};

export default SalesDashboard;
