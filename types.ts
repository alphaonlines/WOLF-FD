export enum SalesPeriod {
  THIS_WEEK = "THIS_WEEK",
  LAST_YEAR = "LAST_YEAR",
  LAST_MONTH = "LAST_MONTH",
}

export interface SalesData {
  name: string;
  sales: number;
  margin: number;
  itemsSold: number;
}

export interface StoreData {
  storeName: string;
  revenue: number;
  profit: number;
}

export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  deadline: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  sortIndex?: number;
  createdAt?: string;
  respondedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export enum PostStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface SocialPost {
  id: string;
  platform: "Instagram" | "Facebook" | "Google" | "Pinterest";
  content: string;
  imagePlaceholder: string;
  status: PostStatus;
  author: string;
  scheduledAt?: string;
  feedback?: string;
}

export type CRMLeadStage = "New" | "Contacted" | "Appointment" | "Quoted" | "Won" | "Lost";
export type CRMLeadChannel = "SMS" | "Webchat" | "Facebook" | "Instagram" | "Phone";

export interface CRMLead {
  id: string;
  name: string;
  phone: string;
  channel: CRMLeadChannel;
  source: string;
  interest: string;
  budget: string;
  store: string;
  owner: string;
  ownerUserId?: string | null;
  stage: CRMLeadStage;
  nextAction: string;
  dueDate: string;
  lastMessage: string;
  lastTouch: string;
  notes: string;
}

export type CRMUpsLane = "Unattended" | "Be-Back" | "Quote Follow-up";
export type CRMUpsPriority = "Hot" | "Today" | "Nurture";

export interface CRMUpsItem {
  id: string;
  customer: string;
  task: string;
  owner: string;
  ownerUserId?: string | null;
  lane: CRMUpsLane;
  priority: CRMUpsPriority;
  dueAt: string;
  channel: CRMLeadChannel;
  done: boolean;
  startedAt?: string;
}

export interface CRMOwnerOption {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}

export interface CRMAutomationRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export type UserRole = "Owner" | "Manager" | "Sales" | "Marketing";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  permissions: string[];
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roles: UserRole[];
  createdAt?: string;
  updatedAt?: string;
}

export type PermissionScope = "module" | "dashboard_card" | "feature";

export interface PermissionCatalogEntry {
  key: string;
  label: string;
  scope: PermissionScope;
  description: string;
}

export interface RolePermissionRow {
  roleKey: UserRole;
  label: string;
  permissions: Record<string, boolean>;
}

export interface BoardPost {
  id: string;
  channel: string;
  body: string;
  priority: boolean;
  authorName: string;
  authorEmail: string;
  createdAt: string;
}

export interface BoardComment {
  id: string;
  postId: string;
  body: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
}
