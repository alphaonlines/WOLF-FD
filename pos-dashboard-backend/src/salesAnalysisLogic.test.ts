import { describe, expect, it } from "vitest";
import { aggregateSalesAnalysis, splitSalespeople, type SalesAnalysisItem, type SalesAnalysisTicket } from "./salesAnalysisLogic";

const ticket = (overrides: Partial<SalesAnalysisTicket> = {}): SalesAnalysisTicket => ({
  saleId: "100",
  deliveredDate: "2026-07-10",
  status: "Delivered",
  store: "FD7",
  salesperson: "Smith, Jane",
  grandTotal: 2205,
  financeAmount: 1000,
  financeFee: 35,
  ...overrides,
});

const item = (overrides: Partial<SalesAnalysisItem> = {}): SalesAnalysisItem => ({
  rowId: "row-1",
  saleId: "100",
  deliveredDate: "2026-07-10",
  store: "FD7",
  manufacturer: "Acme",
  category: "Living Room",
  itemNo: "0007",
  description: "Sofa",
  quantity: 1,
  sales: 1000,
  totalCost: 600,
  totalProfit: 400,
  ...overrides,
});

describe("corrected delivered Sales Analysis aggregation", () => {
  it("splits only exactly two whitespace-delimited case-insensitive and names", () => {
    expect(splitSalespeople("Smith, Jane   AnD\tDoe, John")).toEqual(["Smith, Jane", "Doe, John"]);
    expect(splitSalespeople("A and B and C")).toEqual(["A and B and C"]);
    expect(splitSalespeople("A&B")).toEqual(["A&B"]);
    expect(splitSalespeople("Candy Store")).toEqual(["Candy Store"]);
  });

  it("keeps missing cost unknown and weights margin by known-cost sales", () => {
    const result = aggregateSalesAnalysis(
      [ticket()],
      [item(), item({ rowId: "row-2", itemNo: "0008", sales: 500, totalCost: null, totalProfit: null })],
      { start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100 }
    );
    expect(result.summary).toMatchObject({
      itemSales: 1500,
      knownCostSales: 1000,
      cost: 600,
      profit: 400,
      marginPct: 40,
    });
    expect(result.summary.costCoveragePct).toBeCloseTo(1000 / 15, 3);
    expect(result.missingCosts.count).toBe(1);
    expect(result.detail.rows[1].cost).toBeNull();
    expect(result.detail.rows[1].profit).toBeNull();
    expect(result.detail.rows[1].costSource).toBe("unknown");
  });

  it("keeps finance amount and fee separate from item profit", () => {
    const result = aggregateSalesAnalysis([ticket()], [item()], {
      start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100,
    });
    expect(result.summary.profit).toBe(400);
    expect(result.summary.financeAmount).toBe(1000);
    expect(result.summary.financeFee).toBe(35);
  });

  it("splits sales quantity cost profit finance and ticket credit 50/50 for a two-person ticket", () => {
    const tickets = [ticket({ salesperson: "Smith, Jane and Doe, John" })];
    const items = [item({ quantity: 3, sales: 1001, totalCost: 601, totalProfit: 400 })];
    const all = aggregateSalesAnalysis(tickets, items, {
      start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100,
    });
    expect(all.series.salesperson).toEqual([
      expect.objectContaining({ label: "Doe, John", sales: 500.5, quantity: 1.5, cost: 300.5, profit: 200, financeAmount: 500, financeFee: 17.5, ticketCount: 0.5 }),
      expect.objectContaining({ label: "Smith, Jane", sales: 500.5, quantity: 1.5, cost: 300.5, profit: 200, financeAmount: 500, financeFee: 17.5, ticketCount: 0.5 }),
    ]);
    const jane = aggregateSalesAnalysis(tickets, items, {
      start: "2026-07-01", endExclusive: "2026-08-01", salesperson: "smith, jane", page: 1, pageSize: 100,
    });
    expect(jane.summary).toMatchObject({ itemSales: 500.5, quantity: 1.5, cost: 300.5, profit: 200, financeAmount: 500, financeFee: 17.5, ticketCount: 0.5 });
  });

  it("allocates mixed solo and exact-two rows to a filtered salesperson in exact cents without a hardcoded half", () => {
    const tickets = [
      ticket({ saleId: "solo", salesperson: "Smith, Jane", grandTotal: 10.01, financeAmount: 0.03, financeFee: 0.01 }),
      ticket({ saleId: "mixed", salesperson: "Smith, Jane and Doe, John", grandTotal: 10.01, financeAmount: 0.03, financeFee: 0.01 }),
    ];
    const items = [
      item({ rowId: "solo-row", saleId: "solo", sales: 10.01, totalCost: 6.01, totalProfit: 4 }),
      item({ rowId: "mixed-row", saleId: "mixed", sales: 10.01, totalCost: 6.01, totalProfit: 4 }),
    ];
    const jane = aggregateSalesAnalysis(tickets, items, {
      start: "2026-07-01", endExclusive: "2026-08-01", salesperson: "Smith, Jane", page: 1, pageSize: 100,
    });
    expect(jane.summary).toMatchObject({ itemSales: 15.02, cost: 9.02, profit: 6, financeAmount: 0.05, financeFee: 0.02, ticketTotal: 15.02 });
    expect(jane.detail.rows.map((row: any) => row.sales)).toEqual([10.01, 5.01]);
  });

  it("conserves odd cents and applies the selected salesperson share to every item dimension", () => {
    const tickets = [ticket({ salesperson: "Alpha and Beta" })];
    const items = [item({ quantity: 1.0001, sales: 10.01, totalCost: 6.01, totalProfit: 4 })];
    const alpha = aggregateSalesAnalysis(tickets, items, { start: "2026-07-01", endExclusive: "2026-08-01", salesperson: "Alpha", page: 1, pageSize: 100 });
    const beta = aggregateSalesAnalysis(tickets, items, { start: "2026-07-01", endExclusive: "2026-08-01", salesperson: "Beta", page: 1, pageSize: 100 });
    for (const dimension of ["item", "category", "manufacturer", "store", "day"] as const) {
      expect(alpha.series[dimension][0]).toMatchObject({ sales: 5.01, quantity: 0.5001, cost: 3.01, profit: 2 });
      expect(beta.series[dimension][0]).toMatchObject({ sales: 5, quantity: 0.5, cost: 3, profit: 2 });
      expect(alpha.series[dimension][0].sales + beta.series[dimension][0].sales).toBe(10.01);
      expect(alpha.series[dimension][0].cost + beta.series[dimension][0].cost).toBe(6.01);
    }
  });

  it("joins ticket identity by store plus sale id and rejects ambiguous or cross-store matches", () => {
    const tickets = [ticket({ saleId: "100", store: "FD7" }), ticket({ saleId: "100", store: "FD8", salesperson: "Other, Rep" })];
    const fd7 = aggregateSalesAnalysis(tickets, [item({ store: "FD7" })], {
      start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100,
    });
    expect(fd7.summary.ticketCount).toBe(1);
    expect(fd7.detail.rows[0].store).toBe("FD7");
    expect(() => aggregateSalesAnalysis([ticket(), ticket()], [item()], {
      start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100,
    })).toThrow("ambiguous_sale_identity");
    expect(aggregateSalesAnalysis([ticket({ store: "FD8" })], [item({ store: "FD7" })], {
      start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100,
    }).summary.itemCount).toBe(0);
  });

  it("calculates Pro1st dollars over eligible furniture and excludes bedding and bases", () => {
    const result = aggregateSalesAnalysis(
      [ticket()],
      [
        item({ rowId: "pro", description: "Pro 1st plan", sales: 200 }),
        item({ rowId: "sofa", itemNo: "sofa", sales: 800 }),
        item({ rowId: "mattress", itemNo: "mattress", category: "Bedding", description: "Pro1st Mattress", sales: 500 }),
        item({ rowId: "base", itemNo: "base", description: "Adjustable Base", sales: 400 }),
      ],
      { start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100 }
    );
    expect(result.pro1st).toEqual({ sales: 200, eligibleSales: 1000, penetrationPct: 20 });
  });

  it("matches Pro1st positively only as pro1st or pro 1st, then applies exclusions", () => {
    const result = aggregateSalesAnalysis([ticket()], [
      item({ rowId: "a", description: "PRO1ST plan", sales: 100 }),
      item({ rowId: "b", description: "pro 1st plan", sales: 100 }),
      item({ rowId: "c", description: "pro-1st plan", sales: 100 }),
      item({ rowId: "d", description: "Protection First plan", sales: 100 }),
      item({ rowId: "e", category: "Bedding", description: "pro1st mattress", sales: 100 }),
      item({ rowId: "f", description: "Sofa", sales: 500 }),
    ], { start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100 });
    expect(result.pro1st.sales).toBe(200);
  });

  it("is recursively free of forbidden PII keys and values", () => {
    const result = aggregateSalesAnalysis([ticket()], [item()], {
      start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100,
    });
    const forbidden = new Set(["customername", "customer_name", "phone", "email", "address", "receipt_no", "note"]);
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        expect(forbidden.has(key.toLowerCase())).toBe(false);
        visit(child);
      }
    };
    visit(result);
  });

  it("includes fully delivered Open tickets, preserves duplicate items, warns, and pages PII-free detail", () => {
    const result = aggregateSalesAnalysis(
      [ticket({ status: "Open" })],
      [item(), item({ rowId: "row-2" })],
      { start: "2026-07-01", endExclusive: "2026-08-01", page: 2, pageSize: 1 }
    );
    expect(result.summary.ticketCount).toBe(1);
    expect(result.summary.itemCount).toBe(2);
    expect(result.warnings).toMatchObject({ openDeliveredTickets: 1, duplicateItemLines: 2 });
    expect(result.detail).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(result.detail.rows[0]).not.toHaveProperty("customerName");
    expect(result.detail.rows[0]).not.toHaveProperty("phone");
    expect(result.detail.rows[0]).not.toHaveProperty("email");
  });

  it("accepts the production-shaped July cardinalities", () => {
    const tickets: SalesAnalysisTicket[] = Array.from({ length: 252 }, (_, index) =>
      ticket({
        saleId: String(1000 + index),
        deliveredDate: `2026-07-${String((index % 31) + 1).padStart(2, "0")}`,
        status: index === 0 ? "Open" : "Delivered",
        salesperson: index < 29 ? "Smith, Jane and Doe, John" : "Solo, Sam",
      })
    );
    const items: SalesAnalysisItem[] = Array.from({ length: 680 }, (_, index) =>
      item({
        rowId: `july-${index}`,
        saleId: tickets[index % tickets.length].saleId,
        deliveredDate: tickets[index % tickets.length].deliveredDate,
        quantity: index < 125 ? 2 : 1,
        totalCost: index < 8 ? null : 60,
        totalProfit: index < 8 ? null : 40,
      })
    );
    const result = aggregateSalesAnalysis(tickets, items, {
      start: "2026-07-01", endExclusive: "2026-08-01", page: 1, pageSize: 100,
    });
    expect(result.summary).toMatchObject({ ticketCount: 252, itemCount: 680, quantity: 805 });
    expect(result.missingCosts.count).toBe(8);
    expect(result.warnings).toMatchObject({ twoPersonTickets: 29, openDeliveredTickets: 1 });
    expect(result.detail).toMatchObject({ total: 680, page: 1, pageSize: 100 });
  });
});
