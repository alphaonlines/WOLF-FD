import type { PermissionMode, UserRole } from "../../types";

export const MODULE_PERMISSION_KEYS = {
  DASHBOARD: "module.dashboard",
  SALES: "module.sales",
  PRODUCT_SEARCH: "module.product_search",
  CRM: "module.crm",
  SOCIAL: "module.social",
  TASKS: "module.tasks",
  KIOSKS: "module.kiosks",
  MESSAGE_BOARD: "module.message_board",
  SETTINGS: "module.settings",
  WOLFDEN: "module.wolfden",
  PULSE: "module.pulse",
  AMP: "module.amp",
  SHOP: "module.shop",
} as const;

export const DASHBOARD_CARD_PERMISSION_BY_ID: Record<string, string> = {
  sales: "card.dashboard.sales",
  "pulse-sales": "card.dashboard.pulse_sales",
  "pulse-alphaos": "card.dashboard.pulse_alphaos",
  "pulse-website": "card.dashboard.pulse_website",
  "pulse-social": "card.dashboard.pulse_social",
  "pulse-reviews": "card.dashboard.pulse_reviews",
  tasks: "card.dashboard.tasks",
  "den-ups": "card.dashboard.den_ups",
  "den-crm": "card.dashboard.den_crm",
  "den-board": "card.dashboard.den_board",
  "den-meeting": "card.dashboard.den_meeting",
  "den-tasks": "card.dashboard.den_tasks",
  "amp-social": "card.dashboard.amp_social",
  "amp-bot": "card.dashboard.amp_bot",
  "shop-search": "card.dashboard.shop_search",
  "shop-pos": "card.dashboard.shop_pos",
  "update-db": "card.dashboard.update_db",
  "manager-specials": "card.dashboard.manager_specials",
  kiosks: "card.dashboard.kiosks",
  "message-board": "card.dashboard.message_board",
  crm: "card.dashboard.crm",
  "social-posts": "card.dashboard.social_posts",
  "product-search": "card.dashboard.product_search",
};

export const FEATURE_PERMISSION_KEYS = {
  UPDATE_DB_PANEL: "feature.update_db_panel",
} as const;

export const MODULE_TO_DASHBOARD_CARD_KEYS: Record<string, string[]> = {
  [MODULE_PERMISSION_KEYS.DASHBOARD]: [
    DASHBOARD_CARD_PERMISSION_BY_ID["update-db"],
    DASHBOARD_CARD_PERMISSION_BY_ID["manager-specials"],
  ],
  [MODULE_PERMISSION_KEYS.SALES]: [
    DASHBOARD_CARD_PERMISSION_BY_ID.sales,
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-sales"],
  ],
  [MODULE_PERMISSION_KEYS.PRODUCT_SEARCH]: [DASHBOARD_CARD_PERMISSION_BY_ID["product-search"]],
  [MODULE_PERMISSION_KEYS.CRM]: [DASHBOARD_CARD_PERMISSION_BY_ID.crm],
  [MODULE_PERMISSION_KEYS.SOCIAL]: [
    DASHBOARD_CARD_PERMISSION_BY_ID["social-posts"],
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-social"],
  ],
  [MODULE_PERMISSION_KEYS.TASKS]: [
    DASHBOARD_CARD_PERMISSION_BY_ID.tasks,
    DASHBOARD_CARD_PERMISSION_BY_ID["den-tasks"],
  ],
  [MODULE_PERMISSION_KEYS.KIOSKS]: [
    DASHBOARD_CARD_PERMISSION_BY_ID.kiosks,
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-alphaos"],
  ],
  [MODULE_PERMISSION_KEYS.MESSAGE_BOARD]: [
    DASHBOARD_CARD_PERMISSION_BY_ID["message-board"],
    DASHBOARD_CARD_PERMISSION_BY_ID["den-board"],
  ],
  [MODULE_PERMISSION_KEYS.SETTINGS]: [],
  [MODULE_PERMISSION_KEYS.WOLFDEN]: [
    DASHBOARD_CARD_PERMISSION_BY_ID["den-ups"],
    DASHBOARD_CARD_PERMISSION_BY_ID["den-crm"],
    DASHBOARD_CARD_PERMISSION_BY_ID["den-board"],
    DASHBOARD_CARD_PERMISSION_BY_ID["den-meeting"],
    DASHBOARD_CARD_PERMISSION_BY_ID["den-tasks"],
  ],
  [MODULE_PERMISSION_KEYS.PULSE]: [
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-sales"],
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-alphaos"],
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-website"],
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-social"],
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-reviews"],
  ],
  [MODULE_PERMISSION_KEYS.AMP]: [
    DASHBOARD_CARD_PERMISSION_BY_ID["amp-social"],
    DASHBOARD_CARD_PERMISSION_BY_ID["amp-bot"],
  ],
  [MODULE_PERMISSION_KEYS.SHOP]: [
    DASHBOARD_CARD_PERMISSION_BY_ID["shop-search"],
    DASHBOARD_CARD_PERMISSION_BY_ID["shop-pos"],
  ],
};

