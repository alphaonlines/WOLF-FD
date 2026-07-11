"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const manufacturerPricebookRoutes_1 = require("./manufacturerPricebookRoutes");
function createKioskCatalogApp() {
    const calls = [];
    const pool = {
        async query(sql, params = []) {
            calls.push({ sql, params });
            if (sql.includes("COUNT(*)::int AS total")) {
                return { rows: [{ total: 1 }] };
            }
            if (sql.includes("FROM manufacturer_catalog_items")) {
                return {
                    rows: [
                        {
                            id: 101,
                            manufacturer: "Best",
                            manufacturer_slug: "best",
                            collection_code: "EZ",
                            collection_name: "Easy Living",
                            category: "Recliners",
                            product_type: "Power Recliner",
                            sku: "B100",
                            description: "Gray Power Recliner",
                            color_finish: "Slate Gray",
                            color_family: "Gray",
                            material: "Fabric",
                            dimensions_text: '42"W × 40"D × 43"H',
                            width_inches: 42,
                            depth_inches: 40,
                            height_inches: 43,
                            feature_tags: ["power"],
                            search_keywords: ["gray", "recliner"],
                            image_urls: ["https://example.com/recliner.jpg"],
                        },
                    ],
                };
            }
            return { rows: [] };
        },
    };
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    (0, manufacturerPricebookRoutes_1.registerManufacturerPricebookRoutes)({
        app,
        pool: pool,
        requireOwner: (_req, res) => res.status(403).json({ ok: false, error: "owner route should not be used" }),
        holdingDir: "/tmp",
        execFileAsync: async () => ({ stdout: "", stderr: "" }),
    });
    return { app, calls };
}
(0, vitest_1.describe)("manufacturer pricebook kiosk catalog route", () => {
    (0, vitest_1.it)("serves only customer-safe product fields from /api/shop/kiosk/products", async () => {
        const { app, calls } = createKioskCatalogApp();
        const response = await (0, supertest_1.default)(app)
            .get("/api/shop/kiosk/products")
            .query({ query: "recliner", color: "gray", limit: "50" });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toMatchObject({ ok: true, count: 1, total: 1, limit: 50, has_more: false });
        (0, vitest_1.expect)(response.body.rows).toHaveLength(1);
        (0, vitest_1.expect)(response.body.rows[0]).toMatchObject({
            id: "101",
            manufacturer: "Best",
            manufacturer_slug: "best",
            collection_name: "Easy Living",
            category: "Recliners",
            product_type: "Power Recliner",
            sku: "B100",
            description: "Gray Power Recliner",
            color_finish: "Slate Gray",
            color_family: "Gray",
            material: "Fabric",
            dimensions_text: '42"W × 40"D × 43"H',
            width_inches: 42,
            depth_inches: 40,
            height_inches: 43,
            image_urls: ["https://example.com/recliner.jpg"],
            availability_label: "Ask associate",
        });
        for (const forbidden of [
            "upload_id",
            "base_price",
            "cost",
            "margin",
            "source_note",
            "source_sort_order",
            "created_at",
            "updated_at",
        ]) {
            (0, vitest_1.expect)(response.body.rows[0]).not.toHaveProperty(forbidden);
        }
        const catalogSelect = calls.find(call => call.sql.includes("FROM manufacturer_catalog_items"));
        (0, vitest_1.expect)(catalogSelect?.sql).not.toMatch(/base_price|upload_id|source_note|source_sort_order/i);
    });
});
//# sourceMappingURL=manufacturerPricebookRoutes.test.js.map