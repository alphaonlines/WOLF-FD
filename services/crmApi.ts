import type {
  CRMAutomationRule,
  CRMCustomerAccount,
  CRMCustomerOrder,
  CRMLead,
  CRMOwnerOption,
  CRMSearchResult,
  CRMUpsItem,
  CRMUpsQueueItem,
} from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type ApiLeadRow = {
  id: string;
  name: string;
  phone: string;
  channel: string;
  source: string;
  interest: string;
  budget: string;
  store: string;
  owner: string;
  owner_user_id?: string | null;
  stage: string;
  next_action: string;
  due_date: string;
  last_message: string;
  last_touch: string;
  notes: string;
};

type ApiUpsRow = {
  id: string;
  customer: string;
  task: string;
  owner: string;
  owner_user_id?: string | null;
  lane: string;
  priority: string;
  due_at: string | null;
  channel: string;
  done: boolean;
  started_at?: string | null;
};

type ApiAutomationRow = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

type ApiUpsQueueRow = {
  id: string;
  store: string;
  rep: string;
  rep_user_id?: string | null;
  status: string;
  queue_position: number;
  checked_in_at?: string | null;
  current_customer?: string | null;
  current_customer_type?: string | null;
  current_customer_details?: string | null;
  started_at?: string | null;
};

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`POS API ${res.status} for ${path}${msg ? `: ${msg}` : ""}`);
  }
  return res.json();
}

const mapLead = (row: ApiLeadRow): CRMLead => ({
  id: String(row.id ?? ""),
  name: String(row.name ?? ""),
  phone: String(row.phone ?? ""),
  channel: String(row.channel ?? "SMS") as CRMLead["channel"],
  source: String(row.source ?? ""),
  interest: String(row.interest ?? ""),
  budget: String(row.budget ?? ""),
  store: String(row.store ?? ""),
  owner: String(row.owner ?? "Unassigned"),
  ownerUserId:
    row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
  stage: String(row.stage ?? "New") as CRMLead["stage"],
  nextAction: String(row.next_action ?? ""),
  dueDate: row.due_date ? String(row.due_date).slice(0, 10) : "",
  lastMessage: String(row.last_message ?? ""),
  lastTouch: String(row.last_touch ?? ""),
  notes: String(row.notes ?? ""),
});

const mapUps = (row: ApiUpsRow): CRMUpsItem => ({
  id: String(row.id ?? ""),
  customer: String(row.customer ?? ""),
  task: String(row.task ?? ""),
  owner: String(row.owner ?? "Unassigned"),
  ownerUserId:
    row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
  lane: String(row.lane ?? "Unattended") as CRMUpsItem["lane"],
  priority: String(row.priority ?? "Today") as CRMUpsItem["priority"],
  dueAt: row.due_at ? String(row.due_at).slice(0, 10) : "",
  channel: String(row.channel ?? "SMS") as CRMUpsItem["channel"],
  done: Boolean(row.done),
  startedAt: row.started_at ? String(row.started_at) : undefined,
});

const mapAutomation = (row: ApiAutomationRow): CRMAutomationRule => ({
  id: String(row.id ?? ""),
  label: String(row.label ?? ""),
  description: String(row.description ?? ""),
  enabled: Boolean(row.enabled),
});

const mapUpsQueue = (row: ApiUpsQueueRow): CRMUpsQueueItem => ({
  id: String(row.id ?? ""),
  store: String(row.store ?? "FD7"),
  rep: String(row.rep ?? ""),
  repUserId: row.rep_user_id === null || row.rep_user_id === undefined ? null : String(row.rep_user_id),
  status: String(row.status ?? "waiting") as CRMUpsQueueItem["status"],
  queuePosition: Number(row.queue_position ?? 0),
  checkedInAt: row.checked_in_at ? String(row.checked_in_at) : null,
  currentCustomer: row.current_customer ? String(row.current_customer) : null,
  currentCustomerType: row.current_customer_type
    ? (String(row.current_customer_type) as CRMUpsQueueItem["currentCustomerType"])
    : null,
  currentCustomerDetails: row.current_customer_details ? String(row.current_customer_details) : null,
  startedAt: row.started_at ? String(row.started_at) : null,
});

