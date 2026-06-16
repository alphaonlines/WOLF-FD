import { cachedJson } from './cache';

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://127.0.0.1:8089/search';

export type SearxResult = {
  title: string;
  url: string;
  content: string;
};

export async function searchSearx(query: string): Promise<SearxResult[]> {
  return cachedJson('searx', { query }, async () => {
    try {
      const endpoint = new URL(SEARXNG_URL);
      endpoint.searchParams.set('q', query);
      endpoint.searchParams.set('format', 'json');
      endpoint.searchParams.set('language', 'en-US');
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) return [];
      const json = await response.json().catch(() => null) as any;
      const rows = Array.isArray(json?.results) ? json.results : [];
      return rows.map((row: any) => ({
        title: String(row?.title || ''),
        url: String(row?.url || ''),
        content: String(row?.content || ''),
      })).filter((row: SearxResult) => row.url);
    } catch {
      return [];
    }
  });
}
