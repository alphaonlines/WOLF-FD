export type PageContext = {
  pageName: string;
  module: string;
  userRole: string;
  keyMetricsVisible: string[];
  suggestedActions: string[];
};

const CONTEXT_DESCRIPTIONS: Record<string, string> = {
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

export function buildSystemPrompt(
  userName: string,
  assistantName: string,
  pageContext: PageContext
): string {
  const contextDesc =
    CONTEXT_DESCRIPTIONS[pageContext.module] ?? CONTEXT_DESCRIPTIONS[""];

  const metricsLine =
    pageContext.keyMetricsVisible.length > 0
      ? `Visible metrics on screen: ${pageContext.keyMetricsVisible.join(", ")}.`
      : "";

  const actionsLine =
    pageContext.suggestedActions.length > 0
      ? `Available actions on this page: ${pageContext.suggestedActions.join(", ")}.`
      : "";

  return [
    `You are ${assistantName}, the personal AI assistant embedded in the WOLF-FD dashboard for Furniture Distributors.`,
    `You are helping ${userName}, who has the role of ${pageContext.userRole}.`,
    `They are currently ${contextDesc}.`,
    metricsLine,
    actionsLine,
    `Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
    `Keep your responses concise — 2 to 4 sentences unless the user asks for detail.`,
    "Be friendly, practical, and direct. You know this is a furniture retail business.",
    "Never make up specific sales numbers or customer data you haven't been told.",
    "If you don't know something, say so and suggest where to look in the dashboard.",
  ].filter(Boolean).join("\n");
}
