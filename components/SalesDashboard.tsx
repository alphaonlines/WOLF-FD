import React, { useEffect, useState, useMemo } from "react";
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
  fetchManufacturerTopItems,
  fetchCategoryTopItems,
  fetchSalespeopleBySaleIds,
} from "../services/posBackendApi";
import { SalesData, StoreData } from "../types";

type SalespersonPoint = SalesData & {
  fullName: string;
};

type Summary = {
  sales: number;
  lines: number;
};

const PRINTABLE_CARDS = [
  { id: "total-sales", title: "Total Sales" },
  { id: "transactions", title: "Transactions" },
  { id: "range-selector", title: "Range Selector" },
  { id: "financed-amount", title: "Financed Amount" },
  { id: "financed-transactions", title: "Financed Transactions" },
  { id: "average-ticket", title: "Average Ticket" },
  { id: "best-sellers", title: "Best Sellers" },
  { id: "top-categories", title: "Top Categories" },
  { id: "top-manufacturers", title: "Top Manufacturers" },
  { id: "pro1st-attach", title: "Pro1st Attach Rate" },
  { id: "salesperson-performance", title: "Salesperson Performance" },
  { id: "store-performance", title: "Store Performance" },
  { id: "sales-trend", title: "Sales Trend" },
  { id: "low-margins", title: "Lowest Margins" },
  { id: "salesperson-detail", title: "Salesperson Detail" },
];

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const addDaysYmd = (dateYmd: string, days: number) => {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
};

const startOfMonthYmd = (year: number, monthIndex0: number) =>
  ymd(new Date(Date.UTC(year, monthIndex0, 1)));

const getMonthRange = (yearMonth: string): { start: string; endExclusive: string } => {
  const [y, m] = yearMonth.split("-").map((n) => Number(n));
  const start = startOfMonthYmd(y, m - 1);
  const endExclusive = startOfMonthYmd(y, m);
  return { start, endExclusive };
};

const getYearRange = (year: number): { start: string; endExclusive: string } => {
  const start = ymd(new Date(Date.UTC(year, 0, 1)));
  const endExclusive = ymd(new Date(Date.UTC(year + 1, 0, 1)));
  return { start, endExclusive };
};

const getSimplifiedRange = (year: number, month: string, day: string): { start: string; endExclusive: string } | null => {
  if (!year) return null;
  if (month === "ALL") {
    return getYearRange(year);
  }
  const ym = `${year}-${month.padStart(2, "0")}`;
  if (day === "ALL") {
    return getMonthRange(ym);
  }
  const start = `${ym}-${day.padStart(2, "0")}`;
  return { start, endExclusive: addDaysYmd(start, 1) };
};

const pctChange = (current: number, previous: number) => {
  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(previous) || previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const dayOptions = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

const safeDiv = (n: number, d: number) => (Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : 0);

const formatShortDate = (value: string) => {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  const day = d.getUTCDate();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[d.getUTCMonth()];
  const year = String(d.getUTCFullYear() % 100).padStart(2, "0");
  return `${day} ${month} ${year}'`;
};

const formatMonthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

const salespersonLabel = (fullName: string) => {
  const s = String(fullName || "").trim();
  if (!s) return "UNK";
  let first = "", last = "";
  if (s.includes(",")) {
    const [l, f] = s.split(",").map(p => p.trim());
    last = l || "";
    first = f || "";
  } else {
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length > 0) first = parts[0];
    if (parts.length > 1) last = parts[parts.length - 1];
  }
  const initials = ((first[0] || "") + (last[0] || "")).toUpperCase();
  return initials || "UNK";
};

type SalesDashboardProps = {
  itemSortMetric: "sales" | "qty";
  onItemSortMetricChange: (metric: "sales" | "qty") => void;
};

