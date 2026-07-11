"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pro1stSql_1 = require("./pro1stSql");
(0, vitest_1.describe)("pro1st SQL matching", () => {
    (0, vitest_1.it)("matches current Protection 1st/Max Elite import labels", () => {
        const sql = (0, pro1stSql_1.buildQualifiedPro1stSql)("i.");
        (0, vitest_1.expect)(sql).toContain("%protection 1st%");
        (0, vitest_1.expect)(sql).toContain("%protection programs%");
        (0, vitest_1.expect)(sql).toContain("%max_elite%");
    });
    (0, vitest_1.it)("keeps bedding foundation exclusions in place", () => {
        const sql = (0, pro1stSql_1.buildQualifiedPro1stSql)("i.");
        (0, vitest_1.expect)(sql).toContain("%mattress%");
        (0, vitest_1.expect)(sql).toContain("%adjustable base%");
        (0, vitest_1.expect)(sql).toContain("%bunkie board%");
    });
});
//# sourceMappingURL=pro1stSql.test.js.map