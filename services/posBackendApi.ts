type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

const DEFAULT_BASE_URL = "http://127.0.0.1:5057";

export function getPosApiBaseUrl(): string {
  const v = (import.meta as any).env?.VITE_POS_API_BASE_URL;
  return (v && typeof v === "string" && v.trim() ? v.trim() : DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export async function checkPosBackendHealthy(timeoutMs = 900): Promise<boolean> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const baseUrl = getPosApiBaseUrl();
    const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal, credentials: "include" });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => null)) as any;
    return !!json?.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(t);
  }
}

async function fetchJson(path: string, init?: RequestInit): Promise<JsonValue> {
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
    throw new Error(`POS API ${res.status} for ${path}`);
  }
  return (await res.json()) as JsonValue;
}

async function postJson(path: string, body: any): Promise<JsonValue> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POS API ${res.status} for ${path}`);
  }
  return (await res.json()) as JsonValue;
}

export async function fetchAvailableYears(): Promise<number[]> {
  const json = await fetchJson("/api/available-years");
  const years = (json as any)?.years;
  if (!Array.isArray(years)) return [];
  return years.map((y: any) => Number(y)).filter((y: number) => Number.isFinite(y)).sort((a, b) => a - b);
}

export async function uploadPosExports(files: File[], manufacturer?: string): Promise<{ import?: { ok?: boolean; stdout?: string; stderr?: string } }> {
  if (!files.length) return {};
  const baseUrl = getPosApiBaseUrl();
  const form = new FormData();
  files.forEach((file) => form.append("files", file, file.name));
  if (manufacturer && manufacturer.trim()) {
    form.append("manufacturer", manufacturer.trim());
  }
  const res = await fetch(`${baseUrl}/api/import/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`POS API ${res.status} for upload`);
  }
  return (await res.json()) as any;
}

export async function fetchCoverageMonths(): Promise<{
  missingSalesMonths: string[];
  missingItemMonths: string[];
  missingSalesDays: string[];
  missingItemDays: string[];
  missingSalesDaysCount: number;
  missingItemDaysCount: number;
  startDate?: string;
  endDate?: string;
}> {
  const json = await fetchJson("/api/import/coverage-months");
  return {
    startDate: typeof (json as any)?.startDate === "string" ? (json as any).startDate : undefined,
    endDate: typeof (json as any)?.endDate === "string" ? (json as any).endDate : undefined,
    missingSalesMonths: Array.isArray((json as any)?.missingSalesMonths) ? (json as any).missingSalesMonths : [],
    missingItemMonths: Array.isArray((json as any)?.missingItemMonths) ? (json as any).missingItemMonths : [],
    missingSalesDays: Array.isArray((json as any)?.missingSalesDays) ? (json as any).missingSalesDays : [],
    missingItemDays: Array.isArray((json as any)?.missingItemDays) ? (json as any).missingItemDays : [],
    missingSalesDaysCount: Number((json as any)?.missingSalesDaysCount ?? 0),
    missingItemDaysCount: Number((json as any)?.missingItemDaysCount ?? 0),
  };
}

export async function fetchOutliers(params: {
  start: string;
  end: string;
  limit?: number;
  salesperson?: string;
}): Promise<{
  thresholdHigh: number | null;
  totalCount: number;
  rows: Array<{
    saleId: string;
    saleDate: string;
    salesperson: string;
    location: string;
    receiptNo: string;
    customerName: string;
    grandTotal: number;
    profit: number;
    totalFinanceAmt: number;
    financeBalance: number;
    financeFee: number;
    rawSourceFile: string;
  }>;
}> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    limit: String(params.limit ?? 25),
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  const json = await fetchJson(`/api/outliers?${qs.toString()}`);

  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return {
    thresholdHigh: (json as any)?.threshold_high ?? null,
    totalCount: Number((json as any)?.total_count ?? 0),
    rows: rows.map((r: any) => ({
      saleId: String(r.sale_id ?? ""),
      saleDate: String(r.sale_date ?? ""),
      salesperson: String(r.salesperson ?? ""),
      location: String(r.location ?? ""),
      receiptNo: String(r.receipt_no ?? ""),
      customerName: String(r.customer_name ?? ""),
      grandTotal: Number(r.grand_total ?? 0),
      profit: Number(r.profit ?? 0),
      totalFinanceAmt: Number(r.total_finance_amt ?? 0),
      financeBalance: Number(r.finance_balance ?? 0),
      financeFee: Number(r.finance_fee ?? 0),
      rawSourceFile: String(r.raw_source_file ?? ""),
    })),
  };
}

