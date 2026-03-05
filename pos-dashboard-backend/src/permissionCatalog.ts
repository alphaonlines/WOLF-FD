export type PermissionScope = "module" | "dashboard_card" | "feature";

export type PermissionCatalogEntry = {
  key: string;
  label: string;
  scope: PermissionScope;
  description: string;
};

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
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
    "module.crm",
    "module.social",
    "module.tasks",
    "module.kiosks",
    "module.message_board",
    "card.dashboard.sales",
    "card.dashboard.tasks",
    "card.dashboard.update_db",
    "card.dashboard.manager_specials",
    "card.dashboard.kiosks",
    "card.dashboard.message_board",
    "card.dashboard.crm",
    "card.dashboard.social_posts",
    "feature.update_db_panel",
  ],
  Sales: [
    "module.dashboard",
    "module.crm",
    "module.tasks",
    "module.message_board",
    "card.dashboard.tasks",
    "card.dashboard.message_board",
    "card.dashboard.crm",
  ],
  Marketing: [
    "module.dashboard",
    "module.social",
    "module.tasks",
    "module.message_board",
    "card.dashboard.tasks",
    "card.dashboard.message_board",
    "card.dashboard.social_posts",
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
