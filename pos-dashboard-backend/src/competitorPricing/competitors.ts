import type {
  CompetitorPricingCompetitorMatch,
  CompetitorPricingInputRow,
  CompetitorPricingMatchConfidence,
} from "./types";
import { scrapeWithFirecrawl } from "./firecrawlClient";
import { searchSearx } from "./searxClient";
import {
  classifyCompetitorMatch,
  hasExactNormalizedSkuToken,
  parseFirstPrice,
  priceMatchLookupSkuTokens,
  priceToNumber,
} from "./matching";

const FURNITURE4LESS_BASE = "https://furniture4lessnc.com";
const FURNITURE_FAIR_BASE = "https://furniture-fair.net";
const FURNITURE_FAIR_CATALOG_TTL_MS = 15 * 60 * 1000;
const FURNITURE_FAIR_PAGE_SIZE = 250;
const FURNITURE_FAIR_MAX_PAGES = 8;
const ASHLEY_HOST_RE = /(^|\.)ashleyfurniture\.com$/i;

type CompetitorName = "Ashley" | "Furniture4LessNC" | "FurnitureFairNC";

const CONFIDENCE_RANK: Record<CompetitorPricingMatchConfidence, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

type Candidate = {
  title: string;
  url: string;
  price: string;
  text: string;
  notes: string[];
  blocked?: boolean;
  zeroResults?: boolean;
};

type FurnitureFairVariant = {
  sku?: string | number | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
  available?: boolean;
};

type FurnitureFairProduct = {
  title?: string;
  handle?: string;
  vendor?: string;
  body_html?: string;
  variants?: FurnitureFairVariant[];
};

let furnitureFairCatalogCache: { loadedAt: number; products: FurnitureFairProduct[] } | null = null;
let furnitureFairCatalogPromise: Promise<FurnitureFairProduct[]> | null = null;

function noMatch(competitor: CompetitorName, notes: string[], url = ""): CompetitorPricingCompetitorMatch {
  return {
    competitor,
    title: "",
    price: "",
    url,
    confidence: "none",
    matchedTokens: [],
    notes,
  };
}

function buildLookupQueries(row: CompetitorPricingInputRow, skuTokens = priceMatchLookupSkuTokens(row.sku)): string[] {
  const queries = skuTokens.length ? skuTokens : [""];
  return Array.from(new Set(queries
    .map((skuToken) => [skuToken, row.description].filter(Boolean).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)));
}

function absoluteUrl(url: string, base: string): string {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function stripMarkdown(text: string): string {
  return String(text || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMarkdownCandidates(markdown: string, baseUrl: string, fallbackUrl: string, fallbackTitle = ""): Candidate[] {
  const text = String(markdown || "");
  const linkRegex = /\[([^\]]{2,220})\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g;
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text))) {
    const title = stripMarkdown(match[1]);
    const rawUrl = match[2].replace(/\s+"[^"]*"$/, "");
    const url = absoluteUrl(rawUrl, baseUrl);
    if (!title || !url || seen.has(`${title}|${url}`)) continue;
    if (/^(view|next|previous|cart|checkout|account|login|search)$/i.test(title)) continue;
    seen.add(`${title}|${url}`);

    const start = Math.max(0, match.index - 500);
    const end = Math.min(text.length, linkRegex.lastIndex + 1000);
    const snippet = text.slice(start, end);
    const price = parseFirstPrice(snippet);
    candidates.push({
      title,
      url,
      price,
      text: `${title}\n${stripMarkdown(snippet)}`,
      notes: ["markdown link candidate"],
    });
  }

  if (!candidates.length) {
    const price = parseFirstPrice(text);
    candidates.push({
      title: fallbackTitle || "Search result page",
      url: fallbackUrl,
      price,
      text: stripMarkdown(text),
      notes: ["full page fallback candidate"],
    });
  }

  return candidates;
}