const OWNER_DEFAULTS = [
  ...Object.values(MODULE_PERMISSION_KEYS),
  ...Object.values(DASHBOARD_CARD_PERMISSION_BY_ID),
  ...Object.values(FEATURE_PERMISSION_KEYS),
];

export const ROLE_FALLBACK_PERMISSION_KEYS: Record<UserRole, string[]> = {
  Owner: OWNER_DEFAULTS,
  Manager: [
    MODULE_PERMISSION_KEYS.DASHBOARD,
    MODULE_PERMISSION_KEYS.SALES,
    MODULE_PERMISSION_KEYS.PRODUCT_SEARCH,
    MODULE_PERMISSION_KEYS.CRM,
    MODULE_PERMISSION_KEYS.SOCIAL,
    MODULE_PERMISSION_KEYS.TASKS,
    MODULE_PERMISSION_KEYS.KIOSKS,
    MODULE_PERMISSION_KEYS.MESSAGE_BOARD,
    MODULE_PERMISSION_KEYS.WOLFDEN,
    MODULE_PERMISSION_KEYS.PULSE,
    MODULE_PERMISSION_KEYS.AMP,
    MODULE_PERMISSION_KEYS.SHOP,
    ...Object.values(DASHBOARD_CARD_PERMISSION_BY_ID),
    FEATURE_PERMISSION_KEYS.UPDATE_DB_PANEL,
  ],
  Sales: [
    MODULE_PERMISSION_KEYS.DASHBOARD,
    MODULE_PERMISSION_KEYS.PRODUCT_SEARCH,
    MODULE_PERMISSION_KEYS.CRM,
    MODULE_PERMISSION_KEYS.TASKS,
    MODULE_PERMISSION_KEYS.MESSAGE_BOARD,
    MODULE_PERMISSION_KEYS.WOLFDEN,
    MODULE_PERMISSION_KEYS.PULSE,
    MODULE_PERMISSION_KEYS.SHOP,
    DASHBOARD_CARD_PERMISSION_BY_ID.tasks,
    DASHBOARD_CARD_PERMISSION_BY_ID["message-board"],
    DASHBOARD_CARD_PERMISSION_BY_ID.crm,
    DASHBOARD_CARD_PERMISSION_BY_ID["shop-search"],
    DASHBOARD_CARD_PERMISSION_BY_ID["shop-pos"],
  ],
  Marketing: [
    MODULE_PERMISSION_KEYS.DASHBOARD,
    MODULE_PERMISSION_KEYS.TASKS,
    MODULE_PERMISSION_KEYS.MESSAGE_BOARD,
    MODULE_PERMISSION_KEYS.PULSE,
    MODULE_PERMISSION_KEYS.AMP,
    DASHBOARD_CARD_PERMISSION_BY_ID.tasks,
    DASHBOARD_CARD_PERMISSION_BY_ID["message-board"],
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-social"],
    DASHBOARD_CARD_PERMISSION_BY_ID["pulse-reviews"],
    DASHBOARD_CARD_PERMISSION_BY_ID["amp-social"],
    DASHBOARD_CARD_PERMISSION_BY_ID["amp-bot"],
  ],
};

export function hasPermission(
  roles: UserRole[],
  explicitPermissions: string[],
  permissionMode: PermissionMode | undefined,
  permissionKey: string
): boolean {
  if (roles.includes("Owner") && OWNER_DEFAULTS.includes(permissionKey)) {
    return true;
  }

  const explicit = Array.isArray(explicitPermissions) ? explicitPermissions.filter(Boolean) : [];
  if (permissionMode === "explicit") return explicit.includes(permissionKey);

  const fallback = new Set<string>();
  for (const role of roles) {
    for (const key of ROLE_FALLBACK_PERMISSION_KEYS[role] || []) {
      fallback.add(key);
    }
  }
  return fallback.has(permissionKey);
}

export function buildRoleFallbackPermissionMap(role: UserRole): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of ROLE_FALLBACK_PERMISSION_KEYS[role] || []) {
    out[key] = true;
  }
  return out;
}
