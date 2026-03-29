import type { Express } from "express";
import type { Pool } from "pg";
import { parseDateParam, parseTextParam } from "../parsers";
import { buildQualifiedPro1stSql } from "../pro1stSql";
import { registerItemProRoutes } from "./itemProRoutes";

type RegisterSalesDetailRoutesDeps = {
  app: Express;
  pool: Pool;
  itemDateField: string;
  prefixedDateField: (tableAlias: string) => string;
};

export function registerSalesDetailRoutes({
  app,
  pool,
  itemDateField,
  prefixedDateField,
}: RegisterSalesDetailRoutesDeps) {
  const pro1stItemSql = buildQualifiedPro1stSql();

  // All tickets for a salesperson within a date range (for detail drill-down)
  app.get("/api/salesperson-tickets", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);
    const limit = Math.min(Number(req.query.limit || 2000), 10000);
    if (!salespersonQ) {
      return res.status(400).json({ error: "salesperson is required" });
    }

    const sql = `
    WITH item_totals AS (
      SELECT
        sale_id,
        SUM(CASE WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0 ELSE total_sale_price END)::numeric AS item_sales,
        SUM(CASE WHEN total_profit IS NULL OR total_profit <> total_profit THEN 0 ELSE total_profit END)::numeric AS item_profit
      FROM pos_sale_items
      WHERE ${itemDateField} >= $1
        AND ${itemDateField} < $2
        AND sale_id IS NOT NULL
        AND sale_id <> ''
      GROUP BY sale_id
    ),
    pro_items AS (
      SELECT
        sale_id,
        SUM(
          CASE
            WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0
            ELSE total_sale_price
          END
        )::numeric AS pro_sales
      FROM pos_sale_items
      WHERE ${itemDateField} >= $1
        AND ${itemDateField} < $2
        AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
        AND ($3::text IS NULL OR sale_id IN (SELECT sale_id FROM pos_sales WHERE salesperson ILIKE ('%' || $3 || '%')))
        AND ${pro1stItemSql}
        AND sale_id IS NOT NULL
        AND sale_id <> ''
      GROUP BY sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*)::int AS people_count
      FROM pos_sales_people
      GROUP BY sale_id
    )
    SELECT
      p.sale_id,
      s.delivery_confirmed_date AS sale_date,
      p.salesperson,
      COALESCE(p.location, s.location) AS location,
      s.receipt_no,
      s.customer_name,
      p.grand_total_split::numeric AS grand_total,
      (COALESCE(item_totals.item_profit, 0) / NULLIF(people_counts.people_count, 0))::numeric AS profit,
      (
        CASE
          WHEN item_totals.item_sales IS NULL
            OR item_totals.item_sales = 0
            OR item_totals.item_sales <> item_totals.item_sales THEN NULL
          ELSE (COALESCE(item_totals.item_profit, 0) / item_totals.item_sales) * 100
        END
      )::numeric AS margin_pct,
      ROUND(
        COALESCE(pro_items.pro_sales, 0) / NULLIF(people_counts.people_count, 0),
        2
      )::numeric AS pro1st_sales,
      (
        CASE
          WHEN p.grand_total_split IS NULL OR p.grand_total_split = 0 OR p.grand_total_split <> p.grand_total_split THEN NULL
          ELSE (COALESCE(pro_items.pro_sales, 0) / NULLIF(people_counts.people_count, 0) / p.grand_total_split) * 100
        END
      )::numeric AS pro1st_pct,
      s.raw_source_file
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    LEFT JOIN item_totals ON item_totals.sale_id = p.sale_id
    LEFT JOIN pro_items ON pro_items.sale_id = p.sale_id
    LEFT JOIN people_counts ON people_counts.sale_id = p.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND p.salesperson ILIKE ('%' || $3 || '%')
      AND ($4::text IS NULL OR COALESCE(p.location, s.location) ILIKE ('%' || $4 || '%'))
    ORDER BY ${prefixedDateField("s")} DESC, p.sale_id DESC
    LIMIT $5;
  `;

    const r = await pool.query(sql, [start, end, salespersonQ, locationQ, limit]);
    res.json({
      start,
      end,
      limit,
      rows: r.rows.map((x: any) => ({
        sale_id: x.sale_id,
        sale_date: x.sale_date,
        salesperson: x.salesperson,
        location: x.location,
        receipt_no: x.receipt_no,
        customer_name: x.customer_name,
        grand_total: x.grand_total,
        profit: x.profit,
        margin_pct: x.margin_pct,
        pro1st_sales: Number(x.pro1st_sales ?? 0),
        pro1st_pct: x.pro1st_pct === null || x.pro1st_pct === undefined ? null : Number(x.pro1st_pct),
        raw_source_file: x.raw_source_file,
      })),
    });
  });

  // Bulk lookup salespeople by sale_id
  app.post("/api/sales/by-ids", async (req, res) => {
    const ids = Array.isArray(req.body?.sale_ids) ? req.body.sale_ids : [];
    const clean = ids
      .map((x: any) => String(x || "").trim())
      .filter((x: string) => x);
    if (!clean.length) {
      return res.json({ rows: [] });
    }
    const r = await pool.query(
      `
    SELECT sale_id, salesperson
    FROM pos_sales
    WHERE sale_id = ANY($1);
    `,
      [clean]
    );
    res.json({
      rows: r.rows.map((x: any) => ({
        sale_id: x.sale_id,
        salesperson: x.salesperson,
      })),
    });
  });

  // Finance summary for a date range
  // Note: `end` is treated as exclusive.
  app.get("/api/finance-summary", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);

    const sql = `
    SELECT
      COUNT(DISTINCT pos_sales_people.sale_id)::int AS lines,
      COUNT(DISTINCT CASE WHEN (total_finance_amt_split > 0 OR finance_balance_split > 0) THEN pos_sales_people.sale_id END)::int AS financed_lines,
      ROUND(SUM(total_finance_amt_split)::numeric, 2) AS financed_amount,
      ROUND(SUM(finance_fee_split)::numeric, 2) AS finance_fee,
      ROUND(SUM(finance_balance_split)::numeric, 2) AS finance_balance
    FROM pos_sales_people
    JOIN pos_sales s ON s.sale_id = pos_sales_people.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR pos_sales_people.salesperson ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR pos_sales_people.location ILIKE ('%' || $4 || '%'));
  `;

    const r = await pool.query(sql, [start, end, salespersonQ, locationQ]);
    res.json({ start, end, ...r.rows[0] });
  });

  registerItemProRoutes({ app, pool, itemDateField, prefixedDateField });
}
