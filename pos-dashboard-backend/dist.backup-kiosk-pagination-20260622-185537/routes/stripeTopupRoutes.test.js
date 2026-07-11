"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const stripeTopupRoutes_1 = require("./stripeTopupRoutes");
function createTestApp(pool) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((req, _res, next) => {
        req.authUser = { id: "7", email: "buyer@example.com", name: "Buyer", roles: ["Employee"] };
        next();
    });
    (0, stripeTopupRoutes_1.registerStripeTopupRoutes)({
        app,
        pool: pool,
        webhookPath: "/api/botbot/stripe/webhook",
        webhookSecret: "",
        secretKey: "",
        publicBaseUrl: "https://furnituredistributors.wolf.discount/fd",
        defaultModelKey: "local",
    });
    return app;
}
function createWebhookApp(pool) {
    const app = (0, express_1.default)();
    (0, stripeTopupRoutes_1.registerStripeTopupRoutes)({
        app,
        pool: pool,
        webhookPath: "/api/botbot/stripe/webhook",
        webhookSecret: "",
        secretKey: "",
        publicBaseUrl: "https://furnituredistributors.wolf.discount/fd",
        defaultModelKey: "local",
    });
    return app;
}
function createAutoCreditPool() {
    const calls = [];
    const pool = {
        async query(sql, params = []) {
            calls.push({ sql, params });
            if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK")
                return { rows: [] };
            if (sql.includes("FROM stripe_topup_events") && sql.includes("LIMIT 1"))
                return { rows: [] };
            if (sql.includes("INSERT INTO stripe_topup_events"))
                return { rows: [{ id: 42 }] };
            return { rows: [] };
        },
    };
    return { pool, calls };
}
(0, vitest_1.describe)("Stripe BotBot topup routes", () => {
    (0, vitest_1.it)("defines server-owned packs from $1 through $250 at 10,000 tokens per dollar", () => {
        (0, vitest_1.expect)(stripeTopupRoutes_1.BOTBOT_STRIPE_TOKEN_PACKS.map(pack => ({ id: pack.id, dollars: pack.priceUsd, tokens: pack.tokens }))).toEqual([
            { id: "botbot-1", dollars: 1, tokens: 10000 },
            { id: "botbot-5", dollars: 5, tokens: 50000 },
            { id: "botbot-10", dollars: 10, tokens: 100000 },
            { id: "botbot-25", dollars: 25, tokens: 250000 },
            { id: "botbot-50", dollars: 50, tokens: 500000 },
            { id: "botbot-100", dollars: 100, tokens: 1000000 },
            { id: "botbot-250", dollars: 250, tokens: 2500000 },
        ]);
    });
    (0, vitest_1.it)("returns the server-owned token pack catalog", async () => {
        const { pool } = createAutoCreditPool();
        const app = createTestApp(pool);
        const response = await (0, supertest_1.default)(app).get("/api/botbot/token-packs");
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.packs).toHaveLength(7);
        (0, vitest_1.expect)(response.body.packs[0]).toMatchObject({ id: "botbot-1", priceUsd: 1, tokens: 10000 });
        (0, vitest_1.expect)(response.body.packs[6]).toMatchObject({ id: "botbot-250", priceUsd: 250, tokens: 2500000 });
    });
    (0, vitest_1.it)("requires Stripe server configuration before creating checkout sessions", async () => {
        const { pool } = createAutoCreditPool();
        const app = createTestApp(pool);
        const response = await (0, supertest_1.default)(app)
            .post("/api/botbot/token-packs/checkout")
            .send({ packId: "botbot-25" });
        (0, vitest_1.expect)(response.status).toBe(503);
        (0, vitest_1.expect)(response.body).toMatchObject({ ok: false, error: "stripe_not_configured" });
    });
    (0, vitest_1.it)("auto-credits tokens from a paid Checkout Session webhook exactly once", async () => {
        const { pool, calls } = createAutoCreditPool();
        const app = createWebhookApp(pool);
        const body = JSON.stringify({
            id: "evt_123",
            type: "checkout.session.completed",
            data: {
                object: {
                    id: "cs_test_123",
                    payment_status: "paid",
                    customer_email: "buyer@example.com",
                    amount_total: 2500,
                    currency: "usd",
                    metadata: {
                        userId: "7",
                        userEmail: "buyer@example.com",
                        packId: "botbot-25",
                        modelKey: "local",
                        tokens: "250000",
                    },
                },
            },
        });
        const response = await (0, supertest_1.default)(app)
            .post("/api/botbot/stripe/webhook")
            .set("content-type", "application/json")
            .send(body);
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toMatchObject({ ok: true, status: "auto_credited", credits_by_model: { local: 250000 } });
        const ledgerCall = calls.find(call => call.sql.includes("INSERT INTO botbot_token_ledger"));
        (0, vitest_1.expect)(ledgerCall?.params).toEqual([7, "local", 250000]);
        const eventCall = calls.find(call => call.sql.includes("INSERT INTO stripe_topup_events"));
        (0, vitest_1.expect)(eventCall?.params).toEqual([
            "evt_123",
            "cs_test_123",
            "checkout.session.completed",
            7,
            "buyer@example.com",
            "botbot-25",
            "local",
            250000,
            2500,
            "usd",
            vitest_1.expect.any(String),
            "auto_credited",
        ]);
    });
});
//# sourceMappingURL=stripeTopupRoutes.test.js.map