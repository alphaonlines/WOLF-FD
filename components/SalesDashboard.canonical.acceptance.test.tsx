import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalesDashboard from "./SalesDashboard";

class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const mocks = vi.hoisted(() => ({
  range: vi.fn(), report: vi.fn(), legacy: vi.fn(),
}));

vi.mock("../services/posBackendApi", async (load) => {
  const actual = await load<typeof import("../services/posBackendApi")>();
  const legacyNames = ["fetchAvailableYears","fetchLeaderboard","fetchFinanceSummary","fetchLowMargin","fetchSalesByLocation","fetchSalesDaily","fetchPro1stTrend","fetchSummary","fetchBestSellers","fetchTopCategories","fetchTopManufacturers","fetchPro1stAttachRate","fetchSalespersonTickets","fetchStoreTickets","fetchDayTickets","fetchSalesReport","fetchManufacturerTopItems","fetchCategoryTopItems","fetchSalespeopleBySaleIds"];
  return { ...actual, ...Object.fromEntries(legacyNames.map((name) => [name, mocks.legacy])), fetchSalesAnalysisRange: mocks.range, fetchSalesAnalysisReport: mocks.report };
});

const canonical = (page = 1) => ({
  summary: { itemSales: 12345, ticketCount: 12, quantity: 18, cost: 7000, profit: 5345, marginPct: 43.3, costCoveragePct: 80, financeAmount: 4000, financeFee: 120, financedTicketCount: 4 },
  pro1st: { sales: 500, eligibleSales: 10000, penetrationPct: 5 },
  series: {
    salesperson: [{ label: "Smith, Jane", sales: 8000, quantity: 10, cost: 4000, profit: 4000, marginPct: 50, financeAmount: 3000, financeFee: 90, ticketCount: 8 }],
    store: [{ label: "FD7", sales: 12345, quantity: 18, cost: 7000, profit: 5345, marginPct: 43.3, financeAmount: 4000, financeFee: 120, ticketCount: 12 }],
    item: [{ label: "SOFA-1", description: "Canonical Sofa", manufacturer: "Acme", category: "Living Room", sales: 9000, quantity: 8 }],
    category: [{ label: "Living Room", sales: 9000, quantity: 8 }, { label: "Bedroom", sales: 3345, quantity: 10 }], manufacturer: [{ label: "Acme", sales: 9000, quantity: 8 }], day: [],
  },
  warnings: { openDeliveredTickets: 2, duplicateItemLines: 3, twoPersonTickets: 1 }, missingCosts: { count: 2 },
  lowMargin: [{ deliveredDate: "2026-07-09", saleId: "lowest-ticket", store: "FD7", salesperson: "Smith, Jane", grandTotal: 200, profit: 10, marginPct: 5 }],
  detail: { total: 101, page, pageSize: 100, rows: [
    { deliveredDate: "2026-07-10", saleId: `sale-${page}`, store: "FD7", salesperson: "Smith, Jane", itemNo: "SOFA-1", description: "Canonical Sofa", quantity: 1, sales: 100, ticketTotal: 125, cost: 60, profit: 40, isPro1st: true, costSource: "group_report" },
    { deliveredDate: "2026-07-11", saleId: `unknown-${page}`, store: "FD7", salesperson: "Smith, Jane", itemNo: "UNK-1", description: "Unknown Cost Item", quantity: 1, sales: 25, ticketTotal: 25, cost: null, profit: null, isPro1st: false, costSource: "unknown" },
  ] },
});