function scoreCandidate(
  competitor: CompetitorName,
  row: CompetitorPricingInputRow,
  candidate: Candidate
): CompetitorPricingCompetitorMatch {
  const score = classifyCompetitorMatch({
    sourceSku: row.sku,
    sourceDescription: row.description,
    candidateText: candidate.text,
    zeroResults: candidate.zeroResults,
    blocked: candidate.blocked,
    price: candidate.price,
  });
  return {
    competitor,
    title: candidate.title,
    price: candidate.price,
    url: candidate.url,
    confidence: score.confidence,
    matchedTokens: score.matchedTokens,
    notes: [...candidate.notes, ...score.notes],
  };
}

function chooseBest(matches: CompetitorPricingCompetitorMatch[]): CompetitorPricingCompetitorMatch | null {
  const sorted = [...matches].sort((a, b) => {
    const rankDelta = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (rankDelta) return rankDelta;
    const aPrice = priceToNumber(a.price) ?? Number.POSITIVE_INFINITY;
    const bPrice = priceToNumber(b.price) ?? Number.POSITIVE_INFINITY;
    if (aPrice !== bPrice) return aPrice - bPrice;
    return (a.title || "").localeCompare(b.title || "");
  });
  return sorted[0] || null;
}

function isAshleyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ASHLEY_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

function normalizeIdentity(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function manufacturerCore(value: unknown): string {
  return normalizeIdentity(value).replace(
    /(homefurnishings|furnishings|furniture|industries|international|company|incorporated|inc|llc)/g,
    ""
  );
}

function furnitureFairManufacturerMatches(row: CompetitorPricingInputRow, product: FurnitureFairProduct): boolean {
  const source = manufacturerCore(row.vendor);
  const candidate = manufacturerCore(`${product.vendor || ""} ${product.title || ""}`);
  return Boolean(source && source.length >= 3 && candidate.includes(source));
}

function furnitureFairModelEvidence(product: FurnitureFairProduct, skuToken: string): {
  productIdentityMatch: boolean;
  matchingVariants: FurnitureFairVariant[];
} {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  return {
    productIdentityMatch: [product.handle, product.title]
      .some((value) => hasExactNormalizedSkuToken(String(value || ""), skuToken)),
    matchingVariants: variants
      .filter((variant) => hasExactNormalizedSkuToken(String(variant.sku || ""), skuToken)),
  };
}

function shopifyPriceToNumber(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 10_000 ? value / 100 : value;
  }
  return priceToNumber(String(value || ""));
}

