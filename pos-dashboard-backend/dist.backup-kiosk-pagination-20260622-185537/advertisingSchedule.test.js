"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const advertisingSchedule_1 = require("./advertisingSchedule");
const schedule = [
    {
        start: "2026-02-05",
        end: "2026-02-28",
        promoName: "PRESIDENTS DAY SALE",
        offer: "FLOOR TO DOOR",
        totalSpend: 2400,
        sourceRow: 5,
    },
    {
        start: "2026-02-10",
        end: "2026-02-19",
        promoName: "OVERLAP PROMO",
        offer: "",
        totalSpend: 1000,
        sourceRow: 6,
    },
];
(0, vitest_1.describe)("advertising spend schedule", () => {
    (0, vitest_1.it)("averages daily ad spend over active ad days, not the selected dashboard range", () => {
        const summary = (0, advertisingSchedule_1.calculateAdvertisingSpendSummary)("2026-01-01", "2026-05-29", schedule);
        (0, vitest_1.expect)(summary.daysInRange).toBe(148);
        (0, vitest_1.expect)(summary.activeAdDays).toBe(24);
        (0, vitest_1.expect)(summary.totalAdSpend).toBe(3400);
        (0, vitest_1.expect)(summary.averageDailyAdSpend).toBe(141.67);
        (0, vitest_1.expect)(summary.dailySpendByDate["2026-01-15"]).toBeUndefined();
        (0, vitest_1.expect)(summary.dailySpendByDate["2026-02-05"]).toBe(100);
        (0, vitest_1.expect)(summary.dailySpendByDate["2026-02-10"]).toBe(200);
        (0, vitest_1.expect)(summary.dailySpendByDate["2026-02-19"]).toBe(200);
        (0, vitest_1.expect)(summary.dailySpendByDate["2026-02-28"]).toBe(100);
        (0, vitest_1.expect)(summary.dailySpendByDate["2026-03-01"]).toBeUndefined();
    });
    (0, vitest_1.it)("clips promos to the selected range while averaging only active overlap days", () => {
        const summary = (0, advertisingSchedule_1.calculateAdvertisingSpendSummary)("2026-02-10", "2026-02-20", schedule);
        (0, vitest_1.expect)(summary.daysInRange).toBe(10);
        (0, vitest_1.expect)(summary.activeAdDays).toBe(10);
        // 10 days of first promo at $100/day + all 10 days of overlap promo at $100/day.
        (0, vitest_1.expect)(summary.totalAdSpend).toBe(2000);
        (0, vitest_1.expect)(summary.averageDailyAdSpend).toBe(200);
        (0, vitest_1.expect)(summary.activePromos.map((promo) => promo.promoName)).toEqual([
            "PRESIDENTS DAY SALE",
            "OVERLAP PROMO",
        ]);
    });
    (0, vitest_1.it)("returns zero spend outside scheduled promo windows", () => {
        const summary = (0, advertisingSchedule_1.calculateAdvertisingSpendSummary)("2026-01-01", "2026-01-08", schedule);
        (0, vitest_1.expect)(summary).toMatchObject({
            totalAdSpend: 0,
            averageDailyAdSpend: 0,
            activeAdDays: 0,
            daysInRange: 7,
            activePromos: [],
            dailySpendByDate: {},
        });
    });
});
//# sourceMappingURL=advertisingSchedule.test.js.map