import { cachedJson } from './cache';

const FIRECRAWL_API_URL = (process.env.FIRECRAWL_API_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '');

export type FirecrawlScrapeResult = {
  success: boolean;
  markdown: string;
  title: string;
  statusCode?: number;
  error?: string;
};

export async function scrapeWithFirecrawl(url: string): Promise<FirecrawlScrapeResult> {
  return cachedJson('firecrawl', { url }, async () => {
    try {
      const response = await fetch(`${FIRECRAWL_API_URL}/v1/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown'] }),
      });
      const json = await response.json().catch(() => null) as any;
      const data = json?.data || {};
      return {
        success: Boolean(json?.success && response.ok),
        markdown: String(data.markdown || ''),
        title: String(data.metadata?.title || data.title || ''),
        statusCode: Number(data.metadata?.statusCode || response.status),
        error: response.ok ? undefined : `Firecrawl HTTP ${response.status}`,
      } satisfies FirecrawlScrapeResult;
    } catch (err: any) {
      return {
        success: false,
        markdown: '',
        title: '',
        error: String(err?.message || err),
      } satisfies FirecrawlScrapeResult;
    }
  });
}
