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
  fetchAvailableYears,
  fetchLeaderboard,
  fetchFinanceSummary,
  fetchLowMargin,
  fetchSalesByLocation,
  fetchSalesDaily,
  fetchPro1stTrend,
  fetchSummary,
  fetchBestSellers,
  fetchTopCategories,
  fetchTopManufacturers,
  fetchPro1stAttachRate,
  fetchSalespersonTickets,
  fetchSalesReport,
  fetchManufacturerTopItems,
  fetchCategoryTopItems,
  fetchSalespeopleBySaleIds,
} from "../services/posBackendApi";
import { SalesData, StoreData } from "../types";
import {
  dayOptions,
  formatMonthLabel,
  formatRangeLabel,
  formatShortDate,
  getSimplifiedRange,
  monthOptions,
  pctChange,
  safeDiv,
  salespersonLabel,
} from "./salesUtils";
import SortableItem from "./sales/SortableItem";
import SalesPrintDialog from "./sales/SalesPrintDialog";
import {
  computeReportTotals,
  type ReportSummaryRow,
  withReportPercentages,
} from "./salesReportUtils";

type SalespersonPoint = SalesData & {
  fullName: string;
};

type Summary = {
  sales: number;
  lines: number;
};

type ReportRowsState = {
  rows: ReportSummaryRow[];
  availableCategories: string[];
  availableManufacturers: string[];
};

type SalesDashboardProps = {
  itemSortMetric: "sales" | "qty";
  showTooltips?: boolean;
};

