export type FirecrawlScrapeResult = {
    success: boolean;
    markdown: string;
    title: string;
    statusCode?: number;
    error?: string;
};
export declare function scrapeWithFirecrawl(url: string): Promise<FirecrawlScrapeResult>;
