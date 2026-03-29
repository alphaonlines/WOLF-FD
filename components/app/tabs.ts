import type { PermissionMode, UserRole } from '../../types';
import { hasPermission, MODULE_PERMISSION_KEYS } from './permissions';

export enum Tab {
  DASHBOARD = 'DASHBOARD',
  SALES = 'SALES',
  PRODUCT_SEARCH = 'PRODUCT_SEARCH',
  CRM = 'CRM',
  SOCIAL = 'SOCIAL',
  KIOSKS = 'KIOSKS',
  MESSAGE_BOARD = 'MESSAGE_BOARD',
  TASKS = 'TASKS',
  ADMIN = 'ADMIN',
}

export const TAB_PERMISSION_KEYS: Record<Tab, string> = {
  [Tab.DASHBOARD]: MODULE_PERMISSION_KEYS.DASHBOARD,
  [Tab.SALES]: MODULE_PERMISSION_KEYS.SALES,
  [Tab.PRODUCT_SEARCH]: MODULE_PERMISSION_KEYS.PRODUCT_SEARCH,
  [Tab.CRM]: MODULE_PERMISSION_KEYS.CRM,
  [Tab.SOCIAL]: MODULE_PERMISSION_KEYS.SOCIAL,
  [Tab.KIOSKS]: MODULE_PERMISSION_KEYS.KIOSKS,
  [Tab.MESSAGE_BOARD]: MODULE_PERMISSION_KEYS.MESSAGE_BOARD,
  [Tab.TASKS]: MODULE_PERMISSION_KEYS.TASKS,
  [Tab.ADMIN]: MODULE_PERMISSION_KEYS.SETTINGS,
};

export const canAccessTab = (
  roles: UserRole[],
  permissions: string[],
  permissionMode: PermissionMode | undefined,
  tab: Tab
): boolean => {
  const permissionKey = TAB_PERMISSION_KEYS[tab];
  return hasPermission(roles, permissions, permissionMode, permissionKey);
};

export const getTabTitle = (tab: Tab): string => {
  switch (tab) {
    case Tab.DASHBOARD:
      return 'WOLF FD Dashboard';
    case Tab.SALES:
      return 'Sales Analysis';
    case Tab.PRODUCT_SEARCH:
      return 'Product Search';
    case Tab.CRM:
      return 'Alpha Pulse CRM';
    case Tab.SOCIAL:
      return 'Social Posts';
    case Tab.KIOSKS:
      return 'AlphaOS Status';
    case Tab.MESSAGE_BOARD:
      return 'Message Board';
    case Tab.ADMIN:
      return 'Settings';
    case Tab.TASKS:
      return 'Tasks';
    default:
      return 'WOLF FD Dashboard';
  }
};
