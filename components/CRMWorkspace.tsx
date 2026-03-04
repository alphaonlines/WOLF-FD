import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CalendarCheck2,
  CheckSquare,
  MessageSquare,
  PhoneCall,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";

type LeadStage = "New" | "Contacted" | "Appointment" | "Quoted" | "Won" | "Lost";
type LeadChannel = "SMS" | "Webchat" | "Facebook" | "Instagram" | "Phone";

type LeadItem = {
  id: string;
  name: string;
  phone: string;
  channel: LeadChannel;
  source: string;
  interest: string;
  budget: string;
  store: string;
  owner: string;
  stage: LeadStage;
  nextAction: string;
  dueDate: string;
  lastMessage: string;
  lastTouch: string;
  notes: string;
};

type TodoItem = {
  id: string;
  title: string;
  done: boolean;
};

type AutomationRule = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

const LEAD_KEY = "fd_crm_leads_v1";
const TODO_KEY = "fd_crm_todos_v1";
const AUTOMATION_KEY = "fd_crm_automations_v1";

const STAGES: LeadStage[] = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"];

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const seedLeads: LeadItem[] = [
  {
    id: "lead-1",
    name: "Jordan Family",
    phone: "(336) 555-1822",
    channel: "Webchat",
    source: "Website",
    interest: "Sectional",
    budget: "$2,000-$3,000",
    store: "FD7",
    owner: "Alex",
    stage: "New",
    nextAction: "Confirm preferred configuration",
    dueDate: todayIso(),
    lastMessage: "Interested in sleeper options",
    lastTouch: "2026-03-03 09:14",
    notes: "Asked about pet-friendly fabric.",
  },
  {
    id: "lead-2",
    name: "Miller Home",
    phone: "(704) 555-9012",
    channel: "SMS",
    source: "Manager Specials",
    interest: "Recliner",
    budget: "$800-$1,400",
    store: "FD5",
    owner: "Jordan",
    stage: "Contacted",
    nextAction: "Call back with financing options",
    dueDate: addDaysIso(1),
    lastMessage: "Can I split payment across 12 months?",
    lastTouch: "2026-03-03 11:22",
    notes: "Wants delivery this week if available.",
  },
  {
    id: "lead-3",
    name: "Patel Residence",
    phone: "(919) 555-4401",
    channel: "Instagram",
    source: "Social Posts",
    interest: "Dining Set",
    budget: "$1,500-$2,500",
    store: "FD51",
    owner: "Taylor",
    stage: "Appointment",
    nextAction: "Prepare dining package quote",
    dueDate: addDaysIso(2),
    lastMessage: "Booked showroom visit Saturday",
    lastTouch: "2026-03-02 16:48",
    notes: "Prefers dark wood finish.",
  },
  {
    id: "lead-4",
    name: "Avery Retail",
    phone: "(828) 555-1017",
    channel: "Phone",
    source: "Referral",
    interest: "Bedroom Package",
    budget: "$3,500-$5,000",
    store: "FD7",
    owner: "Morgan",
    stage: "Quoted",
    nextAction: "Send revised package",
    dueDate: addDaysIso(1),
    lastMessage: "Need updated quote with dresser",
    lastTouch: "2026-03-03 13:02",
    notes: "Commercial guest-unit project.",
  },
  {
    id: "lead-5",
    name: "Carter Condo",
    phone: "(336) 555-3208",
    channel: "Facebook",
    source: "Facebook Lead Form",
    interest: "Mattress",
    budget: "$900-$1,600",
    store: "FD5",
    owner: "Jamie",
    stage: "Won",
    nextAction: "Post-delivery review request",
    dueDate: addDaysIso(3),
    lastMessage: "Purchased and delivery scheduled",
    lastTouch: "2026-03-01 12:40",
    notes: "Send review ask after delivery window.",
  },
];

const seedTodos: TodoItem[] = [
  { id: "todo-1", title: "Lead intake flow", done: true },
  { id: "todo-2", title: "Pipeline stage board", done: true },
  { id: "todo-3", title: "Contact 360 editor", done: true },
  { id: "todo-4", title: "Follow-up queue", done: true },
  { id: "todo-5", title: "Unified inbox snapshot", done: true },
  { id: "todo-6", title: "Automation control center", done: true },
  { id: "todo-7", title: "Message templates", done: true },
];

