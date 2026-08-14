import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { __testing, registerProductPriceMatchRoutes } from "./productPriceMatchRoutes";
import type { CompetitorPricingInputRow } from "../competitorPricing/types";

function buildApp(pool: any, jobs?: any) {
  const app = express();
  app.use(express.json());
  registerProductPriceMatchRoutes({ app, pool, jobs });
  return app;
}

describe("product price-match routes", () => {
  it("returns the latest failed attempt while retaining the previous completed result", async () => {
    const completedResult = { vendor: "Jackson", sku: "CAT-100", checkedAt: "2026-07-20T12:00:00.000Z" };
    const historyRows = [
      {
        id: "run-new",
        catalog_item_id: "44",
        manufacturer: "Jackson",
        manufacturer_slug: "jackson",
        sku: "CAT-100",
        status: "failed",
        error: "upstream timeout",
        created_at: "2026-07-21T12:00:00.000Z",
      },
      {
        id: "run-old",
        catalog_item_id: "44",
        manufacturer: "Jackson",
        manufacturer_slug: "jackson",
        sku: "CAT-100",
        status: "completed",
        result_json: completedResult,
        created_at: "2026-07-20T12:00:00.000Z",
        checked_at: "2026-07-20T12:00:00.000Z",
      },
    ];
    const pool = {
      query: vi.fn(async (sql: string) => ({
        rows: sql.includes("status = 'completed'") ? [historyRows[1]] : historyRows,
      })),
    };

    const response = await request(buildApp(pool)).get(
      "/api/manufacturer-pricebooks/catalog/44/price-match-runs"
    );

    expect(response.status).toBe(200);
    expect(response.body.latestAttempt).toMatchObject({ id: "run-new", status: "failed" });
    expect(response.body.lastSuccess).toMatchObject({
      id: "run-old",
      status: "completed",
      result: completedResult,
    });
    expect(response.body.history).toHaveLength(2);
  });

  it("queues exactly the selected catalog item with its supplied selling price", async () => {
    const queries: Array<{ sql: string; values: any[] }> = [];
    const pool = {
      query: vi.fn(async (sql: string, values: any[] = []) => {
        queries.push({ sql, values });
        if (sql.includes("FROM manufacturer_catalog_items")) {
          return {
            rows: [{
              id: "44",
              manufacturer: "Jackson Furniture",
              manufacturer_slug: "jackson-furniture",
              sku: " CAT-100 ",
              description: "Catnapper recliner",
            }],
          };
        }
        if (sql.includes("status IN ('queued', 'running')")) return { rows: [] };
        if (sql.includes("INSERT INTO product_price_match_runs")) {
          return {
            rows: [{
              id: values[0],
              catalog_item_id: "44",
              manufacturer: values[2],
              manufacturer_slug: values[3],
              sku: values[4],
              description: values[6],
              selling_price: values[7],
              status: "queued",
              created_at: "2026-07-26T12:00:00.000Z",
            }],
          };
        }
        return { rows: [] };
      }),
    };
    const createJob = vi.fn().mockResolvedValue({ jobId: "job-1" });
    const enqueue = vi.fn();

    const response = await request(buildApp(pool, {
      createJob,
      enqueue,
      getResults: vi.fn(),
      runJob: vi.fn(),
    }))
      .post("/api/manufacturer-pricebooks/catalog/44/price-match-runs")
      .send({ sellingPrice: 1299.99 });

    expect(response.status).toBe(202);
    expect(response.body.run).toMatchObject({ catalogItemId: "44", status: "queued", jobId: "job-1" });
    expect(createJob).toHaveBeenCalledTimes(1);
    expect(createJob.mock.calls[0][0]).toMatchObject({
      mode: "non_ashley_first",
      rows: [{
        vendor: "Jackson Furniture",
        sku: "CAT-100",
        description: "Catnapper recliner",
        storePrice: "$1299.99",
      }],
    });
    expect(createJob.mock.calls[0][0].rows).toHaveLength(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(queries.some((query) => query.sql.includes("INSERT INTO product_price_match_runs"))).toBe(true);
  });

  it("uses the Ashley-only job mode for an Ashley catalog item", async () => {
    const pool = {
      query: vi.fn(async (sql: string, values: any[] = []) => {
        if (sql.includes("FROM manufacturer_catalog_items")) {
          return { rows: [{
            id: "45",
            manufacturer: "Ashley Furniture",
            manufacturer_slug: "ashley-furniture",
            sku: "B070-71/96",
            description: "Trentlore bed",
          }] };
        }
        if (sql.includes("status IN ('queued', 'running')")) return { rows: [] };
        if (sql.includes("INSERT INTO product_price_match_runs")) {
          return { rows: [{
            id: values[0], catalog_item_id: "45", manufacturer: values[2], manufacturer_slug: values[3],
            sku: values[4], description: values[6], selling_price: values[7], status: "queued",
            created_at: "2026-07-26T12:00:00.000Z",
          }] };
        }
        return { rows: [] };
      }),
    };
    const createJob = vi.fn().mockResolvedValue({ jobId: "job-ashley" });

    const response = await request(buildApp(pool, {
      createJob,
      enqueue: vi.fn(),
      getResults: vi.fn(),
      runJob: vi.fn(),
    }))
      .post("/api/manufacturer-pricebooks/catalog/45/price-match-runs")
      .send({ sellingPrice: 899.99 });

    expect(response.status).toBe(202);
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ashley_only",
      rows: [expect.objectContaining({ sku: "B070-71/96", bucket: "ashley" })],
    }));
  });

  it("rejects invalid item ids and selling prices before creating a job", async () => {
    const pool = { query: vi.fn() };
    const createJob = vi.fn();
    const app = buildApp(pool, { createJob });

    const invalidId = await request(app)
      .post("/api/manufacturer-pricebooks/catalog/not-an-id/price-match-runs")
      .send({ sellingPrice: 100 });
    const invalidPrice = await request(app)
      .post("/api/manufacturer-pricebooks/catalog/44/price-match-runs")
      .send({ sellingPrice: 0 });

    expect(invalidId.status).toBe(400);
    expect(invalidPrice.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
    expect(createJob).not.toHaveBeenCalled();
  });

  it("rejects a new run while another Price Match is active globally", async () => {
    const duplicateError = Object.assign(new Error("duplicate key"), { code: "23505" });
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM manufacturer_catalog_items")) {
          return {
            rows: [{
              id: "44",
              manufacturer: "Jackson Furniture",
              manufacturer_slug: "jackson-furniture",
              sku: "CAT-100",
              description: "Catnapper recliner",
            }],
          };
        }
        if (sql.includes("status IN ('queued', 'running')")) return { rows: [] };
        if (sql.includes("INSERT INTO product_price_match_runs")) throw duplicateError;
        return { rows: [] };
      }),
    };
    const createJob = vi.fn();

    const response = await request(buildApp(pool, { createJob }))
      .post("/api/manufacturer-pricebooks/catalog/44/price-match-runs")
      .send({ sellingPrice: 1299.99 });

    expect(response.status).toBe(429);
    expect(response.body.error).toContain("already queued or running");
    expect(createJob).not.toHaveBeenCalled();
  });

  it("marks only the failed attempt when a refresh fails", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const input: CompetitorPricingInputRow = {
      sourceRow: 0,
      vendor: "Jackson",
      sku: "CAT-100",
      description: "Recliner",
      storePriceText: "$999.99",
      storePrice: "$999.99",
      regularPrice: "",
      existingAhsCompPrice: "",
      existingFflCompPrice: "",
      remarks: "",
      bucket: "non_ashley",
      rowNotes: [],
    };

    await expect(__testing.executeProductPriceMatchRun({
      pool: { query } as any,
      runId: "failed-refresh-id",
      jobId: "job-2",
      input,
      jobs: {
        runJob: vi.fn().mockRejectedValue(new Error("crawler unavailable")),
        getResults: vi.fn(),
      },
    })).rejects.toThrow("crawler unavailable");

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain("WHERE id = $1");
    expect(query.mock.calls[1][1]).toEqual(["failed-refresh-id", "crawler unavailable"]);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("DELETE"))).toBe(false);
  });

  it("rejects a result whose SKU or manufacturer does not match the selected item", () => {
    const input = __testing.buildInputRow({
      manufacturer: "Jackson Furniture",
      manufacturer_slug: "jackson-furniture",
      sku: "CAT-100",
      description: "Recliner",
    }, 999.99);
    expect(() => __testing.assertResultIdentity(input, {
      vendor: "Ashley",
      sku: "WRONG-200",
    } as any)).toThrow("SKU did not match");
  });
});