export async function fetchCrmLeadsFromApi(scope: "my" | "team" = "team"): Promise<CRMLead[]> {
  const json = await fetchJson(`/api/crm/leads?scope=${encodeURIComponent(scope)}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapLead(row as ApiLeadRow));
}

export async function fetchCrmOwnersFromApi(): Promise<CRMOwnerOption[]> {
  const json = await fetchJson("/api/crm/owners");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    roles: Array.isArray(row.roles) ? row.roles.map((role: any) => String(role)) : [],
  })) as CRMOwnerOption[];
}

export async function createCrmLeadInApi(lead: CRMLead): Promise<void> {
  await fetchJson("/api/crm/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      channel: lead.channel,
      source: lead.source,
      interest: lead.interest,
      budget: lead.budget,
      store: lead.store,
      owner: lead.owner,
      owner_user_id: lead.ownerUserId,
      stage: lead.stage,
      next_action: lead.nextAction,
      due_date: lead.dueDate,
      last_message: lead.lastMessage,
      last_touch: lead.lastTouch,
      notes: lead.notes,
    }),
  });
}

export async function updateCrmLeadInApi(id: string, patch: Partial<CRMLead>): Promise<void> {
  const body: any = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.phone !== undefined) body.phone = patch.phone;
  if (patch.channel !== undefined) body.channel = patch.channel;
  if (patch.source !== undefined) body.source = patch.source;
  if (patch.interest !== undefined) body.interest = patch.interest;
  if (patch.budget !== undefined) body.budget = patch.budget;
  if (patch.store !== undefined) body.store = patch.store;
  if (patch.owner !== undefined) body.owner = patch.owner;
  if (patch.ownerUserId !== undefined) body.owner_user_id = patch.ownerUserId;
  if (patch.stage !== undefined) body.stage = patch.stage;
  if (patch.nextAction !== undefined) body.next_action = patch.nextAction;
  if (patch.dueDate !== undefined) body.due_date = patch.dueDate;
  if (patch.lastMessage !== undefined) body.last_message = patch.lastMessage;
  if (patch.lastTouch !== undefined) body.last_touch = patch.lastTouch;
  if (patch.notes !== undefined) body.notes = patch.notes;

  await fetchJson(`/api/crm/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function assignCrmLeadInApi(id: string, ownerUserId: string, owner: string): Promise<void> {
  await fetchJson(`/api/crm/leads/${encodeURIComponent(id)}/assign`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      owner_user_id: ownerUserId,
      owner,
    }),
  });
}

export async function fetchCrmUpsFromApi(): Promise<CRMUpsItem[]> {
  const json = await fetchJson("/api/crm/ups");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUps(row as ApiUpsRow));
}

export async function createCrmUpsInApi(item: CRMUpsItem): Promise<void> {
  await fetchJson("/api/crm/ups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: item.id,
      customer: item.customer,
      task: item.task,
      owner: item.owner,
      owner_user_id: item.ownerUserId,
      lane: item.lane,
      priority: item.priority,
      due_at: item.dueAt,
      channel: item.channel,
      done: item.done,
      started_at: item.startedAt,
    }),
  });
}

export async function updateCrmUpsInApi(id: string, patch: Partial<CRMUpsItem>): Promise<void> {
  const body: any = {};
  if (patch.customer !== undefined) body.customer = patch.customer;
  if (patch.task !== undefined) body.task = patch.task;
  if (patch.owner !== undefined) body.owner = patch.owner;
  if (patch.ownerUserId !== undefined) body.owner_user_id = patch.ownerUserId;
  if (patch.lane !== undefined) body.lane = patch.lane;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.dueAt !== undefined) body.due_at = patch.dueAt;
  if (patch.channel !== undefined) body.channel = patch.channel;
  if (patch.done !== undefined) body.done = patch.done;
  if (patch.startedAt !== undefined) body.started_at = patch.startedAt;

  await fetchJson(`/api/crm/ups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchCrmAutomationsFromApi(): Promise<CRMAutomationRule[]> {
  const json = await fetchJson("/api/crm/automations");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapAutomation(row as ApiAutomationRow));
}

export async function createCrmAutomationInApi(rule: CRMAutomationRule): Promise<void> {
  await fetchJson("/api/crm/automations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: rule.id,
      label: rule.label,
      description: rule.description,
      enabled: rule.enabled,
    }),
  });
}

export async function updateCrmAutomationInApi(id: string, enabled: boolean): Promise<void> {
  await fetchJson(`/api/crm/automations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

export async function fetchCrmUpsQueueFromApi(store?: string): Promise<CRMUpsQueueItem[]> {
  const qs = store && store.trim() ? `?store=${encodeURIComponent(store.trim())}` : "";
  const json = await fetchJson(`/api/crm/ups-queue${qs}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUpsQueue(row as ApiUpsQueueRow));
}

export async function joinCrmUpsQueueInApi(store: string, rep?: string): Promise<CRMUpsQueueItem> {
  const json = await fetchJson("/api/crm/ups-queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store, rep: rep || "" }),
  });
  return mapUpsQueue((json as any)?.row as ApiUpsQueueRow);
}

export async function startCrmUpsQueueCustomerInApi(
  id: string,
  payload: { customer: string; customerType: "Regular Up" | "B-Back"; details?: string }
): Promise<CRMUpsQueueItem> {
  const json = await fetchJson(`/api/crm/ups-queue/${encodeURIComponent(id)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: payload.customer,
      customer_type: payload.customerType,
      customer_details: payload.details || "",
    }),
  });
  return mapUpsQueue((json as any)?.row as ApiUpsQueueRow);
}

