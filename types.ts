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
  taskType?: string;
  taskMeta?: Record<string, any>;
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

export type UpsQueueStatus = "waiting" | "working" | "on_break";
export type UpsQueueCustomerType = "Regular Up" | "B-Back";

export interface CRMUpsActiveCustomer {
  id: string;
  queueEntryId: string;
  customer: string;
  phone: string | null;
  email: string | null;
  customerType: UpsQueueCustomerType | null;
  customerDetails: string | null;
  city: string | null;
  wantsNeeds: string | null;
  didPurchase: boolean | null;
  purchaseAmount: number | null;
  objectionNote: string | null;
  startedAt: string | null;
  historyId: string | null;
}

export interface CRMUpsHistoryEntry {
  id: string;
  queueEntryId: string;
  store: string;
  rep: string;
  customer: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  customerType: UpsQueueCustomerType | null;
  customerDetails: string | null;
  wantsNeeds: string | null;
  didPurchase: boolean | null;
  purchaseAmount: number | null;
  objectionNote: string | null;
  startedAt: string | null;
  completedAt: string | null;
  weatherLocation: string | null;
  weatherSummary: string | null;
  weatherTempF: number | null;
  weatherPrecipPct: number | null;
  weatherWindMph: number | null;
  weatherFetchedAt: string | null;
  endedReason: string | null;
  countsAsUp: boolean;
}

export interface CRMUpsQueueItem {
  id: string;
  store: string;
  rep: string;
  repUserId: string | null;
  status: UpsQueueStatus;
  queuePosition: number;
  checkedInAt: string | null;
  currentCustomer: string | null;
  currentCustomerType: UpsQueueCustomerType | null;
  currentCustomerDetails: string | null;
  startedAt: string | null;
  currentWeatherLocation: string | null;
  currentWeatherSummary: string | null;
  currentWeatherTempF: number | null;
  currentWeatherPrecipPct: number | null;
  currentWeatherWindMph: number | null;
  currentWeatherFetchedAt: string | null;
  liveWeatherLocation: string | null;
  liveWeatherSummary: string | null;
  liveWeatherTempF: number | null;
  liveWeatherPrecipPct: number | null;
  liveWeatherWindMph: number | null;
  liveWeatherFetchedAt: string | null;
  helpedTodayCount: number;
  activeCustomerCount: number;
  activeCustomers: CRMUpsActiveCustomer[];
}

export interface CRMCustomerOrder {
  saleId: string;
  saleDate: string | null;
  deliveryConfirmedDate: string | null;
  estDeliveryDate: string | null;
  location: string;
  salesperson: string;
  receiptNo: string;
  customerName: string;
  phone: string;
  grandTotal: number | null;
  saleStatus: string;
}

export interface CRMCustomerAccount {
  id: string;
  name: string;
  phone: string;
  email: string;
  store: string;
  channel: CRMLeadChannel;
  source: string;
  interest: string;
  budget: string;
  owner: string;
  ownerUserId?: string | null;
  stage: CRMLeadStage;
  nextAction: string;
  dueDate: string;
  lastMessage: string;
  lastTouch: string;
  notes: string;
}

export interface CRMLifetimeStats {
  purchaseCount: number;
  lifetimeDollars: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
}

export interface CRMSearchResult {
  customers: CRMCustomerAccount[];
  leads: CRMLead[];
  orders: CRMCustomerOrder[];
  lifetime?: CRMLifetimeStats;
}

export interface CRMOwnerOption {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}

export interface CRMSalespersonOption {
  name: string;
  userId: string | null;
  primaryLocation: string;
  locations: string[];
  totalTickets: number;
  lastSaleDate: string | null;
}

export interface CRMAutomationRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface ManufacturerPricebookUpload {
  id: string;
  manufacturer: string;
  manufacturerSlug: string;
  originalName: string;
  storageName: string;
  relativePath: string;
  documentType?: string;
  mimeType: string;
  fileSizeBytes: number;
  replaceExisting: boolean;
  status: string;
  parsedRowCount?: number;
  lastError?: string;
  previewedAt?: string | null;
  publishedAt?: string | null;
  uploadedByUserId?: string | null;
  parentUploadId?: string | null;
  extractedFileCount?: number;
  createdAt?: string;
}

