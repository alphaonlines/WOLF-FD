"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const socialRoutes_1 = require("./routes/socialRoutes");
const makeApp = (query) => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((req, _res, next) => {
        req.authUser = {
            id: "7",
            name: "Owner",
            email: "owner@example.com",
            roles: ["Owner"],
        };
        next();
    });
    (0, socialRoutes_1.registerSocialRoutes)({
        app,
        pool: { query },
        socialUploadsDir: "/tmp/wolf-fd-social-test-uploads",
        publicBaseUrl: "http://localhost:5057",
        runSocialDueJobsOnce: async () => 0,
    });
    return app;
};
(0, vitest_1.describe)("social routes", () => {
    (0, vitest_1.it)("deletes a social post and its queued publish jobs", async () => {
        const query = vitest_1.vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 42 }] });
        const app = makeApp(query);
        const response = await (0, supertest_1.default)(app).delete("/api/social/posts/42");
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toEqual({ ok: true, id: "42" });
        (0, vitest_1.expect)(query.mock.calls[0][0]).toContain("DELETE FROM social_publish_jobs");
        (0, vitest_1.expect)(query.mock.calls[0][1]).toEqual([42]);
        (0, vitest_1.expect)(query.mock.calls[1][0]).toContain("DELETE FROM social_posts");
        (0, vitest_1.expect)(query.mock.calls[1][1]).toEqual([42]);
    });
});
//# sourceMappingURL=socialRoutes.test.js.map