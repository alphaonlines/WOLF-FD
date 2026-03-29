import React, { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import type {
  AuthUser,
  CRMCustomerAccount,
  CRMCustomerOrder,
  CRMLead,
  CRMLeadChannel,
  CRMLeadStage,
  CRMOwnerOption,
  CRMSalespersonOption,
  CRMSearchResult,
  CRMUpsQueueItem,
  UpsQueueCustomerType,
} from "../types";
import { checkPosBackendHealthy } from "../services/posBackendApi";
import {
  completeCrmUpsQueueCustomerInApi,
  fetchCrmLeadsFromApi,
  fetchCrmOwnersFromApi,
  fetchCrmSalespeopleFromApi,
  fetchCrmUpsQueueFromApi,
  joinCrmUpsQueueInApi,
  leaveCrmUpsQueueInApi,
  removeCrmUpsQueueCustomerInApi,
  reorderCrmUpsQueueInApi,
  searchCrmRecords,
  startCrmUpsQueueCustomerInApi,
  updateCrmUpsQueueCustomerInApi,
  updateCrmUpsQueueStatusInApi,
  upsertCrmCustomerAccount,
} from "../services/crmApi";
import { APP_VERSION } from "../constants";

type CRMWorkspaceProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
};

type SyncMode = "POS_DB" | "OFFLINE";

type CustomerDraft = {
  leadId: string | null;
  accountId: string | null;
  queueId: string | null;
  activeCustomerId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  store: string;
  owner: string;
  ownerUserId: string | null;
  channel: CRMLeadChannel;
  source: string;
  interest: string;
  stage: CRMLeadStage;
  nextAction: string;
  dueDate: string;
  notes: string;
  visualDescription: string;
};

const LOCATION_OPTIONS = ["Camp", "Base", "G1", "FD7", "FD5"];
const STORE_FILTER_OPTIONS = ["ALL", ...LOCATION_OPTIONS];
const CHANNEL_OPTIONS: CRMLeadChannel[] = ["Phone", "SMS", "Webchat", "Facebook", "Instagram"];
const STAGE_OPTIONS: CRMLeadStage[] = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"];

const emptySearch: CRMSearchResult = { customers: [], leads: [], orders: [] };
const todayIso = () => new Date().toISOString().slice(0, 10);

const buildDraft = (authUser: AuthUser, store: string): CustomerDraft => ({
  leadId: null,
  accountId: null,
  queueId: null,
  activeCustomerId: null,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  store,
  owner: authUser.name || "Unassigned",
  ownerUserId: authUser.id || null,
  channel: "Phone",
  source: "Showroom Walk-In",
  interest: "",
  stage: "New",
  nextAction: "Follow up",
  dueDate: todayIso(),
  notes: "",
  visualDescription: "",
});

const formatTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatWeatherSnapshot = (item: CRMUpsQueueItem) => {
  const parts = [
    item.currentWeatherLocation || item.store,
    item.currentWeatherSummary,
    item.currentWeatherTempF === null || item.currentWeatherTempF === undefined ? null : `${Math.round(item.currentWeatherTempF)}F`,
    item.currentWeatherPrecipPct === null || item.currentWeatherPrecipPct === undefined ? null : `${item.currentWeatherPrecipPct}% precip`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
};

const formatLiveWeather = (item: CRMUpsQueueItem) => {
  const parts = [
    item.liveWeatherLocation || item.store,
    item.liveWeatherTempF === null || item.liveWeatherTempF === undefined ? null : `${Math.round(item.liveWeatherTempF)}F`,
    item.liveWeatherSummary,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : item.store;
};

const splitName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

const combineName = (firstName: string, lastName: string) =>
  `${firstName.trim()} ${lastName.trim()}`.trim();

const CRMWorkspace: React.FC<CRMWorkspaceProps> = ({ authUser, isDarkMode }) => {
  const isManager = authUser.roles.includes("Owner") || authUser.roles.includes("Manager");
  const [leadScope, setLeadScope] = useState<"team" | "my">(isManager ? "team" : "my");
  const [syncMode, setSyncMode] = useState<SyncMode>("OFFLINE");
  const [selectedStore, setSelectedStore] = useState("FD7");
  const [owners, setOwners] = useState<CRMOwnerOption[]>([]);
  const [salespeople, setSalespeople] = useState<CRMSalespersonOption[]>([]);
  const [queue, setQueue] = useState<CRMUpsQueueItem[]>([]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CRMSearchResult>(emptySearch);
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "customer" | "queue">(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [selectedSalespersonName, setSelectedSalespersonName] = useState("");
  const [startDrafts, setStartDrafts] = useState<Record<string, { customer: string; customerType: UpsQueueCustomerType }>>({});
  const [draft, setDraft] = useState<CustomerDraft>(() => buildDraft(authUser, "FD7"));

  const panelClassName = isDarkMode
    ? "rounded-3xl border border-slate-800 bg-slate-950 shadow-[0_14px_30px_rgba(2,6,23,0.16)]"
    : "rounded-3xl border border-slate-200/80 bg-slate-50/90 shadow-sm";
  const subtleInputClassName = isDarkMode
    ? "rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
    : "rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-200/60";
  const ghostButtonClassName = isDarkMode
    ? "rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:opacity-50"
    : "rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50";
  const successButtonClassName = isDarkMode
    ? "rounded-xl border border-emerald-400/35 bg-emerald-400/14 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-50"
    : "rounded-xl border border-emerald-500 bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:opacity-50";
  const dangerButtonClassName = isDarkMode
    ? "rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/18 disabled:opacity-50"
    : "rounded-xl border border-red-500 bg-red-100 px-3 py-2 text-sm font-semibold text-red-950 transition hover:bg-red-200 disabled:opacity-50";
  const warningButtonClassName = isDarkMode
    ? "rounded-xl border border-amber-400/30 bg-amber-400/12 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:opacity-50"
    : "rounded-xl border border-amber-500 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:opacity-50";
  const waitingBadgeClassName = isDarkMode
    ? "bg-slate-700/60 text-slate-200"
    : "border border-slate-300 bg-slate-200 text-slate-800";
  const workingBadgeClassName = isDarkMode
    ? "bg-emerald-500/16 text-emerald-200"
    : "border border-emerald-300 bg-emerald-100 text-emerald-950";
  const breakBadgeClassName = isDarkMode
    ? "bg-amber-500/16 text-amber-200"
    : "border border-amber-300 bg-amber-100 text-amber-950";
  const nextOpportunityBadgeClassName = isDarkMode
    ? "rounded-full bg-sky-400/14 px-2 py-0.5 text-[11px] font-medium text-sky-200"
    : "rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900";
  const weatherSnapshotTextClassName = isDarkMode
    ? "mt-1 truncate text-xs text-emerald-300/90"
    : "mt-1 truncate text-xs font-medium text-emerald-800";
  const liveWeatherTextClassName = isDarkMode
    ? "mt-0.5 max-w-[210px] truncate text-[11px] text-emerald-300"
    : "mt-0.5 max-w-[210px] truncate text-[11px] font-medium text-emerald-800";
  const weatherCalloutClassName = isDarkMode
    ? "rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-100"
    : "rounded-xl border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-950";

  const loadData = async () => {
    const healthy = await checkPosBackendHealthy();
    if (!healthy) {
      setSyncMode("OFFLINE");
      return;
    }
    const [ownerRows, salespersonRows, queueRows, leadRows] = await Promise.all([
      fetchCrmOwnersFromApi(),
      fetchCrmSalespeopleFromApi(),
      fetchCrmUpsQueueFromApi(selectedStore === "ALL" ? undefined : selectedStore),
      fetchCrmLeadsFromApi(leadScope),
    ]);
    setOwners(ownerRows);
    setSalespeople(salespersonRows);
    setQueue(queueRows);
    setLeads(leadRows);
    setSyncMode("POS_DB");
  };

  useEffect(() => {
    let stopped = false;
    let pollId: number | null = null;
    const run = async () => {
      try {
        await loadData();
        if (stopped) return;
        pollId = window.setInterval(() => {
          void loadData().catch(() => setSyncMode("OFFLINE"));
        }, 4000);
      } catch {
        if (!stopped) setSyncMode("OFFLINE");
      }
    };
    void run();
    return () => {
      stopped = true;
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, [selectedStore, leadScope]);

  const myQueueItem = useMemo(() => queue.find((item) => item.repUserId === authUser.id) || null, [queue, authUser.id]);
  const isViewingAllStores = selectedStore === "ALL";
  const activeCount = queue.reduce((total, item) => total + item.activeCustomerCount, 0);
  const waitingCount = queue.filter((item) => item.status === "waiting").length;
  const breakCount = queue.filter((item) => item.status === "on_break").length;
  const selectedQueueItem = queue.find((item) => item.id === selectedQueueId) || myQueueItem || queue[0] || null;
  const defaultDraftStore = !isViewingAllStores ? selectedStore : selectedQueueItem?.store || myQueueItem?.store || "FD7";
  const nextOpportunityId = queue.find((item) => item.status === "waiting")?.id || null;
  const ownerOptions = useMemo(() => {
    const rows = owners.length
      ? owners
      : [{ id: authUser.id, name: authUser.name, email: authUser.email, roles: authUser.roles }];
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [owners, authUser]);
  const availableSalespeople = useMemo(() => {
    const queued = new Set(queue.map((item) => item.rep.trim().toLowerCase()).filter(Boolean));
    return [...salespeople]
      .filter((item) => !queued.has(item.name.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [queue, salespeople]);
  const selectedSalesperson = useMemo(
    () => availableSalespeople.find((item) => item.name === selectedSalespersonName) || null,
    [availableSalespeople, selectedSalespersonName]
  );

  useEffect(() => {
    if (!selectedQueueItem || selectedQueueItem.status !== "working") return;
    const activeCustomer =
      (draft.queueId === selectedQueueItem.id && draft.activeCustomerId
        ? selectedQueueItem.activeCustomers.find((entry) => entry.id === draft.activeCustomerId) || null
        : null) || selectedQueueItem.activeCustomers[0];
    if (!activeCustomer) return;
    if (draft.queueId === selectedQueueItem.id && draft.activeCustomerId === activeCustomer.id) {
      return;
    }
    setDraft((current) => ({
      ...current,
      queueId: selectedQueueItem.id,
      activeCustomerId: activeCustomer.id,
      store: selectedQueueItem.store || current.store,
      owner: selectedQueueItem.rep || current.owner,
      ownerUserId: selectedQueueItem.repUserId || current.ownerUserId,
      ...splitName(activeCustomer.customer || combineName(current.firstName, current.lastName)),
      visualDescription: activeCustomer.customerDetails || current.visualDescription,
      notes: current.notes || activeCustomer.customerDetails || "",
    }));
  }, [selectedQueueItem]);

  const updateDraft = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const applyLead = (lead: CRMLead) => {
    setDraft({
      leadId: lead.id,
      accountId: null,
      queueId: null,
      ...splitName(lead.name),
      phone: lead.phone,
      email: "",
      store: lead.store || defaultDraftStore,
      owner: lead.owner || authUser.name || "Unassigned",
      ownerUserId: lead.ownerUserId || null,
      channel: lead.channel,
      source: lead.source,
      interest: lead.interest,
      stage: lead.stage,
      nextAction: lead.nextAction,
      dueDate: lead.dueDate || todayIso(),
      notes: lead.notes,
      visualDescription: "",
    });
  };

  const applyCustomer = (customer: CRMCustomerAccount) => {
    setDraft((current) => ({
      ...current,
      accountId: customer.id,
      ...splitName(customer.name),
      phone: customer.phone || current.phone,
      email: customer.email || current.email,
      store: customer.store || current.store,
      notes: customer.notes || current.notes,
    }));
  };

  const applyOrder = (order: CRMCustomerOrder) => {
    setDraft((current) => ({
      ...current,
      ...splitName(order.customerName || combineName(current.firstName, current.lastName)),
      phone: order.phone || current.phone,
      store: order.location || current.store,
    }));
  };

  const handleAddToQueue = async () => {
    if (isViewingAllStores) {
      setErrorMessage("Choose a store before adding someone to the queue.");
      return;
    }
    setJoinBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const row = selectedSalesperson
        ? await joinCrmUpsQueueInApi(selectedStore, {
            rep: selectedSalesperson.name,
            repUserId: selectedSalesperson.userId,
          })
        : await joinCrmUpsQueueInApi(selectedStore);
      setQueue((current) => [...current.filter((item) => item.id !== row.id), row].sort((a, b) => a.queuePosition - b.queuePosition));
      setSelectedQueueId(row.id);
      setSelectedSalespersonName("");
      setStatusMessage(selectedSalesperson ? `${selectedSalesperson.name} added to ${selectedStore}.` : `Checked into ${selectedStore}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add to queue.");
    } finally {
      setJoinBusy(false);
    }
  };

  const handleLeaveQueue = async (item: CRMUpsQueueItem) => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await leaveCrmUpsQueueInApi(item.id);
      setQueue((current) => current.filter((entry) => entry.id !== item.id));
      if (selectedQueueId === item.id) setSelectedQueueId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to leave queue.");
    }
  };

  const handleStartCustomer = async (item: CRMUpsQueueItem) => {
    const startDraft = startDrafts[item.id];
    if (!startDraft?.customer?.trim()) {
      setErrorMessage("Add a customer label first.");
      return;
    }
    setSaving("queue");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const row = await startCrmUpsQueueCustomerInApi(item.id, {
        customer: startDraft.customer.trim(),
        customerType: startDraft.customerType,
        details: startDraft.customer.trim(),
      });
      const latestActiveCustomer = row.activeCustomers[0] || null;
      setQueue((current) =>
        current
          .map((entry) => (entry.id === row.id ? row : entry))
          .sort((a, b) => a.queuePosition - b.queuePosition)
      );
      setDraft((current) => ({
        ...current,
        queueId: row.id,
        activeCustomerId: latestActiveCustomer?.id || null,
        ...splitName(latestActiveCustomer?.customer || combineName(current.firstName, current.lastName)),
        visualDescription: latestActiveCustomer?.customerDetails || current.visualDescription,
        store: row.store || current.store,
        owner: row.rep || current.owner,
        ownerUserId: row.repUserId || current.ownerUserId,
      }));
      setSelectedQueueId(row.id);
      setStartDrafts((current) => ({
        ...current,
        [item.id]: { customer: "", customerType: "Regular Up" },
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start customer.");
    } finally {
      setSaving(null);
    }
  };

  const handleCompleteCustomer = async (item: CRMUpsQueueItem, activeCustomerId: string) => {
    const activeCustomer = item.activeCustomers.find((entry) => entry.id === activeCustomerId) || null;
    setStatusMessage(null);
    setErrorMessage(null);
    setSaving("queue");
    try {
      if (draft.queueId === item.id && draft.activeCustomerId === activeCustomerId) {
        const customerName = combineName(draft.firstName, draft.lastName);
        const payload: { customer?: string; details?: string } = {};
        if (customerName) payload.customer = customerName;
        if (draft.visualDescription.trim() !== (activeCustomer?.customerDetails || "")) {
          payload.details = draft.visualDescription.trim();
        }
        if (payload.customer !== undefined || payload.details !== undefined) {
          await updateCrmUpsQueueCustomerInApi(item.id, activeCustomerId, payload);
        }
      }
      const rows = await completeCrmUpsQueueCustomerInApi(item.id, activeCustomerId);
      setQueue([...rows].sort((a, b) => a.queuePosition - b.queuePosition));
      setDraft(buildDraft(authUser, defaultDraftStore));
      setStartDrafts((current) => ({
        ...current,
        [item.id]: { customer: "", customerType: "Regular Up" },
      }));
      setStatusMessage("Up completed and saved to history.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete customer.");
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveCustomerFromUps = async (item: CRMUpsQueueItem, activeCustomerId: string) => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const rows = await removeCrmUpsQueueCustomerInApi(item.id, activeCustomerId);
      setQueue([...rows].sort((a, b) => a.queuePosition - b.queuePosition));
      setDraft(buildDraft(authUser, defaultDraftStore));
      setStartDrafts((current) => ({
        ...current,
        [item.id]: { customer: "", customerType: "Regular Up" },
      }));
      setStatusMessage("Active up removed. Door traffic was kept for future reporting.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove active up.");
    }
  };

  const handleUpdateQueueStatus = async (item: CRMUpsQueueItem, status: "waiting" | "on_break") => {
    setSaving("queue");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const rows = await updateCrmUpsQueueStatusInApi(item.id, status);
      setQueue([...rows].sort((a, b) => a.queuePosition - b.queuePosition));
      setStatusMessage(status === "on_break" ? `${item.rep} marked on break.` : `${item.rep} returned to the queue.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update queue status.");
    } finally {
      setSaving(null);
    }
  };

  const handleReorderQueue = async (item: CRMUpsQueueItem, direction: "up" | "down") => {
    setSaving("queue");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const rows = await reorderCrmUpsQueueInApi(item.id, direction);
      setQueue([...rows].sort((a, b) => a.queuePosition - b.queuePosition));
      setStatusMessage(`${item.rep} moved ${direction}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to move salesperson in queue.");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveCustomer = async () => {
    const fullName = combineName(draft.firstName, draft.lastName);
    if (!fullName || (!draft.phone.trim() && !draft.email.trim())) {
      setErrorMessage("Add a customer name and at least a phone number or email.");
      return;
    }
    setSaving("customer");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const noteBody = [draft.visualDescription.trim(), draft.notes.trim()].filter(Boolean).join("\n\n");
      const result = await upsertCrmCustomerAccount({
        name: fullName,
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        store: draft.store,
        notes: noteBody,
      });

      if (draft.queueId && draft.activeCustomerId) {
        const row = await updateCrmUpsQueueCustomerInApi(draft.queueId, draft.activeCustomerId, {
          customer: fullName,
          customerType: undefined,
          details: draft.visualDescription.trim(),
        });
        setQueue((current) =>
          current
            .map((entry) => (entry.id === row.id ? row : entry))
            .sort((a, b) => a.queuePosition - b.queuePosition)
        );
      }

      setDraft((current) => ({
        ...current,
        accountId: result.customer.id,
      }));
      setStatusMessage("Customer saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save customer.");
    } finally {
      setSaving(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(emptySearch);
      return;
    }
    setSearching(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      setSearchResults(await searchCrmRecords(searchQuery.trim()));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Alpha Pulse CRM</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Opportunity queue and customer follow-up workspace.</div>
          </div>
          <div className="rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/76 dark:text-slate-300">
            v{APP_VERSION}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className={panelClassName}>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700/70 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100/90 p-2 text-slate-600 dark:bg-slate-900/78 dark:text-slate-100">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900 dark:text-white">Opportunity Queue</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Top of the list gets the next customer opportunity.</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedStore}
                  onChange={(event) => setSelectedStore(event.target.value)}
                  className={subtleInputClassName}
                >
                  {STORE_FILTER_OPTIONS.map((location) => (
                    <option key={location} value={location}>
                      {location === "ALL" ? "All Stores" : location}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSalespersonName}
                  onChange={(event) => setSelectedSalespersonName(event.target.value)}
                  className={`min-w-[220px] ${subtleInputClassName}`}
                >
                  <option value="">Add myself to queue</option>
                  {availableSalespeople.map((person) => (
                    <option key={`${person.name}-${person.userId || "manual"}`} value={person.name}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void handleAddToQueue()}
                  disabled={joinBusy || syncMode !== "POS_DB" || isViewingAllStores || (!selectedSalesperson && !!myQueueItem)}
                  className={ghostButtonClassName}
                >
                  {isViewingAllStores
                    ? "Select Store"
                    : joinBusy
                      ? "Adding..."
                      : !selectedSalesperson && myQueueItem
                        ? "Already In Queue"
                      : selectedSalesperson
                        ? "Add To Queue"
                        : "Check In"}
                </button>
                {selectedSalesperson ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">{selectedSalesperson.totalTickets.toLocaleString()} tickets</div>
                ) : myQueueItem ? (
                  <button
                    onClick={() => void handleLeaveQueue(myQueueItem)}
                    className={ghostButtonClassName}
                  >
                    Leave Queue
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-700/70 md:grid-cols-4">
              <div className="px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Waiting</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{waitingCount}</div>
              </div>
              <div className="border-l border-slate-100 px-4 py-3 dark:border-slate-700/70 md:border-x">
                <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Active Customers</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{activeCount}</div>
              </div>
              <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700/70 md:border-r md:border-t-0">
                <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">On Break</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{breakCount}</div>
              </div>
              <div className="border-l border-t border-slate-100 px-4 py-3 dark:border-slate-700/70 md:border-l-0 md:border-t-0">
                <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Sync</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{syncMode === "POS_DB" ? "Live" : "Offline"}</div>
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
              {queue.length ? (
                queue.map((item) => {
                  const isSelected = selectedQueueItem?.id === item.id;
                  const startDraft = startDrafts[item.id] || { customer: "", customerType: "Regular Up" as UpsQueueCustomerType };
                  const canManageRow = isManager || item.repUserId === authUser.id;
                  const isNextOpportunity = item.id === nextOpportunityId;
                  const sameStatusItems = queue.filter((entry) => entry.status === item.status);
                  const sameStatusIndex = sameStatusItems.findIndex((entry) => entry.id === item.id);
                  const canMoveUp = isManager && item.status !== "working" && sameStatusIndex > 0;
                  const canMoveDown = isManager && item.status !== "working" && sameStatusIndex >= 0 && sameStatusIndex < sameStatusItems.length - 1;
                  const weatherSnapshot = formatWeatherSnapshot(item);
                  const liveWeather = formatLiveWeather(item);
                  return (
                    <div key={item.id} className={`${isSelected ? (isDarkMode ? "bg-slate-900/80" : "bg-sky-50/80") : isDarkMode ? "hover:bg-slate-900/60" : ""}`}>
                      <button
                        onClick={() => setSelectedQueueId(item.id)}
                        className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="text-center">
                          <div className="text-xs text-slate-400 dark:text-slate-500">#</div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-white">{item.queuePosition}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-slate-900 dark:text-white">{item.rep}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              item.status === "working"
                                ? workingBadgeClassName
                                : item.status === "on_break"
                                  ? breakBadgeClassName
                                  : waitingBadgeClassName
                            }`}>
                              {item.status === "working" ? "With Customer" : item.status === "on_break" ? "On Break" : "Waiting"}
                            </span>
                            {isNextOpportunity ? (
                              <span className={nextOpportunityBadgeClassName}>
                                Next Opportunity
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-400">
                            {item.status === "working"
                              ? item.activeCustomerCount > 1
                                ? `${item.activeCustomerCount} active customers · latest ${item.currentCustomer || "Unnamed customer"}${item.currentCustomerDetails ? ` · ${item.currentCustomerDetails}` : ""}`
                                : `${item.currentCustomer || "Unnamed customer"}${item.currentCustomerDetails ? ` · ${item.currentCustomerDetails}` : ""}`
                              : item.status === "on_break"
                                ? "Unavailable and skipped until returned to queue."
                              : `Checked in ${formatTime(item.checkedInAt) || ""}`}
                          </div>
                          {item.status === "working" && weatherSnapshot ? (
                            <div className={weatherSnapshotTextClassName}>{weatherSnapshot}</div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                            {item.store}
                          </div>
                          <div className={liveWeatherTextClassName}>
                            {liveWeather}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                            Helped today: {item.helpedTodayCount}
                          </div>
                          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {item.status === "working" ? formatTime(item.startedAt) : ""}
                          </div>
                        </div>
                      </button>

                      {isSelected ? (
                        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700/70">
                          {item.status === "waiting" ? (
                            <div className="space-y-2">
                              {isManager ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => void handleReorderQueue(item, "up")}
                                    disabled={!canMoveUp || saving === "queue"}
                                    className={ghostButtonClassName}
                                  >
                                    Move Up
                                  </button>
                                  <button
                                    onClick={() => void handleReorderQueue(item, "down")}
                                    disabled={!canMoveDown || saving === "queue"}
                                    className={ghostButtonClassName}
                                  >
                                    Move Down
                                  </button>
                                </div>
                              ) : null}
                              <div className="grid gap-2 md:grid-cols-[1.8fr_150px_auto]">
                                <input
                                  value={startDraft.customer}
                                  onChange={(event) =>
                                    setStartDrafts((current) => ({
                                      ...current,
                                      [item.id]: { ...startDraft, customer: event.target.value },
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleStartCustomer(item);
                                    }
                                  }}
                                  placeholder="Customer / opportunity notes"
                                  className={subtleInputClassName}
                                />
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
                                  className={subtleInputClassName}
                                >
                                  <option value="Regular Up">New Opportunity</option>
                                  <option value="B-Back">B-Back</option>
                                </select>
                                <button
                                  onClick={() => void handleStartCustomer(item)}
                                  disabled={saving === "queue"}
                                  className={successButtonClassName}
                                >
                                  Start
                                </button>
                              </div>
                            </div>
                          ) : item.status === "on_break" ? (
                            <div className="space-y-2">
                              {isManager ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => void handleReorderQueue(item, "up")}
                                    disabled={!canMoveUp || saving === "queue"}
                                    className={ghostButtonClassName}
                                  >
                                    Move Up
                                  </button>
                                  <button
                                    onClick={() => void handleReorderQueue(item, "down")}
                                    disabled={!canMoveDown || saving === "queue"}
                                    className={ghostButtonClassName}
                                  >
                                    Move Down
                                  </button>
                                </div>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => void handleUpdateQueueStatus(item, "waiting")}
                                  disabled={!canManageRow || saving === "queue"}
                                  className={successButtonClassName}
                                >
                                  Return To Queue
                                </button>
                                <button
                                  onClick={() => void handleLeaveQueue(item)}
                                  disabled={!canManageRow || saving === "queue"}
                                  className={dangerButtonClassName}
                                >
                                  Remove From Queue
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {weatherSnapshot ? (
                                <div className={weatherCalloutClassName}>
                                  Weather snapshot: {weatherSnapshot}
                                </div>
                              ) : null}
                              <div className="grid gap-2 md:grid-cols-[1.8fr_150px_auto]">
                                <input
                                  value={startDraft.customer}
                                  onChange={(event) =>
                                    setStartDrafts((current) => ({
                                      ...current,
                                      [item.id]: { ...startDraft, customer: event.target.value },
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleStartCustomer(item);
                                    }
                                  }}
                                  placeholder="Add another customer / opportunity notes"
                                  className={subtleInputClassName}
                                />
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
                                  className={subtleInputClassName}
                                >
                                  <option value="Regular Up">New Opportunity</option>
                                  <option value="B-Back">B-Back</option>
                                </select>
                                <button
                                  onClick={() => void handleStartCustomer(item)}
                                  disabled={saving === "queue"}
                                  className={successButtonClassName}
                                >
                                  Add Customer
                                </button>
                              </div>
                              <div className="space-y-2">
                                {item.activeCustomers.map((activeCustomer, index) => (
                                  <div
                                    key={activeCustomer.id}
                                    onClick={() => {
                                      setDraft((current) => ({
                                        ...current,
                                        queueId: item.id,
                                        activeCustomerId: activeCustomer.id,
                                        ...splitName(activeCustomer.customer || combineName(current.firstName, current.lastName)),
                                        visualDescription: activeCustomer.customerDetails || current.visualDescription,
                                        owner: item.rep || current.owner,
                                        ownerUserId: item.repUserId || current.ownerUserId,
                                        store: item.store || current.store,
                                      }));
                                    }}
                                    className={`rounded-2xl border px-3 py-3 ${
                                      isDarkMode
                                        ? "border-slate-800 bg-slate-950/70"
                                        : "border-slate-200 bg-white/90"
                                    } cursor-pointer transition ${
                                      draft.activeCustomerId === activeCustomer.id
                                        ? isDarkMode
                                          ? "ring-1 ring-sky-400/60"
                                          : "ring-1 ring-sky-300"
                                        : ""
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {activeCustomer.customer || "Unnamed customer"}
                                          </div>
                                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                            activeCustomer.customerType === "B-Back"
                                              ? breakBadgeClassName
                                              : workingBadgeClassName
                                          }`}>
                                            {activeCustomer.customerType === "B-Back" ? "B-Back" : "New Opportunity"}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                          {activeCustomer.customerDetails || "No extra notes yet."}
                                        </div>
                                      </div>
                                      <div className="text-right text-[11px] text-slate-400 dark:text-slate-500">
                                        <div>Customer {index + 1}</div>
                                        <div>{formatTime(activeCustomer.startedAt)}</div>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleCompleteCustomer(item, activeCustomer.id);
                                        }}
                                        disabled={!canManageRow || saving === "queue"}
                                        className={successButtonClassName}
                                      >
                                        Complete
                                      </button>
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleRemoveCustomerFromUps(item, activeCustomer.id);
                                        }}
                                        disabled={!canManageRow || saving === "queue"}
                                        className={warningButtonClassName}
                                      >
                                        Remove Up
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.status === "waiting" ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                onClick={() => void handleUpdateQueueStatus(item, "on_break")}
                                disabled={!canManageRow || saving === "queue"}
                                className={successButtonClassName}
                              >
                                On Break
                              </button>
                              <button
                                onClick={() => void handleLeaveQueue(item)}
                                disabled={!canManageRow || saving === "queue"}
                                className={dangerButtonClassName}
                              >
                                Remove From Queue
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No one is checked into this showroom yet.</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className={`${panelClassName} p-4`}>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Search</div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSearch();
                    }
                  }}
                  placeholder="Name, phone, notes, order..."
                  className={`min-w-0 flex-1 ${subtleInputClassName}`}
                />
                <button onClick={() => void handleSearch()} className={ghostButtonClassName}>
                  {searching ? "..." : "Go"}
                </button>
              </div>
              {(searchResults.customers.length || searchResults.leads.length || searchResults.orders.length) ? (
                <div className="mt-3 space-y-2">
                  {searchResults.customers.slice(0, 3).map((customer) => (
                    <button key={customer.id} onClick={() => applyCustomer(customer)} className={`block w-full rounded-2xl border px-3 py-2 text-left transition ${
                      isDarkMode
                        ? "border-slate-800 bg-slate-900 text-slate-100 hover:border-slate-700 hover:bg-slate-800"
                        : "border-slate-100 bg-slate-50 hover:border-sky-200 hover:bg-white"
                    }`}>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{customer.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{customer.phone || customer.email || "Saved customer"}</div>
                    </button>
                  ))}
                  {searchResults.leads.slice(0, 3).map((lead) => (
                    <button key={lead.id} onClick={() => applyLead(lead)} className={`block w-full rounded-2xl border px-3 py-2 text-left transition ${
                      isDarkMode
                        ? "border-slate-800 bg-slate-900 text-slate-100 hover:border-slate-700 hover:bg-slate-800"
                        : "border-slate-100 bg-slate-50 hover:border-sky-200 hover:bg-white"
                    }`}>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{lead.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{lead.phone} · {lead.stage}</div>
                    </button>
                  ))}
                  {searchResults.orders.slice(0, 2).map((order, index) => (
                    <button key={`${order.saleId}-${index}`} onClick={() => applyOrder(order)} className={`block w-full rounded-2xl border px-3 py-2 text-left transition ${
                      isDarkMode
                        ? "border-slate-800 bg-slate-900 text-slate-100 hover:border-slate-700 hover:bg-slate-800"
                        : "border-slate-100 bg-slate-50 hover:border-sky-200 hover:bg-white"
                    }`}>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{order.customerName || "Order match"}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{order.phone || order.receiptNo || order.saleId}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={`${panelClassName} p-4`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Customer Panel</div>
              </div>

              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={draft.firstName} onChange={(event) => updateDraft("firstName", event.target.value)} placeholder="First name" className={subtleInputClassName} />
                  <input value={draft.lastName} onChange={(event) => updateDraft("lastName", event.target.value)} placeholder="Last name" className={subtleInputClassName} />
                </div>
                <input value={draft.visualDescription} onChange={(event) => updateDraft("visualDescription", event.target.value)} placeholder="Visual description" className={subtleInputClassName} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="Phone" className={subtleInputClassName} />
                  <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="Email" className={subtleInputClassName} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={draft.store} onChange={(event) => updateDraft("store", event.target.value)} className={subtleInputClassName}>
                    {LOCATION_OPTIONS.map((location) => <option key={location} value={location}>{location}</option>)}
                  </select>
                  <select
                    value={draft.owner}
                    onChange={(event) => {
                      const owner = ownerOptions.find((entry) => entry.name === event.target.value);
                      setDraft((current) => ({ ...current, owner: event.target.value, ownerUserId: owner?.id || null }));
                    }}
                    className={subtleInputClassName}
                  >
                    {ownerOptions.map((owner) => <option key={owner.id || owner.name} value={owner.name}>{owner.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={draft.channel} onChange={(event) => updateDraft("channel", event.target.value as CRMLeadChannel)} className={subtleInputClassName}>
                    {CHANNEL_OPTIONS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                  </select>
                  <select value={draft.stage} onChange={(event) => updateDraft("stage", event.target.value as CRMLeadStage)} className={subtleInputClassName}>
                    {STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                  <input type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} className={subtleInputClassName} />
                </div>
                <input value={draft.source} onChange={(event) => updateDraft("source", event.target.value)} placeholder="Source" className={subtleInputClassName} />
                <input value={draft.interest} onChange={(event) => updateDraft("interest", event.target.value)} placeholder="Interest" className={subtleInputClassName} />
                <input value={draft.nextAction} onChange={(event) => updateDraft("nextAction", event.target.value)} placeholder="Next action" className={subtleInputClassName} />
                <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={4} placeholder="Notes" className={subtleInputClassName} />
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={() => void handleSaveCustomer()} disabled={saving !== null} className={successButtonClassName}>
                  {saving === "customer" ? "Saving..." : "Save Customer"}
                </button>
                <button onClick={() => setDraft(buildDraft(authUser, defaultDraftStore))} className={ghostButtonClassName}>
                  Clear
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMWorkspace;
