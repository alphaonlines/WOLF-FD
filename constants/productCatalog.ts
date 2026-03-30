export const CANONICAL_PRODUCT_MANUFACTURERS = [
  "Vendor Price List",
  "AAmerica",
  "Albany",
  "Archbold",
  "Ashley",
  "Best",
  "England",
  "GBS ProtectAll",
  "Guardsman",
  "Innovations",
  "Jackson/Catnapper",
  "Liberty",
  "Vaughan-Bassett",
] as const;

/**
 * Freight rates per manufacturer slug, sourced from vendor list.
 * Used in: suggestedRetail = (kioskPrice × (1 + freightRate)) / 0.40  (60% gross margin)
 */
export const MANUFACTURER_FREIGHT_RATES: Record<string, number> = {
  // Primary slugs
  "ashley": 0.255,
  "albany": 0.20,
  "archbold": 0.125,
  "aamerica": 0.20,
  "a-america": 0.20,
  "best": 0.205,
  "england": 0.31,
  "gbs-protectall": 0.12,
  "gbs": 0.12,
  "guardsman": 0.12,
  "innovations": 0.195,
  "jackson": 0.225,
  "catnapper": 0.225,
  "jackson-catnapper": 0.225,
  "liberty": 0.225,
  "vaughan-bassett": 0.135,
  // Additional vendors from vendor list
  "benchmaster": 0.15,
  "coaster": 0.35,
  "comfort-sleep": 0.35,
  "crownmark": 0.225,
  "dalyn-rug": 0.35,
  "dr-greenes": 0.06,
  "elements": 0.30,
  "infinity": 0.10,
  "knickerbocker": 0.07,
  "leather-italia": 0.15,
  "luke-leather": 0.10,
  "magnussen": 0.365,
  "mattress-first": 0.15,
  "montage": 0.20,
  "ollix": 0.15,
  "sealy": 0.06,
  "serta": 0.15,
  "simmons": 0.15,
  "southco": 0.15,
  "tempurpedic": 0.06,
  "ultracomfort": 0.10,
  "woodhouse": 0.17,
};

/**
 * Returns suggested retail at 60% gross margin including freight.
 * Formula: retail = (kioskPrice × (1 + freightRate)) / 0.40
 * Returns null when basePrice is null/0 or no freight rate is known.
 */
export const calcSuggestedRetail = (
  basePrice: number | null,
  manufacturerSlug: string
): number | null => {
  if (basePrice === null || basePrice <= 0) return null;
  const slug = (manufacturerSlug || "").toLowerCase().trim();
  const rate = MANUFACTURER_FREIGHT_RATES[slug];
  if (rate === undefined) return null;
  return (basePrice * (1 + rate)) / 0.40;
};

/**
 * Returns floor retail at 50% gross margin including freight.
 * Formula: retail = (kioskPrice × (1 + freightRate)) / 0.50
 * Use this as the lowest price to go before losing margin.
 */
export const calcFloorRetail = (
  basePrice: number | null,
  manufacturerSlug: string
): number | null => {
  if (basePrice === null || basePrice <= 0) return null;
  const slug = (manufacturerSlug || "").toLowerCase().trim();
  const rate = MANUFACTURER_FREIGHT_RATES[slug];
  if (rate === undefined) return null;
  return (basePrice * (1 + rate)) / 0.50;
};
