import React from "react";
import {
  computeReportTotals,
  type ReportSummaryRow,
  withReportPercentages,
} from "../salesReportUtils";

type BreakdownEntry = {
  label: string;
  storeRows: ReportSummaryRow[];
  salespersonRows: ReportSummaryRow[];
};

type SalesDrilldownPrintSectionsProps = {
  printIncludeManufacturer: boolean;
  printIncludeCategory: boolean;
  printData: {
    manufacturerBreakdowns?: BreakdownEntry[];
    categoryBreakdowns?: BreakdownEntry[];
  } | null;
  printStoreOverallMap: Map<string, ReportSummaryRow>;
  printSalesOverallMap: Map<string, ReportSummaryRow>;
  printOverallTotals: { totalRetail: number; totalUnits: number };
};

const filterPctRows = (
  rows: ReturnType<typeof withReportPercentages>
) =>
  rows.filter((row) => {
    const retail = Number(row.totalRetail || 0);
    const units = Number(row.units || 0);
    const tickets = Number(row.ticketCount || 0);
    const retailPct = Number(row.retailPct || 0);
    const unitsPct = Number(row.unitsPct || 0);
    return !(retail === 0 && units === 0 && tickets === 0) && !(retailPct === 0 && unitsPct === 0);
  });

const PctTable: React.FC<{ label: "Store" | "Salesperson"; rows: ReturnType<typeof withReportPercentages> }> = ({
  label,
  rows,
}) => {
  if (!rows.length) return <div className="text-sm text-slate-500">No {label.toLowerCase()} data.</div>;

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
    return `${((pro1stSales / totalRetail) * 100).toFixed(1)}%`;
  };

  return (
    <div className="overflow-x-visible">
      <table className="min-w-full divide-y divide-slate-200 text-[11px] fd-print-detailed-table">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">{label}</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Retail</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Tickets</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Avg Ticket</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Pro1st %</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Sales % View</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Sales % Own</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Sales % Co</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Units</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Units % View</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Units % Own</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Units % Co</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">Margin</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={`${label}-${row.label}`}>
              <td className="px-3 py-2 text-slate-700">{row.label || "—"}</td>
              <td className="px-3 py-2 text-right text-slate-700">${Number(row.totalRetail || 0).toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-slate-600">{Number(row.ticketCount || 0).toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-slate-600">
                {formatAverageTicket(Number(row.totalRetail || 0), Number(row.ticketCount || 0))}
              </td>
              <td className="px-3 py-2 text-right text-slate-600">
                {formatPro1stPct(Number(row.pro1stSales || 0), Number(row.totalRetail || 0))}
              </td>
              <td className="px-3 py-2 text-right text-slate-600">{row.retailPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right text-slate-600">{row.ownRetailPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right text-slate-600">{row.totalRetailPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right text-slate-600">{Number(row.units || 0).toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-slate-600">{row.unitsPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right text-slate-600">{row.ownUnitsPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right text-slate-600">{row.totalUnitsPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right text-slate-600">
                {row.avgMarginPct === null || !Number.isFinite(row.avgMarginPct) ? "—" : `${row.avgMarginPct.toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DrilldownSection: React.FC<{
  title: string;
  entries: BreakdownEntry[];
  prefix: string;
  printStoreOverallMap: Map<string, ReportSummaryRow>;
  printSalesOverallMap: Map<string, ReportSummaryRow>;
  printOverallTotals: { totalRetail: number; totalUnits: number };
}> = ({ title, entries, prefix, printStoreOverallMap, printSalesOverallMap, printOverallTotals }) => {
  if (!entries.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {entries.map((entry) => {
        const storeTotals = computeReportTotals(entry.storeRows);
        const salesTotals = computeReportTotals(entry.salespersonRows);

        const storeRows = filterPctRows(
          withReportPercentages(entry.storeRows, storeTotals, printStoreOverallMap, printOverallTotals)
        );
        const salesRows = filterPctRows(
          withReportPercentages(entry.salespersonRows, salesTotals, printSalesOverallMap, printOverallTotals)
        );

        return (
          <div key={`${prefix}-${entry.label}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 fd-print-block">
            <h4 className="text-base font-semibold text-slate-800 mb-3">{prefix === "m" ? "Manufacturer" : "Category"}: {entry.label}</h4>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Store %</div>
                <PctTable label="Store" rows={storeRows} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Salesperson %</div>
                <PctTable label="Salesperson" rows={salesRows} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SalesDrilldownPrintSections: React.FC<SalesDrilldownPrintSectionsProps> = ({
  printIncludeManufacturer,
  printIncludeCategory,
  printData,
  printStoreOverallMap,
  printSalesOverallMap,
  printOverallTotals,
}) => {
  return (
    <>
      {printIncludeManufacturer && printData?.manufacturerBreakdowns?.length ? (
        <DrilldownSection
          title="Manufacturer Drill-downs"
          entries={printData.manufacturerBreakdowns}
          prefix="m"
          printStoreOverallMap={printStoreOverallMap}
          printSalesOverallMap={printSalesOverallMap}
          printOverallTotals={printOverallTotals}
        />
      ) : null}

      {printIncludeCategory && printData?.categoryBreakdowns?.length ? (
        <DrilldownSection
          title="Category Drill-downs"
          entries={printData.categoryBreakdowns}
          prefix="c"
          printStoreOverallMap={printStoreOverallMap}
          printSalesOverallMap={printSalesOverallMap}
          printOverallTotals={printOverallTotals}
        />
      ) : null}
    </>
  );
};

export default SalesDrilldownPrintSections;
