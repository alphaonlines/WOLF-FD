import type { CompetitorPricingResultRow } from "./competitorPricing";

export type ProductPriceMatchRunStatus = "queued" | "running" | "completed" | "failed";

export type ProductPriceMatchRun = {
  id: string;
  catalogItemId: string;
  manufacturer: string;
  manufacturerSlug: string;
  sku: string;
  description: string;
  sellingPrice: number | null;
  status: ProductPriceMatchRunStatus;
  jobId: string | null;
  result: CompetitorPricingResultRow | null;
  error: string | null;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  checkedAt: string | null;
};

export type ProductPriceMatchSummary = {
  ok: boolean;
  latestAttempt: ProductPriceMatchRun | null;
  lastSuccess: ProductPriceMatchRun | null;
  history: ProductPriceMatchRun[];
};