const SalesDashboard: React.FC<SalesDashboardProps> = ({ itemSortMetric, onItemSortMetricChange }) => {
  const [salesData, setSalesData] = useState<SalespersonPoint[]>([]);
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const [trendData, setTrendData] = useState<Array<{ day: string; sales: number; pro1stSales: number }>>([]);
  const [summary, setSummary] = useState<Summary>({ sales: 0, lines: 0 });
  const [summaryCompare, setSummaryCompare] = useState<Summary>({ sales: 0, lines: 0 });
  
  const [yearA, setYearA] = useState<number>(() => new Date().getFullYear());
  const [monthA, setMonthA] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [dayA, setDayA] = useState<string>("ALL");

  const [yearB, setYearB] = useState<number | null>(null);
  const [monthB, setMonthB] = useState<string>("ALL");
  const [dayB, setDayB] = useState<string>("ALL");

  const [compareHint, setCompareHint] = useState("");
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
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(() => new Set());
  const [printHint, setPrintHint] = useState<string | null>(null);

  const selectedCount = selectedCardIds.size;
  const totalPrintable = PRINTABLE_CARDS.length;
  const isCardSelected = (id: string) => selectedCardIds.has(id);
  const toggleCardSelection = (id: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const selectAllCards = () => {
    setSelectedCardIds(new Set(PRINTABLE_CARDS.map((card) => card.id)));
  };
  const clearAllCards = () => {
    setSelectedCardIds(new Set());
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




  useEffect(() => {
    fetchAvailableYears()
      .then((years) => {
        if (!years.length) return;
        setAvailableYears(years);
        const maxYear = years[years.length - 1];
        const prevYear = years.length > 1 ? years[years.length - 2] : null;
        setYearA(maxYear);
        setYearB(prevYear);
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

      const compareRange = yearB ? getSimplifiedRange(yearB, monthB, dayB) : null;
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
        fetchLowMargin({ start: currentRange.start, end: currentRange.endExclusive, limitPer: 10, limitTotal: 200, salesperson, location }),
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
      setError("Couldn’t load POS data. Confirm the backend API is running on http://127.0.0.1:5055.");
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
  }, [yearA, monthA, dayA, yearB, monthB, dayB, selectedSalesperson, selectedStore, itemSortMetric]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("fd-print-selection", {
        detail: { count: selectedCount, total: totalPrintable },
      })
    );
  }, [selectedCount, totalPrintable]);

  useEffect(() => {
    const handler = () => {
      if (!selectedCount) {
        setPrintHint("Select at least one card to print.");
        return;
      }
      setPrintHint(null);
      window.print();
    };
    window.addEventListener("fd-print-request", handler as EventListener);
    return () => window.removeEventListener("fd-print-request", handler as EventListener);
  }, [selectedCount]);

  useEffect(() => {
    if (selectedCount > 0 && printHint) {
      setPrintHint(null);
    }
  }, [selectedCount, printHint]);

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
        const map = new Map<string, { day: string; sales: number; pro1stSales: number }>();
        dailyRows
          .filter((r) => r.day)
          .forEach((r) => {
            const day = String(r.day).includes("T") ? String(r.day).slice(0, 10) : String(r.day);
            map.set(day, {
              day,
              sales: Number.isFinite(r.sales) ? r.sales : 0,
              pro1stSales: 0,
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
              });
            }
          });
        setTrendData(Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day)));
      })
      .catch((e) => {
        console.error(e);
        setTrendData([]);
      });
  }, [yearA, monthA, dayA, selectedSalesperson, selectedStore]);

  const revenuePct = pctChange(summary.sales, summaryCompare.sales);
  const linesPct = pctChange(summary.lines, summaryCompare.lines);

  const revenueUp = revenuePct >= 0;
  const linesUp = linesPct >= 0;
  const financePenetration = summary.lines > 0 ? (finance.financedLines / summary.lines) * 100 : 0;
  const hasCompare = compareHint.trim().length > 0;
  const financedLinesPct = pctChange(finance.financedLines, financeCompare.financedLines);
  const financedAmountPct = pctChange(finance.financedAmount, financeCompare.financedAmount);
  const financeFeePct = pctChange(finance.financeFee, financeCompare.financeFee);
  const financeBalancePct = pctChange(finance.financeBalance, financeCompare.financeBalance);

  const financedLinesUp = financedLinesPct >= 0;
  const financedAmountUp = financedAmountPct >= 0;
  const financeFeeUp = financeFeePct >= 0;
  const financeBalanceUp = financeBalancePct >= 0;

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
  const renderPrintToggle = (id: string) => (
    <label
      className="fd-print-toggle inline-flex items-center gap-2 text-xs font-semibold text-slate-500"
      data-no-print-toggle
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        checked={isCardSelected(id)}
        onChange={() => toggleCardSelection(id)}
        onClick={(event) => event.stopPropagation()}
      />
      Print
    </label>
  );
  const handleCardClick = (id: string) => (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("a,button,select,option,input,textarea,label,[data-no-print-toggle]")) return;
    toggleCardSelection(id);
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
  const selectSalesperson = (name: string) => {
    setSelectedSalesperson((prev) => (prev === name ? null : name));
    setSelectedStore(null);
    setSearchHint(null);
  };
  const selectStore = (name: string) => {
    setSelectedStore((prev) => (prev === name ? null : name));
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
  }, [yearA, monthA, dayA, yearB, monthB, dayB, selectedSalesperson, selectedStore, itemSortMetric]);

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

  useEffect(() => {
    if (selectedSalesperson) return;
    setSelectedCardIds((prev) => {
      if (!prev.has("salesperson-detail")) return prev;
      const next = new Set(prev);
      next.delete("salesperson-detail");
      return next;
    });
  }, [selectedSalesperson]);

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

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-3 items-center fd-print-hide">
        <div className="text-sm font-semibold text-slate-800">Print selection</div>
        <div className="text-xs text-slate-500">
          {selectedCount} of {totalPrintable} selected
        </div>
        <button
          type="button"
          onClick={selectAllCards}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={clearAllCards}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Clear all
        </button>
        {printHint && <span className="text-xs text-amber-600">{printHint}</span>}
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative fd-print-card"
          data-print-id="total-sales"
          data-print-selected={isCardSelected("total-sales") ? "true" : "false"}
          onClick={handleCardClick("total-sales")}
        >
          <div className="absolute right-4 top-4">{renderPrintToggle("total-sales")}</div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Sales</p>
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

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between relative fd-print-card"
          data-print-id="transactions"
          data-print-selected={isCardSelected("transactions") ? "true" : "false"}
          onClick={handleCardClick("transactions")}
        >
          <div className="absolute right-4 top-4">{renderPrintToggle("transactions")}</div>
          <div>
            <p className="text-sm font-medium text-slate-500">Transactions</p>
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

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center space-y-4 relative fd-print-card"
          data-print-id="range-selector"
          data-print-selected={isCardSelected("range-selector") ? "true" : "false"}
          onClick={handleCardClick("range-selector")}
        >
          <div className="absolute right-4 top-4">{renderPrintToggle("range-selector")}</div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Range A (Main)</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={yearA}
                onChange={(e) => setYearA(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={monthA}
                onChange={(e) => {
                  setMonthA(e.target.value);
                  if (e.target.value === "ALL") setDayA("ALL");
                }}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
              >
                <option value="ALL">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {new Date(2024, parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "short" })}
                  </option>
                ))}
              </select>
              <select
                value={dayA}
                onChange={(e) => setDayA(e.target.value)}
                disabled={monthA === "ALL"}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 disabled:opacity-50"
              >
                <option value="ALL">All Days</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Range B (Compare)</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={yearB || ""}
                onChange={(e) => setYearB(e.target.value ? Number(e.target.value) : null)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2"
              >
                <option value="">None</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={monthB}
                onChange={(e) => {
                  setMonthB(e.target.value);
                  if (e.target.value === "ALL") setDayB("ALL");
                }}
                disabled={!yearB}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 disabled:opacity-50"
              >
                <option value="ALL">All Months</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {new Date(2024, parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "short" })}
                  </option>
                ))}
              </select>
              <select
                value={dayB}
                onChange={(e) => setDayB(e.target.value)}
                disabled={!yearB || monthB === "ALL"}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 disabled:opacity-50"
              >
                <option value="ALL">All Days</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Finance + Avg Ticket */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card"
          data-print-id="financed-amount"
          data-print-selected={isCardSelected("financed-amount") ? "true" : "false"}
          onClick={handleCardClick("financed-amount")}
        >
          <div className="absolute right-4 top-4">{renderPrintToggle("financed-amount")}</div>
          <p className="text-sm font-medium text-slate-500">Financed Amount</p>
          <h3 className="text-2xl font-bold text-slate-800">${finance.financedAmount.toLocaleString()}</h3>
          <p className="text-sm text-slate-400 mt-1">{financePenetration.toFixed(1)}% of transactions financed</p>
          {hasCompare && (
            <div className={`flex items-center text-sm mt-2 ${financedAmountUp ? "text-green-600" : "text-red-500"}`}>
              {financedAmountUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
              <span className="font-medium">{Math.abs(financedAmountPct).toFixed(1)}%</span>
              <span className="text-slate-400 ml-1">{compareHint}</span>
            </div>
          )}
        </div>
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card"
          data-print-id="financed-transactions"
          data-print-selected={isCardSelected("financed-transactions") ? "true" : "false"}
          onClick={handleCardClick("financed-transactions")}
        >
          <div className="absolute right-4 top-4">{renderPrintToggle("financed-transactions")}</div>
          <p className="text-sm font-medium text-slate-500">Financed Transactions</p>
          <h3 className="text-2xl font-bold text-slate-800">{finance.financedLines.toLocaleString()}</h3>
          <p className="text-sm text-slate-400 mt-1">Count where finance &gt; 0</p>
          {hasCompare && (
            <div className={`flex items-center text-sm mt-2 ${financedLinesUp ? "text-green-600" : "text-red-500"}`}>
              {financedLinesUp ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
              <span className="font-medium">{Math.abs(financedLinesPct).toFixed(1)}%</span>
              <span className="text-slate-400 ml-1">{compareHint}</span>
            </div>
          )}
        </div>
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative fd-print-card"
          data-print-id="average-ticket"
          data-print-selected={isCardSelected("average-ticket") ? "true" : "false"}
          onClick={handleCardClick("average-ticket")}
        >
          <div className="absolute right-4 top-4">{renderPrintToggle("average-ticket")}</div>
          <p className="text-sm font-medium text-slate-500">Average Ticket</p>
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="best-sellers"
          data-print-selected={isCardSelected("best-sellers") ? "true" : "false"}
          onClick={handleCardClick("best-sellers")}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Best Sellers</h3>
              <p className="text-sm text-slate-500">
                Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"} for the selected range.
              </p>
            </div>
            {renderPrintToggle("best-sellers")}
          </div>
          {bestSellers.length ? (
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
          )}
        </div>

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="top-categories"
          data-print-selected={isCardSelected("top-categories") ? "true" : "false"}
          onClick={handleCardClick("top-categories")}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Top Categories</h3>
              <p className="text-sm text-slate-500">
                Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"}.
              </p>
            </div>
            {renderPrintToggle("top-categories")}
          </div>
          {topCategories.length ? (
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
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="top-manufacturers"
          data-print-selected={isCardSelected("top-manufacturers") ? "true" : "false"}
          onClick={handleCardClick("top-manufacturers")}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Top Manufacturers</h3>
              <p className="text-sm text-slate-500">
                Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"}.
              </p>
            </div>
            {renderPrintToggle("top-manufacturers")}
          </div>
          {topManufacturers.length ? (
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
          )}
        </div>

        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="pro1st-attach"
          data-print-selected={isCardSelected("pro1st-attach") ? "true" : "false"}
          onClick={handleCardClick("pro1st-attach")}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Pro1st Attach Rate</h3>
              <p className="text-sm text-slate-500">Sales orders that include Pro1st</p>
            </div>
            {renderPrintToggle("pro1st-attach")}
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-2xl font-bold text-slate-800">
                {hasItemData ? `${pro1stStats.attachRate.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-slate-500">
                {hasItemData ? `${pro1stStats.proSales} of ${pro1stStats.totalSales} sales` : "No item data in this range"}
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
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salesperson Performance */}
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="salesperson-performance"
          data-print-selected={isCardSelected("salesperson-performance") ? "true" : "false"}
          onClick={handleCardClick("salesperson-performance")}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Salesperson Performance</h3>
              <p className="text-sm text-slate-500">Revenue by associate</p>
            </div>
            {renderPrintToggle("salesperson-performance")}
          </div>
          <div className="h-80 w-full" data-no-print-toggle>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
        </div>

        {/* Store Location Breakdown */}
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="store-performance"
          data-print-selected={isCardSelected("store-performance") ? "true" : "false"}
          onClick={handleCardClick("store-performance")}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Store Performance</h3>
              <p className="text-sm text-slate-500">Revenue by location</p>
            </div>
            {renderPrintToggle("store-performance")}
          </div>
          <div className="h-80 w-full" data-no-print-toggle>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storeData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
        </div>
      </div>

      {/* Trend */}
      <div
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
        data-print-id="sales-trend"
        data-print-selected={isCardSelected("sales-trend") ? "true" : "false"}
        onClick={handleCardClick("sales-trend")}
      >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Sales Trend</h3>
              <p className="text-sm text-slate-500">Trend mirrors the selected date range.</p>
            </div>
            {renderPrintToggle("sales-trend")}
          </div>
        <div className="h-80 w-full" data-no-print-toggle>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={trendData}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              onClick={(evt: any) => {
                const label = evt?.activeLabel;
                if (!label) return;
                const day = String(label).includes("T") ? String(label).slice(0, 10) : String(label);
                if (!day) return;
                setCompareMode("TWO_DAYS");
                setSelectedDay(day);
                setCompareDay("");
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
                tickFormatter={(v: string) => formatShortDate(String(v).includes("T") ? String(v).slice(0, 10) : String(v))}
              />
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
                labelFormatter={(label: string) =>
                  formatShortDate(String(label).includes("T") ? String(label).slice(0, 10) : String(label))
                }
                formatter={(value: number, name: string) => {
                  const label = name === "pro1stSales" ? "Pro1st" : "Sales";
                  return [`$${Number(value).toLocaleString()}`, label];
                }}
              />
              <Legend iconType="circle" />
              <Area type="monotone" dataKey="pro1stSales" name="Pro1st" stroke="#f59e0b" fill="url(#pro1stFill)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lowest Margins per Salesperson */}
      <div
        className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
        data-print-id="low-margins"
        data-print-selected={isCardSelected("low-margins") ? "true" : "false"}
        onClick={handleCardClick("low-margins")}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Lowest Margins per Salesperson (Trend Dates)</h3>
            <p className="text-sm text-slate-500">Lowest 10 margin sales per associate (by selected period) - Click headers to sort</p>
          </div>
          {renderPrintToggle("low-margins")}
        </div>
        {sortedLowMarginData.length > 0 ? (
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => setLowMarginSort(prev => ({ column: 'marginPct', direction: prev.column === 'marginPct' && prev.direction === 'asc' ? 'desc' : 'asc' }))}>
                    Margin % {lowMarginSort.column === 'marginPct' && (lowMarginSort.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                  {sortedLowMarginData.map((row, idx) => (
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
          <p className="text-sm text-slate-500">No low margin data available.</p>
        )}
      </div>

      {selectedSalesperson && (
        <div
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card"
          data-print-id="salesperson-detail"
          data-print-selected={isCardSelected("salesperson-detail") ? "true" : "false"}
          onClick={handleCardClick("salesperson-detail")}
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Salesperson Detail: {selectedSalesperson}</h3>
              <p className="text-sm text-slate-500">All tickets for the selected date range</p>
            </div>
            {renderPrintToggle("salesperson-detail")}
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


    </div>
  );
};

export default SalesDashboard;
