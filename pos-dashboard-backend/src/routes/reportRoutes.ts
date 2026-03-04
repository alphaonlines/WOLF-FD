import type { Express } from "express";
import type { Pool } from "pg";
import { parseDateParam, parseTextParam } from "../parsers";

type RegisterReportRoutesDeps = {
  app: Express;
  pool: Pool;
  prefixedDateField: (tableAlias: string) => string;
};

export function registerReportRoutes({ app, pool, prefixedDateField }: RegisterReportRoutesDeps) {
  // Sales report (totals by salesperson or store, with item filters)
  app.get("/api/report/sales-summary", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const dimensionRaw = typeof req.query.dimension === "string" ? req.query.dimension.trim().toLowerCase() : "salesperson";
    const dimension = dimensionRaw === "store" ? "store" : "salesperson";
    const salespersonQ = parseTextParam(req.query.salesperson);
    const locationQ = parseTextParam(req.query.location);
    const categoryQ = parseTextParam(req.query.category);
    const manufacturerQ = parseTextParam(req.query.manufacturer);

    const baseParams = [start, end, locationQ, categoryQ, salespersonQ, manufacturerQ];
    const categoriesParams = [start, end, locationQ, salespersonQ, manufacturerQ];
    const manufacturerParams = [start, end, locationQ, categoryQ, salespersonQ];

    const categoriesSql = `
      WITH salesperson_sales AS (
        SELECT DISTINCT sale_id
        FROM pos_sales_people
        WHERE salesperson ILIKE ('%' || $4::text || '%')
      )
      SELECT DISTINCT category
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3::text || '%'))
        AND ($4::text IS NULL OR i.sale_id IN (SELECT sale_id FROM salesperson_sales))
        AND ($5::text IS NULL OR i.manufacturer ILIKE ('%' || $5::text || '%'))
        AND i.category IS NOT NULL
        AND i.category <> ''
      ORDER BY category ASC;
    `;

    const manufacturersSql = `
      WITH salesperson_sales AS (
        SELECT DISTINCT sale_id
        FROM pos_sales_people
        WHERE salesperson ILIKE ('%' || $5::text || '%')
      )
      SELECT DISTINCT manufacturer
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3::text || '%'))
        AND ($5::text IS NULL OR i.sale_id IN (SELECT sale_id FROM salesperson_sales))
        AND ($4::text IS NULL OR i.category ILIKE ('%' || $4::text || '%'))
        AND i.manufacturer IS NOT NULL
        AND i.manufacturer <> ''
      ORDER BY manufacturer ASC;
    `;

    const salespersonSql = `
      WITH people_counts AS (
        SELECT sale_id, COUNT(*) as cnt FROM pos_sales_people GROUP BY sale_id
      ),
      salesperson_sales AS (
        SELECT DISTINCT sale_id
        FROM pos_sales_people
        WHERE salesperson ILIKE ('%' || $5::text || '%')
      ),
      item_rollup AS (
        SELECT i.sale_id,
          SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS sales,
          SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END) AS profit,
          SUM(CASE WHEN i.qty_sold IS NULL OR i.qty_sold <> i.qty_sold THEN 0 ELSE i.qty_sold END) AS qty
        FROM pos_sale_items i
        JOIN pos_sales s ON s.sale_id = i.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
          AND ($3::text IS NULL OR s.location ILIKE ('%' || $3::text || '%'))
          AND ($4::text IS NULL OR i.category ILIKE ('%' || $4::text || '%'))
          AND ($6::text IS NULL OR i.manufacturer ILIKE ('%' || $6::text || '%'))
          AND ($5::text IS NULL OR i.sale_id IN (SELECT sale_id FROM salesperson_sales))
        GROUP BY i.sale_id
      ),
      ticket_splits AS (
        SELECT
          p.salesperson,
          p.location,
          p.sale_id,
          COALESCE(item_rollup.sales, 0) / NULLIF(pc.cnt, 0) AS sales,
          COALESCE(item_rollup.profit, 0) / NULLIF(pc.cnt, 0) AS profit,
          COALESCE(item_rollup.qty, 0) / NULLIF(pc.cnt, 0) AS qty
        FROM pos_sales_people p
        JOIN pos_sales s ON s.sale_id = p.sale_id
        LEFT JOIN item_rollup ON item_rollup.sale_id = p.sale_id
        LEFT JOIN people_counts pc ON pc.sale_id = p.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
          AND p.salesperson IS NOT NULL
          AND p.salesperson <> 'Sales, Store'
          AND ($5::text IS NULL OR p.salesperson ILIKE ('%' || $5::text || '%'))
          AND ($3::text IS NULL OR p.location ILIKE ('%' || $3::text || '%'))
      )
      SELECT
        salesperson AS label,
        COUNT(*)::int AS ticket_count,
        ROUND(SUM(sales)::numeric, 2) AS total_retail,
        ROUND(SUM(qty)::numeric, 2) AS units,
        ROUND(AVG(CASE WHEN sales > 0 THEN (profit / sales) * 100 ELSE NULL END)::numeric, 2) AS avg_margin_pct
      FROM ticket_splits
      GROUP BY 1
      ORDER BY total_retail DESC NULLS LAST;
    `;

    const storeSql = `
      WITH salesperson_sales AS (
        SELECT DISTINCT sale_id
        FROM pos_sales_people
        WHERE salesperson ILIKE ('%' || $5::text || '%')
      ),
      item_rollup AS (
        SELECT i.sale_id,
          SUM(CASE WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0 ELSE i.total_sale_price END) AS sales,
          SUM(CASE WHEN i.total_profit IS NULL OR i.total_profit <> i.total_profit THEN 0 ELSE i.total_profit END) AS profit,
          SUM(CASE WHEN i.qty_sold IS NULL OR i.qty_sold <> i.qty_sold THEN 0 ELSE i.qty_sold END) AS qty
        FROM pos_sale_items i
        JOIN pos_sales s ON s.sale_id = i.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
          AND ($3::text IS NULL OR s.location ILIKE ('%' || $3::text || '%'))
          AND ($4::text IS NULL OR i.category ILIKE ('%' || $4::text || '%'))
          AND ($6::text IS NULL OR i.manufacturer ILIKE ('%' || $6::text || '%'))
          AND ($5::text IS NULL OR i.sale_id IN (SELECT sale_id FROM salesperson_sales))
        GROUP BY i.sale_id
      ),
      tickets AS (
        SELECT
          COALESCE(s.location, '(unknown)') AS location,
          s.sale_id,
          COALESCE(item_rollup.sales, 0) AS sales,
          COALESCE(item_rollup.profit, 0) AS profit,
          COALESCE(item_rollup.qty, 0) AS qty
        FROM pos_sales s
        LEFT JOIN item_rollup ON item_rollup.sale_id = s.sale_id
        WHERE ${prefixedDateField("s")} >= $1
          AND ${prefixedDateField("s")} < $2
          AND ($3::text IS NULL OR s.location ILIKE ('%' || $3::text || '%'))
          AND ($5::text IS NULL OR s.sale_id IN (SELECT sale_id FROM salesperson_sales))
      )
      SELECT
        location AS label,
        COUNT(*)::int AS ticket_count,
        ROUND(SUM(sales)::numeric, 2) AS total_retail,
        ROUND(SUM(qty)::numeric, 2) AS units,
        ROUND(AVG(CASE WHEN sales > 0 THEN (profit / sales) * 100 ELSE NULL END)::numeric, 2) AS avg_margin_pct
      FROM tickets
      GROUP BY 1
      ORDER BY total_retail DESC NULLS LAST;
    `;

    try {
      const [categoriesRes, manufacturersRes, rowsRes] = await Promise.all([
        pool.query(categoriesSql, categoriesParams),
        pool.query(manufacturersSql, manufacturerParams),
        pool.query(dimension === "store" ? storeSql : salespersonSql, baseParams),
      ]);

      res.json({
        start,
        end,
        dimension,
        rows: rowsRes.rows,
        availableCategories: categoriesRes.rows.map((r: any) => r.category).filter((v: any) => v),
        availableManufacturers: manufacturersRes.rows.map((r: any) => r.manufacturer).filter((v: any) => v),
      });
    } catch (err) {
      console.error("report sales-summary error", err);
      res.status(500).json({ error: "report sales-summary failed" });
    }
  });
}
