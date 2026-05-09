import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Printer, Search, Users } from "lucide-react";
import { useBotBotContext } from "./botbot/BotBotContext";
import type {
  AuthUser,
  CRMCustomerAccount,
  CRMCustomerOrder,
  CRMLeadChannel,
  CRMLeadStage,
  CRMOwnerOption,
  CRMSalespersonOption,
  CRMSearchResult,
  CRMUpsHistoryEntry,
  CRMUpsQueueItem,
  UpsQueueCustomerType,
} from "../types";
import { checkPosBackendHealthy, fetchOpenLocationTickets, type OpenLocationTicketRow } from "../services/posBackendApi";
import {
  completeCrmUpsQueueCustomerInApi,
  fetchCrmOwnersFromApi,
  fetchCrmSalespeopleFromApi,
  fetchCrmUpsHistoryFromApi,
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
  findCrmCustomerAccount,
  fetchCustomerVisitsByName,
  type CRMCustomerVisit,
} from "../services/crmApi";
import { APP_VERSION } from "../constants";
import {
  DEFAULT_STORE_CODE,
  STORE_CODES,
  getStoreLabel,
  normalizeStoreCode,
  type StoreCode,
} from "../storeLocations";
import ObjectionsDrawer from "./crm/ObjectionsDrawer";

type CRMWorkspaceProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
  view?: "all" | "queue" | "customers";
  selectedStore?: StoreCode;
  onStoreChange?: (store: string) => void;
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
  city: string;
  wantsNeeds: string;
  didPurchase: boolean | null;
  purchaseAmount: string;
  objectionNote: string;
};

type StartCustomerDraft = {
  customer: string;
  phone: string;
  email: string;
  city: string;
  wantsNeeds: string;
  details: string;
  customerType: UpsQueueCustomerType;
};

const buildStartCustomerDraft = (): StartCustomerDraft => ({
  customer: "",
  phone: "",
  email: "",
  city: "",
  wantsNeeds: "",
  details: "",
  customerType: "Regular Up",
});

const CHANNEL_OPTIONS: CRMLeadChannel[] = ["Phone", "SMS", "Webchat", "Facebook", "Instagram"];
const STAGE_OPTIONS: CRMLeadStage[] = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"];

const emptySearch: CRMSearchResult = { customers: [], leads: [], orders: [] };
const todayIso = () => new Date().toISOString().slice(0, 10);
const CUSTOMER_SEARCH_FIELD_LABELS = {
  firstName: "First name",
  lastName: "Last name",
  visualDescription: "Visual description",
  phone: "Phone",
  email: "Email",
  source: "Source",
  interest: "Interest",
  nextAction: "Next action",
  notes: "Notes",
} as const;

type CustomerSearchField = keyof typeof CUSTOMER_SEARCH_FIELD_LABELS;
const CUSTOMER_SEARCH_FIELDS = Object.keys(CUSTOMER_SEARCH_FIELD_LABELS) as CustomerSearchField[];
type CustomerSearchFieldValues = Partial<Record<CustomerSearchField, string>>;

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
  city: "",
  wantsNeeds: "",
  didPurchase: null,
  purchaseAmount: "",
  objectionNote: "",
});

const formatTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatShortDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
};

