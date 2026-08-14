export type SalesAnalysisTicket = {
  saleId: string;
  deliveredDate: string;
  status: string;
  store: string;
  salesperson: string;
  grandTotal: number;
  financeAmount: number;
  financeFee: number;
};

export type SalesAnalysisItem = {
  rowId: string;
  saleId: string;
  deliveredDate: string;
  store: string;
  manufacturer: string;
  category: string;
  itemNo: string;
  description: string;
  quantity: number;
  sales: number;
  totalCost: number | null;
  totalProfit: number | null;
  costSource?: "group_report" | "manual_override" | "unknown";
};

export type SalesAnalysisOptions = {
  start: string;
  endExclusive: string;
  salesperson?: string;
  manufacturer?: string;
  store?: string;
  category?: string;
  item?: string;
  page: number;
  pageSize: number;
};

type SeriesRow = {
  label: string;
  sales: number;
  quantity: number;
  cost: number;
  knownCostSales: number;
  profit: number;
  marginPct: number | null;
  financeAmount: number;
  financeFee: number;
  ticketCount: number;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;
const normalized = (value: string) => value.trim().toLocaleLowerCase();
const identity = (store: string, saleId: string) => `${normalized(store)}\u0000${saleId.trim()}`;
const allocated = (value: number, partIndex: number, partCount: number, scale = 100) => {
  const units = Math.round(value * scale);
  const sign = units < 0 ? -1 : 1;
  const absoluteUnits = Math.abs(units);
  const base = Math.trunc(absoluteUnits / partCount);
  const remainder = absoluteUnits - base * partCount;
  return sign * (base + (partIndex < remainder ? 1 : 0)) / scale;
};

const hasAuthoritativeCost = (item: SalesAnalysisItem) =>
  (item.costSource === "group_report" || item.costSource === "manual_override") && item.totalCost !== null && item.totalProfit !== null;

export function splitSalespeople(raw: string): string[] {
  const parts = String(raw || "").trim().split(/\s+and\s+/i);
  return parts.length === 2 && parts.every((part) => part.trim()) ? parts.map((part) => part.trim()) : [String(raw || "").trim() || "Unassigned"];
}

const excludedFurniture = (item: SalesAnalysisItem) =>
  /\b(mattress(?:es)?|box\s*springs?|foundations?|adjustable\s*bases?|power\s*bases?|bunkie\s*boards?|bedding)\b/i.test(
    `${item.manufacturer} ${item.category} ${item.itemNo} ${item.description}`
  );

const protectionItem = (item: SalesAnalysisItem) =>
  /\bpro\s?1st\b/i.test(
    `${item.manufacturer} ${item.category} ${item.itemNo} ${item.description}`
  );

const itemSignature = (item: SalesAnalysisItem) =>
  [item.saleId, item.deliveredDate, item.store, item.manufacturer, item.category, item.itemNo, item.description, item.quantity, item.sales].join("\u0000");

export function aggregateSalesAnalysis(tickets: SalesAnalysisTicket[], items: SalesAnalysisItem[], options: SalesAnalysisOptions) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.start) || !/^\d{4}-\d{2}-\d{2}$/.test(options.endExclusive) || options.start >= options.endExclusive) {
    throw new Error("invalid_sales_analysis_range");
  }
  if (!Number.isInteger(options.page) || options.page < 1 || !Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) {
    throw new Error("invalid_sales_analysis_page");
  }

  const ticketById = new Map<string, SalesAnalysisTicket>();
  for (const row of tickets) {
    const key = identity(row.store, row.saleId);
    if (ticketById.has(key)) throw new Error("ambiguous_sale_identity");
    ticketById.set(key, row);
  }
  const requestedPerson = options.salesperson ? normalized(options.salesperson) : "";
  const selected = items.filter((row) => {
    const ticket = ticketById.get(identity(row.store, row.saleId));
    if (!ticket || row.deliveredDate < options.start || row.deliveredDate >= options.endExclusive) return false;
    const people = splitSalespeople(ticket.salesperson);
    return (!requestedPerson || people.some((person) => normalized(person) === requestedPerson)) &&
      (!options.manufacturer || normalized(row.manufacturer) === normalized(options.manufacturer)) &&
      (!options.store || normalized(row.store) === normalized(options.store)) &&
      (!options.category || normalized(row.category) === normalized(options.category)) &&
      (!options.item || normalized(row.itemNo) === normalized(options.item));
  });
  const selectedTicketIds = new Set(selected.map((row) => identity(row.store, row.saleId)));
  const selectedTickets = tickets.filter((row) => selectedTicketIds.has(identity(row.store, row.saleId)));
  const duplicateCounts = new Map<string, number>();
  selected.forEach((row) => duplicateCounts.set(itemSignature(row), (duplicateCounts.get(itemSignature(row)) || 0) + 1));

  const buckets: Record<string, Map<string, SeriesRow>> = Object.fromEntries(
    ["item", "category", "manufacturer", "salesperson", "store", "day"].map((dimension) => [dimension, new Map<string, SeriesRow>()])
  );
  const getBucket = (dimension: string, label: string) => {
    let row = buckets[dimension].get(label);
    if (!row) {
      row = { label, sales: 0, quantity: 0, cost: 0, knownCostSales: 0, profit: 0, marginPct: null, financeAmount: 0, financeFee: 0, ticketCount: 0 };
      buckets[dimension].set(label, row);
    }
    return row;
  };
  const addItem = (dimension: string, label: string, item: SalesAnalysisItem, partIndex = 0, partCount = 1) => {
    const row = getBucket(dimension, label);
    row.sales += allocated(item.sales, partIndex, partCount);
    row.quantity += allocated(item.quantity, partIndex, partCount, 10000);
    if (hasAuthoritativeCost(item)) {
      row.cost += allocated(item.totalCost, partIndex, partCount);
      row.profit += allocated(item.totalProfit, partIndex, partCount);
      row.knownCostSales += allocated(item.sales, partIndex, partCount);
    }
  };

  selected.forEach((row) => {
    const people = splitSalespeople(ticketById.get(identity(row.store, row.saleId))?.salesperson || "Unassigned");
    const selectedIndex = requestedPerson ? people.findIndex((person) => normalized(person) === requestedPerson) : 0;
    const selectedCount = requestedPerson ? people.length : 1;
    addItem("item", row.itemNo, row, selectedIndex, selectedCount);
    addItem("category", row.category, row, selectedIndex, selectedCount);
    addItem("manufacturer", row.manufacturer, row, selectedIndex, selectedCount);
    addItem("store", row.store, row, selectedIndex, selectedCount);
    addItem("day", row.deliveredDate, row, selectedIndex, selectedCount);
    const visible = requestedPerson ? people.filter((person) => normalized(person) === requestedPerson) : people;
    visible.forEach((person) => addItem("salesperson", person, row, people.indexOf(person), people.length));
  });
  selectedTickets.forEach((ticket) => {
    const people = splitSalespeople(ticket.salesperson);
    const visible = requestedPerson ? people.filter((person) => normalized(person) === requestedPerson) : people;
    visible.forEach((person) => {
      const partIndex = people.indexOf(person);
      const row = getBucket("salesperson", person);
      row.financeAmount += allocated(ticket.financeAmount, partIndex, people.length);
      row.financeFee += allocated(ticket.financeFee, partIndex, people.length);
      row.ticketCount += 1 / people.length;
    });
  });

  Object.values(buckets).forEach((bucket) => bucket.forEach((row) => {
    row.sales = round(row.sales); row.quantity = round(row.quantity); row.cost = round(row.cost);
    row.knownCostSales = round(row.knownCostSales); row.profit = round(row.profit);
    row.financeAmount = round(row.financeAmount); row.financeFee = round(row.financeFee); row.ticketCount = round(row.ticketCount);
    row.marginPct = row.knownCostSales ? round((row.profit / row.knownCostSales) * 100) : null;
  }));

  const known = selected.filter(hasAuthoritativeCost);
  const share = (value: number, ticket: SalesAnalysisTicket, scale = 100) => requestedPerson
    ? allocated(value, splitSalespeople(ticket.salesperson).findIndex((person) => normalized(person) === requestedPerson), splitSalespeople(ticket.salesperson).length, scale)
    : value;
  const itemSales = selected.reduce((sum, row) => sum + share(row.sales, ticketById.get(identity(row.store, row.saleId))!), 0);
  const knownCostSales = known.reduce((sum, row) => sum + share(row.sales, ticketById.get(identity(row.store, row.saleId))!), 0);
  const cost = known.reduce((sum, row) => sum + share(row.totalCost || 0, ticketById.get(identity(row.store, row.saleId))!), 0);
  const profit = known.reduce((sum, row) => sum + share(row.totalProfit || 0, ticketById.get(identity(row.store, row.saleId))!), 0);
  const financeAmount = selectedTickets.reduce((sum, row) => sum + share(row.financeAmount, row), 0);
  const financeFee = selectedTickets.reduce((sum, row) => sum + share(row.financeFee, row), 0);
  const ticketCount = selectedTickets.reduce((sum, row) => sum + (requestedPerson ? 1 / splitSalespeople(row.salesperson).length : 1), 0);
  const eligible = selected.filter((row) => !excludedFurniture(row)).reduce((sum, row) => sum + share(row.sales, ticketById.get(identity(row.store, row.saleId))!), 0);
  const proSales = selected.filter((row) => protectionItem(row) && !excludedFurniture(row)).reduce((sum, row) => sum + share(row.sales, ticketById.get(identity(row.store, row.saleId))!), 0);
  const detailRows = selected.map((row) => {
    const ticket = ticketById.get(identity(row.store, row.saleId))!;
    const people = splitSalespeople(ticket.salesperson);
    const partIndex = requestedPerson ? people.findIndex((person) => normalized(person) === requestedPerson) : 0;
    const divisor = requestedPerson ? people.length : 1;
    const knownCost = hasAuthoritativeCost(row);
    return {
      deliveredDate: row.deliveredDate, saleId: row.saleId, status: ticket.status, store: row.store,
      salesperson: requestedPerson ? people.find((person) => normalized(person) === requestedPerson) : ticket.salesperson,
      manufacturer: row.manufacturer, category: row.category, itemNo: row.itemNo, description: row.description,
      quantity: round(allocated(row.quantity, partIndex, divisor, 10000)), sales: round(allocated(row.sales, partIndex, divisor)),
      cost: knownCost ? round(allocated(row.totalCost as number, partIndex, divisor)) : null,
      profit: knownCost ? round(allocated(row.totalProfit as number, partIndex, divisor)) : null,
      costSource: knownCost ? row.costSource : "unknown",
      duplicateWarning: (duplicateCounts.get(itemSignature(row)) || 0) > 1,
    };
  });
  const sortedSeries = Object.fromEntries(Object.entries(buckets).map(([key, bucket]) => [key, Array.from(bucket.values()).sort((a, b) => b.sales - a.sales || a.label.localeCompare(b.label))]));

  return {
    filters: options,
    summary: {
      itemSales: round(itemSales),
      ticketTotal: round(selectedTickets.reduce((sum, row) => sum + share(row.grandTotal, row), 0)),
      ticketCount: round(ticketCount), itemCount: selected.length, quantity: round(selected.reduce((sum, row) => sum + share(row.quantity, ticketById.get(identity(row.store, row.saleId))!, 10000), 0)),
      knownCostSales: round(knownCostSales), cost: round(cost), profit: round(profit),
      marginPct: knownCostSales ? round((profit / knownCostSales) * 100) : null,
      costCoveragePct: itemSales ? round((knownCostSales / itemSales) * 100) : null,
      financeAmount: round(financeAmount), financeFee: round(financeFee),
      financedTicketCount: round(selectedTickets.reduce((sum, row) => sum + (row.financeAmount > 0 ? (requestedPerson ? 1 / splitSalespeople(row.salesperson).length : 1) : 0), 0)),
    },
    pro1st: { sales: round(proSales), eligibleSales: round(eligible), penetrationPct: eligible ? round((proSales / eligible) * 100) : null },
    series: sortedSeries,
    warnings: {
      duplicateItemLines: selected.filter((row) => (duplicateCounts.get(itemSignature(row)) || 0) > 1).length,
      openDeliveredTickets: selectedTickets.filter((row) => normalized(row.status).startsWith("open")).length,
      twoPersonTickets: selectedTickets.filter((row) => splitSalespeople(row.salesperson).length === 2).length,
      itemTicketDifference: round(itemSales - selectedTickets.reduce((sum, row) => sum + row.grandTotal, 0)),
    },
    missingCosts: { count: selected.length - known.length },
    detail: { total: detailRows.length, page: options.page, pageSize: options.pageSize, rows: detailRows.slice((options.page - 1) * options.pageSize, options.page * options.pageSize) },
  };
}
