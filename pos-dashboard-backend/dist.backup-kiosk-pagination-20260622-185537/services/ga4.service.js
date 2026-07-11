"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GA4Service = void 0;
const data_1 = require("@google-analytics/data");
class GA4Service {
    constructor(propertyId, serviceAccountJson) {
        this.propertyId = propertyId;
        this.serviceAccountJson = serviceAccountJson;
        this.client = null;
        this.auth = null;
    }
    async getClient() {
        if (this.client)
            return this.client;
        if (this.serviceAccountJson) {
            this.client = new data_1.BetaAnalyticsDataClient({
                credentials: JSON.parse(this.serviceAccountJson),
            });
        }
        else {
            // Fallback to default credentials or OAuth
            this.client = new data_1.BetaAnalyticsDataClient();
        }
        return this.client;
    }
    async getSummary() {
        const client = await this.getClient();
        // Example query - replace with actual GA4 Data API call
        const [response] = await client.runReport({
            property: `properties/${this.propertyId}`,
            dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
            metrics: [
                { name: 'sessions' },
                { name: 'totalUsers' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' },
            ],
        });
        const row = response.rows?.[0];
        return {
            sessions: parseInt(row?.metricValues?.[0]?.value || '0'),
            users: parseInt(row?.metricValues?.[1]?.value || '0'),
            bounceRate: parseFloat(row?.metricValues?.[2]?.value || '0'),
            avgSessionDuration: parseFloat(row?.metricValues?.[3]?.value || '0'),
            lastUpdated: new Date().toISOString(),
        };
    }
}
exports.GA4Service = GA4Service;
//# sourceMappingURL=ga4.service.js.map