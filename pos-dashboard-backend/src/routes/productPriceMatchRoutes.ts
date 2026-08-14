import crypto from "node:crypto";
import type { Express } from "express";
import type { Pool } from "pg";
import {
  createCompetitorPricingJob,
  getCompetitorPricingResults,
  runCompetitorPricingJob,
} from "../competitorPricing/jobs";
import type { CompetitorPricingInputRow, CompetitorPricingResultRow } from "../competitorPricing/types";

type JobServices = {
  createJob: typeof createCompetitorPricingJob;
  getResults: typeof getCompetitorPricingResults;
  runJob: typeof runCompetitorPricingJob;
  enqueue: (task: () => Promise<void>) => void;
};

type RegisterProductPriceMatchRoutesDeps = {
  app: Express;
  pool: Pool;
  jobs?: Partial<JobServices>;
};

const RUN_COOLDOWN_SECONDS = 120;
let productPriceMatchQueue = Promise.resolve();

function defaultEnqueue(task: () => Promise<void>) {
  productPriceMatchQueue = productPriceMatchQueue.then(task, task).catch((error) => {
    console.error("[product-price-match] queued run failed", error);
  });
}

function normalizeSku(value: unknown): string {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeManufacturer(value: unknown): string {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function mapRunRow(row: any) {
  return {
    id: String(row.id || ""),
    catalogItemId: row.catalog_item_id === null || row.catalog_item_id === undefined ? null : String(row.catalog_item_id),
    manufacturer: String(row.manufacturer || ""),
    manufacturerSlug: String(row.manufacturer_slug || ""),
    sku: String(row.sku || ""),
    description: String(row.description || ""),
    sellingPrice: row.selling_price === null || row.selling_price === undefined ? null : Number(row.selling_price),
    status: String(row.status || "queued"),
    jobId: row.job_id ? String(row.job_id) : null,
    result: row.result_json || null,
    error: row.error ? String(row.error) : null,
    requestedByUserId: row.requested_by_user_id === null || row.requested_by_user_id === undefined
      ? null
      : String(row.requested_by_user_id),
    createdAt: row.created_at || null,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    checkedAt: row.checked_at || null,
  };
}

function summarizeRuns(rows: any[], lastSuccessRow?: any) {
  const runs = rows.map(mapRunRow);
  return {
    latestAttempt: runs[0] || null,
    lastSuccess: lastSuccessRow ? mapRunRow(lastSuccessRow) : runs.find((run) => run.status === "completed") || null,
    history: runs,
  };
}

function buildInputRow(product: any, sellingPrice: number): CompetitorPricingInputRow {
  const manufacturer = String(product.manufacturer || "").trim();
  const manufacturerSlug = String(product.manufacturer_slug || "").trim().toLowerCase();
  const isAshley = manufacturerSlug === "ashley" || normalizeManufacturer(manufacturer).includes("ashley");
  const formattedPrice = `$${sellingPrice.toFixed(2)}`;
  return {
    sourceRow: 0,
    vendor: manufacturer,
    sku: String(product.sku || "").trim(),
    description: String(product.description || "").trim(),
    storePriceText: formattedPrice,
    storePrice: formattedPrice,
    regularPrice: "",
    existingAhsCompPrice: "",
    existingFflCompPrice: "",
    existingFurnitureFairCompPrice: "",
    remarks: "Shop item price match",
    bucket: isAshley ? "ashley" : "non_ashley",
    rowNotes: ["Started from Shop for one catalog item"],
  };
}

function assertResultIdentity(input: CompetitorPricingInputRow, result: CompetitorPricingResultRow) {
  if (normalizeSku(input.sku) !== normalizeSku(result?.sku)) {
    throw new Error("Price-match result SKU did not match the selected catalog item");
  }
  if (normalizeManufacturer(input.vendor) !== normalizeManufacturer(result?.vendor)) {
    throw new Error("Price-match result manufacturer did not match the selected catalog item");
  }
}

async function persistRunFailure(pool: Pool, runId: string, message: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await pool.query(
        `UPDATE product_price_match_runs SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`,
        [runId, message]
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
      }
    }
  }
  console.error("[product-price-match] could not persist terminal failure", { runId, error: lastError });
}

async function executeProductPriceMatchRun(args: {
  pool: Pool;
  runId: string;
  jobId: string;
  input: CompetitorPricingInputRow;
  jobs: Pick<JobServices, "runJob" | "getResults">;
}) {
  try {
    await args.pool.query(
      `UPDATE product_price_match_runs SET status = 'running', started_at = now() WHERE id = $1`,
      [args.runId]
    );
    await args.jobs.runJob(args.jobId);
    const results = await args.jobs.getResults(args.jobId);
    const result = results[0];
    if (!result) throw new Error("Price-match job completed without a result");
    assertResultIdentity(args.input, result);
    await args.pool.query(
      `
        UPDATE product_price_match_runs
        SET status = 'completed', result_json = $2::jsonb, checked_at = $3, completed_at = now(), error = NULL
        WHERE id = $1
      `,
      [args.runId, JSON.stringify(result), result.checkedAt || new Date().toISOString()]
    );
  } catch (error: any) {
    const message = String(error?.message || error || "Price-match run failed").slice(0, 4000);
    await persistRunFailure(args.pool, args.runId, message);
    throw error;
  }
}

