"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchSearx = searchSearx;
const cache_1 = require("./cache");
const SEARXNG_URL = process.env.SEARXNG_URL || 'http://127.0.0.1:8089/search';
async function searchSearx(query) {
    return (0, cache_1.cachedJson)('searx', { query }, async () => {
        try {
            const endpoint = new URL(SEARXNG_URL);
            endpoint.searchParams.set('q', query);
            endpoint.searchParams.set('format', 'json');
            endpoint.searchParams.set('language', 'en-US');
            const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
            if (!response.ok)
                return [];
            const json = await response.json().catch(() => null);
            const rows = Array.isArray(json?.results) ? json.results : [];
            return rows.map((row) => ({
                title: String(row?.title || ''),
                url: String(row?.url || ''),
                content: String(row?.content || ''),
            })).filter((row) => row.url);
        }
        catch {
            return [];
        }
    });
}
//# sourceMappingURL=searxClient.js.map