describe("SalesDashboard canonical acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear();
    mocks.range.mockResolvedValue({ deliveredDateMin: "2026-07-01", deliveredDateMax: "2026-07-31" });
    mocks.report.mockImplementation(({ page = 1 }: any) => Promise.resolve(canonical(page)));
  });

  it("renders the established cards from canonical values without legacy fanout", async () => {
    render(<SalesDashboard itemSortMetric="sales" enableTourAutoStart={false} />);
    expect(await screen.findByText("Sales Overview")).toBeInTheDocument();
    expect(screen.getAllByText(/July 2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$12,345").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Smith, Jane").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Canonical Sofa").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Lowest Margins" }));
    expect(await screen.findByText("5.0%")).toBeInTheDocument();
    expect(screen.getByText("Finance Overview")).toBeInTheDocument();
    expect(screen.getByText("Best Sellers")).toBeInTheDocument();
    expect(screen.getByText("Sales Trend")).toBeInTheDocument();
    expect(screen.queryByText("Written")).not.toBeInTheDocument();
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.report.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("renders canonical diagnostics, unavailable cost, and replaces detail rows on the next server page", async () => {
    render(<SalesDashboard itemSortMetric="sales" enableTourAutoStart={false} />);

    expect(await screen.findByText("Canonical diagnostics & detail")).toBeInTheDocument();
    expect(screen.getByText("Open delivered tickets: 2")).toBeInTheDocument();
    expect(screen.getByText("Duplicate item lines: 3")).toBeInTheDocument();
    expect(screen.getByText("Two-person tickets: 1")).toBeInTheDocument();
    expect(screen.getByText("Missing costs: 2")).toBeInTheDocument();
    expect(screen.getByText("sale-1")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next detail page" }));
    await waitFor(() => expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 100 })));
    expect(await screen.findByText("sale-2")).toBeInTheDocument();
    expect(screen.queryByText("sale-1")).not.toBeInTheDocument();
    expect(screen.getAllByText("$12,345").length).toBeGreaterThan(0);
    expect(mocks.legacy).not.toHaveBeenCalled();
  });

  it("preserves saved card order, collapse, date controls, and print dialog interaction", async () => {
    localStorage.setItem("fd-sales-analysis-card-order", JSON.stringify(["sales-overview", "range-selector", "finance-overview"]));
    const { container } = render(<SalesDashboard itemSortMetric="sales" enableTourAutoStart={false} />);
    await screen.findByText("Sales Overview");
    const cards = Array.from(container.querySelectorAll("[data-print-id]")).map((node) => node.getAttribute("data-print-id"));
    expect(cards.indexOf("sales-overview")).toBeLessThan(cards.indexOf("range-selector"));
    expect(screen.getByRole("button", { name: "Compare" })).toBeInTheDocument();
    const expandCount = screen.getAllByRole("button", { name: "Expand" }).length;
    fireEvent.click(screen.getAllByRole("button", { name: "Minimize" })[0]);
    expect(screen.getAllByRole("button", { name: "Expand" })).toHaveLength(expandCount + 1);
    window.dispatchEvent(new Event("fd-print-request"));
    expect(await screen.findByText("Print Options")).toBeInTheDocument();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });

  it("generates print data from canonical reports without legacy calls", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<SalesDashboard itemSortMetric="sales" enableTourAutoStart={false} />);
    await screen.findByText("Sales Overview");
    window.dispatchEvent(new Event("fd-print-request"));
    fireEvent.click(await screen.findByRole("button", { name: "Print" }));
    await waitFor(() => expect(screen.queryByText("Preparing...")).not.toBeInTheDocument());
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.report).toHaveBeenCalled();
  });

  it("renders each manufacturer filter option exactly once", async () => {
    render(<SalesDashboard itemSortMetric="sales" enableTourAutoStart={false} />);
    await screen.findByText("Sales Overview");
    expect(screen.getAllByRole("option", { name: "All Manufacturers" })).toHaveLength(1);
    expect(screen.getAllByRole("option", { name: "Acme" })).toHaveLength(1);
  });

  it("keeps Sales Analysis delivered-only and populates canonical salesperson drilldown", async () => {
    render(<SalesDashboard itemSortMetric="sales" enableTourAutoStart={false} />);
    await screen.findByText("Canonical Sofa");
    window.dispatchEvent(new CustomEvent("fd-set-sales-basis", { detail: { basis: "written" } }));
    expect(screen.queryByText("Written")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Smith, Jane")[0]);
    expect(await screen.findByText("Salesperson Detail: Smith, Jane")).toBeInTheDocument();
    expect(screen.queryByText("No tickets found for this salesperson and range.")).not.toBeInTheDocument();
    expect(mocks.legacy).not.toHaveBeenCalled();
  });

  it("applies multiple categories to both screen and print canonical requests", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<SalesDashboard itemSortMetric="sales" enableTourAutoStart={false} />);
    await screen.findByText("Sales Overview");
    fireEvent.click(screen.getAllByText("All Categories")[0]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Living Room" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bedroom" }));
    await waitFor(() => expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ category: ["Living Room", "Bedroom"] })));
    mocks.report.mockClear();
    window.dispatchEvent(new Event("fd-print-request"));
    fireEvent.click(await screen.findByRole("button", { name: "Print" }));
    await waitFor(() => expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ category: ["Living Room", "Bedroom"] })));
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
});
