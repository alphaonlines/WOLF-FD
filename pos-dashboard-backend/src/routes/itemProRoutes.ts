import type { Express } from "express";
import type { Pool } from "pg";
import { parseDateParam, parseTextParam } from "../parsers";
import { buildPro1stExcludedSql, buildQualifiedPro1stSql } from "../pro1stSql";

type RegisterItemProRoutesDeps = {
  app: Express;
  pool: Pool;
  itemDateField: string;
  prefixedDateField: (tableAlias: string) => string;
};

export function registerItemProRoutes({
  app,
  pool,
  itemDateField,
  prefixedDateField,
}: RegisterItemProRoutesDeps) {
  const pro1stItemSql = buildQualifiedPro1stSql();
  const aliasedPro1stItemSql = buildQualifiedPro1stSql("i.");
  const aliasedExcludedPro1stSql = buildPro1stExcludedSql("i.");

  // Best sellers (items)
  app.get("/api/items/best-sellers", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limit = Math.min(Number(req.query.limit || 15), 100);
    const sort = String(req.query.sort || "sales").toLowerCase() === "qty" ? "qty" : "sales";
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);

    const orderBy = sort === "qty" ? "qty DESC NULLS LAST" : "sales DESC NULLS LAST";
    const sql = `
    WITH people_counts AS (
      SELECT sale_id, COUNT(*) as cnt FROM pos_sales_people GROUP BY sale_id
    ),
    salesperson_sales AS (
      SELECT DISTINCT sale_id
      FROM pos_sales_people
      WHERE salesperson ILIKE ('%' || $5::text || '%')
    )
    SELECT
      CASE
        WHEN ${pro1stItemSql}
        THEN 'Pro1st'
        ELSE item_description
      END AS item_description,
      CASE
        WHEN ${pro1stItemSql}
        THEN NULL
        ELSE category
      END AS category,
      CASE
        WHEN ${pro1stItemSql}
        THEN NULL
        ELSE manufacturer
      END AS manufacturer,
      CASE
        WHEN ${pro1stItemSql}
        THEN NULL
        ELSE item_no
      END AS item_no,
      ROUND(SUM(
        CASE
          WHEN qty_sold IS NULL OR qty_sold <> qty_sold THEN 0
          WHEN $5::text IS NULL THEN qty_sold
          ELSE qty_sold / NULLIF(pc.cnt, 0)
        END
      )::numeric, 2) AS qty,
      ROUND(SUM(
        CASE
          WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0
          WHEN $5::text IS NULL THEN total_sale_price
          ELSE total_sale_price / NULLIF(pc.cnt, 0)
        END
      )::numeric, 2) AS sales,
      ARRAY_AGG(DISTINCT pos_sale_items.sale_id) FILTER (WHERE pos_sale_items.sale_id IS NOT NULL AND pos_sale_items.sale_id <> '') AS sale_ids
    FROM pos_sale_items
    LEFT JOIN people_counts pc ON pc.sale_id = pos_sale_items.sale_id
    WHERE ${itemDateField} >= $1
      AND ${itemDateField} < $2
      AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
      AND ($5::text IS NULL OR pos_sale_items.sale_id IN (SELECT sale_id FROM salesperson_sales))
      AND item_description IS NOT NULL
      AND item_description <> ''
    GROUP BY
      CASE
        WHEN ${pro1stItemSql}
        THEN 'Pro1st'
        ELSE item_description
      END,
      CASE
        WHEN ${pro1stItemSql}
        THEN NULL
        ELSE category
      END,
      CASE
        WHEN ${pro1stItemSql}
        THEN NULL
        ELSE manufacturer
      END,
      CASE
        WHEN ${pro1stItemSql}
        THEN NULL
        ELSE item_no
      END
    ORDER BY ${orderBy}
    LIMIT $3;
  `;

    const r = await pool.query(sql, [start, end, limit, locationQ, salespersonQ]);
    res.json({
      start,
      end,
      limit,
      rows: r.rows.map((x: any) => ({
        item_description: x.item_description,
        category: x.category,
        manufacturer: x.manufacturer,
        item_no: x.item_no,
        qty: Number(x.qty ?? 0),
        sales: Number(x.sales ?? 0),
        sale_ids: Array.isArray(x.sale_ids) ? x.sale_ids : [],
      })),
    });
  });

  // Top categories (items)
  app.get("/api/items/by-category", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limit = Math.min(Number(req.query.limit || 10), 50);
    const sort = String(req.query.sort || "sales").toLowerCase() === "qty" ? "qty" : "sales";
    const orderBy = sort === "qty" ? "qty DESC NULLS LAST" : "sales DESC NULLS LAST";
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);

    const sql = `
    SELECT
      category,
      ROUND(SUM(CASE WHEN qty_sold IS NULL OR qty_sold <> qty_sold THEN 0 ELSE qty_sold END)::numeric, 2) AS qty,
      ROUND(SUM(CASE WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0 ELSE total_sale_price END)::numeric, 2) AS sales
    FROM pos_sale_items
    WHERE ${itemDateField} >= $1
      AND ${itemDateField} < $2
      AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
      AND ($5::text IS NULL OR sale_id IN (SELECT sale_id FROM pos_sales WHERE salesperson ILIKE ('%' || $5 || '%')))
      AND category IS NOT NULL
      AND category <> ''
    GROUP BY category
    ORDER BY ${orderBy}
    LIMIT $3;
  `;

    const r = await pool.query(sql, [start, end, limit, locationQ, salespersonQ]);
    res.json({
      start,
      end,
      limit,
      rows: r.rows.map((x: any) => ({
        category: x.category,
        qty: Number(x.qty ?? 0),
        sales: Number(x.sales ?? 0),
      })),
    });
  });

  // Top manufacturers (items)
  app.get("/api/items/by-manufacturer", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limit = Math.min(Number(req.query.limit || 10), 50);
    const sort = String(req.query.sort || "sales").toLowerCase() === "qty" ? "qty" : "sales";
    const orderBy = sort === "qty" ? "qty DESC NULLS LAST" : "sales DESC NULLS LAST";
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);

    const sql = `
    SELECT
      manufacturer,
      ROUND(SUM(CASE WHEN qty_sold IS NULL OR qty_sold <> qty_sold THEN 0 ELSE qty_sold END)::numeric, 2) AS qty,
      ROUND(SUM(CASE WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0 ELSE total_sale_price END)::numeric, 2) AS sales
    FROM pos_sale_items
    WHERE ${itemDateField} >= $1
      AND ${itemDateField} < $2
      AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
      AND ($5::text IS NULL OR sale_id IN (SELECT sale_id FROM pos_sales WHERE salesperson ILIKE ('%' || $5 || '%')))
      AND manufacturer IS NOT NULL
      AND manufacturer <> ''
    GROUP BY manufacturer
    ORDER BY ${orderBy}
    LIMIT $3;
  `;

    const r = await pool.query(sql, [start, end, limit, locationQ, salespersonQ]);
    res.json({
      start,
      end,
      limit,
      rows: r.rows.map((x: any) => ({
        manufacturer: x.manufacturer,
        qty: Number(x.qty ?? 0),
        sales: Number(x.sales ?? 0),
      })),
    });
  });

  // Top items for a specific category
  app.get("/api/items/category-top-items", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limit = Math.min(Number(req.query.limit || 10), 50);
    const category = parseTextParam(req.query.category);
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);
    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }
    const sort = String(req.query.sort || "sales").toLowerCase() === "qty" ? "qty" : "sales";
    const orderBy = sort === "qty" ? "qty DESC NULLS LAST" : "sales DESC NULLS LAST";

    const sql = `
    SELECT
      item_description,
      manufacturer,
      item_no,
      ROUND(SUM(CASE WHEN qty_sold IS NULL OR qty_sold <> qty_sold THEN 0 ELSE qty_sold END)::numeric, 2) AS qty,
      ROUND(SUM(CASE WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0 ELSE total_sale_price END)::numeric, 2) AS sales,
      ARRAY_AGG(DISTINCT sale_id) FILTER (WHERE sale_id IS NOT NULL AND sale_id <> '') AS sale_ids
    FROM pos_sale_items
    WHERE ${itemDateField} >= $1
      AND ${itemDateField} < $2
      AND category ILIKE $3
      AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
      AND ($5::text IS NULL OR sale_id IN (SELECT sale_id FROM pos_sales WHERE salesperson ILIKE ('%' || $5 || '%')))
    GROUP BY item_description, manufacturer, item_no
    ORDER BY ${orderBy}
    LIMIT $6;
  `;

    const r = await pool.query(sql, [start, end, category, locationQ, salespersonQ, limit]);
    res.json({
      start,
      end,
      limit,
      category,
      rows: r.rows.map((x: any) => ({
        item_description: x.item_description,
        manufacturer: x.manufacturer,
        item_no: x.item_no,
        qty: Number(x.qty ?? 0),
        sales: Number(x.sales ?? 0),
        sale_ids: Array.isArray(x.sale_ids) ? x.sale_ids : [],
      })),
    });
  });

  // Top items for a specific manufacturer
  app.get("/api/items/manufacturer-top-items", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const limit = Math.min(Number(req.query.limit || 10), 50);
    const manufacturer = parseTextParam(req.query.manufacturer);
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);
    if (!manufacturer) {
      return res.status(400).json({ error: "manufacturer is required" });
    }
    const sort = String(req.query.sort || "sales").toLowerCase() === "qty" ? "qty" : "sales";
    const orderBy = sort === "qty" ? "qty DESC NULLS LAST" : "sales DESC NULLS LAST";

    const sql = `
    SELECT
      item_description,
      category,
      item_no,
      ROUND(SUM(CASE WHEN qty_sold IS NULL OR qty_sold <> qty_sold THEN 0 ELSE qty_sold END)::numeric, 2) AS qty,
      ROUND(SUM(CASE WHEN total_sale_price IS NULL OR total_sale_price <> total_sale_price THEN 0 ELSE total_sale_price END)::numeric, 2) AS sales,
      ARRAY_AGG(DISTINCT sale_id) FILTER (WHERE sale_id IS NOT NULL AND sale_id <> '') AS sale_ids
    FROM pos_sale_items
    WHERE ${itemDateField} >= $1
      AND ${itemDateField} < $2
      AND manufacturer ILIKE $3
      AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
      AND ($5::text IS NULL OR sale_id IN (SELECT sale_id FROM pos_sales WHERE salesperson ILIKE ('%' || $5 || '%')))
    GROUP BY item_description, category, item_no
    ORDER BY ${orderBy}
    LIMIT $6;
  `;

    const r = await pool.query(sql, [start, end, manufacturer, locationQ, salespersonQ, limit]);
    res.json({
      start,
      end,
      limit,
      manufacturer,
      rows: r.rows.map((x: any) => ({
        item_description: x.item_description,
        category: x.category,
        item_no: x.item_no,
        qty: Number(x.qty ?? 0),
        sales: Number(x.sales ?? 0),
        sale_ids: Array.isArray(x.sale_ids) ? x.sale_ids : [],
      })),
    });
  });

  // Pro1st attach rate + sale ids
  app.get("/api/pro1st/attach-rate", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);

    const totalSql = `
    WITH non_mattress_items AS (
      SELECT
        i.sale_id,
        SUM(
          CASE
            WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0
            ELSE i.total_sale_price
          END
        )::numeric AS non_mattress_sales
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
        AND NOT (
          ${aliasedExcludedPro1stSql}
        )
      GROUP BY i.sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*)::int AS cnt
      FROM pos_sales_people
      GROUP BY sale_id
    )
    SELECT COALESCE(SUM(COALESCE(nm.non_mattress_sales, 0) / NULLIF(pc.cnt, 0)), 0)::numeric AS total_sales
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    LEFT JOIN non_mattress_items nm ON nm.sale_id = p.sale_id
    LEFT JOIN people_counts pc ON pc.sale_id = p.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR s.location ILIKE ('%' || $3::text || '%'))
      AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'))
      AND p.sale_id IS NOT NULL
      AND p.sale_id <> '';
  `;
    const proSql = `
    WITH pro_items AS (
      SELECT
        i.sale_id,
        COALESCE(i.total_profit, 0)::numeric AS item_profit,
        COALESCE(i.total_sale_price, 0)::numeric AS item_sales
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
        AND ${aliasedPro1stItemSql}
        AND i.sale_id IS NOT NULL
        AND i.sale_id <> ''
    ),
    sales_with_profit AS (
      SELECT
        sale_id,
        SUM(item_profit)::numeric AS pro_profit,
        SUM(item_sales)::numeric AS pro_sales
      FROM pro_items
      GROUP BY sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*)::int AS cnt
      FROM pos_sales_people
      GROUP BY sale_id
    )
    SELECT
      COALESCE(SUM(COALESCE(swp.pro_sales, 0) / NULLIF(pc.cnt, 0)), 0)::numeric AS pro_sales,
      ARRAY_AGG(DISTINCT p.sale_id) AS sale_ids,
      ARRAY_AGG(DISTINCT p.sale_id) FILTER (WHERE swp.pro_profit < 100) AS sale_ids_low,
      ARRAY_AGG(DISTINCT p.sale_id) FILTER (WHERE swp.pro_profit >= 100 AND swp.pro_profit < 200) AS sale_ids_mid,
      ARRAY_AGG(DISTINCT p.sale_id) FILTER (WHERE swp.pro_profit >= 200) AS sale_ids_high
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    JOIN sales_with_profit swp ON swp.sale_id = p.sale_id
    LEFT JOIN people_counts pc ON pc.sale_id = p.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'));
  `;

    const [totalRes, proRes] = await Promise.all([
      pool.query(totalSql, [start, end, locationQ, salespersonQ]),
      pool.query(proSql, [start, end, locationQ, salespersonQ]),
    ]);
    const totalSales = Number(totalRes.rows[0]?.total_sales ?? 0);
    const proSales = Number(proRes.rows[0]?.pro_sales ?? 0);
    const saleIds = Array.isArray(proRes.rows[0]?.sale_ids) ? proRes.rows[0]?.sale_ids : [];
    const saleIdsLow = Array.isArray(proRes.rows[0]?.sale_ids_low) ? proRes.rows[0]?.sale_ids_low : [];
    const saleIdsMid = Array.isArray(proRes.rows[0]?.sale_ids_mid) ? proRes.rows[0]?.sale_ids_mid : [];
    const saleIdsHigh = Array.isArray(proRes.rows[0]?.sale_ids_high) ? proRes.rows[0]?.sale_ids_high : [];
    const attachRate = totalSales > 0 ? (proSales / totalSales) * 100 : 0;

    res.json({
      start,
      end,
      total_sales: totalSales,
      pro_sales: proSales,
      attach_rate: attachRate,
      sale_ids: saleIds,
      sale_ids_low: saleIdsLow,
      sale_ids_mid: saleIdsMid,
      sale_ids_high: saleIdsHigh,
    });
  });

  // Pro1st sales ratio (amount vs total sales), with breakdowns
  app.get("/api/pro1st/sales-ratio", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);

    const baseParams = [start, end, locationQ, salespersonQ];

    const totalSql = `
    WITH pro_items AS (
      SELECT
        i.sale_id,
        SUM(
          CASE
            WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0
            ELSE i.total_sale_price
          END
        )::numeric AS pro_sales
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
        AND ($4::text IS NULL OR i.sale_id IN (SELECT sale_id FROM pos_sales_people WHERE salesperson ILIKE ('%' || $4 || '%')))
        AND ${pro1stItemSql}
        AND sale_id IS NOT NULL
        AND sale_id <> ''
      GROUP BY sale_id
    ),
    sales_base AS (
      SELECT
        s.sale_id,
        s.location,
        CASE
          WHEN s.grand_total IS NULL OR s.grand_total <> s.grand_total THEN 0
          ELSE s.grand_total
        END AS grand_total
      FROM pos_sales s
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
        AND ($4::text IS NULL OR s.salesperson ILIKE ('%' || $4 || '%'))
    )
    SELECT
      ROUND(SUM(grand_total)::numeric, 2) AS total_sales,
      ROUND(SUM(COALESCE(pro_items.pro_sales, 0))::numeric, 2) AS pro1st_sales
    FROM sales_base
    LEFT JOIN pro_items USING (sale_id);
  `;

    const peopleSql = `
    WITH pro_items AS (
      SELECT
        i.sale_id,
        SUM(
          CASE
            WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0
            ELSE i.total_sale_price
          END
        )::numeric AS pro_sales
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
        AND ($4::text IS NULL OR i.sale_id IN (SELECT sale_id FROM pos_sales_people WHERE salesperson ILIKE ('%' || $4 || '%')))
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
      p.salesperson,
      ROUND(SUM(p.grand_total_split)::numeric, 2) AS total_sales,
      ROUND(SUM(COALESCE(pro_items.pro_sales, 0) / NULLIF(people_counts.people_count, 0))::numeric, 2) AS pro1st_sales
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    LEFT JOIN pro_items ON pro_items.sale_id = p.sale_id
    LEFT JOIN people_counts ON people_counts.sale_id = p.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND p.salesperson IS NOT NULL
      AND p.salesperson <> 'Sales, Store'
      AND ($4::text IS NULL OR p.salesperson ILIKE ('%' || $4 || '%'))
      AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
    GROUP BY p.salesperson
    ORDER BY total_sales DESC;
  `;

    const storeSql = `
    WITH pro_items AS (
      SELECT
        i.sale_id,
        SUM(
          CASE
            WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0
            ELSE i.total_sale_price
          END
        )::numeric AS pro_sales
      FROM pos_sale_items i
      JOIN pos_sales s ON s.sale_id = i.sale_id
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
        AND ($4::text IS NULL OR i.sale_id IN (SELECT sale_id FROM pos_sales_people WHERE salesperson ILIKE ('%' || $4 || '%')))
        AND ${pro1stItemSql}
        AND sale_id IS NOT NULL
        AND sale_id <> ''
      GROUP BY sale_id
    ),
    sales_base AS (
      SELECT
        s.sale_id,
        s.location,
        CASE
          WHEN s.grand_total IS NULL OR s.grand_total <> s.grand_total THEN 0
          ELSE s.grand_total
        END AS grand_total
      FROM pos_sales s
      WHERE ${prefixedDateField("s")} >= $1
        AND ${prefixedDateField("s")} < $2
        AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
        AND ($4::text IS NULL OR s.salesperson ILIKE ('%' || $4 || '%'))
    )
    SELECT
      location,
      ROUND(SUM(grand_total)::numeric, 2) AS total_sales,
      ROUND(SUM(COALESCE(pro_items.pro_sales, 0))::numeric, 2) AS pro1st_sales
    FROM sales_base
    LEFT JOIN pro_items USING (sale_id)
    GROUP BY location
    ORDER BY total_sales DESC;
  `;

    const [totalRes, peopleRes, storeRes] = await Promise.all([
      pool.query(totalSql, baseParams),
      pool.query(peopleSql, baseParams),
      pool.query(storeSql, baseParams),
    ]);

    const totalSales = Number(totalRes.rows[0]?.total_sales ?? 0);
    const pro1stSales = Number(totalRes.rows[0]?.pro1st_sales ?? 0);
    const ratioPct = totalSales > 0 ? (pro1stSales / totalSales) * 100 : 0;

    const salespeople = (peopleRes.rows || []).map((row: any) => {
      const total = Number(row.total_sales ?? 0);
      const pro = Number(row.pro1st_sales ?? 0);
      return {
        salesperson: row.salesperson,
        total_sales: total,
        pro1st_sales: pro,
        ratio_pct: total > 0 ? (pro / total) * 100 : 0,
      };
    });

    const stores = (storeRes.rows || []).map((row: any) => {
      const total = Number(row.total_sales ?? 0);
      const pro = Number(row.pro1st_sales ?? 0);
      return {
        location: row.location,
        total_sales: total,
        pro1st_sales: pro,
        ratio_pct: total > 0 ? (pro / total) * 100 : 0,
      };
    });

    res.json({
      start,
      end,
      total_sales: totalSales,
      pro1st_sales: pro1stSales,
      ratio_pct: ratioPct,
      salespeople,
      stores,
    });
  });

  // Furniture sales vs Mattress/BoxSpring/Adjustable Base sales trend (excluding Pro1st from both)
  app.get("/api/pro1st/trend", async (req, res) => {
    const start = parseDateParam(req.query.start, "1900-01-01");
    const end = parseDateParam(req.query.end, "2100-01-01");
    const locationQ = parseTextParam(req.query.location);
    const salespersonQ = parseTextParam(req.query.salesperson);

    const sql = `
    WITH people_counts AS (
      SELECT sale_id, COUNT(*) as cnt FROM pos_sales_people GROUP BY sale_id
    ),
    salesperson_sales AS (
      SELECT DISTINCT sale_id
      FROM pos_sales_people
      WHERE salesperson ILIKE ('%' || $4 || '%')
    ),
    is_mattress_boxspring_adjustable AS (
      SELECT DISTINCT sale_id
      FROM pos_sale_items i
      WHERE (
        COALESCE(i.item_description, '') ILIKE '%mattress%'
        OR COALESCE(i.category, '') ILIKE '%mattress%'
        OR COALESCE(i.item_description, '') ILIKE '%box spring%'
        OR COALESCE(i.item_description, '') ILIKE '%boxspring%'
        OR COALESCE(i.category, '') ILIKE '%box spring%'
        OR COALESCE(i.item_description, '') ILIKE '%adjustable base%'
        OR COALESCE(i.category, '') ILIKE '%adjustable base%'
      )
    )
    SELECT
      date_trunc('day', ${prefixedDateField("s")})::date AS day,
      ROUND(SUM(
        CASE
          WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0
          WHEN NOT (
            COALESCE(i.item_description, '') ILIKE '%mattress%'
            OR COALESCE(i.category, '') ILIKE '%mattress%'
            OR COALESCE(i.item_description, '') ILIKE '%box spring%'
            OR COALESCE(i.item_description, '') ILIKE '%boxspring%'
            OR COALESCE(i.category, '') ILIKE '%box spring%'
            OR COALESCE(i.item_description, '') ILIKE '%adjustable base%'
            OR COALESCE(i.category, '') ILIKE '%adjustable base%'
          ) THEN
            CASE WHEN $4::text IS NULL THEN i.total_sale_price ELSE i.total_sale_price / NULLIF(pc.cnt, 0) END
          ELSE 0
        END
      )::numeric, 2) AS furniture_sales,
      ROUND(SUM(
        CASE
          WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0
          WHEN (
            COALESCE(i.item_description, '') ILIKE '%mattress%'
            OR COALESCE(i.category, '') ILIKE '%mattress%'
            OR COALESCE(i.item_description, '') ILIKE '%box spring%'
            OR COALESCE(i.item_description, '') ILIKE '%boxspring%'
            OR COALESCE(i.category, '') ILIKE '%box spring%'
            OR COALESCE(i.item_description, '') ILIKE '%adjustable base%'
            OR COALESCE(i.category, '') ILIKE '%adjustable base%'
          ) THEN
            CASE WHEN $4::text IS NULL THEN i.total_sale_price ELSE i.total_sale_price / NULLIF(pc.cnt, 0) END
          ELSE 0
        END
      )::numeric, 2) AS mattress_boxspring_adjustable_sales
    FROM pos_sale_items i
    JOIN pos_sales s ON s.sale_id = i.sale_id
    LEFT JOIN people_counts pc ON pc.sale_id = i.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR i.sale_id IN (SELECT sale_id FROM salesperson_sales))
      AND NOT (${buildQualifiedPro1stSql("i.")})
    GROUP BY day
    ORDER BY day;
  `;

    const r = await pool.query(sql, [start, end, locationQ, salespersonQ]);
    res.json({
      start,
      end,
      rows: r.rows.map((x: any) => ({
        day: x.day,
        furnitureSales: Number(x.furniture_sales ?? 0),
        mattressBoxSpringAdjustableSales: Number(x.mattress_boxspring_adjustable_sales ?? 0),
      })),
    });
  });
}
