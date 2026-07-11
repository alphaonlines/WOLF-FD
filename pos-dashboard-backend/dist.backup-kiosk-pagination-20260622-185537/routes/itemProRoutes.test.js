"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const itemProRoutes_1 = require("./itemProRoutes");
function createTestApp(pool) {
    const app = (0, express_1.default)();
    (0, itemProRoutes_1.registerItemProRoutes)({
        app,
        pool: pool,
        itemDateField: () => "delivered_date",
        prefixedDateField: (_req, tableAlias) => `${tableAlias}.delivered_date`,
    });
    return app;
}
(0, vitest_1.describe)("item manufacturer routes", () => {
    (0, vitest_1.it)("includes blank and null manufacturers in top manufacturer totals as Unassigned", async () => {
        const pool = {
            async query(sql) {
                (0, vitest_1.expect)(sql).toContain("COALESCE(NULLIF(TRIM(manufacturer), ''), 'Unassigned') AS manufacturer");
                (0, vitest_1.expect)(sql).not.toContain("AND manufacturer IS NOT NULL");
                (0, vitest_1.expect)(sql).not.toContain("AND manufacturer <> ''");
                return { rows: [{ manufacturer: "Unassigned", qty: "3", sales: "300" }] };
            },
        };
        const app = createTestApp(pool);
        const response = await (0, supertest_1.default)(app).get("/api/items/by-manufacturer?start=2026-01-01&end=2026-02-01");
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.rows).toEqual([{ manufacturer: "Unassigned", qty: 3, sales: 300 }]);
    });
    (0, vitest_1.it)("drills into blank and null manufacturer rows when Unassigned is selected", async () => {
        const pool = {
            async query(sql, params = []) {
                (0, vitest_1.expect)(params[2]).toBe("Unassigned");
                (0, vitest_1.expect)(sql).toContain("($3::text = 'Unassigned' AND NULLIF(TRIM(manufacturer), '') IS NULL)");
                return {
                    rows: [
                        {
                            item_description: "No Brand Sofa",
                            category: "Living Room",
                            item_no: "NB-1",
                            qty: "1",
                            sales: "100",
                            sale_ids: ["12345"],
                        },
                    ],
                };
            },
        };
        const app = createTestApp(pool);
        const response = await (0, supertest_1.default)(app).get("/api/items/manufacturer-top-items?start=2026-01-01&end=2026-02-01&manufacturer=Unassigned");
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.rows).toEqual([
            {
                item_description: "No Brand Sofa",
                category: "Living Room",
                item_no: "NB-1",
                qty: 1,
                sales: 100,
                sale_ids: ["12345"],
            },
        ]);
    });
});
(0, vitest_1.describe)("item pro sales trend", () => {
    (0, vitest_1.it)("combines furniture sales and only returns ad spend on days when ads actually ran", async () => {
        const pool = {
            async query(sql, params = []) {
                (0, vitest_1.expect)(params).toEqual(["2026-01-01", "2026-03-01", null, null]);
                (0, vitest_1.expect)(sql).toContain("AS furniture_sales");
                (0, vitest_1.expect)(sql).not.toContain("ILIKE '%mattress%' OR");
                (0, vitest_1.expect)(sql).not.toContain("AS mattress_boxspring_adjustable_sales");
                return {
                    rows: [
                        { day: "2026-01-15", furniture_sales: "900" },
                        { day: "2026-02-05", furniture_sales: "1500" },
                    ],
                };
            },
        };
        const app = createTestApp(pool);
        const response = await (0, supertest_1.default)(app).get("/api/pro1st/trend?start=2026-01-01&end=2026-03-01");
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.adSpend).toMatchObject({
            totalAdSpend: 17468.8,
            averageDailyAdSpend: 727.87,
            activeAdDays: 24,
            daysInRange: 59,
        });
        (0, vitest_1.expect)(response.body.rows).toEqual([
            {
                day: "2026-01-15",
                furnitureSales: 900,
                mattressBoxSpringAdjustableSales: 0,
                averageDailyAdSpend: null,
            },
            {
                day: "2026-02-05",
                furnitureSales: 1500,
                mattressBoxSpringAdjustableSales: 0,
                averageDailyAdSpend: 727.87,
            },
        ]);
    });
});
//# sourceMappingURL=itemProRoutes.test.js.map