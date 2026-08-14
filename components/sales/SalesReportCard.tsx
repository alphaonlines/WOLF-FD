import React from "react";
import { formatShortDate, getMetricComparisonDisplay } from "../salesUtils";
import { ReportRowWithPct, ReportTotals } from "../salesReportUtils";

type LowMarginRow = {
  saleId: string;
  saleDate: string;
  salesperson: string;
  grandTotal: number;
  profit: number;
  marginPct: number | null;
};

type LowMarginSort = {
  column: string;
  direction: "asc" | "desc";
};

type SalesReportCardProps = {
  collapsed: boolean;
  renderHelp: (text: string) => React.ReactNode;
  cardToggle: React.ReactNode;
  itemSortMetric: "sales" | "qty";
  reportMode: "totals" | "lowest";
  setReportMode: (mode: "totals" | "lowest") => void;
  reportDimension: "salesperson" | "store";
  setReportDimension: (dimension: "salesperson" | "store") => void;
  reportCategories: string[];
  setReportCategories: (categories: string[]) => void;
  reportManufacturer: string;
  setReportManufacturer: (manufacturer: string) => void;
  reportCategoryOptions: string[];
  reportManufacturerOptions: string[];
  reportRowsWithPct: ReportRowWithPct[];
  compareRowsWithPct?: ReportRowWithPct[];
  reportTotals: ReportTotals;
  compareTotals?: ReportTotals;
  reportOverallTotals: { totalRetail: number; totalUnits: number };
  compareOverallTotals?: { totalRetail: number; totalUnits: number };
  compareHint?: string;
  formatMarginPct: (value: number | null) => string;
  lowMarginRows: LowMarginRow[];
  lowMarginSort: LowMarginSort;
  setLowMarginSort: React.Dispatch<React.SetStateAction<LowMarginSort>>;
  saleLink: (saleId: string) => string;
  saleLabel: (saleId: string, salesperson?: string) => string;
  selectedSalesperson: string | null;
  selectedStore: string | null;
  onSelectSalesperson: (salesperson: string) => void;
  onSelectStore: (store: string) => void;
  canonicalMonthLabel: string;
  canonicalRangeLabel: "Month to date" | "Latest available month";
  canonicalWarnings: { openDeliveredTickets: number; duplicateItemLines: number; twoPersonTickets: number };
  canonicalMissingCostCount: number;
  canonicalDetail: { total: number; page: number; pageSize: number; rows: any[] };
  canonicalDetailLoading: boolean;
  onCanonicalDetailPage: (page: number) => void;
};

