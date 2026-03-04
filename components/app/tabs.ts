import type { UserRole } from '../../types';

export enum Tab {
  DASHBOARD = 'DASHBOARD',
  SALES = 'SALES',
  CRM = 'CRM',
  SOCIAL = 'SOCIAL',
  KIOSKS = 'KIOSKS',
  MESSAGE_BOARD = 'MESSAGE_BOARD',
  TASKS = 'TASKS',
  ADMIN = 'ADMIN',
}

export const TAB_ACCESS: Record<Tab, UserRole[]> = {
  [Tab.DASHBOARD]: ['Owner', 'Manager', 'Sales', 'Marketing'],
  [Tab.SALES]: ['Owner', 'Manager'],
  [Tab.CRM]: ['Owner', 'Manager', 'Sales'],
  [Tab.SOCIAL]: ['Owner', 'Manager', 'Marketing'],
  [Tab.KIOSKS]: ['Owner', 'Manager'],
  [Tab.MESSAGE_BOARD]: ['Owner', 'Manager', 'Sales', 'Marketing'],
  [Tab.TASKS]: ['Owner', 'Manager', 'Sales', 'Marketing'],
  [Tab.ADMIN]: ['Owner'],
};

export const canAccessTab = (roles: UserRole[], tab: Tab): boolean => {
  const allowed = TAB_ACCESS[tab] || [];
  return roles.some((role) => allowed.includes(role));
};

export const getTabTitle = (tab: Tab): string => {
  switch (tab) {
    case Tab.DASHBOARD:
      return 'WOLF FD Dashboard';
    case Tab.SALES:
      return 'Sales Analysis';
    case Tab.CRM:
      return 'CRM';
    case Tab.SOCIAL:
      return 'Social Posts';
    case Tab.KIOSKS:
      return 'AlphaOS Status';
    case Tab.MESSAGE_BOARD:
      return 'Message Board';
    case Tab.ADMIN:
      return 'Admin Users';
    case Tab.TASKS:
      return 'Tasks';
    default:
      return 'WOLF FD Dashboard';
  }
};
