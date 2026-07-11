"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCompetitorPricingRoutes = registerCompetitorPricingRoutes;
const jobs_1 = require("../competitorPricing/jobs");
const sheetWriteback_1 = require("../competitorPricing/sheetWriteback");
const VALID_MODES = new Set([
    'non_ashley_first',
    'ashley_only',
    'manual_review',
    'all_reliable_rows',
]);
function validateRows(rows) {
    return Array.isArray(rows) && rows.every((row) => row &&
        typeof row.sourceRow === 'number' &&
        typeof row.vendor === 'string' &&
        typeof row.sku === 'string' &&
        typeof row.description === 'string' &&
        typeof row.storePriceText === 'string' &&
        typeof row.storePrice === 'string' &&
        ['non_ashley', 'ashley', 'manual_review'].includes(row.bucket));
}
function registerCompetitorPricingRoutes(app) {
    app.post('/api/competitor-pricing/jobs', async (req, res) => {
        const mode = req.body?.mode;
        const rows = req.body?.rows;
        if (!VALID_MODES.has(mode)) {
            res.status(400).json({ ok: false, error: 'invalid mode' });
            return;
        }
        if (!validateRows(rows) || rows.length === 0) {
            res.status(400).json({ ok: false, error: 'rows are required' });
            return;
        }
        if (rows.length > 600) {
            res.status(400).json({ ok: false, error: 'too many rows; max 600' });
            return;
        }
        const status = await (0, jobs_1.createCompetitorPricingJob)({ rows, mode });
        Promise.resolve((0, jobs_1.runCompetitorPricingJob)(status.jobId)).catch((err) => {
            console.error('[competitor-pricing] job failed', status.jobId, err);
        });
        res.json({ ok: true, job: status });
    });
    app.get('/api/competitor-pricing/jobs/:jobId', async (req, res) => {
        try {
            res.json({ ok: true, job: await (0, jobs_1.getCompetitorPricingJob)(req.params.jobId) });
        }
        catch {
            res.status(404).json({ ok: false, error: 'job not found' });
        }
    });
    app.get('/api/competitor-pricing/jobs/:jobId/results.csv', async (req, res) => {
        try {
            const file = await (0, jobs_1.getCompetitorPricingResultPath)(req.params.jobId, 'csv');
            res.download(file, `competitor-pricing-${req.params.jobId}.csv`);
        }
        catch {
            res.status(404).json({ ok: false, error: 'result not found' });
        }
    });
    app.get('/api/competitor-pricing/jobs/:jobId/results.json', async (req, res) => {
        try {
            res.sendFile(await (0, jobs_1.getCompetitorPricingResultPath)(req.params.jobId, 'json'));
        }
        catch {
            res.status(404).json({ ok: false, error: 'result not found' });
        }
    });
    app.post('/api/competitor-pricing/jobs/:jobId/sheet-writeback', async (req, res) => {
        const spreadsheetIdOrUrl = String(req.body?.spreadsheetIdOrUrl || '').trim();
        const sheetName = typeof req.body?.sheetName === 'string' && req.body.sheetName.trim()
            ? req.body.sheetName.trim()
            : undefined;
        const dryRun = Boolean(req.body?.dryRun);
        if (!spreadsheetIdOrUrl) {
            res.status(400).json({ ok: false, error: 'spreadsheetIdOrUrl is required' });
            return;
        }
        try {
            const results = await (0, jobs_1.getCompetitorPricingResults)(req.params.jobId);
            const writeback = await (0, sheetWriteback_1.writeCompetitorPricingResultsToSheet)(results, { spreadsheetIdOrUrl, sheetName, dryRun });
            res.json({ ok: true, writeback });
        }
        catch (err) {
            const message = String(err?.message || err);
            const status = /result|job|not found/i.test(message) ? 404 : /required|parse|configured|Sheet tab/i.test(message) ? 400 : 500;
            res.status(status).json({ ok: false, error: message });
        }
    });
}
//# sourceMappingURL=competitorPricingRoutes.js.map