const SalesReportCard: React.FC<SalesReportCardProps> = ({
  collapsed,
  renderHelp,
  cardToggle,
  itemSortMetric,
  reportMode,
  setReportMode,
  reportDimension,
  setReportDimension,
  reportCategories,
  setReportCategories,
  reportManufacturer,
  setReportManufacturer,
  reportCategoryOptions,
  reportManufacturerOptions,
  reportRowsWithPct,
  compareRowsWithPct = [],
  reportTotals,
  compareTotals,
  reportOverallTotals,
  compareOverallTotals,
  compareHint = "",
  formatMarginPct,
  lowMarginRows,
  lowMarginSort,
  setLowMarginSort,
  saleLink,
  saleLabel,
  selectedSalesperson,
  selectedStore,
  onSelectSalesperson,
  onSelectStore,
  canonicalMonthLabel,
  canonicalRangeLabel,
  canonicalWarnings,
  canonicalMissingCostCount,
  canonicalDetail,
  canonicalDetailLoading,
  onCanonicalDetailPage,
}) => {
  const hasCompare = compareHint.trim().length > 0;
  const categoryValues = React.useMemo(
    () => reportCategoryOptions.filter((category) => category && category !== "ALL"),
    [reportCategoryOptions]
  );
  const selectedCategorySet = React.useMemo(() => new Set(reportCategories.filter(Boolean)), [reportCategories]);
  const activeCategoryCount = selectedCategorySet.size;
  const categoryFilterLabel = activeCategoryCount === 0 ? "All Categories" : `${activeCategoryCount} Categories`;
  const toggleCategory = (category: string) => {
    if (!category) return;
    const next = new Set(selectedCategorySet);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setReportCategories(Array.from(next));
  };
  const compareRowsByLabel = React.useMemo(
    () => new Map(compareRowsWithPct.map((row) => [row.label, row])),
    [compareRowsWithPct]
  );

  const formatAverageTicket = (totalRetail: number, ticketCount: number) => {
    if (!Number.isFinite(totalRetail) || !Number.isFinite(ticketCount) || ticketCount <= 0) {
      return "$0";
    }
    return `$${(totalRetail / ticketCount).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPro1stPct = (pro1stSales: number, eligibleSales: number) => {
    if (!Number.isFinite(pro1stSales) || !Number.isFinite(eligibleSales) || eligibleSales <= 0) {
      return "0.0%";
    }
    return `${((pro1stSales / eligibleSales) * 100).toFixed(1)}%`;
  };

  const pro1stPctValue = (pro1stSales: number, eligibleSales: number) => {
    if (!Number.isFinite(pro1stSales) || !Number.isFinite(eligibleSales) || eligibleSales <= 0) return 0;
    return (pro1stSales / eligibleSales) * 100;
  };

  const avgTicketValue = (totalRetail: number, ticketCount: number) => {
    if (!Number.isFinite(totalRetail) || !Number.isFinite(ticketCount) || ticketCount <= 0) return 0;
    return totalRetail / ticketCount;
  };

  const formatCompareCurrency = (value: number) =>
    `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formatCompareNumber = (value: number) =>
    Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const formatComparePct = (value: number) => `${Number(value || 0).toFixed(1)}%`;

  const renderComparison = (current: number, previous: number, previousLabel: string) => {
    if (!hasCompare) return null;
    const display = getMetricComparisonDisplay(current, previous, `vs ${previousLabel}`);
    const isUp = display.direction === "up";
    return (
      <div className={`mt-1 text-[11px] font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
        {isUp ? "▲" : "▼"} {display.absLabel} <span className="font-normal">{display.compareLabel}</span>
      </div>
    );
  };

  const renderPctBreakdown = (
    viewValue: string,
    ownValue: string,
    companyValue: string,
    tone: "sales" | "units" = "sales"
  ) => (
    <div className={`space-y-1 text-xs ${tone === "sales" ? "text-slate-600" : "text-slate-500"}`}>
      <div>
        <span className="font-medium text-slate-700">View:</span> {viewValue}
      </div>
      <div>
        <span className="font-medium text-slate-700">Own:</span> {ownValue}
      </div>
      <div>
        <span className="font-medium text-slate-700">Co:</span> {companyValue}
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card" data-print-id="sales-report">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Sales Report
            {renderHelp("Totals use sales report with item-report filters (category/manufacturer) when selected.")}
          </h3>
          <p className="text-sm text-slate-500">
            Totals by salesperson or store, plus lowest margin tickets (by selected period).{" "}
            {reportMode === "totals"
              ? itemSortMetric === "qty"
                ? "QTY mode ranks the table by tickets for the selected range."
                : "Sales mode ranks the table by total retail."
              : ""}
            {reportMode === "totals"
              ? reportDimension === "salesperson"
                ? " Click a salesperson row to open their ticket list."
                : " Click a store row to open its ticket list."
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cardToggle}
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
          <div className="relative">
            <details className="group">
              <summary className="flex min-w-[190px] cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 marker:hidden">
                <span>{categoryFilterLabel}</span>
                <span className="text-xs text-slate-400">▾</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={activeCategoryCount === 0}
                    onChange={() => setReportCategories([])}
                  />
                  <span className="font-medium">All Categories</span>
                </label>
                <div className="my-2 border-t border-slate-100" />
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {categoryValues.map((category) => (
                    <label
                      key={category}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        checked={selectedCategorySet.has(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      <span className="truncate" title={category}>{category}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>
          </div>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
            value={reportManufacturer}
            onChange={(e) => setReportManufacturer(e.target.value)}
          >
            {reportManufacturerOptions.map((manufacturer) => (
              <option key={manufacturer} value={manufacturer}>
                {manufacturer === "ALL" ? "All Manufacturers" : manufacturer}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!collapsed &&
        (reportMode === "totals" ? (
          reportRowsWithPct.length > 0 ? (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-slate-200 min-w-[800px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-[18%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      {reportDimension === "store" ? "Store" : "Salesperson"}
                      {renderHelp("Grouping based on sales report.")}
                    </th>
                    <th className="w-[14%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Total Retail
                      {renderHelp("Raw sales dollars for this row.")}
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Pro1st %
                      {renderHelp(
                        "Pro1st dollars divided by eligible furniture sales for this row, excluding mattress, box spring, foundation, adjustable-base, and bedding lines."
                      )}
                    </th>
                    <th className="w-[18%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Sales Mix
                      {renderHelp(
                        "Shows sales percent versus the visible rows, this salesperson/store's own total, and company total."
                      )}
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Units Sold
                      {renderHelp("Sum of qty_sold from item report, filtered by category/manufacturer.")}
                    </th>
                    <th className="w-[14%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Avg Ticket
                      {renderHelp("Average retail per ticket for this row.")}
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Margin
                      {renderHelp("Average of per-ticket margin (profit ÷ sales) in the range.")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {reportRowsWithPct.map((row) => {
                    const compareRow = compareRowsByLabel.get(row.label);
                    return (
                    <tr
                      key={row.label}
                      className={
                        (reportDimension === "salesperson" && selectedSalesperson === row.label) ||
                        (reportDimension === "store" && selectedStore === row.label)
                          ? "bg-blue-50/70"
                          : undefined
                      }
                    >
                      <td className="px-3 py-3 text-sm font-medium text-slate-900">
                        {row.label ? (
                          <button
                            type="button"
                            onClick={() =>
                              reportDimension === "salesperson"
                                ? onSelectSalesperson(row.label)
                                : onSelectStore(row.label)
                            }
                            className="rounded-md text-left text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
                          >
                            {row.label}
                          </button>
                        ) : (
                          "(unknown)"
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        <div>${Number(row.totalRetail || 0).toLocaleString()}</div>
                        {renderComparison(
                          Number(row.totalRetail || 0),
                          Number(compareRow?.totalRetail || 0),
                          formatCompareCurrency(Number(compareRow?.totalRetail || 0))
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        <div>{formatPro1stPct(Number(row.pro1stSales || 0), Number(row.eligibleSales || 0))}</div>
                        {renderComparison(
                          pro1stPctValue(Number(row.pro1stSales || 0), Number(row.eligibleSales || 0)),
                          pro1stPctValue(Number(compareRow?.pro1stSales || 0), Number(compareRow?.eligibleSales || 0)),
                          formatComparePct(pro1stPctValue(Number(compareRow?.pro1stSales || 0), Number(compareRow?.eligibleSales || 0)))
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {renderPctBreakdown(
                          `${row.retailPct.toFixed(1)}%`,
                          `${row.ownRetailPct.toFixed(1)}%`,
                          `${row.totalRetailPct.toFixed(1)}%`
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        <div>{Number(row.units || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        {renderComparison(
                          Number(row.units || 0),
                          Number(compareRow?.units || 0),
                          formatCompareNumber(Number(compareRow?.units || 0))
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        <div>{formatAverageTicket(Number(row.totalRetail || 0), Number(row.ticketCount || 0))}</div>
                        {renderComparison(
                          avgTicketValue(Number(row.totalRetail || 0), Number(row.ticketCount || 0)),
                          avgTicketValue(Number(compareRow?.totalRetail || 0), Number(compareRow?.ticketCount || 0)),
                          formatCompareCurrency(avgTicketValue(Number(compareRow?.totalRetail || 0), Number(compareRow?.ticketCount || 0)))
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        <div>{formatMarginPct(row.avgMarginPct)}</div>
                        {renderComparison(
                          Number(row.avgMarginPct || 0),
                          Number(compareRow?.avgMarginPct || 0),
                          formatComparePct(Number(compareRow?.avgMarginPct || 0))
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">Totals</td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      <div>${Number(reportTotals.totalRetail || 0).toLocaleString()}</div>
                      {renderComparison(
                        Number(reportTotals.totalRetail || 0),
                        Number(compareTotals?.totalRetail || 0),
                        formatCompareCurrency(Number(compareTotals?.totalRetail || 0))
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      <div>{formatPro1stPct(Number(reportTotals.totalPro1stSales || 0), Number(reportTotals.totalEligibleSales || 0))}</div>
                      {renderComparison(
                        pro1stPctValue(Number(reportTotals.totalPro1stSales || 0), Number(reportTotals.totalEligibleSales || 0)),
                        pro1stPctValue(Number(compareTotals?.totalPro1stSales || 0), Number(compareTotals?.totalEligibleSales || 0)),
                        formatComparePct(pro1stPctValue(Number(compareTotals?.totalPro1stSales || 0), Number(compareTotals?.totalEligibleSales || 0)))
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {renderPctBreakdown(
                        reportTotals.totalRetail > 0 ? "100.0%" : "0.0%",
                        "--",
                        `${reportOverallTotals.totalRetail > 0
                          ? ((reportTotals.totalRetail / reportOverallTotals.totalRetail) * 100).toFixed(1)
                          : "0.0"}%`
                      )}
                      {renderComparison(
                        reportOverallTotals.totalRetail > 0 ? (reportTotals.totalRetail / reportOverallTotals.totalRetail) * 100 : 0,
                        compareOverallTotals?.totalRetail
                          ? (Number(compareTotals?.totalRetail || 0) / compareOverallTotals.totalRetail) * 100
                          : 0,
                        formatComparePct(
                          compareOverallTotals?.totalRetail
                            ? (Number(compareTotals?.totalRetail || 0) / compareOverallTotals.totalRetail) * 100
                            : 0
                        )
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      <div>{Number(reportTotals.totalUnits || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      {renderComparison(
                        Number(reportTotals.totalUnits || 0),
                        Number(compareTotals?.totalUnits || 0),
                        formatCompareNumber(Number(compareTotals?.totalUnits || 0))
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      <div>{formatAverageTicket(Number(reportTotals.totalRetail || 0), Number(reportTotals.totalTickets || 0))}</div>
                      {renderComparison(
                        avgTicketValue(Number(reportTotals.totalRetail || 0), Number(reportTotals.totalTickets || 0)),
                        avgTicketValue(Number(compareTotals?.totalRetail || 0), Number(compareTotals?.totalTickets || 0)),
                        formatCompareCurrency(avgTicketValue(Number(compareTotals?.totalRetail || 0), Number(compareTotals?.totalTickets || 0)))
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      <div>{formatMarginPct(reportTotals.avgMarginPct)}</div>
                      {renderComparison(
                        Number(reportTotals.avgMarginPct || 0),
                        Number(compareTotals?.avgMarginPct || 0),
                        formatComparePct(Number(compareTotals?.avgMarginPct || 0))
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No sales report data available.</p>
          )
        ) : lowMarginRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() =>
                      setLowMarginSort((prev) => ({
                        column: "salesperson",
                        direction: prev.column === "salesperson" && prev.direction === "asc" ? "desc" : "asc",
                      }))
                    }
                  >
                    Salesperson {lowMarginSort.column === "salesperson" && (lowMarginSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sale ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                    onClick={() =>
                      setLowMarginSort((prev) => ({
                        column: "marginPct",
                        direction: prev.column === "marginPct" && prev.direction === "asc" ? "desc" : "asc",
                      }))
                    }
                  >
                    Margin % {lowMarginSort.column === "marginPct" && (lowMarginSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {lowMarginRows.map((row, idx) => (
                  <tr key={idx} className={row.marginPct !== null && row.marginPct < 10 ? "bg-red-50" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{row.salesperson}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                      <a href={saleLink(row.saleId)} target="_blank" rel="noopener noreferrer">
                        {saleLabel(row.saleId, row.salesperson)}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatShortDate(String(row.saleDate || ""))}</td>
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
        ))}
      {!collapsed && (
        <section className="mt-6 border-t border-slate-200 pt-5" aria-label="Canonical diagnostics and detail">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-800">Canonical diagnostics &amp; detail</h4>
              <p className="text-xs text-slate-500">{canonicalRangeLabel}: {canonicalMonthLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              <span>Open delivered tickets: {canonicalWarnings.openDeliveredTickets}</span>
              <span>Duplicate item lines: {canonicalWarnings.duplicateItemLines}</span>
              <span>Two-person tickets: {canonicalWarnings.twoPersonTickets}</span>
              <span>Missing costs: {canonicalMissingCostCount}</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr>{["Delivered", "Sale", "Store", "Salesperson", "Item", "Description", "Sales", "Cost"].map((label) => <th key={label} className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {canonicalDetail.rows.map((row, index) => <tr key={`${row.store}-${row.saleId}-${row.itemNo}-${index}`}>
                  <td className="px-3 py-2">{formatShortDate(String(row.deliveredDate || ""))}</td><td className="px-3 py-2">{row.saleId}</td><td className="px-3 py-2">{row.store}</td><td className="px-3 py-2">{row.salesperson}</td><td className="px-3 py-2">{row.itemNo}</td><td className="px-3 py-2">{row.description}</td><td className="px-3 py-2">${Number(row.sales || 0).toLocaleString()}</td><td className="px-3 py-2">{row.cost == null ? "Unavailable" : `$${Number(row.cost).toLocaleString()}`}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 text-sm">
            <span>Page {canonicalDetail.page} of {Math.max(1, Math.ceil(canonicalDetail.total / canonicalDetail.pageSize))}</span>
            <button type="button" aria-label="Previous detail page" disabled={canonicalDetailLoading || canonicalDetail.page <= 1} onClick={() => onCanonicalDetailPage(canonicalDetail.page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
            <button type="button" aria-label="Next detail page" disabled={canonicalDetailLoading || canonicalDetail.page * canonicalDetail.pageSize >= canonicalDetail.total} onClick={() => onCanonicalDetailPage(canonicalDetail.page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </section>
      )}
    </div>
  );
};

export default SalesReportCard;
