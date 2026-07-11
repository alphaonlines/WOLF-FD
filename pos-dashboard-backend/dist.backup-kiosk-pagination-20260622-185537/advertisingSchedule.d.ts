import { type AdvertisingScheduleEntry } from "./advertisingScheduleData";
export type AdvertisingSpendSummary = {
    totalAdSpend: number;
    averageDailyAdSpend: number;
    activeAdDays: number;
    daysInRange: number;
    dailySpendByDate: Record<string, number>;
    activePromos: Array<{
        promoName: string;
        offer: string;
        start: string;
        end: string;
        overlapDays: number;
        proratedSpend: number;
        dailySpend: number;
    }>;
};
export declare function calculateAdvertisingSpendSummary(start: string, endExclusive: string, schedule?: AdvertisingScheduleEntry[]): AdvertisingSpendSummary;