const SalesDashboard: React.FC<SalesDashboardProps> = ({ itemSortMetric, showTooltips = false }) => {
  const [salesData, setSalesData] = useState<SalespersonPoint[]>([]);
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const [trendData, setTrendData] = useState<Array<{ day: string; sales: number; pro1stSales: number; pro1stPct: number }>>([]);
  const [trendFocusDay, setTrendFocusDay] = useState<string | null>(null);
  const trendPrevRangeRef = useRef<{ year: number; month: string; day: string } | null>(null);
  const [summary, setSummary] = useState<Summary>({ sales: 0, lines: 0 });
  const [summaryCompare, setSummaryCompare] = useState<Summary>({ sales: 0, lines: 0 });
  
  const [yearA, setYearA] = useState<number>(() => new Date().getFullYear());
  const [monthA, setMonthA] = useState<string>("01");
  const [dayA, setDayA] = useState<string>("ALL");

  useEffect(() => {
    if (!trendFocusDay) return;
    const current = `${yearA}-${monthA}-${dayA}`;
    if (current !== trendFocusDay) {
      setTrendFocusDay(null);
      trendPrevRangeRef.current = null;
    }
  }, [yearA, monthA, dayA, trendFocusDay]);

  const [statCardOrder, setStatCardOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("fd-stat-card-order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed;
      } catch (e) {}
    }
    return ["range-selector", "transactions", "total-sales", "financed-amount", "financed-transactions", "avg-ticket"];
  });

  useEffect(() => {
    localStorage.setItem("fd-stat-card-order", JSON.stringify(statCardOrder));
  }, [statCardOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setStatCardOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over!.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const [yearB, setYearB] = useState<number | null>(null);
  const [monthB, setMonthB] = useState<string>("ALL");
  const [dayB, setDayB] = useState<string>("ALL");
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);

  const [compareHint, setCompareHint] = useState("");
  const printGeneratedAt = useMemo(() => new Date(), []);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRange, setCurrentRange] = useState<{ start: string; endExclusive: string }>({
    start: "1900-01-01",
    endExclusive: "2100-01-01",
  });
  const [error, setError] = useState<string | null>(null);
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
    salespersonRows: ReportSummaryRow[];
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
  const [reportCategory, setReportCategory] = useState<string>("ALL");
  const [reportManufacturer, setReportManufacturer] = useState<string>("ALL");
  const [reportData, setReportData] = useState<ReportRowsState>({
    rows: [],
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportDataSalesperson, setReportDataSalesperson] = useState<ReportRowsState>({
    rows: [],
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportDataStore, setReportDataStore] = useState<ReportRowsState>({
    rows: [],
    availableCategories: [],
    availableManufacturers: [],
  });
  const [reportOverallTotals, setReportOverallTotals] = useState<{ totalRetail: number; totalUnits: number }>({
    totalRetail: 0,
    totalUnits: 0,
  });
  const [reportOverallRowsSalesperson, setReportOverallRowsSalesperson] = useState<ReportSummaryRow[]>([]);
  const [reportOverallRowsStore, setReportOverallRowsStore] = useState<ReportSummaryRow[]>([]);
  const [bestSellers, setBestSellers] = useState<Array<{
    itemDescription: string;
    category: string;
    manufacturer: string;
    itemNo: string;
    qty: number;
    sales: number;
    saleIds: string[];
  }>>([]);
  const [salespersonTickets, setSalespersonTickets] = useState<Array<{
    saleId: string;
    saleDate: string;
    salesperson: string;
    location: string;
    receiptNo: string;
    customerName: string;
    grandTotal: number;
    profit: number;
    marginPct: number | null;
  }>>([]);
  const [topCategories, setTopCategories] = useState<Array<{ category: string; qty: number; sales: number }>>([]);
  const [topManufacturers, setTopManufacturers] = useState<Array<{ manufacturer: string; qty: number; sales: number }>>([]);
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
  const [pro1stStats, setPro1stStats] = useState<{
    totalSales: number;
    proSales: number;
    attachRate: number;
    saleIds: string[];
    saleIdsLow: string[];
    saleIdsMid: string[];
    saleIdsHigh: string[];
  }>({
    totalSales: 0,
    proSales: 0,
    attachRate: 0,
    saleIds: [],
    saleIdsLow: [],
    saleIdsMid: [],
    saleIdsHigh: [],
  });
  const [salePeopleMap, setSalePeopleMap] = useState<Record<string, string>>({});

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
    return computeReportTotals(reportData.rows);
  }, [reportData.rows]);
  const currentReportOverallRows = useMemo(
    () => (reportDimension === "store" ? reportOverallRowsStore : reportOverallRowsSalesperson),
    [reportDimension, reportOverallRowsSalesperson, reportOverallRowsStore]
  );
  const currentReportOverallMap = useMemo(
    () => new Map(currentReportOverallRows.map((row) => [row.label, row])),
    [currentReportOverallRows]
  );

  const reportRowsWithPct = useMemo(() => {
    return withReportPercentages(reportData.rows, reportTotals, currentReportOverallMap, reportOverallTotals);
  }, [reportData.rows, reportTotals, currentReportOverallMap, reportOverallTotals]);

  const printLowMarginRows = useMemo(() => (printData?.lowMarginRows ?? sortedLowMarginData), [printData, sortedLowMarginData]);
  const printStoreBaseRows = useMemo(() => (printData?.storeRows ?? reportDataStore.rows), [printData, reportDataStore.rows]);
  const printSalesBaseRows = useMemo(() => (printData?.salespersonRows ?? reportDataSalesperson.rows), [printData, reportDataSalesperson.rows]);
  const printStoreOverallRows = useMemo(() => (printData?.storeOverallRows ?? reportOverallRowsStore), [printData, reportOverallRowsStore]);
  const printSalesOverallRows = useMemo(() => (printData?.salespersonOverallRows ?? reportOverallRowsSalesperson), [printData, reportOverallRowsSalesperson]);
  const printStoreOverallMap = useMemo(() => new Map(printStoreOverallRows.map((row) => [row.label, row])), [printStoreOverallRows]);
  const printSalesOverallMap = useMemo(() => new Map(printSalesOverallRows.map((row) => [row.label, row])), [printSalesOverallRows]);
  const printTotalsStore = useMemo(() => computeReportTotals(printStoreBaseRows), [printStoreBaseRows]);
  const printTotalsSalesperson = useMemo(() => computeReportTotals(printSalesBaseRows), [printSalesBaseRows]);
  const printOverallTotals = useMemo(() => computeReportTotals(printStoreOverallRows), [printStoreOverallRows]);
  const printRowsWithPctStore = useMemo(() => {
    return withReportPercentages(printStoreBaseRows, printTotalsStore, printStoreOverallMap, printOverallTotals);
  }, [printStoreBaseRows, printTotalsStore, printStoreOverallMap, printOverallTotals]);
  const printRowsWithPctSalesperson = useMemo(() => {
    return withReportPercentages(printSalesBaseRows, printTotalsSalesperson, printSalesOverallMap, printOverallTotals);
  }, [printSalesBaseRows, printTotalsSalesperson, printSalesOverallMap, printOverallTotals]);
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
      availableCategories: next.availableCategories,
      availableManufacturers: next.availableManufacturers,
    });
  }, [reportDimension, reportDataSalesperson, reportDataStore]);

  const formatMarginPct = (value: number | null) => {
    if (!Number.isFinite(value as number)) return "N/A";
    return `${(value as number).toFixed(1)}%`;
  };

  const reportCategoryOptions = useMemo(() => {
    const values = [...reportData.availableCategories, reportCategory].filter((v) => v && String(v).trim());
    return ["ALL", ...Array.from(new Set(values))];
  }, [reportData.availableCategories, reportCategory]);

  const reportManufacturerOptions = useMemo(() => {
    const values = [...reportData.availableManufacturers, reportManufacturer].filter((v) => v && String(v).trim());
    return ["ALL", ...Array.from(new Set(values))];
  }, [reportData.availableManufacturers, reportManufacturer]);




  useEffect(() => {
    fetchAvailableYears()
      .then((years) => {
        if (!years.length) return;
        setAvailableYears(years);
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
          setYearA(currentYear);
        } else {
          setYearA(years[years.length - 1]);
        }
        setYearB(null);
      })
      .catch(() => {
        // ignore; UI still works with manual year values
      });
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const salesperson = selectedSalesperson ? selectedSalesperson : undefined;
      const location = selectedStore ? selectedStore : undefined;

      const currentRange = getSimplifiedRange(yearA, monthA, dayA);
      if (!currentRange) throw new Error("Invalid Range A");

      const compareRange = compareEnabled && yearB ? getSimplifiedRange(yearB, monthB, dayB) : null;
      if (compareRange) {
        setCompareHint(`vs ${yearB}${monthB === "ALL" ? "" : "-" + monthB}${dayB === "ALL" ? "" : "-" + dayB}`);
      } else {
        setCompareHint("");
      }

      const [
        leaderRows,
        locationRows,
        curSummary,
        financeSummary,
        prevSummary,
        prevFinanceSummary,
        lowMarginRows,
        reportSummarySalesperson,
        reportSummaryStore,
        reportSummaryOverallSalesperson,
        reportSummaryOverallStore,
        bestSellerRows,
        categoryRows,
        manufacturerRows,
        pro1stSummary,
        salespersonTicketsRows,
      ] = await Promise.all([
        fetchLeaderboard({
          start: currentRange.start,
          end: currentRange.endExclusive,
          limit: salesperson ? 100 : 20,
          salesperson,
          location,
        }),
        fetchSalesByLocation({ start: currentRange.start, end: currentRange.endExclusive, salesperson, location }),
        fetchSummary({ start: currentRange.start, end: currentRange.endExclusive, salesperson, location }),
        fetchFinanceSummary({ start: currentRange.start, end: currentRange.endExclusive, salesperson, location }),
        compareRange
          ? fetchSummary({ start: compareRange.start, end: compareRange.endExclusive, salesperson, location })
          : Promise.resolve(null),
        compareRange
          ? fetchFinanceSummary({ start: compareRange.start, end: compareRange.endExclusive, salesperson, location })
          : Promise.resolve(null),
        fetchLowMargin({
          start: currentRange.start,
          end: currentRange.endExclusive,
          limitPer: 10,
          limitTotal: 200,
          salesperson,
          location,
          category: reportCategory !== "ALL" ? reportCategory : undefined,
          manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
        }),
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "salesperson",
          salesperson,
          location,
          category: reportCategory !== "ALL" ? reportCategory : undefined,
          manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
        }),
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "store",
          salesperson,
          location,
          category: reportCategory !== "ALL" ? reportCategory : undefined,
          manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
        }),
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "salesperson",
          salesperson,
          location,
        }),
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "store",
          salesperson,
          location,
        }),
        fetchBestSellers({ start: currentRange.start, end: currentRange.endExclusive, limit: 15, sort: itemSortMetric, location, salesperson }),
        fetchTopCategories({ start: currentRange.start, end: currentRange.endExclusive, limit: 8, sort: itemSortMetric, location, salesperson }),
        fetchTopManufacturers({ start: currentRange.start, end: currentRange.endExclusive, limit: 8, sort: itemSortMetric, location, salesperson }),
        fetchPro1stAttachRate({ start: currentRange.start, end: currentRange.endExclusive, location, salesperson }),
        salesperson
          ? fetchSalespersonTickets({
              start: currentRange.start,
              end: currentRange.endExclusive,
              salesperson,
              limit: 5000,
              location,
            })
          : Promise.resolve([]),
      ]);

      setCurrentRange(currentRange);
      setSalesData(
        leaderRows
          .map((r) => ({
            name: salespersonLabel(r.salesperson),
            fullName: r.salesperson,
            sales: Number.isFinite(r.sales) ? r.sales : 0,
            margin: 0,
            itemsSold: Number.isFinite(r.lines) ? r.lines : 0,
          }))
          .filter((r) => r.fullName)
      );

      setStoreData(
        locationRows
          .map((r) => ({
            storeName: r.location || "(unknown)",
            revenue: Number.isFinite(r.sales) ? r.sales : 0,
            profit: Number.isFinite(r.profit) ? r.profit : 0,
          }))
          .filter((r) => r.storeName)
      );

      setSummary({
        sales: Number.isFinite(curSummary.sales) ? curSummary.sales : 0,
        lines: Number.isFinite(curSummary.lines) ? curSummary.lines : 0,
      });
      if (prevSummary) {
        setSummaryCompare({
          sales: Number.isFinite(prevSummary.sales) ? prevSummary.sales : 0,
          lines: Number.isFinite(prevSummary.lines) ? prevSummary.lines : 0,
        });
      } else {
        // No comparison selected: keep charts for A and hide comparison UI bits.
        setSummaryCompare({
          sales: Number.isFinite(curSummary.sales) ? curSummary.sales : 0,
          lines: Number.isFinite(curSummary.lines) ? curSummary.lines : 0,
        });
      }

      setFinance({
        financedLines: Number.isFinite(financeSummary.financedLines) ? financeSummary.financedLines : 0,
        financedAmount: Number.isFinite(financeSummary.financedAmount) ? financeSummary.financedAmount : 0,
        financeFee: Number.isFinite(financeSummary.financeFee) ? financeSummary.financeFee : 0,
        financeBalance: Number.isFinite(financeSummary.financeBalance) ? financeSummary.financeBalance : 0,
      });
      if (prevFinanceSummary) {
        setFinanceCompare({
          financedLines: Number.isFinite(prevFinanceSummary.financedLines) ? prevFinanceSummary.financedLines : 0,
          financedAmount: Number.isFinite(prevFinanceSummary.financedAmount) ? prevFinanceSummary.financedAmount : 0,
          financeFee: Number.isFinite(prevFinanceSummary.financeFee) ? prevFinanceSummary.financeFee : 0,
          financeBalance: Number.isFinite(prevFinanceSummary.financeBalance) ? prevFinanceSummary.financeBalance : 0,
        });
      } else {
        setFinanceCompare({
          financedLines: Number.isFinite(financeSummary.financedLines) ? financeSummary.financedLines : 0,
          financedAmount: Number.isFinite(financeSummary.financedAmount) ? financeSummary.financedAmount : 0,
          financeFee: Number.isFinite(financeSummary.financeFee) ? financeSummary.financeFee : 0,
          financeBalance: Number.isFinite(financeSummary.financeBalance) ? financeSummary.financeBalance : 0,
        });
      }

      setLowMarginData(lowMarginRows.rows);
      setReportDataSalesperson({
        rows: reportSummarySalesperson.rows,
        availableCategories: reportSummarySalesperson.availableCategories,
        availableManufacturers: reportSummarySalesperson.availableManufacturers,
      });
      setReportDataStore({
        rows: reportSummaryStore.rows,
        availableCategories: reportSummaryStore.availableCategories,
        availableManufacturers: reportSummaryStore.availableManufacturers,
      });
      setReportOverallRowsSalesperson(reportSummaryOverallSalesperson.rows);
      setReportOverallRowsStore(reportSummaryOverallStore.rows);
      {
        const overallTotals = computeReportTotals(reportSummaryOverallStore.rows);
        setReportOverallTotals({ totalRetail: overallTotals.totalRetail, totalUnits: overallTotals.totalUnits });
      }
      const activeReport = reportDimension === "store" ? reportSummaryStore : reportSummarySalesperson;
      setReportData({
        rows: activeReport.rows,
        availableCategories: activeReport.availableCategories,
        availableManufacturers: activeReport.availableManufacturers,
      });
      setBestSellers(bestSellerRows);
      setTopCategories(categoryRows);
      setTopManufacturers(manufacturerRows);
      setPro1stStats(pro1stSummary);
      setSalespersonTickets(salespersonTicketsRows);
      setExpandedManufacturers({});
      setManufacturerItems({});
      setManufacturerLoading({});
      setExpandedCategories({});
      setCategoryItems({});
      setCategoryLoading({});
      const proIds = [
        ...pro1stSummary.saleIdsLow,
        ...pro1stSummary.saleIdsMid,
        ...pro1stSummary.saleIdsHigh,
      ];
      const bestIds = bestSellerRows.flatMap((b) => b.saleIds || []);
      void syncSalePeople([...proIds, ...bestIds]);
    } catch (e) {
      console.error(e);
      setError(`Couldn’t load POS data. Confirm the backend API is running at ${getPosApiBaseUrl()}`);
      // Reset all data on error
      setSalesData([]);
      setStoreData([]);
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
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportDataSalesperson({
        rows: [],
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportDataStore({
        rows: [],
        availableCategories: [],
        availableManufacturers: [],
      });
      setReportOverallRowsSalesperson([]);
      setReportOverallRowsStore([]);
      setReportOverallTotals({ totalRetail: 0, totalUnits: 0 });
      setBestSellers([]);
      setTopCategories([]);
      setTopManufacturers([]);
      setPro1stStats({
        totalSales: 0,
        proSales: 0,
        attachRate: 0,
        saleIds: [],
        saleIdsLow: [],
        saleIdsMid: [],
        saleIdsHigh: [],
      });
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
    yearA,
    monthA,
    dayA,
    yearB,
    monthB,
    dayB,
    compareEnabled,
    selectedSalesperson,
    selectedStore,
    itemSortMetric,
    reportDimension,
    reportCategory,
    reportManufacturer,
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
    try {
      const currentRange = getSimplifiedRange(yearA, monthA, dayA);
      if (!currentRange) return;
      const salesperson = selectedSalesperson ? selectedSalesperson : undefined;
      const location = selectedStore ? selectedStore : undefined;

      const [storeSummary, salespersonSummary, storeOverallSummary, salespersonOverallSummary, lowMarginSummary] = await Promise.all([
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "store",
          salesperson,
          location,
          category: reportCategory !== "ALL" ? reportCategory : undefined,
          manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
        }),
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "salesperson",
          salesperson,
          location,
          category: reportCategory !== "ALL" ? reportCategory : undefined,
          manufacturer: reportManufacturer !== "ALL" ? reportManufacturer : undefined,
        }),
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "store",
          salesperson,
          location,
        }),
        fetchSalesReport({
          start: currentRange.start,
          end: currentRange.endExclusive,
          dimension: "salesperson",
          salesperson,
          location,
        }),
        fetchLowMargin({
          start: currentRange.start,
          end: currentRange.endExclusive,
          limitPer: 10,
          limitTotal: 200,
          salesperson,
          location,
        }),
      ]);

      const manufacturers = reportManufacturerOptions.filter((m) => m && m !== "ALL");
      const categories = reportCategoryOptions.filter((c) => c && c !== "ALL");

      const manufacturerBreakdowns = printIncludeManufacturer
        ? await Promise.all(
            manufacturers.map(async (m) => {
              const [storeRows, salespersonRows] = await Promise.all([
                fetchSalesReport({
                  start: currentRange.start,
                  end: currentRange.endExclusive,
                  dimension: "store",
                  salesperson,
                  location,
                  manufacturer: m,
                }),
                fetchSalesReport({
                  start: currentRange.start,
                  end: currentRange.endExclusive,
                  dimension: "salesperson",
                  salesperson,
                  location,
                  manufacturer: m,
                }),
              ]);
              return { label: m, storeRows: storeRows.rows, salespersonRows: salespersonRows.rows };
            })
          )
        : [];

      const categoryBreakdowns = printIncludeCategory
        ? await Promise.all(
            categories.map(async (c) => {
              const [storeRows, salespersonRows] = await Promise.all([
                fetchSalesReport({
                  start: currentRange.start,
                  end: currentRange.endExclusive,
                  dimension: "store",
                  salesperson,
                  location,
                  category: c,
                }),
                fetchSalesReport({
                  start: currentRange.start,
                  end: currentRange.endExclusive,
                  dimension: "salesperson",
                  salesperson,
                  location,
                  category: c,
                }),
              ]);
              return { label: c, storeRows: storeRows.rows, salespersonRows: salespersonRows.rows };
            })
          )
        : [];

      setPrintData({
        lowMarginRows: lowMarginSummary.rows,
        storeRows: storeSummary.rows,
        salespersonRows: salespersonSummary.rows,
        storeOverallRows: storeOverallSummary.rows,
        salespersonOverallRows: salespersonOverallSummary.rows,
        manufacturerBreakdowns,
        categoryBreakdowns,
      });
      setPrintDialogOpen(false);
      setTimeout(() => window.print(), 60);
    } finally {
      setPrintLoading(false);
    }
  };

  useEffect(() => {
    const salesperson = selectedSalesperson ? selectedSalesperson : undefined;
    const location = selectedStore ? selectedStore : undefined;
    
    const range = getSimplifiedRange(yearA, monthA, dayA);
    if (!range) return;
    const { start, endExclusive } = range;

    Promise.all([
      fetchSalesDaily({ start, end: endExclusive, salesperson, location }),
      fetchPro1stTrend({ start, end: endExclusive, salesperson, location }),
    ])
      .then(([dailyRows, proRows]) => {
        const map = new Map<string, { day: string; sales: number; pro1stSales: number; pro1stPct: number }>();
        dailyRows
          .filter((r) => r.day)
          .forEach((r) => {
            const day = String(r.day).includes("T") ? String(r.day).slice(0, 10) : String(r.day);
            map.set(day, {
              day,
              sales: Number.isFinite(r.sales) ? r.sales : 0,
              pro1stSales: 0,
              pro1stPct: 0,
            });
          });
        proRows
          .filter((r) => r.day)
          .forEach((r) => {
            const day = String(r.day).includes("T") ? String(r.day).slice(0, 10) : String(r.day);
            const existing = map.get(day);
            if (existing) {
              existing.pro1stSales = Number.isFinite(r.sales) ? r.sales : 0;
            } else {
              map.set(day, {
                day,
                sales: 0,
                pro1stSales: Number.isFinite(r.sales) ? r.sales : 0,
                pro1stPct: 0,
              });
            }
          });
        const rows = Array.from(map.values()).map((row) => ({
          ...row,
          pro1stPct: row.sales > 0 ? (row.pro1stSales / row.sales) * 100 : 0,
        }));
        setTrendData(rows.sort((a, b) => a.day.localeCompare(b.day)));
      })
      .catch((e) => {
        console.error(e);
        setTrendData([]);
      });
  }, [yearA, monthA, dayA, selectedSalesperson, selectedStore]);

  const displayTrendData = useMemo(() => {
    const rangeStart = currentRange.start;
    const rangeEnd = currentRange.endExclusive;
    const inRange = (day: string) => day >= rangeStart && day < rangeEnd;
    const filtered = trendData.filter((row) => row.day && inRange(row.day));
    if (!trendFocusDay) return filtered;
    return filtered.filter((row) => row.day === trendFocusDay);
  }, [trendData, trendFocusDay, currentRange.start, currentRange.endExclusive]);
  const trendXAxisPadding = displayTrendData.length <= 2 ? { left: 80, right: 80 } : { left: 10, right: 10 };

  const revenuePct = pctChange(summary.sales, summaryCompare.sales);
  const linesPct = pctChange(summary.lines, summaryCompare.lines);

  const revenueUp = revenuePct >= 0;
  const linesUp = linesPct >= 0;
  const financePenetration = summary.lines > 0 ? (finance.financedLines / summary.lines) * 100 : 0;
  const financeAmountPctOfSales = summary.sales > 0 ? (finance.financedAmount / summary.sales) * 100 : 0;
  const hasCompare = compareHint.trim().length > 0;
  const financedLinesPct = pctChange(finance.financedLines, financeCompare.financedLines);
  const financedAmountPct = pctChange(finance.financedAmount, financeCompare.financedAmount);

  const financedLinesUp = financedLinesPct >= 0;
  const financedAmountUp = financedAmountPct >= 0;

  const avgTicket = safeDiv(summary.sales, summary.lines);
  const avgTicketCompare = safeDiv(summaryCompare.sales, summaryCompare.lines);

  const avgTicketPct = pctChange(avgTicket, avgTicketCompare);

  const avgTicketUp = avgTicketPct >= 0;
  const rangeLabel = useMemo(() => {
    if (dayA !== "ALL") {
      return formatShortDate(currentRange.start);
    }
    if (monthA !== "ALL") {
      return formatMonthLabel(`${yearA}-${monthA}`);
    }
    return String(yearA);
  }, [yearA, monthA, dayA, currentRange.start]);

  const printRangeA = useMemo(() => {
    const r = getSimplifiedRange(yearA, monthA, dayA);
    return r ? formatRangeLabel(r) : "";
  }, [yearA, monthA, dayA]);

  const printRangeB = useMemo(() => {
    if (!compareEnabled || !yearB) return "";
    const r = getSimplifiedRange(yearB, monthB, dayB);
    return r ? formatRangeLabel(r) : "";
  }, [compareEnabled, yearB, monthB, dayB]);

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
    setSearchHint(null);
  };
  const selectStore = (name: string) => {
    const next = normalizeName(name);
    setSelectedStore((prev) => (normalizeName(prev) === next ? null : next));
    setSelectedSalesperson(null);
    setSearchHint(null);
  };

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
      const list = await fetchManufacturerTopItems({
        start: currentRange.start,
        end: currentRange.endExclusive,
        manufacturer: name,
        limit: 10,
        sort: itemSortMetric,
        location: selectedStore || undefined,
        salesperson: selectedSalesperson || undefined,
      });
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
      const list = await fetchCategoryTopItems({
        start: currentRange.start,
        end: currentRange.endExclusive,
        category: name,
        limit: 10,
        sort: itemSortMetric,
        location: selectedStore || undefined,
        salesperson: selectedSalesperson || undefined,
      });
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
  }, [yearA, monthA, dayA, yearB, monthB, dayB, compareEnabled, selectedSalesperson, selectedStore, itemSortMetric]);

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
                </div>
                {compareEnabled && (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Range B (Compare)</label>
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
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case "transactions":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative fd-print-card h-full"
            data-print-id="transactions"
           
           
          >
            <div className="w-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Transactions
                  {renderHelp("Count of distinct sales tickets in the date range (from sales report).")}
                </p>
                {renderCardToggle("transactions")}
              </div>
              {!isCardCollapsed("transactions") && (
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">{summary.lines.toLocaleString()}</h3>
                    {hasCompare && (
                      <div className={`flex items-center text-sm mt-1 ${linesUp ? "text-green-600" : "text-red-500"}`}>
                        {linesUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                        <span className="font-medium">{Math.abs(linesPct).toFixed(1)}%</span>
                        <span className="text-slate-400 ml-1">{compareHint}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-full text-slate-700">
                    <Database size={24} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case "total-sales":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative fd-print-card h-full"
            data-print-id="total-sales"
           
           
          >
            <div className="w-full">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Total Sales
                  {renderHelp("Sum of ticket totals for the date range (from sales report).")}
                </p>
                {renderCardToggle("total-sales")}
              </div>
              {!isCardCollapsed("total-sales") && (
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">${summary.sales.toLocaleString()}</h3>
                    {hasCompare && (
                      <div className={`flex items-center text-sm mt-1 ${revenueUp ? "text-green-600" : "text-red-500"}`}>
                        {revenueUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                        <span className="font-medium">{Math.abs(revenuePct).toFixed(1)}%</span>
                        <span className="text-slate-400 ml-1">{compareHint}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                    <ShoppingBag size={24} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case "financed-amount":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card h-full"
            data-print-id="financed-amount"
           
           
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Financed Amount
                {renderHelp("Sum of financed amounts on tickets in the date range (from sales report).")}
              </p>
              {renderCardToggle("financed-amount")}
            </div>
            {!isCardCollapsed("financed-amount") && (
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-800">${finance.financedAmount.toLocaleString()}</h3>
                <p className="text-sm text-slate-400 mt-1">{financeAmountPctOfSales.toFixed(1)}% of sales financed</p>
                {hasCompare && (
                  <div className={`flex items-center text-sm mt-2 ${financedAmountUp ? "text-green-600" : "text-red-500"}`}>
                    {financedAmountUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                    <span className="font-medium">{Math.abs(financedAmountPct).toFixed(1)}%</span>
                    <span className="text-slate-400 ml-1">{compareHint}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case "financed-transactions":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card h-full"
            data-print-id="financed-transactions"
           
           
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Financed Transactions
                {renderHelp("Count of tickets with finance amount or balance > 0 (from sales report).")}
              </p>
              {renderCardToggle("financed-transactions")}
            </div>
            {!isCardCollapsed("financed-transactions") && (
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-800">{finance.financedLines.toLocaleString()}</h3>
                <p className="text-sm text-slate-400 mt-1">{financePenetration.toFixed(1)}% of transactions financed</p>
                {hasCompare && (
                  <div className={`flex items-center text-sm mt-2 ${financedLinesUp ? "text-green-600" : "text-red-500"}`}>
                    {financedLinesUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                    <span className="font-medium">{Math.abs(financedLinesPct).toFixed(1)}%</span>
                    <span className="text-slate-400 ml-1">{compareHint}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case "avg-ticket":
      case "average-ticket":
        return (
          <div
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card h-full"
            data-print-id="average-ticket"
           
           
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                Average Ticket
                {renderHelp("Total sales ÷ transactions for the date range (from sales report).")}
              </p>
              {renderCardToggle("average-ticket")}
            </div>
            {!isCardCollapsed("average-ticket") && (
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-800">${avgTicket.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                <p className="text-sm text-slate-400 mt-1">Sales ÷ transactions (A)</p>
                {hasCompare && (
                  <div className={`flex items-center text-sm mt-2 ${avgTicketUp ? "text-green-600" : "text-red-500"}`}>
                    {avgTicketUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                    <span className="font-medium">{Math.abs(avgTicketPct).toFixed(1)}%</span>
                    <span className="text-slate-400 ml-1">{compareHint}</span>
                  </div>
                )}
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
    <div className="space-y-6 animate-fade-in relative fd-print-area">
      <div className="fd-print-only fd-print-header">
        <div className="fd-print-title">WOLF FD Sales Report</div>
        <div className="fd-print-meta">
          <div>Range: {printRangeA || "N/A"}</div>
          {printRangeB && <div>Compare: {printRangeB}</div>}
          <div>
            Generated: {printGeneratedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
            {printGeneratedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
          {selectedSalesperson && <div>Salesperson: {selectedSalesperson}</div>}
          {selectedStore && <div>Store: {selectedStore}</div>}
        </div>
      </div>
      <div className="fd-print-hide">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-3 text-blue-800 fd-print-hide">
          <Database size={18} className="text-blue-500" />
          <span className="text-sm font-medium">All figures are based on sale date.</span>
        </div>
      {(selectedSalesperson || selectedStore || searchHint) && (
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
          {searchHint && (
            <span className="text-xs text-amber-600">{searchHint}</span>
          )}
          {(selectedSalesperson || selectedStore || searchHint) && (
            <button
              onClick={() => {
                setSelectedSalesperson(null);
                setSelectedStore(null);
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
        <SortableContext
          items={statCardOrder}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statCardOrder.map((id) => (
              <SortableItem key={id} id={id} className="h-full">
                {renderStatCard(id)}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="best-sellers"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Best Sellers
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

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="top-categories"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Top Categories
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
                        <div className="text-sm font-semibold text-slate-800">${row.sales.toLocaleString()}</div>
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="top-manufacturers"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Top Manufacturers
                {renderHelp("Based on item report: manufacturer totals for qty and sales in the selected range.")}
              </h3>
              <p className="text-sm text-slate-500">
                Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"}.
              </p>
            </div>
            {renderCardToggle("top-manufacturers")}
          </div>
          {!isCardCollapsed("top-manufacturers") && (
            topManufacturers.length ? (
              <div className="space-y-4">
                {topManufacturers.map((row) => {
                  const isOpen = !!expandedManufacturers[row.manufacturer];
                  const items = manufacturerItems[row.manufacturer] || [];
                  const loading = manufacturerLoading[row.manufacturer];
                  return (
                    <div
                      key={row.manufacturer}
                      className={`border rounded-lg transition-colors ${
                        isOpen ? "border-blue-200 bg-blue-50/60" : "border-slate-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleManufacturer(row.manufacturer)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left ${
                          isOpen ? "hover:bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{row.manufacturer}</div>
                          <div className="text-xs text-slate-500">{row.qty.toLocaleString()} qty</div>
                        </div>
                        <div className="text-sm font-semibold text-slate-800">${row.sales.toLocaleString()}</div>
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
                                  <div key={`${row.manufacturer}-${item.itemNo}-${item.itemDescription}`} className="flex flex-col gap-1">
                                    <div className="flex items-start justify-between gap-4 text-sm">
                                      <div>
                                        <div className="font-semibold text-slate-800">{item.itemDescription || "Unnamed Item"}</div>
                                        <div className="text-xs text-slate-500">
                                          {(item.category || "Uncategorized").toUpperCase()}
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
                            <div className="text-xs text-slate-500">No items for this brand.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No manufacturer data available for this range.</p>
            )
          )}
        </div>

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="pro1st-attach"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Pro1st Attach Rate
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
                  <div className="text-xs text-slate-500">
                    {hasItemData ? `$${pro1stStats.proSales.toLocaleString()} of $${pro1stStats.totalSales.toLocaleString()}` : "No item data in this range"}
                  </div>
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
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salesperson Performance */}
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="salesperson-performance"
         
         
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
                  data={salesData}
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
                    barSize={30}
                    onClick={(data: any) => {
                      const name = data?.payload?.fullName;
                      if (name) selectSalesperson(name);
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Store Location Breakdown */}
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
                  data={storeData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  onClick={(evt: any) => {
                    if (evt?.activePayload?.length) return;
                    if (selectedStore) {
                      setSelectedStore(null);
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
                    barSize={20}
                    onClick={(data: any) => {
                      const name = data?.payload?.storeName;
                      if (name) selectStore(name);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Trend */}
      <div
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
        data-print-id="sales-trend"
       
       
      >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Sales Trend
                {renderHelp("Based on sales report: daily sales trend for the selected range.")}
              </h3>
              <p className="text-sm text-slate-500">Trend mirrors the selected date range.</p>
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
                window.dispatchEvent(new Event("fd-open-range"));
              }}
            >
              <defs>
                <linearGradient id="pro1stFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                tick={{ fill: "#f59e0b" }}
                domain={[0, 10]}
                tickFormatter={(v: number) => `${Number(v).toFixed(0)}%`}
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
                formatter={(value: number, name: string, payload: any) => {
                  if (String(name).toLowerCase().includes("pro1st")) {
                    const dollars = Number(payload?.payload?.pro1stSales ?? 0);
                    const amount = `$${dollars.toLocaleString()}`;
                    return [`${Number(value).toFixed(1)}% (${amount})`, "Pro1st %"];
                  }
                  return [`$${Number(value).toLocaleString()}`, "Sales"];
                }}
              />
              <Legend iconType="circle" />
              <Area type="monotone" dataKey="pro1stPct" name="Pro1st %" yAxisId="right" stroke="#f59e0b" fill="url(#pro1stFill)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sales" name="Sales" yAxisId="left" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>

      {/* Sales Report / Lowest Margins */}
      <div
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
        data-print-id="sales-report"
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Sales Report
              {renderHelp("Totals use sales report with item-report filters (category/manufacturer) when selected.")}
            </h3>
            <p className="text-sm text-slate-500">
              Totals by salesperson or store, plus lowest margin tickets (by selected period)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {renderCardToggle("sales-report")}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className={`px-3 py-1 text-sm font-medium rounded-md ${reportMode === "totals" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                onClick={() => setReportMode("totals")}
              >
                Totals
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-sm font-medium rounded-md ${reportMode === "lowest" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                onClick={() => setReportMode("lowest")}
              >
                Lowest Margins
              </button>
            </div>
            <select
              className={`border border-slate-200 rounded-lg px-3 py-2 text-sm ${reportMode === "lowest" ? "bg-slate-100 text-slate-400" : "bg-white text-slate-700"}`}
              value={reportDimension}
              onChange={(e) => setReportDimension(e.target.value === "store" ? "store" : "salesperson")}
              disabled={reportMode === "lowest"}
            >
              <option value="salesperson">Salesperson</option>
              <option value="store">Store</option>
            </select>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
            >
              {reportCategoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "All Categories" : c}
                </option>
              ))}
            </select>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
              value={reportManufacturer}
              onChange={(e) => setReportManufacturer(e.target.value)}
            >
              {reportManufacturerOptions.map((m) => (
                <option key={m} value={m}>
                  {m === "ALL" ? "All Manufacturers" : m}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!isCardCollapsed("sales-report") && (
          reportMode === "totals" ? (
            reportRowsWithPct.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {reportDimension === "store" ? "Store" : "Salesperson"}
                      {renderHelp("Grouping based on sales report.")}
                      </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total Retail
                      {renderHelp("Raw sales dollars for this row.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Sales % of View
                      {renderHelp("Percent of this row's retail against the visible rows after category/manufacturer filters. These values add up to 100%.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Sales % of Own Total
                      {renderHelp("Percent of this row's retail against that salesperson/store's own total retail for the selected date range.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Sales % of Company
                      {renderHelp("Percent of this row's retail against company total retail for the selected date range.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Units Sold
                      {renderHelp("Sum of qty_sold from item report, filtered by category/manufacturer.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Units % of View
                      {renderHelp("Percent of this row's units against the visible rows after category/manufacturer filters. These values add up to 100%.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Units % of Own Total
                      {renderHelp("Percent of this row's units against that salesperson/store's own total units for the selected date range.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Units % of Company
                      {renderHelp("Percent of this row's units against company total units for the selected date range.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Avg Margin %
                      {renderHelp("Average of per-ticket margin (profit ÷ sales) in the range.")}
                    </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {reportRowsWithPct.map((row) => (
                      <tr key={row.label}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          {row.label || "(unknown)"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          ${Number(row.totalRetail || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {row.retailPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {row.ownRetailPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {row.totalRetailPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {Number(row.units || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {row.unitsPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {row.ownUnitsPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {row.totalUnitsPct.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {formatMarginPct(row.avgMarginPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">Totals</td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        ${Number(reportTotals.totalRetail || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        {reportTotals.totalRetail > 0 ? "100.0" : "0.0"}%
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        --
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        {reportOverallTotals.totalRetail > 0
                          ? ((reportTotals.totalRetail / reportOverallTotals.totalRetail) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        {Number(reportTotals.totalUnits || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        {reportTotals.totalUnits > 0 ? "100.0" : "0.0"}%
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">--</td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        {reportOverallTotals.totalUnits > 0
                          ? ((reportTotals.totalUnits / reportOverallTotals.totalUnits) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                        {formatMarginPct(reportTotals.avgMarginPct)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No sales report data available.</p>
            )
          ) : (
            (printData?.lowMarginRows ?? sortedLowMarginData).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => setLowMarginSort(prev => ({ column: 'salesperson', direction: prev.column === 'salesperson' && prev.direction === 'asc' ? 'desc' : 'asc' }))}>
                        Salesperson {lowMarginSort.column === 'salesperson' && (lowMarginSort.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sale ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => setLowMarginSort(prev => ({ column: 'marginPct', direction: prev.column === 'marginPct' && prev.direction === 'asc' ? 'desc' : 'asc' }))}>
                        Margin % {lowMarginSort.column === 'marginPct' && (lowMarginSort.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {(printData?.lowMarginRows ?? sortedLowMarginData).map((row, idx) => (
                      <tr key={idx} className={row.marginPct !== null && row.marginPct < 10 ? "bg-red-50" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{row.salesperson}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                          <a
                            href={saleLink(row.saleId)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {saleLabel(row.saleId, row.salesperson)}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {formatShortDate(String(row.saleDate || ""))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${row.grandTotal.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {row.marginPct !== null ? `${row.marginPct.toFixed(1)}%` : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No low margin data available.</p>
            )
          )
        )}
      </div>

      {selectedSalesperson && (
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="salesperson-detail"
         
         
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Salesperson Detail: {selectedSalesperson}</h3>
              <p className="text-sm text-slate-500">All tickets for the selected date range</p>
            </div>
          </div>
          {salespersonTickets.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sale ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Margin %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {salespersonTickets.map((row, idx) => (
                    <tr key={`${row.saleId}-${idx}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                        <a
                          href={saleLink(row.saleId)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {saleLabel(row.saleId, row.salesperson)}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatShortDate(String(row.saleDate || ""))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.location || "(unknown)"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${row.grandTotal.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${row.profit.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {row.marginPct !== null ? `${row.marginPct.toFixed(1)}%` : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No tickets found for this salesperson and range.</p>
          )}
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
      </div>
      <div className="fd-print-only space-y-6">
        {printIncludeManufacturer && printData?.manufacturerBreakdowns?.length ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Manufacturer Drill-downs</h3>
            {printData.manufacturerBreakdowns.map((entry) => {
              const storeTotals = computeReportTotals(entry.storeRows);
              const storeRows = withReportPercentages(entry.storeRows, storeTotals, printStoreOverallMap, printOverallTotals).filter((row) => {
                const retail = Number(row.totalRetail || 0);
                const units = Number(row.units || 0);
                const tickets = Number(row.ticketCount || 0);
                const retailPct = Number(row.retailPct || 0);
                const unitsPct = Number(row.unitsPct || 0);
                return !(retail == 0 && units == 0 && tickets == 0) && !(retailPct == 0 && unitsPct == 0);
              });
              const salesTotals = computeReportTotals(entry.salespersonRows);
              const salesRows = withReportPercentages(entry.salespersonRows, salesTotals, printSalesOverallMap, printOverallTotals).filter((row) => {
                const retail = Number(row.totalRetail || 0);
                const units = Number(row.units || 0);
                const tickets = Number(row.ticketCount || 0);
                const retailPct = Number(row.retailPct || 0);
                const unitsPct = Number(row.unitsPct || 0);
                return !(retail == 0 && units == 0 && tickets == 0) && !(retailPct == 0 && unitsPct == 0);
              });
              return (
                <div key={`m-${entry.label}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 fd-print-block">
                  <h4 className="text-base font-semibold text-slate-800 mb-3">Manufacturer: {entry.label}</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-700 mb-2">Store %</div>
                      {storeRows.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Store</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total Retail</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Company</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units Sold</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Company</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {storeRows.map((row) => (
                                <tr key={`m-${entry.label}-s-${row.label}`}>
                                  <td className="px-4 py-2 text-slate-700">{row.label || "—"}</td>
                                  <td className="px-4 py-2 text-right text-slate-700">${Number(row.totalRetail || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.retailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{Number(row.units || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.unitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownUnitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalUnitsPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No store data.</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700 mb-2">Salesperson %</div>
                      {salesRows.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Salesperson</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total Retail</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Company</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units Sold</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Company</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {salesRows.map((row) => (
                                <tr key={`m-${entry.label}-p-${row.label}`}>
                                  <td className="px-4 py-2 text-slate-700">{row.label || "—"}</td>
                                  <td className="px-4 py-2 text-right text-slate-700">${Number(row.totalRetail || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.retailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{Number(row.units || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.unitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownUnitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalUnitsPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No salesperson data.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {printIncludeCategory && printData?.categoryBreakdowns?.length ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Category Drill-downs</h3>
            {printData.categoryBreakdowns.map((entry) => {
              const storeTotals = computeReportTotals(entry.storeRows);
              const storeRows = withReportPercentages(entry.storeRows, storeTotals, printStoreOverallMap, printOverallTotals).filter((row) => {
                const retail = Number(row.totalRetail || 0);
                const units = Number(row.units || 0);
                const tickets = Number(row.ticketCount || 0);
                const retailPct = Number(row.retailPct || 0);
                const unitsPct = Number(row.unitsPct || 0);
                return !(retail == 0 && units == 0 && tickets == 0) && !(retailPct == 0 && unitsPct == 0);
              });
              const salesTotals = computeReportTotals(entry.salespersonRows);
              const salesRows = withReportPercentages(entry.salespersonRows, salesTotals, printSalesOverallMap, printOverallTotals).filter((row) => {
                const retail = Number(row.totalRetail || 0);
                const units = Number(row.units || 0);
                const tickets = Number(row.ticketCount || 0);
                const retailPct = Number(row.retailPct || 0);
                const unitsPct = Number(row.unitsPct || 0);
                return !(retail == 0 && units == 0 && tickets == 0) && !(retailPct == 0 && unitsPct == 0);
              });
              return (
                <div key={`c-${entry.label}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 fd-print-block">
                  <h4 className="text-base font-semibold text-slate-800 mb-3">Category: {entry.label}</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-700 mb-2">Store %</div>
                      {storeRows.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Store</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total Retail</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Company</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units Sold</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Company</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {storeRows.map((row) => (
                                <tr key={`c-${entry.label}-s-${row.label}`}>
                                  <td className="px-4 py-2 text-slate-700">{row.label || "—"}</td>
                                  <td className="px-4 py-2 text-right text-slate-700">${Number(row.totalRetail || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.retailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{Number(row.units || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.unitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownUnitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalUnitsPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No store data.</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700 mb-2">Salesperson %</div>
                      {salesRows.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Salesperson</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total Retail</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Company</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units Sold</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % View</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Own</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Company</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {salesRows.map((row) => (
                                <tr key={`c-${entry.label}-p-${row.label}`}>
                                  <td className="px-4 py-2 text-slate-700">{row.label || "—"}</td>
                                  <td className="px-4 py-2 text-right text-slate-700">${Number(row.totalRetail || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.retailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalRetailPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{Number(row.units || 0).toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.unitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.ownUnitsPct.toFixed(1)}%</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{row.totalUnitsPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No salesperson data.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {printIncludeLowMargin && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 fd-print-block">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Lowest Margin Tickets</h3>
          {printLowMarginFiltered.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Sale</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Salesperson</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Margin %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {printLowMarginFiltered.map((row, idx) => (
                    <tr key={`${row.saleId}-${idx}`}>
                      <td className="px-4 py-2 text-slate-700">{saleLabel(row.saleId, row.salesperson)}</td>
                      <td className="px-4 py-2 text-slate-500">{formatShortDate(String(row.saleDate || ""))}</td>
                      <td className="px-4 py-2 text-slate-500">{row.salesperson || "—"}</td>
                      <td className="px-4 py-2 text-right text-slate-700">${Number(row.grandTotal || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatMarginPct(row.marginPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No low margin data available.</div>
          )}
        </div>
        )}

        {printIncludeStore && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 fd-print-block">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Totals by Store</h3>
          {printStoreFiltered.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Store</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Tickets</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total Retail</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % View</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Own</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Company</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units Sold</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % View</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Own</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Company</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Avg Margin</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {printStoreFiltered.map((row) => (
                    <tr key={`store-${row.label}`}>
                      <td className="px-4 py-2 text-slate-700">{row.label || "—"}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.ticketCount}</td>
                      <td className="px-4 py-2 text-right text-slate-700">${Number(row.totalRetail || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.retailPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.ownRetailPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.totalRetailPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{Number(row.units || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.unitsPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.ownUnitsPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.totalUnitsPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{formatMarginPct(row.avgMarginPct)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-2 text-slate-800">Totals</td>
                    <td className="px-4 py-2 text-right text-slate-700">{printTotalsStore.totalTickets}</td>
                    <td className="px-4 py-2 text-right text-slate-800">${Number(printTotalsStore.totalRetail || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{printTotalsStore.totalRetail > 0 ? "100.0%" : "0.0%"}</td>
                    <td className="px-4 py-2 text-right text-slate-700">--</td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {printOverallRetailTotal > 0 ? ((printTotalsStore.totalRetail / printOverallRetailTotal) * 100).toFixed(1) : "0.0"}%
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{Number(printTotalsStore.totalUnits || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{printTotalsStore.totalUnits > 0 ? "100.0%" : "0.0%"}</td>
                    <td className="px-4 py-2 text-right text-slate-700">--</td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {printOverallUnitsTotal > 0 ? ((printTotalsStore.totalUnits / printOverallUnitsTotal) * 100).toFixed(1) : "0.0"}%
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{formatMarginPct(printTotalsStore.avgMarginPct)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No store report data available.</div>
          )}
        </div>
        )}

        {printIncludeSalesperson && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 fd-print-block">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Totals by Salesperson</h3>
          {printSalespersonFiltered.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Salesperson</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Tickets</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Total Retail</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % View</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Own</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Sales % Company</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units Sold</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % View</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Own</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Units % Company</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Avg Margin</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {printSalespersonFiltered.map((row) => (
                    <tr key={`sp-${row.label}`}>
                      <td className="px-4 py-2 text-slate-700">{row.label || "—"}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.ticketCount}</td>
                      <td className="px-4 py-2 text-right text-slate-700">${Number(row.totalRetail || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.retailPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.ownRetailPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.totalRetailPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{Number(row.units || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.unitsPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.ownUnitsPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.totalUnitsPct.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{formatMarginPct(row.avgMarginPct)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-2 text-slate-800">Totals</td>
                    <td className="px-4 py-2 text-right text-slate-700">{printTotalsSalesperson.totalTickets}</td>
                    <td className="px-4 py-2 text-right text-slate-800">${Number(printTotalsSalesperson.totalRetail || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{printTotalsSalesperson.totalRetail > 0 ? "100.0%" : "0.0%"}</td>
                    <td className="px-4 py-2 text-right text-slate-700">--</td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {printOverallRetailTotal > 0 ? ((printTotalsSalesperson.totalRetail / printOverallRetailTotal) * 100).toFixed(1) : "0.0"}%
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{Number(printTotalsSalesperson.totalUnits || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{printTotalsSalesperson.totalUnits > 0 ? "100.0%" : "0.0%"}</td>
                    <td className="px-4 py-2 text-right text-slate-700">--</td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {printOverallUnitsTotal > 0 ? ((printTotalsSalesperson.totalUnits / printOverallUnitsTotal) * 100).toFixed(1) : "0.0"}%
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{formatMarginPct(printTotalsSalesperson.avgMarginPct)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No salesperson report data available.</div>
          )}
        </div>
        )}
      </div>

    </div>
  );
};

export default SalesDashboard;
