import { describe, expect, it } from 'vitest';
import {
  baseTokens,
  classifyCompetitorMatch,
  cleanSku,
  expandSkuTokens,
  hasManualReviewSignals,
  parseFirstPrice,
  priceToNumber,
  strongestSkuToken,
} from './matching';

describe('competitorPricing matching', () => {
  it('cleans and expands slash-combined SKUs', () => {
    expect(cleanSku(' B070-71/96  -32 ')).toBe('B070-71/96');
    expect(expandSkuTokens('B070-71/96')).toEqual(['B070-71/96', 'B070-71', 'B070-96']);
    expect(strongestSkuToken('B070-71/96')).toBe('B070-71');
  });

  it('extracts base tokens', () => {
    expect(baseTokens(['B070-71', 'B070-96'])).toEqual(['B070']);
  });

  it('parses prices', () => {
    expect(parseFirstPrice('Sale price $1,249.99 today')).toBe('$1,249.99');
    expect(priceToNumber('$1,249.99')).toBe(1249.99);
  });

  it('scores exact full SKU token as high confidence', () => {
    expect(classifyCompetitorMatch({
      sourceSku: 'B076-280',
      sourceDescription: 'Trentlore',
      candidateText: 'Trentlore Twin Metal Day Bed B076-280 $179.99',
      price: '$179.99',
    })).toMatchObject({ confidence: 'high', matchedTokens: ['B076-280'] });
  });

  it('scores base token plus description as medium confidence', () => {
    expect(classifyCompetitorMatch({
      sourceSku: 'B070-71/96',
      sourceDescription: 'Culverbach',
      candidateText: 'Culverbach queen bed collection B070 $449.99',
      price: '$449.99',
    })).toMatchObject({ confidence: 'medium', matchedTokens: ['B070'] });
  });

  it('scores description-only as low confidence', () => {
    expect(classifyCompetitorMatch({
      sourceSku: 'XYZ-123',
      sourceDescription: 'Stonehollow',
      candidateText: 'Stonehollow dining set $599.99',
      price: '$599.99',
    }).confidence).toBe('low');
  });

  it('returns none for blocked or zero-result pages', () => {
    expect(classifyCompetitorMatch({ sourceSku: 'B076-280', sourceDescription: 'Trentlore', candidateText: '', zeroResults: true }).confidence).toBe('none');
    expect(classifyCompetitorMatch({ sourceSku: 'B076-280', sourceDescription: 'Trentlore', candidateText: '', blocked: true }).confidence).toBe('none');
  });

  it('flags manual review signals', () => {
    expect(hasManualReviewSignals({ sku: 'B1050-31/36/46', storePriceText: '7PC Q $1,399 K $1,599' })).toBe(true);
    expect(hasManualReviewSignals({ sku: 'B076-280', storePriceText: '$199' })).toBe(false);
  });
});
