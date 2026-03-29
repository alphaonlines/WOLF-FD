import { pctOf } from "./salesUtils";

export type ReportSummaryRow = {
  label: string;
  ticketCount: number;
  totalRetail: number;
  pro1stSales: number;
  units: number;
  avgMarginPct: number | null;
};

export type ReportRowWithPct = ReportSummaryRow & {
  retailPct: number;
  unitsPct: number;
  ownRetailPct: number;
  ownUnitsPct: number;
  totalRetailPct: number;
  totalUnitsPct: number;
};

export type ReportTotals = {
  totalRetail: number;
  totalPro1stSales: number;
  totalUnits: number;
  totalTickets: number;
  marginWeighted: number;
  avgMarginPct: number | null;
};

export const computeReportTotals = (rows: ReportSummaryRow[]): ReportTotals => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalRetail += Number.isFinite(row.totalRetail) ? row.totalRetail : 0;
      acc.totalPro1stSales += Number.isFinite(row.pro1stSales) ? row.pro1stSales : 0;
      acc.totalUnits += Number.isFinite(row.units) ? row.units : 0;
      acc.totalTickets += Number.isFinite(row.ticketCount) ? row.ticketCount : 0;
      if (row.avgMarginPct !== null && Number.isFinite(row.avgMarginPct)) {
        acc.marginWeighted += row.avgMarginPct * (Number.isFinite(row.ticketCount) ? row.ticketCount : 0);
      }
      return acc;
    },
    { totalRetail: 0, totalPro1stSales: 0, totalUnits: 0, totalTickets: 0, marginWeighted: 0 }
  );
  const avgMarginPct = totals.totalTickets > 0 ? totals.marginWeighted / totals.totalTickets : null;
  return { ...totals, avgMarginPct };
};

export const withReportPercentages = (
  rows: ReportSummaryRow[],
  filteredTotals: { totalRetail: number; totalUnits: number },
  overallMap: Map<string, ReportSummaryRow>,
  companyTotals: { totalRetail: number; totalUnits: number }
): ReportRowWithPct[] =>
  rows.map((row) => ({
    ...row,
    retailPct: pctOf(row.totalRetail, filteredTotals.totalRetail),
    unitsPct: pctOf(row.units, filteredTotals.totalUnits),
    ownRetailPct: pctOf(row.totalRetail, Number(overallMap.get(row.label)?.totalRetail || 0)),
    ownUnitsPct: pctOf(row.units, Number(overallMap.get(row.label)?.units || 0)),
    totalRetailPct: pctOf(row.totalRetail, companyTotals.totalRetail),
    totalUnitsPct: pctOf(row.units, companyTotals.totalUnits),
  }));
