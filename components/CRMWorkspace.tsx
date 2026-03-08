import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock3,
  Phone,
  Search,
  Sparkles,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  AuthUser,
  CRMCustomerAccount,
  CRMCustomerOrder,
  CRMLead,
  CRMLeadChannel,
  CRMLeadStage,
  CRMOwnerOption,
  CRMSearchResult,
  CRMUpsQueueItem,
  UpsQueueCustomerType,
} from "../types";
import { checkPosBackendHealthy } from "../services/posBackendApi";
import {
  createCrmLeadInApi,
  fetchCrmLeadsFromApi,
  fetchCrmOwnersFromApi,
  fetchCrmUpsQueueFromApi,
  joinCrmUpsQueueInApi,
  leaveCrmUpsQueueInApi,
  searchCrmRecords,
  startCrmUpsQueueCustomerInApi,
  updateCrmLeadInApi,
  updateCrmUpsQueueCustomerInApi,
  upsertCrmCustomerAccount,
  completeCrmUpsQueueCustomerInApi,
} from "../services/crmApi";

type CRMWorkspaceProps = {
  authUser: AuthUser;
};

type SyncMode = "POS_DB" | "OFFLINE";

type WorkspaceDraft = {
  leadId: string | null;
  queueId: string | null;
  accountId: string | null;
  name: string;
  phone: string;
  email: string;
  store: string;
  owner: string;
  ownerUserId: string | null;
  channel: CRMLeadChannel;
  source: string;
  interest: string;
  budget: string;
  stage: CRMLeadStage;
  nextAction: string;
  dueDate: string;
  notes: string;
  visualDescription: string;
};

const LOCATION_OPTIONS = ["Camp", "Base", "G1", "FD7", "FD5"];
const STAGE_OPTIONS: CRMLeadStage[] = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"];
const CHANNEL_OPTIONS: CRMLeadChannel[] = ["SMS", "Phone", "Webchat", "Facebook", "Instagram"];
const CUSTOMER_TYPE_OPTIONS: UpsQueueCustomerType[] = ["Regular Up", "B-Back"];

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptySearch: CRMSearchResult = {
  customers: [],
  leads: [],
  orders: [],
};

const buildEmptyDraft = (authUser: AuthUser, store: string): WorkspaceDraft => ({
  leadId: null,
  queueId: null,
  accountId: null,
  name: "",
  phone: "",
  email: "",
  store,
  owner: authUser.name || "Unassigned",
  ownerUserId: authUser.id || null,
  channel: "Phone",
  source: "Showroom Walk-In",
  interest: "",
  budget: "",
  stage: "New",
  nextAction: "Greet customer and gather needs",
  dueDate: todayIso(),
  notes: "",
  visualDescription: "",
});

const formatWhen = (value: string | null) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const stageBadgeClass = (stage: CRMLeadStage) => {
  if (stage === "Won") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  if (stage === "Lost") return "border-rose-400/40 bg-rose-500/15 text-rose-100";
  if (stage === "Quoted") return "border-sky-400/40 bg-sky-500/15 text-sky-100";
  if (stage === "Appointment") return "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100";
  if (stage === "Contacted") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  return "border-slate-500/60 bg-slate-700/70 text-slate-100";
};

const queueStatusClass = (item: CRMUpsQueueItem) =>
  item.status === "working"
    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
    : "border-slate-500/60 bg-slate-700/70 text-slate-100";

const cardClass =
  "rounded-3xl border border-white/10 bg-slate-900/88 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur";

const mutedLabelClass = "text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400";

