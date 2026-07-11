"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const vitest_1 = require("vitest");
const jobs_1 = require("./jobs");
const competitors_1 = require("./competitors");
vitest_1.vi.mock('./competitors', () => ({
    lookupAshley: vitest_1.vi.fn(),
    lookupFurniture4Less: vitest_1.vi.fn(),
}));
const tmpRoot = node_path_1.default.join(process.cwd(), 'tmp-competitor-pricing-jobs-test');
process.env.COMPETITOR_PRICING_DATA_DIR = tmpRoot;
const rows = [
    {
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
    },
    {
        sourceRow: 3,
        vendor: 'Ashley',
        sku: 'B076-280',
        description: 'Trentlore',
        storePriceText: '$199',
        storePrice: '$199',
        regularPrice: '$299',
        existingAhsCompPrice: '',
        existingFflCompPrice: '',
        remarks: '',
        bucket: 'ashley',
        rowNotes: [],
    },
    {
        sourceRow: 4,
        vendor: 'Ashley',
        sku: 'B1050-31/36',
        description: 'Hyana',
        storePriceText: '7PC $1,399 K $1,599',
        storePrice: '$1,399',
        regularPrice: '$1,599',
        existingAhsCompPrice: '',
        existingFflCompPrice: '',
        remarks: '',
        bucket: 'manual_review',
        rowNotes: ['multi-component row'],
    },
];
(0, vitest_1.describe)('competitorPricing jobs', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.mocked(competitors_1.lookupAshley).mockReset();
        vitest_1.vi.mocked(competitors_1.lookupFurniture4Less).mockReset();
        vitest_1.vi.mocked(competitors_1.lookupFurniture4Less).mockResolvedValue({
            competitor: 'Furniture4LessNC',
            title: 'Groovy Navy sofa 8642-61',
            price: '$499.00',
            url: 'https://furniture4lessnc.com/products/groovy',
            confidence: 'high',
            matchedTokens: ['8642-61'],
            notes: [],
        });
        vitest_1.vi.mocked(competitors_1.lookupAshley).mockResolvedValue({
            competitor: 'Ashley',
            title: 'Trentlore B076-280',
            price: '$179.99',
            url: 'https://www.ashleyfurniture.com/p/trentlore/B076-280.html',
            confidence: 'high',
            matchedTokens: ['B076-280'],
            notes: [],
        });
    });
    (0, vitest_1.afterEach)(async () => {
        await promises_1.default.rm(tmpRoot, { recursive: true, force: true });
    });
    (0, vitest_1.it)('non_ashley_first mode selects only non-Ashley rows', async () => {
        const job = await (0, jobs_1.createCompetitorPricingJob)({ rows, mode: 'non_ashley_first' });
        (0, vitest_1.expect)(job.totalRows).toBe(1);
        await (0, jobs_1.runCompetitorPricingJob)(job.jobId);
        const status = await (0, jobs_1.getCompetitorPricingJob)(job.jobId);
        (0, vitest_1.expect)(status.status).toBe('completed');
        (0, vitest_1.expect)(status.processedRows).toBe(1);
        (0, vitest_1.expect)(competitors_1.lookupAshley).not.toHaveBeenCalled();
        (0, vitest_1.expect)(competitors_1.lookupFurniture4Less).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('ashley_only mode selects only Ashley rows and uses high/medium matches for lowest price', async () => {
        const job = await (0, jobs_1.createCompetitorPricingJob)({ rows, mode: 'ashley_only' });
        (0, vitest_1.expect)(job.totalRows).toBe(1);
        await (0, jobs_1.runCompetitorPricingJob)(job.jobId);
        const results = JSON.parse(await promises_1.default.readFile(node_path_1.default.join(tmpRoot, 'jobs', job.jobId, 'results.json'), 'utf8'));
        (0, vitest_1.expect)(results[0].lowestReliableCompetitorPrice).toBe('$179.99');
        (0, vitest_1.expect)(results[0].storeMinusLowest).toBe('$19.01');
    });
    (0, vitest_1.it)('does not use low confidence matches in lowest price calculations', async () => {
        vitest_1.vi.mocked(competitors_1.lookupFurniture4Less).mockResolvedValueOnce({
            competitor: 'Furniture4LessNC',
            title: 'Wrong product',
            price: '$1.00',
            url: 'https://furniture4lessnc.com/products/wrong',
            confidence: 'low',
            matchedTokens: [],
            notes: [],
        });
        const job = await (0, jobs_1.createCompetitorPricingJob)({ rows, mode: 'non_ashley_first' });
        await (0, jobs_1.runCompetitorPricingJob)(job.jobId);
        const results = JSON.parse(await promises_1.default.readFile(node_path_1.default.join(tmpRoot, 'jobs', job.jobId, 'results.json'), 'utf8'));
        (0, vitest_1.expect)(results[0].lowestReliableCompetitorPrice).toBe('');
        (0, vitest_1.expect)(results[0].recommendation).toMatch(/no reliable/i);
    });
    (0, vitest_1.it)('writes result CSV with source row and recommendation columns', () => {
        const csv = (0, jobs_1.resultRowsToCsv)([{ ...rows[0], lowestReliableCompetitorPrice: '$499.00', storeMinusLowest: '$100.00', recommendation: 'you are higher', checkedAt: 'now' }]);
        (0, vitest_1.expect)(csv).toContain('source_row,bucket,vendor,sku');
        (0, vitest_1.expect)(csv).toContain('you are higher');
    });
});
//# sourceMappingURL=jobs.test.js.map