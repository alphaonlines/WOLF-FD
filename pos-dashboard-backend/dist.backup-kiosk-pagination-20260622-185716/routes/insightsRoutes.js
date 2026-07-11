"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInsightsRoutes = registerInsightsRoutes;
const parsers_1 = require("../parsers");
const sqlFields_1 = require("../sqlFields");
function registerInsightsRoutes({ app, pool, prefixedDateField, safeGrandTotal, safeProfit, safeTotalFinanceAmt, safeFinanceBalance, safeFinanceFee, }) {
    const ensureImportCoverageSql = `
    CREATE TABLE IF NOT EXISTS pos_import_coverage (
      id BIGSERIAL PRIMARY KEY,
      report_type TEXT NOT NULL,
      import_batch_id BIGINT,
      source_file TEXT,
      date_field TEXT NOT NULL,
      range_start DATE NOT NULL,
      range_end DATE NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      imported_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_import_coverage_unique
      ON pos_import_coverage(report_type, import_batch_id, source_file, date_field);
    CREATE INDEX IF NOT EXISTS idx_pos_import_coverage_lookup
      ON pos_import_coverage(report_type, date_field, range_start, range_end);
  `;
    // Available years present in data (for UI pickers)
    app.get("/api/available-years", async (req, res) => {
        const dateField = (0, sqlFields_1.dateFieldForBasis)(req.query.date_basis);
        const sql = `
    SELECT DISTINCT year FROM (
      SELECT EXTRACT(YEAR FROM ${dateField})::int AS year
      FROM pos_sales
      WHERE ${dateField} IS NOT NULL
    ) years
    ORDER BY year;
  `;
        const r = await pool.query(sql);
        res.json({ years: r.rows.map((x) => x.year) });
    });
    // Outlier sales (by grand_total) for a date range using IQR.
    // Note: `end` is treated as exclusive.
    app.get("/api/outliers", async (req, res) => {
        const start = (0, parsers_1.parseDateParam)(req.query.start, "1900-01-01");
        const end = (0, parsers_1.parseDateParam)(req.query.end, "2100-01-01");
        const limit = Math.min(Number(req.query.limit || 25), 200);
        const salespersonQ = (0, parsers_1.parseTextParam)(req.query.salesperson);
        const multiplier = Number(req.query.multiplier || 1.5);
        const dateField = (0, sqlFields_1.dateFieldForBasis)(req.query.date_basis);
        const sql = `
    WITH s AS (
      SELECT
        sale_id,
        ${dateField} AS sale_date,
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
    WHERE ${dateField} >= $1
      AND ${dateField} < $2
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
        const rows = r.rows.map((x) => ({
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
    // Coverage check: missing delivery-date days for sales vs item exports.
    app.get("/api/import/coverage-months", async (_req, res) => {
        const startFloor = "2024-06-01";
        await pool.query(ensureImportCoverageSql);
        const sql = `
    WITH bounds AS (
      SELECT $1::date AS start_date, CURRENT_DATE::date AS end_date
    ),
    persisted_sales_ranges AS (
      SELECT range_start, range_end
      FROM pos_import_coverage
      WHERE report_type = 'sales'
        AND date_field = 'delivery_confirmed_date'
        AND range_end >= $1
    ),
    persisted_item_ranges AS (
      SELECT range_start, range_end
      FROM pos_import_coverage
      WHERE report_type = 'items'
        AND date_field = 'delivery_confirmed_date'
        AND range_end >= $1
    ),
    derived_sales_ranges AS (
      SELECT
        MIN(delivery_confirmed_date)::date AS range_start,
        MAX(delivery_confirmed_date)::date AS range_end
      FROM pos_sales
      WHERE sale_id IS NOT NULL
        AND sale_id <> ''
        AND delivery_confirmed_date IS NOT NULL
        AND delivery_confirmed_date >= $1
      GROUP BY last_import_batch_id, raw_source_file
    ),
    derived_item_ranges AS (
      SELECT
        MIN(delivery_confirmed_date)::date AS range_start,
        MAX(delivery_confirmed_date)::date AS range_end
      FROM pos_sale_items
      WHERE sale_id IS NOT NULL
        AND sale_id <> ''
        AND delivery_confirmed_date IS NOT NULL
        AND delivery_confirmed_date >= $1
      GROUP BY import_batch_id, raw_source_file
    ),
    sales_ranges AS (
      SELECT range_start, range_end FROM persisted_sales_ranges
      UNION
      SELECT range_start, range_end FROM derived_sales_ranges
    ),
    item_ranges AS (
      SELECT range_start, range_end FROM persisted_item_ranges
      UNION
      SELECT range_start, range_end FROM derived_item_ranges
    ),
    sales_days AS (
      SELECT DISTINCT generate_series(
        GREATEST(range_start, (SELECT start_date FROM bounds)),
        LEAST(range_end, (SELECT end_date FROM bounds)),
        interval '1 day'
      )::date AS day
      FROM sales_ranges
      WHERE range_start IS NOT NULL
        AND range_end IS NOT NULL
        AND range_start <= range_end
        AND GREATEST(range_start, (SELECT start_date FROM bounds)) <= LEAST(range_end, (SELECT end_date FROM bounds))
    ),
    items_days AS (
      SELECT DISTINCT generate_series(
        GREATEST(range_start, (SELECT start_date FROM bounds)),
        LEAST(range_end, (SELECT end_date FROM bounds)),
        interval '1 day'
      )::date AS day
      FROM item_ranges
      WHERE range_start IS NOT NULL
        AND range_end IS NOT NULL
        AND range_start <= range_end
        AND GREATEST(range_start, (SELECT start_date FROM bounds)) <= LEAST(range_end, (SELECT end_date FROM bounds))
    ),
    days AS (
      SELECT generate_series((SELECT start_date FROM bounds), (SELECT end_date FROM bounds), interval '1 day')::date AS day
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
    ),
    missing_sales_months AS (
      SELECT
        to_char(date_trunc('month', day), 'YYYY-MM') AS month,
        COUNT(*)::int AS missing_days
      FROM missing_sales_days
      GROUP BY 1
    ),
    missing_item_months AS (
      SELECT
        to_char(date_trunc('month', day), 'YYYY-MM') AS month,
        COUNT(*)::int AS missing_days
      FROM missing_item_days
      GROUP BY 1
    )
    SELECT
      ARRAY(
        SELECT month
        FROM missing_item_months
        ORDER BY month DESC
      ) AS missing_items_months,
      ARRAY(
        SELECT month
        FROM missing_sales_months
        ORDER BY month DESC
      ) AS missing_sales_months,
      COALESCE((
        SELECT json_agg(json_build_object('month', month, 'missingDays', missing_days) ORDER BY month DESC)
        FROM missing_sales_months
      ), '[]'::json) AS missing_sales_month_details,
      COALESCE((
        SELECT json_agg(json_build_object('month', month, 'missingDays', missing_days) ORDER BY month DESC)
        FROM missing_item_months
      ), '[]'::json) AS missing_item_month_details,
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
            missingSalesMonthDetails: Array.isArray(row.missing_sales_month_details) ? row.missing_sales_month_details : [],
            missingItemMonthDetails: Array.isArray(row.missing_item_month_details) ? row.missing_item_month_details : [],
            missingSalesDays: Array.isArray(row.missing_sales_days) ? row.missing_sales_days : [],
            missingItemDays: Array.isArray(row.missing_item_days) ? row.missing_item_days : [],
            missingSalesDaysCount: Number(row.missing_sales_days_count ?? 0),
            missingItemDaysCount: Number(row.missing_item_days_count ?? 0),
        });
    });
    // Weekly trend (sales + profit)
    app.get("/api/sales-weekly", async (req, res) => {
        const start = (0, parsers_1.parseDateParam)(req.query.start, "1900-01-01");
        const end = (0, parsers_1.parseDateParam)(req.query.end, "2100-01-01");
        const locationQ = (0, parsers_1.parseTextParam)(req.query.location);
        const prefixedDateField = (tableAlias) => (0, sqlFields_1.prefixedDateFieldForBasis)(req.query.date_basis, tableAlias);
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
    )
    SELECT
      date_trunc('week', ${prefixedDateField("s")})::date AS week,
      ROUND(SUM(COALESCE(item_rollup.item_sales, 0))::numeric, 2) AS sales,
      ROUND(SUM(COALESCE(item_rollup.item_profit, 0))::numeric, 2) AS profit
    FROM pos_sales s
    LEFT JOIN item_rollup ON item_rollup.sale_id = s.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR location ILIKE ('%' || $3 || '%'))
    GROUP BY 1
    ORDER BY 1;
  `;
        const r = await pool.query(sql, [start, end, locationQ]);
        res.json({ start, end, rows: r.rows });
    });
    // Daily trend (sales + profit)
    app.get("/api/sales-daily", async (req, res) => {
        const start = (0, parsers_1.parseDateParam)(req.query.start, "1900-01-01");
        const end = (0, parsers_1.parseDateParam)(req.query.end, "2100-01-01");
        const salespersonQ = (0, parsers_1.parseTextParam)(req.query.salesperson);
        const locationQ = (0, parsers_1.parseTextParam)(req.query.location);
        const prefixedDateField = (tableAlias) => (0, sqlFields_1.prefixedDateFieldForBasis)(req.query.date_basis, tableAlias);
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
        const start = (0, parsers_1.parseDateParam)(req.query.start, "1900-01-01");
        const end = (0, parsers_1.parseDateParam)(req.query.end, "2100-01-01");
        const salespersonQ = (0, parsers_1.parseTextParam)(req.query.salesperson);
        const locationQ = (0, parsers_1.parseTextParam)(req.query.location);
        const prefixedDateField = (tableAlias) => (0, sqlFields_1.prefixedDateFieldForBasis)(req.query.date_basis, tableAlias);
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
//# sourceMappingURL=insightsRoutes.js.map