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
  CRMSearchResult,
  CRMUpsQueueItem,
  UpsQueueCustomerType,
} from "../types";
import { checkPosBackendHealthy } from "../services/posBackendApi";
import {
  completeCrmUpsQueueCustomerInApi,
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
} from "../services/crmApi";

type CRMWorkspaceProps = {
  authUser: AuthUser;
};

type SyncMode = "POS_DB" | "OFFLINE";

type CustomerDraft = {
  leadId: string | null;
  accountId: string | null;
  queueId: string | null;
  name: string;
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
const CHANNEL_OPTIONS: CRMLeadChannel[] = ["Phone", "SMS", "Webchat", "Facebook", "Instagram"];
const STAGE_OPTIONS: CRMLeadStage[] = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"];

const emptySearch: CRMSearchResult = { customers: [], leads: [], orders: [] };
const todayIso = () => new Date().toISOString().slice(0, 10);

const buildDraft = (authUser: AuthUser, store: string): CustomerDraft => ({
  leadId: null,
  accountId: null,
  queueId: null,
  name: "",
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

const CRMWorkspace: React.FC<CRMWorkspaceProps> = ({ authUser }) => {
  const isManager = authUser.roles.includes("Owner") || authUser.roles.includes("Manager");
  const [leadScope, setLeadScope] = useState<"team" | "my">(isManager ? "team" : "my");
  const [syncMode, setSyncMode] = useState<SyncMode>("OFFLINE");
  const [selectedStore, setSelectedStore] = useState("FD7");
  const [owners, setOwners] = useState<CRMOwnerOption[]>([]);
  const [queue, setQueue] = useState<CRMUpsQueueItem[]>([]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CRMSearchResult>(emptySearch);
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "lead" | "account" | "queue">(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [startDrafts, setStartDrafts] = useState<Record<string, { customer: string; details: string; customerType: UpsQueueCustomerType }>>({});
  const [draft, setDraft] = useState<CustomerDraft>(() => buildDraft(authUser, "FD7"));

  const loadData = async () => {
    const healthy = await checkPosBackendHealthy();
    if (!healthy) {
      setSyncMode("OFFLINE");
      return;
    }
    const [ownerRows, queueRows, leadRows] = await Promise.all([
      fetchCrmOwnersFromApi(),
      fetchCrmUpsQueueFromApi(selectedStore),
      fetchCrmLeadsFromApi(leadScope),
    ]);
    setOwners(ownerRows);
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
  const activeCount = queue.filter((item) => item.status === "working").length;
  const waitingCount = queue.filter((item) => item.status === "waiting").length;
  const selectedQueueItem = queue.find((item) => item.id === selectedQueueId) || myQueueItem || queue[0] || null;
  const ownerOptions = useMemo(() => {
    const rows = owners.length
      ? owners
      : [{ id: authUser.id, name: authUser.name, email: authUser.email, roles: authUser.roles }];
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [owners, authUser]);

  useEffect(() => {
    if (!selectedQueueItem) return;
    if (selectedQueueItem.status !== "working") return;
    setDraft((current) => ({
      ...current,
      queueId: selectedQueueItem.id,
      store: selectedQueueItem.store || current.store,
      owner: selectedQueueItem.rep || current.owner,
      ownerUserId: selectedQueueItem.repUserId || current.ownerUserId,
      name: selectedQueueItem.currentCustomer || current.name,
      visualDescription: selectedQueueItem.currentCustomerDetails || current.visualDescription,
      notes: current.notes || selectedQueueItem.currentCustomerDetails || "",
    }));
  }, [selectedQueueItem?.id]);

  const updateDraft = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const applyLead = (lead: CRMLead) => {
    setDraft({
      leadId: lead.id,
      accountId: null,
      queueId: null,
      name: lead.name,
      phone: lead.phone,
      email: "",
      store: lead.store || selectedStore,
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
      name: customer.name,
      phone: customer.phone || current.phone,
      email: customer.email || current.email,
      store: customer.store || current.store,
      notes: customer.notes || current.notes,
    }));
  };

  const applyOrder = (order: CRMCustomerOrder) => {
    setDraft((current) => ({
      ...current,
      name: order.customerName || current.name,
      phone: order.phone || current.phone,
      store: order.location || current.store,
    }));
  };

  const handleJoinQueue = async () => {
    setJoinBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const row = await joinCrmUpsQueueInApi(selectedStore);
      setQueue((current) => [...current.filter((item) => item.id !== row.id), row].sort((a, b) => a.queuePosition - b.queuePosition));
      setSelectedQueueId(row.id);
      setStatusMessage(`Checked into ${selectedStore}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to join queue.");
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
        details: startDraft.details.trim(),
      });
      setQueue((current) => current.map((entry) => (entry.id === row.id ? row : entry)));
      setDraft((current) => ({
        ...current,
        queueId: row.id,
        name: row.currentCustomer || current.name,
        visualDescription: row.currentCustomerDetails || current.visualDescription,
        store: row.store || current.store,
        owner: row.rep || current.owner,
        ownerUserId: row.repUserId || current.ownerUserId,
      }));
      setSelectedQueueId(row.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start customer.");
    } finally {
      setSaving(null);
    }
  };

  const handleCompleteCustomer = async (item: CRMUpsQueueItem) => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const rows = await completeCrmUpsQueueCustomerInApi(item.id);
      setQueue(rows);
      setDraft(buildDraft(authUser, selectedStore));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete customer.");
    }
  };

  const handleSyncQueueCard = async () => {
    if (!draft.queueId) return;
    setSaving("queue");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const row = await updateCrmUpsQueueCustomerInApi(draft.queueId, {
        customer: draft.name.trim(),
        details: draft.visualDescription.trim(),
      });
      setQueue((current) => current.map((entry) => (entry.id === row.id ? row : entry)));
      setStatusMessage("UPS card updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update UPS card.");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveLead = async () => {
    if (!draft.name.trim() || !draft.phone.trim()) {
      setErrorMessage("Customer name and phone are required for a lead.");
      return;
    }
    const payload: CRMLead = {
      id: draft.leadId || `lead-${Date.now()}`,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      channel: draft.channel,
      source: draft.source.trim() || "Showroom Walk-In",
      interest: draft.interest.trim(),
      budget: "Unspecified",
      store: draft.store,
      owner: draft.owner,
      ownerUserId: draft.ownerUserId,
      stage: draft.stage,
      nextAction: draft.nextAction.trim() || "Follow up",
      dueDate: draft.dueDate || todayIso(),
      lastMessage: draft.visualDescription.trim(),
      lastTouch: new Date().toISOString(),
      notes: [draft.visualDescription.trim(), draft.notes.trim()].filter(Boolean).join("\n\n"),
    };
    setSaving("lead");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      if (draft.leadId) {
        await updateCrmLeadInApi(draft.leadId, payload);
        setLeads((current) => current.map((lead) => (lead.id === payload.id ? payload : lead)));
      } else {
        await createCrmLeadInApi(payload);
        setLeads((current) => [payload, ...current]);
        setDraft((current) => ({ ...current, leadId: payload.id }));
      }
      setStatusMessage("Lead saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save lead.");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAccount = async () => {
    if (!draft.name.trim() || (!draft.phone.trim() && !draft.email.trim())) {
      setErrorMessage("Add a name and either a phone number or email for the account.");
      return;
    }
    setSaving("account");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const result = await upsertCrmCustomerAccount({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        store: draft.store,
        notes: [draft.visualDescription.trim(), draft.notes.trim()].filter(Boolean).join("\n\n"),
      });
      setDraft((current) => ({ ...current, accountId: result.customer.id }));
      setStatusMessage("Account saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save account.");
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
    <div className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-800 p-2 text-slate-200">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">CRM</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedStore}
                onChange={(event) => setSelectedStore(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              >
                {LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              {isManager ? (
                <select
                  value={leadScope}
                  onChange={(event) => setLeadScope(event.target.value as "team" | "my")}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="team">Team</option>
                  <option value="my">My Leads</option>
                </select>
              ) : null}
              {!myQueueItem ? (
                <button
                  onClick={handleJoinQueue}
                  disabled={joinBusy || syncMode !== "POS_DB"}
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {joinBusy ? "Joining..." : "Check In"}
                </button>
              ) : (
                <button
                  onClick={() => void handleLeaveQueue(myQueueItem)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                >
                  Leave Queue
                </button>
              )}
            </div>
          </div>
        </div>

        {statusMessage ? <div className="rounded-xl border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-200">{statusMessage}</div> : null}
        {errorMessage ? <div className="rounded-xl border border-rose-800 bg-rose-950/50 px-4 py-2 text-sm text-rose-200">{errorMessage}</div> : null}

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900">
            <div className="grid grid-cols-3 border-b border-slate-800">
              <div className="px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Waiting</div>
                <div className="mt-1 text-2xl font-semibold text-white">{waitingCount}</div>
              </div>
              <div className="border-x border-slate-800 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">With Customer</div>
                <div className="mt-1 text-2xl font-semibold text-white">{activeCount}</div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Sync</div>
                <div className="mt-1 text-2xl font-semibold text-white">{syncMode === "POS_DB" ? "Live" : "Offline"}</div>
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {queue.length ? (
                queue.map((item) => {
                  const isSelected = selectedQueueItem?.id === item.id;
                  const startDraft = startDrafts[item.id] || { customer: "", details: "", customerType: "Regular Up" as UpsQueueCustomerType };
                  return (
                    <div key={item.id} className={`${isSelected ? "bg-slate-800/40" : ""}`}>
                      <button
                        onClick={() => setSelectedQueueId(item.id)}
                        className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="text-center">
                          <div className="text-xs text-slate-500">#</div>
                          <div className="text-lg font-semibold text-white">{item.queuePosition}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-white">{item.rep}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              item.status === "working" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700 text-slate-300"
                            }`}>
                              {item.status === "working" ? "With Customer" : "Waiting"}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-400">
                            {item.status === "working"
                              ? `${item.currentCustomer || "Unnamed customer"}${item.currentCustomerDetails ? ` · ${item.currentCustomerDetails}` : ""}`
                              : `Checked in ${formatTime(item.checkedInAt) || ""}`}
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {item.status === "working" ? formatTime(item.startedAt) : ""}
                        </div>
                      </button>

                      {isSelected ? (
                        <div className="border-t border-slate-800 px-4 py-3">
                          {item.status === "waiting" ? (
                            <div className="grid gap-2 md:grid-cols-[1.2fr_1.6fr_150px_auto]">
                              <input
                                value={startDraft.customer}
                                onChange={(event) =>
                                  setStartDrafts((current) => ({
                                    ...current,
                                    [item.id]: { ...startDraft, customer: event.target.value },
                                  }))
                                }
                                placeholder="Customer label"
                                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                              />
                              <input
                                value={startDraft.details}
                                onChange={(event) =>
                                  setStartDrafts((current) => ({
                                    ...current,
                                    [item.id]: { ...startDraft, details: event.target.value },
                                  }))
                                }
                                placeholder="Quick visual description"
                                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
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
                                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                              >
                                <option value="Regular Up">Regular Up</option>
                                <option value="B-Back">B-Back</option>
                              </select>
                              <button
                                onClick={() => void handleStartCustomer(item)}
                                disabled={saving === "queue"}
                                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                              >
                                Start
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => void handleCompleteCustomer(item)}
                                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => {
                                  setDraft((current) => ({
                                    ...current,
                                    queueId: item.id,
                                    name: item.currentCustomer || current.name,
                                    visualDescription: item.currentCustomerDetails || current.visualDescription,
                                    owner: item.rep || current.owner,
                                    ownerUserId: item.repUserId || current.ownerUserId,
                                    store: item.store || current.store,
                                  }));
                                }}
                                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                              >
                                Load Into Panel
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-sm text-slate-400">No one is checked into this showroom yet.</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <div className="text-sm font-semibold text-white">Search</div>
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
                <button onClick={() => void handleSearch()} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
                  {searching ? "..." : "Go"}
                </button>
              </div>
              {(searchResults.customers.length || searchResults.leads.length || searchResults.orders.length) ? (
                <div className="mt-3 space-y-2">
                  {searchResults.customers.slice(0, 3).map((customer) => (
                    <button key={customer.id} onClick={() => applyCustomer(customer)} className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-left">
                      <div className="text-sm font-medium text-white">{customer.name}</div>
                      <div className="text-xs text-slate-400">{customer.phone || customer.email || "Saved customer"}</div>
                    </button>
                  ))}
                  {searchResults.leads.slice(0, 3).map((lead) => (
                    <button key={lead.id} onClick={() => applyLead(lead)} className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-left">
                      <div className="text-sm font-medium text-white">{lead.name}</div>
                      <div className="text-xs text-slate-400">{lead.phone} · {lead.stage}</div>
                    </button>
                  ))}
                  {searchResults.orders.slice(0, 2).map((order, index) => (
                    <button key={`${order.saleId}-${index}`} onClick={() => applyOrder(order)} className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-left">
                      <div className="text-sm font-medium text-white">{order.customerName || "Order match"}</div>
                      <div className="text-xs text-slate-400">{order.phone || order.receiptNo || order.saleId}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">Customer Panel</div>
                {draft.queueId ? (
                  <button
                    onClick={() => void handleSyncQueueCard()}
                    disabled={saving === "queue"}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Sync UPS Card
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2">
                <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Customer name or quick label" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={draft.visualDescription} onChange={(event) => updateDraft("visualDescription", event.target.value)} placeholder="Visual description" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="Phone" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                  <input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="Email" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={draft.store} onChange={(event) => updateDraft("store", event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                    {LOCATION_OPTIONS.map((location) => <option key={location} value={location}>{location}</option>)}
                  </select>
                  <select
                    value={draft.owner}
                    onChange={(event) => {
                      const owner = ownerOptions.find((entry) => entry.name === event.target.value);
                      setDraft((current) => ({ ...current, owner: event.target.value, ownerUserId: owner?.id || null }));
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                  >
                    {ownerOptions.map((owner) => <option key={owner.id || owner.name} value={owner.name}>{owner.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={draft.channel} onChange={(event) => updateDraft("channel", event.target.value as CRMLeadChannel)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                    {CHANNEL_OPTIONS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                  </select>
                  <select value={draft.stage} onChange={(event) => updateDraft("stage", event.target.value as CRMLeadStage)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
                    {STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                  <input type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                </div>
                <input value={draft.source} onChange={(event) => updateDraft("source", event.target.value)} placeholder="Source" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={draft.interest} onChange={(event) => updateDraft("interest", event.target.value)} placeholder="Interest" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <input value={draft.nextAction} onChange={(event) => updateDraft("nextAction", event.target.value)} placeholder="Next action" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={4} placeholder="Notes" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={() => void handleSaveLead()} disabled={saving !== null} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                  {draft.leadId ? "Update Lead" : "Save Lead"}
                </button>
                <button onClick={() => void handleSaveAccount()} disabled={saving !== null} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Save Account
                </button>
                <button onClick={() => setDraft(buildDraft(authUser, selectedStore))} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
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
