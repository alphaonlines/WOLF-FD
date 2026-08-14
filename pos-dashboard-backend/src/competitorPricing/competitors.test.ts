import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompetitorPricingInputRow } from "./types";
import { scrapeWithFirecrawl } from "./firecrawlClient";
import { searchSearx } from "./searxClient";
import { __testing, lookupAshley, lookupFurniture4Less, lookupFurnitureFair } from "./competitors";

vi.mock("./firecrawlClient", () => ({
  scrapeWithFirecrawl: vi.fn(),
}));

vi.mock("./searxClient", () => ({
  searchSearx: vi.fn(),
}));

const row: CompetitorPricingInputRow = {
  sourceRow: 12,
  vendor: "Ashley",
  sku: "B070-71/96",
  description: "Trentlore Sofa",
  storePriceText: "$599",
  storePrice: "$599",
  regularPrice: "$799",
  existingAhsCompPrice: "",
  existingFflCompPrice: "",
  remarks: "",
  bucket: "ashley",
  rowNotes: [],
};

describe("competitor lookups", () => {
  beforeEach(() => {
    vi.mocked(scrapeWithFirecrawl).mockReset();
    vi.mocked(searchSearx).mockReset();
    vi.stubGlobal("fetch", vi.fn());
    __testing.resetFurnitureFairCatalogCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fall back to a component-only price for a selected set", async () => {
    vi.mocked(scrapeWithFirecrawl)
      .mockResolvedValueOnce({ success: true, title: "Search", markdown: "0 results for B070-71/96 Trentlore Sofa" });

    const match = await lookupFurniture4Less(row);
    const requestedUrls = vi.mocked(scrapeWithFirecrawl).mock.calls.map(([url]) => new URL(url));

    expect(requestedUrls[0].origin).toBe("https://furniture4lessnc.com");
    expect(requestedUrls[0].pathname).toBe("/search");
    expect(requestedUrls.map((url) => url.searchParams.get("q"))).toEqual(["B070-71/96 Trentlore Sofa"]);
    expect(match.confidence).toBe("none");
    expect(match.price).toBe("");
  });

  it("treats Furniture4LessNC 0-results markdown as no match", async () => {
    vi.mocked(scrapeWithFirecrawl).mockResolvedValue({
      success: true,
      title: "Search",
      markdown: "0 results for B070-71 Trentlore Sofa",
    });

    const match = await lookupFurniture4Less(row);

    expect(match.confidence).toBe("none");
    expect(match.notes.join(" ")).toMatch(/0 results/i);
  });

  it("uses SearXNG before scraping Ashley URLs", async () => {
    vi.mocked(searchSearx).mockResolvedValue([
      {
        title: "Trentlore Set B070-71/96 | Ashley",
        url: "https://www.ashleyfurniture.com/p/trentlore_set/B070-71-96.html",
        content: "Ashley result",
      },
      {
        title: "Non-Ashley mirror",
        url: "https://example.com/trentlore",
        content: "ignore",
      },
    ]);
    vi.mocked(scrapeWithFirecrawl).mockResolvedValue({
      success: true,
      title: "Trentlore Set B070-71/96",
      markdown: "# Trentlore Set B070-71/96\nPrice $429.99",
    });

    const match = await lookupAshley(row);

    expect(vi.mocked(searchSearx).mock.calls[0][0]).toBe("site:ashleyfurniture.com B070-71/96 Trentlore Sofa");
    expect(vi.mocked(scrapeWithFirecrawl).mock.calls).toHaveLength(1);
    expect(vi.mocked(scrapeWithFirecrawl).mock.calls[0][0]).toBe(
      "https://www.ashleyfurniture.com/p/trentlore_set/B070-71-96.html"
    );
    expect(match.confidence).toBe("high");
    expect(match.price).toBe("$429.99");
  });

  it("does not use Ashley direct search URLs", async () => {
    vi.mocked(searchSearx).mockResolvedValue([
      {
        title: "Trentlore Sofa B070-71 | Ashley",
        url: "https://www.ashleyfurniture.com/p/trentlore_sofa/B070-71.html",
        content: "Ashley result",
      },
    ]);
    vi.mocked(scrapeWithFirecrawl).mockResolvedValue({
      success: true,
      title: "Trentlore Sofa B070-71",
      markdown: "# Trentlore Sofa B070-71\nPrice $429.99",
    });

    await lookupAshley(row);

    expect(vi.mocked(searchSearx).mock.calls[0][0]).toContain("site:ashleyfurniture.com");
    for (const [url] of vi.mocked(scrapeWithFirecrawl).mock.calls) {
      expect(url).not.toMatch(/ashleyfurniture\.com\/search/i);
    }
  });

  it("matches an Eastern NC Furniture Fair product by manufacturer and normalized model SKU", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [{
            title: "Liberty Furniture Summer House Oyster White Door Dresser & Mirror",
            handle: "607-br32",
            vendor: "Liberty Furniture",
            body_html: "Summer House collection",
            variants: [{ price: "849.99", compare_at_price: "999.99", available: true }],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) } as Response);

    const match = await lookupFurnitureFair({
      ...row,
      vendor: "Liberty",
      sku: "607-BR32",
      description: "2 Door 5 Drawer Dresser",
      bucket: "non_ashley",
    });

    expect(fetchMock.mock.calls[0][0].toString()).toContain("https://furniture-fair.net/products.json?limit=250&page=1");
    expect(match).toMatchObject({
      competitor: "FurnitureFairNC",
      confidence: "high",
      price: "$849.99",
      url: "https://furniture-fair.net/products/607-br32",
    });
    expect(match.matchedTokens).toContain("607-BR32");
  });

  it("rejects Furniture Fair SKU text under the wrong manufacturer", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [{
            title: "Crown Mark 607 BR32 Lookalike",
            handle: "crown-mark-607-br32-lookalike",
            vendor: "Crown Mark",
            body_html: "Unrelated product",
            variants: [{ price: "1.00", available: true }],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) } as Response);

    const match = await lookupFurnitureFair({
      ...row,
      vendor: "Liberty",
      sku: "607-BR32",
      description: "2 Door 5 Drawer Dresser",
      bucket: "non_ashley",
    });

    expect(match.confidence).toBe("none");
    expect(match.price).toBe("");
  });

  it("rejects a Furniture Fair model-prefix collision", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [{
            title: "Lifestyle C9608D Weathered Gray Dining Chair",
            handle: "lifestyle-c9608d-weathered-gray-dining-chair",
            vendor: "Lifestyle",
            body_html: "C9608 collection dining chair",
            variants: [{ price: "179.99", available: true }],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) } as Response);

    const match = await lookupFurnitureFair({
      ...row,
      vendor: "Lifestyle",
      sku: "C9608",
      description: "Dining table",
      bucket: "non_ashley",
    });

    expect(match.confidence).toBe("none");
    expect(match.price).toBe("");
  });

  it("accepts an exact Furniture Fair internal variant SKU", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [{
            title: "Lifestyle C9608 Weathered Gray Triangular Dining Set",
            handle: "lifestyle-c9608-weathered-gray-triangular-dining-set",
            vendor: "Lifestyle",
            body_html: "Four-piece dining set",
            variants: [{ sku: "400122061", price: "934.99", available: true }],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) } as Response);

    const match = await lookupFurnitureFair({
      ...row,
      vendor: "Lifestyle",
      sku: "400122061",
      description: "Four Piece Dining Set",
      bucket: "non_ashley",
    });

    expect(match).toMatchObject({
      confidence: "high",
      price: "$934.99",
      url: "https://furniture-fair.net/products/lifestyle-c9608-weathered-gray-triangular-dining-set",
    });
  });

  it("prices the exact Furniture Fair variant instead of a different lower-priced variant", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [{
            title: "Jackson Furniture Catnapper Recliner",
            handle: "jackson-furniture-catnapper-recliner",
            vendor: "Jackson Furniture",
            body_html: "",
            variants: [
              { sku: "CAT-1000", price: "899.99", available: true },
              { sku: "CAT-100", price: "1199.99", available: true },
            ],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) } as Response);

    const match = await lookupFurnitureFair({
      ...row,
      vendor: "Jackson Furniture",
      sku: "CAT-100",
      description: "Catnapper Recliner",
      bucket: "non_ashley",
    });

    expect(match).toMatchObject({
      confidence: "high",
      price: "$1,199.99",
      matchedTokens: ["CAT-100"],
    });
  });

  it("ignores a model mentioned only in another Furniture Fair product description", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            {
              title: "Liberty Furniture 607 Summer House Oyster White Door Nightstand",
              handle: "607-br61",
              vendor: "Liberty Furniture",
              body_html: "Pairs with the 607-BR32 dresser in the same collection",
              variants: [{ price: "519.99", available: true }],
            },
            {
              title: "Liberty Furniture 607-BR32 Dresser",
              handle: "607-br32",
              vendor: "Liberty Furniture",
              body_html: "2 Door 5 Drawer Dresser",
              variants: [{ price: "849.99", available: false }],
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) } as Response);

    const match = await lookupFurnitureFair({
      ...row,
      vendor: "Liberty",
      sku: "607-BR32",
      description: "2 Door 5 Drawer Dresser",
      bucket: "non_ashley",
    });

    expect(match).toMatchObject({
      confidence: "low",
      price: "$849.99",
      url: "https://furniture-fair.net/products/607-br32",
    });
  });

  it("does not treat an out-of-stock Furniture Fair price as reliable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [{
            title: "Liberty Furniture Gray Wood TV Console with Storage",
            handle: "liberty-furniture-581tv62-tv-console",
            vendor: "Liberty Furniture",
            body_html: "Liberty 581-TV62 TV console",
            variants: [{ price: "339.99", compare_at_price: "399.99", available: false }],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [] }) } as Response);

    const match = await lookupFurnitureFair({
      ...row,
      vendor: "Liberty",
      sku: "581-TV62",
      description: "62 Inch TV Console",
      bucket: "non_ashley",
    });

    expect(match.confidence).toBe("low");
    expect(match.price).toBe("$339.99");
    expect(match.notes.join(" ")).toMatch(/out of stock/i);
  });
});