const CRMWorkspace: React.FC<CRMWorkspaceProps> = ({ authUser }) => {
  const isManager = authUser.roles.includes("Owner") || authUser.roles.includes("Manager");
  const scopeOptions = isManager ? (["team", "my"] as const) : (["my"] as const);
  const [leadScope, setLeadScope] = useState<"team" | "my">(isManager ? "team" : "my");
  const [syncMode, setSyncMode] = useState<SyncMode>("OFFLINE");
  const [selectedStore, setSelectedStore] = useState<string>("FD7");
  const [owners, setOwners] = useState<CRMOwnerOption[]>([]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [queue, setQueue] = useState<CRMUpsQueueItem[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceDraft>(() => buildEmptyDraft(authUser, "FD7"));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CRMSearchResult>(emptySearch);
  const [searchBusy, setSearchBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queueJoinBusy, setQueueJoinBusy] = useState(false);
  const [searchTouched, setSearchTouched] = useState(false);
  const [startDrafts, setStartDrafts] = useState<Record<string, { customer: string; customerType: UpsQueueCustomerType; details: string }>>({});
  const [saveBusy, setSaveBusy] = useState<"lead" | "account" | "sync" | null>(null);

  const loadCrmData = async () => {
    const healthy = await checkPosBackendHealthy();
    if (!healthy) {
      setSyncMode("OFFLINE");
      return;
    }

    const [ownerRows, leadRows, queueRows] = await Promise.all([
      fetchCrmOwnersFromApi(),
      fetchCrmLeadsFromApi(leadScope),
      fetchCrmUpsQueueFromApi(selectedStore),
    ]);
    setSyncMode("POS_DB");
    setOwners(ownerRows);
    setLeads(leadRows);
    setQueue(queueRows);
  };

  useEffect(() => {
    let stopped = false;
    let pollId: number | null = null;

    const run = async () => {
      try {
        await loadCrmData();
        if (stopped) return;
        pollId = window.setInterval(() => {
          void loadCrmData().catch((error) => {
            console.warn("CRM refresh failed", error);
            setSyncMode("OFFLINE");
          });
        }, 4000);
      } catch (error) {
        console.warn("CRM load failed", error);
        if (!stopped) setSyncMode("OFFLINE");
      }
    };

    void run();
    return () => {
      stopped = true;
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, [leadScope, selectedStore]);

  useEffect(() => {
    if (!scopeOptions.includes(leadScope)) {
      setLeadScope("my");
    }
  }, [leadScope, scopeOptions]);

  useEffect(() => {
    setWorkspaceDraft((current) => {
      if (current.queueId || current.leadId || current.accountId) return current;
      if (current.store === selectedStore) return current;
      return { ...current, store: selectedStore };
    });
  }, [selectedStore]);

  useEffect(() => {
    if (selectedQueueId && queue.some((item) => item.id === selectedQueueId)) return;
    const working = queue.find((item) => item.status === "working") || queue[0] || null;
    setSelectedQueueId(working?.id || null);
  }, [queue, selectedQueueId]);

  const ownerOptions = useMemo(() => {
    const map = new Map<string, CRMOwnerOption>();
    owners.forEach((owner) => map.set(owner.name.toLowerCase(), owner));
    if (authUser.name) {
      map.set(authUser.name.toLowerCase(), {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        roles: authUser.roles,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [owners, authUser]);

  const myQueueItem = useMemo(() => queue.find((item) => item.repUserId === authUser.id) || null, [queue, authUser.id]);
  const selectedQueueItem = useMemo(
    () => queue.find((item) => item.id === selectedQueueId) || myQueueItem || null,
    [queue, selectedQueueId, myQueueItem]
  );
  const activeQueueItems = useMemo(() => queue.filter((item) => item.status === "working"), [queue]);
  const waitingQueueItems = useMemo(() => queue.filter((item) => item.status === "waiting"), [queue]);
  const openLeads = useMemo(
    () => leads.filter((lead) => !["Won", "Lost"].includes(lead.stage)).slice(0, 10),
    [leads]
  );

  const setDraftField = <K extends keyof WorkspaceDraft>(key: K, value: WorkspaceDraft[K]) => {
    setWorkspaceDraft((current) => ({ ...current, [key]: value }));
  };

  const hydrateDraftFromQueue = (item: CRMUpsQueueItem) => {
    const owner = ownerOptions.find((entry) => entry.id === item.repUserId || entry.name === item.rep);
    setWorkspaceDraft((current) => ({
      ...current,
      queueId: item.id,
      store: item.store || current.store,
      owner: owner?.name || item.rep || current.owner,
      ownerUserId: owner?.id || item.repUserId || current.ownerUserId,
      name: item.currentCustomer || current.name,
      visualDescription: item.currentCustomerDetails || current.visualDescription,
      notes:
        item.currentCustomerDetails && !current.notes.includes(item.currentCustomerDetails)
          ? `${item.currentCustomerDetails}${current.notes ? `\n\n${current.notes}` : ""}`
          : current.notes,
      source: current.source || "Showroom Walk-In",
      nextAction: current.nextAction || "Help on showroom floor",
    }));
    setSelectedQueueId(item.id);
  };

  const hydrateDraftFromLead = (lead: CRMLead) => {
    setWorkspaceDraft({
      leadId: lead.id,
      queueId: null,
      accountId: null,
      name: lead.name,
      phone: lead.phone,
      email: "",
      store: lead.store || selectedStore,
      owner: lead.owner || authUser.name || "Unassigned",
      ownerUserId: lead.ownerUserId || null,
      channel: lead.channel,
      source: lead.source,
      interest: lead.interest,
      budget: lead.budget,
      stage: lead.stage,
      nextAction: lead.nextAction,
      dueDate: lead.dueDate || todayIso(),
      notes: lead.notes,
      visualDescription: "",
    });
  };

  const hydrateDraftFromAccount = (customer: CRMCustomerAccount) => {
    setWorkspaceDraft((current) => ({
      ...current,
      accountId: customer.id,
      name: customer.name,
      phone: customer.phone || current.phone,
      email: customer.email || current.email,
      store: customer.store || current.store,
      notes: customer.notes || current.notes,
    }));
  };

  const hydrateDraftFromOrder = (order: CRMCustomerOrder) => {
    setWorkspaceDraft((current) => ({
      ...current,
      name: order.customerName || current.name,
      phone: order.phone || current.phone,
      store: order.location || current.store,
      notes: [current.notes, order.receiptNo ? `Order ${order.receiptNo}` : "", order.saleStatus ? `Status: ${order.saleStatus}` : ""]
        .filter(Boolean)
        .join("\n")
        .trim(),
    }));
  };

  useEffect(() => {
    if (!selectedQueueItem) return;
    if (selectedQueueItem.status !== "working") return;
    hydrateDraftFromQueue(selectedQueueItem);
  }, [selectedQueueItem?.id]);

  const handleJoinQueue = async () => {
    setQueueJoinBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const row = await joinCrmUpsQueueInApi(selectedStore);
      setQueue((current) => {
        const next = current.filter((item) => item.id !== row.id);
        return [...next, row].sort((a, b) => a.queuePosition - b.queuePosition);
      });
      setSelectedQueueId(row.id);
      setStatusMessage(`Checked into ${selectedStore} UPS rotation.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to join UPS queue.");
    } finally {
      setQueueJoinBusy(false);
    }
  };

  const handleLeaveQueue = async (item: CRMUpsQueueItem) => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await leaveCrmUpsQueueInApi(item.id);
      setQueue((current) => current.filter((entry) => entry.id !== item.id));
      if (selectedQueueId === item.id) {
        setSelectedQueueId(null);
      }
      setStatusMessage(`${item.rep} left the ${item.store} UPS rotation.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to leave UPS queue.");
    }
  };

  const handleStartCustomer = async (item: CRMUpsQueueItem) => {
    const draft = startDrafts[item.id] || { customer: "", customerType: "Regular Up" as UpsQueueCustomerType, details: "" };
    if (!draft.customer.trim()) {
      setErrorMessage("Add a quick customer label before starting the up.");
      return;
    }
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const row = await startCrmUpsQueueCustomerInApi(item.id, {
        customer: draft.customer.trim(),
        customerType: draft.customerType,
        details: draft.details.trim(),
      });
      setQueue((current) => current.map((entry) => (entry.id === row.id ? row : entry)));
      hydrateDraftFromQueue(row);
      setStatusMessage(`Started customer for ${item.rep}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start customer.");
    }
  };

  const handleCompleteCustomer = async (item: CRMUpsQueueItem) => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const rows = await completeCrmUpsQueueCustomerInApi(item.id);
      setQueue(rows);
      setWorkspaceDraft((current) => ({
        ...buildEmptyDraft(authUser, selectedStore),
        notes: current.notes,
      }));
      setStatusMessage(`Completed customer for ${item.rep}. Queue rotated.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete customer.");
    }
  };

  const handleSyncActiveBoard = async () => {
    if (!workspaceDraft.queueId) {
      setErrorMessage("Select an active UPS customer first.");
      return;
    }
    if (!workspaceDraft.name.trim()) {
      setErrorMessage("Add a customer label or name before syncing to the UPS board.");
      return;
    }
    setSaveBusy("sync");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const row = await updateCrmUpsQueueCustomerInApi(workspaceDraft.queueId, {
        customer: workspaceDraft.name.trim(),
        details: workspaceDraft.visualDescription.trim(),
      });
      setQueue((current) => current.map((entry) => (entry.id === row.id ? row : entry)));
      setStatusMessage("Active UPS card updated with the latest customer description.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sync active UPS card.");
    } finally {
      setSaveBusy(null);
    }
  };

  const handleSaveLead = async () => {
    if (!workspaceDraft.name.trim()) {
      setErrorMessage("Customer name or quick label is required.");
      return;
    }
    if (!workspaceDraft.phone.trim()) {
      setErrorMessage("Phone number is required to save the customer as a lead.");
      return;
    }

    const payload: CRMLead = {
      id: workspaceDraft.leadId || `lead-${Date.now()}`,
      name: workspaceDraft.name.trim(),
      phone: workspaceDraft.phone.trim(),
      channel: workspaceDraft.channel,
      source: workspaceDraft.source.trim() || "Showroom Walk-In",
      interest: workspaceDraft.interest.trim(),
      budget: workspaceDraft.budget.trim() || "Unspecified",
      store: workspaceDraft.store.trim() || selectedStore,
      owner: workspaceDraft.owner.trim() || authUser.name || "Unassigned",
      ownerUserId: workspaceDraft.ownerUserId || null,
      stage: workspaceDraft.stage,
      nextAction: workspaceDraft.nextAction.trim() || "Follow up with customer",
      dueDate: workspaceDraft.dueDate || todayIso(),
      lastMessage: workspaceDraft.visualDescription.trim() || "Showroom customer",
      lastTouch: new Date().toISOString(),
      notes: [workspaceDraft.visualDescription.trim(), workspaceDraft.notes.trim()].filter(Boolean).join("\n\n"),
    };

    setSaveBusy("lead");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      if (workspaceDraft.leadId) {
        await updateCrmLeadInApi(workspaceDraft.leadId, payload);
        setLeads((current) => current.map((lead) => (lead.id === payload.id ? payload : lead)));
        setStatusMessage("Lead updated.");
      } else {
        await createCrmLeadInApi(payload);
        setLeads((current) => [payload, ...current]);
        setWorkspaceDraft((current) => ({ ...current, leadId: payload.id }));
        setStatusMessage("Lead created from the showroom workflow.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save lead.");
    } finally {
      setSaveBusy(null);
    }
  };

  const handleSaveAccount = async () => {
    if (!workspaceDraft.name.trim()) {
      setErrorMessage("Customer name or quick label is required.");
      return;
    }
    if (!workspaceDraft.phone.trim() && !workspaceDraft.email.trim()) {
      setErrorMessage("Add a phone number or email before saving the account.");
      return;
    }

    setSaveBusy("account");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const result = await upsertCrmCustomerAccount({
        name: workspaceDraft.name.trim(),
        phone: workspaceDraft.phone.trim(),
        email: workspaceDraft.email.trim(),
        store: workspaceDraft.store.trim() || selectedStore,
        notes: [workspaceDraft.visualDescription.trim(), workspaceDraft.notes.trim()].filter(Boolean).join("\n\n"),
      });
      setWorkspaceDraft((current) => ({
        ...current,
        accountId: result.customer.id,
        store: result.customer.store || current.store,
      }));
      setStatusMessage("Customer account saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save customer account.");
    } finally {
      setSaveBusy(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchTouched(true);
      setSearchResults(emptySearch);
      return;
    }
    setSearchBusy(true);
    setSearchTouched(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const results = await searchCrmRecords(searchQuery.trim());
      setSearchResults(results);
      if (!results.customers.length && !results.leads.length && !results.orders.length) {
        setStatusMessage("No matching customers found yet. You can still create one from the workspace.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearchBusy(false);
    }
  };

  const totalResults =
    searchResults.customers.length + searchResults.leads.length + searchResults.orders.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_20%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#111827_100%)] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-950/92 p-6 shadow-[0_35px_120px_rgba(2,6,23,0.65)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className={`${mutedLabelClass} text-cyan-300`}>CRM Rebuild</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Showroom flow first, everything else second.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                This screen is rebuilt around what the floor team actually does: check into a store, take the next up,
                identify the customer visually, search fast, and turn the interaction into a lead or customer account
                without bouncing across different sections.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3">
                <p className={mutedLabelClass}>Sync</p>
                <p className="mt-2 text-lg font-semibold text-white">{syncMode === "POS_DB" ? "Live" : "Offline"}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {syncMode === "POS_DB" ? "Connected to shared POS DB." : "Backend unavailable right now."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3">
                <p className={mutedLabelClass}>Store</p>
                <p className="mt-2 text-lg font-semibold text-white">{selectedStore}</p>
                <p className="mt-1 text-xs text-slate-400">Queue and customer workspace stay tied to this location.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3">
                <p className={mutedLabelClass}>Open Leads</p>
                <p className="mt-2 text-lg font-semibold text-white">{openLeads.length}</p>
                <p className="mt-1 text-xs text-slate-400">Quick follow-up list for the current scope.</p>
              </div>
            </div>
          </div>
        </section>

        {statusMessage ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.15fr_1.05fr]">
          <div className="flex flex-col gap-5">
            <div className={cardClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className={mutedLabelClass}>UPS Command Board</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Live showroom rotation</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Pick the location, check yourself in, start the customer, and add a visual description so anyone on
                    the floor can identify them fast.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className={mutedLabelClass}>Showroom</span>
                    <select
                      value={selectedStore}
                      onChange={(event) => setSelectedStore(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-slate-800/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                    >
                      {LOCATION_OPTIONS.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className={mutedLabelClass}>Lead Scope</span>
                    <select
                      value={leadScope}
                      onChange={(event) => setLeadScope(event.target.value as "team" | "my")}
                      className="rounded-2xl border border-white/10 bg-slate-800/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                    >
                      {scopeOptions.map((scope) => (
                        <option key={scope} value={scope}>
                          {scope === "team" ? "Team view" : "My view"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={mutedLabelClass}>My Position</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {myQueueItem ? `#${myQueueItem.queuePosition} in ${selectedStore}` : "Not checked in"}
                      </p>
                    </div>
                    {!myQueueItem ? (
                      <button
                        onClick={handleJoinQueue}
                        disabled={queueJoinBusy || syncMode !== "POS_DB"}
                        className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {queueJoinBusy ? "Joining..." : "Check Me In"}
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleLeaveQueue(myQueueItem)}
                        className="rounded-2xl border border-white/10 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:border-rose-300/40 hover:bg-rose-500/10"
                      >
                        Leave Queue
                      </button>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {queue.length ? (
                      queue.map((item) => {
                        const startDraft = startDrafts[item.id] || {
                          customer: "",
                          customerType: "Regular Up" as UpsQueueCustomerType,
                          details: "",
                        };
                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border p-4 transition ${
                              selectedQueueItem?.id === item.id
                                ? "border-cyan-400/50 bg-cyan-400/10"
                                : "border-white/10 bg-slate-900/80 hover:border-white/20"
                            }`}
                          >
                            <button
                              onClick={() => {
                                setSelectedQueueId(item.id);
                                if (item.status === "working") hydrateDraftFromQueue(item);
                              }}
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm text-slate-400">Position #{item.queuePosition}</p>
                                  <p className="mt-1 text-lg font-semibold text-white">{item.rep}</p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Checked in {formatWhen(item.checkedInAt)}
                                  </p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${queueStatusClass(item)}`}>
                                  {item.status === "working" ? "With customer" : "Waiting"}
                                </span>
                              </div>
                            </button>

                            {item.status === "working" ? (
                              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                                <p className={mutedLabelClass}>Active Customer</p>
                                <p className="mt-2 text-base font-semibold text-white">{item.currentCustomer || "No label yet"}</p>
                                <p className="mt-2 text-sm text-slate-300">
                                  {item.currentCustomerDetails || "No visual description yet."}
                                </p>
                                <div className="mt-3 flex gap-2">
                                  <span className="rounded-full border border-white/10 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                                    {item.currentCustomerType || "Regular Up"}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                                    Started {formatWhen(item.startedAt)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                                <label className="block">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    Customer Label
                                  </span>
                                  <input
                                    value={startDraft.customer}
                                    onChange={(event) =>
                                      setStartDrafts((current) => ({
                                        ...current,
                                        [item.id]: { ...startDraft, customer: event.target.value },
                                      }))
                                    }
                                    placeholder="Blue hoodie couple, Ashley Jones, repeat guest..."
                                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    Visual Description
                                  </span>
                                  <textarea
                                    value={startDraft.details}
                                    onChange={(event) =>
                                      setStartDrafts((current) => ({
                                        ...current,
                                        [item.id]: { ...startDraft, details: event.target.value },
                                      }))
                                    }
                                    rows={3}
                                    placeholder="Couple with stroller, looking at power sectionals, near front right wall..."
                                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                                  />
                                </label>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                  <select
                                    value={startDraft.customerType}
                                    onChange={(event) =>
                                      setStartDrafts((current) => ({
                                        ...current,
                                        [item.id]: {
                                          ...startDraft,
                                          customerType: event.target.value as UpsQueueCustomerType,
                                        },
                                      }))
                                    }
                                    className="rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                                  >
                                    {CUSTOMER_TYPE_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => void handleStartCustomer(item)}
                                    className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                                  >
                                    Start Customer
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-400">
                        Nobody is checked into {selectedStore} yet. Use <span className="font-semibold text-white">Check Me In</span> to
                        start the floor rotation.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                      <p className={mutedLabelClass}>Waiting</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{waitingQueueItems.length}</p>
                      <p className="mt-1 text-xs text-slate-400">Reps ready for the next greeting.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                      <p className={mutedLabelClass}>With Customer</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{activeQueueItems.length}</p>
                      <p className="mt-1 text-xs text-slate-400">Active showroom interactions.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                      <p className={mutedLabelClass}>Lead Scope</p>
                      <p className="mt-2 text-3xl font-semibold capitalize text-white">{leadScope}</p>
                      <p className="mt-1 text-xs text-slate-400">Controls which leads show below.</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                    <p className={mutedLabelClass}>Current Floor Snapshot</p>
                    <div className="mt-3 space-y-3">
                      {queue.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.rep}</p>
                            <p className="text-xs text-slate-400">
                              {item.status === "working"
                                ? `${item.currentCustomer || "Active customer"} · ${item.currentCustomerDetails || "Description pending"}`
                                : `Waiting in line at spot #${item.queuePosition}`}
                            </p>
                          </div>
                          {item.status === "working" ? (
                            <button
                              onClick={() => void handleCompleteCustomer(item)}
                              className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                            >
                              Complete
                            </button>
                          ) : item.repUserId === authUser.id ? (
                            <button
                              onClick={() => void handleLeaveQueue(item)}
                              className="rounded-2xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition hover:border-rose-300/40 hover:bg-rose-500/10"
                            >
                              Leave
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-cyan-200">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className={mutedLabelClass}>Universal Search</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Find by name, phone, notes, comments, or order info</h2>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSearch();
                    }
                  }}
                  placeholder="Search anything: name, phone, notes, comment text, receipt, salesperson..."
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                />
                <button
                  onClick={() => void handleSearch()}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  {searchBusy ? "Searching..." : "Search"}
                </button>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className={mutedLabelClass}>Customers</p>
                  <div className="mt-3 space-y-3">
                    {searchResults.customers.length ? (
                      searchResults.customers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => hydrateDraftFromAccount(customer)}
                          className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                        >
                          <p className="font-semibold text-white">{customer.name}</p>
                          <p className="mt-1 text-xs text-slate-400">{customer.phone || customer.email || "No contact saved"}</p>
                          <p className="mt-2 line-clamp-2 text-xs text-slate-300">{customer.notes || "No notes yet."}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        {searchTouched ? "No customer accounts matched this search yet." : "Run a search to surface saved customers."}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className={mutedLabelClass}>Leads</p>
                  <div className="mt-3 space-y-3">
                    {searchResults.leads.length ? (
                      searchResults.leads.map((lead) => (
                        <button
                          key={lead.id}
                          onClick={() => hydrateDraftFromLead(lead)}
                          className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-white">{lead.name}</p>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stageBadgeClass(lead.stage)}`}>
                              {lead.stage}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{lead.phone || "No phone"} · {lead.store || "No store"}</p>
                          <p className="mt-2 line-clamp-2 text-xs text-slate-300">{lead.notes || lead.nextAction || "No notes yet."}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        {searchTouched ? "No leads matched this search." : "Search across lead notes, customer names, and details."}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className={mutedLabelClass}>Orders</p>
                  <div className="mt-3 space-y-3">
                    {searchResults.orders.length ? (
                      searchResults.orders.map((order) => (
                        <button
                          key={`${order.saleId}-${order.receiptNo}`}
                          onClick={() => hydrateDraftFromOrder(order)}
                          className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                        >
                          <p className="font-semibold text-white">{order.customerName || "Unnamed customer"}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {order.phone || "No phone"} · {order.location || "No store"}
                          </p>
                          <p className="mt-2 text-xs text-slate-300">
                            {order.receiptNo ? `Receipt ${order.receiptNo}` : `Sale ${order.saleId}`} · {order.saleStatus || "Status unknown"}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        {searchTouched ? "No order history matched." : "Orders help reps identify returning customers fast."}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-400">
                {searchTouched ? `${totalResults} total search matches for "${searchQuery.trim()}".` : "Search results will appear here."}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={mutedLabelClass}>Customer Workspace</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">From greeting to account creation</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Keep the active customer in one place. Save the lead, save the account, and keep the UPS board in sync.
                  </p>
                </div>
                {workspaceDraft.queueId ? (
                  <button
                    onClick={() => void handleSyncActiveBoard()}
                    disabled={saveBusy === "sync"}
                    className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50"
                  >
                    {saveBusy === "sync" ? "Syncing..." : "Sync Active Card"}
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Customer Name / Label</span>
                  <input
                    value={workspaceDraft.name}
                    onChange={(event) => setDraftField("name", event.target.value)}
                    placeholder="Ashley Jones, blue jacket couple, mattress return guest..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Visual Description</span>
                  <input
                    value={workspaceDraft.visualDescription}
                    onChange={(event) => setDraftField("visualDescription", event.target.value)}
                    placeholder="Near recliners, older couple, red purse, asking about power options..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Phone</span>
                  <input
                    value={workspaceDraft.phone}
                    onChange={(event) => setDraftField("phone", event.target.value)}
                    placeholder="(555) 555-5555"
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Email</span>
                  <input
                    value={workspaceDraft.email}
                    onChange={(event) => setDraftField("email", event.target.value)}
                    placeholder="customer@email.com"
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Store</span>
                  <select
                    value={workspaceDraft.store}
                    onChange={(event) => setDraftField("store", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  >
                    {LOCATION_OPTIONS.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Assigned Rep</span>
                  <select
                    value={workspaceDraft.owner}
                    onChange={(event) => {
                      const owner = ownerOptions.find((entry) => entry.name === event.target.value);
                      setWorkspaceDraft((current) => ({
                        ...current,
                        owner: event.target.value,
                        ownerUserId: owner?.id || null,
                      }));
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  >
                    {ownerOptions.map((owner) => (
                      <option key={owner.id || owner.name} value={owner.name}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Channel</span>
                  <select
                    value={workspaceDraft.channel}
                    onChange={(event) => setDraftField("channel", event.target.value as CRMLeadChannel)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  >
                    {CHANNEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Lead Stage</span>
                  <select
                    value={workspaceDraft.stage}
                    onChange={(event) => setDraftField("stage", event.target.value as CRMLeadStage)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  >
                    {STAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Source</span>
                  <input
                    value={workspaceDraft.source}
                    onChange={(event) => setDraftField("source", event.target.value)}
                    placeholder="Showroom Walk-In"
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Interest</span>
                  <input
                    value={workspaceDraft.interest}
                    onChange={(event) => setDraftField("interest", event.target.value)}
                    placeholder="Power reclining sofa, mattress, sectional..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Budget</span>
                  <input
                    value={workspaceDraft.budget}
                    onChange={(event) => setDraftField("budget", event.target.value)}
                    placeholder="$1,500 - $2,500"
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Next Action</span>
                  <input
                    value={workspaceDraft.nextAction}
                    onChange={(event) => setDraftField("nextAction", event.target.value)}
                    placeholder="Quote package, call back tomorrow, verify dimensions..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
                <label className="block">
                  <span className={`${mutedLabelClass} mb-2 block`}>Due Date</span>
                  <input
                    type="date"
                    value={workspaceDraft.dueDate}
                    onChange={(event) => setDraftField("dueDate", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className={`${mutedLabelClass} mb-2 block`}>Notes / Comments</span>
                <textarea
                  value={workspaceDraft.notes}
                  onChange={(event) => setDraftField("notes", event.target.value)}
                  rows={6}
                  placeholder="Anything the next salesperson needs to know: fabric likes, objections, be-back timing, delivery needs, family details..."
                  className="w-full rounded-3xl border border-white/10 bg-slate-800/95 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
                />
              </label>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => void handleSaveLead()}
                  disabled={saveBusy !== null}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                >
                  {saveBusy === "lead" ? "Saving Lead..." : workspaceDraft.leadId ? "Update Lead" : "Save As Lead"}
                </button>
                <button
                  onClick={() => void handleSaveAccount()}
                  disabled={saveBusy !== null}
                  className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                >
                  {saveBusy === "account" ? "Saving Account..." : "Create / Update Account"}
                </button>
                <button
                  onClick={() => setWorkspaceDraft(buildEmptyDraft(authUser, selectedStore))}
                  className="rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-slate-700"
                >
                  Clear Workspace
                </button>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-amber-100">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className={mutedLabelClass}>Sales Workflow Notes</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Best flow for the showroom team</h2>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center gap-3 text-white">
                    <Store className="h-4 w-4 text-cyan-300" />
                    <p className="font-semibold">1. Check into today’s location</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Reps float between stores, so the first action should always be choosing the store and checking into that
                    location’s UPS rotation.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center gap-3 text-white">
                    <Users className="h-4 w-4 text-cyan-300" />
                    <p className="font-semibold">2. Start the customer with a visual description</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    That gives the whole floor enough context even before you know the customer’s name or contact info.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center gap-3 text-white">
                    <Search className="h-4 w-4 text-cyan-300" />
                    <p className="font-semibold">3. Search once, not by field</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    One universal search is easier than forcing the team to decide whether to search by phone, note, order, or
                    account first.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center gap-3 text-white">
                    <UserPlus className="h-4 w-4 text-cyan-300" />
                    <p className="font-semibold">4. Convert in place</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    The same workspace should save the lead and the customer account so the rep never has to retype the same
                    information twice.
                  </p>
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-3 text-white">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className={mutedLabelClass}>Open Leads</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Quick list for follow-up and reassignment</h2>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {openLeads.length ? (
                  openLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => hydrateDraftFromLead(lead)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{lead.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {lead.phone} · {lead.store} · {lead.owner || "Unassigned"}
                          </p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${stageBadgeClass(lead.stage)}`}>
                          {lead.stage}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 bg-slate-800 px-3 py-1">{lead.interest || "No product noted"}</span>
                        <span className="rounded-full border border-white/10 bg-slate-800 px-3 py-1">{lead.nextAction || "No next action"}</span>
                        <span className="rounded-full border border-white/10 bg-slate-800 px-3 py-1">Due {lead.dueDate || "today"}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-5 text-sm text-slate-400">
                    No open leads in this scope right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CRMWorkspace;
