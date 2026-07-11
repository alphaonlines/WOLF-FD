"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const matching_1 = require("./matching");
(0, vitest_1.describe)('competitorPricing matching', () => {
    (0, vitest_1.it)('cleans and expands slash-combined SKUs', () => {
        (0, vitest_1.expect)((0, matching_1.cleanSku)(' B070-71/96  -32 ')).toBe('B070-71/96');
        (0, vitest_1.expect)((0, matching_1.expandSkuTokens)('B070-71/96')).toEqual(['B070-71/96', 'B070-71', 'B070-96']);
        (0, vitest_1.expect)((0, matching_1.strongestSkuToken)('B070-71/96')).toBe('B070-71');
    });
    (0, vitest_1.it)('extracts base tokens', () => {
        (0, vitest_1.expect)((0, matching_1.baseTokens)(['B070-71', 'B070-96'])).toEqual(['B070']);
    });
    (0, vitest_1.it)('parses prices', () => {
        (0, vitest_1.expect)((0, matching_1.parseFirstPrice)('Sale price $1,249.99 today')).toBe('$1,249.99');
        (0, vitest_1.expect)((0, matching_1.priceToNumber)('$1,249.99')).toBe(1249.99);
    });
    (0, vitest_1.it)('scores exact full SKU token as high confidence', () => {
        (0, vitest_1.expect)((0, matching_1.classifyCompetitorMatch)({
            sourceSku: 'B076-280',
            sourceDescription: 'Trentlore',
            candidateText: 'Trentlore Twin Metal Day Bed B076-280 $179.99',
            price: '$179.99',
        })).toMatchObject({ confidence: 'high', matchedTokens: ['B076-280'] });
    });
    (0, vitest_1.it)('scores base token plus description as medium confidence', () => {
        (0, vitest_1.expect)((0, matching_1.classifyCompetitorMatch)({
            sourceSku: 'B070-71/96',
            sourceDescription: 'Culverbach',
            candidateText: 'Culverbach queen bed collection B070 $449.99',
            price: '$449.99',
        })).toMatchObject({ confidence: 'medium', matchedTokens: ['B070'] });
    });
    (0, vitest_1.it)('scores description-only as low confidence', () => {
        (0, vitest_1.expect)((0, matching_1.classifyCompetitorMatch)({
            sourceSku: 'XYZ-123',
            sourceDescription: 'Stonehollow',
            candidateText: 'Stonehollow dining set $599.99',
            price: '$599.99',
        }).confidence).toBe('low');
    });
    (0, vitest_1.it)('returns none for blocked or zero-result pages', () => {
        (0, vitest_1.expect)((0, matching_1.classifyCompetitorMatch)({ sourceSku: 'B076-280', sourceDescription: 'Trentlore', candidateText: '', zeroResults: true }).confidence).toBe('none');
        (0, vitest_1.expect)((0, matching_1.classifyCompetitorMatch)({ sourceSku: 'B076-280', sourceDescription: 'Trentlore', candidateText: '', blocked: true }).confidence).toBe('none');
    });
    (0, vitest_1.it)('flags manual review signals', () => {
        (0, vitest_1.expect)((0, matching_1.hasManualReviewSignals)({ sku: 'B1050-31/36/46', storePriceText: '7PC Q $1,399 K $1,599' })).toBe(true);
        (0, vitest_1.expect)((0, matching_1.hasManualReviewSignals)({ sku: 'B076-280', storePriceText: '$199' })).toBe(false);
    });
});
//# sourceMappingURL=matching.test.js.map