export interface ManufacturerPricebookSummaryManufacturer {
  manufacturer: string;
  manufacturerSlug: string;
  statuses: Record<string, number>;
  uploadCount: number;
  catalogRows: number;
  pricedRows: number;
  parserSupported: boolean;
  latestUploadAt?: string | null;
  latestCatalogAt?: string | null;
}

export interface ManufacturerPricebookSummary {
  totals: {
    manufacturers: number;
    uploads: number;
    catalogRows: number;
    holding: number;
  };
  manufacturers: ManufacturerPricebookSummaryManufacturer[];
}

export interface ManufacturerUploadColumn {
  index: number;
  key: string;
  header: string;
  sampleValues: string[];
}

export interface ManufacturerUploadMappingSuggestion {
  columnIndex: number;
  header: string;
  confidence: number;
}

export interface ManufacturerUploadAnalysis {
  mode: string;
  supported: boolean;
  parserKind: string;
  message?: string;
  manufacturer?: string;
  manufacturerSlug?: string;
  sheetName?: string;
  sheetNames?: string[];
  headerRowIndex?: number;
  rowCount?: number;
  columns?: ManufacturerUploadColumn[];
  suggestedMappings?: Record<string, ManufacturerUploadMappingSuggestion>;
  sampleRows?: Array<{
    rowNumber: number;
    values: Array<{ header: string; value: string }>;
  }>;
  savedProfile?: {
    id: string;
    profileName: string;
    sheetName: string;
    headerRowIndex: number;
    mappings: Record<string, unknown>;
    updatedAt?: string | null;
  } | null;
}

export interface ManufacturerReferenceNote {
  id: string;
  manufacturer: string;
  manufacturerSlug: string;
  uploadId?: string | null;
  noteType: string;
  title: string;
  content: string;
  videoUrl: string;
  sourceSortOrder: number;
  createdAt?: string | null;
}

export interface ManufacturerCatalogItem {
  id: string;
  uploadId?: string | null;
  manufacturer: string;
  manufacturerSlug: string;
  collectionCode: string;
  collectionName: string;
  category: string;
  productType: string;
  sku: string;
  description: string;
  colorFinish: string;
  colorFamily: string;
  material: string;
  shape: string;
  dimensionsText: string;
  widthInches: number | null;
  depthInches: number | null;
  heightInches: number | null;
  cubes: number | null;
  weightLbs: number | null;
  basePrice: number | null;
  isSet: boolean;
  setPieceCount: number | null;
  isSwatch: boolean;
  isSample: boolean;
  isNewProduct: boolean;
  upholsteryCover: string;
  hardwareOptions: string[];
  cushionOptions: string[];
  featureTags: string[];
  searchKeywords: string[];
  imageUrls: string[];
  sourceNote: string;
  sourceSortOrder: number;
}

export type UserRole = "Owner" | "Manager" | "Sales" | "Marketing" | "Support";
export type PermissionMode = "role" | "explicit";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  permissions: string[];
  permissionMode: PermissionMode;
  tutorialCompletedAt: string | null;
  tutorialResetAt?: string | null;
}

export interface AuthConfig {
  googleWorkspaceEnabled: boolean;
  googleClientId: string;
  googleHostedDomain: string;
  updatedAt?: string | null;
  source?: "database" | "environment";
}

export interface AccessRequestProfile {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  accessStatus: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roles: UserRole[];
  firstName?: string;
  lastName?: string;
  phone?: string;
  salespersonName?: string;
  authProvider?: string;
  accessStatus?: string;
  accessRequestedAt?: string;
  accessApprovedAt?: string;
  explicitPermissionCount?: number;
  permissionMode?: PermissionMode;
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

export interface BoardUpload {
  id: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  publicUrl: string;
  createdAt: string;
}

export interface BoardUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  active: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string;
}

export interface BoardMessage {
  id: string;
  scope: "channel" | "dm";
  channel: string | null;
  body: string;
  priority: boolean;
  authorName: string;
  authorEmail: string;
  authorUserId: string | null;
  recipientUserId: string | null;
  recipientName: string;
  recipientEmail: string;
  attachment: BoardUpload | null;
  mentions: string[];
  editedAt: string | null;
  deletedAt: string | null;
  forwardedFromMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}
