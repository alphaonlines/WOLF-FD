import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { registerSalesAnalysisRoutes } from "./salesAnalysisRoutes";

const pool = (responses: any[][]) => ({
  query: vi.fn().mockImplementation(async () => ({ rows: responses.shift() || [] })),
}) as any;

const appWithUser = (db: any, user: any) => {
  const app = express();
  app.use((req, _res, next) => { (req as any).authUser = user; next(); });
  app.use(express.json());
  registerSalesAnalysisRoutes({ app, pool: db });
  return app;
};

const salesUser = { id: "7", roles: ["Sales"], permissions: ["module.sales"] };

describe("canonical Sales Analysis routes", () => {
  it("returns newest delivered bounds", async () => {
    const db = pool([[{ delivered_date_min: "2026-07-01", delivered_date_max: "2026-07-31" }]]);
    const app = appWithUser(db, salesUser);
    const response = await request(app).get("/api/sales-analysis/range");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deliveredDateMin: "2026-07-01", deliveredDateMax: "2026-07-31" });
    expect(db.query.mock.calls[0][0]).toContain("delivery_confirmed_date IS NOT NULL");
  });

  it("validates exclusive ranges and paging", async () => {
    const db = pool([]);
    const app = appWithUser(db, salesUser);
    expect((await request(app).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-07-01&page=1&page_size=100")).status).toBe(400);
    expect((await request(app).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01&page=0&page_size=100")).status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("returns delivered summary/detail without selecting PII", async () => {
    const db = pool([]);
    db.query
      .mockResolvedValueOnce({ rows: [{ item_sales: "500", ticket_total: "1000", ticket_count: "1", item_count: "1", quantity: "2", known_cost_sales: "0", cost: "0", profit: "0", finance_amount: "200", finance_fee: "10", financed_ticket_count: "1", eligible_sales: "500", pro_sales: "0", missing_costs: "1", open_tickets: "1", two_person_tickets: "1", duplicate_lines: "0", unallocated_ticket_total: "1000" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({ rows: [{ sale_id: "100", delivered_date: "2026-07-10", status: "Open", store: "FD7", salesperson: "A and B", manufacturer: "Acme", category: "Living Room", item_no: "1", description: "Sofa", quantity: "2", sales: "500", cost: null, profit: null, cost_source: "unknown", duplicate_warning: false }] });
    const app = appWithUser(db, salesUser);
    const response = await request(app).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01&page=1&page_size=100");
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ itemSales: 500, ticketCount: 1, financeAmount: 200, financeFee: 10 });
    expect(response.body.missingCosts.count).toBe(1);
    expect(response.body.warnings.openDeliveredTickets).toBe(1);
    const sql = db.query.mock.calls.map((call: any[]) => call[0]).join("\n");
    expect(sql).toContain("s.delivery_confirmed_date >= $1");
    expect(sql).toContain("s.delivery_confirmed_date < $2");
    expect(sql).toContain("i.total_cost");
    expect(sql).toContain("i.total_profit");
    expect(sql).not.toMatch(/customer_name|phone|email/i);
  });

  it.each([
    "/api/sales-analysis/range",
    "/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01",
    "/api/sales-analysis/detail?start=2026-07-01&end_exclusive=2026-08-01",
    "/api/sales-analysis/admin/cost-overrides",
    "/api/sales-analysis/direct?start=2026-07-01&end_exclusive=2026-08-01",
  ])("returns 403 without module.sales on %s", async (path) => {
    const response = await request(appWithUser(pool([]), { id: "9", roles: ["Owner"], permissions: [] })).get(path);
    expect(response.status).toBe(403);
  });

  it("uses store plus sale identity and a separate stable count and LIMIT/OFFSET detail query", async () => {
    const db = pool([]);
    db.query
      .mockResolvedValueOnce({ rows: [{ sale_id: "100", delivered_date: "2026-07-10", status: "Delivered", store: "FD7", salesperson: "Solo", grand_total: "1", finance_amount: "0", finance_fee: "0" }] })
      .mockResolvedValueOnce({ rows: [{ row_id: "x", sale_id: "100", delivered_date: "2026-07-10", store: "FD7", manufacturer: "A", category: "C", item_no: "1", description: "S", quantity: "1", sales: "1", total_cost: null, total_profit: null }] })
      .mockResolvedValueOnce({ rows: [{ total: "251" }] })
      .mockResolvedValueOnce({ rows: [{ row_id: "page-x", sale_id: "100", delivered_date: "2026-07-10", store: "FD7", manufacturer: "A", category: "C", item_no: "1", description: "S", quantity: "1", sales: "1", total_cost: null, total_profit: null }] });
    const response = await request(appWithUser(db, salesUser)).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01&page=3&page_size=100");
    expect(response.status).toBe(200);
    expect(response.body.detail).toMatchObject({ total: 251, page: 3, pageSize: 100 });
    const sql = db.query.mock.calls.map((call: any[]) => String(call[0]));
    expect(sql.join("\n")).toMatch(/s\.location\s*=\s*i\.location|i\.location\s*=\s*s\.location/i);
    expect(sql.some((value: string) => /COUNT\(\*\)/i.test(value))).toBe(true);
    expect(sql.some((value: string) => /LIMIT\s+\$\d+\s+OFFSET\s+\$\d+/i.test(value))).toBe(true);
  });

  it("passes stable shared filter parameters to database-side report queries", async () => {
    const db = pool([]);
    db.query.mockResolvedValue({ rows: [] });
    await request(appWithUser(db, salesUser)).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01&manufacturer=Acme&store=FD7");
    expect(db.query.mock.calls[0][1]).toEqual(["2026-07-01", "2026-08-01", null, "acme", "fd7"]);
    expect(db.query.mock.calls[1][1]).toEqual(["2026-07-01", "2026-08-01", null, "acme", "fd7"]);
  });

  it("rejects unbounded raw item SQL and proves full summary is independent of the page", async () => {
    const db = pool([]);
    db.query.mockImplementation(async (sql: string, params: any[]) => {
      if (/SELECT\s+delivered_date,sale_id,status,store/i.test(sql) && !/LIMIT\s+\$\d+\s+OFFSET\s+\$\d+/i.test(sql)) throw new Error("unbounded raw ITEM_SELECT");
      if (/item_sales/.test(sql)) return { rows: [{ item_sales: "98765.43", item_count: "1201", quantity: "1300", known_cost_sales: "90000", cost: "60000", profit: "30000", missing_costs: "7", eligible_sales: "80000", pro_sales: "8000", ticket_total: "99000", ticket_count: "801", finance_amount: "40000", finance_fee: "1000", financed_ticket_count: "300", open_tickets: "4", two_person_tickets: "12", unallocated_ticket_total: "99000", duplicate_lines: "3" }] };
      if (/SELECT dimension,label/.test(sql)) return { rows: [{ dimension: "store", label: "FD7", sales: "98765.43", quantity: "1300", cost: "60000", known_cost_sales: "90000", profit: "30000" }] };
      if (/COUNT\(\*\)::text total FROM filtered/.test(sql)) return { rows: [{ total: "1201" }] };
      expect(params.slice(-2)).toEqual([25, 50]);
      return { rows: [{ delivered_date: "2026-07-31", sale_id: "page-only", status: "Delivered", store: "FD7", salesperson: "Solo", manufacturer: "Acme", category: "Living", item_no: "S1", description: "Sofa", quantity: "1", sales: "50", cost: "25", profit: "25", cost_source: "group_report", duplicate_warning: false }] };
    });
    const response = await request(appWithUser(db, salesUser)).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01&page=3&page_size=25");
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ itemSales: 98765.43, itemCount: 1201, ticketCount: 801 });
    expect(response.body.detail).toMatchObject({ total: 1201, page: 3, pageSize: 25 });
    expect(response.body.detail.rows).toHaveLength(1);
    expect(db.query).toHaveBeenCalledTimes(4);
  });

  it("uses Group Report, immutable import provenance, override, then unknown cost precedence", async () => {
    const db = pool([]);
    db.query.mockResolvedValue({ rows: [] });
    await request(appWithUser(db, salesUser)).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01");
    const sql = db.query.mock.calls.map((call: any[]) => String(call[0])).join("\n");
    expect(sql).toContain("group_report");
    expect(sql).toMatch(/CASE[\s\S]*group_report[\s\S]*cost_import_batch_id\s+IS\s+NOT\s+NULL[\s\S]*cost_source_file_sha256\s+IS\s+NOT\s+NULL[\s\S]*cost_imported_at\s+IS\s+NOT\s+NULL[\s\S]*manual_override/i);
    expect(sql).toMatch(/['\"]imported['\"]/i);
    expect(sql).not.toMatch(/top items.{0,30}(authority|authoritative)/i);
  });

  it("allocates every item dimension with the same deterministic salesperson share as summary", async () => {
    const db = pool([]);
    db.query.mockResolvedValue({ rows: [] });
    await request(appWithUser(db, salesUser)).get("/api/sales-analysis/report?start=2026-07-01&end_exclusive=2026-08-01&salesperson=Smith%2C%20Jane");
    const seriesSql = String(db.query.mock.calls[1][0]);
    const itemSeries = seriesSql.slice(seriesSql.indexOf("item_series AS"), seriesSql.indexOf("people AS"));
    expect(itemSeries).toMatch(/sum\s*\(\s*CASE WHEN \$3::text IS NULL THEN sales ELSE/i);
    expect(itemSeries).toMatch(/sum\s*\(\s*CASE WHEN \$3::text IS NULL THEN quantity ELSE/i);
    expect(itemSeries).toMatch(/sum\s*\(\s*CASE WHEN \$3::text IS NULL THEN total_cost ELSE/i);
    expect(itemSeries).toMatch(/sum\s*\(\s*CASE WHEN \$3::text IS NULL THEN total_profit ELSE/i);
  });

  it("restricts audited override mutation to Admin/Owner and same origin", async () => {
    const body = { store: "FD7", saleId: "100", rowId: "row-1", totalCost: "12.34", reason: "invoice correction" };
    expect((await request(appWithUser(pool([]), salesUser)).post("/api/sales-analysis/admin/cost-overrides").set("Origin", "https://example.test").set("Host", "example.test").send(body)).status).toBe(403);
    const owner = { id: "1", roles: ["Owner"], permissions: ["module.sales"] };
    expect((await request(appWithUser(pool([]), owner)).post("/api/sales-analysis/admin/cost-overrides").set("Origin", "https://evil.test").set("Host", "example.test").send(body)).status).toBe(403);
    const db = pool([[{ id: "1", store: "FD7", sale_id: "100", row_id: "row-1", total_cost: "12.34", reason: "invoice correction", actor_user_id: "1", created_at: "2026-08-13T12:00:00Z", superseded_at: null }]]);
    const ok = await request(appWithUser(db, owner)).post("/api/sales-analysis/admin/cost-overrides").set("Origin", "http://example.test").set("Host", "example.test").send(body);
    expect(ok.status).toBe(200);
    expect(db.query.mock.calls[0][0]).toMatch(/replace_sales_cost_override/i);
    expect(db.query.mock.calls[0][1]).toContain("invoice correction");
    expect(typeof db.query.mock.calls[0][1][5]).toBe("number");
  });
});