export async function fetchLowMargin(params: {
  start: string;
  end: string;
  limitPer?: number;
  limitTotal?: number;
  salesperson?: string;
  location?: string;
  category?: string;
  manufacturer?: string;
}): Promise<{
  totalCount: number;
  rows: Array<{
    saleId: string;
    saleDate: string;
    salesperson: string;
    location: string;
    receiptNo: string;
    customerName: string;
    grandTotal: number;
    profit: number;
    marginPct: number | null;
    totalFinanceAmt: number;
    financeBalance: number;
    financeFee: number;
    rawSourceFile: string;
  }>;
}> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    limit_per: String(params.limitPer ?? 5),
    limit_total: String(params.limitTotal ?? 200),
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.category && params.category.trim()) qs.set("category", params.category.trim());
  if (params.manufacturer && params.manufacturer.trim()) qs.set("manufacturer", params.manufacturer.trim());
  const json = await fetchJson(`/api/low-margin?${qs.toString()}`);

  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return {
    totalCount: Number((json as any)?.total_count ?? 0),
    rows: rows.map((r: any) => ({
      saleId: String(r.sale_id ?? ""),
      saleDate: String(r.sale_date ?? ""),
      salesperson: String(r.salesperson ?? ""),
      location: String(r.location ?? ""),
      receiptNo: String(r.receipt_no ?? ""),
      customerName: String(r.customer_name ?? ""),
      grandTotal: Number(r.grand_total ?? 0),
      profit: Number(r.profit ?? 0),
      marginPct: r.margin_pct === null || r.margin_pct === undefined ? null : Number(r.margin_pct),
      totalFinanceAmt: Number(r.total_finance_amt ?? 0),
      financeBalance: Number(r.finance_balance ?? 0),
      financeFee: Number(r.finance_fee ?? 0),
      rawSourceFile: String(r.raw_source_file ?? ""),
    })),
  };
}

