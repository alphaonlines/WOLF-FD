import React from "react";
import { formatShortDate } from "../salesUtils";
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
  reportCategory: string;
  setReportCategory: (category: string) => void;
  reportManufacturer: string;
  setReportManufacturer: (manufacturer: string) => void;
  reportCategoryOptions: string[];
  reportManufacturerOptions: string[];
  reportRowsWithPct: ReportRowWithPct[];
  reportTotals: ReportTotals;
  reportOverallTotals: { totalRetail: number; totalUnits: number };
  formatMarginPct: (value: number | null) => string;
  lowMarginRows: LowMarginRow[];
  lowMarginSort: LowMarginSort;
  setLowMarginSort: React.Dispatch<React.SetStateAction<LowMarginSort>>;
  saleLink: (saleId: string) => string;
  saleLabel: (saleId: string, salesperson?: string) => string;
  selectedSalesperson: string | null;
  onSelectSalesperson: (salesperson: string) => void;
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
  reportCategory,
  setReportCategory,
  reportManufacturer,
  setReportManufacturer,
  reportCategoryOptions,
  reportManufacturerOptions,
  reportRowsWithPct,
  reportTotals,
  reportOverallTotals,
  formatMarginPct,
  lowMarginRows,
  lowMarginSort,
  setLowMarginSort,
  saleLink,
  saleLabel,
  selectedSalesperson,
  onSelectSalesperson,
}) => {
  const formatAverageTicket = (totalRetail: number, ticketCount: number) => {
    if (!Number.isFinite(totalRetail) || !Number.isFinite(ticketCount) || ticketCount <= 0) {
      return "$0";
    }
    return `$${(totalRetail / ticketCount).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPro1stPct = (pro1stSales: number, totalRetail: number) => {
    if (!Number.isFinite(pro1stSales) || !Number.isFinite(totalRetail) || totalRetail <= 0) {
      return "0.0%";
    }
    // Pro1st % should exclude Pro1st amount from denominator
    const retailExcludingPro1st = totalRetail - pro1stSales;
    if (retailExcludingPro1st <= 0) {
      return "0.0%";
    }
    return `${((pro1stSales / retailExcludingPro1st) * 100).toFixed(1)}%`;
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
            {reportMode === "totals" && reportDimension === "salesperson"
              ? " Click a salesperson row to open their ticket list."
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
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
            value={reportCategory}
            onChange={(e) => setReportCategory(e.target.value)}
          >
            {reportCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {category === "ALL" ? "All Categories" : category}
              </option>
            ))}
          </select>
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
                    <th className="w-[16%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      {reportDimension === "store" ? "Store" : "Salesperson"}
                      {renderHelp("Grouping based on sales report.")}
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Total Retail
                      {renderHelp("Raw sales dollars for this row.")}
                    </th>
                    <th className="w-[10%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Pro1st %
                      {renderHelp(
                        "Pro1st dollars divided by total retail for this row, shown as a percent of sale and excluding mattress, box spring, and foundation-related lines."
                      )}
                    </th>
                    <th className="w-[15%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Sales Mix
                      {renderHelp(
                        "Shows sales percent versus the visible rows, this salesperson/store's own total, and company total."
                      )}
                    </th>
                    <th className="w-[10%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Units Sold
                      {renderHelp("Sum of qty_sold from item report, filtered by category/manufacturer.")}
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Avg Ticket
                      {renderHelp("Average retail per ticket for this row.")}
                    </th>
                    <th className="w-[15%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Units Mix
                      {renderHelp(
                        "Shows unit percent versus the visible rows, this salesperson/store's own total, and company total."
                      )}
                    </th>
                    <th className="w-[10%] px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Margin
                      {renderHelp("Average of per-ticket margin (profit ÷ sales) in the range.")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {reportRowsWithPct.map((row) => (
                    <tr
                      key={row.label}
                      className={
                        reportDimension === "salesperson" && selectedSalesperson === row.label
                          ? "bg-blue-50/70"
                          : undefined
                      }
                    >
                      <td className="px-3 py-3 text-sm font-medium text-slate-900">
                        {reportDimension === "salesperson" && row.label ? (
                          <button
                            type="button"
                            onClick={() => onSelectSalesperson(row.label)}
                            className="rounded-md text-left text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
                          >
                            {row.label}
                          </button>
                        ) : (
                          row.label || "(unknown)"
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">${Number(row.totalRetail || 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        {formatPro1stPct(Number(row.pro1stSales || 0), Number(row.totalRetail || 0))}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {renderPctBreakdown(
                          `${row.retailPct.toFixed(1)}%`,
                          `${row.ownRetailPct.toFixed(1)}%`,
                          `${row.totalRetailPct.toFixed(1)}%`
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        {Number(row.units || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">
                        {formatAverageTicket(Number(row.totalRetail || 0), Number(row.ticketCount || 0))}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {renderPctBreakdown(
                          `${row.unitsPct.toFixed(1)}%`,
                          `${row.ownUnitsPct.toFixed(1)}%`,
                          `${row.totalUnitsPct.toFixed(1)}%`,
                          "units"
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">{formatMarginPct(row.avgMarginPct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">Totals</td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      ${Number(reportTotals.totalRetail || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      {formatPro1stPct(Number(reportTotals.totalPro1stSales || 0), Number(reportTotals.totalRetail || 0))}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {renderPctBreakdown(
                        reportTotals.totalRetail > 0 ? "100.0%" : "0.0%",
                        "--",
                        `${reportOverallTotals.totalRetail > 0
                          ? ((reportTotals.totalRetail / reportOverallTotals.totalRetail) * 100).toFixed(1)
                          : "0.0"}%`
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      {Number(reportTotals.totalUnits || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                      {formatAverageTicket(Number(reportTotals.totalRetail || 0), Number(reportTotals.totalTickets || 0))}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {renderPctBreakdown(
                        reportTotals.totalUnits > 0 ? "100.0%" : "0.0%",
                        "--",
                        `${reportOverallTotals.totalUnits > 0
                          ? ((reportTotals.totalUnits / reportOverallTotals.totalUnits) * 100).toFixed(1)
                          : "0.0"}%`,
                        "units"
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">{formatMarginPct(reportTotals.avgMarginPct)}</td>
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
    </div>
  );
};

export default SalesReportCard;