function formatFurnitureFairPrice(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function furnitureFairOffer(product: FurnitureFairProduct, skuToken: string): {
  price: string;
  available: boolean;
  ambiguous: boolean;
} {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const evidence = furnitureFairModelEvidence(product, skuToken);
  const identityVariants = evidence.matchingVariants.length ? evidence.matchingVariants : variants;
  const availableVariants = identityVariants.filter((variant) => variant.available !== false);
  const candidates = availableVariants.length ? availableVariants : identityVariants;
  const prices = candidates
    .map((variant) => shopifyPriceToNumber(variant.price))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const uniquePrices = Array.from(new Set(prices));
  const ambiguous = uniquePrices.length > 1;
  return {
    price: !ambiguous && uniquePrices.length ? formatFurnitureFairPrice(uniquePrices[0]) : "",
    available: availableVariants.length > 0,
    ambiguous,
  };
}

async function fetchFurnitureFairCatalog(): Promise<FurnitureFairProduct[]> {
  const now = Date.now();
  if (furnitureFairCatalogCache && now - furnitureFairCatalogCache.loadedAt < FURNITURE_FAIR_CATALOG_TTL_MS) {
    return furnitureFairCatalogCache.products;
  }
  if (furnitureFairCatalogPromise) return furnitureFairCatalogPromise;

  furnitureFairCatalogPromise = (async () => {
    const products: FurnitureFairProduct[] = [];
    for (let page = 1; page <= FURNITURE_FAIR_MAX_PAGES; page += 1) {
      const endpoint = new URL(`${FURNITURE_FAIR_BASE}/products.json`);
      endpoint.searchParams.set("limit", String(FURNITURE_FAIR_PAGE_SIZE));
      endpoint.searchParams.set("page", String(page));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(endpoint, {
          headers: { Accept: "application/json", "User-Agent": "WOLF-FD-PriceMatch/1.0" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Furniture Fair catalog HTTP ${response.status}`);
        const json = await response.json().catch(() => null) as any;
        const rows = Array.isArray(json?.products) ? json.products as FurnitureFairProduct[] : [];
        products.push(...rows);
        if (rows.length < FURNITURE_FAIR_PAGE_SIZE) break;
      } finally {
        clearTimeout(timer);
      }
    }
    furnitureFairCatalogCache = { loadedAt: Date.now(), products };
    return products;
  })().finally(() => {
    furnitureFairCatalogPromise = null;
  });

  return furnitureFairCatalogPromise;
}

function furnitureFairDescriptionScore(row: CompetitorPricingInputRow, product: FurnitureFairProduct): number {
  const candidate = normalizeIdentity(`${product.title || ""} ${product.body_html || ""}`);
  const terms = String(row.description || "").toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  return Array.from(new Set(terms)).filter((term) => candidate.includes(normalizeIdentity(term))).length;
}

export async function lookupFurnitureFair(row: CompetitorPricingInputRow): Promise<CompetitorPricingCompetitorMatch> {
  const skuTokens = priceMatchLookupSkuTokens(row.sku);
  if (!skuTokens.length) return noMatch("FurnitureFairNC", ["missing SKU"]);

  let products: FurnitureFairProduct[];
  try {
    products = await fetchFurnitureFairCatalog();
  } catch (error: any) {
    return noMatch("FurnitureFairNC", [String(error?.message || error || "Furniture Fair catalog lookup failed")]);
  }

  for (const skuToken of skuTokens) {
    const normalizedSku = normalizeIdentity(skuToken);
    if (!normalizedSku) continue;
    const candidates = products
      .filter((product) => {
        if (!furnitureFairManufacturerMatches(row, product)) return false;
        const evidence = furnitureFairModelEvidence(product, skuToken);
        return evidence.productIdentityMatch || evidence.matchingVariants.length > 0;
      })
      .sort((a, b) => {
        const descriptionDelta = furnitureFairDescriptionScore(row, b) - furnitureFairDescriptionScore(row, a);
        if (descriptionDelta) return descriptionDelta;
        const availableDelta = Number(furnitureFairOffer(b, skuToken).available) - Number(furnitureFairOffer(a, skuToken).available);
        if (availableDelta) return availableDelta;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
    const product = candidates[0];
    if (!product) continue;

    const offer = furnitureFairOffer(product, skuToken);
    const notes = [
      "Furniture Fair public Shopify catalog exact model match",
      skuToken === skuTokens[0] ? "selected SKU query" : "component SKU fallback query",
    ];
    if (!offer.available) notes.push("Furniture Fair product is out of stock");
    if (offer.ambiguous) notes.push("Furniture Fair product variants had different prices without an exact variant SKU");
    if (!offer.price) notes.push("Furniture Fair product had no usable price");
    return {
      competitor: "FurnitureFairNC",
      title: String(product.title || "Furniture Fair product"),
      price: offer.price,
      url: product.handle ? `${FURNITURE_FAIR_BASE}/products/${encodeURIComponent(product.handle)}` : FURNITURE_FAIR_BASE,
      confidence: offer.available && offer.price ? "high" : "low",
      matchedTokens: [skuToken],
      notes,
    };
  }

  return noMatch("FurnitureFairNC", ["no Furniture Fair product matched both manufacturer and SKU"]);
}

export async function lookupFurniture4Less(row: CompetitorPricingInputRow): Promise<CompetitorPricingCompetitorMatch> {
  const skuTokens = priceMatchLookupSkuTokens(row.sku);
  const queries = buildLookupQueries(row, skuTokens);
  if (!queries.length) return noMatch("Furniture4LessNC", ["missing SKU and description"]);

  const matches: CompetitorPricingCompetitorMatch[] = [];
  let lastSearchUrl = "";
  for (const [queryIndex, query] of queries.entries()) {
    const searchUrl = `${FURNITURE4LESS_BASE}/search?q=${encodeURIComponent(query)}`;
    lastSearchUrl = searchUrl;
    const scrape = await scrapeWithFirecrawl(searchUrl);
    const markdown = scrape.markdown || "";
    const zeroResults = /\b0\s+results\s+for\b/i.test(markdown);

    if (zeroResults) {
      matches.push(noMatch("Furniture4LessNC", ["Furniture4LessNC search returned 0 results"], searchUrl));
      continue;
    }
    if (!scrape.success && !markdown) {
      matches.push(noMatch(
        "Furniture4LessNC",
        [scrape.error || "Furniture4LessNC scrape failed", scrape.statusCode ? `status ${scrape.statusCode}` : ""].filter(Boolean),
        searchUrl
      ));
      continue;
    }

    const candidates = extractMarkdownCandidates(markdown, FURNITURE4LESS_BASE, searchUrl, scrape.title)
      .map((candidate) => ({
        ...candidate,
        notes: [...candidate.notes, queryIndex === 0 ? "selected SKU query" : "component SKU fallback query"],
      }));
    const queryMatches = candidates.map((candidate) => scoreCandidate("Furniture4LessNC", row, candidate));
    matches.push(...queryMatches);
    const queryBest = chooseBest(queryMatches);
    const isSelectedSetMatch = skuTokens.length <= 1 || queryIndex > 0 || queryBest?.matchedTokens.includes(skuTokens[0]);
    if (queryBest && isSelectedSetMatch && ["high", "medium"].includes(queryBest.confidence)) return queryBest;
  }

  return chooseBest(matches) || noMatch("Furniture4LessNC", ["no Furniture4LessNC candidates found"], lastSearchUrl);
}

export async function lookupAshley(row: CompetitorPricingInputRow): Promise<CompetitorPricingCompetitorMatch> {
  const skuTokens = priceMatchLookupSkuTokens(row.sku);
  const lookupQueries = buildLookupQueries(row, skuTokens);
  if (!lookupQueries.length) return noMatch("Ashley", ["missing SKU and description"]);
  const matches: CompetitorPricingCompetitorMatch[] = [];
  for (const [queryIndex, lookupQuery] of lookupQueries.entries()) {
    const query = ["site:ashleyfurniture.com", lookupQuery].join(" ").trim();
    const searchResults = await searchSearx(query);
    const ashleyUrls: string[] = [];
    const seen = new Set<string>();
    for (const result of searchResults) {
      const url = String(result.url || "").trim();
      if (!url || !isAshleyUrl(url) || seen.has(url)) continue;
      seen.add(url);
      ashleyUrls.push(url);
      if (ashleyUrls.length >= 5) break;
    }

    for (const url of ashleyUrls) {
      const scrape = await scrapeWithFirecrawl(url);
      const markdown = scrape.markdown || "";
      const sourceSearchResult = searchResults.find((result) => result.url === url);
      const text = [sourceSearchResult?.title, sourceSearchResult?.content, scrape.title, stripMarkdown(markdown), url]
        .filter(Boolean)
        .join("\n");
      const candidate: Candidate = {
        title: scrape.title || sourceSearchResult?.title || "Ashley result",
        url,
        price: parseFirstPrice(markdown) || parseFirstPrice(sourceSearchResult?.content || ""),
        text,
        notes: ["SearXNG Ashley URL candidate", queryIndex === 0 ? "selected SKU query" : "component SKU fallback query"],
        blocked: !scrape.success && /\b(403|401|access denied|forbidden)\b/i.test(`${scrape.statusCode || ""} ${scrape.error || ""} ${markdown}`),
      };
      if (!scrape.success && scrape.error) candidate.notes.push(scrape.error);
      matches.push(scoreCandidate("Ashley", row, candidate));
    }

    const queryBest = chooseBest(matches);
    const isSelectedSetMatch = skuTokens.length <= 1 || queryIndex > 0 || queryBest?.matchedTokens.includes(skuTokens[0]);
    if (queryBest && isSelectedSetMatch && ["high", "medium"].includes(queryBest.confidence)) return queryBest;
  }

  const best = chooseBest(matches);
  return best || noMatch("Ashley", ["SearXNG returned no Ashley URLs for the selected SKU"]);
}

export const __testing = {
  resetFurnitureFairCatalogCache(): void {
    furnitureFairCatalogCache = null;
    furnitureFairCatalogPromise = null;
  },
};
