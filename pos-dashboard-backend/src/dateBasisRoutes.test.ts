import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { registerAnalyticsRoutes } from "./routes/analyticsRoutes";
import { registerItemProRoutes } from "./routes/itemProRoutes";
import { registerReportRoutes } from "./routes/reportRoutes";

const defaultItemDateField = "delivery_confirmed_date";
const defaultPrefixedDateField = (tableAlias: string) => `${tableAlias}.delivery_confirmed_date`;

const makeQuery = () => vi.fn(async (..._args: [string, unknown[]?]) => ({ rows: [] as any[] }));

const firstSql = (query: ReturnType<typeof makeQuery>): string => String((query.mock.calls[0] as [string, unknown[]?])[0]);
const allSql = (query: ReturnType<typeof makeQuery>): string =>
  query.mock.calls.map((call) => String((call as [string, unknown[]?])[0])).join("\n---\n");

describe("POS route date_basis handling", () => {
  it("uses delivered dates by default and written sale dates when requested for summary analytics", async () => {
    const query = makeQuery();
    const app = express();
    registerAnalyticsRoutes({
      app,
      pool: { query } as any,
      itemDateField: defaultItemDateField,
      prefixedDateField: defaultPrefixedDateField,
    });

    const deliveredResponse = await request(app).get("/api/summary?start=2026-06-01&end=2026-07-01");
    expect(deliveredResponse.status).toBe(200);
    expect(firstSql(query)).toContain("s.delivery_confirmed_date >= $1");

    query.mockClear();
    const writtenResponse = await request(app).get("/api/summary?start=2026-06-01&end=2026-07-01&date_basis=written");
    expect(writtenResponse.status).toBe(200);
    const writtenSql = firstSql(query);
    expect(writtenSql).toContain("s.sale_date >= $1");
    expect(writtenSql).toContain("i.sale_date >= $1");
    expect(writtenSql).not.toContain("s.delivery_confirmed_date >= $1");
    expect(writtenSql).not.toContain("i.delivery_confirmed_date >= $1");
  });

  it("uses written item sale dates for leaderboard item rollups when date_basis=written", async () => {
    const query = makeQuery();
    const app = express();
    registerAnalyticsRoutes({
      app,
      pool: { query } as any,
      itemDateField: defaultItemDateField,
      prefixedDateField: defaultPrefixedDateField,
    });

    const response = await request(app).get("/api/leaderboard?start=2026-06-01&end=2026-07-01&date_basis=written");
    expect(response.status).toBe(200);
    const sql = firstSql(query);
    expect(sql).toContain("i.sale_date >= $1");
    expect(sql).toContain("s.sale_date >= $1");
    expect(sql).not.toContain("i.delivery_confirmed_date >= $1");
    expect(sql).not.toContain("s.delivery_confirmed_date >= $1");
  });

  it("uses written sale dates for item analytics when date_basis=written", async () => {
    const query = makeQuery();
    const app = express();
    registerItemProRoutes({
      app,
      pool: { query } as any,
      itemDateField: defaultItemDateField,
      prefixedDateField: defaultPrefixedDateField,
    });

    const response = await request(app).get("/api/items/best-sellers?start=2026-06-01&end=2026-07-01&date_basis=written");
    expect(response.status).toBe(200);
    const sql = firstSql(query);
    expect(sql).toContain("WHERE sale_date >= $1");
    expect(sql).not.toContain("WHERE delivery_confirmed_date >= $1");
  });

  it("uses written sale dates for the full sales report when date_basis=written", async () => {
    const query = makeQuery();
    const app = express();
    registerReportRoutes({
      app,
      pool: { query } as any,
      prefixedDateField: defaultPrefixedDateField,
    });

    const response = await request(app).get("/api/report/sales-summary?start=2026-06-01&end=2026-07-01&date_basis=written");
    expect(response.status).toBe(200);
    const combinedSql = allSql(query);
    expect(combinedSql).toContain("s.sale_date >= $1");
    expect(combinedSql).not.toContain("s.delivery_confirmed_date >= $1");
  });
});
