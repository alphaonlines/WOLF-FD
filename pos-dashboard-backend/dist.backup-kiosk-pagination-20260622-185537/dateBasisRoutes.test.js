"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const analyticsRoutes_1 = require("./routes/analyticsRoutes");
const itemProRoutes_1 = require("./routes/itemProRoutes");
const reportRoutes_1 = require("./routes/reportRoutes");
const defaultItemDateField = "delivery_confirmed_date";
const defaultPrefixedDateField = (tableAlias) => `${tableAlias}.delivery_confirmed_date`;
const makeQuery = () => vitest_1.vi.fn(async (..._args) => ({ rows: [] }));
const firstSql = (query) => String(query.mock.calls[0][0]);
const allSql = (query) => query.mock.calls.map((call) => String(call[0])).join("\n---\n");
(0, vitest_1.describe)("POS route date_basis handling", () => {
    (0, vitest_1.it)("uses delivered dates by default and written sale dates when requested for summary analytics", async () => {
        const query = makeQuery();
        const app = (0, express_1.default)();
        (0, analyticsRoutes_1.registerAnalyticsRoutes)({
            app,
            pool: { query },
            itemDateField: defaultItemDateField,
            prefixedDateField: defaultPrefixedDateField,
        });
        const deliveredResponse = await (0, supertest_1.default)(app).get("/api/summary?start=2026-06-01&end=2026-07-01");
        (0, vitest_1.expect)(deliveredResponse.status).toBe(200);
        (0, vitest_1.expect)(firstSql(query)).toContain("s.delivery_confirmed_date >= $1");
        query.mockClear();
        const writtenResponse = await (0, supertest_1.default)(app).get("/api/summary?start=2026-06-01&end=2026-07-01&date_basis=written");
        (0, vitest_1.expect)(writtenResponse.status).toBe(200);
        const writtenSql = firstSql(query);
        (0, vitest_1.expect)(writtenSql).toContain("s.sale_date >= $1");
        (0, vitest_1.expect)(writtenSql).toContain("i.sale_date >= $1");
        (0, vitest_1.expect)(writtenSql).not.toContain("s.delivery_confirmed_date >= $1");
        (0, vitest_1.expect)(writtenSql).not.toContain("i.delivery_confirmed_date >= $1");
    });
    (0, vitest_1.it)("uses written item sale dates for leaderboard item rollups when date_basis=written", async () => {
        const query = makeQuery();
        const app = (0, express_1.default)();
        (0, analyticsRoutes_1.registerAnalyticsRoutes)({
            app,
            pool: { query },
            itemDateField: defaultItemDateField,
            prefixedDateField: defaultPrefixedDateField,
        });
        const response = await (0, supertest_1.default)(app).get("/api/leaderboard?start=2026-06-01&end=2026-07-01&date_basis=written");
        (0, vitest_1.expect)(response.status).toBe(200);
        const sql = firstSql(query);
        (0, vitest_1.expect)(sql).toContain("i.sale_date >= $1");
        (0, vitest_1.expect)(sql).toContain("s.sale_date >= $1");
        (0, vitest_1.expect)(sql).not.toContain("i.delivery_confirmed_date >= $1");
        (0, vitest_1.expect)(sql).not.toContain("s.delivery_confirmed_date >= $1");
    });
    (0, vitest_1.it)("uses written sale dates for item analytics when date_basis=written", async () => {
        const query = makeQuery();
        const app = (0, express_1.default)();
        (0, itemProRoutes_1.registerItemProRoutes)({
            app,
            pool: { query },
            itemDateField: defaultItemDateField,
            prefixedDateField: defaultPrefixedDateField,
        });
        const response = await (0, supertest_1.default)(app).get("/api/items/best-sellers?start=2026-06-01&end=2026-07-01&date_basis=written");
        (0, vitest_1.expect)(response.status).toBe(200);
        const sql = firstSql(query);
        (0, vitest_1.expect)(sql).toContain("WHERE sale_date >= $1");
        (0, vitest_1.expect)(sql).not.toContain("WHERE delivery_confirmed_date >= $1");
    });
    (0, vitest_1.it)("uses written sale dates for the full sales report when date_basis=written", async () => {
        const query = makeQuery();
        const app = (0, express_1.default)();
        (0, reportRoutes_1.registerReportRoutes)({
            app,
            pool: { query },
            prefixedDateField: defaultPrefixedDateField,
        });
        const response = await (0, supertest_1.default)(app).get("/api/report/sales-summary?start=2026-06-01&end=2026-07-01&date_basis=written");
        (0, vitest_1.expect)(response.status).toBe(200);
        const combinedSql = allSql(query);
        (0, vitest_1.expect)(combinedSql).toContain("s.sale_date >= $1");
        (0, vitest_1.expect)(combinedSql).not.toContain("s.delivery_confirmed_date >= $1");
    });
});
//# sourceMappingURL=dateBasisRoutes.test.js.map