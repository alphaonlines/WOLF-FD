export type PermissionScope = "module" | "dashboard_card" | "feature";

export type PermissionCatalogEntry = {
  key: string;
  label: string;
  scope: PermissionScope;
  description: string;
};

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  // ── Modules ──────────────────────────────────────────────────────────────
  {
    key: "module.dashboard",
    label: "Dashboard Module",
    scope: "module",
    description: "Access the main dashboard overview workspace.",
  },
  {
    key: "module.sales",
    label: "Sales Module",
    scope: "module",
    description: "Access sales analytics, reports, and drilldowns.",
  },
  {
    key: "module.product_search",
    label: "Product Search Module",
    scope: "module",
    description: "Access the dedicated furniture product search workspace.",
  },
  {
    key: "module.crm",
    label: "CRM Module",
    scope: "module",
    description: "Access CRM leads, pipeline, and follow-up tools.",
  },
  {
    key: "module.social",
    label: "Social Posts Module",
    scope: "module",
    description: "Access social content analytics and post reporting.",
  },
  {
    key: "module.tasks",
    label: "Tasks Module",
    scope: "module",
    description: "Access shared task board and assignments.",
  },
  {
    key: "module.kiosks",
    label: "AlphaOS Module",
    scope: "module",
    description: "Access kiosk health and AlphaOS status views.",
  },
  {
    key: "module.message_board",
    label: "Message Board Module",
    scope: "module",
    description: "Access team announcements and message board threads.",
  },
  {
    key: "module.settings",
    label: "Settings Module",
    scope: "module",
    description: "Access owner settings, users, and access controls.",
  },
  {
    key: "module.wolfden",
    label: "Den Module",
    scope: "module",
    description: "Access the Wolf Den workspace with UPS queue, CRM, board, and meeting views.",
  },
  {
    key: "module.pulse",
    label: "Pulse Module",
    scope: "module",
    description: "Access the Pulse analytics hub for sales, AlphaOS, website, social, and reviews.",
  },
  {
    key: "module.amp",
    label: "AMP Module",
    scope: "module",
    description: "Access A.I., Marketing, and Promotions tools including social posts and bot.",
  },
  {
    key: "module.shop",
    label: "Shop Module",
    scope: "module",
    description: "Access the Shop workspace for product search and POS integrations.",
  },
  // ── Dashboard Cards ───────────────────────────────────────────────────────
  {
    key: "card.dashboard.sales",
    label: "Dashboard Card: Sales Analysis",
    scope: "dashboard_card",
    description: "Show/open the Sales Analysis card on dashboard overview.",
  },
  {
    key: "card.dashboard.tasks",
    label: "Dashboard Card: Task Manager",
    scope: "dashboard_card",
    description: "Show/open the Task Manager card on dashboard overview.",
  },
  {
    key: "card.dashboard.update_db",
    label: "Dashboard Card: Update Database",
    scope: "dashboard_card",
    description: "Show/open the Update Database card on dashboard overview.",
  },
  {
    key: "card.dashboard.manager_specials",
    label: "Dashboard Card: Manager Specials",
    scope: "dashboard_card",
    description: "Show/open the Manager Specials uploader card.",
  },
  {
    key: "card.dashboard.kiosks",
    label: "Dashboard Card: AlphaOS",
    scope: "dashboard_card",
    description: "Show/open the AlphaOS card on dashboard overview.",
  },
  {
    key: "card.dashboard.message_board",
    label: "Dashboard Card: Message Board",
    scope: "dashboard_card",
    description: "Show/open the Message Board card on dashboard overview.",
  },
  {
    key: "card.dashboard.crm",
    label: "Dashboard Card: CRM",
    scope: "dashboard_card",
    description: "Show/open the CRM card on dashboard overview.",
  },
  {
    key: "card.dashboard.social_posts",
    label: "Dashboard Card: Social Posts",
    scope: "dashboard_card",
    description: "Show/open the Social Posts card on dashboard overview.",
  },
  {
    key: "card.dashboard.product_search",
    label: "Dashboard Card: Product Search",
    scope: "dashboard_card",
    description: "Show/open the Product Search card on dashboard overview.",
  },
  {
    key: "card.dashboard.pulse_sales",
    label: "Pulse Card: Sales",
    scope: "dashboard_card",
    description: "Show the Pulse sales analytics card.",
  },
  {
    key: "card.dashboard.pulse_alphaos",
    label: "Pulse Card: AlphaOS",
    scope: "dashboard_card",
    description: "Show the Pulse AlphaOS status card.",
  },
  {
    key: "card.dashboard.pulse_website",
    label: "Pulse Card: Website",
    scope: "dashboard_card",
    description: "Show the Pulse website analytics card.",
  },
  {
    key: "card.dashboard.pulse_social",
    label: "Pulse Card: Social",
    scope: "dashboard_card",
    description: "Show the Pulse social analytics card.",
  },
  {
    key: "card.dashboard.pulse_reviews",
    label: "Pulse Card: Reviews",
    scope: "dashboard_card",
    description: "Show the Pulse reviews card.",
  },
  {
    key: "card.dashboard.den_ups",
    label: "Den Card: UPS Queue",
    scope: "dashboard_card",
    description: "Show the Den UPS (up) queue card.",
  },
  {
    key: "card.dashboard.den_crm",
    label: "Den Card: CRM",
    scope: "dashboard_card",
    description: "Show the Den CRM card.",
  },
  {
    key: "card.dashboard.den_board",
    label: "Den Card: Board",
    scope: "dashboard_card",
    description: "Show the Den message board card.",
  },
  {
    key: "card.dashboard.den_meeting",
    label: "Den Card: Meeting",
    scope: "dashboard_card",
    description: "Show the Den meeting card.",
  },
  {
    key: "card.dashboard.den_tasks",
    label: "Den Card: Tasks",
    scope: "dashboard_card",
    description: "Show the Den tasks card.",
  },
  {
    key: "card.dashboard.amp_social",
    label: "AMP Card: Social",
    scope: "dashboard_card",
    description: "Show the AMP social posts card.",
  },
  {
    key: "card.dashboard.amp_bot",
    label: "AMP Card: Bot",
    scope: "dashboard_card",
    description: "Show the AMP AI bot card.",
  },
  {
    key: "card.dashboard.shop_search",
    label: "Shop Card: Product Search",
    scope: "dashboard_card",
    description: "Show the Shop product search card.",
  },
  {
    key: "card.dashboard.shop_pos",
    label: "Shop Card: POS",
    scope: "dashboard_card",
    description: "Show the Shop POS card.",
  },
  // ── Features ──────────────────────────────────────────────────────────────
  {
    key: "feature.update_db_panel",
    label: "Feature: Update DB Sidebar Button",
    scope: "feature",
    description: "Allow opening the floating Update DB panel from the sidebar.",
  },
];

