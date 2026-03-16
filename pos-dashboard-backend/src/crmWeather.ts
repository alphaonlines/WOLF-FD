import { envString } from "./runtimeConfig";

type StoreWeatherLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

export type CRMWeatherSnapshot = {
  locationLabel: string;
  summary: string | null;
  temperatureF: number | null;
  precipitationProbabilityPct: number | null;
  windSpeedMph: number | null;
  fetchedAt: string;
  source: string;
};

type CachedSnapshot = {
  expiresAt: number;
  snapshot: CRMWeatherSnapshot | null;
};

const WEATHER_CACHE_TTL_MS = Math.max(Number(envString("CRM_WEATHER_CACHE_TTL_MS", "900000")) || 900000, 60000);
const WEATHER_TIMEOUT_MS = Math.max(Number(envString("CRM_WEATHER_TIMEOUT_MS", "3500")) || 3500, 1000);
const WEATHER_USER_AGENT =
  envString("CRM_WEATHER_USER_AGENT", "WOLF-FD CRM Weather (ops@wolf.discount)") ||
  "WOLF-FD CRM Weather (ops@wolf.discount)";

const DEFAULT_STORE_LOCATIONS: Record<string, StoreWeatherLocation> = {
  Camp: { label: "Camp Lejeune, NC", latitude: 34.6403, longitude: -77.3350 },
  Base: { label: "Cherry Point, NC", latitude: 34.9032, longitude: -76.8813 },
  G1: { label: "Greenville, NC", latitude: 35.6127, longitude: -77.3664 },
  FD5: { label: "Newport, NC", latitude: 34.7866, longitude: -76.8599 },
  FD7: { label: "Morehead City, NC", latitude: 34.7229, longitude: -76.7260 },
};

const weatherCache = new Map<string, CachedSnapshot>();
let parsedStoreOverrides: Record<string, StoreWeatherLocation> | null = null;

function parseStoreOverrides(): Record<string, StoreWeatherLocation> {
  if (parsedStoreOverrides) return parsedStoreOverrides;
  const raw = envString("CRM_WEATHER_STORE_COORDS_JSON", "");
  if (!raw) {
    parsedStoreOverrides = {};
    return parsedStoreOverrides;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      parsedStoreOverrides = {};
      return parsedStoreOverrides;
    }
    const overrides: Record<string, StoreWeatherLocation> = {};
    for (const [store, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const latitude = Number((value as any).latitude);
      const longitude = Number((value as any).longitude);
      const label = String((value as any).label || store).trim();
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      overrides[String(store).trim()] = { label: label || String(store).trim(), latitude, longitude };
    }
    parsedStoreOverrides = overrides;
    return parsedStoreOverrides;
  } catch {
    parsedStoreOverrides = {};
    return parsedStoreOverrides;
  }
}

function resolveStoreLocation(store: string): StoreWeatherLocation | null {
  const normalized = String(store || "").trim();
  if (!normalized) return null;
  const overrides = parseStoreOverrides();
  return overrides[normalized] || DEFAULT_STORE_LOCATIONS[normalized] || null;
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/geo+json, application/json",
        "User-Agent": WEATHER_USER_AGENT,
      },
      signal: controller.signal,
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new Error(body?.detail || body?.title || `${res.status} ${res.statusText}`);
    }
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseWindSpeedMph(value: any): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const mph = Number(match[0]);
  return Number.isFinite(mph) ? mph : null;
}

function toFahrenheit(value: any, unit: any): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalizedUnit = String(unit || "").trim().toUpperCase();
  if (normalizedUnit === "F") return numeric;
  if (normalizedUnit === "C") return numeric * (9 / 5) + 32;
  return numeric;
}

function coercePercent(value: any): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export async function getStoreWeatherSnapshot(store: string): Promise<CRMWeatherSnapshot | null> {
  const normalizedStore = String(store || "").trim();
  if (!normalizedStore) return null;

  const cached = weatherCache.get(normalizedStore);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }

  const location = resolveStoreLocation(normalizedStore);
  if (!location) {
    weatherCache.set(normalizedStore, { snapshot: null, expiresAt: Date.now() + WEATHER_CACHE_TTL_MS });
    return null;
  }

  try {
    const pointData = await fetchJson(
      `https://api.weather.gov/points/${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`
    );
    const forecastUrl =
      pointData?.properties?.forecastHourly || pointData?.properties?.forecast || pointData?.properties?.forecastGridData;
    if (!forecastUrl) {
      throw new Error("Weather API did not return a forecast URL.");
    }

    const forecastData = await fetchJson(String(forecastUrl));
    const period = Array.isArray(forecastData?.properties?.periods) ? forecastData.properties.periods[0] : null;
    if (!period) {
      throw new Error("Weather API did not return forecast periods.");
    }

    const snapshot: CRMWeatherSnapshot = {
      locationLabel: location.label,
      summary: period.shortForecast ? String(period.shortForecast) : null,
      temperatureF: toFahrenheit(period.temperature, period.temperatureUnit),
      precipitationProbabilityPct: coercePercent(period.probabilityOfPrecipitation?.value),
      windSpeedMph: parseWindSpeedMph(period.windSpeed),
      fetchedAt: new Date().toISOString(),
      source: "weather.gov/forecast-hourly",
    };

    weatherCache.set(normalizedStore, { snapshot, expiresAt: Date.now() + WEATHER_CACHE_TTL_MS });
    return snapshot;
  } catch {
    weatherCache.set(normalizedStore, { snapshot: null, expiresAt: Date.now() + Math.min(WEATHER_CACHE_TTL_MS, 60000) });
    return null;
  }
}
