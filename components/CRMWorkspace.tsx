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
import type {
  AuthUser,
  CRMCustomerAccount,
  CRMCustomerOrder,
  CRMAutomationRule,
  CRMLead,
  CRMLeadChannel,
  CRMLeadStage,
  CRMOwnerOption,
  CRMUpsQueueItem,
  UpsQueueCustomerType,
} from "../types";
import { checkPosBackendHealthy } from "../services/posBackendApi";
import {
  createCrmAutomationInApi,
  createCrmLeadInApi,
  createCrmUpsInApi,
  completeCrmUpsQueueCustomerInApi,
  fetchCrmAutomationsFromApi,
  fetchCrmLeadsFromApi,
  fetchCrmOwnersFromApi,
  fetchCrmUpsFromApi,
  fetchCrmUpsQueueFromApi,
  findCrmCustomerAccount,
  joinCrmUpsQueueInApi,
  leaveCrmUpsQueueInApi,
  upsertCrmCustomerAccount,
  startCrmUpsQueueCustomerInApi,
  updateCrmAutomationInApi,
  updateCrmLeadInApi,
  updateCrmUpsInApi,
} from "../services/crmApi";
import {
  normalizeUpsList,
  type UpsItem,
} from "./crmUpsUtils";

type CRMSyncMode = "POS_DB" | "LOCAL_STORAGE";

const LEAD_KEY = "fd_crm_leads_v1";
const AUTOMATION_KEY = "fd_crm_automations_v1";
const UPS_KEY = "fd_crm_ups_list_v1";
const UPS_REP_QUEUE_KEY = "fd_crm_rep_ups_queue_v1";

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

const FLOOR_SALESPEOPLE = ["Alex", "Jordan", "Taylor", "Morgan", "Jamie"];
const DEFAULT_STORES = ["FD7", "FD5", "FD51"];

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

type CRMWorkspaceProps = {
  authUser: AuthUser;
};

