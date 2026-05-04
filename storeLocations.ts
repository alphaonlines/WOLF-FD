export type StoreCode = "ALL" | "FD7" | "FD5" | "G1" | "Base" | "Camp";
export type SpecificStoreCode = Exclude<StoreCode, "ALL">;

export type StoreLocationOption = {
  code: SpecificStoreCode;
  label: string;
  aliases: string[];
};

export const DEFAULT_STORE_CODE: SpecificStoreCode = "FD7";

export const STORE_LOCATIONS: StoreLocationOption[] = [
  { code: "FD7", label: "Morehead", aliases: ["Morehead", "Morehead City"] },
  { code: "FD5", label: "Havelock", aliases: ["Havelock"] },
  { code: "G1", label: "Greenville", aliases: ["Greenville"] },
  { code: "Base", label: "Cherry Point", aliases: ["Cherry Point"] },
  { code: "Camp", label: "Camp Lejeune", aliases: ["Camp Lejeune", "Camp LeJeune"] },
];

export const STORE_CODES: SpecificStoreCode[] = STORE_LOCATIONS.map((location) => location.code);

export const STORE_FILTER_OPTIONS: Array<{ code: StoreCode; label: string }> = [
  { code: "ALL", label: "All Locations" },
  ...STORE_LOCATIONS.map((location) => ({ code: location.code, label: location.label })),
];

export const normalizeStoreCode = (value: unknown): StoreCode | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.toUpperCase() === "ALL") return "ALL";

  const direct = STORE_LOCATIONS.find((location) => location.code.toLowerCase() === raw.toLowerCase());
  if (direct) return direct.code;

  const byLabel = STORE_LOCATIONS.find((location) =>
    [location.label, ...location.aliases].some((label) => label.toLowerCase() === raw.toLowerCase())
  );
  return byLabel?.code ?? null;
};

export const getStoreLabel = (value: unknown): string => {
  const code = normalizeStoreCode(value);
  if (code === "ALL") return "All Locations";
  const location = STORE_LOCATIONS.find((entry) => entry.code === code);
  return location?.label ?? (value ? String(value) : "Morehead");
};

export const getSpecificStoreLabel = (value: unknown): string => {
  const code = normalizeStoreCode(value);
  if (code === "ALL") return "All Locations";
  const location = STORE_LOCATIONS.find((entry) => entry.code === code);
  return location?.label ?? getStoreLabel(DEFAULT_STORE_CODE);
};

export const getTaskStoreCode = (taskMeta: Record<string, any> | null | undefined): StoreCode | null => {
  if (!taskMeta) return null;
  return (
    normalizeStoreCode(taskMeta.storeCode) ??
    normalizeStoreCode(taskMeta.locationCode) ??
    normalizeStoreCode(taskMeta.store) ??
    normalizeStoreCode(taskMeta.location)
  );
};

export const buildTaskLocationMeta = (store: StoreCode): Record<string, string> => ({
  storeCode: store,
  location: getStoreLabel(store),
  locationScope: store === "ALL" ? "all" : "store",
});
