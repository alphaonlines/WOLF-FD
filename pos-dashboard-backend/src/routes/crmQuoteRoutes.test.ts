import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerCrmQuoteRoutes } from "./crmQuoteRoutes";

type QueryCall = { sql: string; params: any[] };

type MockClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  release: () => void;
};

type MockPool = {
  connect: () => Promise<MockClient>;
};

type MockQuoteScenario = {
  byPhoneRows?: any[];
  byEmailRows?: any[];
  crmCustomerRows?: any[];
  salesRows?: any[];
  upsVisitRows?: any[];
  upsNameRows?: any[];
  quoteRow?: any;
};

function createMockPool(scenario: MockQuoteScenario = {}) {
  const calls: QueryCall[] = [];
  const client: MockClient = {
    async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
      calls.push({ sql, params });

      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (
        sql.includes("SELECT id, name, phone, email") &&
        sql.includes("crm_customers") &&
        sql.includes("regexp_replace")
      ) {
        return { rows: scenario.byPhoneRows || [] };
      }

      if (
        sql.includes("SELECT id, name, phone, email") &&
        sql.includes("crm_customers") &&
        sql.includes("lower(COALESCE(email")
      ) {
        return { rows: scenario.byEmailRows || [] };
      }

      if (sql.includes("INSERT INTO crm_customers")) {
        const row = scenario.crmCustomerRows?.[0] || {
          id: params[0],
          name: params[1],
          phone: params[2],
          email: params[3],
        };
        return { rows: [row] };
      }

      if (
        sql.includes("SELECT sale_id, customer_name, phone, grand_total, sale_date") &&
        sql.includes("FROM pos_sales")
      ) {
        return { rows: scenario.salesRows || [] };
      }

      if (
        sql.includes("SELECT id, store, customer, phone, email, started_at") &&
        sql.includes("FROM crm_ups_history") &&
        (sql.includes("regexp_replace") || sql.includes("lower(COALESCE(email"))
      ) {
        return { rows: scenario.upsVisitRows || [] };
      }

      if (
        sql.includes("SELECT id, store, customer, phone, email, started_at") &&
        sql.includes("FROM crm_ups_history") &&
        sql.includes("lower(COALESCE(customer")
      ) {
        return { rows: scenario.upsNameRows || [] };
      }

      if (sql.includes("INSERT INTO crm_customer_quotes")) {
        const quote = scenario.quoteRow || {
          id: params[0],
          customer_id: params[1],
          quote_total: params[9],
          quote_valid_until: params[14] || null,
        };
        return { rows: [quote] };
      }

      return { rows: [] };
    },

    release() {},
  };

  return {
    calls,
    pool: {
      connect: async () => client,
    } as MockPool,
  };
}

function createApp(pool: MockPool, withAuth = true) {
  const app = express();
  app.use(express.json());

  if (withAuth) {
    app.use((req, _res, next) => {
      (req as any).authUser = {
        id: "99",
        name: "CRM Operator",
        email: "operator@wolf.local",
      };
      next();
    });
  }

  registerCrmQuoteRoutes(app, pool as any);
  return app;
}

