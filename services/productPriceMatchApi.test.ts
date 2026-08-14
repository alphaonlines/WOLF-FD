import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProductPriceMatchSummary, runProductPriceMatch } from "./productPriceMatchApi";

const jsonResponse = (body: unknown) => ({
  ok: true,
  json: () => Promise.resolve(body),
}) as Response;

describe("product Price Match API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads saved runs through the deployed FD POS API prefix", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, latestAttempt: null, lastSuccess: null, history: [] }));

    await fetchProductPriceMatchSummary("11561");

    expect(fetchMock).toHaveBeenCalledWith(
      "/fd/api/api/manufacturer-pricebooks/catalog/11561/price-match-runs?limit=50",
      { credentials: "include" },
    );
  });

  it("starts a run through the deployed FD POS API prefix", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ run: { id: "run-1", status: "queued" } }));

    await runProductPriceMatch("11561", 1299.99);

    expect(fetchMock).toHaveBeenCalledWith(
      "/fd/api/api/manufacturer-pricebooks/catalog/11561/price-match-runs",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ sellingPrice: 1299.99 }),
      }),
    );
  });
});
