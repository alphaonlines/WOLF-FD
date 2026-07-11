"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const competitorPricingRoutes_1 = require("./routes/competitorPricingRoutes");
const jobs_1 = require("./competitorPricing/jobs");
const sheetWriteback_1 = require("./competitorPricing/sheetWriteback");
vitest_1.vi.mock('./competitorPricing/jobs', () => ({
    createCompetitorPricingJob: vitest_1.vi.fn(),
    getCompetitorPricingJob: vitest_1.vi.fn(),
    getCompetitorPricingResultPath: vitest_1.vi.fn(),
    getCompetitorPricingResults: vitest_1.vi.fn(),
    runCompetitorPricingJob: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('./competitorPricing/sheetWriteback', () => ({
    writeCompetitorPricingResultsToSheet: vitest_1.vi.fn(),
}));
function app() {
    const instance = (0, express_1.default)();
    instance.use(express_1.default.json({ limit: '5mb' }));
    (0, competitorPricingRoutes_1.registerCompetitorPricingRoutes)(instance);
    return instance;
}
const row = {
    sourceRow: 2,
    vendor: 'Albany',
    sku: '8642-61',
    description: 'Groovy Navy',
    storePriceText: '$599',
    storePrice: '$599',
    regularPrice: '$799',
    existingAhsCompPrice: '',
    existingFflCompPrice: '',
    remarks: '',
    bucket: 'non_ashley',
    rowNotes: [],
};
(0, vitest_1.describe)('competitorPricingRoutes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.mocked(jobs_1.createCompetitorPricingJob).mockReset();
        vitest_1.vi.mocked(jobs_1.getCompetitorPricingJob).mockReset();
        vitest_1.vi.mocked(jobs_1.getCompetitorPricingResultPath).mockReset();
        vitest_1.vi.mocked(jobs_1.getCompetitorPricingResults).mockReset();
        vitest_1.vi.mocked(sheetWriteback_1.writeCompetitorPricingResultsToSheet).mockReset();
        vitest_1.vi.mocked(jobs_1.runCompetitorPricingJob).mockReset();
    });
    (0, vitest_1.it)('rejects empty rows', async () => {
        const res = await (0, supertest_1.default)(app()).post('/api/competitor-pricing/jobs').send({ mode: 'non_ashley_first', rows: [] });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.error).toMatch(/rows/i);
    });
    (0, vitest_1.it)('accepts rows and returns a job id', async () => {
        vitest_1.vi.mocked(jobs_1.createCompetitorPricingJob).mockResolvedValue({
            jobId: 'job-1',
            status: 'queued',
            mode: 'non_ashley_first',
            totalRows: 1,
            processedRows: 0,
            startedAt: 'now',
        });
        const res = await (0, supertest_1.default)(app()).post('/api/competitor-pricing/jobs').send({ mode: 'non_ashley_first', rows: [row] });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.job.jobId).toBe('job-1');
        (0, vitest_1.expect)(jobs_1.runCompetitorPricingJob).toHaveBeenCalledWith('job-1');
    });
    (0, vitest_1.it)('returns job status', async () => {
        vitest_1.vi.mocked(jobs_1.getCompetitorPricingJob).mockResolvedValue({
            jobId: 'job-1',
            status: 'running',
            mode: 'non_ashley_first',
            totalRows: 3,
            processedRows: 1,
            startedAt: 'now',
        });
        const res = await (0, supertest_1.default)(app()).get('/api/competitor-pricing/jobs/job-1');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.job.processedRows).toBe(1);
    });
    (0, vitest_1.it)('404s missing result downloads', async () => {
        vitest_1.vi.mocked(jobs_1.getCompetitorPricingResultPath).mockRejectedValue(new Error('missing'));
        const res = await (0, supertest_1.default)(app()).get('/api/competitor-pricing/jobs/nope/results.csv');
        (0, vitest_1.expect)(res.status).toBe(404);
    });
    (0, vitest_1.it)('writes completed job results back to Google Sheets', async () => {
        const results = [{ sourceRow: 2, sku: '8642-61' }];
        vitest_1.vi.mocked(jobs_1.getCompetitorPricingResults).mockResolvedValue(results);
        vitest_1.vi.mocked(sheetWriteback_1.writeCompetitorPricingResultsToSheet).mockResolvedValue({
            spreadsheetId: 'sheet-1',
            sheetName: 'STORE MOVES AND PRICING',
            sheetId: 123,
            dryRun: false,
            updatedRows: 1,
            updatedCells: 1,
            skippedRows: [],
            columns: { ahsCompColumn: 'R', fflCompColumn: 'S' },
        });
        const res = await (0, supertest_1.default)(app())
            .post('/api/competitor-pricing/jobs/job-1/sheet-writeback')
            .send({ spreadsheetIdOrUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit', sheetName: 'STORE MOVES AND PRICING' });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.writeback.updatedCells).toBe(1);
        (0, vitest_1.expect)(jobs_1.getCompetitorPricingResults).toHaveBeenCalledWith('job-1');
        (0, vitest_1.expect)(sheetWriteback_1.writeCompetitorPricingResultsToSheet).toHaveBeenCalledWith(results, {
            spreadsheetIdOrUrl: 'https://docs.google.com/spreadsheets/d/sheet-1/edit',
            sheetName: 'STORE MOVES AND PRICING',
            dryRun: false,
        });
    });
});
//# sourceMappingURL=competitorPricingRoutes.test.js.map