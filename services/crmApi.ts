import type {
  CRMAutomationRule,
  CRMUpsActiveCustomer,
  CRMUpsHistoryEntry,
  CRMCustomerAccount,
  CRMCustomerOrder,
  CRMLead,
  CRMOwnerOption,
  CRMSalespersonOption,
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
  current_weather_location?: string | null;
  current_weather_summary?: string | null;
  current_weather_temp_f?: number | null;
  current_weather_precip_pct?: number | null;
  current_weather_wind_mph?: number | null;
  current_weather_fetched_at?: string | null;
  live_weather_location?: string | null;
  live_weather_summary?: string | null;
  live_weather_temp_f?: number | null;
  live_weather_precip_pct?: number | null;
  live_weather_wind_mph?: number | null;
  live_weather_fetched_at?: string | null;
  helped_today_count?: number | null;
  active_customer_count?: number | null;
  active_customers?: ApiUpsActiveCustomerRow[] | null;
};

type ApiUpsActiveCustomerRow = {
  id: string;
  queue_entry_id?: string | null;
  customer?: string | null;
  customer_type?: string | null;
  customer_details?: string | null;
  city?: string | null;
  wants_needs?: string | null;
  did_purchase?: boolean | null;
  purchase_amount?: number | null;
  objection_note?: string | null;
  started_at?: string | null;
  history_id?: string | null;
};

type ApiUpsHistoryRow = {
  id: string;
  queue_entry_id?: string | null;
  store?: string | null;
  rep?: string | null;
  customer?: string | null;
  city?: string | null;
  customer_type?: string | null;
  customer_details?: string | null;
  wants_needs?: string | null;
  did_purchase?: boolean | null;
  purchase_amount?: number | null;
  objection_note?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  weather_location?: string | null;
  weather_summary?: string | null;
  weather_temp_f?: number | null;
  weather_precip_pct?: number | null;
  weather_wind_mph?: number | null;
  weather_fetched_at?: string | null;
  ended_reason?: string | null;
  counts_as_up?: boolean | null;
};

type ApiSalespersonRow = {
  name: string;
  user_id?: string | null;
  primary_location?: string | null;
  locations?: string[] | null;
  total_tickets?: number | null;
  last_sale_date?: string | null;
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
  currentWeatherLocation: row.current_weather_location ? String(row.current_weather_location) : null,
  currentWeatherSummary: row.current_weather_summary ? String(row.current_weather_summary) : null,
  currentWeatherTempF:
    row.current_weather_temp_f === null || row.current_weather_temp_f === undefined ? null : Number(row.current_weather_temp_f),
  currentWeatherPrecipPct:
    row.current_weather_precip_pct === null || row.current_weather_precip_pct === undefined
      ? null
      : Number(row.current_weather_precip_pct),
  currentWeatherWindMph:
    row.current_weather_wind_mph === null || row.current_weather_wind_mph === undefined ? null : Number(row.current_weather_wind_mph),
  currentWeatherFetchedAt: row.current_weather_fetched_at ? String(row.current_weather_fetched_at) : null,
  liveWeatherLocation: row.live_weather_location ? String(row.live_weather_location) : null,
  liveWeatherSummary: row.live_weather_summary ? String(row.live_weather_summary) : null,
  liveWeatherTempF: row.live_weather_temp_f === null || row.live_weather_temp_f === undefined ? null : Number(row.live_weather_temp_f),
  liveWeatherPrecipPct:
    row.live_weather_precip_pct === null || row.live_weather_precip_pct === undefined ? null : Number(row.live_weather_precip_pct),
  liveWeatherWindMph: row.live_weather_wind_mph === null || row.live_weather_wind_mph === undefined ? null : Number(row.live_weather_wind_mph),
  liveWeatherFetchedAt: row.live_weather_fetched_at ? String(row.live_weather_fetched_at) : null,
  helpedTodayCount: row.helped_today_count === null || row.helped_today_count === undefined ? 0 : Number(row.helped_today_count),
  activeCustomerCount:
    row.active_customer_count === null || row.active_customer_count === undefined ? 0 : Number(row.active_customer_count),
  activeCustomers: Array.isArray(row.active_customers)
    ? row.active_customers.map((entry) => mapUpsActiveCustomer(entry))
    : [],
});

