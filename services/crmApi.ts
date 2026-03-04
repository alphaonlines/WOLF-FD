import type { CRMAutomationRule, CRMLead } from "../types";
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
  stage: string;
  next_action: string;
  due_date: string;
  last_message: string;
  last_touch: string;
  notes: string;
};

type ApiAutomationRow = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
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
  stage: String(row.stage ?? "New") as CRMLead["stage"],
  nextAction: String(row.next_action ?? ""),
  dueDate: row.due_date ? String(row.due_date).slice(0, 10) : "",
  lastMessage: String(row.last_message ?? ""),
  lastTouch: String(row.last_touch ?? ""),
  notes: String(row.notes ?? ""),
});

const mapAutomation = (row: ApiAutomationRow): CRMAutomationRule => ({
  id: String(row.id ?? ""),
  label: String(row.label ?? ""),
  description: String(row.description ?? ""),
  enabled: Boolean(row.enabled),
});

export async function fetchCrmLeadsFromApi(): Promise<CRMLead[]> {
  const json = await fetchJson("/api/crm/leads");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: any) => mapLead(row as ApiLeadRow));
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
