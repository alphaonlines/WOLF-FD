import type { Express, Request } from "express";
import type { Pool } from "pg";

const ymd = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const nullableNum = (value: unknown) => value == null ? null : num(value);
const dateOnly = (value: unknown) => value ? String(value).slice(0, 10) : "";
const hasSales = (req: Request) => Array.isArray((req as any).authUser?.permissions) && (req as any).authUser.permissions.includes("module.sales");
const isAdmin = (req: Request) => Array.isArray((req as any).authUser?.roles) &&
  (req as any).authUser.roles.some((role: unknown) => role === "Owner" || role === "Admin");
const sameOrigin = (req: Request) => {
  const origin = req.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin.toLowerCase() === `${req.protocol}://${String(req.get("host") || "")}`.toLowerCase(); }
  catch { return false; }
};
const round = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;

// PostgreSQL equivalent of the canonical deterministic cent allocation. The first
// salesperson receives the odd cent; negative remainders intentionally match JS.
const allocated = (column: string, scale = 100) => `CASE WHEN $3::text IS NULL THEN ${column} ELSE
 (trunc(round((${column}) * ${scale})::numeric / person_count) + CASE WHEN person_index <= mod(round((${column}) * ${scale})::bigint,person_count) THEN 1 ELSE 0 END) / ${scale}.0 END`;

const COST = `CASE WHEN i.cost_authority='group_report' THEN i.total_cost WHEN o.id IS NOT NULL THEN o.total_cost ELSE NULL END`;
const PROFIT = `CASE WHEN i.cost_authority='group_report' THEN i.total_profit WHEN o.id IS NOT NULL THEN i.total_sale_price-o.total_cost ELSE NULL END`;
const COST_SOURCE = `CASE WHEN i.cost_authority='group_report' THEN 'group_report' WHEN o.id IS NOT NULL THEN 'manual_override' ELSE 'unknown' END`;
const PEOPLE = `regexp_split_to_array(COALESCE(NULLIF(trim(s.salesperson),''),'Unassigned'),'\\s+and\\s+','i')`;
const PRO1ST = `concat_ws(' ',i.manufacturer,i.category,i.item_no,i.item_description) ~* '\\mpro[[:space:]]?1st\\M'`;
const EXCLUDED = `concat_ws(' ',i.manufacturer,i.category,i.item_no,i.item_description) ~* '\\m(mattress(es)?|box[[:space:]]*springs?|foundations?|adjustable[[:space:]]*bases?|power[[:space:]]*bases?|bunkie[[:space:]]*boards?|bedding)\\M'`;

const baseCte = (extraWhere: string) => `WITH filtered AS (
 SELECT i.row_hash row_id,i.sale_id,s.delivery_confirmed_date::text delivered_date,COALESCE(i.location,s.location,'(unknown)') store,
 COALESCE(s.sale_status,'Delivered') status,COALESCE(NULLIF(trim(s.salesperson),''),'Unassigned') salesperson,
 COALESCE(i.manufacturer,'(unknown)') manufacturer,COALESCE(i.category,'(unknown)') category,COALESCE(i.item_no,'(unknown)') item_no,
 COALESCE(i.item_description,'') description,COALESCE(i.qty_sold,0)::numeric quantity,COALESCE(i.total_sale_price,0)::numeric sales,
 ${COST} total_cost,${PROFIT} total_profit,${COST_SOURCE} cost_source,COALESCE(s.grand_total,0)::numeric grand_total,
 COALESCE(s.total_finance_amt,0)::numeric finance_amount,COALESCE(s.finance_fee,0)::numeric finance_fee,
 cardinality(${PEOPLE}) person_count,
 CASE WHEN $3::text IS NULL THEN 1 ELSE array_position(ARRAY(SELECT lower(trim(p)) FROM unnest(${PEOPLE}) p),$3) END person_index,
 (${PRO1ST}) is_pro1st,(${EXCLUDED}) is_excluded
 FROM pos_sale_items i JOIN pos_sales s ON s.sale_id=i.sale_id AND s.location=i.location
 LEFT JOIN sales_cost_override_active o ON o.store=COALESCE(i.location,s.location) AND o.sale_id=i.sale_id AND o.row_id=i.row_hash
 WHERE s.delivery_confirmed_date >= $1 AND s.delivery_confirmed_date < $2
 AND (i.date_basis IS NULL OR lower(i.date_basis)='delivered')
 AND ($3::text IS NULL OR ($3=ANY(ARRAY(SELECT lower(trim(p)) FROM unnest(${PEOPLE}) p)) AND cardinality(${PEOPLE}) IN (1,2)))${extraWhere}
)`;

