"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPETITOR_PRICING_DATA_DIR = void 0;
exports.getCompetitorPricingDataDir = getCompetitorPricingDataDir;
exports.cacheKey = cacheKey;
exports.cachePath = cachePath;
exports.readCachedJson = readCachedJson;
exports.writeCachedJson = writeCachedJson;
exports.cachedJson = cachedJson;
exports.ensureDir = ensureDir;
const node_crypto_1 = __importDefault(require("node:crypto"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
function getCompetitorPricingDataDir() {
    return process.env.COMPETITOR_PRICING_DATA_DIR || node_path_1.default.resolve(process.cwd(), 'data/competitor-pricing');
}
exports.COMPETITOR_PRICING_DATA_DIR = getCompetitorPricingDataDir();
function cacheKey(namespace, request) {
    const hash = node_crypto_1.default.createHash('sha256').update(JSON.stringify(request)).digest('hex');
    return `${namespace}/${hash}.json`;
}
function cachePath(namespace, request, baseDir = getCompetitorPricingDataDir()) {
    return node_path_1.default.join(baseDir, 'cache', cacheKey(namespace, request));
}
async function readCachedJson(namespace, request, baseDir = getCompetitorPricingDataDir()) {
    const file = cachePath(namespace, request, baseDir);
    try {
        return JSON.parse(await promises_1.default.readFile(file, 'utf8'));
    }
    catch (err) {
        if (err?.code === 'ENOENT')
            return null;
        throw err;
    }
}
async function writeCachedJson(namespace, request, value, baseDir = getCompetitorPricingDataDir()) {
    const file = cachePath(namespace, request, baseDir);
    await promises_1.default.mkdir(node_path_1.default.dirname(file), { recursive: true });
    await promises_1.default.writeFile(file, JSON.stringify(value, null, 2));
    return value;
}
async function cachedJson(namespace, request, loader, baseDir = getCompetitorPricingDataDir()) {
    const cached = await readCachedJson(namespace, request, baseDir);
    if (cached)
        return cached;
    return writeCachedJson(namespace, request, await loader(), baseDir);
}
async function ensureDir(dir) {
    await promises_1.default.mkdir(dir, { recursive: true });
}
//# sourceMappingURL=cache.js.map