const mapUpsActiveCustomer = (row: ApiUpsActiveCustomerRow): CRMUpsActiveCustomer => ({
  id: String(row.id ?? ""),
  queueEntryId: row.queue_entry_id === null || row.queue_entry_id === undefined ? "" : String(row.queue_entry_id),
  customer: String(row.customer ?? ""),
  customerType:
    row.customer_type === null || row.customer_type === undefined
      ? null
      : (String(row.customer_type) as CRMUpsActiveCustomer["customerType"]),
  customerDetails:
    row.customer_details === null || row.customer_details === undefined ? null : String(row.customer_details),
  city: row.city === null || row.city === undefined ? null : String(row.city),
  wantsNeeds: row.wants_needs === null || row.wants_needs === undefined ? null : String(row.wants_needs),
  didPurchase:
    row.did_purchase === null || row.did_purchase === undefined ? null : Boolean(row.did_purchase),
  purchaseAmount:
    row.purchase_amount === null || row.purchase_amount === undefined ? null : Number(row.purchase_amount),
  objectionNote:
    row.objection_note === null || row.objection_note === undefined ? null : String(row.objection_note),
  startedAt: row.started_at ? String(row.started_at) : null,
  historyId: row.history_id === null || row.history_id === undefined ? null : String(row.history_id),
});

const mapUpsHistory = (row: ApiUpsHistoryRow): CRMUpsHistoryEntry => ({
  id: String(row.id ?? ""),
  queueEntryId: row.queue_entry_id === null || row.queue_entry_id === undefined ? "" : String(row.queue_entry_id),
  store: String(row.store ?? "FD7"),
  rep: String(row.rep ?? ""),
  customer: String(row.customer ?? ""),
  city: row.city === null || row.city === undefined ? null : String(row.city),
  customerType:
    row.customer_type === null || row.customer_type === undefined
      ? null
      : (String(row.customer_type) as CRMUpsHistoryEntry["customerType"]),
  customerDetails:
    row.customer_details === null || row.customer_details === undefined ? null : String(row.customer_details),
  wantsNeeds: row.wants_needs === null || row.wants_needs === undefined ? null : String(row.wants_needs),
  didPurchase: row.did_purchase === null || row.did_purchase === undefined ? null : Boolean(row.did_purchase),
  purchaseAmount:
    row.purchase_amount === null || row.purchase_amount === undefined ? null : Number(row.purchase_amount),
  objectionNote:
    row.objection_note === null || row.objection_note === undefined ? null : String(row.objection_note),
  startedAt: row.started_at ? String(row.started_at) : null,
  completedAt: row.completed_at ? String(row.completed_at) : null,
  weatherLocation: row.weather_location === null || row.weather_location === undefined ? null : String(row.weather_location),
  weatherSummary: row.weather_summary === null || row.weather_summary === undefined ? null : String(row.weather_summary),
  weatherTempF:
    row.weather_temp_f === null || row.weather_temp_f === undefined ? null : Number(row.weather_temp_f),
  weatherPrecipPct:
    row.weather_precip_pct === null || row.weather_precip_pct === undefined ? null : Number(row.weather_precip_pct),
  weatherWindMph:
    row.weather_wind_mph === null || row.weather_wind_mph === undefined ? null : Number(row.weather_wind_mph),
  weatherFetchedAt: row.weather_fetched_at ? String(row.weather_fetched_at) : null,
  endedReason: row.ended_reason === null || row.ended_reason === undefined ? null : String(row.ended_reason),
  countsAsUp: row.counts_as_up === null || row.counts_as_up === undefined ? true : Boolean(row.counts_as_up),
});