const SUMMARY_SQL = (where: string) => `${baseCte(where)}, tickets AS (
 SELECT store,sale_id,max(status) status,max(salesperson) salesperson,max(grand_total) grand_total,max(finance_amount) finance_amount,max(finance_fee) finance_fee,max(person_count) person_count,max(person_index) person_index FROM filtered GROUP BY store,sale_id
) SELECT
 COALESCE(sum(${allocated("sales")}),0) item_sales,COUNT(*)::text item_count,COALESCE(sum(${allocated("quantity", 10000)}),0) quantity,
 COALESCE(sum(${allocated("sales")}) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL),0) known_cost_sales,
 COALESCE(sum(${allocated("total_cost")}) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL),0) cost,
 COALESCE(sum(${allocated("total_profit")}) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL),0) profit,
 COUNT(*) FILTER (WHERE total_cost IS NULL OR total_profit IS NULL)::text missing_costs,
 COALESCE(sum(${allocated("sales")}) FILTER (WHERE NOT is_excluded),0) eligible_sales,
 COALESCE(sum(${allocated("sales")}) FILTER (WHERE is_pro1st AND NOT is_excluded),0) pro_sales,
 (SELECT COALESCE(sum(${allocated("grand_total")}),0) FROM tickets) ticket_total,
 (SELECT COALESCE(sum(CASE WHEN $3::text IS NULL THEN 1 ELSE 1.0/person_count END),0) FROM tickets) ticket_count,
 (SELECT COALESCE(sum(${allocated("finance_amount")}),0) FROM tickets) finance_amount,
 (SELECT COALESCE(sum(${allocated("finance_fee")}),0) FROM tickets) finance_fee,
 (SELECT COALESCE(sum(CASE WHEN finance_amount>0 THEN CASE WHEN $3::text IS NULL THEN 1 ELSE 1.0/person_count END ELSE 0 END),0) FROM tickets) financed_ticket_count,
 (SELECT COUNT(*) FILTER (WHERE lower(status) LIKE 'open%') FROM tickets)::text open_tickets,
 (SELECT COUNT(*) FILTER (WHERE person_count=2) FROM tickets)::text two_person_tickets,
 (SELECT COALESCE(sum(grand_total),0) FROM tickets) unallocated_ticket_total,
 COUNT(*) FILTER (WHERE duplicate_count>1)::text duplicate_lines
 FROM (SELECT filtered.*,COUNT(*) OVER (PARTITION BY sale_id,delivered_date,store,manufacturer,category,item_no,description,quantity,sales) duplicate_count FROM filtered) f`;

