"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMarketingAnalyticsRoutes = registerMarketingAnalyticsRoutes;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const MARKETING_EXPORTS_DIR = path_1.default.resolve(__dirname, "..", "marketing-analytics-exports");
const ACCEPTED_FILE_PATTERN = /\.(csv|xlsx|xls)$/i;
const EXPECTED_REPORTS = [
    {
        key: "google_ads_campaigns",
        source: "Google Ads",
        label: "Campaign performance",
        fileName: "google_ads_campaigns_YYYY-MM-DD.csv",
        requiredColumns: ["Campaign", "Campaign ID", "Campaign type", "Status", "Impr.", "Clicks", "CTR", "Avg. CPC", "Cost", "Conversions", "Cost / conv.", "Conv. rate"],
        optionalColumns: ["Conversion value", "Search impr. share", "Interactions", "Interaction rate", "All conversions"],
    },
    {
        key: "google_ads_ad_groups",
        source: "Google Ads",
        label: "Ad group performance",
        fileName: "google_ads_ad_groups_YYYY-MM-DD.csv",
        requiredColumns: ["Campaign", "Campaign ID", "Ad group", "Ad group ID", "Status", "Impr.", "Clicks", "CTR", "Avg. CPC", "Cost", "Conversions", "Cost / conv.", "Conv. rate"],
        optionalColumns: ["Conversion value"],
    },
    {
        key: "google_ads_keywords",
        source: "Google Ads",
        label: "Keyword performance",
        fileName: "google_ads_keywords_YYYY-MM-DD.csv",
        requiredColumns: ["Campaign", "Campaign ID", "Ad group", "Ad group ID", "Keyword", "Match type", "Status", "Impr.", "Clicks", "CTR", "Avg. CPC", "Cost", "Conversions", "Cost / conv.", "Conv. rate"],
        optionalColumns: [],
    },
    {
        key: "google_ads_search_terms",
        source: "Google Ads",
        label: "Search terms",
        fileName: "google_ads_search_terms_YYYY-MM-DD.csv",
        requiredColumns: ["Search term", "Campaign", "Ad group", "Match type", "Added/Excluded", "Impr.", "Clicks", "CTR", "Avg. CPC", "Cost", "Conversions", "Cost / conv."],
        optionalColumns: [],
    },
    {
        key: "google_ads_ads",
        source: "Google Ads",
        label: "Ads performance",
        fileName: "google_ads_ads_YYYY-MM-DD.csv",
        requiredColumns: ["Campaign", "Campaign ID", "Ad group", "Ad group ID", "Ad", "Ad ID", "Ad type", "Status", "Final URL", "Impr.", "Clicks", "CTR", "Avg. CPC", "Cost", "Conversions", "Cost / conv."],
        optionalColumns: [],
    },
    {
        key: "ga4_traffic_acquisition",
        source: "GA4",
        label: "Traffic acquisition",
        fileName: "ga4_traffic_acquisition_YYYY-MM-DD.csv",
        requiredColumns: ["Session source / medium", "Session campaign", "Sessions", "Users", "Engaged sessions", "Engagement rate", "Event count", "Key events"],
        optionalColumns: ["Total revenue"],
    },
    {
        key: "ga4_user_acquisition",
        source: "GA4",
        label: "User acquisition",
        fileName: "ga4_user_acquisition_YYYY-MM-DD.csv",
        requiredColumns: ["First user source / medium", "First user campaign", "New users", "Engaged sessions", "Engagement rate", "Event count", "Key events"],
        optionalColumns: [],
    },
    {
        key: "ga4_landing_pages",
        source: "GA4",
        label: "Landing pages",
        fileName: "ga4_landing_pages_YYYY-MM-DD.csv",
        requiredColumns: ["Landing page", "Sessions", "Users", "Engaged sessions", "Engagement rate", "Event count", "Key events"],
        optionalColumns: [],
    },
    {
        key: "ga4_events",
        source: "GA4",
        label: "Events",
        fileName: "ga4_events_YYYY-MM-DD.csv",
        requiredColumns: ["Event name", "Event count", "Users"],
        optionalColumns: ["Total revenue"],
    },
    {
        key: "ga4_key_events",
        source: "GA4",
        label: "Key events / conversions",
        fileName: "ga4_key_events_YYYY-MM-DD.csv",
        requiredColumns: ["Key event name", "Key events", "Users"],
        optionalColumns: ["Total revenue"],
    },
];
function ensureDir() {
    fs_1.default.mkdirSync(MARKETING_EXPORTS_DIR, { recursive: true });
}
function safeFileName(name) {
    return path_1.default.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160);
}
function reportForFileName(fileName) {
    const lower = fileName.toLowerCase();
    return EXPECTED_REPORTS.find((report) => lower.includes(report.key)) || null;
}
function normalizeHeader(value) {
    return value.toLowerCase().replace(/[\s_/-]+/g, " ").replace(/[^a-z0-9 .]+/g, "").trim();
}
function headerHas(headers, expected) {
    const target = normalizeHeader(expected);
    return headers.some((header) => {
        const normalized = normalizeHeader(header);
        return normalized === target || normalized.includes(target) || target.includes(normalized);
    });
}
function inspectSpreadsheet(filePath, originalName) {
    try {
        const workbook = XLSX.readFile(filePath, { sheetRows: 100000 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
        const rows = worksheet ? XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) : [];
        const headerRow = rows.find((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim())) || [];
        const headers = headerRow.map((cell) => String(cell || "").trim()).filter(Boolean);
        const report = reportForFileName(originalName);
        const missingRequiredColumns = report ? report.requiredColumns.filter((column) => !headerHas(headers, column)) : [];
        return {
            ok: !!report,
            reportKey: report?.key || null,
            reportLabel: report?.label || "Unrecognized report",
            source: report?.source || "Unknown",
            rowCount: Math.max(0, rows.length - 1),
            headers,
            missingRequiredColumns,
            warning: report ? null : "File name does not match an expected Google Ads or GA4 export.",
        };
    }
    catch (error) {
        return {
            ok: false,
            reportKey: reportForFileName(originalName)?.key || null,
            reportLabel: reportForFileName(originalName)?.label || "Unrecognized report",
            source: reportForFileName(originalName)?.source || "Unknown",
            rowCount: 0,
            headers: [],
            missingRequiredColumns: [],
            warning: error?.message || "Could not parse spreadsheet headers.",
        };
    }
}
function latestUploads() {
    ensureDir();
    const files = fs_1.default.readdirSync(MARKETING_EXPORTS_DIR)
        .map((storedName) => {
        const filePath = path_1.default.join(MARKETING_EXPORTS_DIR, storedName);
        const stat = fs_1.default.statSync(filePath);
        if (!stat.isFile())
            return null;
        const originalName = storedName.replace(/^\d{8}T\d{6}Z_[a-f0-9]{8}_/, "");
        const report = reportForFileName(originalName);
        const inspected = inspectSpreadsheet(filePath, originalName);
        return {
            storedName,
            originalName,
            sizeBytes: stat.size,
            uploadedAt: stat.mtime.toISOString(),
            ...inspected,
            reportKey: inspected.reportKey || report?.key || null,
        };
    })
        .filter(Boolean);
    const latestByReport = {};
    for (const file of files) {
        if (!file.reportKey)
            continue;
        const existing = latestByReport[file.reportKey];
        if (!existing || String(file.uploadedAt) > String(existing.uploadedAt))
            latestByReport[file.reportKey] = file;
    }
    return { files, latestByReport };
}
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => {
            ensureDir();
            cb(null, MARKETING_EXPORTS_DIR);
        },
        filename: (_req, file, cb) => {
            const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
            cb(null, `${stamp}_${crypto_1.default.randomBytes(4).toString("hex")}_${safeFileName(file.originalname)}`);
        },
    }),
    limits: { files: 10, fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = ACCEPTED_FILE_PATTERN.test(file.originalname);
        cb((ok ? null : new Error("Only .csv, .xlsx, or .xls files are accepted")), ok);
    },
});
function registerMarketingAnalyticsRoutes(app) {
    app.get("/api/marketing-analytics/status", (_req, res) => {
        const { latestByReport } = latestUploads();
        const reports = EXPECTED_REPORTS.map((report) => ({
            ...report,
            upload: latestByReport[report.key] || null,
        }));
        const uploadedReports = reports.filter((report) => !!report.upload).length;
        res.json({
            ok: true,
            generatedAt: new Date().toISOString(),
            exportsDir: MARKETING_EXPORTS_DIR,
            expectedReports: EXPECTED_REPORTS.length,
            uploadedReports,
            missingReports: EXPECTED_REPORTS.length - uploadedReports,
            reports,
        });
    });
    app.post("/api/marketing-analytics/import-upload", upload.array("files", 10), (req, res) => {
        const files = (req.files || []);
        const inspected = files.map((file) => ({
            originalName: file.originalname,
            storedName: path_1.default.basename(file.path),
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
            ...inspectSpreadsheet(file.path, file.originalname),
        }));
        const { latestByReport } = latestUploads();
        res.json({
            ok: true,
            uploaded: inspected,
            uploadedReports: Object.keys(latestByReport).length,
            expectedReports: EXPECTED_REPORTS.length,
            missingReports: Math.max(0, EXPECTED_REPORTS.length - Object.keys(latestByReport).length),
        });
    });
}
//# sourceMappingURL=marketingAnalyticsRoutes.js.map