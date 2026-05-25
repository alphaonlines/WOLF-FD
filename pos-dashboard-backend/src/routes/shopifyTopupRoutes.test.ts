import express from "express";
import request from "supertest";
import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { registerShopifyTopupRoutes } from "./shopifyTopupRoutes";

type QueryCall = { sql: string; params: any[] };

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(Buffer.from(body)).digest("base64");
}

function createTestApp(pool: { query: (sql: string, params?: any[]) => Promise<any> }, secret = "test_secret") {
  const app = express();
  registerShopifyTopupRoutes({
    app,
    pool: pool as any,
    webhookPath: "/api/shopify/topup/webhook",
    webhookSecret: secret,
    defaultModelKey: "local",
    variantPackConfigJson: "",
  });
  return app;
}

function createAutoCreditPool() {
  const calls: QueryCall[] = [];
  const pool = {
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (sql.includes("FROM shopify_topup_order_events") && sql.includes("LIMIT 1")) return { rows: [] };
      if (sql.includes("INSERT INTO shopify_topup_order_events")) return { rows: [{ id: 42 }] };
      if (sql.includes("SELECT id FROM users")) return { rows: [{ id: 7 }] };
      return { rows: [] };
    },
  };
  return { pool, calls };
}

describe("shopify topup routes", () => {
  it("rejects a Shopify webhook when the HMAC signature is missing", async () => {
    const { pool } = createAutoCreditPool();
    const app = createTestApp(pool);

    const response = await request(app)
      .post("/api/shopify/topup/webhook")
      .set("content-type", "application/json")
      .send(JSON.stringify({ id: "order-1", line_items: [] }));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "missing_signature" });
  });

  it("auto-credits matching dashboard users from eligible paid Shopify line items", async () => {
    const { pool, calls } = createAutoCreditPool();
    const app = createTestApp(pool);
    const body = JSON.stringify({
      id: "order-2",
      name: "#1002",
      email: "buyer@example.com",
      line_items: [
        {
          variant_id: 123,
          title: "BotBot 1,000 tokens",
          quantity: 2,
        },
      ],
    });

    const response = await request(app)
      .post("/api/shopify/topup/webhook")
      .set("content-type", "application/json")
      .set("x-shopify-hmac-sha256", sign(body, "test_secret"))
      .set("x-shopify-topic", "orders/paid")
      .set("x-shopify-shop-domain", "alphaonlines.myshopify.com")
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      event_id: 42,
      status: "auto_credited",
      user_id: 7,
      credits_by_model: { local: 2000 },
    });

    const ledgerCall = calls.find((call) => call.sql.includes("INSERT INTO botbot_token_ledger"));
    expect(ledgerCall?.params).toEqual([7, "local", 2000]);
  });
});
