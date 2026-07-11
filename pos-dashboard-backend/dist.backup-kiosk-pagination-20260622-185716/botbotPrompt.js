"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
const CONTEXT_DESCRIPTIONS = {
    sales: "viewing the Sales Dashboard with performance analytics and reports",
    crm: "working in the CRM workspace managing leads and follow-ups",
    crm_planner: "planning tasks and appointments in the CRM Planner",
    kiosks: "monitoring AlphaOS kiosk and tablet device status",
    board: "on the Message Board communicating with their team",
    amp: "in the AMP workspace managing marketing and social content",
    amp_bot: "in the WOLFbot AI/call routing configuration panel",
    shop: "in the Shop workspace browsing inventory and catalogs",
    pulse: "viewing AlphaPulse business intelligence data",
    den: "in the Wolfden workspace",
    tasks: "managing their task list",
    settings: "in the Owner Settings panel",
    "": "on the main dashboard overview",
};
const SALES_PAGE_MANUAL = [
    "Sales page guide:",
    "- Sales Overview summarizes delivered-ticket sales, transaction count, and average ticket for the selected delivered-date range.",
    "- Finance Overview shows financed transaction count, financed amount, finance balance, and finance fees.",
    "- Low Margin highlights tickets where item-report profit divided by item sales is weak; use it to spot discounting, bad cost data, or coaching opportunities.",
    "- Pro1st Attach Rate is Pro1st item sales divided by eligible non-mattress item sales for the selected range.",
    "- Pro1st profit tiers group attached Pro1st tickets by estimated Pro1st profit: below 100, 100-200, and 200+.",
    "- Leaderboards compare salesperson and store performance for the same selected range and filters.",
    "- Item, category, and manufacturer cards depend on item report data; warn the user when item data is missing.",
    "- Always distinguish sales-report data from item-report data, and never invent ticket/customer details that are not in the provided snapshot.",
].join("\n");
const formatFilterLine = (filters) => {
    if (!filters)
        return "";
    const active = Object.entries(filters)
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
        .map(([key, value]) => `${key}: ${value}`);
    return active.length ? `Active filters: ${active.join(", ")}.` : "";
};
function buildSystemPrompt(userName, assistantName, pageContext, liveContextSnapshot) {
    const contextDesc = CONTEXT_DESCRIPTIONS[pageContext.module] ?? CONTEXT_DESCRIPTIONS[""];
    const metricsLine = pageContext.keyMetricsVisible.length > 0
        ? `Visible metrics on screen: ${pageContext.keyMetricsVisible.join(", ")}.`
        : "";
    const actionsLine = pageContext.suggestedActions.length > 0
        ? `Available actions on this page: ${pageContext.suggestedActions.join(", ")}.`
        : "";
    const rangeLine = pageContext.dateRange
        ? `Selected date range: ${pageContext.dateRange.label || `${pageContext.dateRange.start} to ${pageContext.dateRange.end}`} (${pageContext.dateRange.start} through ${pageContext.dateRange.end}, end exclusive).`
        : "";
    const filterLine = formatFilterLine(pageContext.filters);
    const sectionsLine = pageContext.visibleSections && pageContext.visibleSections.length > 0
        ? `Visible sections: ${pageContext.visibleSections.join(", ")}.`
        : "";
    const warningsLine = pageContext.dataWarnings && pageContext.dataWarnings.length > 0
        ? `Dashboard data warnings: ${pageContext.dataWarnings.join(" ")}`
        : "";
    const pageManual = pageContext.pageId === "sales-dashboard" || pageContext.module === "sales"
        ? SALES_PAGE_MANUAL
        : "";
    const snapshotLine = liveContextSnapshot
        ? `Live dashboard snapshot:\n${liveContextSnapshot}`
        : "";
    return [
        `You are ${assistantName}, the personal AI assistant embedded in the WOLF-FD dashboard for Furniture Distributors.`,
        `You are helping ${userName}, who has the role of ${pageContext.userRole}.`,
        `They are currently ${contextDesc}.`,
        metricsLine,
        actionsLine,
        rangeLine,
        filterLine,
        sectionsLine,
        warningsLine,
        pageManual,
        snapshotLine,
        `Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
        `Keep your responses concise — 2 to 4 sentences unless the user asks for detail.`,
        "Be friendly, practical, and direct. You know this is a furniture retail business.",
        "Never make up specific sales numbers or customer data you haven't been told.",
        "If you don't know something, say so and suggest where to look in the dashboard.",
    ].filter(Boolean).join("\n");
}
//# sourceMappingURL=botbotPrompt.js.map