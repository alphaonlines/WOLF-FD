import React, { useEffect, useState, useMemo } from "react";
import {
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
  fetchSummary,
  fetchBestSellers,
  fetchTopCategories,
  fetchTopManufacturers,
  fetchPro1stAttachRate,
  fetchSalespersonTickets,
} from "../services/posBackendApi";
import { SalesData, StoreData } from "../types";
import UpdateDatabase from "./UpdateDatabase";

type CompareMode = "TWO_DAYS" | "TWO_WEEKS" | "TWO_MONTHS" | "TWO_YEARS";

type SalespersonPoint = SalesData & {
  fullName: string;
};

type Summary = {
  sales: number;
  lines: number;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const addDaysYmd = (dateYmd: string, days: number) => {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
};

const addMonthsYm = (yearMonth: string, monthsDelta: number) => {
  const [y, m] = yearMonth.split("-").map((n) => Number(n));
  if (!y || !m) return yearMonth;
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + monthsDelta);
  return d.toISOString().slice(0, 7);
};

const startOfMonthYmd = (year: number, monthIndex0: number) =>
  ymd(new Date(Date.UTC(year, monthIndex0, 1)));

const getIsoWeekStart = (isoWeek: string): string | null => {
  // input: "YYYY-Www" (from <input type="week" />)
  const m = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  // ISO week 1 is the week with Jan 4th in it.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay(); // 0 Sun .. 6 Sat
  const diffToMonday = (day + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - diffToMonday);

  const d = new Date(week1Monday);
  d.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return ymd(d);
};

const currentIsoWeek = () => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

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

const pctChange = (current: number, previous: number) => {
  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(previous) || previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    options.push({ value, label });
  }
  return options;
};

const generateWeekOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    const year = d.getFullYear();
    const weekNum = Math.ceil((d.getTime() - new Date(year, 0, 1).getTime()) / 604800000);
    const isoWeek = `${year}-W${String(weekNum).padStart(2, '0')}`;
    const label = `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    options.push({ value: isoWeek, label });
  }
  return options;
};

const generateDayOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const value = ymd(d);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    options.push({ value, label });
  }
  return options;
};

const yearFromYm = (ym: string) => ym.split('-')[0];
const monthFromYm = (ym: string) => ym.split('-')[1];
const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const dayOptions = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

const isValidYm = (v: string) => /^\d{4}-\d{2}$/.test(v);
const isValidIsoWeek = (v: string) => /^\d{4}-W\d{2}$/.test(v);

const safeDiv = (n: number, d: number) => (Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : 0);

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

const SalesDashboard: React.FC = () => {
  const [salesData, setSalesData] = useState<SalespersonPoint[]>([]);
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const [trendData, setTrendData] = useState<Array<{ day: string; sales: number }>>([]);
  const [summary, setSummary] = useState<Summary>({ sales: 0, lines: 0 });
  const [summaryCompare, setSummaryCompare] = useState<Summary>({ sales: 0, lines: 0 });
  const [compareMode, setCompareMode] = useState<CompareMode>("TWO_MONTHS");
  const [compareHint, setCompareHint] = useState("");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearA, setYearA] = useState<number>(() => new Date().getFullYear());
  const [yearB, setYearB] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>(() => currentIsoWeek());
  const [compareWeek, setCompareWeek] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>(ymd(new Date()));
  const [compareDay, setCompareDay] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => "2026-01");
  const [compareMonth, setCompareMonth] = useState<string>("");
  const [salespersonQuery, setSalespersonQuery] = useState("");
  const [loading, setLoading] = useState(true);
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
  const [itemSortMetric, setItemSortMetric] = useState<"sales" | "qty">("sales");
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
      let currentRange: { start: string; endExclusive: string };
      let compareRange: { start: string; endExclusive: string } | null = null;

      const salesperson = salespersonQuery.trim() ? salespersonQuery.trim() : undefined;

      if (compareMode === "TWO_WEEKS") {
        const weekA = getIsoWeekStart(selectedWeek);
        const weekB = getIsoWeekStart(compareWeek);
        if (!weekA) throw new Error("Invalid Week A");
        currentRange = { start: weekA, endExclusive: addDaysYmd(weekA, 7) };
        if (weekB) {
          compareRange = { start: weekB, endExclusive: addDaysYmd(weekB, 7) };
          setCompareHint(`vs ${compareWeek}`);
        } else {
          setCompareHint("");
        }
      } else if (compareMode === "TWO_DAYS") {
        if (!selectedDay) throw new Error("Invalid Day A");
        currentRange = { start: selectedDay, endExclusive: addDaysYmd(selectedDay, 1) };
        if (compareDay) {
          compareRange = { start: compareDay, endExclusive: addDaysYmd(compareDay, 1) };
          setCompareHint(`vs ${compareDay}`);
        } else {
          setCompareHint("");
        }
      } else if (compareMode === "TWO_YEARS") {
        if (!Number.isFinite(yearA)) throw new Error("Invalid Year A");
        currentRange = getYearRange(yearA);
        if (yearB !== null && Number.isFinite(yearB)) {
          compareRange = getYearRange(yearB);
          setCompareHint(`vs ${yearB}`);
        } else {
          setCompareHint("");
        }
      } else {
        if (!isValidYm(selectedMonth)) throw new Error("Invalid Month A");
        currentRange = getMonthRange(selectedMonth);
        if (isValidYm(compareMonth)) {
          compareRange = getMonthRange(compareMonth);
          setCompareHint(`vs ${compareMonth}`);
        } else {
          setCompareHint("");
        }
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
        }),
        fetchSalesByLocation({ start: currentRange.start, end: currentRange.endExclusive, salesperson }),
        fetchSummary({ start: currentRange.start, end: currentRange.endExclusive, salesperson }),
        fetchFinanceSummary({ start: currentRange.start, end: currentRange.endExclusive, salesperson }),
        compareRange
          ? fetchSummary({ start: compareRange.start, end: compareRange.endExclusive, salesperson })
          : Promise.resolve(null),
        compareRange
          ? fetchFinanceSummary({ start: compareRange.start, end: compareRange.endExclusive, salesperson })
          : Promise.resolve(null),
        fetchLowMargin({ start: currentRange.start, end: currentRange.endExclusive, limitPer: 10, limitTotal: 200, salesperson }),
        fetchBestSellers({ start: currentRange.start, end: currentRange.endExclusive, limit: 10 }),
        fetchTopCategories({ start: currentRange.start, end: currentRange.endExclusive, limit: 8 }),
        fetchTopManufacturers({ start: currentRange.start, end: currentRange.endExclusive, limit: 8 }),
        fetchPro1stAttachRate({ start: currentRange.start, end: currentRange.endExclusive }),
        salesperson
          ? fetchSalespersonTickets({
              start: currentRange.start,
              end: currentRange.endExclusive,
              salesperson,
              limit: 5000,
            })
          : Promise.resolve([]),
      ]);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [compareMode, selectedDay, compareDay, selectedWeek, compareWeek, selectedMonth, compareMonth, yearA, yearB, salespersonQuery]);

  useEffect(() => {
    const salesperson = salespersonQuery.trim() ? salespersonQuery.trim() : undefined;
    let start = "1900-01-01";
    let endExclusive = "2100-01-01";

    try {
      if (compareMode === "TWO_WEEKS") {
        const weekA = getIsoWeekStart(selectedWeek);
        if (weekA) {
          start = weekA;
          endExclusive = addDaysYmd(weekA, 7);
        }
      } else if (compareMode === "TWO_DAYS") {
        if (selectedDay) {
          start = selectedDay;
          endExclusive = addDaysYmd(selectedDay, 1);
        }
      } else if (compareMode === "TWO_YEARS") {
        const range = getYearRange(yearA);
        start = range.start;
        endExclusive = range.endExclusive;
      } else if (isValidYm(selectedMonth)) {
        const range = getMonthRange(selectedMonth);
        start = range.start;
        endExclusive = range.endExclusive;
      }
    } catch {
      return;
    }

    fetchSalesDaily({ start, end: endExclusive, salesperson })
      .then((dailyRows) => {
        setTrendData(
          dailyRows
            .filter((r) => r.day)
            .map((r) => ({
              day: String(r.day).includes("T") ? String(r.day).slice(0, 10) : String(r.day),
              sales: Number.isFinite(r.sales) ? r.sales : 0,
            }))
        );
      })
      .catch((e) => {
        console.error(e);
        setTrendData([]);
      });
  }, [compareMode, selectedDay, selectedWeek, selectedMonth, yearA, salespersonQuery]);

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
  const saleLink = (saleId: string) =>
    `https://www.gimmethebest.net/furnituredistributors/online/sale_rec_502.asp?saleid=${saleId.padStart(5, "0")}&type=1`;
  const limitSaleLinks = (ids: string[], max = 6) => {
    const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
    return { ids: unique.slice(0, max), remaining: Math.max(0, unique.length - max) };
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
      <UpdateDatabase onUploadComplete={() => {
        void loadData();
      }} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center">
          <label className="text-sm font-medium text-slate-500 mb-2">Compare</label>
          <select
            value={compareMode}
            onChange={(e) => setCompareMode(e.target.value as CompareMode)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          >
            <option value="TWO_DAYS">Compare Two Days</option>
            <option value="TWO_WEEKS">Compare Two Weeks</option>
            <option value="TWO_MONTHS">Compare Two Months</option>
            <option value="TWO_YEARS">Compare Two Years</option>
          </select>
          {compareMode === "TWO_DAYS" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Day A</label>
                <select
                  value={selectedDay}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") return;
                    setSelectedDay(v);
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  {generateDayOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Day B (optional)</label>
                <select
                  value={compareDay}
                  onChange={(e) => setCompareDay(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  <option value="">—</option>
                  {generateDayOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : compareMode === "TWO_WEEKS" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Week A</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") return; // don't allow clearing Week A
                    setSelectedWeek(v);
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  {generateWeekOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Week B (optional)</label>
                <select
                  value={compareWeek}
                  onChange={(e) => setCompareWeek(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  <option value="">—</option>
                  {generateWeekOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : compareMode === "TWO_YEARS" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Year A</label>
                <select
                  value={String(yearA)}
                  onChange={(e) => setYearA(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  {(availableYears.length ? [...availableYears, 2023] : [yearA, 2023]).map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Year B (optional)</label>
                <select
                  value={yearB === null ? "" : String(yearB)}
                  onChange={(e) => setYearB(e.target.value ? Number(e.target.value) : null)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                >
                  <option value="">—</option>
                  {(availableYears.length ? [...availableYears, 2023] : yearB === null ? [2023] : [yearB, 2023]).map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
                  <select
                    value={yearFromYm(selectedMonth)}
                    onChange={(e) => setSelectedMonth(`${e.target.value}-${monthFromYm(selectedMonth)}`)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
                  <select
                    value={monthFromYm(selectedMonth)}
                    onChange={(e) => setSelectedMonth(`${yearFromYm(selectedMonth)}-${e.target.value}`)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {new Date(2024, parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
                  <select
                    value={compareMonth ? yearFromYm(compareMonth) : ""}
                    onChange={(e) => setCompareMonth(e.target.value && monthFromYm(compareMonth || selectedMonth) ? `${e.target.value}-${monthFromYm(compareMonth || selectedMonth)}` : "")}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  >
                    <option value="">—</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
                  <select
                    value={compareMonth ? monthFromYm(compareMonth) : ""}
                    onChange={(e) => setCompareMonth(e.target.value && yearFromYm(compareMonth || selectedMonth) ? `${yearFromYm(compareMonth || selectedMonth)}-${e.target.value}` : "")}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  >
                    <option value="">—</option>
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {new Date(2024, parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Finance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
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
      </div>

      {/* Extra KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
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

      {/* Item Analytics */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">Item Rankings</div>
          <div className="text-xs text-slate-500">Sort Best Sellers, Categories, and Manufacturers together.</div>
        </div>
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Best Sellers</h3>
            <p className="text-sm text-slate-500">
              Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"} for the selected range.
            </p>
          </div>
          {bestSellers.length ? (
            <div className="space-y-4">
              {[...bestSellers]
                .sort((a, b) => {
                  const aVal = itemSortMetric === "qty" ? a.qty : a.sales;
                  const bVal = itemSortMetric === "qty" ? b.qty : b.sales;
                  return bVal - aVal;
                })
                .map((item, idx) => {
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
                            {sid}
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Top Categories</h3>
            <p className="text-sm text-slate-500">
              Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"}.
            </p>
          </div>
          {topCategories.length ? (
            <div className="space-y-4">
              {[...topCategories]
                .sort((a, b) => {
                  const aVal = itemSortMetric === "qty" ? a.qty : a.sales;
                  const bVal = itemSortMetric === "qty" ? b.qty : b.sales;
                  return bVal - aVal;
                })
                .map((row) => (
                <div key={row.category} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{row.category}</div>
                    <div className="text-xs text-slate-500">{row.qty.toLocaleString()} qty</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">${row.sales.toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No category data available for this range.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Top Manufacturers</h3>
            <p className="text-sm text-slate-500">
              Ranked by {itemSortMetric === "qty" ? "units sold" : "sales dollars"}.
            </p>
          </div>
          {topManufacturers.length ? (
            <div className="space-y-4">
              {[...topManufacturers]
                .sort((a, b) => {
                  const aVal = itemSortMetric === "qty" ? a.qty : a.sales;
                  const bVal = itemSortMetric === "qty" ? b.qty : b.sales;
                  return bVal - aVal;
                })
                .map((row) => (
                <div key={row.manufacturer} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{row.manufacturer}</div>
                    <div className="text-xs text-slate-500">{row.qty.toLocaleString()} qty</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">${row.sales.toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No manufacturer data available for this range.</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Pro1st Attach Rate</h3>
            <p className="text-sm text-slate-500">Sales orders that include Pro1st</p>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-2xl font-bold text-slate-800">{pro1stStats.attachRate.toFixed(1)}%</div>
              <div className="text-xs text-slate-500">{pro1stStats.proSales} of {pro1stStats.totalSales} sales</div>
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
                            {sid}
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Salesperson Performance</h3>
            <p className="text-sm text-slate-500">Revenue by associate</p>
          </div>
          <div className="h-80 w-full">
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
                <Bar dataKey="sales" name="Total Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Store Location Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Store Performance</h3>
            <p className="text-sm text-slate-500">Revenue by location</p>
          </div>
          <div className="h-80 w-full">
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
                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Trend */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
           <div>
             <h3 className="text-lg font-bold text-slate-800">Sales Trend</h3>
             <p className="text-sm text-slate-500">Trend mirrors the selected date range.</p>
           </div>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(v: string) => (String(v).includes("T") ? String(v).slice(0, 10) : String(v))}
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
                labelFormatter={(label: string) => (String(label).includes("T") ? String(label).slice(0, 10) : String(label))}
                formatter={(value: number) => [`$${Number(value).toLocaleString()}`, undefined]}
              />
              <Legend iconType="circle" />
              <Line type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lowest Margins per Salesperson */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800">Lowest Margins per Salesperson (Trend Dates)</h3>
          <p className="text-sm text-slate-500">Lowest 10 margin sales per associate (by selected period) - Click headers to sort</p>
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
                          href={`https://www.gimmethebest.net/furnituredistributors/online/sale_rec_502.asp?saleid=${row.saleId.padStart(5, '0')}&type=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.saleId}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.saleDate}</td>
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

      {salespersonQuery.trim() && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800">Salesperson Detail: {salespersonQuery.trim()}</h3>
            <p className="text-sm text-slate-500">All tickets for the selected date range</p>
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
                          {row.saleId}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.saleDate}</td>
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

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="text-sm font-semibold text-slate-800">Filters</div>
        <div className="flex-1 max-w-xl">
          <input
            value={salespersonQuery}
            onChange={(e) => setSalespersonQuery(e.target.value)}
            placeholder="Search salesperson (e.g. Lynn, Underwood)…"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
          />
          <div className="mt-1 text-xs text-slate-500">Applies to totals, charts, and trend.</div>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
