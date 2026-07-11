"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const manufacturerPricebookRoutes_1 = require("./manufacturerPricebookRoutes");
function createKioskCatalogApp(authUser = { roles: ["Owner"], permissions: [] }) {
    const calls = [];
    const candidateRunDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), "kiosk-image-candidates-"));
    fs_1.default.mkdirSync(path_1.default.join(candidateRunDir, "images"), { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(candidateRunDir, "images", "pending.jpg"), "image-bytes");
    fs_1.default.writeFileSync(path_1.default.join(candidateRunDir, "match_candidates.csv"), [
        "row_id,sku,description,collection_name,product_type,color_finish,group,group_name,category_url,detail_url,source_image_url,review_image,score,image_specificity,reason",
        "101,B100,Gray Power Recliner,Easy Living,Power Recliner,Slate Gray,B100,Easy Living,https://example.com/cat,https://example.com/detail,https://example.com/source.jpg,images/pending.jpg,0.88,group/collection,group-prefix; type-aligns",
    ].join("\n"));
    const pool = {
        async query(sql, params = []) {
            calls.push({ sql, params });
            if (sql.includes("UPDATE manufacturer_catalog_items")) {
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
                            image_urls: params[1],
                            availability_label: "Ask associate",
                        },
                    ],
                };
            }
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
    app.use((req, _res, next) => {
        req.authUser = authUser;
        next();
    });
    (0, manufacturerPricebookRoutes_1.registerManufacturerPricebookRoutes)({
        app,
        pool: pool,
        requireOwner: (_req, _res, next) => next(),
        holdingDir: "/tmp",
        execFileAsync: async () => ({ stdout: "", stderr: "" }),
        imageCandidateRuns: [
            {
                manufacturerSlug: "best",
                runDir: candidateRunDir,
                publicPathPrefix: "/fd/catalog-images/best/candidates",
            },
        ],
    });
    return { app, calls };
}
(0, vitest_1.describe)("manufacturer pricebook kiosk catalog route", () => {
    (0, vitest_1.it)("supports true offset pagination for kiosk products", async () => {
        const { app, calls } = createKioskCatalogApp();
        const response = await (0, supertest_1.default)(app)
            .get("/api/shop/kiosk/products")
            .query({ limit: "100", offset: "100" });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toMatchObject({ ok: true, limit: 100, offset: 100 });
        const selectCall = calls.find((call) => call.sql.includes("FROM manufacturer_catalog_items") && call.sql.includes("ORDER BY"));
        (0, vitest_1.expect)(selectCall?.sql).toMatch(/LIMIT \$\d+\s+OFFSET \$\d+/);
        (0, vitest_1.expect)(selectCall?.params.slice(-2)).toEqual([100, 100]);
    });
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
        (0, vitest_1.expect)(catalogSelect?.sql).toMatch(/ORDER BY\s+CASE WHEN COALESCE\(cardinality\(image_urls\), 0\) > 0 THEN 0 ELSE 1 END ASC/i);
    });
    (0, vitest_1.it)("serves pending image candidates for owner review without changing customer product images", async () => {
        const { app } = createKioskCatalogApp();
        const response = await (0, supertest_1.default)(app)
            .get("/api/shop/kiosk/image-candidates")
            .query({ productIds: "101" });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.rows).toHaveLength(1);
        (0, vitest_1.expect)(response.body.rows[0]).toMatchObject({
            product_id: "101",
            image_url: "/fd/catalog-images/best/candidates/pending.jpg",
            source_image_url: "https://example.com/source.jpg",
            detail_url: "https://example.com/detail",
            score: 0.88,
            image_specificity: "group/collection",
            status: "pending",
        });
    });
    (0, vitest_1.it)("lets an owner approve a pending image candidate onto the catalog product", async () => {
        const { app, calls } = createKioskCatalogApp();
        const candidates = await (0, supertest_1.default)(app)
            .get("/api/shop/kiosk/image-candidates")
            .query({ productIds: "101" });
        const candidateId = candidates.body.rows[0].id;
        const response = await (0, supertest_1.default)(app)
            .post(`/api/shop/kiosk/products/101/image-candidates/${encodeURIComponent(candidateId)}/approve`);
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.row.image_urls).toEqual(["/fd/catalog-images/best/candidates/pending.jpg"]);
        const updateCall = calls.find((call) => call.sql.includes("UPDATE manufacturer_catalog_items"));
        (0, vitest_1.expect)(updateCall?.params).toEqual([101, ["/fd/catalog-images/best/candidates/pending.jpg"]]);
    });
    (0, vitest_1.it)("allows a non-owner with the kiosk image approval permission to review candidates", async () => {
        const { app } = createKioskCatalogApp({ roles: ["Sales"], permissions: ["feature.shop_kiosk_image_approval"] });
        const response = await (0, supertest_1.default)(app)
            .get("/api/shop/kiosk/image-candidates")
            .query({ productIds: "101" });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.rows).toHaveLength(1);
    });
    (0, vitest_1.it)("blocks image candidate review without owner role or approval permission", async () => {
        const { app } = createKioskCatalogApp({ roles: ["Sales"], permissions: [] });
        const response = await (0, supertest_1.default)(app)
            .get("/api/shop/kiosk/image-candidates")
            .query({ productIds: "101" });
        (0, vitest_1.expect)(response.status).toBe(403);
    });
});
//# sourceMappingURL=manufacturerPricebookRoutes.test.js.map