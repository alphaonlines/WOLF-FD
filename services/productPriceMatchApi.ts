import type { ProductPriceMatchRun, ProductPriceMatchSummary } from "../types/productPriceMatch";
import { getPosApiBaseUrl } from "./posBackendApi";

const priceMatchApiPrefix = () => `${getPosApiBaseUrl()}/api`;

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error || `Price Match request failed (${response.status})`));
  }
  return payload;
}

export async function fetchProductPriceMatchSummary(catalogItemId: string): Promise<ProductPriceMatchSummary> {
  const response = await fetch(
    `${priceMatchApiPrefix()}/manufacturer-pricebooks/catalog/${encodeURIComponent(catalogItemId)}/price-match-runs?limit=50`,
    { credentials: "include" }
  );
  return readJson(response) as Promise<ProductPriceMatchSummary>;
}

export async function runProductPriceMatch(catalogItemId: string, sellingPrice: number): Promise<ProductPriceMatchRun> {
  const response = await fetch(
    `${priceMatchApiPrefix()}/manufacturer-pricebooks/catalog/${encodeURIComponent(catalogItemId)}/price-match-runs`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellingPrice }),
    }
  );
  const payload = await readJson(response) as { run: ProductPriceMatchRun };
  return payload.run;
}