const ownerDefaults = PERMISSION_CATALOG.map((entry) => entry.key);

export const ROLE_DEFAULT_PERMISSION_KEYS: Record<string, string[]> = {
  Owner: ownerDefaults,
  Manager: [
    "module.dashboard",
    "module.sales",
    "module.product_search",
    "module.crm",
    "module.social",
    "module.tasks",
    "module.kiosks",
    "module.message_board",
    "module.wolfden",
    "module.pulse",
    "module.amp",
    "module.shop",
    ...PERMISSION_CATALOG.filter((e) => e.scope === "dashboard_card").map((e) => e.key),
    "feature.update_db_panel",
  ],
  Sales: [
    "module.dashboard",
    "module.product_search",
    "module.crm",
    "module.tasks",
    "module.message_board",
    "module.wolfden",
    "module.pulse",
    "module.shop",
    "card.dashboard.tasks",
    "card.dashboard.message_board",
    "card.dashboard.crm",
    "card.dashboard.shop_search",
    "card.dashboard.shop_pos",
  ],
  Marketing: [
    "module.dashboard",
    "module.tasks",
    "module.message_board",
    "module.pulse",
    "module.amp",
    "card.dashboard.tasks",
    "card.dashboard.message_board",
    "card.dashboard.pulse_social",
    "card.dashboard.pulse_reviews",
    "card.dashboard.amp_social",
    "card.dashboard.amp_bot",
  ],
  Support: [
    "module.dashboard",
    "module.tasks",
    "module.message_board",
    "card.dashboard.tasks",
    "card.dashboard.message_board",
  ],
};

const VALID_PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((entry) => entry.key));

export function normalizePermissionKeyList(raw: any): string[] {
  const inList = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of inList) {
    const key = String(value || "").trim();
    if (!key || seen.has(key)) continue;
    if (!VALID_PERMISSION_KEYS.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function isValidPermissionKey(key: string): boolean {
  return VALID_PERMISSION_KEYS.has(key);
}

export function getRoleDefaultPermissionKeys(roleKey: string): string[] {
  return ROLE_DEFAULT_PERMISSION_KEYS[roleKey] || [];
}