const seedAutomations: AutomationRule[] = [
  {
    id: "auto-1",
    label: "10-minute speed-to-lead escalation",
    description: "Escalate to backup rep when new leads are not touched within SLA.",
    enabled: true,
  },
  {
    id: "auto-2",
    label: "Quote follow-up in 24 hours",
    description: "Send reminder and create task when quote has no response in 24h.",
    enabled: true,
  },
  {
    id: "auto-3",
    label: "Post-delivery review request",
    description: "Auto-send review ask 2 days after marked delivery completion.",
    enabled: true,
  },
  {
    id: "auto-4",
    label: "30-day win-back campaign",
    description: "Re-engage lost leads with manager-specials offers after 30 days.",
    enabled: false,
  },
];

const templates = [
  {
    id: "tpl-1",
    title: "First response (new lead)",
    body: "Thanks for reaching out to Furniture Distributors. I can help with options today. What size and style are you looking for?",
  },
  {
    id: "tpl-2",
    title: "Quote follow-up",
    body: "Quick follow-up on your quote. Want me to lock pricing and delivery options for you today?",
  },
  {
    id: "tpl-3",
    title: "Review request",
    body: "Thanks for shopping with Furniture Distributors. If everything looks great, would you mind leaving us a quick review?",
  },
];

const stagePillClass = (stage: LeadStage) => {
  if (stage === "Won") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (stage === "Lost") return "border-rose-200 bg-rose-50 text-rose-700";
  if (stage === "Quoted") return "border-blue-200 bg-blue-50 text-blue-700";
  if (stage === "Appointment") return "border-violet-200 bg-violet-50 text-violet-700";
  if (stage === "Contacted") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const CRMWorkspace: React.FC = () => {
  const [leads, setLeads] = useState<LeadItem[]>(() => readLocal(LEAD_KEY, seedLeads));
  const [todos, setTodos] = useState<TodoItem[]>(() => readLocal(TODO_KEY, seedTodos));
  const [automations, setAutomations] = useState<AutomationRule[]>(() => readLocal(AUTOMATION_KEY, seedAutomations));
  const [selectedLeadId, setSelectedLeadId] = useState<string>(() => readLocal(LEAD_KEY, seedLeads)[0]?.id ?? "");
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    channel: "SMS" as LeadChannel,
    source: "Website",
    interest: "",
    budget: "",
    store: "FD7",
    owner: "Unassigned",
  });

  useEffect(() => {
    try {
      localStorage.setItem(LEAD_KEY, JSON.stringify(leads));
    } catch {
      // ignore storage failures
    }
  }, [leads]);

  useEffect(() => {
    try {
      localStorage.setItem(TODO_KEY, JSON.stringify(todos));
    } catch {
      // ignore storage failures
    }
  }, [todos]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOMATION_KEY, JSON.stringify(automations));
    } catch {
      // ignore storage failures
    }
  }, [automations]);

  useEffect(() => {
    if (!leads.some((lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId(leads[0]?.id ?? "");
    }
  }, [leads, selectedLeadId]);

  const stats = useMemo(() => {
    const open = leads.filter((lead) => !["Won", "Lost"].includes(lead.stage)).length;
    const appointments = leads.filter((lead) => lead.stage === "Appointment").length;
    const quoted = leads.filter((lead) => lead.stage === "Quoted").length;
    const won = leads.filter((lead) => lead.stage === "Won").length;
    const today = todayIso();
    const overdue = leads.filter((lead) => !["Won", "Lost"].includes(lead.stage) && lead.dueDate < today).length;
    return { open, appointments, quoted, won, overdue };
  }, [leads]);

  const completion = useMemo(() => {
    const done = todos.filter((item) => item.done).length;
    return {
      done,
      total: todos.length,
      percent: todos.length ? Math.round((done / todos.length) * 100) : 0,
    };
  }, [todos]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const leadsByStage = useMemo(() => {
    const grouped: Record<LeadStage, LeadItem[]> = {
      New: [],
      Contacted: [],
      Appointment: [],
      Quoted: [],
      Won: [],
      Lost: [],
    };
    for (const lead of leads) {
      grouped[lead.stage].push(lead);
    }
    return grouped;
  }, [leads]);

  const followUps = useMemo(() => {
    return leads
      .filter((lead) => !["Won", "Lost"].includes(lead.stage))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [leads]);

  const inboxItems = useMemo(() => {
    return [...leads]
      .sort((a, b) => b.lastTouch.localeCompare(a.lastTouch))
      .slice(0, 7);
  }, [leads]);

  const updateLead = (id: string, patch: Partial<LeadItem>) => {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              ...patch,
            }
          : lead
      )
    );
  };

  const addLead = () => {
    if (!newLead.name.trim() || !newLead.phone.trim() || !newLead.interest.trim()) return;

    const created: LeadItem = {
      id: `lead-${Date.now()}`,
      name: newLead.name.trim(),
      phone: newLead.phone.trim(),
      channel: newLead.channel,
      source: newLead.source.trim() || "Website",
      interest: newLead.interest.trim(),
      budget: newLead.budget.trim() || "Unspecified",
      store: newLead.store.trim() || "FD7",
      owner: newLead.owner.trim() || "Unassigned",
      stage: "New",
      nextAction: "First contact",
      dueDate: todayIso(),
      lastMessage: "New inbound lead added",
      lastTouch: `${todayIso()} 08:00`,
      notes: "",
    };

    setLeads((current) => [created, ...current]);
    setSelectedLeadId(created.id);
    setNewLead({
      name: "",
      phone: "",
      channel: "SMS",
      source: "Website",
      interest: "",
      budget: "",
      store: "FD7",
      owner: "Unassigned",
    });
  };

  const toggleTodo = (id: string) => {
    setTodos((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              done: !item.done,
            }
          : item
      )
    );
  };

  const toggleAutomation = (id: string) => {
    setAutomations((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              enabled: !item.enabled,
            }
          : item
      )
    );
  };

  const copyTemplate = async (id: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedTemplate(id);
      window.setTimeout(() => setCopiedTemplate(null), 1300);
    } catch {
      setCopiedTemplate(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">CRM Command Center</div>
            <h2 className="text-2xl font-semibold text-slate-900">Lead Pipeline + Follow-up Execution</h2>
            <p className="text-sm text-slate-500">
              Podium/Perq-inspired workflow focused on speed-to-lead, stage control, and close-rate consistency.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (selectedLead) {
                updateLead(selectedLead.id, { stage: "Contacted", lastTouch: `${todayIso()} 09:00` });
              }
            }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <PhoneCall size={16} /> Log Follow-up
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Open Leads</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{stats.open}</div>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <div className="text-xs uppercase tracking-wide text-violet-700">Appointments</div>
            <div className="mt-2 text-2xl font-semibold text-violet-900">{stats.appointments}</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-xs uppercase tracking-wide text-blue-700">Quoted</div>
            <div className="mt-2 text-2xl font-semibold text-blue-900">{stats.quoted}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Won</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-900">{stats.won}</div>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <div className="text-xs uppercase tracking-wide text-rose-700">Overdue Follow-up</div>
            <div className="mt-2 text-2xl font-semibold text-rose-900">{stats.overdue}</div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">CRM Finish Checklist</h3>
            <p className="text-sm text-slate-500">
              Keep this list green as we complete the project. Progress: {completion.done}/{completion.total} ({completion.percent}%)
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <CheckSquare size={14} /> Project TODO
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {todos.map((item) => (
            <label
              key={item.id}
              className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <input type="checkbox" checked={item.done} onChange={() => toggleTodo(item.id)} />
              {item.title}
            </label>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Pipeline Board</h3>
            <span className="text-xs uppercase tracking-wide text-slate-500">Move leads by stage</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-[980px] gap-4">
              {STAGES.map((stage) => (
                <div key={stage} className="w-[230px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">{stage}</div>
                    <span className="text-xs font-semibold text-slate-500">{leadsByStage[stage].length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {leadsByStage[stage].map((lead) => (
                      <div
                        key={lead.id}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          selectedLeadId === lead.id
                            ? "border-blue-300 bg-white shadow-sm"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="w-full text-left"
                        >
                          <div className="font-semibold text-slate-900">{lead.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{lead.interest}</div>
                          <div className="mt-1 text-xs text-slate-500">{lead.owner} · Due {lead.dueDate}</div>
                        </button>
                        <select
                          value={lead.stage}
                          onChange={(event) =>
                            updateLead(lead.id, {
                              stage: event.target.value as LeadStage,
                              lastTouch: `${todayIso()} 09:00`,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                        >
                          {STAGES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Lead Intake</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">Fast add</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={newLead.name}
                onChange={(event) => setNewLead((current) => ({ ...current, name: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Customer name"
              />
              <input
                value={newLead.phone}
                onChange={(event) => setNewLead((current) => ({ ...current, phone: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Phone"
              />
              <input
                value={newLead.interest}
                onChange={(event) => setNewLead((current) => ({ ...current, interest: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Interest"
              />
              <input
                value={newLead.budget}
                onChange={(event) => setNewLead((current) => ({ ...current, budget: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Budget"
              />
              <input
                value={newLead.store}
                onChange={(event) => setNewLead((current) => ({ ...current, store: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Store"
              />
              <input
                value={newLead.owner}
                onChange={(event) => setNewLead((current) => ({ ...current, owner: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Owner"
              />
              <input
                value={newLead.source}
                onChange={(event) => setNewLead((current) => ({ ...current, source: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Lead source"
              />
              <select
                value={newLead.channel}
                onChange={(event) => setNewLead((current) => ({ ...current, channel: event.target.value as LeadChannel }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="SMS">SMS</option>
                <option value="Webchat">Webchat</option>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
            <button
              type="button"
              onClick={addLead}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={14} /> Add Lead
            </button>
          </section>

          <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Contact 360</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">Editable</span>
            </div>
            {!selectedLead ? (
              <p className="mt-3 text-sm text-slate-500">Select a lead from the pipeline to edit details.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <input
                  value={selectedLead.name}
                  onChange={(event) => updateLead(selectedLead.id, { name: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={selectedLead.phone}
                  onChange={(event) => updateLead(selectedLead.id, { phone: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={selectedLead.store}
                    onChange={(event) => updateLead(selectedLead.id, { store: event.target.value })}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Store"
                  />
                  <input
                    value={selectedLead.owner}
                    onChange={(event) => updateLead(selectedLead.id, { owner: event.target.value })}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Owner"
                  />
                </div>
                <input
                  value={selectedLead.nextAction}
                  onChange={(event) => updateLead(selectedLead.id, { nextAction: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Next action"
                />
                <input
                  type="date"
                  value={selectedLead.dueDate}
                  onChange={(event) => updateLead(selectedLead.id, { dueDate: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <textarea
                  value={selectedLead.notes}
                  onChange={(event) => updateLead(selectedLead.id, { notes: event.target.value })}
                  className="h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Notes"
                />
                <div className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold text-slate-700">
                  Stage: {selectedLead.stage}
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Follow-up Queue</h3>
          <span className="text-xs uppercase tracking-wide text-slate-500">Priority by due date</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Lead</th>
                <th className="py-2 pr-4">Stage</th>
                <th className="py-2 pr-4">Next Action</th>
                <th className="py-2 pr-4">Due</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {followUps.map((lead) => (
                <tr key={lead.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{lead.name}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stagePillClass(lead.stage)}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{lead.nextAction}</td>
                  <td className="py-3 pr-4 text-slate-700">{lead.dueDate}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        updateLead(lead.id, { stage: "Contacted", lastTouch: `${todayIso()} 09:00` });
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      <PhoneCall size={12} /> Call
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <MessageSquare size={14} /> Unified Inbox Snapshot
          </div>
          <div className="mt-3 space-y-2">
            {inboxItems.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => setSelectedLeadId(lead.id)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
                  <div className="text-[11px] text-slate-500">{lead.channel}</div>
                </div>
                <div className="mt-1 text-xs text-slate-600">{lead.lastMessage}</div>
                <div className="mt-1 text-[11px] text-slate-400">Last touch: {lead.lastTouch}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Activity size={14} /> Automation Rules
          </div>
          <div className="mt-3 space-y-3">
            {automations.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{rule.label}</div>
                    <div className="mt-1 text-xs text-slate-600">{rule.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAutomation(rule.id)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      rule.enabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {rule.enabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Bot size={14} /> Message Templates
          </div>
          <div className="mt-3 space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-sm font-semibold text-slate-900">{template.title}</div>
                <div className="mt-1 text-xs text-slate-600">{template.body}</div>
                <button
                  type="button"
                  onClick={() => copyTemplate(template.id, template.body)}
                  className="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                >
                  {copiedTemplate === template.id ? "Copied" : "Copy template"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <UsersRound size={14} /> Team Ownership
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Every lead has a named owner so accountability is visible and measurable.
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <CalendarCheck2 size={14} /> Follow-up Discipline
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Prioritized queue and overdue flags help reps close loops faster and reduce leakage.
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <UserRound size={14} /> Contact Intelligence
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Notes, budget, source, and intent make each conversation more relevant and conversion-focused.
          </p>
        </div>
      </section>
    </div>
  );
};

export default CRMWorkspace;
