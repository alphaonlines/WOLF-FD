import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import multer from "multer";
import { Pool } from "pg";

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.resolve(__dirname, "..", "incoming");
fs.mkdirSync(uploadsDir, { recursive: true });
const execFileAsync = promisify(execFile);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^\w.\- ()]/g, "_");
      cb(null, `${Date.now()}_${safeName}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname);
    cb((ok ? null : new Error("Only .xlsx or .xls files are accepted")) as any, ok);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const envString = (key: string, fallback?: string) => {
  const v = process.env[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
};

const pool = new Pool({
  host: envString("PGHOST", "127.0.0.1"),
  port: Number(envString("PGPORT", "5432")),
  database: envString("PGDATABASE", "salesdb"),
  user: envString("PGUSER", "salesapp"),
  password: envString("PGPASSWORD", "dev_password_change_me"),
});

function parseDateParam(v: any, fallback: string) {
  if (!v || typeof v !== "string") return fallback;
  // Minimal safety: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return fallback;
  return v;
}

function parseTextParam(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function parseTaskStatus(v: any): "TODO" | "IN_PROGRESS" | "DONE" | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim().toUpperCase();
  if (t === "TODO" || t === "IN_PROGRESS" || t === "DONE") return t;
  return null;
}

function parseTaskPriority(v: any): "low" | "medium" | "high" | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t === "low" || t === "medium" || t === "high") return t as any;
  return null;
}

function parseTaskDeadline(v: any): string | null {
  if (v === null) return null;
  if (v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

function parseIntBody(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseTaskIdParam(v: any): number | null {
  if (!v || typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const id = Math.trunc(n);
  return id > 0 ? id : null;
}

const SAFE_GRAND_TOTAL = `
  CASE
    WHEN grand_total IS NULL OR grand_total <> grand_total THEN 0
    ELSE grand_total
  END
`;

const SAFE_PROFIT = `
  CASE
    WHEN profit IS NULL OR profit <> profit THEN 0
    ELSE profit
  END
`;

const SAFE_TOTAL_FINANCE_AMT = `
  CASE
    WHEN total_finance_amt IS NULL OR total_finance_amt <> total_finance_amt THEN 0
    ELSE total_finance_amt
  END
`;

const SAFE_FINANCE_FEE = `
  CASE
    WHEN finance_fee IS NULL OR finance_fee <> finance_fee THEN 0
    ELSE finance_fee
  END
`;

const SAFE_FINANCE_BALANCE = `
  CASE
    WHEN finance_balance IS NULL OR finance_balance <> finance_balance THEN 0
    ELSE finance_balance
  END
`;

const ITEM_DATE_FIELD = "COALESCE(delivery_confirmed_date, sale_date)";
const prefixedDateField = (p: string) => `COALESCE(${p}.delivery_confirmed_date, ${p}.sale_date, ${p}.est_delivery_date)`;
const PRO1ST_TREND_DATE_FIELD = "COALESCE(delivery_confirmed_date, sale_date)";

// Health
app.get("/health", async (_req, res) => {
  const r = await pool.query("SELECT 1 AS ok");
  res.json({ ok: true, db: r.rows[0].ok });
});

app.post("/api/import/upload", upload.array("files", 25), async (req, res) => {
  const rawFiles = (req as any).files as Array<{ originalname: string; filename: string; size: number }> | undefined;
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  if (!files.length) {
    res.status(400).json({ ok: false, error: "No files uploaded" });
    return;
  }
  const importerPath = path.resolve(__dirname, "..", "importer", "import_pos_xlsx.py");
  const pythonBin = process.env.POS_IMPORT_PYTHON || "python";
  let importOutput = "";
  let importError = "";
  const tempDir = fs.mkdtempSync(path.join(uploadsDir, "upload-"));
  try {
    for (const file of files) {
      const src = path.join(uploadsDir, file.filename);
      const dest = path.join(tempDir, file.filename);
      if (fs.existsSync(src)) {
        fs.renameSync(src, dest);
      }
    }
    const { stdout, stderr } = await execFileAsync(
      pythonBin,
      [importerPath, "--incoming", tempDir, "--no-move"],
      { timeout: 5 * 60 * 1000 }
    );
    importOutput = stdout?.toString() || "";
    importError = stderr?.toString() || "";
  } catch (err: any) {
    importError = err?.stderr?.toString?.() || String(err?.message || err);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  res.json({
    ok: true,
    saved_to: uploadsDir,
    files: files.map((f) => ({
      original_name: f.originalname,
      stored_name: f.filename,
      size: f.size,
    })),
    import: {
      ok: importError ? false : true,
      stdout: importOutput,
      stderr: importError,
    },
  });
});

// Available years present in data (for UI pickers)
app.get("/api/available-years", async (_req, res) => {
  const sql = `
    SELECT DISTINCT year FROM (
      SELECT EXTRACT(YEAR FROM sale_date)::int AS year
      FROM pos_sales
      WHERE sale_date IS NOT NULL
      UNION
      SELECT EXTRACT(YEAR FROM delivery_confirmed_date)::int AS year
      FROM pos_sales
      WHERE delivery_confirmed_date IS NOT NULL
      UNION
      SELECT EXTRACT(YEAR FROM est_delivery_date)::int AS year
      FROM pos_sales
      WHERE est_delivery_date IS NOT NULL
      UNION
      SELECT EXTRACT(YEAR FROM last_payment_date)::int AS year
      FROM pos_sales
      WHERE last_payment_date IS NOT NULL
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
        sale_date,
        salesperson,
        location,
        receipt_no,
        customer_name,
        ${SAFE_GRAND_TOTAL}::numeric AS grand_total,
        ${SAFE_PROFIT}::numeric AS profit,
        ${SAFE_TOTAL_FINANCE_AMT}::numeric AS total_finance_amt,
        ${SAFE_FINANCE_BALANCE}::numeric AS finance_balance,
        ${SAFE_FINANCE_FEE}::numeric AS finance_fee,
        raw_source_file
      FROM pos_sales
    WHERE COALESCE(delivery_confirmed_date, sale_date) >= $1
      AND COALESCE(delivery_confirmed_date, sale_date) < $2
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
      WHERE ${ITEM_DATE_FIELD} >= $1
        AND ${ITEM_DATE_FIELD} < $2
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
        p.sale_date,
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
      WHERE ${ITEM_DATE_FIELD} >= $1
        AND ${ITEM_DATE_FIELD} < $2
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
      WHERE ${ITEM_DATE_FIELD} >= $1
        AND ${ITEM_DATE_FIELD} < $2
        AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
        AND ($3::text IS NULL OR sale_id IN (SELECT sale_id FROM pos_sales WHERE salesperson ILIKE ('%' || $3 || '%')))
        AND (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
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
      p.sale_date,
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
    WHERE COALESCE(s.delivery_confirmed_date, s.sale_date) >= $1
      AND COALESCE(s.delivery_confirmed_date, s.sale_date) < $2
      AND p.salesperson ILIKE ('%' || $3 || '%')
      AND ($4::text IS NULL OR COALESCE(p.location, s.location) ILIKE ('%' || $4 || '%'))
    ORDER BY COALESCE(s.delivery_confirmed_date, s.sale_date) DESC, p.sale_id DESC
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

// Summary totals for a date range
// Note: `end` is treated as exclusive to match common analytics behavior.
app.get("/api/summary", async (req, res) => {
  const start = parseDateParam(req.query.start, "1900-01-01");
  const end = parseDateParam(req.query.end, "2100-01-01");
  const salespersonQ = parseTextParam(req.query.salesperson);
  const locationQ = parseTextParam(req.query.location);

  const sql = `
    WITH item_sales AS (
      SELECT i.sale_id, SUM(i.total_sale_price) AS item_sales
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
  `;

  const r = await pool.query(sql, [start, end, salespersonQ, locationQ]);
  res.json({ start, end, ...r.rows[0] });
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
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        THEN 'Pro1st'
        ELSE item_description
      END AS item_description,
      CASE
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        THEN NULL
        ELSE category
      END AS category,
      CASE
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        THEN NULL
        ELSE manufacturer
      END AS manufacturer,
      CASE
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
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
    WHERE ${ITEM_DATE_FIELD} >= $1
      AND ${ITEM_DATE_FIELD} < $2
      AND ($4::text IS NULL OR location ILIKE ('%' || $4 || '%'))
      AND ($5::text IS NULL OR pos_sale_items.sale_id IN (SELECT sale_id FROM salesperson_sales))
      AND item_description IS NOT NULL
      AND item_description <> ''
    GROUP BY
      CASE
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        THEN 'Pro1st'
        ELSE item_description
      END,
      CASE
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        THEN NULL
        ELSE category
      END,
      CASE
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        THEN NULL
        ELSE manufacturer
      END,
      CASE
        WHEN (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
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
    WHERE ${ITEM_DATE_FIELD} >= $1
      AND ${ITEM_DATE_FIELD} < $2
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
    WHERE ${ITEM_DATE_FIELD} >= $1
      AND ${ITEM_DATE_FIELD} < $2
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
    WHERE ${ITEM_DATE_FIELD} >= $1
      AND ${ITEM_DATE_FIELD} < $2
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
    WHERE ${ITEM_DATE_FIELD} >= $1
      AND ${ITEM_DATE_FIELD} < $2
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
        AND (i.category IS NULL OR i.category NOT ILIKE '%mattress%')
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
        AND (
          i.is_pro1st = TRUE
          OR i.item_description ILIKE '%pro1st%'
          OR i.item_description ILIKE '%pro 1st%'
          OR i.item_description ILIKE '%pro-1st%'
          OR i.category ILIKE '%pro1st%'
          OR i.category ILIKE '%pro 1st%'
          OR i.category ILIKE '%pro-1st%'
          OR i.item_no ILIKE '%pro1st%'
          OR i.item_no ILIKE '%pro 1st%'
          OR i.item_no ILIKE '%pro-1st%'
          OR i.manufacturer ILIKE '%pro1st%'
          OR i.manufacturer ILIKE '%pro 1st%'
          OR i.manufacturer ILIKE '%pro-1st%'
        )
        AND i.sale_id IS NOT NULL
        AND i.sale_id <> ''
        AND (i.category IS NULL OR i.category NOT ILIKE '%mattress%')
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
        AND (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        AND sale_id IS NOT NULL
        AND sale_id <> ''
        AND (category IS NULL OR category NOT ILIKE '%mattress%')
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
        AND (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        AND sale_id IS NOT NULL
        AND sale_id <> ''
        AND (category IS NULL OR category NOT ILIKE '%mattress%')
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
        AND (
          is_pro1st = TRUE
          OR item_description ILIKE '%pro1st%'
          OR item_description ILIKE '%pro 1st%'
          OR item_description ILIKE '%pro-1st%'
          OR category ILIKE '%pro1st%'
          OR category ILIKE '%pro 1st%'
          OR category ILIKE '%pro-1st%'
          OR item_no ILIKE '%pro1st%'
          OR item_no ILIKE '%pro 1st%'
          OR item_no ILIKE '%pro-1st%'
          OR manufacturer ILIKE '%pro1st%'
          OR manufacturer ILIKE '%pro 1st%'
          OR manufacturer ILIKE '%pro-1st%'
        )
        AND sale_id IS NOT NULL
        AND sale_id <> ''
        AND (category IS NULL OR category NOT ILIKE '%mattress%')
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

// Pro1st daily sales trend (sum of Pro1st item sales)
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
    )
    SELECT
      date_trunc('day', ${prefixedDateField("s")})::date AS day,
      ROUND(SUM(
        CASE
          WHEN i.total_sale_price IS NULL OR i.total_sale_price <> i.total_sale_price THEN 0
          WHEN $4::text IS NULL THEN i.total_sale_price
          ELSE i.total_sale_price / NULLIF(pc.cnt, 0)
        END
      )::numeric, 2) AS sales
    FROM pos_sale_items i
    JOIN pos_sales s ON s.sale_id = i.sale_id
    LEFT JOIN people_counts pc ON pc.sale_id = i.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR s.location ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR i.sale_id IN (SELECT sale_id FROM salesperson_sales))
        AND (
          i.is_pro1st = TRUE
          OR i.item_description ILIKE '%pro1st%'
        OR i.item_description ILIKE '%pro 1st%'
        OR i.item_description ILIKE '%pro-1st%'
        OR i.category ILIKE '%pro1st%'
        OR i.category ILIKE '%pro 1st%'
        OR i.category ILIKE '%pro-1st%'
        OR i.item_no ILIKE '%pro1st%'
        OR i.item_no ILIKE '%pro 1st%'
        OR i.item_no ILIKE '%pro-1st%'
        OR i.manufacturer ILIKE '%pro1st%'
        OR i.manufacturer ILIKE '%pro 1st%'
          OR i.manufacturer ILIKE '%pro-1st%'
      )
      AND (i.category IS NULL OR i.category NOT ILIKE '%mattress%')
    GROUP BY day
    ORDER BY day;
  `;

  const r = await pool.query(sql, [start, end, locationQ, salespersonQ]);
  res.json({
    start,
    end,
    rows: r.rows.map((x: any) => ({
      day: x.day,
      sales: Number(x.sales ?? 0),
    })),
  });
});

// Coverage check: missing months for sales vs items (delivery months)
app.get("/api/import/coverage-months", async (_req, res) => {
  const startFloor = "2024-06-01";
  const sql = `
    WITH bounds AS (
      SELECT $1::date AS start_date, CURRENT_DATE::date AS end_date
    ),
    sales AS (
      SELECT sale_id, COALESCE(delivery_confirmed_date, sale_date, est_delivery_date) AS dt
      FROM pos_sales
      WHERE sale_id IS NOT NULL AND sale_id <> '' AND COALESCE(delivery_confirmed_date, sale_date, est_delivery_date) >= $1
    ),
    items AS (
      SELECT sale_id, COALESCE(delivery_confirmed_date, sale_date) AS dt
      FROM pos_sale_items
      WHERE sale_id IS NOT NULL AND sale_id <> '' AND COALESCE(delivery_confirmed_date, sale_date) >= $1
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

// Leaderboard (uses your split view)
app.get("/api/leaderboard", async (req, res) => {
  const start = parseDateParam(req.query.start, "1900-01-01");
  const end = parseDateParam(req.query.end, "2100-01-01");
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const salespersonQ = parseTextParam(req.query.salesperson);
  const locationQ = parseTextParam(req.query.location);

  const sql = `
    WITH item_profits AS (
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
      ROUND(SUM(p.grand_total_split)::numeric, 2) AS sales,
      ROUND(SUM(
        COALESCE(ip.item_profit / NULLIF(pc.cnt, 1), p.profit_split)
      )::numeric, 2) AS profit
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
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

// Weekly trend (sales + profit)
app.get("/api/sales-weekly", async (req, res) => {
  const start = parseDateParam(req.query.start, "1900-01-01");
  const end = parseDateParam(req.query.end, "2100-01-01");
  const locationQ = parseTextParam(req.query.location);

  const sql = `
    SELECT
      date_trunc('week', COALESCE(delivery_confirmed_date, sale_date))::date AS week,
      ROUND(SUM(${SAFE_GRAND_TOTAL})::numeric, 2) AS sales,
      ROUND(SUM(${SAFE_PROFIT})::numeric, 2) AS profit
    FROM pos_sales
    WHERE COALESCE(delivery_confirmed_date, sale_date) >= $1
      AND COALESCE(delivery_confirmed_date, sale_date) < $2
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
      WITH item_profits AS (
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
        ROUND(SUM(p.grand_total_split)::numeric, 2) AS sales,
        ROUND(SUM(
          COALESCE(ip.item_profit / NULLIF(pc.cnt, 1), p.profit_split)
        )::numeric, 2) AS profit
      FROM pos_sales_people p
      JOIN pos_sales s ON s.sale_id = p.sale_id
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
      WITH item_profits AS (
        SELECT sale_id, SUM(total_profit) as item_profit
        FROM pos_sale_items
        GROUP BY sale_id
      )
      SELECT
        date_trunc('day', ${prefixedDateField("s")})::date AS day,
        COUNT(*)::int AS lines,
        ROUND(SUM(${SAFE_GRAND_TOTAL})::numeric, 2) AS sales,
        ROUND(SUM(
          COALESCE(ip.item_profit, ${SAFE_PROFIT})
        )::numeric, 2) AS profit
      FROM pos_sales s
      LEFT JOIN item_profits ip ON ip.sale_id = s.sale_id
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

  const sql = `
    WITH item_profits AS (
      SELECT sale_id, SUM(total_profit) as item_profit
      FROM pos_sale_items
      GROUP BY sale_id
    ),
    people_counts AS (
      SELECT sale_id, COUNT(*) as cnt FROM pos_sales_people GROUP BY sale_id
    )
    SELECT
      COALESCE(p.location,'(unknown)') AS location,
      ROUND(SUM(p.grand_total_split)::numeric, 2) AS sales,
      ROUND(SUM(
        COALESCE(ip.item_profit / NULLIF(pc.cnt, 1), p.profit_split)
      )::numeric, 2) AS profit
    FROM pos_sales_people p
    JOIN pos_sales s ON s.sale_id = p.sale_id
    LEFT JOIN item_profits ip ON ip.sale_id = p.sale_id
    LEFT JOIN people_counts pc ON pc.sale_id = p.sale_id
    WHERE ${prefixedDateField("s")} >= $1
      AND ${prefixedDateField("s")} < $2
      AND ($3::text IS NULL OR p.salesperson ILIKE ('%' || $3 || '%'))
      AND ($4::text IS NULL OR p.location ILIKE ('%' || $4 || '%'))
    GROUP BY 1
    ORDER BY sales DESC;
  `;

  const r = await pool.query(sql, [start, end, salespersonQ, locationQ]);
  res.json({ start, end, rows: r.rows });
});

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

// Tasks (shared, stored in local Postgres)
app.get("/api/tasks", async (_req, res) => {
  const sql = `
    SELECT
      id,
      title,
      assignee,
      status,
      priority,
      deadline,
      sort_index,
      responded_at,
      completed_at,
      created_at,
      updated_at
    FROM tasks
    ORDER BY status ASC, sort_index ASC, id ASC;
  `;
  const r = await pool.query(sql);
  res.json({
    rows: r.rows.map((x: any) => ({
      id: Number(x.id),
      title: x.title,
      assignee: x.assignee,
      status: x.status,
      priority: x.priority,
      deadline: x.deadline ? String(x.deadline).slice(0, 10) : null,
      sort_index: Number(x.sort_index ?? 0),
      responded_at: x.responded_at,
      completed_at: x.completed_at,
      created_at: x.created_at,
      updated_at: x.updated_at,
    })),
  });
});

app.post("/api/tasks", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title is required" });

  const assignee =
    typeof req.body?.assignee === "string" && req.body.assignee.trim() ? req.body.assignee.trim() : "Unassigned";
  const status = parseTaskStatus(req.body?.status) ?? "TODO";
  const priority = parseTaskPriority(req.body?.priority) ?? "medium";
  const deadline = parseTaskDeadline(req.body?.deadline);
  const sortIndexExplicit = parseIntBody(req.body?.sort_index);

  const respondedAt = status === "IN_PROGRESS" ? new Date().toISOString() : null;
  const completedAt = status === "DONE" ? new Date().toISOString() : null;

  const sortIndex =
    sortIndexExplicit !== null
      ? sortIndexExplicit
      : (
          await pool.query("SELECT COALESCE(MAX(sort_index), -1) + 1 AS next FROM tasks WHERE status = $1", [status])
        ).rows[0]?.next ?? 0;

  const sql = `
    INSERT INTO tasks (title, assignee, status, priority, deadline, sort_index, responded_at, completed_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5::date, $6, $7::timestamptz, $8::timestamptz, now(), now())
    RETURNING id, title, assignee, status, priority, deadline, sort_index, responded_at, completed_at, created_at, updated_at;
  `;
  const r = await pool.query(sql, [title, assignee, status, priority, deadline, sortIndex, respondedAt, completedAt]);
  const row = r.rows[0];
  res.status(201).json({
    row: {
      id: Number(row.id),
      title: row.title,
      assignee: row.assignee,
      status: row.status,
      priority: row.priority,
      deadline: row.deadline ? String(row.deadline).slice(0, 10) : null,
      sort_index: Number(row.sort_index ?? 0),
      responded_at: row.responded_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
});

app.patch("/api/tasks/:id", async (req, res) => {
  const id = parseTaskIdParam(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });

  const fields: string[] = [];
  const values: any[] = [];

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : null;
  if (title !== null) {
    if (!title) return res.status(400).json({ error: "title cannot be empty" });
    values.push(title);
    fields.push(`title = $${values.length}`);
  }

  const assignee = typeof req.body?.assignee === "string" ? req.body.assignee.trim() : null;
  if (assignee !== null) {
    values.push(assignee || "Unassigned");
    fields.push(`assignee = $${values.length}`);
  }

  const status = req.body?.status !== undefined ? parseTaskStatus(req.body?.status) : null;
  if (status !== null) {
    values.push(status);
    fields.push(`status = $${values.length}`);
  }

  const priority = req.body?.priority !== undefined ? parseTaskPriority(req.body?.priority) : null;
  if (priority !== null) {
    values.push(priority);
    fields.push(`priority = $${values.length}`);
  }

  const deadline =
    req.body?.deadline !== undefined ? (req.body?.deadline === "" ? null : parseTaskDeadline(req.body?.deadline)) : null;
  if (req.body?.deadline !== undefined) {
    if (req.body?.deadline !== "" && deadline === null) return res.status(400).json({ error: "invalid deadline" });
    values.push(deadline);
    fields.push(`deadline = $${values.length}::date`);
  }

  const sortIndex = req.body?.sort_index !== undefined ? parseIntBody(req.body?.sort_index) : null;
  if (sortIndex !== null) {
    values.push(sortIndex);
    fields.push(`sort_index = $${values.length}`);
  }

  if (!fields.length) return res.status(400).json({ error: "no fields to update" });

  if (status === "IN_PROGRESS") {
    fields.push(`responded_at = COALESCE(responded_at, now())`);
  }

  if (status === "DONE") {
    fields.push(`completed_at = now()`);
  } else if (status === "TODO" || status === "IN_PROGRESS") {
    // If a task is re-opened, clear completion timestamp.
    fields.push(`completed_at = NULL`);
  }

  values.push(id);
  const sql = `
    UPDATE tasks
    SET ${fields.join(", ")}, updated_at = now()
    WHERE id = $${values.length}
    RETURNING id, title, assignee, status, priority, deadline, sort_index, responded_at, completed_at, created_at, updated_at;
  `;
  const r = await pool.query(sql, values);
  if (!r.rows.length) return res.status(404).json({ error: "not found" });

  const row = r.rows[0];
  res.json({
    row: {
      id: Number(row.id),
      title: row.title,
      assignee: row.assignee,
      status: row.status,
      priority: row.priority,
      deadline: row.deadline ? String(row.deadline).slice(0, 10) : null,
      sort_index: Number(row.sort_index ?? 0),
      responded_at: row.responded_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
});

const port = Number(process.env.PORT || 5057);
app.listen(port, () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});
