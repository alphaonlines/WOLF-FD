import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManufacturerCatalogItem } from "../types";
import { fetchProductPriceMatchSummary } from "../services/productPriceMatchApi";
import ProductPriceMatchPanel from "./ProductPriceMatchPanel";

vi.mock("../services/productPriceMatchApi", () => ({
  fetchProductPriceMatchSummary: vi.fn(),
  runProductPriceMatch: vi.fn(),
}));

const item = {
  id: "4579",
  manufacturer: "Liberty",
  manufacturerSlug: "liberty",
  sku: "607-BR32",
  description: "2 Door 5 Drawer Dresser",
} as ManufacturerCatalogItem;

describe("ProductPriceMatchPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchProductPriceMatchSummary).mockReset();
  });

  it("shows Furniture Fair with the existing competitor results", async () => {
    vi.mocked(fetchProductPriceMatchSummary).mockResolvedValue({
      ok: true,
      latestAttempt: {
        id: "run-1",
        catalogItemId: item.id,
        manufacturer: item.manufacturer,
        manufacturerSlug: item.manufacturerSlug,
        sku: item.sku,
        description: item.description,
        sellingPrice: 999.99,
        status: "completed",
        result: {
          sourceRow: 0,
          vendor: item.manufacturer,
          sku: item.sku,
          description: item.description,
          storePriceText: "$999.99",
          storePrice: "$999.99",
          regularPrice: "",
          existingAhsCompPrice: "",
          existingFflCompPrice: "",
          remarks: "Shop item price match",
          bucket: "non_ashley",
          rowNotes: [],
          furnitureFair: {
            competitor: "FurnitureFairNC",
            title: "Liberty Furniture Summer House Door Dresser & Mirror",
            price: "$849.99",
            url: "https://furniture-fair.net/products/607-br32",
            confidence: "high",
            matchedTokens: ["607-BR32"],
            notes: [],
          },
          lowestReliableCompetitorPrice: "$849.99",
          storeMinusLowest: "$150.00",
          recommendation: "you are $150.00 higher than Furniture Fair",
          checkedAt: "2026-08-02T17:30:00.000Z",
        },
        error: null,
        createdAt: "2026-08-02T17:30:00.000Z",
        completedAt: "2026-08-02T17:30:01.000Z",
        checkedAt: "2026-08-02T17:30:00.000Z",
      },
      lastSuccess: null,
      history: [],
    });

    const summary = await vi.mocked(fetchProductPriceMatchSummary)(item.id);
    vi.mocked(fetchProductPriceMatchSummary).mockResolvedValue({
      ...summary,
      lastSuccess: summary.latestAttempt,
      history: summary.latestAttempt ? [summary.latestAttempt] : [],
    });

    render(<ProductPriceMatchPanel item={item} sellingPrice={999.99} isDarkMode={false} />);

    expect(await screen.findByText("Furniture Fair")).toBeInTheDocument();
    expect(screen.getByText("$849.99")).toBeInTheDocument();
  });
});
