"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const firecrawlClient_1 = require("./firecrawlClient");
const searxClient_1 = require("./searxClient");
const competitors_1 = require("./competitors");
vitest_1.vi.mock("./firecrawlClient", () => ({
    scrapeWithFirecrawl: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("./searxClient", () => ({
    searchSearx: vitest_1.vi.fn(),
}));
const row = {
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
(0, vitest_1.describe)("competitor lookups", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mockReset();
        vitest_1.vi.mocked(searxClient_1.searchSearx).mockReset();
    });
    (0, vitest_1.it)("queries Furniture4LessNC search with strongest SKU token plus description", async () => {
        vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mockResolvedValue({
            success: true,
            title: "Search",
            markdown: "[Trentlore Sofa B070-71](https://furniture4lessnc.com/products/trentlore)\nSale price $399",
        });
        const match = await (0, competitors_1.lookupFurniture4Less)(row);
        const requestedUrl = vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mock.calls[0][0];
        (0, vitest_1.expect)(new URL(requestedUrl).origin).toBe("https://furniture4lessnc.com");
        (0, vitest_1.expect)(new URL(requestedUrl).pathname).toBe("/search");
        (0, vitest_1.expect)(new URL(requestedUrl).searchParams.get("q")).toBe("B070-71 Trentlore Sofa");
        (0, vitest_1.expect)(match.confidence).toBe("high");
        (0, vitest_1.expect)(match.url).toContain("furniture4lessnc.com/products/trentlore");
    });
    (0, vitest_1.it)("treats Furniture4LessNC 0-results markdown as no match", async () => {
        vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mockResolvedValue({
            success: true,
            title: "Search",
            markdown: "0 results for B070-71 Trentlore Sofa",
        });
        const match = await (0, competitors_1.lookupFurniture4Less)(row);
        (0, vitest_1.expect)(match.confidence).toBe("none");
        (0, vitest_1.expect)(match.notes.join(" ")).toMatch(/0 results/i);
    });
    (0, vitest_1.it)("uses SearXNG before scraping Ashley URLs", async () => {
        vitest_1.vi.mocked(searxClient_1.searchSearx).mockResolvedValue([
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
        vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mockResolvedValue({
            success: true,
            title: "Trentlore Sofa B070-71",
            markdown: "# Trentlore Sofa B070-71\nPrice $429.99",
        });
        const match = await (0, competitors_1.lookupAshley)(row);
        (0, vitest_1.expect)(vitest_1.vi.mocked(searxClient_1.searchSearx).mock.calls[0][0]).toBe("site:ashleyfurniture.com B070-71 Trentlore Sofa");
        (0, vitest_1.expect)(vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mock.calls).toHaveLength(1);
        (0, vitest_1.expect)(vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mock.calls[0][0]).toBe("https://www.ashleyfurniture.com/p/trentlore_sofa/B070-71.html");
        (0, vitest_1.expect)(match.confidence).toBe("high");
        (0, vitest_1.expect)(match.price).toBe("$429.99");
    });
    (0, vitest_1.it)("does not use Ashley direct search URLs", async () => {
        vitest_1.vi.mocked(searxClient_1.searchSearx).mockResolvedValue([
            {
                title: "Trentlore Sofa B070-71 | Ashley",
                url: "https://www.ashleyfurniture.com/p/trentlore_sofa/B070-71.html",
                content: "Ashley result",
            },
        ]);
        vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mockResolvedValue({
            success: true,
            title: "Trentlore Sofa B070-71",
            markdown: "# Trentlore Sofa B070-71\nPrice $429.99",
        });
        await (0, competitors_1.lookupAshley)(row);
        (0, vitest_1.expect)(vitest_1.vi.mocked(searxClient_1.searchSearx).mock.calls[0][0]).toContain("site:ashleyfurniture.com");
        for (const [url] of vitest_1.vi.mocked(firecrawlClient_1.scrapeWithFirecrawl).mock.calls) {
            (0, vitest_1.expect)(url).not.toMatch(/ashleyfurniture\.com\/search/i);
        }
    });
});
//# sourceMappingURL=competitors.test.js.map