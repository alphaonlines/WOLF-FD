import type {
  CompetitorPricingCompetitorMatch,
  CompetitorPricingInputRow,
  CompetitorPricingMatchConfidence,
} from "./types";
import { scrapeWithFirecrawl } from "./firecrawlClient";
import { searchSearx } from "./searxClient";
import { classifyCompetitorMatch, parseFirstPrice, priceToNumber, strongestSkuToken } from "./matching";

const FURNITURE4LESS_BASE = "https://furniture4lessnc.com";
const ASHLEY_HOST_RE = /(^|\.)ashleyfurniture\.com$/i;

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

function noMatch(competitor: "Ashley" | "Furniture4LessNC", notes: string[], url = ""): CompetitorPricingCompetitorMatch {
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

function buildLookupQuery(row: CompetitorPricingInputRow): string {
  return [strongestSkuToken(row.sku), row.description].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
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
  competitor: "Ashley" | "Furniture4LessNC",
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

export async function lookupFurniture4Less(row: CompetitorPricingInputRow): Promise<CompetitorPricingCompetitorMatch> {
  const query = buildLookupQuery(row);
  if (!query) return noMatch("Furniture4LessNC", ["missing SKU and description"]);

  const searchUrl = `${FURNITURE4LESS_BASE}/search?q=${encodeURIComponent(query)}`;
  const scrape = await scrapeWithFirecrawl(searchUrl);
  const markdown = scrape.markdown || "";
  const zeroResults = /\b0\s+results\s+for\b/i.test(markdown);

  if (zeroResults) {
    return noMatch("Furniture4LessNC", ["Furniture4LessNC search returned 0 results"], searchUrl);
  }
  if (!scrape.success && !markdown) {
    return noMatch(
      "Furniture4LessNC",
      [scrape.error || "Furniture4LessNC scrape failed", scrape.statusCode ? `status ${scrape.statusCode}` : ""].filter(Boolean),
      searchUrl
    );
  }

  const candidates = extractMarkdownCandidates(markdown, FURNITURE4LESS_BASE, searchUrl, scrape.title);
  const matches = candidates.map((candidate) => scoreCandidate("Furniture4LessNC", row, candidate));
  const best = chooseBest(matches);
  return best || noMatch("Furniture4LessNC", ["no Furniture4LessNC candidates found"], searchUrl);
}

export async function lookupAshley(row: CompetitorPricingInputRow): Promise<CompetitorPricingCompetitorMatch> {
  const lookupQuery = buildLookupQuery(row);
  const query = ["site:ashleyfurniture.com", lookupQuery].filter(Boolean).join(" ").trim();
  if (!lookupQuery) return noMatch("Ashley", ["missing SKU and description"]);

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

  if (!ashleyUrls.length) {
    return noMatch("Ashley", ["SearXNG returned no Ashley URLs"]);
  }

  const matches: CompetitorPricingCompetitorMatch[] = [];
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
      notes: ["SearXNG Ashley URL candidate"],
      blocked: !scrape.success && /\b(403|401|access denied|forbidden)\b/i.test(`${scrape.statusCode || ""} ${scrape.error || ""} ${markdown}`),
    };
    if (!scrape.success && scrape.error) candidate.notes.push(scrape.error);
    matches.push(scoreCandidate("Ashley", row, candidate));
  }

  const best = chooseBest(matches);
  return best || noMatch("Ashley", ["no Ashley candidates could be scored"]);
}
