"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSku = cleanSku;
exports.expandSkuTokens = expandSkuTokens;
exports.strongestSkuToken = strongestSkuToken;
exports.baseTokens = baseTokens;
exports.parseFirstPrice = parseFirstPrice;
exports.priceToNumber = priceToNumber;
exports.hasManualReviewSignals = hasManualReviewSignals;
exports.classifyCompetitorMatch = classifyCompetitorMatch;
const PRICE_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;
function cleanSku(sku) {
    return String(sku || '')
        .replace(/[_]+/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/\s+-\d+(?:\/\d+)?\s*$/g, '')
        .trim();
}
function expandSkuTokens(sku) {
    const value = cleanSku(sku);
    const tokens = [];
    for (const rawPart of value.split(/[ ,]+/)) {
        const part = rawPart.trim();
        if (!part || !/\d/.test(part))
            continue;
        tokens.push(part);
        if (part.includes('/') && part.includes('-')) {
            const [prefix, rest] = part.split('-', 2);
            const pieces = rest.split('/');
            const firstNum = pieces[0]?.match(/^\d+/)?.[0] || '';
            const width = firstNum.length;
            for (const piece of pieces) {
                const match = piece.match(/^(\d+)([A-Za-z]*)$/);
                if (match)
                    tokens.push(`${prefix}-${match[1].padStart(width, '0')}${match[2]}`);
            }
        }
    }
    return Array.from(new Set(tokens));
}
function strongestSkuToken(sku) {
    const tokens = expandSkuTokens(sku);
    return tokens.find((token) => token.includes('-') && !token.includes('/')) || tokens[0] || cleanSku(sku);
}
function baseTokens(tokens) {
    return Array.from(new Set(tokens
        .filter((token) => token.includes('-'))
        .map((token) => token.split('-', 1)[0])
        .filter(Boolean)));
}
function parseFirstPrice(text) {
    return (String(text || '').match(PRICE_RE)?.[0] || '').replace(/\s+/g, '');
}
function priceToNumber(price) {
    const n = Number(String(price || '').replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
}
function hasManualReviewSignals(args) {
    const combined = `${args.sku || ''} ${args.description || ''} ${args.storePriceText || ''}`;
    if (!args.sku || !parseFirstPrice(args.storePriceText || ''))
        return true;
    if (/\//.test(args.sku))
        return true;
    if (/\b\d+\s*pc\b/i.test(combined))
        return true;
    if (/\bset\b/i.test(combined))
        return true;
    if ((String(args.storePriceText || '').match(PRICE_RE) || []).length > 1)
        return true;
    return false;
}
function classifyCompetitorMatch(args) {
    const notes = [];
    if (args.zeroResults)
        return { confidence: 'none', matchedTokens: [], notes: ['competitor search returned 0 results'] };
    if (args.blocked)
        return { confidence: 'none', matchedTokens: [], notes: ['competitor page was blocked'] };
    const price = args.price || parseFirstPrice(args.candidateText);
    if (!price)
        notes.push('no price found near candidate');
    const tokens = expandSkuTokens(args.sourceSku);
    const bases = baseTokens(tokens);
    const haystack = String(args.candidateText || '').toLowerCase();
    const exact = tokens.filter((token) => token.includes('-') && haystack.includes(token.toLowerCase()));
    const base = bases.filter((token) => haystack.includes(token.toLowerCase()));
    const description = String(args.sourceDescription || '').trim().toLowerCase();
    const descriptionHit = Boolean(description && haystack.includes(description));
    if (exact.length) {
        return { confidence: price ? 'high' : 'low', matchedTokens: exact, notes };
    }
    if (base.length && descriptionHit) {
        return { confidence: price ? 'medium' : 'low', matchedTokens: base, notes: [...notes, 'base collection plus description match'] };
    }
    if (descriptionHit) {
        return { confidence: 'low', matchedTokens: [], notes: [...notes, 'description-only match'] };
    }
    if (base.length) {
        return { confidence: 'low', matchedTokens: base, notes: [...notes, 'base collection-only match'] };
    }
    return { confidence: 'none', matchedTokens: [], notes: [...notes, 'no SKU/model identity match'] };
}
//# sourceMappingURL=matching.js.map