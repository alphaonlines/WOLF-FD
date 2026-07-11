import type { CompetitorPricingMatchConfidence } from './types';
export declare function cleanSku(sku: string): string;
export declare function expandSkuTokens(sku: string): string[];
export declare function strongestSkuToken(sku: string): string;
export declare function baseTokens(tokens: string[]): string[];
export declare function parseFirstPrice(text: string): string;
export declare function priceToNumber(price: string): number | null;
export declare function hasManualReviewSignals(args: {
    sku: string;
    storePriceText?: string;
    description?: string;
}): boolean;
export declare function classifyCompetitorMatch(args: {
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
};
