import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CalendarCheck2,
  MessageSquare,
  PhoneCall,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { CRMAutomationRule, CRMLead, CRMLeadChannel, CRMLeadStage } from "../types";
import { checkPosBackendHealthy } from "../services/posBackendApi";
import {
  createCrmAutomationInApi,
  createCrmLeadInApi,
  fetchCrmAutomationsFromApi,
  fetchCrmLeadsFromApi,
  updateCrmAutomationInApi,
  updateCrmLeadInApi,
} from "../services/crmApi";

type UpsPriority = "Hot" | "Today" | "Nurture";
type UpsLane = "Unattended" | "Be-Back" | "Quote Follow-up";

type UpsItem = {
  id: string;
  customer: string;
  task: string;
  owner: string;
  lane: UpsLane;
  priority: UpsPriority;
  dueAt: string;
  channel: CRMLeadChannel;
  done: boolean;
};

type CRMSyncMode = "POS_DB" | "LOCAL_STORAGE";

const LEAD_KEY = "fd_crm_leads_v1";
const AUTOMATION_KEY = "fd_crm_automations_v1";
const UPS_KEY = "fd_crm_ups_list_v1";

const STAGES: CRMLeadStage[] = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"];

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

const seedLeads: CRMLead[] = [
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

const seedUpsList: UpsItem[] = [
  {
    id: "ups-1",
    customer: "Jordan Family",
    task: "Confirm sectional fabric + financing option",
    owner: "Alex",
    lane: "Unattended",
    priority: "Hot",
    dueAt: todayIso(),
    channel: "Webchat",
    done: false,
  },
  {
    id: "ups-2",
    customer: "Avery Retail",
    task: "Send revised bedroom package quote",
    owner: "Morgan",
    lane: "Quote Follow-up",
    priority: "Today",
    dueAt: addDaysIso(1),
    channel: "Phone",
    done: false,
  },
  {
    id: "ups-3",
    customer: "Miller Home",
    task: "Re-engage on payment split question",
    owner: "Jordan",
    lane: "Be-Back",
    priority: "Nurture",
    dueAt: addDaysIso(2),
    channel: "SMS",
    done: true,
  },
];

const seedAutomations: CRMAutomationRule[] = [
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

const stagePillClass = (stage: CRMLeadStage) => {
  if (stage === "Won") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (stage === "Lost") return "border-rose-200 bg-rose-50 text-rose-700";
  if (stage === "Quoted") return "border-blue-200 bg-blue-50 text-blue-700";
  if (stage === "Appointment") return "border-violet-200 bg-violet-50 text-violet-700";
  if (stage === "Contacted") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const upsPriorityClass = (priority: UpsPriority) => {
  if (priority === "Hot") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "Today") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
};

const upsLaneClass = (lane: UpsLane) => {
  if (lane === "Unattended") return "border-violet-200 bg-violet-50 text-violet-700";
  if (lane === "Quote Follow-up") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const priorityRank: Record<UpsPriority, number> = {
  Hot: 0,
  Today: 1,
  Nurture: 2,
};

const UPS_LANES: UpsLane[] = ["Unattended", "Be-Back", "Quote Follow-up"];

const CRMWorkspace: React.FC = () => {
  const [syncMode, setSyncMode] = useState<CRMSyncMode>("LOCAL_STORAGE");
  const [focusMode, setFocusMode] = useState(false);
  const [leads, setLeads] = useState<CRMLead[]>(() => readLocal(LEAD_KEY, seedLeads));
  const [upsList, setUpsList] = useState<UpsItem[]>(() => readLocal(UPS_KEY, seedUpsList));
  const [upsDraft, setUpsDraft] = useState({
    customer: "",
    task: "",
    owner: "Unassigned",
    lane: "Unattended" as UpsLane,
    priority: "Today" as UpsPriority,
    dueAt: todayIso(),
    channel: "SMS" as CRMLeadChannel,
  });
  const [automations, setAutomations] = useState<CRMAutomationRule[]>(() => readLocal(AUTOMATION_KEY, seedAutomations));
  const [selectedLeadId, setSelectedLeadId] = useState<string>(() => readLocal(LEAD_KEY, seedLeads)[0]?.id ?? "");
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    channel: "SMS" as CRMLeadChannel,
    source: "Website",
    interest: "",
    budget: "",
    store: "FD7",
    owner: "Unassigned",
  });

  useEffect(() => {
    let stopped = false;
    let pollId: number | null = null;

    const seedApiIfEmpty = async () => {
      const [apiLeads, apiAutomations] = await Promise.all([fetchCrmLeadsFromApi(), fetchCrmAutomationsFromApi()]);

      if (!apiLeads.length) {
        await Promise.all(
          seedLeads.map(async (lead) => {
            try {
              await createCrmLeadInApi(lead);
            } catch {
              // If another client seeded first, ignore duplicate inserts.
            }
          })
        );
      }

      if (!apiAutomations.length) {
        await Promise.all(
          seedAutomations.map(async (rule) => {
            try {
              await createCrmAutomationInApi(rule);
            } catch {
              // If another client seeded first, ignore duplicate inserts.
            }
          })
        );
      }
    };

    const loadFromApi = async () => {
      try {
        const [apiLeads, apiAutomations] = await Promise.all([fetchCrmLeadsFromApi(), fetchCrmAutomationsFromApi()]);

        if (!apiLeads.length || !apiAutomations.length) {
          await seedApiIfEmpty();
        }

        const [freshLeads, freshAutomations] = await Promise.all([fetchCrmLeadsFromApi(), fetchCrmAutomationsFromApi()]);
        if (stopped) return;
        setLeads(freshLeads.length ? freshLeads : seedLeads);
        setAutomations(freshAutomations.length ? freshAutomations : seedAutomations);
      } catch (err) {
        console.warn("CRM sync failed; using local storage fallback:", err);
        if (!stopped) setSyncMode("LOCAL_STORAGE");
      }
    };

    const startSync = async () => {
      const healthy = await checkPosBackendHealthy();
      if (stopped) return;
      if (!healthy) {
        setSyncMode("LOCAL_STORAGE");
        return;
      }

      setSyncMode("POS_DB");
      await loadFromApi();
      if (stopped) return;
      pollId = window.setInterval(() => {
        void loadFromApi();
      }, 3000);
    };

    void startSync();

    return () => {
      stopped = true;
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LEAD_KEY, JSON.stringify(leads));
    } catch {
      // ignore storage failures
    }
  }, [leads]);

  useEffect(() => {
    try {
      localStorage.setItem(UPS_KEY, JSON.stringify(upsList));
    } catch {
      // ignore storage failures
    }
  }, [upsList]);

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

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const leadsByStage = useMemo(() => {
    const grouped: Record<CRMLeadStage, CRMLead[]> = {
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

  const upsStats = useMemo(() => {
    const active = upsList.filter((item) => !item.done).length;
    const unattended = upsList.filter((item) => !item.done && item.lane === "Unattended").length;
    const hot = upsList.filter((item) => !item.done && item.priority === "Hot").length;
    const completed = upsList.filter((item) => item.done).length;
    return { active, unattended, hot, completed };
  }, [upsList]);

  const orderedUpsList = useMemo(() => {
    return [...upsList].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
      if (byPriority !== 0) return byPriority;
      return a.dueAt.localeCompare(b.dueAt);
    });
  }, [upsList]);

  const upsByLane = useMemo(() => {
    const grouped: Record<UpsLane, UpsItem[]> = {
      Unattended: [],
      "Be-Back": [],
      "Quote Follow-up": [],
    };
    for (const item of orderedUpsList) {
      if (!item.done) grouped[item.lane].push(item);
    }
    return grouped;
  }, [orderedUpsList]);

  const completedUps = useMemo(() => orderedUpsList.filter((item) => item.done).slice(0, 6), [orderedUpsList]);
  const topFollowUps = useMemo(() => followUps.slice(0, 6), [followUps]);
  const focusUpsItems = useMemo(() => orderedUpsList.filter((item) => !item.done).slice(0, 6), [orderedUpsList]);
  const nextFollowUpLead = topFollowUps[0] ?? null;

  const updateLead = (id: string, patch: Partial<CRMLead>) => {
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

    if (syncMode === "POS_DB") {
      void updateCrmLeadInApi(id, patch).catch((err) => {
        console.warn("Failed to update CRM lead in API; switching to local mode:", err);
        setSyncMode("LOCAL_STORAGE");
      });
    }
  };

  const addLead = () => {
    if (!newLead.name.trim() || !newLead.phone.trim() || !newLead.interest.trim()) return;

    const created: CRMLead = {
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

    if (syncMode === "POS_DB") {
      void createCrmLeadInApi(created).catch((err) => {
        console.warn("Failed to create CRM lead in API; switching to local mode:", err);
        setSyncMode("LOCAL_STORAGE");
      });
    }

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

  const toggleUpsItem = (id: string) => {
    setUpsList((current) =>
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

  const addUpsItem = () => {
    if (!upsDraft.customer.trim() || !upsDraft.task.trim()) return;
    const created: UpsItem = {
      id: `ups-${Date.now()}`,
      customer: upsDraft.customer.trim(),
      task: upsDraft.task.trim(),
      owner: upsDraft.owner.trim() || "Unassigned",
      lane: upsDraft.lane,
      priority: upsDraft.priority,
      dueAt: upsDraft.dueAt || todayIso(),
      channel: upsDraft.channel,
      done: false,
    };
    setUpsList((current) => [created, ...current]);
    setUpsDraft((current) => ({
      ...current,
      customer: "",
      task: "",
      dueAt: todayIso(),
      priority: "Today",
      lane: "Unattended",
      channel: "SMS",
    }));
  };

  const toggleAutomation = (id: string) => {
    const currentRule = automations.find((item) => item.id === id);
    if (!currentRule) return;
    const nextEnabled = !currentRule.enabled;

    setAutomations((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              enabled: nextEnabled,
            }
          : item
      )
    );

    if (syncMode === "POS_DB") {
      void updateCrmAutomationInApi(id, nextEnabled).catch((err) => {
        console.warn("Failed to toggle CRM automation in API; switching to local mode:", err);
        setSyncMode("LOCAL_STORAGE");
      });
    }
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
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-emerald-50/60 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">CRM Command Center</div>
            <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">Daily Lead Flow</h2>
            <p className="max-w-2xl text-sm text-slate-600">
              Focuses the team on today&apos;s follow-ups first, then pipeline movement, then communication systems.
            </p>
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${
                syncMode === "POS_DB"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {syncMode === "POS_DB" ? "Sync: POS DB (shared)" : "Sync: Browser fallback"}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (!nextFollowUpLead) return;
                setSelectedLeadId(nextFollowUpLead.id);
                updateLead(nextFollowUpLead.id, { stage: "Contacted", lastTouch: `${todayIso()} 09:00` });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <PhoneCall size={15} /> Call Next Up
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedLead) {
                  updateLead(selectedLead.id, { stage: "Contacted", lastTouch: `${todayIso()} 09:00` });
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Mark Selected Contacted
            </button>
            <button
              type="button"
              onClick={() => setFocusMode((current) => !current)}
              className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold ${
                focusMode
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {focusMode ? "Full CRM Mode" : "Focused Rep Mode"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Open Leads</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.open}</div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
            <div className="text-[11px] uppercase tracking-wide text-violet-700">Appointments</div>
            <div className="mt-1 text-2xl font-semibold text-violet-900">{stats.appointments}</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
            <div className="text-[11px] uppercase tracking-wide text-blue-700">Quoted</div>
            <div className="mt-1 text-2xl font-semibold text-blue-900">{stats.quoted}</div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
            <div className="text-[11px] uppercase tracking-wide text-rose-700">Overdue</div>
            <div className="mt-1 text-2xl font-semibold text-rose-900">{stats.overdue}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
            <div className="text-[11px] uppercase tracking-wide text-emerald-700">Active UPS</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-900">{upsStats.active}</div>
          </div>
        </div>
      </section>

      <section className={`${focusMode ? "" : "hidden"} grid grid-cols-1 gap-4 xl:grid-cols-12`}>
        <div className="space-y-4 xl:col-span-7">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Focused Follow-up Queue</h3>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                Rep Mode
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {!topFollowUps.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No open follow-ups.
                </div>
              ) : (
                topFollowUps.map((lead) => (
                  <div
                    key={lead.id}
                    className={`rounded-xl border px-3 py-3 ${
                      selectedLeadId === lead.id
                        ? "border-blue-300 bg-blue-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={() => setSelectedLeadId(lead.id)} className="text-left">
                        <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
                        <div className="mt-1 text-xs text-slate-600">{lead.nextAction}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {lead.owner} · Due {lead.dueDate}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stagePillClass(lead.stage)}`}>
                          {lead.stage}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            updateLead(lead.id, { stage: "Contacted", lastTouch: `${todayIso()} 09:00` });
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          <PhoneCall size={12} /> Call
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Quick UPS Action</h3>
              <span className="text-xs text-slate-500">{focusUpsItems.length} active</span>
            </div>
            <div className="mt-3 space-y-2">
              {!focusUpsItems.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  No active UPS items.
                </div>
              ) : (
                focusUpsItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.customer}</div>
                        <div className="mt-1 text-xs text-slate-600">{item.task}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{item.owner} · {item.lane}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleUpsItem(item.id)}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:col-span-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Selected Lead</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">Rep Edit</span>
            </div>
            {!selectedLead ? (
              <p className="mt-3 text-sm text-slate-500">Select a lead to edit details.</p>
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
                <input
                  value={selectedLead.nextAction}
                  onChange={(event) => updateLead(selectedLead.id, { nextAction: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                  className="h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Notes"
                />
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Bot size={14} /> Quick Templates
            </div>
            <div className="mt-3 space-y-2">
              {templates.slice(0, 2).map((template) => (
                <div key={template.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-sm font-semibold text-slate-900">{template.title}</div>
                  <button
                    type="button"
                    onClick={() => copyTemplate(template.id, template.body)}
                    className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {copiedTemplate === template.id ? "Copied" : "Copy template"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className={`${focusMode ? "hidden " : ""}grid grid-cols-1 gap-5 xl:grid-cols-12`}>
        <div className="space-y-5 xl:col-span-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Today&apos;s Follow-ups</h3>
                <p className="text-xs text-slate-500">Ordered by due date so reps know what to do next.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {topFollowUps.length} showing
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {!topFollowUps.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No open follow-ups.
                </div>
              ) : (
                topFollowUps.map((lead) => (
                  <div
                    key={lead.id}
                    className={`rounded-2xl border px-3 py-3 ${
                      selectedLeadId === lead.id
                        ? "border-blue-300 bg-blue-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="text-left"
                      >
                        <div className="text-sm font-semibold text-slate-900">{lead.name}</div>
                        <div className="mt-1 text-xs text-slate-600">{lead.nextAction}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {lead.owner} · Due {lead.dueDate}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stagePillClass(lead.stage)}`}>
                          {lead.stage}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            updateLead(lead.id, { stage: "Contacted", lastTouch: `${todayIso()} 09:00` });
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          <PhoneCall size={12} /> Call
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Pipeline Board</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">Dragless quick stage updates</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <div className="flex min-w-[980px] gap-4 pb-1">
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
                                stage: event.target.value as CRMLeadStage,
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
          </section>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Contact 360</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">Live editor</span>
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
                <div className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  Stage: {selectedLead.stage}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Lead Intake</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">Fast add</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
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
              <div className="grid grid-cols-2 gap-2">
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
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newLead.owner}
                  onChange={(event) => setNewLead((current) => ({ ...current, owner: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Owner"
                />
                <select
                  value={newLead.channel}
                  onChange={(event) =>
                    setNewLead((current) => ({ ...current, channel: event.target.value as CRMLeadChannel }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="SMS">SMS</option>
                  <option value="Webchat">Webchat</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Phone">Phone</option>
                </select>
              </div>
              <input
                value={newLead.source}
                onChange={(event) => setNewLead((current) => ({ ...current, source: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Lead source"
              />
            </div>
            <button
              type="button"
              onClick={addLead}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={14} /> Add Lead
            </button>
          </section>
        </div>
      </section>

      <section className={`${focusMode ? "hidden " : ""}grid grid-cols-1 gap-5 xl:grid-cols-12`}>
        <div className="space-y-5 xl:col-span-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">UPS Queue</h3>
                <p className="text-xs text-slate-500">Unattended, be-back, and quote follow-up lanes in one view.</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Active {upsStats.active}</span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">Hot {upsStats.hot}</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">Done {upsStats.completed}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                <input
                  value={upsDraft.customer}
                  onChange={(event) => setUpsDraft((current) => ({ ...current, customer: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Customer"
                />
                <input
                  value={upsDraft.task}
                  onChange={(event) => setUpsDraft((current) => ({ ...current, task: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addUpsItem();
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Next action"
                />
                <input
                  value={upsDraft.owner}
                  onChange={(event) => setUpsDraft((current) => ({ ...current, owner: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Owner"
                />
                <input
                  type="date"
                  value={upsDraft.dueAt}
                  onChange={(event) => setUpsDraft((current) => ({ ...current, dueAt: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <select
                  value={upsDraft.priority}
                  onChange={(event) =>
                    setUpsDraft((current) => ({
                      ...current,
                      priority: event.target.value as UpsPriority,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="Hot">Hot</option>
                  <option value="Today">Today</option>
                  <option value="Nurture">Nurture</option>
                </select>
                <select
                  value={upsDraft.lane}
                  onChange={(event) =>
                    setUpsDraft((current) => ({
                      ...current,
                      lane: event.target.value as UpsLane,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="Unattended">Unattended</option>
                  <option value="Be-Back">Be-Back</option>
                  <option value="Quote Follow-up">Quote Follow-up</option>
                </select>
                <select
                  value={upsDraft.channel}
                  onChange={(event) =>
                    setUpsDraft((current) => ({
                      ...current,
                      channel: event.target.value as CRMLeadChannel,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="SMS">SMS</option>
                  <option value="Webchat">Webchat</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Phone">Phone</option>
                </select>
                <button
                  type="button"
                  onClick={addUpsItem}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus size={14} /> Add UPS Item
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {UPS_LANES.map((lane) => (
                <div key={lane} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${upsLaneClass(lane)}`}>
                      {lane}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{upsByLane[lane].length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {!upsByLane[lane].length ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                        No active items.
                      </div>
                    ) : (
                      upsByLane[lane].map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{item.customer}</div>
                              <div className="mt-1 text-xs text-slate-600">{item.task}</div>
                            </div>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${upsPriorityClass(item.priority)}`}>
                              {item.priority}
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500">
                            {item.owner} · Due {item.dueAt} · {item.channel}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleUpsItem(item.id)}
                            className="mt-2 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white"
                          >
                            Done
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!!completedUps.length && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recently Completed</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {completedUps.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleUpsItem(item.id)}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600"
                    >
                      <span className="line-through">{item.customer} - {item.task}</span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        Reopen
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <UsersRound size={14} /> Team Ownership
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Owner name is visible everywhere so reps know who is accountable for next action.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <CalendarCheck2 size={14} /> Follow-up Discipline
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Today-first queue keeps urgency visible and prevents leads from going stale.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <UserRound size={14} /> Contact Context
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Contact 360 and message snippets keep every outreach personal and consistent.
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
          </section>
        </div>
      </section>
    </div>
  );
};

export default CRMWorkspace;