export function registerProductPriceMatchRoutes({ app, pool, jobs: overrides }: RegisterProductPriceMatchRoutesDeps) {
  const jobs: JobServices = {
    createJob: overrides?.createJob || createCompetitorPricingJob,
    getResults: overrides?.getResults || getCompetitorPricingResults,
    runJob: overrides?.runJob || runCompetitorPricingJob,
    enqueue: overrides?.enqueue || defaultEnqueue,
  };

  app.get("/api/manufacturer-pricebooks/catalog/:itemId/price-match-runs", async (req, res) => {
    const itemId = String(req.params.itemId || "");
    if (!/^\d+$/.test(itemId)) return res.status(400).json({ ok: false, error: "Invalid catalog item id" });
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
    const [historyResult, successResult] = await Promise.all([
      pool.query(
        `
          SELECT id, catalog_item_id, manufacturer, manufacturer_slug, sku, description, selling_price,
                 status, job_id, result_json, error, requested_by_user_id, created_at, started_at, completed_at, checked_at
          FROM product_price_match_runs
          WHERE catalog_item_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `,
        [itemId, limit]
      ),
      pool.query(
        `
          SELECT id, catalog_item_id, manufacturer, manufacturer_slug, sku, description, selling_price,
                 status, job_id, result_json, error, requested_by_user_id, created_at, started_at, completed_at, checked_at
          FROM product_price_match_runs
          WHERE catalog_item_id = $1 AND status = 'completed'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [itemId]
      ),
    ]);
    res.json({ ok: true, ...summarizeRuns(historyResult.rows, successResult.rows[0]) });
  });

  app.post("/api/manufacturer-pricebooks/catalog/:itemId/price-match-runs", async (req, res) => {
    const itemId = String(req.params.itemId || "");
    if (!/^\d+$/.test(itemId)) return res.status(400).json({ ok: false, error: "Invalid catalog item id" });
    const sellingPrice = Number(req.body?.sellingPrice);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0 || sellingPrice > 1_000_000) {
      return res.status(400).json({ ok: false, error: "A valid sellingPrice is required" });
    }

    const productResult = await pool.query(
      `SELECT id, manufacturer, manufacturer_slug, sku, description FROM manufacturer_catalog_items WHERE id = $1 LIMIT 1`,
      [itemId]
    );
    const product = productResult.rows[0];
    if (!product) return res.status(404).json({ ok: false, error: "Catalog item not found" });
    if (!normalizeSku(product.sku) || !normalizeManufacturer(product.manufacturer)) {
      return res.status(422).json({ ok: false, error: "The selected item needs both a manufacturer and SKU before price matching" });
    }

    const recentResult = await pool.query(
      `
        SELECT id, status, created_at
        FROM product_price_match_runs
        WHERE catalog_item_id = $1
          AND (status IN ('queued', 'running') OR created_at > now() - ($2 * interval '1 second'))
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [itemId, RUN_COOLDOWN_SECONDS]
    );
    if (recentResult.rows[0]) {
      const active = ["queued", "running"].includes(String(recentResult.rows[0].status));
      return res.status(active ? 409 : 429).json({
        ok: false,
        error: active
          ? "A price match is already queued or running for this item"
          : `Please wait ${RUN_COOLDOWN_SECONDS} seconds between price-match runs for the same item`,
      });
    }

    const runId = crypto.randomUUID();
    const input = buildInputRow(product, sellingPrice);
    const userId = /^\d+$/.test(String((req as any).authUser?.id || "")) ? String((req as any).authUser.id) : null;
    let insertResult;
    try {
      insertResult = await pool.query(
        `
          INSERT INTO product_price_match_runs (
            id, catalog_item_id, manufacturer, manufacturer_slug, sku, normalized_sku, description,
            selling_price, status, requested_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', $9)
          RETURNING id, catalog_item_id, manufacturer, manufacturer_slug, sku, description, selling_price,
                    status, job_id, result_json, error, requested_by_user_id, created_at, started_at, completed_at, checked_at
        `,
        [
          runId,
          itemId,
          input.vendor,
          String(product.manufacturer_slug || ""),
          input.sku,
          normalizeSku(input.sku),
          input.description,
          sellingPrice,
          userId,
        ]
      );
    } catch (error: any) {
      if (String(error?.code || "") === "23505") {
        return res.status(429).json({
          ok: false,
          error: "Another Price Match is already queued or running; wait for it to finish and try again",
        });
      }
      throw error;
    }

    try {
      const job = await jobs.createJob({ rows: [input], mode: input.bucket === "ashley" ? "ashley_only" : "non_ashley_first" });
      await pool.query(`UPDATE product_price_match_runs SET job_id = $2 WHERE id = $1`, [runId, job.jobId]);
      jobs.enqueue(() => executeProductPriceMatchRun({ pool, runId, jobId: job.jobId, input, jobs }));
      return res.status(202).json({ ok: true, run: { ...mapRunRow(insertResult.rows[0]), jobId: job.jobId } });
    } catch (error: any) {
      const message = String(error?.message || error || "Could not queue price match").slice(0, 4000);
      await pool.query(
        `UPDATE product_price_match_runs SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`,
        [runId, message]
      );
      return res.status(500).json({ ok: false, error: message });
    }
  });
}

export const __testing = {
  RUN_COOLDOWN_SECONDS,
  assertResultIdentity,
  buildInputRow,
  executeProductPriceMatchRun,
  mapRunRow,
  normalizeManufacturer,
  normalizeSku,
  summarizeRuns,
};
