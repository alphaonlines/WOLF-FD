export type PageContext = {
    pageName: string;
    module: string;
    userRole: string;
    keyMetricsVisible: string[];
    suggestedActions: string[];
    pageId?: string;
    subPageId?: string;
    dateRange?: {
        start: string;
        end: string;
        label?: string;
        compareStart?: string;
        compareEnd?: string;
        compareLabel?: string;
    };
    filters?: Record<string, string | null | undefined>;
    visibleSections?: string[];
    dataWarnings?: string[];
    selectedSort?: string;
};
export declare function buildSystemPrompt(userName: string, assistantName: string, pageContext: PageContext, liveContextSnapshot?: string): string;
