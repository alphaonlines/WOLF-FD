export type CanonicalRankMetric = "sales" | "qty";

export function rankCanonicalSeries<T extends { label?: string; sales?: number; quantity?: number }>(
  rows: T[] | null | undefined,
  metric: CanonicalRankMetric,
  limit: number,
): T[] {
  const key = metric === "qty" ? "quantity" : "sales";
  return [...(rows || [])]
    .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0) || String(a.label || "").localeCompare(String(b.label || "")))
    .slice(0, Math.max(0, limit));
}