export async function updateCrmUpsQueueCustomerInApi(
  id: string,
  payload: { customer?: string; customerType?: "Regular Up" | "B-Back"; details?: string }
): Promise<CRMUpsQueueItem> {
  const body: Record<string, string> = {};
  if (payload.customer !== undefined) body.customer = payload.customer;
  if (payload.customerType !== undefined) body.customer_type = payload.customerType;
  if (payload.details !== undefined) body.customer_details = payload.details;

  const json = await fetchJson(`/api/crm/ups-queue/${encodeURIComponent(id)}/customer`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return mapUpsQueue((json as any)?.row as ApiUpsQueueRow);
}

export async function completeCrmUpsQueueCustomerInApi(id: string): Promise<CRMUpsQueueItem[]> {
  const json = await fetchJson(`/api/crm/ups-queue/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUpsQueue(row as ApiUpsQueueRow));
}

export async function updateCrmUpsQueueStatusInApi(
  id: string,
  status: "waiting" | "on_break"
): Promise<CRMUpsQueueItem[]> {
  const json = await fetchJson(`/api/crm/ups-queue/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUpsQueue(row as ApiUpsQueueRow));
}

export async function leaveCrmUpsQueueInApi(id: string): Promise<void> {
  await fetchJson(`/api/crm/ups-queue/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
}

const mapCustomerAccount = (row: any): CRMCustomerAccount => ({
  id: String(row.id ?? ""),
  name: String(row.name ?? ""),
  phone: String(row.phone ?? ""),
  email: String(row.email ?? ""),
  store: String(row.store ?? "FD7"),
  notes: String(row.notes ?? ""),
});

const mapCustomerOrder = (row: any): CRMCustomerOrder => ({
  saleId: String(row.sale_id ?? ""),
  saleDate: row.sale_date ? String(row.sale_date) : null,
  deliveryConfirmedDate: row.delivery_confirmed_date ? String(row.delivery_confirmed_date) : null,
  estDeliveryDate: row.est_delivery_date ? String(row.est_delivery_date) : null,
  location: String(row.location ?? ""),
  salesperson: String(row.salesperson ?? ""),
  receiptNo: String(row.receipt_no ?? ""),
  customerName: String(row.customer_name ?? ""),
  phone: String(row.phone ?? ""),
  grandTotal: row.grand_total === null || row.grand_total === undefined ? null : Number(row.grand_total),
  saleStatus: String(row.sale_status ?? ""),
});

export async function findCrmCustomerAccount(params: {
  phone?: string;
  email?: string;
}): Promise<{ customers: CRMCustomerAccount[]; orders: CRMCustomerOrder[] }> {
  const qs = new URLSearchParams();
  if (params.phone && params.phone.trim()) qs.set("phone", params.phone.trim());
  if (params.email && params.email.trim()) qs.set("email", params.email.trim());
  const json = await fetchJson(`/api/crm/customers/find?${qs.toString()}`);
  const customers = Array.isArray((json as any)?.customers) ? (json as any).customers : [];
  const orders = Array.isArray((json as any)?.orders) ? (json as any).orders : [];
  return {
    customers: customers.map(mapCustomerAccount),
    orders: orders.map(mapCustomerOrder),
  };
}

export async function upsertCrmCustomerAccount(payload: {
  name: string;
  phone?: string;
  email?: string;
  store?: string;
  notes?: string;
}): Promise<{ customer: CRMCustomerAccount; orders: CRMCustomerOrder[] }> {
  const json = await fetchJson("/api/crm/customers/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      phone: payload.phone || "",
      email: payload.email || "",
      store: payload.store || "FD7",
      notes: payload.notes || "",
    }),
  });
  const customer = mapCustomerAccount((json as any)?.customer || {});
  const orders = Array.isArray((json as any)?.orders) ? (json as any).orders.map(mapCustomerOrder) : [];
  return { customer, orders };
}

export async function searchCrmRecords(query: string): Promise<CRMSearchResult> {
  const qs = new URLSearchParams();
  qs.set("q", query.trim());
  const json = await fetchJson(`/api/crm/search?${qs.toString()}`);
  const customers = Array.isArray((json as any)?.customers) ? (json as any).customers : [];
  const leads = Array.isArray((json as any)?.leads) ? (json as any).leads : [];
  const orders = Array.isArray((json as any)?.orders) ? (json as any).orders : [];
  return {
    customers: customers.map(mapCustomerAccount),
    leads: leads.map((row: any) => mapLead(row as ApiLeadRow)),
    orders: orders.map(mapCustomerOrder),
  };
}
