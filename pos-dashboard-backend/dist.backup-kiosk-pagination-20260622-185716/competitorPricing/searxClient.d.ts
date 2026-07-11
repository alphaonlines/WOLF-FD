export type SearxResult = {
    title: string;
    url: string;
    content: string;
};
export declare function searchSearx(query: string): Promise<SearxResult[]>;