const formatWeatherSnapshot = (item: CRMUpsQueueItem) => {
  const parts = [
    item.currentWeatherLocation || getStoreLabel(item.store),
    item.currentWeatherSummary,
    item.currentWeatherTempF === null || item.currentWeatherTempF === undefined ? null : `${Math.round(item.currentWeatherTempF)}F`,
    item.currentWeatherPrecipPct === null || item.currentWeatherPrecipPct === undefined ? null : `${item.currentWeatherPrecipPct}% precip`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
};

const formatLiveWeather = (item: CRMUpsQueueItem) => {
  const parts = [
    item.liveWeatherLocation || getStoreLabel(item.store),
    item.liveWeatherTempF === null || item.liveWeatherTempF === undefined ? null : `${Math.round(item.liveWeatherTempF)}F`,
    item.liveWeatherSummary,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : getStoreLabel(item.store);
};

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
};

const escapePrintHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildWeatherLabel = (entry: CRMUpsHistoryEntry) => {
  const parts = [
    entry.weatherLocation,
    entry.weatherSummary,
    entry.weatherTempF === null ? null : `${Math.round(entry.weatherTempF)}F`,
  ].filter(Boolean);
  return parts.join(" · ");
};

const openUpsPrintWindow = (rows: CRMUpsHistoryEntry[], selectedStore: string, reportDate: string) => {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return;

  const selectedStoreLabel = getStoreLabel(selectedStore);
  const title = `UPS Daily Sheet · ${reportDate}${selectedStore && selectedStore !== "ALL" ? ` · ${selectedStoreLabel}` : ""}`;
  const bodyRows = rows.length
    ? rows
        .map((row) => {
          const wantsNeeds = row.wantsNeeds || "";
          const details = row.customerDetails || "";
          const didPurchase =
            row.didPurchase === null ? "" : row.didPurchase ? "Yes" : "No";
          return `
            <tr>
              <td>${escapePrintHtml(formatShortDate(row.startedAt) || reportDate)}</td>
              <td>${escapePrintHtml(formatTime(row.startedAt) || "")}</td>
              <td>${escapePrintHtml(formatTime(row.completedAt) || "")}</td>
              <td>${escapePrintHtml(buildWeatherLabel(row))}</td>
              <td>${escapePrintHtml(row.customer || "")}</td>
              <td>${escapePrintHtml(row.phone || "")}</td>
              <td>${escapePrintHtml(row.email || "")}</td>
              <td>${escapePrintHtml(row.city || "")}</td>
              <td>${escapePrintHtml(wantsNeeds)}</td>
              <td>${escapePrintHtml(details)}</td>
              <td>${escapePrintHtml(didPurchase)}</td>
              <td>${escapePrintHtml(formatCurrency(row.purchaseAmount))}</td>
              <td>${escapePrintHtml(row.objectionNote || "")}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="13" class="empty">No UPS entries found for this day.</td></tr>`;

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
  <html>
    <head>
      <title>${escapePrintHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
        h1 { margin: 0 0 6px; font-size: 24px; }
        .meta { margin-bottom: 18px; font-size: 12px; color: #475569; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; vertical-align: top; word-break: break-word; }
        th { background: #e2e8f0; text-align: left; }
        .empty { text-align: center; color: #64748b; padding: 18px; }
        @media print {
          body { margin: 12px; }
        }
      </style>
    </head>
    <body>
      <h1>UPS Daily Sheet</h1>
      <div class="meta">Date: ${escapePrintHtml(reportDate)}${selectedStore && selectedStore !== "ALL" ? ` · Store: ${escapePrintHtml(selectedStoreLabel)}` : ""}</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time In</th>
            <th>Time Out</th>
            <th>Weather</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>City</th>
            <th>Wants / Needs</th>
            <th>Details / Notes</th>
            <th>Did They Purchase</th>
            <th>How Much</th>
            <th>Objection Note</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <script>
        window.addEventListener('load', function () {
          setTimeout(function () { window.print(); }, 150);
        });
      </script>
    </body>
  </html>`);
  printWindow.document.close();
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

const buildCustomerSearchFromFieldValues = (
  values: CustomerSearchFieldValues
): { fields: CustomerSearchField[]; query: string } => {
  const fields = CUSTOMER_SEARCH_FIELDS.filter((field) => {
    const value = values[field];
    return typeof value === "string" && value.trim().length > 0;
  });

  return {
    fields,
    query: fields.map((field) => String(values[field] || "").trim()).join(" ").trim(),
  };
};

const normalizePersonNameTokens = (value: string) =>
  value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .sort();

const namesLikelyMatch = (left: string, right: string) => {
  const leftTokens = normalizePersonNameTokens(left);
  const rightTokens = normalizePersonNameTokens(right);
  return leftTokens.length > 0 && leftTokens.join("|") === rightTokens.join("|");
};

const CRMWorkspace: React.FC<CRMWorkspaceProps> = ({ authUser, isDarkMode, view = "all", selectedStore: controlledStore }) => {
  const { setPageContext } = useBotBotContext();
  const isManager = authUser.roles.includes("Owner") || authUser.roles.includes("Manager");
  const [syncMode, setSyncMode] = useState<SyncMode>("OFFLINE");
  const selectedStore = normalizeStoreCode(controlledStore) ?? "ALL";
  const [owners, setOwners] = useState<CRMOwnerOption[]>([]);
  const [salespeople, setSalespeople] = useState<CRMSalespersonOption[]>([]);
  const [queue, setQueue] = useState<CRMUpsQueueItem[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "customer" | "queue">(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [selectedSalespersonName, setSelectedSalespersonName] = useState("");
  const [startDrafts, setStartDrafts] = useState<Record<string, StartCustomerDraft>>({});
  const [draft, setDraft] = useState<CustomerDraft>(() => buildDraft(authUser, DEFAULT_STORE_CODE));
  const [customerSearchFieldValues, setCustomerSearchFieldValues] = useState<CustomerSearchFieldValues>({});
  const [customerSearch, setCustomerSearch] = useState<{ fields: CustomerSearchField[]; query: string }>({
    fields: [],
    query: "",
  });
  const [customerSearchResults, setCustomerSearchResults] = useState<CRMSearchResult>(emptySearch);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [printingUps, setPrintingUps] = useState(false);
  const [openLocationTickets, setOpenLocationTickets] = useState<OpenLocationTicketRow[]>([]);
  const [openLocationTicketLocations, setOpenLocationTicketLocations] = useState<string[]>([]);
  const [openLocationTicketTotalCount, setOpenLocationTicketTotalCount] = useState(0);
  const [loadingOpenLocationTickets, setLoadingOpenLocationTickets] = useState(false);
  const [openLocationTicketsError, setOpenLocationTicketsError] = useState<string | null>(null);
  const [openTicketsExpanded, setOpenTicketsExpanded] = useState(false);
  const [customerProfileVisits, setCustomerProfileVisits] = useState<{ visitCount: number; visits: CRMCustomerVisit[] } | null>(null);
  const [customerProfileOrders, setCustomerProfileOrders] = useState<CRMCustomerOrder[]>([]);
  const [customerLifetimeStats, setCustomerLifetimeStats] = useState<{ purchaseCount: number; lifetimeDollars: number; firstPurchaseDate: string | null; lastPurchaseDate: string | null } | null>(null);
  const [loadingCustomerProfile, setLoadingCustomerProfile] = useState(false);

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
  const startButtonClassName = isDarkMode
    ? "rounded-xl border border-emerald-400/35 bg-emerald-400/14 px-5 py-2.5 text-base font-bold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-50"
    : "rounded-xl border border-emerald-500 bg-emerald-100 px-5 py-2.5 text-base font-bold text-emerald-950 transition hover:bg-emerald-200 disabled:opacity-50";
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
    const [ownerRows, salespersonRows, queueRows] = await Promise.all([
      fetchCrmOwnersFromApi(),
      fetchCrmSalespeopleFromApi(),
      fetchCrmUpsQueueFromApi(selectedStore === "ALL" ? undefined : selectedStore),
    ]);
    setOwners(ownerRows);
    setSalespeople(salespersonRows);
    setQueue(queueRows);
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
  }, [selectedStore]);

  useEffect(() => {
    setPageContext({
      pageName: "CRM",
      module: "crm",
      userRole: "Employee",
      keyMetricsVisible: [],
      suggestedActions: [],
    });
  }, [setPageContext]);

  const myQueueItem = useMemo(
    () =>
      queue.find((item) => item.repUserId === authUser.id || (!item.repUserId && namesLikelyMatch(item.rep, authUser.name))) ||
      null,
    [queue, authUser.id, authUser.name]
  );
  const isViewingAllStores = selectedStore === "ALL";
  const selectedStoreLabel = getStoreLabel(selectedStore);
  const activeCount = queue.reduce((total, item) => total + item.activeCustomerCount, 0);
  const waitingCount = queue.filter((item) => item.status === "waiting").length;
  const breakCount = queue.filter((item) => item.status === "on_break").length;
  const selectedQueueItem = queue.find((item) => item.id === selectedQueueId) || myQueueItem || queue[0] || null;
  const defaultDraftStore = !isViewingAllStores ? selectedStore : selectedQueueItem?.store || myQueueItem?.store || DEFAULT_STORE_CODE;
  const nextOpportunityId = queue.find((item) => item.status === "waiting")?.id || null;

  useEffect(() => {
    if (isViewingAllStores) return;
    setDraft((current) => {
      if (current.queueId || current.accountId || current.store === selectedStore) return current;
      return { ...current, store: selectedStore };
    });
  }, [isViewingAllStores, selectedStore]);

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
      phone: activeCustomer.phone || current.phone,
      email: activeCustomer.email || current.email,
      visualDescription: activeCustomer.customerDetails || current.visualDescription,
      notes: current.notes || activeCustomer.customerDetails || "",
      city: activeCustomer.city || current.city,
      wantsNeeds: activeCustomer.wantsNeeds || current.wantsNeeds,
      didPurchase: activeCustomer.didPurchase ?? current.didPurchase,
      purchaseAmount:
        activeCustomer.purchaseAmount === null || activeCustomer.purchaseAmount === undefined
          ? current.purchaseAmount
          : String(activeCustomer.purchaseAmount),
      objectionNote: activeCustomer.objectionNote || current.objectionNote,
    }));
  }, [selectedQueueItem]);

  const updateDraft = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const resetCustomerLookup = () => {
    setCustomerSearchFieldValues({});
    setCustomerSearch({ fields: [], query: "" });
    setCustomerSearchResults(emptySearch);
    setCustomerSearching(false);
    setCustomerSearchError(null);
  };

  const updateDraftFromInput = <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => {
    setDraft((current) => {
      if (key in CUSTOMER_SEARCH_FIELD_LABELS && typeof value === "string") {
        setCustomerSearchFieldValues((currentSearch) => {
          const nextSearch = { ...currentSearch, [key]: value };
          if (!value.trim()) delete nextSearch[key as CustomerSearchField];
          setCustomerSearch(buildCustomerSearchFromFieldValues(nextSearch));
          return nextSearch;
        });
        setCustomerSearchError(null);
      }
      return { ...current, [key]: value };
    });
  };

  const loadCustomerProfile = (name: string, phone?: string) => {
    setCustomerProfileVisits(null);
    setCustomerProfileOrders([]);
    setCustomerLifetimeStats(null);
    if (!name.trim()) return;
    setLoadingCustomerProfile(true);
    const fetches: Promise<void>[] = [
      fetchCustomerVisitsByName(name)
        .then((data) => setCustomerProfileVisits(data))
        .catch(() => {}),
    ];
    if (phone && phone.trim()) {
      fetches.push(
        findCrmCustomerAccount({ phone })
          .then(({ orders, lifetime }) => {
            setCustomerProfileOrders(orders);
            if (lifetime) {
              setCustomerLifetimeStats(lifetime);
            }
          })
          .catch(() => {})
      );
    }
    Promise.all(fetches).finally(() => setLoadingCustomerProfile(false));
  };

  const loadDraftFromQueueCustomer = (item: CRMUpsQueueItem, activeCustomerId?: string | null) => {
    setSelectedQueueId(item.id);
    if (item.status !== "working") return;

    const preferredActiveCustomer =
      (activeCustomerId ? item.activeCustomers.find((entry) => entry.id === activeCustomerId) || null : null) ||
      (draft.queueId === item.id && draft.activeCustomerId
        ? item.activeCustomers.find((entry) => entry.id === draft.activeCustomerId) || null
        : null) ||
      item.activeCustomers[0] ||
      null;

    if (!preferredActiveCustomer) return;

    const baseDraft = buildDraft(authUser, item.store || defaultDraftStore);
    setDraft({
      ...baseDraft,
      queueId: item.id,
      activeCustomerId: preferredActiveCustomer.id,
      owner: item.rep || baseDraft.owner,
      ownerUserId: item.repUserId || baseDraft.ownerUserId,
      ...splitName(preferredActiveCustomer.customer || ""),
      phone: preferredActiveCustomer.phone || "",
      email: preferredActiveCustomer.email || "",
      visualDescription: preferredActiveCustomer.customerDetails || "",
      city: preferredActiveCustomer.city || "",
      wantsNeeds: preferredActiveCustomer.wantsNeeds || "",
      didPurchase: preferredActiveCustomer.didPurchase ?? null,
      purchaseAmount:
        preferredActiveCustomer.purchaseAmount === null || preferredActiveCustomer.purchaseAmount === undefined
          ? ""
          : String(preferredActiveCustomer.purchaseAmount),
      objectionNote: preferredActiveCustomer.objectionNote || "",
    });
    resetCustomerLookup();
    loadCustomerProfile(preferredActiveCustomer.customer || "", preferredActiveCustomer.phone || undefined);
  };

  useEffect(() => {
    const query = customerSearch.query.trim();
    if (!query) {
      setCustomerSearchResults(emptySearch);
      setCustomerSearching(false);
      setCustomerSearchError(null);
      return;
    }

    let cancelled = false;
    setCustomerSearching(true);
    setCustomerSearchError(null);

    const timer = window.setTimeout(() => {
      void searchCrmRecords(query)
        .then((results) => {
          if (cancelled) return;
          setCustomerSearchResults(results);
        })
        .catch((error) => {
          if (cancelled) return;
          setCustomerSearchError(error instanceof Error ? error.message : "Customer search failed.");
          setCustomerSearchResults(emptySearch);
        })
        .finally(() => {
          if (cancelled) return;
          setCustomerSearching(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerSearch.query]);

  // When phone is added to a queue-loaded customer, fetch their orders
  useEffect(() => {
    const phone = draft.phone?.trim();
    if (!phone || !draft.queueId || syncMode !== "POS_DB") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void findCrmCustomerAccount({ phone })
        .then(({ orders }) => { if (!cancelled) setCustomerProfileOrders(orders); })
        .catch(() => {});
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [draft.phone, draft.queueId, syncMode]);

  // Auto-load customer profile when name is typed (debounced)
  useEffect(() => {
    const name = combineName(draft.firstName, draft.lastName);
    if (name.length < 2) {
      setCustomerProfileVisits(null);
      setCustomerProfileOrders([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      loadCustomerProfile(name, draft.phone?.trim() || undefined);
    }, 600);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [draft.firstName, draft.lastName]);

  useEffect(() => {
    if (syncMode !== "POS_DB") {
      setOpenLocationTickets([]);
      setOpenLocationTicketLocations([]);
      setOpenLocationTicketTotalCount(0);
      setLoadingOpenLocationTickets(false);
      setOpenLocationTicketsError(null);
      return;
    }

    let cancelled = false;
    setLoadingOpenLocationTickets(true);
    setOpenLocationTicketsError(null);

    void fetchOpenLocationTickets({ store: selectedStore, limit: 50 })
      .then((result) => {
        if (cancelled) return;
        setOpenLocationTickets(result.rows);
        setOpenLocationTicketLocations(result.locations);
        setOpenLocationTicketTotalCount(result.totalCount);
      })
      .catch((error) => {
        if (cancelled) return;
        setOpenLocationTickets([]);
        setOpenLocationTicketLocations([]);
        setOpenLocationTicketTotalCount(0);
        setOpenLocationTicketsError(error instanceof Error ? error.message : "Unable to load open tickets.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingOpenLocationTickets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [syncMode, selectedStore]);

  const applyCustomer = (customer: CRMCustomerAccount) => {
    setDraft((current) => ({
      ...current,
      accountId: customer.id,
      leadId: customer.id,
      ...splitName(customer.name),
      phone: customer.phone || current.phone,
      email: customer.email || current.email,
      store: customer.store || current.store,
      owner: customer.owner || current.owner,
      ownerUserId: customer.ownerUserId || current.ownerUserId,
      channel: customer.channel || current.channel,
      source: customer.source || current.source,
      interest: customer.interest || current.interest,
      stage: customer.stage || current.stage,
      nextAction: customer.nextAction || current.nextAction,
      dueDate: customer.dueDate || current.dueDate,
      notes: customer.notes || current.notes,
    }));
    resetCustomerLookup();
    if (customer.name?.trim()) loadCustomerProfile(customer.name.trim(), customer.phone?.trim() || undefined);
  };

  const applyOrder = (order: CRMCustomerOrder) => {
    setDraft((current) => ({
      ...current,
      ...splitName(order.customerName || combineName(current.firstName, current.lastName)),
      phone: order.phone || current.phone,
      store: order.location || current.store,
    }));
    resetCustomerLookup();
    const name = order.customerName?.trim();
    if (name) loadCustomerProfile(name, order.phone?.trim() || undefined);
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
      setStatusMessage(selectedSalesperson ? `${selectedSalesperson.name} added to ${selectedStoreLabel}.` : `Checked into ${selectedStoreLabel}.`);
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
    const startDraft = startDrafts[item.id] || buildStartCustomerDraft();
    if (!startDraft.customer.trim()) {
      setErrorMessage("Add a customer name first.");
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
        phone: startDraft.phone.trim(),
        email: startDraft.email.trim(),
        city: startDraft.city.trim(),
        wantsNeeds: startDraft.wantsNeeds.trim(),
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
        phone: latestActiveCustomer?.phone || current.phone,
        email: latestActiveCustomer?.email || current.email,
        visualDescription: latestActiveCustomer?.customerDetails || current.visualDescription,
        city: latestActiveCustomer?.city || current.city,
        wantsNeeds: latestActiveCustomer?.wantsNeeds || current.wantsNeeds,
        store: row.store || current.store,
        owner: row.rep || current.owner,
        ownerUserId: row.repUserId || current.ownerUserId,
      }));
      setSelectedQueueId(row.id);
      setStartDrafts((current) => ({
        ...current,
        [item.id]: buildStartCustomerDraft(),
      }));
      loadCustomerProfile(startDraft.customer.trim(), startDraft.phone.trim() || undefined);
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
        await updateCrmUpsQueueCustomerInApi(item.id, activeCustomerId, {
          customer: customerName || undefined,
          phone: draft.phone.trim(),
          email: draft.email.trim(),
          details: draft.visualDescription.trim(),
          city: draft.city.trim(),
          wantsNeeds: draft.wantsNeeds.trim(),
          didPurchase: draft.didPurchase ?? undefined,
          purchaseAmount: draft.purchaseAmount.trim() ? Number(draft.purchaseAmount) : null,
          objectionNote: draft.objectionNote.trim(),
        });
      }
      const rows = await completeCrmUpsQueueCustomerInApi(item.id, activeCustomerId);
      setQueue([...rows].sort((a, b) => a.queuePosition - b.queuePosition));
      setDraft(buildDraft(authUser, defaultDraftStore));
      setStartDrafts((current) => ({
        ...current,
        [item.id]: buildStartCustomerDraft(),
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
        [item.id]: buildStartCustomerDraft(),
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
    setSaving("customer");
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const queueDetails = [draft.visualDescription.trim(), draft.notes.trim()].filter(Boolean).join(" · ");
      let upListUpdated = false;
      if (draft.queueId && draft.activeCustomerId) {
        const row = await updateCrmUpsQueueCustomerInApi(draft.queueId, draft.activeCustomerId, {
          customer: fullName || undefined,
          phone: draft.phone.trim(),
          email: draft.email.trim(),
          customerType: undefined,
          details: queueDetails,
          city: draft.city.trim(),
          wantsNeeds: draft.wantsNeeds.trim(),
          didPurchase: draft.didPurchase ?? undefined,
          purchaseAmount: draft.purchaseAmount.trim() ? Number(draft.purchaseAmount) : null,
          objectionNote: draft.objectionNote.trim(),
        });
        setQueue((current) =>
          current
            .map((entry) => (entry.id === row.id ? row : entry))
            .sort((a, b) => a.queuePosition - b.queuePosition)
        );
        upListUpdated = true;
      }

      if (!fullName || (!draft.phone.trim() && !draft.email.trim())) {
        if (upListUpdated) {
          setStatusMessage("Up list updated. Add a phone number or email to save the customer account too.");
          return;
        }
        setErrorMessage("Add a customer name and at least a phone number or email.");
        return;
      }

      const noteBody = [draft.visualDescription.trim(), draft.notes.trim()].filter(Boolean).join("\n\n");
      const result = await upsertCrmCustomerAccount({
        name: fullName,
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        store: draft.store,
        channel: draft.channel,
        source: draft.source.trim(),
        interest: draft.interest.trim(),
        owner: draft.owner,
        ownerUserId: draft.ownerUserId,
        stage: draft.stage,
        nextAction: draft.nextAction.trim(),
        dueDate: draft.dueDate,
        lastMessage: "",
        lastTouch: "",
        notes: noteBody,
      });

      setDraft((current) => ({
        ...current,
        accountId: result.customer.id,
      }));
      setStatusMessage(upListUpdated ? "Customer saved and up list updated." : "Customer saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save customer.");
    } finally {
      setSaving(null);
    }
  };

  const handlePrintUpsDay = async () => {
    setPrintingUps(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const reportDate = todayIso();
      const rows = await fetchCrmUpsHistoryFromApi({
        store: selectedStore,
        date: reportDate,
      });
      openUpsPrintWindow(rows, selectedStore, reportDate);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to print UPS sheet.");
    } finally {
      setPrintingUps(false);
    }
  };

  const customerSearchMatches = useMemo(() => {
    const queryTokens = customerSearch.query
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    const shouldPrioritizeOrders =
      customerSearchResults.orders.length > 0 &&
      (customerSearch.fields.length <= 1 || queryTokens.length <= 1);
    const customerEntries = customerSearchResults.customers.map((customer) => ({
      id: `customer-${customer.id}`,
      type: "Customer" as const,
      title: customer.name || "Saved customer",
      subtitle: [customer.phone || customer.email || "Saved customer", customer.stage || ""].filter(Boolean).join(" · "),
      onSelect: () => applyCustomer(customer),
    }));
    const orderEntries = customerSearchResults.orders.map((order, index) => ({
      id: `order-${order.saleId}-${index}`,
      type: "Order" as const,
      title: order.customerName || "Order match",
      subtitle: [order.phone || order.receiptNo || order.saleId, order.location || ""].filter(Boolean).join(" · "),
      onSelect: () => applyOrder(order),
    }));
    return shouldPrioritizeOrders
      ? [...orderEntries, ...customerEntries].slice(0, 10)
      : [...customerEntries, ...orderEntries].slice(0, 10);
  }, [customerSearch, customerSearchResults]);
  const saleLink = (saleId: string) =>
    `https://www.gimmethebest.net/furnituredistributors/online/sale_rec_502.asp?saleid=${saleId.padStart(5, "0")}&type=1`;
  const itemsLink = (saleId: string) =>
    `https://www.gimmethebest.net/furnituredistributors/finance/deliverieddetail.asp?saleid=${saleId}`;

  const renderStartCustomerForm = (item: CRMUpsQueueItem, customerPlaceholder: string, buttonLabel: string) => {
    const startDraft = startDrafts[item.id] || buildStartCustomerDraft();
    const updateStartDraft = (patch: Partial<StartCustomerDraft>) =>
      setStartDrafts((current) => ({
        ...current,
        [item.id]: { ...startDraft, ...patch },
      }));
    const handleEnter = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleStartCustomer(item);
      }
    };

    return (
      <div className="space-y-2">
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_150px]">
          <input
            value={startDraft.customer}
            onChange={(event) => updateStartDraft({ customer: event.target.value })}
            onKeyDown={handleEnter}
            placeholder={customerPlaceholder}
            className={subtleInputClassName}
          />
          <input
            value={startDraft.phone}
            onChange={(event) => updateStartDraft({ phone: event.target.value })}
            onKeyDown={handleEnter}
            placeholder="Phone"
            className={subtleInputClassName}
          />
          <input
            value={startDraft.email}
            onChange={(event) => updateStartDraft({ email: event.target.value })}
            onKeyDown={handleEnter}
            placeholder="Email"
            className={subtleInputClassName}
          />
          <select
            value={startDraft.customerType}
            onChange={(event) => updateStartDraft({ customerType: event.target.value as UpsQueueCustomerType })}
            className={subtleInputClassName}
          >
            <option value="Regular Up">New Opportunity</option>
            <option value="B-Back">B-Back</option>
          </select>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
          <input
            value={startDraft.city}
            onChange={(event) => updateStartDraft({ city: event.target.value })}
            onKeyDown={handleEnter}
            placeholder="City"
            className={subtleInputClassName}
          />
          <input
            value={startDraft.wantsNeeds}
            onChange={(event) => updateStartDraft({ wantsNeeds: event.target.value })}
            onKeyDown={handleEnter}
            placeholder="Interested in / wants-needs"
            className={subtleInputClassName}
          />
          <button
            onClick={() => void handleStartCustomer(item)}
            disabled={saving === "queue"}
            className={startButtonClassName}
          >
            {buttonLabel}
          </button>
        </div>
        <textarea
          value={startDraft.details}
          onChange={(event) => updateStartDraft({ details: event.target.value })}
          rows={2}
          placeholder="Notes / visual description / outcome details"
          className={subtleInputClassName}
        />
      </div>
    );
  };

  return (
    <div className="px-4 pt-2 sm:px-6">
      <ObjectionsDrawer isDarkMode={isDarkMode} />
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Opportunity Queue</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Customer follow-up and showroom workflow.</div>
          </div>
          <div className="rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/76 dark:text-slate-300">
            v{APP_VERSION}
          </div>
        </div>
        <div className={view === "all" ? "grid gap-4 xl:grid-cols-[1.2fr_0.8fr]" : "grid gap-4"}>
          {statusMessage ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium xl:col-span-2 ${
              isDarkMode
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}>
              {statusMessage}
            </div>
          ) : null}
          {errorMessage ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium xl:col-span-2 ${
              isDarkMode
                ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}>
              {errorMessage}
            </div>
          ) : null}
          {view !== "customers" && <div className={panelClassName}>
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
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <div className={`w-full min-w-0 rounded-xl border px-3 py-2 text-xs font-semibold sm:w-auto ${
                  isDarkMode
                    ? "border-slate-700 bg-slate-900/78 text-slate-200"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}>
                  Location: {selectedStoreLabel}
                </div>
                <select
                  value={selectedSalespersonName}
                  onChange={(event) => setSelectedSalespersonName(event.target.value)}
                  className={`w-full min-w-0 sm:min-w-[220px] ${subtleInputClassName}`}
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
                  className={!selectedSalesperson && !myQueueItem && !isViewingAllStores ? successButtonClassName : ghostButtonClassName}
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
                <button
                  onClick={() => void handlePrintUpsDay()}
                  disabled={printingUps || syncMode !== "POS_DB"}
                  className={ghostButtonClassName}
                >
                  <span className="inline-flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    {printingUps ? "Preparing Print..." : "Print Today's UPS"}
                  </span>
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
                  const canManageRow = true;
                  const isNextOpportunity = item.id === nextOpportunityId;
                  const sameStatusItems = queue.filter((entry) => entry.status === item.status);
                  const sameStatusIndex = sameStatusItems.findIndex((entry) => entry.id === item.id);
                  const canMoveUp = isManager && item.status !== "working" && sameStatusIndex > 0;
                  const canMoveDown = isManager && item.status !== "working" && sameStatusIndex >= 0 && sameStatusIndex < sameStatusItems.length - 1;
                  const weatherSnapshot = formatWeatherSnapshot(item);
                  const liveWeather = formatLiveWeather(item);
                  const primaryActiveCustomer = item.activeCustomers[0] || null;
                  const contactSummary = [primaryActiveCustomer?.phone, primaryActiveCustomer?.email].filter(Boolean).join(" · ");
                  const interestSummary = primaryActiveCustomer?.wantsNeeds || primaryActiveCustomer?.customerDetails || item.currentCustomerDetails || "";
                  return (
                    <div key={item.id} className={`${isSelected ? (isDarkMode ? "bg-slate-900/80" : "bg-sky-50/80") : isDarkMode ? "hover:bg-slate-900/60" : ""}`}>
                      <button
                        onClick={() => loadDraftFromQueueCustomer(item)}
                        className="grid w-full grid-cols-[48px_minmax(0,1fr)] items-start gap-3 px-4 py-3 text-left sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center"
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
                                ? `${item.activeCustomerCount} active customers · latest ${item.currentCustomer || "Unnamed customer"}${interestSummary ? ` · ${interestSummary}` : ""}${contactSummary ? ` · ${contactSummary}` : ""}`
                                : `${item.currentCustomer || "Unnamed customer"}${interestSummary ? ` · ${interestSummary}` : ""}${contactSummary ? ` · ${contactSummary}` : ""}`
                              : item.status === "on_break"
                                ? "Unavailable and skipped until returned to queue."
                              : `Checked in ${formatTime(item.checkedInAt) || ""}`}
                          </div>
                          {item.status === "working" && weatherSnapshot ? (
                            <div className={weatherSnapshotTextClassName}>{weatherSnapshot}</div>
                          ) : null}
                        </div>
                        <div className="col-span-2 pl-[60px] text-left sm:col-span-1 sm:pl-0 sm:text-right">
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                            {getStoreLabel(item.store)}
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
                              {renderStartCustomerForm(item, "Customer name", "Start")}
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
                              {renderStartCustomerForm(item, "Add another customer name", "Add Customer")}
                              <div className="space-y-2">
                                {item.activeCustomers.map((activeCustomer, index) => (
                                  <div
                                    key={activeCustomer.id}
                                    onClick={() => {
                                      loadDraftFromQueueCustomer(item, activeCustomer.id);
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
                                        {[activeCustomer.phone, activeCustomer.email, activeCustomer.city].filter(Boolean).length ? (
                                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            {[activeCustomer.phone, activeCustomer.email, activeCustomer.city].filter(Boolean).join(" · ")}
                                          </div>
                                        ) : null}
                                        {activeCustomer.wantsNeeds ? (
                                          <div className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                            Interested: {activeCustomer.wantsNeeds}
                                          </div>
                                        ) : null}
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
                          {/* Inline customer profile card — shows when this item's active customer is selected */}
                          {isSelected && item.status === "working" && draft.queueId === item.id && (customerProfileVisits !== null || customerProfileOrders.length > 0 || loadingCustomerProfile) ? (
                            <div className={`mt-3 rounded-2xl border px-3 py-3 space-y-2 ${isDarkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white/80"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Customer Profile</div>
                                {loadingCustomerProfile ? (
                                  <div className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Loading...</div>
                                ) : customerProfileVisits ? (
                                  <div className="flex items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${customerProfileVisits.visitCount > 0 ? (isDarkMode ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700") : (isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}`}>
                                      {customerProfileVisits.visitCount} visit{customerProfileVisits.visitCount !== 1 ? "s" : ""}
                                    </span>
                                    {customerProfileVisits.visits[0]?.startedAt ? (
                                      <span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Last: {formatShortDate(customerProfileVisits.visits[0].startedAt)}</span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              {customerProfileVisits && customerProfileVisits.visits.length > 0 ? (
                                <div className="space-y-1">
                                  <div className={`text-[11px] uppercase tracking-[0.14em] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Recent Visits</div>
                                  {customerProfileVisits.visits.slice(0, 3).map((visit) => (
                                    <div key={visit.id} className={`rounded-xl border px-2.5 py-2 text-xs flex items-start justify-between gap-2 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50"}`}>
                                      <div>
                                        <span className={`font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{formatShortDate(visit.startedAt)}</span>
                                        <span className={`ml-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{visit.rep}</span>
                                        {visit.customerType ? <span className={`ml-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>· {visit.customerType}</span> : null}
                                      </div>
                                      {visit.didPurchase ? (
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
                                          {visit.purchaseAmount ? `$${Number(visit.purchaseAmount).toLocaleString()}` : "Purchased"}
                                        </span>
                                      ) : visit.didPurchase === false ? (
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>No sale</span>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : customerProfileVisits && !loadingCustomerProfile ? (
                                <div className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>No visit history found.</div>
                              ) : null}
                              {customerProfileOrders.length > 0 ? (
                                <div className="space-y-1">
                                  <div className={`text-[11px] uppercase tracking-[0.14em] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Purchase Tickets ({customerProfileOrders.length})</div>
                                  {customerProfileOrders.slice(0, 3).map((order, i) => (
                                    <div key={`${order.saleId}-${i}`} className={`rounded-xl border px-2.5 py-2 text-xs flex items-start justify-between gap-2 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50"}`}>
                                      <div>
                                        <span className={`font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{order.customerName || "—"}</span>
                                        <span className={`ml-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{formatShortDate(order.saleDate)}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {order.grandTotal !== null ? <span className={`font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>${Number(order.grandTotal).toLocaleString()}</span> : null}
                                        <a href={saleLink(order.saleId)} target="_blank" rel="noopener noreferrer" className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-white"}`}>#{order.saleId}</a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {/* Quick edit fields */}
                              <div className="pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
                                <div className={`text-[11px] uppercase tracking-[0.14em] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Quick Edit</div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <input value={draft.phone} onChange={(e) => updateDraftFromInput("phone", e.target.value)} placeholder="Phone" className={subtleInputClassName} />
                                  <input value={draft.email} onChange={(e) => updateDraftFromInput("email", e.target.value)} placeholder="Email" className={subtleInputClassName} />
                                  <input value={draft.city} onChange={(e) => updateDraft("city", e.target.value)} placeholder="City" className={subtleInputClassName} />
                                </div>
                                <input value={draft.interest} onChange={(e) => updateDraftFromInput("interest", e.target.value)} placeholder="Interest" className={subtleInputClassName} />
                                <textarea value={draft.wantsNeeds} onChange={(e) => updateDraft("wantsNeeds", e.target.value)} rows={2} placeholder="Wants / Needs" className={subtleInputClassName} />
                                <textarea value={draft.objectionNote} onChange={(e) => updateDraft("objectionNote", e.target.value)} rows={2} placeholder="Objection note" className={subtleInputClassName} />
                                <button onClick={() => void handleSaveCustomer()} disabled={saving !== null} className={successButtonClassName}>
                                  {saving === "customer" ? "Saving..." : "Save Customer"}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {item.status === "waiting" ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                onClick={() => void handleUpdateQueueStatus(item, "on_break")}
                                disabled={!canManageRow || saving === "queue"}
                                className={warningButtonClassName}
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
          </div>}

          {view !== "queue" && <div className="flex flex-col gap-4">
            {/* Open Tickets — collapsible, hidden when empty after load */}
            {(loadingOpenLocationTickets || openLocationTicketsError || openLocationTickets.length > 0) && (
              <div className={`rounded-3xl border ${isDarkMode ? "border-rose-500/30 bg-rose-500/8" : "border-rose-200 bg-rose-50/60"}`}>
                <button
                  onClick={() => setOpenTicketsExpanded((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 p-4 text-left"
                >
                  <div>
                    <div className={`text-sm font-semibold ${isDarkMode ? "text-rose-200" : "text-rose-800"}`}>Open Tickets — Fully Delivered</div>
                    <div className={`text-xs ${isDarkMode ? "text-rose-300/70" : "text-rose-600/80"}`}>
                      {isViewingAllStores
                        ? `All Locations${openLocationTicketLocations.length ? ` · ${openLocationTicketLocations.join(", ")}` : ""}`
                        : selectedStoreLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`text-[11px] font-medium uppercase tracking-[0.18em] ${isDarkMode ? "text-rose-400" : "text-rose-500"}`}>
                      {loadingOpenLocationTickets ? "Loading" : `${openLocationTicketTotalCount || openLocationTickets.length} Open`}
                    </div>
                    {openTicketsExpanded
                      ? <ChevronUp size={16} className={isDarkMode ? "text-rose-400" : "text-rose-500"} />
                      : <ChevronDown size={16} className={isDarkMode ? "text-rose-400" : "text-rose-500"} />
                    }
                  </div>
                </button>
                {openTicketsExpanded && (
                  <div className="px-4 pb-4">
                    {openLocationTicketsError ? (
                      <div className="text-xs text-rose-600 dark:text-rose-300">{openLocationTicketsError}</div>
                    ) : null}
                    {loadingOpenLocationTickets ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">Loading open tickets for {selectedStoreLabel}...</div>
                    ) : openLocationTickets.length ? (
                      <div className="space-y-2">
                        {openLocationTickets.map((ticket, index) => (
                          <div
                            key={`${ticket.saleId}-${index}`}
                            className={`rounded-2xl border px-3 py-3 ${
                              isDarkMode
                                ? "border-slate-800 bg-slate-900/80"
                                : "border-slate-200 bg-white/90"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {ticket.customerName || "Open ticket"}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {ticket.location || "Unknown location"} · {ticket.receiptNo || "No receipt"} · {ticket.saleStatus}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  Sale {formatShortDate(ticket.saleDate)}{ticket.estDeliveryDate ? ` · Est ${formatShortDate(ticket.estDeliveryDate)}` : ""}
                                </div>
                              </div>
                              <div className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                                {ticket.grandTotal !== null ? `$${ticket.grandTotal.toLocaleString()}` : ""}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <a href={saleLink(ticket.saleId)} target="_blank" rel="noopener noreferrer" className={ghostButtonClassName}>
                                Sale #{ticket.saleId}
                              </a>
                              <a href={itemsLink(ticket.saleId)} target="_blank" rel="noopener noreferrer" className={ghostButtonClassName}>
                                Items
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No open tickets found for {selectedStoreLabel}.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={`${panelClassName} p-4`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Customer Panel</div>
                </div>
                {customerSearch.fields.length && customerSearch.query.trim() ? (
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Searching {customerSearch.fields.map((field) => CUSTOMER_SEARCH_FIELD_LABELS[field]).join(" + ")}
                  </div>
                ) : null}
              </div>

              {/* Customer profile — shown when a customer name is loaded */}
              {(customerProfileVisits !== null || customerProfileOrders.length > 0 || loadingCustomerProfile) ? (
                <div className={`mt-3 rounded-2xl border px-3 py-3 space-y-2 ${isDarkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white/80"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Customer Profile</div>
                    {loadingCustomerProfile ? (
                      <div className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Loading...</div>
                    ) : customerProfileVisits ? (
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${customerProfileVisits.visitCount > 0 ? (isDarkMode ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700") : (isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}`}>
                          {customerProfileVisits.visitCount} visit{customerProfileVisits.visitCount !== 1 ? "s" : ""}
                        </span>
                        {customerProfileVisits.visits[0]?.startedAt ? (
                          <span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Last: {formatShortDate(customerProfileVisits.visits[0].startedAt)}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {/* Recent visits */}
                  {customerProfileVisits && customerProfileVisits.visits.length > 0 ? (
                    <div className="space-y-1">
                      <div className={`text-[11px] uppercase tracking-[0.14em] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Recent Visits</div>
                      {customerProfileVisits.visits.slice(0, 5).map((visit) => (
                        <div key={visit.id} className={`rounded-xl border px-2.5 py-2 text-xs flex items-start justify-between gap-2 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50"}`}>
                          <div>
                            <span className={`font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{formatShortDate(visit.startedAt)}</span>
                            <span className={`ml-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{visit.rep}</span>
                            {visit.customerType ? <span className={`ml-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>· {visit.customerType}</span> : null}
                          </div>
                          {visit.didPurchase ? (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
                              {visit.purchaseAmount ? `$${Number(visit.purchaseAmount).toLocaleString()}` : "Purchased"}
                            </span>
                          ) : visit.didPurchase === false ? (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>No sale</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : customerProfileVisits && !loadingCustomerProfile ? (
                    <div className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>No visit history found for this customer.</div>
                  ) : null}

                  {/* Purchase tickets */}
                  {customerProfileOrders.length > 0 ? (
                    <div className="space-y-1">
                      <div className={`text-[11px] uppercase tracking-[0.14em] font-medium ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Purchase Tickets ({customerProfileOrders.length})</div>
                      {customerProfileOrders.slice(0, 5).map((order, i) => (
                        <div key={`${order.saleId}-${i}`} className={`rounded-xl border px-2.5 py-2 text-xs flex items-start justify-between gap-2 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50"}`}>
                          <div>
                            <span className={`font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{order.customerName || "—"}</span>
                            <span className={`ml-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{formatShortDate(order.saleDate)}</span>
                            <span className={`ml-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>· {order.location} · {order.saleStatus}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {order.grandTotal !== null ? <span className={`font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>${Number(order.grandTotal).toLocaleString()}</span> : null}
                            <a href={saleLink(order.saleId)} target="_blank" rel="noopener noreferrer" className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-white"}`}>#{order.saleId}</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 grid gap-2">
                {/* Lifetime stats - always visible */}
                {customerLifetimeStats && (customerLifetimeStats.purchaseCount > 0 || customerLifetimeStats.firstPurchaseDate) && (
                  <div className={`rounded-2xl border px-3 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white/90"}`}>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-2">Lifetime Stats</div>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-lg font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>{customerLifetimeStats.purchaseCount}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">purchases</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-lg font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>${customerLifetimeStats.lifetimeDollars.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">lifetime</span>
                      </div>
                      {customerLifetimeStats.firstPurchaseDate && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Customer since</span>
                          <span className={`text-sm font-semibold ${isDarkMode ? "text-sky-400" : "text-sky-600"}`}>{new Date(customerLifetimeStats.firstPurchaseDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                        </div>
                      )}
                      {customerLifetimeStats.lastPurchaseDate && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Last</span>
                          <span className={`text-sm font-semibold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>{new Date(customerLifetimeStats.lastPurchaseDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input value={draft.firstName} onChange={(event) => updateDraftFromInput("firstName", event.target.value)} placeholder="First name" className={subtleInputClassName} />
                  <input value={draft.lastName} onChange={(event) => updateDraftFromInput("lastName", event.target.value)} placeholder="Last name" className={subtleInputClassName} />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input value={draft.phone} onChange={(event) => updateDraftFromInput("phone", event.target.value)} placeholder="Phone" className={subtleInputClassName} />
                  <input value={draft.email} onChange={(event) => updateDraftFromInput("email", event.target.value)} placeholder="Email" className={subtleInputClassName} />
                </div>
                {customerSearch.query.trim() ? (
                  <div className={`rounded-2xl border px-3 py-3 ${
                    isDarkMode
                      ? "border-slate-800 bg-slate-900/80"
                      : "border-slate-200 bg-white/90"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Live matches
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {customerSearching ? "Searching..." : `${customerSearchMatches.length} shown`}
                      </div>
                    </div>
                    {customerSearchError ? (
                      <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{customerSearchError}</div>
                    ) : null}
                    {customerSearchMatches.length ? (
                      <div className="mt-2 space-y-2">
                        {customerSearchMatches.map((match) => (
                          <button
                            key={match.id}
                            onClick={match.onSelect}
                            className={`block w-full rounded-2xl border px-3 py-2 text-left transition ${
                              isDarkMode
                                ? "border-slate-800 bg-slate-950 text-slate-100 hover:border-slate-700 hover:bg-slate-800"
                                : "border-slate-100 bg-slate-50 hover:border-sky-200 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium text-slate-900 dark:text-white">{match.title}</div>
                              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                                {match.type}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{match.subtitle}</div>
                          </button>
                        ))}
                      </div>
                    ) : customerSearching ? null : (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">No matching customers or orders yet.</div>
                    )}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select value={draft.store} onChange={(event) => updateDraft("store", event.target.value)} className={subtleInputClassName}>
                    {STORE_CODES.map((location) => <option key={location} value={location}>{getStoreLabel(location)}</option>)}
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <select value={draft.channel} onChange={(event) => updateDraft("channel", event.target.value as CRMLeadChannel)} className={subtleInputClassName}>
                    {CHANNEL_OPTIONS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
                  </select>
                  <select value={draft.stage} onChange={(event) => updateDraft("stage", event.target.value as CRMLeadStage)} className={subtleInputClassName}>
                    {STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                  <input type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} className={subtleInputClassName} />
                </div>
                <input value={draft.source} onChange={(event) => updateDraftFromInput("source", event.target.value)} placeholder="Source" className={subtleInputClassName} />
                <input value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} placeholder="City" className={subtleInputClassName} />
                <input value={draft.interest} onChange={(event) => updateDraftFromInput("interest", event.target.value)} placeholder="Interest" className={subtleInputClassName} />
                <textarea value={draft.wantsNeeds} onChange={(event) => updateDraft("wantsNeeds", event.target.value)} rows={3} placeholder="Wants / Needs" className={subtleInputClassName} />
                <textarea value={draft.objectionNote} onChange={(event) => updateDraft("objectionNote", event.target.value)} rows={3} placeholder="Objection note" className={subtleInputClassName} />
                <input value={draft.nextAction} onChange={(event) => updateDraftFromInput("nextAction", event.target.value)} placeholder="Next action" className={subtleInputClassName} />
                <textarea value={draft.notes} onChange={(event) => updateDraftFromInput("notes", event.target.value)} rows={4} placeholder="Notes" className={subtleInputClassName} />
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button onClick={() => void handleSaveCustomer()} disabled={saving !== null} className={successButtonClassName}>
                  {saving === "customer" ? "Saving..." : "Save Customer"}
                </button>
                <button
                  onClick={() => {
                    setDraft(buildDraft(authUser, defaultDraftStore));
                    resetCustomerLookup();
                    setCustomerProfileVisits(null);
                    setCustomerProfileOrders([]);
                  }}
                  className={ghostButtonClassName}
                >
                  Clear
                </button>
              </div>
            </div>

          </div>}
        </div>
      </div>
    </div>
  );
};

export default CRMWorkspace;