export async function fetchSalesReport(params: {
  start: string;
  end: string;
  dimension: "salesperson" | "store";
  salesperson?: string;
  location?: string;
  category?: string;
  manufacturer?: string;
}): Promise<{
  dimension: "salesperson" | "store";
  distinctTicketCount: number;
  rows: Array<{
    label: string;
    ticketCount: number;
    totalRetail: number;
    pro1stSales: number;
    units: number;
    avgMarginPct: number | null;
  }>;
  availableCategories: string[];
  availableManufacturers: string[];
}> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    dimension: params.dimension,
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.category && params.category.trim()) qs.set("category", params.category.trim());
  if (params.manufacturer && params.manufacturer.trim()) qs.set("manufacturer", params.manufacturer.trim());
  const json = await fetchJson(`/api/report/sales-summary?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return {
    dimension: ((json as any)?.dimension || params.dimension) as "salesperson" | "store",
    distinctTicketCount: Number((json as any)?.distinctTicketCount ?? rows[0]?.distinct_ticket_count ?? 0),
    rows: rows.map((r: any) => {
      const rawMargin = r.avg_margin_pct ?? r.avgMarginPct;
      const marginNum = rawMargin === null || rawMargin === undefined || rawMargin === "" ? null : Number(rawMargin);
      return {
        label: String(r.label ?? ""),
        ticketCount: Number(r.ticket_count ?? r.ticketCount ?? 0),
        totalRetail: Number(r.total_retail ?? r.totalRetail ?? 0),
        pro1stSales: Number(r.pro1st_sales ?? r.pro1stSales ?? 0),
        units: Number(r.units ?? 0),
        avgMarginPct: Number.isFinite(marginNum as number) ? (marginNum as number) : null,
      };
    }),
    availableCategories: Array.isArray((json as any)?.availableCategories) ? (json as any).availableCategories : [],
    availableManufacturers: Array.isArray((json as any)?.availableManufacturers) ? (json as any).availableManufacturers : [],
  };
}

export async function fetchSalespersonTickets(params: {
  start: string;
  end: string;
  salesperson: string;
  limit?: number;
  location?: string;
}): Promise<
  Array<{
    saleId: string;
    saleDate: string;
    salesperson: string;
    location: string;
    receiptNo: string;
    customerName: string;
    grandTotal: number;
    profit: number;
    marginPct: number | null;
    pro1stSales: number;
    pro1stPct: number | null;
    rawSourceFile: string;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    salesperson: params.salesperson,
    limit: String(params.limit ?? 2000),
  });
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  const json = await fetchJson(`/api/salesperson-tickets?${qs.toString()}`);
  const rows = (json as any)?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    saleId: String(r.sale_id ?? ""),
    saleDate: String(r.sale_date ?? ""),
    salesperson: String(r.salesperson ?? ""),
    location: String(r.location ?? ""),
    receiptNo: String(r.receipt_no ?? ""),
    customerName: String(r.customer_name ?? ""),
    grandTotal: Number(r.grand_total ?? 0),
    profit: Number(r.profit ?? 0),
    marginPct: r.margin_pct === null || r.margin_pct === undefined ? null : Number(r.margin_pct),
    pro1stSales: Number(r.pro1st_sales ?? 0),
    pro1stPct: r.pro1st_pct === null || r.pro1st_pct === undefined ? null : Number(r.pro1st_pct),
    rawSourceFile: String(r.raw_source_file ?? ""),
  }));
}

export type OpenLocationTicketRow = {
  saleId: string;
  saleDate: string | null;
  estDeliveryDate: string | null;
  deliveryConfirmedDate: string | null;
  location: string;
  receiptNo: string;
  customerName: string;
  grandTotal: number | null;
  saleStatus: string;
};

export async function fetchOpenLocationTickets(params: {
  store: string;
  limit?: number;
}): Promise<{
  store: string;
  locations: string[];
  rows: OpenLocationTicketRow[];
}> {
  const qs = new URLSearchParams({
    store: params.store,
    limit: String(params.limit ?? 10),
  });
  const json = await fetchJson(`/api/open-location-tickets?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return {
    store: String((json as any)?.store ?? params.store),
    locations: Array.isArray((json as any)?.locations) ? (json as any).locations.map((value: any) => String(value)) : [],
    rows: rows.map((row: any) => ({
      saleId: String(row.sale_id ?? ""),
      saleDate: row.sale_date ? String(row.sale_date) : null,
      estDeliveryDate: row.est_delivery_date ? String(row.est_delivery_date) : null,
      deliveryConfirmedDate: row.delivery_confirmed_date ? String(row.delivery_confirmed_date) : null,
      location: String(row.location ?? ""),
      receiptNo: String(row.receipt_no ?? ""),
      customerName: String(row.customer_name ?? ""),
      grandTotal: row.grand_total === null || row.grand_total === undefined ? null : Number(row.grand_total),
      saleStatus: String(row.sale_status ?? ""),
    })),
  };
}

export async function fetchLeaderboard(params: {
  start: string;
  end: string;
  limit?: number;
  salesperson?: string;
  location?: string;
}): Promise<
  Array<{
    salesperson: string;
    lines: number;
    sales: number;
    profit: number;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    limit: String(params.limit ?? 20),
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  const json = await fetchJson(`/api/leaderboard?${qs.toString()}`);

  const rows = (json as any)?.rows;
  if (!Array.isArray(rows)) return [];

  return rows.map((r: any) => ({
    salesperson: String(r.salesperson ?? ""),
    lines: Number(r.lines ?? 0),
    sales: Number(r.sales ?? 0),
    profit: Number(r.profit ?? 0),
  }));
}

export async function fetchSalesByLocation(params: {
  start: string;
  end: string;
  salesperson?: string;
  location?: string;
}): Promise<
  Array<{
    location: string;
    sales: number;
    profit: number;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  const json = await fetchJson(`/api/sales-by-location?${qs.toString()}`);

  const rows = (json as any)?.rows;
  if (!Array.isArray(rows)) return [];

  return rows.map((r: any) => ({
    location: String(r.location ?? ""),
    sales: Number(r.sales ?? 0),
    profit: Number(r.profit ?? 0),
  }));
}

