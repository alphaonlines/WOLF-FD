import type { Express } from "express";
import type { Pool } from "pg";
import { parseDateParam, parseTextParam } from "../parsers";

type RegisterAnalyticsRoutesDeps = {
  app: Express;
  pool: Pool;
  itemDateField: string;
  prefixedDateField: (tableAlias: string) => string;
};

export function registerAnalyticsRoutes({
  app,
  pool,
  itemDateField,
  prefixedDateField,
}: RegisterAnalyticsRoutesDeps) {
  // Lowest margin tickets per salesperson for a date range.
  // Uses pos_sales_people so split salespeople are handled fairly.
  // Note: `end` is treated as exclusive.
  app.get("/api/low-margin", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limitPer = Math.min(Number(req.query.limit_per || 5), 50);
    const limitTotal = Math.min(Number(req.query.limit_total || 200), 2000);
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);
    const categoryQ = parseTextParam(req.query.category);
    const manufacturerQ = parseTextParam(req.query.manufacturer);

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
          AND (category IS NULL OR category NOT ILIKE '%mattress%')
          AND ($5::text IS NULL OR category ILIKE ('%' || $5 || '%'))
          AND ($6::text IS NULL OR manufacturer ILIKE ('%' || $6 || '%'))
        GROUP BY sale_id
      ),
      people_counts AS (
        SELECT sale_id, COUNT(*)::int AS people_count
        FROM pos_sales_people
        GROUP BY sale_id
      ),
      s AS (
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
          (CASE WHEN p.total_finance_amt_split IS NULL OR p.total_finance_amt_split <> p.total_finance_amt_split THEN 0 ELSE p.total_finance_amt_split END)::numeric AS total_finance_amt,
          (CASE WHEN p.finance_balance_split IS NULL OR p.finance_balance_split <> p.finance_balance_split THEN 0 ELSE p.finance_balance_split END)::numeric AS finance_balance,
          (CASE WHEN p.finance_fee_split IS NULL OR p.finance_fee_split <> p.finance_fee_split THEN 0 ELSE p.finance_fee_split END)::numeric AS finance_fee,
          s.raw_source_file
        FROM pos_sales_people p
        JOIN pos_sales s ON s.sale_id = p.sale_id
        LEFT JOIN item_totals ON item_totals.sale_id = p.sale_id
        LEFT JOIN people_counts ON people_counts.sale_id = p.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
          AND p.salesperson IS NOT NULL
          AND p.salesperson <> ''
          AND p.salesperson <> 'Sales, Store'
          AND ($3::text IS NULL OR p.salesperson ILIKE ('%' || $3 || '%'))
          AND ($4::text IS NULL OR COALESCE(p.location, s.location) ILIKE ('%' || $4 || '%'))
      ),
          ranked AS (
            SELECT
              s.*,
              ROW_NUMBER() OVER (PARTITION BY salesperson ORDER BY margin_pct ASC) AS rn
            FROM s
            WHERE margin_pct BETWEEN -100 AND 100
          ),
          filtered AS (
            SELECT
              ranked.*,
              COUNT(*) OVER ()::int AS total_count
            FROM ranked
            WHERE rn <= $7
            ORDER BY margin_pct ASC NULLS LAST, profit ASC, grand_total DESC
            LIMIT $8
          )
      SELECT * FROM filtered;
    `;

    const r = await pool.query(sql, [start, end, salespersonQ, locationQ, categoryQ, manufacturerQ, limitPer, limitTotal]);
    const totalCount = r.rows.length ? Number(r.rows[0].total_count ?? r.rows.length) : 0;
    const rows = r.rows.map((x: any) => ({
      sale_id: x.sale_id,
      sale_date: x.sale_date,
      salesperson: x.salesperson,
      location: x.location,
      receipt_no: x.receipt_no,
      customer_name: x.customer_name,
      grand_total: x.grand_total,
      profit: x.profit,
      margin_pct: x.margin_pct,
      total_finance_amt: x.total_finance_amt,
      finance_balance: x.finance_balance,
      finance_fee: x.finance_fee,
      raw_source_file: x.raw_source_file,
    }));

    res.json({ start, end, limit_per: limitPer, limit_total: limitTotal, total_count: totalCount, rows });
  });

  // Summary totals for a date range
  // Note: `end` is treated as exclusive to match common analytics behavior.
  app.get("/api/summary", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);

    const sql = salespersonQ
      ? `
      WITH item_sales AS (
        SELECT i.sale_id, SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS item_sales
        FROM pos_sale_items i
        JOIN pos_sales s ON s.sale_id = i.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
        GROUP BY i.sale_id
      ),
      item_profits AS (
        SELECT sale_id, SUM(total_profit) as item_profit
        FROM pos_sale_items
        GROUP BY sale_id
      ),
      people_counts AS (
        SELECT sale_id, COUNT(*) as cnt FROM pos_sales_people GROUP BY sale_id
      )
      SELECT
        COUNT(DISTINCT p.sale_id)::int AS lines,
        ROUND(SUM(
          COALESCE(item_sales.item_sales / NULLIF(pc.cnt, 1), item_sales.item_sales, 0)
        )::numeric, 2) AS sales,
        ROUND(SUM(
          COALESCE(ip.item_profit / NULLIF(pc.cnt, 1), p.profit_split)
        )::numeric, 2) AS profit
      FROM pos_sales_people p
      JOIN pos_sales s ON s.sale_id = p.sale_id
      LEFT JOIN item_sales ON item_sales.sale_id = p.sale_id
      LEFT JOIN item_profits ip ON ip.sale_id = p.sale_id
      LEFT JOIN people_counts pc ON pc.sale_id = p.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR p.salesperson ILIKE ('%' || $3 || '%'))
        AND ($4::text IS NULL OR p.location ILIKE ('%' || $4 || '%'));
    `
      : `
      WITH item_rollup AS (
        SELECT
          i.sale_id,
          SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS item_sales,
          SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END) AS item_profit
        FROM pos_sale_items i
        JOIN pos_sales s ON s.sale_id = i.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
        GROUP BY i.sale_id
      )
      SELECT
        COUNT(DISTINCT s.sale_id)::int AS lines,
        ROUND(SUM(COALESCE(item_rollup.item_sales, 0))::numeric, 2) AS sales,
        ROUND(SUM(COALESCE(item_rollup.item_profit, 0))::numeric, 2) AS profit
      FROM pos_sales s
      LEFT JOIN item_rollup ON item_rollup.sale_id = s.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'));
    `;

    const r = salespersonQ
      ? await pool.query(sql, [start, end, salespersonQ, locationQ])
      : await pool.query(sql, [start, end, locationQ]);
    res.json({ start, end, ...r.rows[0] });
  });

  // Leaderboard (uses your split view)
  app.get("/api/leaderboard", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);

    const sql = `
      WITH item_rollup AS (
        SELECT
          i.sale_id,
          SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS item_sales,
          SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END) AS item_profit
        FROM pos_sale_items i
        JOIN pos_sales s ON s.sale_id = i.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
        GROUP BY i.sale_id
      ),
      item_profits AS (
        SELECT sale_id, SUM(total_profit) as item_profit
        FROM pos_sale_items
        GROUP BY sale_id
      ),
      people_counts AS (
        SELECT sale_id, COUNT(*) as cnt FROM pos_sales_people GROUP BY sale_id
      )
      SELECT
        p.salesperson,
        COUNT(*)::int AS lines,
        ROUND(SUM(COALESCE(item_rollup.item_sales, 0) / NULLIF(pc.cnt, 0))::numeric, 2) AS sales,
        ROUND(SUM(
          COALESCE(item_rollup.item_profit / NULLIF(pc.cnt, 1), ip.item_profit / NULLIF(pc.cnt, 1), p.profit_split)
        )::numeric, 2) AS profit
      FROM pos_sales_people p
      JOIN pos_sales s ON s.sale_id = p.sale_id
      LEFT JOIN item_rollup ON item_rollup.sale_id = p.sale_id
      LEFT JOIN item_profits ip ON ip.sale_id = p.sale_id
      LEFT JOIN people_counts pc ON pc.sale_id = p.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND p.salesperson IS NOT NULL
        AND p.salesperson <> 'Sales, Store'
        AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'))
        AND ($5::text IS NULL OR p.location ILIKE ('%' || $5 || '%'))
      GROUP BY 1
      ORDER BY sales DESC
      LIMIT $3;
    `;

    const r = await pool.query(sql, [start, end, limit, salespersonQ, locationQ]);
    res.json({ start, end, limit, rows: r.rows });
  });
}
