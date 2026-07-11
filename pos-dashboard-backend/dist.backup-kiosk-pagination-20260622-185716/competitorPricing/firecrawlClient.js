"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeWithFirecrawl = scrapeWithFirecrawl;
const cache_1 = require("./cache");
const FIRECRAWL_API_URL = (process.env.FIRECRAWL_API_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '');
async function scrapeWithFirecrawl(url) {
    return (0, cache_1.cachedJson)('firecrawl', { url }, async () => {
        try {
            const response = await fetch(`${FIRECRAWL_API_URL}/v1/scrape`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ url, formats: ['markdown'] }),
            });
            const json = await response.json().catch(() => null);
            const data = json?.data || {};
            return {
                success: Boolean(json?.success && response.ok),
                markdown: String(data.markdown || ''),
                title: String(data.metadata?.title || data.title || ''),
                statusCode: Number(data.metadata?.statusCode || response.status),
                error: response.ok ? undefined : `Firecrawl HTTP ${response.status}`,
            };
        }
        catch (err) {
            return {
                success: false,
                markdown: '',
                title: '',
                error: String(err?.message || err),
            };
        }
    });
}
//# sourceMappingURL=firecrawlClient.js.map