"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const vitest_1 = require("vitest");
const cache_1 = require("./cache");
const tmpRoot = node_path_1.default.join(process.cwd(), 'tmp-competitor-pricing-cache-test');
(0, vitest_1.afterEach)(async () => {
    await promises_1.default.rm(tmpRoot, { recursive: true, force: true });
});
(0, vitest_1.describe)('competitorPricing cache', () => {
    (0, vitest_1.it)('builds stable hashed paths without raw URLs', () => {
        const request = { url: 'https://furniture4lessnc.com/search?q=B076-280 Trentlore' };
        const first = (0, cache_1.cachePath)('firecrawl', request, tmpRoot);
        const second = (0, cache_1.cachePath)('firecrawl', request, tmpRoot);
        (0, vitest_1.expect)(first).toBe(second);
        (0, vitest_1.expect)(first).toMatch(/firecrawl\/[a-f0-9]{64}\.json$/);
        (0, vitest_1.expect)(first).not.toContain('furniture4lessnc');
        (0, vitest_1.expect)(first).not.toContain('B076-280');
    });
    (0, vitest_1.it)('writes and reads JSON cache values', async () => {
        const request = { query: 'site:ashleyfurniture.com B076-280' };
        await (0, cache_1.writeCachedJson)('searx', request, { ok: true }, tmpRoot);
        await (0, vitest_1.expect)((0, cache_1.readCachedJson)('searx', request, tmpRoot)).resolves.toEqual({ ok: true });
    });
});
//# sourceMappingURL=cache.test.js.map