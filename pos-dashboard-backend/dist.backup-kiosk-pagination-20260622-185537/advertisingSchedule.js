"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAdvertisingSpendSummary = calculateAdvertisingSpendSummary;
const advertisingScheduleData_1 = require("./advertisingScheduleData");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day) {
        return null;
    }
    return parsed;
}
function formatIsoDate(value) {
    return value.toISOString().slice(0, 10);
}
function addDays(value, days) {
    return new Date(value.getTime() + days * MS_PER_DAY);
}
function daysBetween(start, endExclusive) {
    return Math.max(0, Math.round((endExclusive.getTime() - start.getTime()) / MS_PER_DAY));
}
function roundCurrency(value) {
    return Math.round((value + 0.0000001) * 100) / 100;
}
function calculateAdvertisingSpendSummary(start, endExclusive, schedule = advertisingScheduleData_1.ADVERTISING_SCHEDULE_2026) {
    const rangeStart = parseIsoDate(start);
    const rangeEndExclusive = parseIsoDate(endExclusive);
    const daysInRange = rangeStart && rangeEndExclusive ? daysBetween(rangeStart, rangeEndExclusive) : 0;
    if (!rangeStart || !rangeEndExclusive || daysInRange <= 0) {
        return {
            totalAdSpend: 0,
            averageDailyAdSpend: 0,
            activeAdDays: 0,
            daysInRange: 0,
            dailySpendByDate: {},
            activePromos: [],
        };
    }
    const activePromos = [];
    const rawDailySpendByDate = {};
    for (const entry of schedule) {
        const promoStart = parseIsoDate(entry.start);
        const promoEndInclusive = parseIsoDate(entry.end);
        if (!promoStart || !promoEndInclusive || !isFinite(entry.totalSpend) || entry.totalSpend <= 0) {
            continue;
        }
        const promoEndExclusive = addDays(promoEndInclusive, 1);
        const promoDays = daysBetween(promoStart, promoEndExclusive);
        if (promoDays <= 0)
            continue;
        const overlapStart = rangeStart > promoStart ? rangeStart : promoStart;
        const overlapEnd = rangeEndExclusive < promoEndExclusive ? rangeEndExclusive : promoEndExclusive;
        const overlapDays = daysBetween(overlapStart, overlapEnd);
        if (overlapDays <= 0)
            continue;
        const dailySpend = entry.totalSpend / promoDays;
        const proratedSpend = dailySpend * overlapDays;
        for (let day = overlapStart; day < overlapEnd; day = addDays(day, 1)) {
            const dayKey = formatIsoDate(day);
            rawDailySpendByDate[dayKey] = (rawDailySpendByDate[dayKey] ?? 0) + dailySpend;
        }
        activePromos.push({
            promoName: entry.promoName,
            offer: entry.offer,
            start: formatIsoDate(overlapStart),
            end: formatIsoDate(addDays(overlapEnd, -1)),
            overlapDays,
            proratedSpend: roundCurrency(proratedSpend),
            dailySpend: roundCurrency(dailySpend),
        });
    }
    const activeAdDays = Object.keys(rawDailySpendByDate).length;
    const totalAdSpend = roundCurrency(Object.values(rawDailySpendByDate).reduce((sum, value) => sum + value, 0));
    const dailySpendByDate = Object.fromEntries(Object.entries(rawDailySpendByDate).map(([day, spend]) => [day, roundCurrency(spend)]));
    return {
        totalAdSpend,
        averageDailyAdSpend: activeAdDays > 0 ? roundCurrency(totalAdSpend / activeAdDays) : 0,
        activeAdDays,
        daysInRange,
        dailySpendByDate,
        activePromos,
    };
}
//# sourceMappingURL=advertisingSchedule.js.map