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
};

const SalesReportCard: React.FC<SalesReportCardProps> = ({
  collapsed,
  renderHelp,
  cardToggle,
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

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 fd-print-card" data-print-id="sales-report">
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
                      Pro1st
                      {renderHelp("Pro1st sales dollars for this row, excluding mattress and box spring lines.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Sales % of View
                      {renderHelp(
                        "Percent of this row's retail against the visible rows after category/manufacturer filters. These values add up to 100%."
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Sales % of Own Total
                      {renderHelp(
                        "Percent of this row's retail against that salesperson/store's own total retail for the selected date range."
                      )}
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
                      Average Ticket
                      {renderHelp("Average retail per ticket for this row.")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Units % of View
                      {renderHelp(
                        "Percent of this row's units against the visible rows after category/manufacturer filters. These values add up to 100%."
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Units % of Own Total
                      {renderHelp(
                        "Percent of this row's units against that salesperson/store's own total units for the selected date range."
                      )}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{row.label || "(unknown)"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${Number(row.totalRetail || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${Number(row.pro1stSales || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.retailPct.toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.ownRetailPct.toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.totalRetailPct.toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {Number(row.units || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatAverageTicket(Number(row.totalRetail || 0), Number(row.ticketCount || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.unitsPct.toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.ownUnitsPct.toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.totalUnitsPct.toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatMarginPct(row.avgMarginPct)}</td>
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
                      ${Number(reportTotals.totalPro1stSales || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-700">
                      {reportTotals.totalRetail > 0 ? "100.0" : "0.0"}%
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-slate-700">--</td>
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
                      {formatAverageTicket(Number(reportTotals.totalRetail || 0), Number(reportTotals.totalTickets || 0))}
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
                    <td className="px-6 py-3 text-sm font-semibold text-slate-700">{formatMarginPct(reportTotals.avgMarginPct)}</td>
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