export async function fetchSummary(params: {
  start: string;
  end: string;
  salesperson?: string;
  location?: string;
}): Promise<{
  lines: number;
  sales: number;
  profit: number;
}> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  const json = await fetchJson(`/api/summary?${qs.toString()}`);

  return {
    lines: Number((json as any)?.lines ?? 0),
    sales: Number((json as any)?.sales ?? 0),
    profit: Number((json as any)?.profit ?? 0),
  };
}

export async function fetchSalesDaily(params: {
  start: string;
  end: string;
  salesperson?: string;
  location?: string;
}): Promise<
  Array<{
    day: string;
    lines: number;
    sales: number;
    profit: number;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  const json = await fetchJson(`/api/sales-daily?${qs.toString()}`);

  const rows = (json as any)?.rows;
  if (!Array.isArray(rows)) return [];

  return rows.map((r: any) => ({
    day: String(r.day ?? ""),
    lines: Number(r.lines ?? 0),
    sales: Number(r.sales ?? 0),
    profit: Number(r.profit ?? 0),
  }));
}

export async function fetchPro1stTrend(params: {
  start: string;
  end: string;
  salesperson?: string;
  location?: string;
}): Promise<
  Array<{
    day: string;
    sales: number;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  const json = await fetchJson(`/api/pro1st/trend?${qs.toString()}`);

  const rows = (json as any)?.rows;
  if (!Array.isArray(rows)) return [];

  return rows.map((r: any) => ({
    day: String(r.day ?? ""),
    sales: Number(r.sales ?? 0),
  }));
}

export async function fetchFinanceSummary(params: {
  start: string;
  end: string;
  salesperson?: string;
  location?: string;
}): Promise<{
  lines: number;
  financedLines: number;
  financedAmount: number;
  financeFee: number;
  financeBalance: number;
}> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
  });
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  const json = await fetchJson(`/api/finance-summary?${qs.toString()}`);

  return {
    lines: Number((json as any)?.lines ?? 0),
    financedLines: Number((json as any)?.financed_lines ?? 0),
    financedAmount: Number((json as any)?.financed_amount ?? 0),
    financeFee: Number((json as any)?.finance_fee ?? 0),
    financeBalance: Number((json as any)?.finance_balance ?? 0),
  };
}

export async function fetchBestSellers(params: {
  start: string;
  end: string;
  limit?: number;
  sort?: "sales" | "qty";
  location?: string;
  salesperson?: string;
}): Promise<
  Array<{
    itemDescription: string;
    category: string;
    manufacturer: string;
    itemNo: string;
    qty: number;
    sales: number;
    saleIds: string[];
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    limit: String(params.limit ?? 12),
  });
  if (params.sort) qs.set("sort", params.sort);
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  const json = await fetchJson(`/api/items/best-sellers?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((r: any) => ({
    itemDescription: String(r.item_description ?? ""),
    category: String(r.category ?? ""),
    manufacturer: String(r.manufacturer ?? ""),
    itemNo: String(r.item_no ?? ""),
    qty: Number(r.qty ?? 0),
    sales: Number(r.sales ?? 0),
    saleIds: Array.isArray(r.sale_ids) ? r.sale_ids.map((x: any) => String(x)) : [],
  }));
}

export async function fetchTopCategories(params: {
  start: string;
  end: string;
  limit?: number;
  sort?: "sales" | "qty";
  location?: string;
  salesperson?: string;
}): Promise<
  Array<{
    category: string;
    qty: number;
    sales: number;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    limit: String(params.limit ?? 8),
  });
  if (params.sort) qs.set("sort", params.sort);
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  const json = await fetchJson(`/api/items/by-category?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((r: any) => ({
    category: String(r.category ?? ""),
    qty: Number(r.qty ?? 0),
    sales: Number(r.sales ?? 0),
  }));
}

