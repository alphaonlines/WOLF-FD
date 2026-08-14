import type { CompetitorPricingMatchConfidence } from './types';

const PRICE_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

export function cleanSku(sku: string): string {
  return String(sku || '')
    .replace(/[_]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\d+(?:\/\d+)?\s*$/g, '')
    .trim();
}

export function expandSkuTokens(sku: string): string[] {
  const value = cleanSku(sku);
  const tokens: string[] = [];
  for (const rawPart of value.split(/[ ,]+/)) {
    const part = rawPart.trim();
    if (!part || !/\d/.test(part)) continue;
    tokens.push(part);
    if (part.includes('/') && part.includes('-')) {
      const [prefix, rest] = part.split('-', 2);
      const pieces = rest.split('/');
      const firstNum = pieces[0]?.match(/^\d+/)?.[0] || '';
      const width = firstNum.length;
      for (const piece of pieces) {
        const match = piece.match(/^(\d+)([A-Za-z]*)$/);
        if (match) tokens.push(`${prefix}-${match[1].padStart(width, '0')}${match[2]}`);
      }
    }
  }
  return Array.from(new Set(tokens));
}

export function strongestSkuToken(sku: string): string {
  const tokens = expandSkuTokens(sku);
  return tokens.find((token) => token.includes('-') && !token.includes('/')) || tokens[0] || cleanSku(sku);
}

export function priceMatchLookupSkuTokens(sku: string): string[] {
  const tokens = expandSkuTokens(sku);
  if (!tokens.length) {
    const cleaned = cleanSku(sku);
    return cleaned ? [cleaned] : [];
  }

  const selectedSetSku = tokens.find((token) => token.includes('/'));
  if (!selectedSetSku) return [strongestSkuToken(sku)].filter(Boolean);

  // A set SKU must be priced as the selected set. A component-only match can
  // materially understate the competitor price, so never promote component
  // tokens to independent Price Match lookups.
  return [selectedSetSku];
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasExactNormalizedSkuToken(candidateText: string, skuToken: string): boolean {
  const normalized = String(skuToken || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length < 4 || !/\d/.test(normalized)) return false;
  const flexible = Array.from(normalized)
    .map((character) => regexEscape(character))
    .join('[^a-z0-9]*');
  return new RegExp(`(^|[^a-z0-9])${flexible}(?=$|[^a-z0-9])`, 'i').test(String(candidateText || ''));
}

export function baseTokens(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens
        .filter((token) => token.includes('-'))
        .map((token) => token.split('-', 1)[0])
        .filter(Boolean)
    )
  );
}

export function parseFirstPrice(text: string): string {
  return (String(text || '').match(PRICE_RE)?.[0] || '').replace(/\s+/g, '');
}

export function priceToNumber(price: string): number | null {
  const n = Number(String(price || '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function hasManualReviewSignals(args: { sku: string; storePriceText?: string; description?: string }): boolean {
  const combined = `${args.sku || ''} ${args.description || ''} ${args.storePriceText || ''}`;
  if (!args.sku || !parseFirstPrice(args.storePriceText || '')) return true;
  if (/\//.test(args.sku)) return true;
  if (/\b\d+\s*pc\b/i.test(combined)) return true;
  if (/\bset\b/i.test(combined)) return true;
  if ((String(args.storePriceText || '').match(PRICE_RE) || []).length > 1) return true;
  return false;
}

export function classifyCompetitorMatch(args: {
  sourceSku: string;
  sourceDescription: string;
  candidateText: string;
  zeroResults?: boolean;
  blocked?: boolean;
  price?: string;
}): {
  confidence: CompetitorPricingMatchConfidence;
  matchedTokens: string[];
  notes: string[];
} {
  const notes: string[] = [];
  if (args.zeroResults) return { confidence: 'none', matchedTokens: [], notes: ['competitor search returned 0 results'] };
  if (args.blocked) return { confidence: 'none', matchedTokens: [], notes: ['competitor page was blocked'] };

  const price = args.price || parseFirstPrice(args.candidateText);
  if (!price) notes.push('no price found near candidate');

  const tokens = priceMatchLookupSkuTokens(args.sourceSku);
  const bases = baseTokens(tokens);
  const haystack = String(args.candidateText || '').toLowerCase();
  const exact = tokens.filter((token) => hasExactNormalizedSkuToken(haystack, token));
  const base = bases.filter((token) => hasExactNormalizedSkuToken(haystack, token));
  const description = String(args.sourceDescription || '').trim().toLowerCase();
  const descriptionHit = Boolean(description && haystack.includes(description));
  const requiresExactSetMatch = cleanSku(args.sourceSku).includes('/');

  if (exact.length) {
    return { confidence: price ? 'high' : 'low', matchedTokens: exact, notes };
  }
  if (base.length && descriptionHit) {
    return {
      confidence: requiresExactSetMatch ? 'low' : price ? 'medium' : 'low',
      matchedTokens: base,
      notes: [...notes, requiresExactSetMatch ? 'set SKU requires exact full-set identity' : 'base collection plus description match'],
    };
  }
  if (descriptionHit) {
    return { confidence: 'low', matchedTokens: [], notes: [...notes, 'description-only match'] };
  }
  if (base.length) {
    return { confidence: 'low', matchedTokens: base, notes: [...notes, 'base collection-only match'] };
  }
  return { confidence: 'none', matchedTokens: [], notes: [...notes, 'no SKU/model identity match'] };
}
