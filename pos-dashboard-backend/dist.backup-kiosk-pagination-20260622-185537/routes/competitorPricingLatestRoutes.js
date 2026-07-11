"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCompetitorPricingLatestRoutes = registerCompetitorPricingLatestRoutes;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const cache_1 = require("../competitorPricing/cache");
function registerCompetitorPricingLatestRoutes(app) {
    const latestResultsPath = node_path_1.default.join((0, cache_1.getCompetitorPricingDataDir)(), 'latest-results.json');
    app.get('/api/competitor-pricing/latest', async (_req, res) => {
        try {
            const raw = await promises_1.default.readFile(latestResultsPath, 'utf8');
            const data = JSON.parse(raw);
            res.json({ ok: true, results: data.results, generatedAt: data.generatedAt, totalRows: data.results?.length ?? 0 });
        }
        catch (err) {
            if (err?.code === 'ENOENT') {
                res.json({ ok: true, results: [], generatedAt: null, totalRows: 0, message: 'No comparison results available yet.' });
                return;
            }
            res.status(500).json({ ok: false, error: String(err?.message || err) });
        }
    });
}
//# sourceMappingURL=competitorPricingLatestRoutes.js.map