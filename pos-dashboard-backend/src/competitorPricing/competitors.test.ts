import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompetitorPricingInputRow } from "./types";
import { scrapeWithFirecrawl } from "./firecrawlClient";
import { searchSearx } from "./searxClient";
import { lookupAshley, lookupFurniture4Less } from "./competitors";

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
  });

  it("queries Furniture4LessNC search with strongest SKU token plus description", async () => {
    vi.mocked(scrapeWithFirecrawl).mockResolvedValue({
      success: true,
      title: "Search",
      markdown: "[Trentlore Sofa B070-71](https://furniture4lessnc.com/products/trentlore)\nSale price $399",
    });

    const match = await lookupFurniture4Less(row);
    const requestedUrl = vi.mocked(scrapeWithFirecrawl).mock.calls[0][0];

    expect(new URL(requestedUrl).origin).toBe("https://furniture4lessnc.com");
    expect(new URL(requestedUrl).pathname).toBe("/search");
    expect(new URL(requestedUrl).searchParams.get("q")).toBe("B070-71 Trentlore Sofa");
    expect(match.confidence).toBe("high");
    expect(match.url).toContain("furniture4lessnc.com/products/trentlore");
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
        title: "Trentlore Sofa B070-71 | Ashley",
        url: "https://www.ashleyfurniture.com/p/trentlore_sofa/B070-71.html",
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
      title: "Trentlore Sofa B070-71",
      markdown: "# Trentlore Sofa B070-71\nPrice $429.99",
    });

    const match = await lookupAshley(row);

    expect(vi.mocked(searchSearx).mock.calls[0][0]).toBe("site:ashleyfurniture.com B070-71 Trentlore Sofa");
    expect(vi.mocked(scrapeWithFirecrawl).mock.calls).toHaveLength(1);
    expect(vi.mocked(scrapeWithFirecrawl).mock.calls[0][0]).toBe(
      "https://www.ashleyfurniture.com/p/trentlore_sofa/B070-71.html"
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
});