const CRMWorkspace: React.FC<CRMWorkspaceProps> = ({ authUser }) => {
  const showLegacyCards = false;
  const isManager = authUser.roles.includes("Owner") || authUser.roles.includes("Manager");
  const isSalesOnly = authUser.roles.includes("Sales") && !isManager;
  const [leadScope, setLeadScope] = useState<"my" | "team">(isSalesOnly ? "my" : "team");
  const [syncMode, setSyncMode] = useState<CRMSyncMode>("LOCAL_STORAGE");
  const [focusMode, setFocusMode] = useState(false);
  const [leads, setLeads] = useState<CRMLead[]>(() => readLocal(LEAD_KEY, seedLeads));
  const [upsList, setUpsList] = useState<UpsItem[]>(() => normalizeUpsList(readLocal(UPS_KEY, seedUpsList), seedUpsList, todayIso));
  const [upsRepQueue, setUpsRepQueue] = useState<CRMUpsQueueItem[]>(() => readLocal(UPS_REP_QUEUE_KEY, [] as CRMUpsQueueItem[]));
  const [selectedUpsStore, setSelectedUpsStore] = useState<string>(DEFAULT_STORES[0]);
  const [upsStartDrafts, setUpsStartDrafts] = useState<Record<string, { customer: string; type: UpsQueueCustomerType }>>({});
  const [customerDraft, setCustomerDraft] = useState({
    name: "",
    phone: "",
    email: "",
    store: DEFAULT_STORES[0],
    notes: "",
  });
  const [customerSearch, setCustomerSearch] = useState({ phone: "", email: "" });
  const [customerMatches, setCustomerMatches] = useState<CRMCustomerAccount[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CRMCustomerOrder[]>([]);
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerMsg, setCustomerMsg] = useState<string | null>(null);
  const [upsDraft, setUpsDraft] = useState({
    customer: "",
    task: "",
    owner: "Unassigned",
    channel: "SMS" as CRMLeadChannel,
  });
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState<CRMOwnerOption[]>([]);
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
      const [apiLeads, apiAutomations, apiUps] = await Promise.all([
        fetchCrmLeadsFromApi(leadScope),
        fetchCrmAutomationsFromApi(),
        fetchCrmUpsFromApi(),
      ]);

      if (!apiLeads.length && !isSalesOnly) {
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

      if (!apiUps.length) {
        await Promise.all(
          seedUpsList.map(async (item) => {
            try {
              await createCrmUpsInApi(item);
            } catch {
              // If another client seeded first, ignore duplicate inserts.
            }
          })
        );
      }
    };

    const loadFromApi = async () => {
      try {
        const [apiLeads, apiAutomations, apiUps] = await Promise.all([
          fetchCrmLeadsFromApi(leadScope),
          fetchCrmAutomationsFromApi(),
          fetchCrmUpsFromApi(),
        ]);

        if ((!apiLeads.length && !isSalesOnly) || !apiAutomations.length || !apiUps.length) {
          await seedApiIfEmpty();
        }

        const [freshLeads, freshAutomations, freshUps, freshOwners, freshUpsQueue] = await Promise.all([
          fetchCrmLeadsFromApi(leadScope),
          fetchCrmAutomationsFromApi(),
          fetchCrmUpsFromApi(),
          fetchCrmOwnersFromApi(),
          fetchCrmUpsQueueFromApi(selectedUpsStore),
        ]);
        if (stopped) return;
        setLeads(freshLeads.length ? freshLeads : isSalesOnly ? [] : seedLeads);
        setAutomations(freshAutomations.length ? freshAutomations : seedAutomations);
        setUpsList(freshUps.length ? normalizeUpsList(freshUps, seedUpsList, todayIso) : seedUpsList);
        setOwners(freshOwners);
        setUpsRepQueue(freshUpsQueue);
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
  }, [leadScope, isSalesOnly, selectedUpsStore]);

  useEffect(() => {
    if (isSalesOnly && leadScope !== "my") {
      setLeadScope("my");
    }
  }, [isSalesOnly, leadScope]);

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
      localStorage.setItem(UPS_REP_QUEUE_KEY, JSON.stringify(upsRepQueue));
    } catch {
      // ignore storage failures
    }
  }, [upsRepQueue]);

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

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const ownerLookup = useMemo(() => {
    const byName = new Map<string, CRMOwnerOption>();
    const byId = new Map<string, CRMOwnerOption>();
    for (const owner of owners) {
      if (owner.id) byId.set(owner.id, owner);
      if (owner.name) byName.set(owner.name.toLowerCase(), owner);
      if (owner.email) byName.set(owner.email.toLowerCase(), owner);
    }
    return { byName, byId };
  }, [owners]);

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

  const orderedUpsList = useMemo(() => {
    return [...upsList].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const aAssigned = a.owner.trim() && a.owner !== "Unassigned";
      const bAssigned = b.owner.trim() && b.owner !== "Unassigned";
      if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
      const aStart = a.startedAt || "";
      const bStart = b.startedAt || "";
      if (aStart !== bStart) return bStart.localeCompare(aStart);
      return b.dueAt.localeCompare(a.dueAt);
    });
  }, [upsList]);

  const activeUps = useMemo(() => orderedUpsList.filter((item) => !item.done), [orderedUpsList]);
  const waitingUps = useMemo(
    () => activeUps.filter((item) => !item.owner.trim() || item.owner === "Unassigned"),
    [activeUps]
  );
  const engagedUps = useMemo(
    () => activeUps.filter((item) => item.owner.trim() && item.owner !== "Unassigned"),
    [activeUps]
  );
  const completedUps = useMemo(() => orderedUpsList.filter((item) => item.done).slice(0, 8), [orderedUpsList]);

  const floorSalespeople = useMemo(() => {
    const set = new Set<string>(FLOOR_SALESPEOPLE);
    for (const owner of owners) {
      const canOwnLeads = owner.roles.includes("Owner") || owner.roles.includes("Manager") || owner.roles.includes("Sales");
      if (!canOwnLeads) continue;
      const name = owner.name.trim();
      if (name) set.add(name);
    }
    for (const lead of leads) {
      const owner = String(lead.owner || "").trim();
      if (!owner || owner === "Unassigned") continue;
      set.add(owner);
    }
    for (const item of upsList) {
      const owner = String(item.owner || "").trim();
      if (!owner || owner === "Unassigned") continue;
      set.add(owner);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [owners, leads, upsList]);

  const ownerOptions = useMemo(() => ["Unassigned", ...floorSalespeople], [floorSalespeople]);

  const upsStoreOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_STORES);
    for (const lead of leads) {
      const store = String(lead.store || "").trim();
      if (store) set.add(store);
    }
    for (const item of upsRepQueue) {
      const store = String(item.store || "").trim();
      if (store) set.add(store);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads, upsRepQueue]);

  useEffect(() => {
    if (!upsStoreOptions.length) return;
    if (upsStoreOptions.includes(selectedUpsStore)) return;
    setSelectedUpsStore(upsStoreOptions[0]);
  }, [selectedUpsStore, upsStoreOptions]);

  const selectedStoreQueue = useMemo(
    () =>
      upsRepQueue
        .filter((item) => item.store === selectedUpsStore)
        .sort((a, b) => {
          if (a.queuePosition !== b.queuePosition) return a.queuePosition - b.queuePosition;
          return String(a.checkedInAt || "").localeCompare(String(b.checkedInAt || ""));
        }),
    [upsRepQueue, selectedUpsStore]
  );

  const floorStatus = useMemo(() => {
    return floorSalespeople.map((rep) => {
      const assignments = engagedUps.filter((item) => item.owner === rep);
      const activeCustomer = assignments[0] || null;
      return {
        rep,
        assignments,
        activeCustomer,
        isDown: Boolean(activeCustomer),
      };
    });
  }, [floorSalespeople, engagedUps]);

  const topFollowUps = useMemo(() => followUps.slice(0, 6), [followUps]);
  const focusUpsItems = useMemo(() => orderedUpsList.filter((item) => !item.done).slice(0, 6), [orderedUpsList]);

  const updateLead = (id: string, patch: Partial<CRMLead>) => {
    const ownerPatch = patch.owner !== undefined ? ownerLookup.byName.get(String(patch.owner).toLowerCase()) : null;
    const normalizedPatch =
      ownerPatch && patch.ownerUserId === undefined
        ? { ...patch, owner: ownerPatch.name, ownerUserId: ownerPatch.id }
        : patch;

    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              ...normalizedPatch,
            }
          : lead
      )
    );

    if (syncMode === "POS_DB") {
      void updateCrmLeadInApi(id, normalizedPatch).catch((err) => {
        console.warn("Failed to update CRM lead in API; switching to local mode:", err);
        setSyncMode("LOCAL_STORAGE");
      });
    }
  };

  const addLead = () => {
    if (!newLead.name.trim() || !newLead.phone.trim() || !newLead.interest.trim()) return;

    const ownerOption = ownerLookup.byName.get(String(newLead.owner || "").toLowerCase());
    const created: CRMLead = {
      id: `lead-${Date.now()}`,
      name: newLead.name.trim(),
      phone: newLead.phone.trim(),
      channel: newLead.channel,
      source: newLead.source.trim() || "Website",
      interest: newLead.interest.trim(),
      budget: newLead.budget.trim() || "Unspecified",
      store: newLead.store.trim() || "FD7",
      owner: ownerOption?.name || newLead.owner.trim() || "Unassigned",
      ownerUserId: ownerOption?.id || null,
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
    const currentItem = upsList.find((item) => item.id === id);
    if (!currentItem) return;
    const nextItem: UpsItem = {
      ...currentItem,
      done: !currentItem.done,
      startedAt:
        currentItem.done && currentItem.owner && currentItem.owner !== "Unassigned"
          ? currentItem.startedAt || new Date().toISOString()
          : currentItem.startedAt,
    };
    setUpsList((current) => current.map((item) => (item.id === id ? nextItem : item)));
    if (syncMode === "POS_DB") {
      void updateCrmUpsInApi(id, {
        done: nextItem.done,
        startedAt: nextItem.startedAt,
      }).catch((err) => {
        console.warn("Failed to update CRM UPS item in API; switching to local mode:", err);
        setSyncMode("LOCAL_STORAGE");
      });
    }
  };

  const assignUpsItem = (id: string, owner: string) => {
    const normalizedOwner = owner.trim() || "Unassigned";
    const ownerOption = ownerLookup.byName.get(normalizedOwner.toLowerCase()) || ownerLookup.byId.get(normalizedOwner);
    const currentItem = upsList.find((item) => item.id === id);
    if (!currentItem) return;
    const assigned = normalizedOwner !== "Unassigned";
    const nextItem: UpsItem = {
      ...currentItem,
      owner: ownerOption?.name || normalizedOwner,
      ownerUserId: ownerOption?.id || null,
      lane: assigned ? "Quote Follow-up" : "Unattended",
      priority: assigned ? "Hot" : currentItem.priority,
      startedAt: assigned ? currentItem.startedAt || new Date().toISOString() : undefined,
    };
    setUpsList((current) => current.map((item) => (item.id === id ? nextItem : item)));
    if (syncMode === "POS_DB") {
      void updateCrmUpsInApi(id, {
        owner: nextItem.owner,
        ownerUserId: nextItem.ownerUserId,
        lane: nextItem.lane,
        priority: nextItem.priority,
        startedAt: nextItem.startedAt,
      }).catch((err) => {
        console.warn("Failed to assign CRM UPS item in API; switching to local mode:", err);
        setSyncMode("LOCAL_STORAGE");
      });
    }
  };

  const addUpsItem = () => {
    if (!upsDraft.customer.trim()) return;
    const owner = upsDraft.owner.trim() || "Unassigned";
    const assigned = owner !== "Unassigned";
    const ownerOption = ownerLookup.byName.get(owner.toLowerCase()) || ownerLookup.byId.get(owner);
    const created: UpsItem = {
      id: `ups-${Date.now()}`,
      customer: upsDraft.customer.trim(),
      task: upsDraft.task.trim() || "Showroom walk-in customer",
      owner: ownerOption?.name || owner,
      ownerUserId: ownerOption?.id || null,
      lane: assigned ? "Quote Follow-up" : "Unattended",
      priority: assigned ? "Hot" : "Today",
      dueAt: todayIso(),
      channel: upsDraft.channel,
      done: false,
      startedAt: assigned ? new Date().toISOString() : undefined,
    };
    setUpsList((current) => [created, ...current]);
    if (syncMode === "POS_DB") {
      void createCrmUpsInApi(created).catch((err) => {
        console.warn("Failed to create CRM UPS item in API; switching to local mode:", err);
        setSyncMode("LOCAL_STORAGE");
      });
    }
    setUpsDraft((current) => ({
      ...current,
      customer: "",
      task: "",
      owner: "Unassigned",
      channel: "SMS",
    }));
  };

  const updateSelectedStoreQueue = (updater: (storeQueue: CRMUpsQueueItem[]) => CRMUpsQueueItem[]) => {
    setUpsRepQueue((current) => {
      const storeQueue = current.filter((item) => item.store === selectedUpsStore);
      const otherStores = current.filter((item) => item.store !== selectedUpsStore);
      const updatedStore = updater(storeQueue).map((item, index) => ({
        ...item,
        queuePosition: index + 1,
      }));
      return [...otherStores, ...updatedStore];
    });
  };

  const joinUpsQueueAsMe = () => {
    const me = authUser.name.trim();
    if (!me) return;
    if (syncMode === "POS_DB") {
      void joinCrmUpsQueueInApi(selectedUpsStore)
        .then(() => fetchCrmUpsQueueFromApi(selectedUpsStore))
        .then((rows) => setUpsRepQueue(rows))
        .catch((err) => {
          console.warn("Failed to join UPS queue via API; switching to local mode:", err);
          setSyncMode("LOCAL_STORAGE");
        });
      return;
    }
    updateSelectedStoreQueue((storeQueue) => {
      const alreadyInQueue = storeQueue.some((item) => item.rep.toLowerCase() === me.toLowerCase());
      if (alreadyInQueue) return storeQueue;
      return [
        ...storeQueue,
        {
          id: `ups-rep-${Date.now()}`,
          rep: me,
          store: selectedUpsStore,
          status: "waiting",
          queuePosition: storeQueue.length + 1,
          repUserId: authUser.id,
          checkedInAt: new Date().toISOString(),
          currentCustomer: null,
          currentCustomerType: null,
          startedAt: null,
        },
      ];
    });
  };

  const leaveUpsQueue = (id: string) => {
    if (syncMode === "POS_DB") {
      void leaveCrmUpsQueueInApi(id)
        .then(() => fetchCrmUpsQueueFromApi(selectedUpsStore))
        .then((rows) => setUpsRepQueue(rows))
        .catch((err) => {
          console.warn("Failed to leave UPS queue via API; switching to local mode:", err);
          setSyncMode("LOCAL_STORAGE");
        });
      return;
    }
    updateSelectedStoreQueue((storeQueue) => storeQueue.filter((item) => item.id !== id));
  };

  const startUpsCustomer = (id: string) => {
    const draft = upsStartDrafts[id];
    const customerName = draft?.customer?.trim() || "";
    const customerType = (draft?.type || "Regular Up") as UpsQueueCustomerType;
    if (!customerName) return;
    setCustomerDraft((current) => ({
      ...current,
      name: current.name || customerName,
      store: selectedUpsStore,
    }));

    if (syncMode === "POS_DB") {
      void startCrmUpsQueueCustomerInApi(id, { customer: customerName, customerType })
        .then(() => fetchCrmUpsQueueFromApi(selectedUpsStore))
        .then((rows) => setUpsRepQueue(rows))
        .catch((err) => {
          console.warn("Failed to start UPS customer via API; switching to local mode:", err);
          setSyncMode("LOCAL_STORAGE");
        });
      setUpsStartDrafts((current) => ({
        ...current,
        [id]: {
          customer: "",
          type: "Regular Up",
        },
      }));
      return;
    }

    updateSelectedStoreQueue((storeQueue) =>
      storeQueue.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "working",
              currentCustomer: customerName,
              currentCustomerType: customerType,
              startedAt: new Date().toISOString(),
            }
          : item
      )
    );

    setUpsStartDrafts((current) => ({
      ...current,
      [id]: {
        customer: "",
        type: "Regular Up",
      },
    }));
  };

  const completeUpsCustomer = (id: string) => {
    if (syncMode === "POS_DB") {
      void completeCrmUpsQueueCustomerInApi(id)
        .then((rows) => setUpsRepQueue(rows))
        .catch((err) => {
          console.warn("Failed to complete UPS customer via API; switching to local mode:", err);
          setSyncMode("LOCAL_STORAGE");
        });
      return;
    }

    updateSelectedStoreQueue((storeQueue) => {
      const idx = storeQueue.findIndex((item) => item.id === id);
      if (idx < 0) return storeQueue;
      const completed = storeQueue[idx];
      const resetRep: CRMUpsQueueItem = {
        ...completed,
        status: "waiting",
        currentCustomer: null,
        currentCustomerType: null,
        startedAt: null,
      };
      const others = storeQueue.filter((item) => item.id !== id);
      if (completed.currentCustomerType === "B-Back") {
        return [resetRep, ...others];
      }
      return [...others, resetRep];
    });
  };

  const handleCustomerLookup = async () => {
    const phone = customerSearch.phone.trim();
    const email = customerSearch.email.trim();
    if (!phone && !email) {
      setCustomerMsg("Enter phone or email to search.");
      return;
    }
    setCustomerBusy(true);
    setCustomerMsg(null);
    try {
      const result = await findCrmCustomerAccount({ phone, email });
      setCustomerMatches(result.customers);
      setCustomerOrders(result.orders);
      setCustomerMsg(
        `Found ${result.customers.length} account${result.customers.length === 1 ? "" : "s"} and ${result.orders.length} order${result.orders.length === 1 ? "" : "s"}.`
      );
    } catch (err: any) {
      setCustomerMsg(String(err?.message || "Customer lookup failed."));
    } finally {
      setCustomerBusy(false);
    }
  };

  const handleCustomerUpsert = async () => {
    if (!customerDraft.name.trim()) {
      setCustomerMsg("Customer name is required.");
      return;
    }
    if (!customerDraft.phone.trim() && !customerDraft.email.trim()) {
      setCustomerMsg("Phone or email is required.");
      return;
    }
    setCustomerBusy(true);
    setCustomerMsg(null);
    try {
      const result = await upsertCrmCustomerAccount({
        name: customerDraft.name.trim(),
        phone: customerDraft.phone.trim(),
        email: customerDraft.email.trim(),
        store: customerDraft.store.trim() || selectedUpsStore,
        notes: customerDraft.notes.trim(),
      });
      setCustomerMatches([result.customer]);
      setCustomerOrders(result.orders);
      setCustomerMsg(`Saved ${result.customer.name}. Linked ${result.orders.length} sales order(s).`);
      setCustomerSearch({
        phone: result.customer.phone || "",
        email: result.customer.email || "",
      });
    } catch (err: any) {
      setCustomerMsg(String(err?.message || "Saving customer failed."));
    } finally {
      setCustomerBusy(false);
    }
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

  const formatStartedAt = (value?: string | null) => {
    if (!value) return "just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "just now";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="space-y-5">
      {showLegacyCards && (
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
                        <div className="mt-1 text-[11px] text-slate-500">
                          {item.owner === "Unassigned" ? "Waiting for rep assignment" : `${item.owner} · Down since ${formatStartedAt(item.startedAt)}`}
                        </div>
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
      )}

      <section className={`${focusMode ? "hidden " : ""}`}>
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Top Priority</div>
              <h3 className="text-xl font-semibold text-slate-900">UPS Command Board</h3>
              <p className="text-xs text-slate-500">Fast store-level line control. Regular Up sends rep to the back. B-Back sends rep to the front.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedUpsStore}
                onChange={(event) => setSelectedUpsStore(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {upsStoreOptions.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={joinUpsQueueAsMe}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus size={14} /> Join Line
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Total Reps</div>
              <div className="text-lg font-semibold text-slate-900">{selectedStoreQueue.length}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700">Waiting</div>
              <div className="text-lg font-semibold text-emerald-900">
                {selectedStoreQueue.filter((item) => item.status === "waiting").length}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-amber-700">Working</div>
              <div className="text-lg font-semibold text-amber-900">
                {selectedStoreQueue.filter((item) => item.status === "working").length}
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-blue-700">My Spot</div>
              <div className="text-lg font-semibold text-blue-900">
                {Math.max(
                  selectedStoreQueue.findIndex((item) => item.rep.toLowerCase() === authUser.name.toLowerCase()) + 1,
                  0
                ) || "-"}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {!selectedStoreQueue.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No reps are in the line for {selectedUpsStore} yet.
              </div>
            ) : (
              selectedStoreQueue.map((entry, index) => {
                const draft = upsStartDrafts[entry.id] || { customer: "", type: "Regular Up" as UpsQueueCustomerType };
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">#{index + 1} {entry.rep}</div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              entry.status === "working"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {entry.status === "working" ? "WORKING" : "WAITING"}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {entry.status === "working"
                            ? `${entry.currentCustomer || "Customer"} (${entry.currentCustomerType || "Regular Up"}) since ${formatStartedAt(entry.startedAt)}`
                            : `Checked in ${formatStartedAt(entry.checkedInAt)} · Ready for next customer`}
                        </div>
                      </div>

                      {entry.status === "waiting" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={draft.customer}
                            onChange={(event) =>
                              setUpsStartDrafts((current) => ({
                                ...current,
                                [entry.id]: {
                                  ...draft,
                                  customer: event.target.value,
                                },
                              }))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                            placeholder="Customer"
                          />
                          <select
                            value={draft.type}
                            onChange={(event) =>
                              setUpsStartDrafts((current) => ({
                                ...current,
                                [entry.id]: {
                                  ...draft,
                                  type: event.target.value as UpsQueueCustomerType,
                                },
                              }))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                          >
                            <option value="Regular Up">Regular Up</option>
                            <option value="B-Back">B-Back</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => startUpsCustomer(entry.id)}
                            className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white"
                          >
                            Start
                          </button>
                          <button
                            type="button"
                            onClick={() => leaveUpsQueue(entry.id)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            Leave
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => completeUpsCustomer(entry.id)}
                          className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </section>

      <section className={`${focusMode ? "hidden " : ""}`}>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Customer Account + Sales Match</h3>
              <p className="text-xs text-slate-500">
                Save from UPS and tie records together by phone/email. Orders auto-link by phone today.
              </p>
            </div>
            {customerMsg && <div className="text-xs font-semibold text-slate-600">{customerMsg}</div>}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create / Update Account</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <input
                  value={customerDraft.name}
                  onChange={(e) => setCustomerDraft((c) => ({ ...c, name: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Customer name"
                />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input
                    value={customerDraft.phone}
                    onChange={(e) => setCustomerDraft((c) => ({ ...c, phone: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Phone"
                  />
                  <input
                    value={customerDraft.email}
                    onChange={(e) => setCustomerDraft((c) => ({ ...c, email: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Email"
                  />
                </div>
                <input
                  value={customerDraft.store}
                  onChange={(e) => setCustomerDraft((c) => ({ ...c, store: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Store"
                />
                <input
                  value={customerDraft.notes}
                  onChange={(e) => setCustomerDraft((c) => ({ ...c, notes: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Notes"
                />
                <button
                  type="button"
                  disabled={customerBusy}
                  onClick={() => void handleCustomerUpsert()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {customerBusy ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Find + Link Existing</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input
                    value={customerSearch.phone}
                    onChange={(e) => setCustomerSearch((c) => ({ ...c, phone: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Search phone"
                  />
                  <input
                    value={customerSearch.email}
                    onChange={(e) => setCustomerSearch((c) => ({ ...c, email: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Search email"
                  />
                </div>
                <button
                  type="button"
                  disabled={customerBusy}
                  onClick={() => void handleCustomerLookup()}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  {customerBusy ? "Searching..." : "Find Customer"}
                </button>
                {!!customerMatches.length && (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    {customerMatches.map((match) => (
                      <div key={match.id}>{match.name} • {match.phone || "No phone"} • {match.email || "No email"}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Sales Orders</div>
            {!customerOrders.length ? (
              <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                No linked orders yet.
              </div>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-1">Sale ID</th>
                      <th className="px-2 py-1">Customer</th>
                      <th className="px-2 py-1">Sale Date</th>
                      <th className="px-2 py-1">Delivered</th>
                      <th className="px-2 py-1">Store</th>
                      <th className="px-2 py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.slice(0, 25).map((order) => (
                      <tr key={order.saleId} className="border-t border-slate-200 text-slate-700">
                        <td className="px-2 py-1">{order.saleId}</td>
                        <td className="px-2 py-1">{order.customerName}</td>
                        <td className="px-2 py-1">{order.saleDate || "-"}</td>
                        <td className="px-2 py-1">{order.deliveryConfirmedDate || "-"}</td>
                        <td className="px-2 py-1">{order.location || "-"}</td>
                        <td className="px-2 py-1">
                          {order.grandTotal === null ? "-" : `$${Number(order.grandTotal).toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </section>

      {showLegacyCards && (
      <>
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
                  <select
                    value={selectedLead.owner}
                    onChange={(event) => updateLead(selectedLead.id, { owner: event.target.value })}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
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
                <select
                  value={newLead.owner}
                  onChange={(event) => setNewLead((current) => ({ ...current, owner: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
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
      </>
      )}
    </div>
  );
};

export default CRMWorkspace;
