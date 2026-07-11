export declare function getCompetitorPricingDataDir(): string;
export declare const COMPETITOR_PRICING_DATA_DIR: string;
export declare function cacheKey(namespace: string, request: unknown): string;
export declare function cachePath(namespace: string, request: unknown, baseDir?: string): string;
export declare function readCachedJson<T>(namespace: string, request: unknown, baseDir?: string): Promise<T | null>;
export declare function writeCachedJson<T>(namespace: string, request: unknown, value: T, baseDir?: string): Promise<T>;
export declare function cachedJson<T>(namespace: string, request: unknown, loader: () => Promise<T>, baseDir?: string): Promise<T>;
export declare function ensureDir(dir: string): Promise<void>;
