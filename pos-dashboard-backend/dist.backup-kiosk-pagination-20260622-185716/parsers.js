"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRM_CHANNELS = exports.CRM_STAGES = void 0;
exports.parseDateParam = parseDateParam;
exports.parseTextParam = parseTextParam;
exports.parseTaskStatus = parseTaskStatus;
exports.parseTaskPriority = parseTaskPriority;
exports.parseTaskDeadline = parseTaskDeadline;
exports.parseIntBody = parseIntBody;
exports.parseTaskIdParam = parseTaskIdParam;
exports.parseCrmLeadId = parseCrmLeadId;
exports.parseCrmStage = parseCrmStage;
exports.parseCrmChannel = parseCrmChannel;
exports.parseCrmDate = parseCrmDate;
exports.parseCrmBool = parseCrmBool;
function parseDateParam(v, fallback) {
    if (!v || typeof v !== "string")
        return fallback;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
        return fallback;
    return v;
}
function parseTextParam(v) {
    if (!v || typeof v !== "string")
        return null;
    const t = v.trim();
    return t ? t : null;
}
function parseTaskStatus(v) {
    if (!v || typeof v !== "string")
        return null;
    const t = v.trim().toUpperCase();
    if (t === "TODO" || t === "IN_PROGRESS" || t === "DONE")
        return t;
    return null;
}
function parseTaskPriority(v) {
    if (!v || typeof v !== "string")
        return null;
    const t = v.trim().toLowerCase();
    if (t === "low" || t === "medium" || t === "high")
        return t;
    return null;
}
function parseTaskDeadline(v) {
    if (v === null)
        return null;
    if (v === undefined)
        return null;
    if (typeof v !== "string")
        return null;
    const t = v.trim();
    if (!t)
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
        return null;
    return t;
}
function parseIntBody(v) {
    if (v === null || v === undefined)
        return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n))
        return null;
    return Math.trunc(n);
}
function parseTaskIdParam(v) {
    if (!v || typeof v !== "string")
        return null;
    const n = Number(v);
    if (!Number.isFinite(n))
        return null;
    const id = Math.trunc(n);
    return id > 0 ? id : null;
}
exports.CRM_STAGES = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"];
exports.CRM_CHANNELS = ["SMS", "Webchat", "Facebook", "Instagram", "Phone"];
function parseCrmLeadId(v) {
    if (!v || typeof v !== "string")
        return null;
    const id = v.trim();
    return id || null;
}
function parseCrmStage(v) {
    if (!v || typeof v !== "string")
        return null;
    const t = v.trim();
    return exports.CRM_STAGES.includes(t) ? t : null;
}
function parseCrmChannel(v) {
    if (!v || typeof v !== "string")
        return null;
    const t = v.trim();
    return exports.CRM_CHANNELS.includes(t) ? t : null;
}
function parseCrmDate(v) {
    if (v === null || v === undefined)
        return null;
    if (typeof v !== "string")
        return null;
    const t = v.trim();
    if (!t)
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
        return null;
    return t;
}
function parseCrmBool(v) {
    if (typeof v === "boolean")
        return v;
    if (typeof v === "string") {
        const t = v.trim().toLowerCase();
        if (t === "true")
            return true;
        if (t === "false")
            return false;
    }
    return null;
}
//# sourceMappingURL=parsers.js.map