"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const server_1 = require("./server");
(0, vitest_1.describe)('Smoke Tests', () => {
    (0, vitest_1.it)('GET /health should return 200 and ok: true', async () => {
        const response = await (0, supertest_1.default)(server_1.app).get('/health');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toEqual({ ok: true, db: 1 });
    });
    (0, vitest_1.it)('GET /api/auth/config should be accessible without auth', async () => {
        const response = await (0, supertest_1.default)(server_1.app).get('/api/auth/config');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toHaveProperty('googleWorkspaceEnabled');
    });
    (0, vitest_1.it)('GET /api/report/sales-summary should return 401 without auth', async () => {
        const response = await (0, supertest_1.default)(server_1.app).get('/api/report/sales-summary');
        (0, vitest_1.expect)(response.status).toBe(401);
    });
});
//# sourceMappingURL=smoke.test.js.map