describe("crm quote routes", () => {
  it("returns 401 for missing auth user", async () => {
    const { pool } = createMockPool();
    const app = createApp(pool, false);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "Jane",
        last_name: "Doe",
        phone: "(555) 111-2222",
      },
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "unauthorized" });
  });

  it("also exposes the quote endpoint at the public proxy path", async () => {
    const { pool } = createMockPool();
    const app = createApp(pool, false);

    const response = await request(app).post("/crm/quotes").send({
      customer: {
        first_name: "Jane",
        last_name: "Doe",
        phone: "(555) 111-2222",
      },
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "unauthorized" });
  });

  it("returns 400 when first or last name is missing", async () => {
    const { pool } = createMockPool();
    const app = createApp(pool);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "",
        last_name: "",
        phone: "(555) 111-2222",
        email: "jane@example.com",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "first_name and last_name are required" });
  });

  it("returns 400 when both phone and email are blank", async () => {
    const { pool } = createMockPool();
    const app = createApp(pool);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "Jane",
        last_name: "Doe",
        phone: "   ",
        email: "   ",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "phone or email is required" });
  });

  it("upserts customer and inserts quote", async () => {
    const { pool, calls } = createMockPool({});
    const app = createApp(pool);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "Jane",
        last_name: "Doe",
        phone: "(555) 111-2222",
        email: "jane@example.com",
      },
      quote: {
        store: "FD7",
        source_context: "quick-estimate",
        quote_total: 100,
        subtotal_before_tax: 90,
        tax_amount: 10,
        discount_total: 0,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      customer: {
        name: "Jane Doe",
        phone: "(555) 111-2222",
        email: "jane@example.com",
      },
      quote: {
        quote_total: 100,
      },
      matches: {
        salesOrders: [],
        upsVisits: [],
      },
    });

    const customerInsert = calls.find((call) => call.sql.includes("INSERT INTO crm_customers"));
    const quoteInsert = calls.find((call) => call.sql.includes("INSERT INTO crm_customer_quotes"));
    expect(customerInsert).toBeTruthy();
    expect(quoteInsert).toBeTruthy();

    expect(customerInsert?.params[1]).toBe("Jane Doe");
    expect(customerInsert?.params[2]).toBe("(555) 111-2222");
    expect(customerInsert?.params[3]).toBe("jane@example.com");
    expect(quoteInsert?.sql).toContain("INSERT INTO crm_customer_quotes");
  });

  it("reuses an existing customer id when phone normalizes to an existing record", async () => {
    const { pool, calls } = createMockPool({
      byPhoneRows: [
        {
          id: "cust-existing",
          name: "Existing Customer",
          phone: "(555) 111-2222",
          email: "old@example.com",
        },
      ],
      crmCustomerRows: [
        {
          id: "cust-existing",
          name: "Existing Customer",
          phone: "(555) 111-2222",
          email: "old@example.com",
        },
      ],
    });
    const app = createApp(pool);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "Jane",
        last_name: "Roe",
        phone: "+1 (555) 111-2222",
        email: "",
      },
      quote: {
        quote_total: 49,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.customer.id).toBe("cust-existing");
    const quoteInsert = calls.find((call) => call.sql.includes("INSERT INTO crm_customer_quotes"));
    expect(quoteInsert?.params[1]).toBe("cust-existing");

    const byPhoneCall = calls.find((call) =>
      call.sql.includes("SELECT id, name, phone, email") &&
      call.sql.includes("regexp_replace")
    );
    expect(byPhoneCall?.params).toEqual(["5551112222"]);
  });

  it("includes sales order matches for phone lookup", async () => {
    const { pool, calls } = createMockPool({
      salesRows: [
        {
          sale_id: "SO-001",
          customer_name: "Jane Roe",
          phone: "(555) 333-4444",
          grand_total: 250,
          sale_date: "2026-05-27T14:00:00.000Z",
        },
      ],
    });
    const app = createApp(pool);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "Jane",
        last_name: "Roe",
        phone: "(555) 333-4444",
        email: "",
      },
      quote: {
        quote_total: 50,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.matches.salesOrders).toHaveLength(1);
    expect(response.body.matches.salesOrders[0]).toMatchObject({
      sale_id: "SO-001",
      customer_name: "Jane Roe",
      match_confidence: "high",
    });

    const salesQuery = calls.find((call) =>
      call.sql.includes("SELECT sale_id, customer_name, phone, grand_total, sale_date") &&
      call.sql.includes("FROM pos_sales")
    );
    expect(salesQuery?.params[0]).toBe("5553334444");
  });

  it("includes ups matches for phone/email lookup", async () => {
    const { pool, calls } = createMockPool({
      upsVisitRows: [
        {
          id: "ups-001",
          customer: "Jane Roe",
          phone: "(555) 555-6677",
          email: "jane.roe@example.com",
          store: "FD7",
          started_at: "2026-05-27T10:11:12.000Z",
        },
      ],
    });
    const app = createApp(pool);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "Jane",
        last_name: "Roe",
        phone: "(555) 555-6677",
        email: "jane.roe@example.com",
      },
      quote: {
        quote_total: 75,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.matches.upsVisits).toHaveLength(1);
    expect(response.body.matches.upsVisits[0]).toMatchObject({
      id: "ups-001",
      customer: "Jane Roe",
      email: "jane.roe@example.com",
      match_confidence: "high",
    });

    const upsQuery = calls.find((call) =>
      call.sql.includes("FROM crm_ups_history") &&
      call.sql.includes("lower(COALESCE(email") &&
      !call.sql.includes("lower(COALESCE(customer")
    );
    expect(upsQuery?.params).toEqual(["5555556677", "jane.roe@example.com"]);
  });

  it("does not wildcard all UPS phone rows for email-only lookup", async () => {
    const { pool, calls } = createMockPool({
      upsVisitRows: [
        {
          id: "ups-email-001",
          customer: "Email Only",
          phone: "",
          email: "email.only@example.com",
          store: "FD7",
          started_at: "2026-05-27T10:11:12.000Z",
        },
      ],
    });
    const app = createApp(pool);

    const response = await request(app).post("/api/crm/quotes").send({
      customer: {
        first_name: "Email",
        last_name: "Only",
        phone: "",
        email: "email.only@example.com",
      },
      quote: {
        quote_total: 88,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.matches.upsVisits).toHaveLength(1);

    const upsQuery = calls.find((call) =>
      call.sql.includes("FROM crm_ups_history") &&
      call.sql.includes("lower(COALESCE(email") &&
      !call.sql.includes("lower(COALESCE(customer")
    );
    expect(upsQuery?.sql).not.toContain("regexp_replace");
    expect(upsQuery?.params).toEqual(["email.only@example.com"]);
  });
});
