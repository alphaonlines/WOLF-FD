"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testing = void 0;
exports.resultRowsToCsv = resultRowsToCsv;
exports.createCompetitorPricingJob = createCompetitorPricingJob;
exports.getCompetitorPricingJob = getCompetitorPricingJob;
exports.getCompetitorPricingResultPath = getCompetitorPricingResultPath;
exports.getCompetitorPricingResults = getCompetitorPricingResults;
exports.runCompetitorPricingJob = runCompetitorPricingJob;
const node_crypto_1 = __importDefault(require("node:crypto"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const cache_1 = require("./cache");
const competitors_1 = require("./competitors");
const matching_1 = require("./matching");
function jobDir(jobId) {
    return node_path_1.default.join((0, cache_1.getCompetitorPricingDataDir)(), 'jobs', jobId);
}
function uploadsDir(jobId) {
    return node_path_1.default.join((0, cache_1.getCompetitorPricingDataDir)(), 'uploads', jobId);
}
function statusPath(jobId) {
    return node_path_1.default.join(jobDir(jobId), 'status.json');
}
function resultsJsonPath(jobId) {
    return node_path_1.default.join(jobDir(jobId), 'results.json');
}
function resultsCsvPath(jobId) {
    return node_path_1.default.join(jobDir(jobId), 'results.csv');
}
function inputRowsPath(jobId) {
    return node_path_1.default.join(uploadsDir(jobId), 'normalized-input.json');
}
async function writeJson(file, value) {
    await (0, cache_1.ensureDir)(node_path_1.default.dirname(file));
    await promises_1.default.writeFile(file, JSON.stringify(value, null, 2));
}
async function readJson(file) {
    return JSON.parse(await promises_1.default.readFile(file, 'utf8'));
}
function selectRows(rows, mode) {
    switch (mode) {
        case 'non_ashley_first':
            return rows.filter((row) => row.bucket === 'non_ashley');
        case 'ashley_only':
            return rows.filter((row) => row.bucket === 'ashley');
        case 'manual_review':
            return rows.filter((row) => row.bucket === 'manual_review');
        case 'all_reliable_rows':
            return rows.filter((row) => row.bucket !== 'manual_review');
        default:
            return [];
    }
}
function emptyMatch(competitor, notes) {
    return { competitor, title: '', price: '', url: '', confidence: 'none', matchedTokens: [], notes };
}
function formatMoney(value) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function reliablePrice(match) {
    if (!match || !['high', 'medium'].includes(match.confidence))
        return null;
    return (0, matching_1.priceToNumber)(match.price);
}
function buildRecommendation(storePrice, matches) {
    if (!matches.length) {
        return { lowestReliableCompetitorPrice: '', storeMinusLowest: '', recommendation: 'no reliable competitor match found' };
    }
    const lowest = matches.sort((a, b) => a.price - b.price)[0];
    if (storePrice === null) {
        return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: '', recommendation: `competitor found at ${lowest.name}; store price unavailable` };
    }
    const diff = storePrice - lowest.price;
    if (diff > 0) {
        return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: formatMoney(diff), recommendation: `you are ${formatMoney(diff)} higher than ${lowest.name}` };
    }
    if (diff < 0) {
        return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: formatMoney(diff), recommendation: `you are ${formatMoney(Math.abs(diff))} lower than ${lowest.name}` };
    }
    return { lowestReliableCompetitorPrice: formatMoney(lowest.price), storeMinusLowest: formatMoney(0), recommendation: `you match ${lowest.name}` };
}
function csvEscape(value) {
    const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function resultRowsToCsv(rows) {
    const headers = [
        'source_row',
        'bucket',
        'vendor',
        'sku',
        'description',
        'store_price_text',
        'store_price',
        'regular_price',
        'existing_ahs_comp_price',
        'existing_ffl_comp_price',
        'ashley_title',
        'ashley_price',
        'ashley_confidence',
        'ashley_url',
        'furniture4less_title',
        'furniture4less_price',
        'furniture4less_confidence',
        'furniture4less_url',
        'lowest_reliable_competitor_price',
        'store_minus_lowest',
        'recommendation',
        'notes',
        'checked_at',
    ];
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push([
            row.sourceRow,
            row.bucket,
            row.vendor,
            row.sku,
            row.description,
            row.storePriceText,
            row.storePrice,
            row.regularPrice,
            row.existingAhsCompPrice,
            row.existingFflCompPrice,
            row.ashley?.title || '',
            row.ashley?.price || '',
            row.ashley?.confidence || '',
            row.ashley?.url || '',
            row.furniture4Less?.title || '',
            row.furniture4Less?.price || '',
            row.furniture4Less?.confidence || '',
            row.furniture4Less?.url || '',
            row.lowestReliableCompetitorPrice,
            row.storeMinusLowest,
            row.recommendation,
            [...(row.rowNotes || []), ...(row.ashley?.notes || []), ...(row.furniture4Less?.notes || [])].join('; '),
            row.checkedAt,
        ].map(csvEscape).join(','));
    }
    return `${lines.join('\n')}\n`;
}
async function createCompetitorPricingJob(args) {
    const selectedRows = selectRows(args.rows, args.mode);
    const jobId = node_crypto_1.default.randomUUID();
    const now = new Date().toISOString();
    const status = {
        jobId,
        status: 'queued',
        mode: args.mode,
        totalRows: selectedRows.length,
        processedRows: 0,
        startedAt: now,
    };
    await writeJson(inputRowsPath(jobId), selectedRows);
    await writeJson(statusPath(jobId), status);
    return status;
}
async function getCompetitorPricingJob(jobId) {
    return readJson(statusPath(jobId));
}
async function getCompetitorPricingResultPath(jobId, format) {
    const file = format === 'csv' ? resultsCsvPath(jobId) : resultsJsonPath(jobId);
    await promises_1.default.access(file);
    return file;
}
async function getCompetitorPricingResults(jobId) {
    return readJson(resultsJsonPath(jobId));
}
async function updateStatus(jobId, patch) {
    const current = await getCompetitorPricingJob(jobId);
    const next = { ...current, ...patch };
    await writeJson(statusPath(jobId), next);
    return next;
}
async function runCompetitorPricingJob(jobId) {
    await updateStatus(jobId, { status: 'running' });
    const rows = await readJson(inputRowsPath(jobId));
    const results = [];
    try {
        for (const row of rows) {
            const ashley = row.bucket === 'ashley' ? await (0, competitors_1.lookupAshley)(row) : emptyMatch('Ashley', ['Ashley lookup skipped for this run mode']);
            const furniture4Less = row.bucket === 'manual_review'
                ? emptyMatch('Furniture4LessNC', ['manual-review row skipped for automatic lookup'])
                : await (0, competitors_1.lookupFurniture4Less)(row);
            const reliable = [
                { name: 'Ashley', price: reliablePrice(ashley) },
                { name: 'Furniture4LessNC', price: reliablePrice(furniture4Less) },
            ].filter((entry) => typeof entry.price === 'number' && Number.isFinite(entry.price));
            const comparison = buildRecommendation((0, matching_1.priceToNumber)(row.storePrice), reliable);
            results.push({
                ...row,
                ashley,
                furniture4Less,
                ...comparison,
                checkedAt: new Date().toISOString(),
            });
            await updateStatus(jobId, { processedRows: results.length });
        }
        await writeJson(resultsJsonPath(jobId), results);
        await promises_1.default.writeFile(resultsCsvPath(jobId), resultRowsToCsv(results));
        await updateStatus(jobId, {
            status: 'completed',
            processedRows: results.length,
            completedAt: new Date().toISOString(),
            resultCsvPath: resultsCsvPath(jobId),
            resultJsonPath: resultsJsonPath(jobId),
        });
    }
    catch (err) {
        await writeJson(resultsJsonPath(jobId), results).catch(() => undefined);
        await updateStatus(jobId, { status: 'failed', error: String(err?.message || err), completedAt: new Date().toISOString() });
        throw err;
    }
}
exports.__testing = { selectRows, jobDir, inputRowsPath, statusPath, resultsCsvPath, resultsJsonPath };
//# sourceMappingURL=jobs.js.map