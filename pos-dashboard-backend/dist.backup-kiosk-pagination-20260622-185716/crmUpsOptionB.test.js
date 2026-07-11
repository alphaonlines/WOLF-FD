"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const vitest_1 = require("vitest");
(0, vitest_1.describe)("UPS Option B backend persistence", () => {
    const routes = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, "routes", "crmRoutesV2.ts"), "utf8");
    const bootstrap = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, "startupBootstrap.ts"), "utf8");
    (0, vitest_1.it)("bootstraps phone/email columns on UPS active and history tables", () => {
        (0, vitest_1.expect)(bootstrap).toContain("ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS phone TEXT");
        (0, vitest_1.expect)(bootstrap).toContain("ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS email TEXT");
        (0, vitest_1.expect)(bootstrap).toContain("ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS phone TEXT");
        (0, vitest_1.expect)(bootstrap).toContain("ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS email TEXT");
    });
    (0, vitest_1.it)("returns and persists phone/email through queue start, active update, and history", () => {
        (0, vitest_1.expect)(routes).toContain("'phone', ac.phone");
        (0, vitest_1.expect)(routes).toContain("'email', ac.email");
        (0, vitest_1.expect)(routes).toContain("h.phone");
        (0, vitest_1.expect)(routes).toContain("h.email");
        (0, vitest_1.expect)(routes).toContain("fields.push(`phone = $");
        (0, vitest_1.expect)(routes).toContain("fields.push(`email = $");
        (0, vitest_1.expect)(routes).toContain("historyFields.push(`phone = $");
        (0, vitest_1.expect)(routes).toContain("historyFields.push(`email = $");
    });
});
//# sourceMappingURL=crmUpsOptionB.test.js.map