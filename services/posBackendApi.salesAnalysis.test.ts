import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSalesAnalysisRange, fetchSalesAnalysisReport } from "./posBackendApi";

describe("canonical Sales Analysis client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses inclusive UI end as exclusive API end and maps range bounds", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ deliveredDateMin: "2026-07-01", deliveredDateMax: "2026-07-31" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: {}, series: {}, detail: { rows: [] } }), { status: 200 }));
    await expect(fetchSalesAnalysisRange()).resolves.toEqual({ deliveredDateMin: "2026-07-01", deliveredDateMax: "2026-07-31" });
    await fetchSalesAnalysisReport({ start: "2026-07-01", endInclusive: "2026-07-31", page: 2, pageSize: 100 });
    expect(fetchMock.mock.calls[0][0]).toBe("/fd/api/api/sales-analysis/range");
    expect(String(fetchMock.mock.calls[1][0])).toContain("end_exclusive=2026-08-01");
    expect(String(fetchMock.mock.calls[1][0])).toContain("page=2&page_size=100");
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("date_basis");
  });

  it("sends every selected category as a repeated canonical filter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ summary: {}, series: {}, detail: { rows: [] } }), { status: 200 }));
    await fetchSalesAnalysisReport({ start: "2026-07-01", endInclusive: "2026-07-31", category: ["Living", "Bedroom"] });
    const url = new URL(String(fetchMock.mock.calls[0][0]), "https://example.test");
    expect(url.searchParams.getAll("category")).toEqual(["Living", "Bedroom"]);
  });
});