export async function fetchCategoryTopItems(params: {
  start: string;
  end: string;
  category: string;
  limit?: number;
  sort?: "sales" | "qty";
  location?: string;
  salesperson?: string;
}): Promise<
  Array<{
    itemDescription: string;
    manufacturer: string;
    itemNo: string;
    qty: number;
    sales: number;
    saleIds: string[];
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    category: params.category,
    limit: String(params.limit ?? 10),
  });
  if (params.sort) qs.set("sort", params.sort);
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  const json = await fetchJson(`/api/items/category-top-items?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((r: any) => ({
    itemDescription: String(r.item_description ?? ""),
    manufacturer: String(r.manufacturer ?? ""),
    itemNo: String(r.item_no ?? ""),
    qty: Number(r.qty ?? 0),
    sales: Number(r.sales ?? 0),
    saleIds: Array.isArray(r.sale_ids) ? r.sale_ids.map((x: any) => String(x)) : [],
  }));
}

export async function fetchTopManufacturers(params: {
  start: string;
  end: string;
  limit?: number;
  sort?: "sales" | "qty";
  location?: string;
  salesperson?: string;
}): Promise<
  Array<{
    manufacturer: string;
    qty: number;
    sales: number;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    limit: String(params.limit ?? 8),
  });
  if (params.sort) qs.set("sort", params.sort);
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  const json = await fetchJson(`/api/items/by-manufacturer?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((r: any) => ({
    manufacturer: String(r.manufacturer ?? ""),
    qty: Number(r.qty ?? 0),
    sales: Number(r.sales ?? 0),
  }));
}

export async function fetchManufacturerTopItems(params: {
  start: string;
  end: string;
  manufacturer: string;
  limit?: number;
  sort?: "sales" | "qty";
  location?: string;
  salesperson?: string;
}): Promise<
  Array<{
    itemDescription: string;
    category: string;
    itemNo: string;
    qty: number;
    sales: number;
    saleIds: string[];
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    manufacturer: params.manufacturer,
    limit: String(params.limit ?? 10),
  });
  if (params.sort) qs.set("sort", params.sort);
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  const json = await fetchJson(`/api/items/manufacturer-top-items?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((r: any) => ({
    itemDescription: String(r.item_description ?? ""),
    category: String(r.category ?? ""),
    itemNo: String(r.item_no ?? ""),
    qty: Number(r.qty ?? 0),
    sales: Number(r.sales ?? 0),
    saleIds: Array.isArray(r.sale_ids) ? r.sale_ids.map((x: any) => String(x)) : [],
  }));
}

export async function fetchPro1stAttachRate(params: {
  start: string;
  end: string;
  location?: string;
  salesperson?: string;
}): Promise<{
  totalSales: number;
  proSales: number;
  attachRate: number;
  saleIds: string[];
  saleIdsLow: string[];
  saleIdsMid: string[];
  saleIdsHigh: string[];
}> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
  });
  if (params.location && params.location.trim()) qs.set("location", params.location.trim());
  if (params.salesperson && params.salesperson.trim()) qs.set("salesperson", params.salesperson.trim());
  const json = await fetchJson(`/api/pro1st/attach-rate?${qs.toString()}`);
  return {
    totalSales: Number((json as any)?.total_sales ?? 0),
    proSales: Number((json as any)?.pro_sales ?? 0),
    attachRate: Number((json as any)?.attach_rate ?? 0),
    saleIds: Array.isArray((json as any)?.sale_ids) ? (json as any).sale_ids.map((x: any) => String(x)) : [],
    saleIdsLow: Array.isArray((json as any)?.sale_ids_low) ? (json as any).sale_ids_low.map((x: any) => String(x)) : [],
    saleIdsMid: Array.isArray((json as any)?.sale_ids_mid) ? (json as any).sale_ids_mid.map((x: any) => String(x)) : [],
    saleIdsHigh: Array.isArray((json as any)?.sale_ids_high) ? (json as any).sale_ids_high.map((x: any) => String(x)) : [],
  };
}

export async function fetchSalespeopleBySaleIds(saleIds: string[]): Promise<Record<string, string>> {
  const json = await postJson("/api/sales/by-ids", { sale_ids: saleIds });
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  const map: Record<string, string> = {};
  rows.forEach((r: any) => {
    const id = String(r.sale_id ?? "").trim();
    if (!id) return;
    map[id] = String(r.salesperson ?? "");
  });
  return map;
}