const SERIES_SQL = (where: string) => `${baseCte(where)}, item_series AS (
 SELECT dimension,label,sum(${allocated("sales")})::numeric sales,sum(${allocated("quantity", 10000)})::numeric quantity,
 sum(${allocated("total_cost")}) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL) cost,
 sum(${allocated("sales")}) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL) known_cost_sales,
 sum(${allocated("total_profit")}) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL) profit
 FROM (SELECT 'item' dimension,item_no label,* FROM filtered UNION ALL SELECT 'category',category,* FROM filtered UNION ALL
 SELECT 'manufacturer',manufacturer,* FROM filtered UNION ALL SELECT 'store',store,* FROM filtered UNION ALL SELECT 'day',delivered_date,* FROM filtered) d GROUP BY dimension,label
), people AS (
 SELECT p.person label,f.*,p.ordinality person_ordinality FROM filtered f CROSS JOIN LATERAL unnest(regexp_split_to_array(f.salesperson,'\\s+and\\s+','i')) WITH ORDINALITY p(person,ordinality)
 WHERE $3::text IS NULL OR lower(trim(p.person))=$3
), person_items AS (
 SELECT 'salesperson' dimension,label,sum((trunc(round(sales*100)::numeric/person_count)+CASE WHEN person_ordinality<=mod(round(sales*100)::bigint,person_count) THEN 1 ELSE 0 END)/100.0) sales,
 sum((trunc(round(quantity*10000)::numeric/person_count)+CASE WHEN person_ordinality<=mod(round(quantity*10000)::bigint,person_count) THEN 1 ELSE 0 END)/10000.0) quantity,
 sum((trunc(round(total_cost*100)::numeric/person_count)+CASE WHEN person_ordinality<=mod(round(total_cost*100)::bigint,person_count) THEN 1 ELSE 0 END)/100.0) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL) cost,
 sum((trunc(round(sales*100)::numeric/person_count)+CASE WHEN person_ordinality<=mod(round(sales*100)::bigint,person_count) THEN 1 ELSE 0 END)/100.0) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL) known_cost_sales,
 sum((trunc(round(total_profit*100)::numeric/person_count)+CASE WHEN person_ordinality<=mod(round(total_profit*100)::bigint,person_count) THEN 1 ELSE 0 END)/100.0) FILTER (WHERE total_cost IS NOT NULL AND total_profit IS NOT NULL) profit
 FROM people GROUP BY label
), person_tickets AS (
 SELECT label,sum((trunc(round(finance_amount*100)::numeric/person_count)+CASE WHEN person_ordinality<=mod(round(finance_amount*100)::bigint,person_count) THEN 1 ELSE 0 END)/100.0) finance_amount,
 sum((trunc(round(finance_fee*100)::numeric/person_count)+CASE WHEN person_ordinality<=mod(round(finance_fee*100)::bigint,person_count) THEN 1 ELSE 0 END)/100.0) finance_fee,
 sum(1.0/person_count) ticket_count
 FROM (SELECT DISTINCT ON (store,sale_id,label) store,sale_id,label,finance_amount,finance_fee,person_count,person_ordinality FROM people ORDER BY store,sale_id,label) t GROUP BY label
) SELECT dimension,label,sales,quantity,COALESCE(cost,0) cost,COALESCE(known_cost_sales,0) known_cost_sales,COALESCE(profit,0) profit,0::numeric finance_amount,0::numeric finance_fee,0::numeric ticket_count FROM item_series
 UNION ALL SELECT p.dimension,p.label,p.sales,p.quantity,COALESCE(p.cost,0),COALESCE(p.known_cost_sales,0),COALESCE(p.profit,0),COALESCE(t.finance_amount,0),COALESCE(t.finance_fee,0),COALESCE(t.ticket_count,0) FROM person_items p LEFT JOIN person_tickets t ON t.label=p.label`;

const COUNT_SQL = (where: string) => `${baseCte(where)} SELECT COUNT(*)::text total FROM filtered`;
const DETAIL_SQL = (where: string, limit: number, offset: number) => `${baseCte(where)} SELECT delivered_date,sale_id,status,store,
 CASE WHEN $3::text IS NULL THEN salesperson ELSE (regexp_split_to_array(salesperson,'\\s+and\\s+','i'))[person_index] END salesperson,
 manufacturer,category,item_no,description,${allocated("quantity",10000)} quantity,${allocated("sales")} sales,
 CASE WHEN total_cost IS NULL OR total_profit IS NULL THEN NULL ELSE ${allocated("total_cost")} END cost,
 CASE WHEN total_cost IS NULL OR total_profit IS NULL THEN NULL ELSE ${allocated("total_profit")} END profit,cost_source,
 COUNT(*) OVER (PARTITION BY sale_id,delivered_date,store,manufacturer,category,item_no,description,quantity,sales)>1 duplicate_warning
 FROM filtered ORDER BY delivered_date,store,sale_id,row_id LIMIT $${limit} OFFSET $${offset}`;

