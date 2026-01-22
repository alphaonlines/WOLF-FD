type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

const DEFAULT_BASE_URL = "http://127.0.0.1:5055";

export function getPosApiBaseUrl(): string {
  const v = (import.meta as any).env?.VITE_POS_API_BASE_URL;
  return (v && typeof v === "string" && v.trim() ? v.trim() : DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export async function checkPosBackendHealthy(timeoutMs = 900): Promise<boolean> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const baseUrl = getPosApiBaseUrl();
    const res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal });
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

export async function fetchAvailableYears(): Promise<number[]> {
  const json = await fetchJson("/api/available-years");
  const years = (json as any)?.years;
  if (!Array.isArray(years)) return [];
  return years.map((y: any) => Number(y)).filter((y: number) => Number.isFinite(y)).sort((a, b) => a - b);
}

export async function uploadPosExports(files: File[]): Promise<{ import?: { ok?: boolean; stdout?: string; stderr?: string } }> {
  if (!files.length) return;
  const baseUrl = getPosApiBaseUrl();
  const form = new FormData();
  files.forEach((file) => form.append("files", file, file.name));
  const res = await fetch(`${baseUrl}/api/import/upload`, {
    method: "POST",
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
}> {
  const json = await fetchJson("/api/import/coverage-months");
  return {
    missingSalesMonths: Array.isArray((json as any)?.missingSalesMonths) ? (json as any).missingSalesMonths : [],
    missingItemMonths: Array.isArray((json as any)?.missingItemMonths) ? (json as any).missingItemMonths : [],
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

export async function fetchSalespersonTickets(params: {
  start: string;
  end: string;
  salesperson: string;
  limit?: number;
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
    rawSourceFile: string;
  }>
> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    salesperson: params.salesperson,
    limit: String(params.limit ?? 2000),
  });
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
    rawSourceFile: String(r.raw_source_file ?? ""),
  }));
}

export async function fetchLeaderboard(params: {
  start: string;
  end: string;
  limit?: number;
  salesperson?: string;
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

export async function fetchFinanceSummary(params: {
  start: string;
  end: string;
  salesperson?: string;
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
  const json = await fetchJson(`/api/items/by-category?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((r: any) => ({
    category: String(r.category ?? ""),
    qty: Number(r.qty ?? 0),
    sales: Number(r.sales ?? 0),
  }));
}

export async function fetchTopManufacturers(params: {
  start: string;
  end: string;
  limit?: number;
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
  const json = await fetchJson(`/api/items/by-manufacturer?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((r: any) => ({
    manufacturer: String(r.manufacturer ?? ""),
    qty: Number(r.qty ?? 0),
    sales: Number(r.sales ?? 0),
  }));
}

export async function fetchPro1stAttachRate(params: {
  start: string;
  end: string;
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
