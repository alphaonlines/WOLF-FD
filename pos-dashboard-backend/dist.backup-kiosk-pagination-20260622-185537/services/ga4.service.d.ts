export interface GA4Summary {
    sessions: number;
    users: number;
    bounceRate: number;
    avgSessionDuration: number;
    lastUpdated: string;
}
export declare class GA4Service {
    private propertyId;
    private serviceAccountJson?;
    private client;
    private auth;
    constructor(propertyId: string, serviceAccountJson?: string);
    private getClient;
    getSummary(): Promise<GA4Summary>;
}
