import React from "react";
import type { ReportRowWithPct, ReportTotals } from "../salesReportUtils";

type LowMarginRow = {
  saleId: string;
  saleDate: string;
  salesperson: string;
  grandTotal: number;
  marginPct: number | null;
};

type SalesCorePrintSectionsProps = {
  printIncludeLowMargin: boolean;
  printIncludeStore: boolean;
  printIncludeSalesperson: boolean;
  printLowMarginFiltered: LowMarginRow[];
  printStoreFiltered: ReportRowWithPct[];
  printSalespersonFiltered: ReportRowWithPct[];
  printTotalsStore: ReportTotals;
  printTotalsSalesperson: ReportTotals;
  printOverallRetailTotal: number;
  printOverallUnitsTotal: number;
  saleLabel: (saleId: string, salesperson?: string) => string;
  formatShortDate: (value: string) => string;
  formatMarginPct: (value: number | null) => string;
};

const SalesCorePrintSections: React.FC<SalesCorePrintSectionsProps> = ({
  printIncludeLowMargin,
  printIncludeStore,
  printIncludeSalesperson,
  printLowMarginFiltered,
  printStoreFiltered,
  printSalespersonFiltered,
  printTotalsStore,
  printTotalsSalesperson,
  printOverallRetailTotal,
  printOverallUnitsTotal,
  saleLabel,
  formatShortDate,
  formatMarginPct,
}) => {
  return (
    <>
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
    </>
  );
};

export default SalesCorePrintSections;
