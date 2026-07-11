export type CRMWeatherSnapshot = {
    locationLabel: string;
    summary: string | null;
    temperatureF: number | null;
    precipitationProbabilityPct: number | null;
    windSpeedMph: number | null;
    fetchedAt: string;
    source: string;
};
export declare function getStoreWeatherSnapshot(store: string): Promise<CRMWeatherSnapshot | null>;