const mapSeries = (rows: any[]) => {
  const result: Record<string, any[]> = { item: [], category: [], manufacturer: [], salesperson: [], store: [], day: [] };
  for (const row of rows) {
    const known = num(row.known_cost_sales), profit = num(row.profit);
    result[row.dimension]?.push({ label: String(row.label), sales: round(num(row.sales)), quantity: round(num(row.quantity)), cost: round(num(row.cost)), knownCostSales: round(known), profit: round(profit), marginPct: known ? round(profit / known * 100) : null, financeAmount: round(num(row.finance_amount)), financeFee: round(num(row.finance_fee)), ticketCount: round(num(row.ticket_count)) });
  }
  Object.values(result).forEach((rows) => rows.sort((a, b) => b.sales - a.sales || a.label.localeCompare(b.label)));
  return result;
};

export function registerSalesAnalysisRoutes({ app, pool }: { app: Express; pool: Pool }) {
  app.use("/api/sales-analysis", (req, res, next) => hasSales(req) ? next() : res.status(403).json({ ok: false, error: "forbidden" }));
  app.get("/api/sales-analysis/range", async (_req, res) => {
    const result = await pool.query(`SELECT MIN(delivery_confirmed_date)::text delivered_date_min,MAX(delivery_confirmed_date)::text delivered_date_max FROM pos_sales WHERE delivery_confirmed_date IS NOT NULL`);
    const row = result.rows[0] || {};
    res.json({ deliveredDateMin: dateOnly(row.delivered_date_min) || null, deliveredDateMax: dateOnly(row.delivered_date_max) || null });
  });

  const report = async (req: Request, res: any) => {
    const start = ymd(req.query.start), endExclusive = ymd(req.query.end_exclusive);
    const page = Number(req.query.page || 1), pageSize = Number(req.query.page_size || 100);
    if (!start || !endExclusive || start >= endExclusive || !Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) return res.status(400).json({ error: "invalid_sales_analysis_filters" });
    const salesperson = typeof req.query.salesperson === "string" && req.query.salesperson.trim() ? req.query.salesperson.trim().toLowerCase() : null;
    const values: any[] = [start, endExclusive, salesperson];
    let where = "";
    const addExact = (column: string, value: unknown) => { if (typeof value === "string" && value.trim()) { values.push(value.trim().toLowerCase()); where += ` AND lower(trim(${column}))=$${values.length}`; } };
    addExact("COALESCE(i.manufacturer,'(unknown)')", req.query.manufacturer); addExact("COALESCE(i.location,s.location,'(unknown)')", req.query.store);
    addExact("COALESCE(i.category,'(unknown)')", req.query.category); addExact("COALESCE(i.item_no,'(unknown)')", req.query.item);
    const limitIndex = values.length + 1, offsetIndex = values.length + 2;
    try {
      const [summaryResult, seriesResult, countResult, pageResult] = await Promise.all([
        pool.query(SUMMARY_SQL(where), values), pool.query(SERIES_SQL(where), values), pool.query(COUNT_SQL(where), values),
        pool.query(DETAIL_SQL(where, limitIndex, offsetIndex), [...values, pageSize, (page - 1) * pageSize]),
      ]);
      const a = summaryResult.rows[0] || {}, itemSales = num(a.item_sales), known = num(a.known_cost_sales), profit = num(a.profit), eligible = num(a.eligible_sales), proSales = num(a.pro_sales);
      const filters = { start, endExclusive, page, pageSize, salesperson: salesperson || undefined, manufacturer: req.query.manufacturer, store: req.query.store, category: req.query.category, item: req.query.item };
      return res.json({ filters, summary: { itemSales: round(itemSales), ticketTotal: round(num(a.ticket_total)), ticketCount: round(num(a.ticket_count)), itemCount: num(a.item_count), quantity: round(num(a.quantity)), knownCostSales: round(known), cost: round(num(a.cost)), profit: round(profit), marginPct: known ? round(profit / known * 100) : null, costCoveragePct: itemSales ? round(known / itemSales * 100) : null, financeAmount: round(num(a.finance_amount)), financeFee: round(num(a.finance_fee)), financedTicketCount: round(num(a.financed_ticket_count)) },
        pro1st: { sales: round(proSales), eligibleSales: round(eligible), penetrationPct: eligible ? round(proSales / eligible * 100) : null }, series: mapSeries(seriesResult.rows),
        warnings: { duplicateItemLines: num(a.duplicate_lines), openDeliveredTickets: num(a.open_tickets), twoPersonTickets: num(a.two_person_tickets), itemTicketDifference: round(itemSales - num(a.unallocated_ticket_total)) }, missingCosts: { count: num(a.missing_costs) },
        detail: { total: num(countResult.rows[0]?.total), page, pageSize, rows: pageResult.rows.map((row: any) => ({ deliveredDate: dateOnly(row.delivered_date), saleId: String(row.sale_id), status: String(row.status), store: String(row.store), salesperson: String(row.salesperson), manufacturer: String(row.manufacturer), category: String(row.category), itemNo: String(row.item_no), description: String(row.description), quantity: round(num(row.quantity)), sales: round(num(row.sales)), cost: nullableNum(row.cost), profit: nullableNum(row.profit), costSource: row.cost == null || row.profit == null ? "unknown" : String(row.cost_source), duplicateWarning: Boolean(row.duplicate_warning) })) } });
    } catch (error: any) { return res.status(400).json({ error: String(error?.message || "invalid_sales_analysis_filters") }); }
  };
  app.get("/api/sales-analysis/report", report); app.get("/api/sales-analysis/detail", report); app.get("/api/sales-analysis/direct", report);

  app.get("/api/sales-analysis/admin/cost-overrides", async (req, res) => { if (!isAdmin(req)) return res.status(403).json({ error: "forbidden" }); const page = Math.max(1, Number(req.query.page || 1)), pageSize = Math.min(100, Math.max(1, Number(req.query.page_size || 50))); const [count, result] = await Promise.all([pool.query(`SELECT COUNT(*)::text total FROM sales_cost_override_history`), pool.query(`SELECT id,store,sale_id,row_id,total_cost,reason,actor_user_id,created_at,superseded_at FROM sales_cost_override_history ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`, [pageSize, (page - 1) * pageSize])]); res.json({ total: Number(count.rows[0]?.total || 0), page, pageSize, rows: result.rows }); });
  app.post("/api/sales-analysis/admin/cost-overrides", async (req, res) => { if (!isAdmin(req) || !sameOrigin(req)) return res.status(403).json({ error: "forbidden" }); const { store, saleId, rowId, totalCost, reason } = req.body || {}; if (![store, saleId, rowId, reason].every((v) => typeof v === "string" && v.trim()) || !Number.isFinite(Number(totalCost)) || Number(totalCost) < 0) return res.status(400).json({ error: "invalid_cost_override" }); const actorUserId = Number((req as any).authUser.id); if (!Number.isSafeInteger(actorUserId) || actorUserId < 1) return res.status(400).json({ error: "invalid_actor" }); const result = await pool.query(`SELECT * FROM replace_sales_cost_override($1,$2,$3,$4,$5,$6)`, [store.trim(), saleId.trim(), rowId.trim(), Number(totalCost), reason.trim(), actorUserId]); res.json(result.rows[0]); });
}
