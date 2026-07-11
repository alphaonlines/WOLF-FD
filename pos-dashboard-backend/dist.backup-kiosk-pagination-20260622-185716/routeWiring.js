"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllRoutes = registerAllRoutes;
const sqlFields_1 = require("./sqlFields");
const crmRoutesV2_1 = require("./routes/crmRoutesV2");
const tasksRoutes_1 = require("./routes/tasksRoutes");
const adminRoutes_1 = require("./routes/adminRoutes");
const authRoutes_1 = require("./routes/authRoutes");
const reportRoutes_1 = require("./routes/reportRoutes");
const analyticsRoutes_1 = require("./routes/analyticsRoutes");
const salesDetailRoutes_1 = require("./routes/salesDetailRoutes");
const insightsRoutes_1 = require("./routes/insightsRoutes");
const systemRoutes_1 = require("./routes/systemRoutes");
const trackingRoutes_1 = require("./routes/trackingRoutes");
const boardRoutes_1 = require("./routes/boardRoutes");
const socialRoutes_1 = require("./routes/socialRoutes");
const manufacturerPricebookRoutes_1 = require("./routes/manufacturerPricebookRoutes");
const objectionVotesRoutes_1 = require("./routes/objectionVotesRoutes");
const customObjectionsRoutes_1 = require("./routes/customObjectionsRoutes");
const botbotRoutes_1 = require("./routes/botbotRoutes");
const competitorPricingRoutes_1 = require("./routes/competitorPricingRoutes");
const competitorPricingLatestRoutes_1 = require("./routes/competitorPricingLatestRoutes");
const authSessionUtils_1 = require("./authSessionUtils");
const authDb_1 = require("./authDb");
const toRouteAuthUser = (user) => {
    if (!user)
        return null;
    return {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        roles: (user.roles || []).map((role) => String(role)),
        permissions: (user.permissions || []).map((permission) => String(permission)),
        permissionMode: user.permissionMode === "explicit" ? "explicit" : "role",
        tutorialCompletedAt: user.tutorialCompletedAt,
    };
};
function registerAllRoutes({ app, pool, upload, uploadsDir, manufacturerPricebookHoldingDir, boardUploadsDir, importerPath, pythonBin, execFileAsync, socialUploadsDir, socialPublicBaseUrl, runSocialDueJobsOnce, authCookieName, authSessionDays, authCookieSecureMode, publicAuthPaths, verifyPassword, hashPassword, sha256Hex, createSessionToken, }) {
    (0, socialRoutes_1.registerPublicSocialRoutes)({
        app,
        pool,
        socialUploadsDir,
    });
    const { currentAuthUserFromReq, setUserRolesByKeys, loadAuthUserById } = (0, authDb_1.createAuthDbHelpers)({
        pool,
        authCookieName,
        parseCookies: authSessionUtils_1.parseCookies,
        sha256Hex,
        buildAuthUser: authSessionUtils_1.buildAuthUser,
        normalizeRoleList: authSessionUtils_1.normalizeRoleList,
    });
    (0, authRoutes_1.registerAuthRoutes)({
        app,
        pool,
        authSessionDays,
        authCookieName,
        publicAuthPaths,
        verifyPassword,
        hashPassword,
        sha256Hex,
        createSessionToken,
        setAuthCookie: (res, token, req) => (0, authSessionUtils_1.setAuthCookie)(res, token, req, {
            authCookieName,
            authSessionDays,
            authCookieSecureMode,
        }),
        clearAuthCookie: (res, req) => (0, authSessionUtils_1.clearAuthCookie)(res, req, {
            authCookieName,
            authCookieSecureMode,
        }),
        parseCookies: authSessionUtils_1.parseCookies,
        currentAuthUserFromReq,
        loadAuthUserById: async (userId) => toRouteAuthUser(await loadAuthUserById(userId)),
        buildAuthUser: (row) => toRouteAuthUser((0, authSessionUtils_1.buildAuthUser)(row)),
    });
    const requireOwner = (req, res, next) => {
        const user = req.authUser;
        if (!(0, authSessionUtils_1.hasAnyRole)(user, ["Owner"]))
            return res.status(403).json({ ok: false, error: "forbidden" });
        return next();
    };
    (0, adminRoutes_1.registerAdminRoutes)({
        app,
        pool,
        requireOwner,
        normalizeRoleList: (raw) => (0, authSessionUtils_1.normalizeRoleList)(raw),
        hashPassword,
        setUserRolesByKeys,
        loadAuthUserById: async (userId) => toRouteAuthUser(await loadAuthUserById(userId)),
    });
    (0, tasksRoutes_1.registerTaskRoutes)(app, pool);
    (0, objectionVotesRoutes_1.registerObjectionVotesRoutes)(app, pool);
    (0, customObjectionsRoutes_1.registerCustomObjectionsRoutes)(app, pool);
    (0, crmRoutesV2_1.registerCrmRoutes)(app, pool);
    (0, boardRoutes_1.registerBoardRoutes)(app, pool, boardUploadsDir, socialPublicBaseUrl);
    (0, manufacturerPricebookRoutes_1.registerManufacturerPricebookRoutes)({
        app,
        pool,
        requireOwner,
        holdingDir: manufacturerPricebookHoldingDir,
        execFileAsync,
    });
    (0, socialRoutes_1.registerSocialRoutes)({
        app,
        pool,
        socialUploadsDir,
        publicBaseUrl: socialPublicBaseUrl,
        runSocialDueJobsOnce,
    });
    (0, reportRoutes_1.registerReportRoutes)({ app, pool, prefixedDateField: sqlFields_1.prefixedDateField });
    (0, analyticsRoutes_1.registerAnalyticsRoutes)({ app, pool, itemDateField: sqlFields_1.ITEM_DATE_FIELD, prefixedDateField: sqlFields_1.prefixedDateField });
    (0, salesDetailRoutes_1.registerSalesDetailRoutes)({ app, pool, itemDateField: sqlFields_1.ITEM_DATE_FIELD, prefixedDateField: sqlFields_1.prefixedDateField });
    (0, insightsRoutes_1.registerInsightsRoutes)({
        app,
        pool,
        prefixedDateField: sqlFields_1.prefixedDateField,
        safeGrandTotal: sqlFields_1.SAFE_GRAND_TOTAL,
        safeProfit: sqlFields_1.SAFE_PROFIT,
        safeTotalFinanceAmt: sqlFields_1.SAFE_TOTAL_FINANCE_AMT,
        safeFinanceBalance: sqlFields_1.SAFE_FINANCE_BALANCE,
        safeFinanceFee: sqlFields_1.SAFE_FINANCE_FEE,
    });
    (0, trackingRoutes_1.registerTrackingRoutes)({ app, pool });
    (0, botbotRoutes_1.registerBotBotRoutes)({ app, pool, requireOwner });
    (0, competitorPricingRoutes_1.registerCompetitorPricingRoutes)(app);
    (0, competitorPricingLatestRoutes_1.registerCompetitorPricingLatestRoutes)(app);
    (0, systemRoutes_1.registerSystemRoutes)({
        app,
        pool,
        upload,
        uploadsDir,
        importerPath,
        pythonBin,
        execFileAsync,
    });
    return { setUserRolesByKeys };
}
//# sourceMappingURL=routeWiring.js.map