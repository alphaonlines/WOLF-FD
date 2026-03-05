import type { UserRole } from "../../types";

export const MODULE_PERMISSION_KEYS = {
  DASHBOARD: "module.dashboard",
  SALES: "module.sales",
  CRM: "module.crm",
  SOCIAL: "module.social",
  TASKS: "module.tasks",
  KIOSKS: "module.kiosks",
  MESSAGE_BOARD: "module.message_board",
  SETTINGS: "module.settings",
} as const;

export const DASHBOARD_CARD_PERMISSION_BY_ID: Record<string, string> = {
  sales: "card.dashboard.sales",
  tasks: "card.dashboard.tasks",
  "update-db": "card.dashboard.update_db",
  "manager-specials": "card.dashboard.manager_specials",
  kiosks: "card.dashboard.kiosks",
  "message-board": "card.dashboard.message_board",
  crm: "card.dashboard.crm",
  "social-posts": "card.dashboard.social_posts",
};

export const FEATURE_PERMISSION_KEYS = {
  UPDATE_DB_PANEL: "feature.update_db_panel",
} as const;

const OWNER_DEFAULTS = [
  ...Object.values(MODULE_PERMISSION_KEYS),
  ...Object.values(DASHBOARD_CARD_PERMISSION_BY_ID),
  ...Object.values(FEATURE_PERMISSION_KEYS),
];

const ROLE_FALLBACK_PERMISSION_KEYS: Record<UserRole, string[]> = {
  Owner: OWNER_DEFAULTS,
  Manager: [
    MODULE_PERMISSION_KEYS.DASHBOARD,
    MODULE_PERMISSION_KEYS.SALES,
    MODULE_PERMISSION_KEYS.CRM,
    MODULE_PERMISSION_KEYS.SOCIAL,
    MODULE_PERMISSION_KEYS.TASKS,
    MODULE_PERMISSION_KEYS.KIOSKS,
    MODULE_PERMISSION_KEYS.MESSAGE_BOARD,
    ...Object.values(DASHBOARD_CARD_PERMISSION_BY_ID),
    FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL,
  ],
  Sales: [
    MODULE_PERMISSION_KEYS.DASHBOARD,
    MODULE_PERMISSION_KEYS.CRM,
    MODULE_PERMISSION_KEYS.TASKS,
    MODULE_PERMISSION_KEYS.MESSAGE_BOARD,
    DASHBOARD_CARD_PERMISSION_BY_ID.tasks,
    DASHBOARD_CARD_PERMISSION_BY_ID["message-board"],
    DASHBOARD_CARD_PERMISSION_BY_ID.crm,
  ],
  Marketing: [
    MODULE_PERMISSION_KEYS.DASHBOARD,
    MODULE_PERMISSION_KEYS.SOCIAL,
    MODULE_PERMISSION_KEYS.TASKS,
    MODULE_PERMISSION_KEYS.MESSAGE_BOARD,
    DASHBOARD_CARD_PERMISSION_BY_ID.tasks,
    DASHBOARD_CARD_PERMISSION_BY_ID["message-board"],
    DASHBOARD_CARD_PERMISSION_BY_ID["social-posts"],
  ],
};

export function hasPermission(roles: UserRole[], explicitPermissions: string[], permissionKey: string): boolean {
  const explicit = Array.isArray(explicitPermissions) ? explicitPermissions.filter(Boolean) : [];
  if (explicit.length > 0) return explicit.includes(permissionKey);

  const fallback = new Set<string>();
  for (const role of roles) {
    for (const key of ROLE_FALLBACK_PERMISSION_KEYS[role] || []) {
      fallback.add(key);
    }
  }
  return fallback.has(permissionKey);
}