const mapSalesperson = (row: ApiSalespersonRow): CRMSalespersonOption => ({
  name: String(row.name ?? ""),
  userId: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
  primaryLocation: String(row.primary_location ?? ""),
  locations: Array.isArray(row.locations) ? row.locations.map((value) => String(value)) : [],
  totalTickets: Number(row.total_tickets ?? 0),
  lastSaleDate: row.last_sale_date ? String(row.last_sale_date).slice(0, 10) : null,
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

export async function fetchCrmSalespeopleFromApi(): Promise<CRMSalespersonOption[]> {
  const json = await fetchJson("/api/crm/salespeople");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapSalesperson(row as ApiSalespersonRow));
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

export async function joinCrmUpsQueueInApi(
  store: string,
  options?: { rep?: string; repUserId?: string | null }
): Promise<CRMUpsQueueItem> {
  const json = await fetchJson("/api/crm/ups-queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store,
      rep: options?.rep || "",
      rep_user_id: options?.repUserId || null,
    }),
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
  activeCustomerId: string,
  payload: {
    customer?: string;
    customerType?: "Regular Up" | "B-Back";
    details?: string;
    city?: string;
    wantsNeeds?: string;
    didPurchase?: boolean;
    purchaseAmount?: number | null;
    objectionNote?: string;
  }
): Promise<CRMUpsQueueItem> {
  const body: Record<string, string> = {};
  if (payload.customer !== undefined) body.customer = payload.customer;
  if (payload.customerType !== undefined) body.customer_type = payload.customerType;
  if (payload.details !== undefined) body.customer_details = payload.details;
  if (payload.city !== undefined) body.city = payload.city;
  if (payload.wantsNeeds !== undefined) body.wants_needs = payload.wantsNeeds;
  if (payload.didPurchase !== undefined) body.did_purchase = String(payload.didPurchase);
  if (payload.purchaseAmount !== undefined) body.purchase_amount = payload.purchaseAmount === null ? "" : String(payload.purchaseAmount);
  if (payload.objectionNote !== undefined) body.objection_note = payload.objectionNote;

  const json = await fetchJson(
    `/api/crm/ups-queue/${encodeURIComponent(id)}/customers/${encodeURIComponent(activeCustomerId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return mapUpsQueue((json as any)?.row as ApiUpsQueueRow);
}

export async function completeCrmUpsQueueCustomerInApi(id: string, activeCustomerId: string): Promise<CRMUpsQueueItem[]> {
  const json = await fetchJson(
    `/api/crm/ups-queue/${encodeURIComponent(id)}/customers/${encodeURIComponent(activeCustomerId)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUpsQueue(row as ApiUpsQueueRow));
}

export async function fetchCrmUpsHistoryFromApi(params?: {
  store?: string;
  date?: string;
}): Promise<CRMUpsHistoryEntry[]> {
  const qs = new URLSearchParams();
  if (params?.store && params.store.trim()) qs.set("store", params.store.trim());
  if (params?.date && params.date.trim()) qs.set("date", params.date.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const json = await fetchJson(`/api/crm/ups-history${suffix}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapUpsHistory(row as ApiUpsHistoryRow));
}

export async function removeCrmUpsQueueCustomerInApi(id: string, activeCustomerId: string): Promise<CRMUpsQueueItem[]> {
  const json = await fetchJson(
    `/api/crm/ups-queue/${encodeURIComponent(id)}/customers/${encodeURIComponent(activeCustomerId)}/remove-up`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
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

export async function reorderCrmUpsQueueInApi(
  id: string,
  direction: "up" | "down"
): Promise<CRMUpsQueueItem[]> {
  const json = await fetchJson(`/api/crm/ups-queue/${encodeURIComponent(id)}/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
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
  channel: String(row.channel ?? "SMS") as CRMCustomerAccount["channel"],
  source: String(row.source ?? ""),
  interest: String(row.interest ?? ""),
  budget: String(row.budget ?? ""),
  owner: String(row.owner ?? "Unassigned"),
  ownerUserId:
    row.owner_user_id === null || row.owner_user_id === undefined ? null : String(row.owner_user_id),
  stage: String(row.stage ?? "New") as CRMCustomerAccount["stage"],
  nextAction: String(row.next_action ?? ""),
  dueDate: row.due_date ? String(row.due_date).slice(0, 10) : "",
  lastMessage: String(row.last_message ?? ""),
  lastTouch: String(row.last_touch ?? ""),
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
  channel?: CRMCustomerAccount["channel"];
  source?: string;
  interest?: string;
  budget?: string;
  owner?: string;
  ownerUserId?: string | null;
  stage?: CRMCustomerAccount["stage"];
  nextAction?: string;
  dueDate?: string;
  lastMessage?: string;
  lastTouch?: string;
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
      channel: payload.channel || "SMS",
      source: payload.source || "",
      interest: payload.interest || "",
      budget: payload.budget || "Unspecified",
      owner: payload.owner || "Unassigned",
      owner_user_id: payload.ownerUserId || null,
      stage: payload.stage || "New",
      next_action: payload.nextAction || "",
      due_date: payload.dueDate || "",
      last_message: payload.lastMessage || "",
      last_touch: payload.lastTouch || "",
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
