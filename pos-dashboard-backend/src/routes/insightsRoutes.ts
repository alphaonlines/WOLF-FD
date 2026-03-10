import type { Express } from "express";
import type { Pool } from "pg";
import { parseDateParam, parseTextParam } from "../parsers";

type RegisterInsightsRoutesDeps = {
  app: Express;
  pool: Pool;
  prefixedDateField: (tableAlias: string) => string;
  safeGrandTotal: string;
  safeProfit: string;
  safeTotalFinanceAmt: string;
  safeFinanceBalance: string;
  safeFinanceFee: string;
};

export function registerInsightsRoutes({
  app,
  pool,
  prefixedDateField,
  safeGrandTotal,
  safeProfit,
  safeTotalFinanceAmt,
  safeFinanceBalance,
  safeFinanceFee,
}: RegisterInsightsRoutesDeps) {
  // Available years present in data (for UI pickers)
  app.get("/api/available-years", async (_req, res) => {
    const sql = `
    SELECT DISTINCT year FROM (
      SELECT EXTRACT(YEAR FROM delivery_confirmed_date)::int AS year
      FROM pos_sales
      WHERE delivery_confirmed_date IS NOT NULL
    ) years
    ORDER BY year;
  `;
    const r = await pool.query(sql);
    res.json({ years: r.rows.map((x) => x.year) });
  });

  // Outlier sales (by grand_total) for a date range using IQR.
  // Note: `end` is treated as exclusive.
  app.get("/api/outliers", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limit = Math.min(Number(req.query.limit || 25), 200);
    const salespersonQ = parseTextParam(req.query.salesperson);
    const multiplier = Number(req.query.multiplier || 1.5);

    const sql = `
    WITH s AS (
      SELECT
        sale_id,
        delivery_confirmed_date AS sale_date,
        salesperson,
        location,
        receipt_no,
        customer_name,
        ${safeGrandTotal}::numeric AS grand_total,
        ${safeProfit}::numeric AS profit,
        ${safeTotalFinanceAmt}::numeric AS total_finance_amt,
        ${safeFinanceBalance}::numeric AS finance_balance,
        ${safeFinanceFee}::numeric AS finance_fee,
        raw_source_file
      FROM pos_sales
    WHERE delivery_confirmed_date >= $1
      AND delivery_confirmed_date < $2
        AND ($4::text IS NULL OR salesperson ILIKE ('%' || $4 || '%'))
    ),
    stats AS (
      SELECT
        percentile_cont(0.25) WITHIN GROUP (ORDER BY grand_total) AS q1,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY grand_total) AS q3,
        COUNT(*)::int AS n
      FROM s
    ),
    bounds AS (
      SELECT
        q1,
        q3,
        (q3 - q1) AS iqr,
        (q3 + ($5::numeric * (q3 - q1))) AS hi,
        n
      FROM stats
    ),
    flagged AS (
      SELECT
        s.*,
        b.hi AS threshold_high,
        COUNT(*) OVER ()::int AS total_count
      FROM s
      CROSS JOIN bounds b
      WHERE b.n >= 20
        AND s.grand_total > b.hi
      ORDER BY s.grand_total DESC
      LIMIT $3
    )
    SELECT * FROM flagged;
  `;

    const r = await pool.query(sql, [start, end, limit, salespersonQ, Number.isFinite(multiplier) ? multiplier : 1.5]);
    const thresholdHigh = r.rows.length ? Number(r.rows[0].threshold_high ?? 0) : null;
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
      total_finance_amt: x.total_finance_amt,
      finance_balance: x.finance_balance,
      finance_fee: x.finance_fee,
      raw_source_file: x.raw_source_file,
    }));
    res.json({ start, end, limit, threshold_high: thresholdHigh, total_count: totalCount, rows });
  });

  // Coverage check: missing months for sales vs items (sale months)
  app.get("/api/import/coverage-months", async (_req, res) => {
    const startFloor = "2024-06-01";
    const sql = `
    WITH bounds AS (
      SELECT $1::date AS start_date, CURRENT_DATE::date AS end_date
    ),
    sales AS (
      SELECT sale_id, sale_date AS dt
      FROM pos_sales
      WHERE sale_id IS NOT NULL
        AND sale_id <> ''
        AND sale_date IS NOT NULL
        AND sale_date >= $1
    ),
    items AS (
      SELECT sale_id, sale_date AS dt
      FROM pos_sale_items
      WHERE sale_id IS NOT NULL
        AND sale_id <> ''
        AND sale_date IS NOT NULL
        AND sale_date >= $1
    ),
    sales_days AS (
      SELECT DISTINCT date_trunc('day', dt)::date AS day
      FROM sales
      WHERE dt IS NOT NULL
    ),
    items_days AS (
      SELECT DISTINCT date_trunc('day', dt)::date AS day
      FROM items
      WHERE dt IS NOT NULL
    ),
    days AS (
      SELECT generate_series((SELECT start_date FROM bounds), (SELECT end_date FROM bounds), interval '1 day')::date AS day
    ),
    sales_only AS (
      SELECT s.sale_id, s.dt
      FROM sales s
      LEFT JOIN items i ON i.sale_id = s.sale_id
      WHERE i.sale_id IS NULL AND s.dt IS NOT NULL
    ),
    items_only AS (
      SELECT i.sale_id, i.dt
      FROM items i
      LEFT JOIN sales s ON s.sale_id = i.sale_id
      WHERE s.sale_id IS NULL AND i.dt IS NOT NULL
    ),
    missing_sales_days AS (
      SELECT d.day
      FROM days d
      LEFT JOIN sales_days s ON s.day = d.day
      WHERE s.day IS NULL
    ),
    missing_item_days AS (
      SELECT d.day
      FROM days d
      LEFT JOIN items_days i ON i.day = d.day
      WHERE i.day IS NULL
    )
    SELECT
      ARRAY(
        SELECT DISTINCT to_char(date_trunc('month', dt), 'YYYY-MM')
        FROM sales_only
        ORDER BY 1
      ) AS missing_items_months,
      ARRAY(
        SELECT DISTINCT to_char(date_trunc('month', dt), 'YYYY-MM')
        FROM items_only
        ORDER BY 1
      ) AS missing_sales_months,
      (SELECT COUNT(*)::int FROM missing_sales_days) AS missing_sales_days_count,
      (SELECT COUNT(*)::int FROM missing_item_days) AS missing_item_days_count,
      ARRAY(
        SELECT to_char(day, 'YYYY-MM-DD')
        FROM missing_sales_days
        ORDER BY day DESC
        LIMIT 120
      ) AS missing_sales_days,
      ARRAY(
        SELECT to_char(day, 'YYYY-MM-DD')
        FROM missing_item_days
        ORDER BY day DESC
        LIMIT 120
      ) AS missing_item_days,
      (SELECT start_date FROM bounds)::text AS start_date,
      (SELECT end_date FROM bounds)::text AS end_date;
  `;

    const r = await pool.query(sql, [startFloor]);
    const row = r.rows[0] || {};

    res.json({
      startDate: row.start_date,
      endDate: row.end_date,
      missingSalesMonths: Array.isArray(row.missing_sales_months) ? row.missing_sales_months : [],
      missingItemMonths: Array.isArray(row.missing_items_months) ? row.missing_items_months : [],
      missingSalesDays: Array.isArray(row.missing_sales_days) ? row.missing_sales_days : [],
      missingItemDays: Array.isArray(row.missing_item_days) ? row.missing_item_days : [],
      missingSalesDaysCount: Number(row.missing_sales_days_count ?? 0),
      missingItemDaysCount: Number(row.missing_item_days_count ?? 0),
    });
  });

  // Weekly trend (sales + profit)
  app.get("/api/sales-weekly", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const locationQ = parseTextParam(req.query.location);

    const sql = `
    WITH item_rollup AS (
      SELECT
        i.sale_id,
        SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS item_sales,
        SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END) AS item_profit
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE delivery_confirmed_date >= $1
        AND delivery_confirmed_date < $2
      GROUP BY i.sale_id
    )
    SELECT
      date_trunc('week', delivery_confirmed_date)::date AS week,
      ROUND(SUM(COALESCE(item_rollup.item_sales, 0))::numeric, 2) AS sales,
      ROUND(SUM(COALESCE(item_rollup.item_profit, 0))::numeric, 2) AS profit
    FROM pos_sales s
    LEFT JOIN item_rollup ON item_rollup.sale_id = s.sale_id
    WHERE delivery_confirmed_date >= $1
      AND delivery_confirmed_date < $2
      AND ($3::text IS NULL OR location ILIKE ('%' || $3 || '%'))
    GROUP BY 1
    ORDER BY 1;
  `;

    const r = await pool.query(sql, [start, end, locationQ]);
    res.json({ start, end, rows: r.rows });
  });

  // Daily trend (sales + profit)
  app.get("/api/sales-daily", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);

    const sql = salespersonQ
      ? `
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
        date_trunc('day', ${prefixedDateField("s")})::date AS day,
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
        AND p.salesperson ILIKE ('%' || $3 || '%')
        AND ($4::text IS NULL OR p.location ILIKE ('%' || $4 || '%'))
      GROUP BY 1
      ORDER BY 1;
    `
      : `
      WITH item_rollup AS (
        SELECT
          i.sale_id,
          SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS item_sales,
          SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END) AS item_profit
        FROM pos_sale_items i
        JOIN pos_sales s2 ON s2.sale_id = i.sale_id
        WHERE ${prefixedDateField("s2")} >= $1
          AND ${prefixedDateField("s2")} < $2
        GROUP BY i.sale_id
      )
      SELECT
        date_trunc('day', ${prefixedDateField("s")})::date AS day,
        COUNT(DISTINCT s.sale_id)::int AS lines,
        ROUND(SUM(COALESCE(item_rollup.item_sales, 0))::numeric, 2) AS sales,
        ROUND(SUM(COALESCE(item_rollup.item_profit, 0))::numeric, 2) AS profit
      FROM pos_sales s
      LEFT JOIN item_rollup ON item_rollup.sale_id = s.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
      GROUP BY 1
      ORDER BY 1;
    `;

    const r = salespersonQ
      ? await pool.query(sql, [start, end, salespersonQ, locationQ])
      : await pool.query(sql, [start, end, locationQ]);
    res.json({ start, end, rows: r.rows });
  });

  // Sales by location (bar chart)
  app.get("/api/sales-by-location", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);

    const sql = salespersonQ
      ? `
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
      COALESCE(p.location,'(unknown)') AS location,
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
      AND ($3::text IS NULL OR p.salesperson ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR p.location ILIKE ('%' || $4 || '%'))
    GROUP BY 1
    ORDER BY sales DESC;
  `
      : `
    WITH item_rollup AS (
      SELECT
        i.sale_id,
        SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS item_sales,
        SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END) AS item_profit
      FROM pos_sale_items i
      JOIN pos_sales s2 ON s2.sale_id = i.sale_id
      WHERE ${prefixedDateField("s2")} >= $1
        AND ${prefixedDateField("s2")} < $2
      GROUP BY i.sale_id
    )
    SELECT
      COALESCE(s.location,'(unknown)') AS location,
      ROUND(SUM(COALESCE(item_rollup.item_sales, 0))::numeric, 2) AS sales,
      ROUND(SUM(COALESCE(item_rollup.item_profit, 0))::numeric, 2) AS profit
    FROM pos_sales s
    LEFT JOIN item_rollup ON item_rollup.sale_id = s.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
    GROUP BY 1
    ORDER BY sales DESC;
  `;

    const r = salespersonQ
      ? await pool.query(sql, [start, end, salespersonQ, locationQ])
      : await pool.query(sql, [start, end, locationQ]);
    res.json({ start, end, rows: r.rows });
  });
}
