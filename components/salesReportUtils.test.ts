import { describe, it, expect } from 'vitest';
import { computeReportTotals, ReportSummaryRow } from './salesReportUtils';

describe('salesReportUtils', () => {
  describe('computeReportTotals', () => {
    it('should correctly sum totals from rows', () => {
      const rows: ReportSummaryRow[] = [
        { label: 'Rep 1', ticketCount: 10, totalRetail: 1000, pro1stSales: 500, units: 20, avgMarginPct: 40 },
        { label: 'Rep 2', ticketCount: 5, totalRetail: 500, pro1stSales: 250, units: 10, avgMarginPct: 30 },
      ];
      const result = computeReportTotals(rows);
      expect(result.totalRetail).toBe(1500);
      expect(result.totalPro1stSales).toBe(750);
      expect(result.totalUnits).toBe(30);
      expect(result.totalTickets).toBe(15);
      // marginWeighted = (40 * 10) + (30 * 5) = 400 + 150 = 550
      // avgMarginPct = 550 / 15 = 36.666...
      expect(result.avgMarginPct).toBeCloseTo(36.666, 2);
    });

    it('should use distinctTicketCount if provided', () => {
      const rows: ReportSummaryRow[] = [
        { label: 'Rep 1', ticketCount: 10, totalRetail: 1000, pro1stSales: 500, units: 20, avgMarginPct: 40 },
      ];
      const result = computeReportTotals(rows, 8);
      expect(result.totalTickets).toBe(8);
    });

    it('should return null avgMarginPct if no tickets', () => {
      const result = computeReportTotals([]);
      expect(result.avgMarginPct).toBeNull();
    });
  });
});
