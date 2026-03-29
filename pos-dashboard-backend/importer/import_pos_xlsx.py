import os, glob, shutil, argparse
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values, Json

def read_pos_excel(path: str) -> pd.DataFrame:
    # .xlsx -> openpyxl, .xls -> xlrd (if installed)
    ext = os.path.splitext(path)[1].lower()
    if ext == ".xlsx":
        return pd.read_excel(path, engine="openpyxl")
    if ext == ".xls":
        # Many "xls" exports are actually HTML tables with a .xls extension.
        try:
            with open(path, "rb") as f:
                head = f.read(4096).lower()
        except Exception:
            head = b""

        if b"<html" in head or b"<!doctype html" in head or b"<table" in head:
            # Prefer BeautifulSoup parsing so we can preserve hyperlink hrefs (e.g., Note links).
            try:
                from bs4 import BeautifulSoup
                with open(path, "rb") as f:
                    html = f.read()
                soup = BeautifulSoup(html, "lxml")
                tables = soup.find_all("table")
                if not tables:
                    raise RuntimeError("HTML .xls contained no <table> elements.")

                expected = {k.strip().lower() for k in COLMAP.keys()}

                def table_headers(table):
                    header_cells = table.find_all("tr")[0].find_all(["th", "td"])
                    return [c.get_text(" ", strip=True) for c in header_cells]

                # Choose best table by header match score
                best_table = None
                best_score = -1
                for t in tables:
                    hs = [h.strip().lower() for h in table_headers(t)]
                    score = len(set(hs).intersection(expected))
                    if score > best_score:
                        best_score = score
                        best_table = t

                table = best_table or tables[0]
                rows = table.find_all("tr")
                if not rows:
                    raise RuntimeError("HTML .xls table had no rows.")

                headers = [h.strip() for h in table_headers(table)]
                data = []

                for tr in rows[1:]:
                    cells = tr.find_all(["td", "th"])
                    if not cells:
                        continue
                    row = {}
                    for i, cell in enumerate(cells):
                        if i >= len(headers):
                            continue
                        header = headers[i]
                        a = cell.find("a")
                        href = a.get("href") if a else None
                        text = cell.get_text(" ", strip=True)
                        # Preserve hyperlinks even if they're relative (many POS exports use app-relative URLs)
                        if href:
                            row[header] = href if not text else f"{text} ({href})"
                        else:
                            row[header] = text
                    if any(v not in (None, "") for v in row.values()):
                        data.append(row)

                if not data:
                    raise RuntimeError("HTML .xls table contained no data rows.")

                return pd.DataFrame(data)
            except Exception:
                # Fallback to pandas HTML parsing
                try:
                    tables = pd.read_html(path)  # requires lxml and/or html5lib and/or bs4
                except Exception as e:
                    raise RuntimeError(
                        "This .xls appears to be an HTML export. To import it, install HTML parser deps:\n"
                        "  pip install lxml html5lib beautifulsoup4\n"
                        "or convert the file to .xlsx and retry."
                    ) from e

                if not tables:
                    raise RuntimeError("HTML .xls contained no tables.")

                expected = {k.strip().lower() for k in COLMAP.keys()}
                best = None
                best_score = -1
                for t in tables:
                    cols = {str(c).strip().lower() for c in t.columns}
                    score = len(cols.intersection(expected))
                    if score > best_score:
                        best_score = score
                        best = t

                return best if best is not None else tables[0]

        try:
            return pd.read_excel(path, engine="xlrd")
        except Exception as e:
            raise RuntimeError(
                "Could not read this .xls file. Some POS exports are not true Excel binaries (they may be HTML). "
                "Try opening/saving as .xlsx, or ensure html parsing deps are installed:\n"
                "  pip install html5lib beautifulsoup4\n"
                "If it is a real .xls, ensure 'xlrd' is installed."
            ) from e
    raise ValueError(f"Unsupported file type: {ext} ({path})")

def json_safe(v):
    # Convert pandas / numpy / datetime types into JSON-serializable primitives
    try:
        import numpy as np
    except Exception:
        np = None

    if v is None:
        return None

    # pandas NaN/NaT
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass

    # pandas Timestamp / python datetime/date
    if isinstance(v, pd.Timestamp):
        return v.isoformat()

    import datetime as _dt
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v.isoformat()

    # numpy scalars
    if np is not None:
        if isinstance(v, np.integer):
            return int(v)
        if isinstance(v, np.floating):
            return float(v)
        if isinstance(v, np.bool_):
            return bool(v)

    # Decimal
    try:
        from decimal import Decimal
        if isinstance(v, Decimal):
            return float(v)
    except Exception:
        pass

    return v






ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INCOMING = os.path.join(ROOT, "incoming")
PROCESSED = os.path.join(ROOT, "processed")

PG = dict(
    host=os.environ.get("PGHOST", "127.0.0.1"),
    port=int(os.environ.get("PGPORT", "5432")),
    dbname=os.environ.get("PGDATABASE", "salesdb"),
    user=os.environ.get("PGUSER", "salesapp"),
    password=os.environ.get("PGPASSWORD", "dev_password_change_me"),
)

COLMAP = {
    "Sales#": "sale_id",
    "Sale #": "sale_id",
    "Date of Sale": "sale_date",
    "Est Date of Delivery": "est_delivery_date",
    "Date Deliv Confirmed": "delivery_confirmed_date",
    "Date of Last PMT": "last_payment_date",

    "Sales Person": "salesperson",
    "Sales Location": "location",

    "Receitp#": "receipt_no",
    "Receipt#": "receipt_no",
    "Receipt #": "receipt_no",

    "Subtotal": "subtotal",
    "Adjustments before and after tax": "adjustments",
    "Additional Fees before and after tax": "additional_fees",
    "Tax": "tax",
    "Grand Total": "grand_total",
    "Store Credit Applied": "store_credit_applied",
    "Previous Paid": "previous_paid",
    "Prev. Paid": "previous_paid",
    "Prev Paid": "previous_paid",
    "Total Collected": "total_collected",

    "Total Finance AMT": "total_finance_amt",
    "Finance Balance": "finance_balance",
    "Finance Fee": "finance_fee",
    "Lwy Balance": "lwy_balance",

    "Cost": "cost",
    "Profit": "profit",
    "Gross Margin": "gross_margin",

    "Customer Name": "customer_name",
    "Phone #": "phone",
    "Phone#": "phone",
    "Print Letter": "print_letter",
    "Delivery": "delivery",
    "Note": "note",
    "Sale Type": "sale_type",
    "Sale Status": "sale_status",
    "Status": "sale_status",
    "City": "city",
    "State": "state",
    "Zip": "zip",
}

CLEAN_COLS = [
    "sale_id","sale_date","est_delivery_date","delivery_confirmed_date","last_payment_date",
    "salesperson","location","receipt_no",
    "subtotal","adjustments","additional_fees","tax","grand_total","store_credit_applied","previous_paid","total_collected",
    "total_finance_amt","finance_fee","finance_balance","lwy_balance",
    "cost","profit","gross_margin",
    "customer_name","phone","print_letter","delivery","note","sale_type","sale_status","city","state","zip",
    "raw_source_file",
]

ITEM_COLMAP = {
    "Sale #": "sale_id",
    "Sales#": "sale_id",
    "Sales Date": "sale_date",
    "Sale Location": "location",
    "Manufacturer": "manufacturer",
    "Category": "category",
    "Item #": "item_no",
    "Item Description": "item_description",
    "Qty Sold": "qty_sold",
    "Total Cost": "total_cost",
    "Total Sale Price": "total_sale_price",
    "Total Profit": "total_profit",
    "Weighted Gross Margin": "gross_margin",
    "Date Deliv Confirmed": "delivery_confirmed_date",
}

ITEM_COLS = [
    "sale_id",
    "sale_date",
    "location",
    "manufacturer",
    "category",
    "item_no",
    "item_description",
    "qty_sold",
    "total_cost",
    "total_sale_price",
    "total_profit",
    "gross_margin",
    "delivery_confirmed_date",
    "is_pro1st",
    "raw_source_file",
]

UPSERT_RAW = """
INSERT INTO pos_sales_raw (sale_id, sale_date, raw_source_file, import_batch_id, row_json)
VALUES %s
ON CONFLICT (sale_id) DO UPDATE SET
  sale_date = EXCLUDED.sale_date,
  raw_source_file = EXCLUDED.raw_source_file,
  import_batch_id = EXCLUDED.import_batch_id,
  row_json = EXCLUDED.row_json
WHERE pos_sales_raw.import_batch_id IS NULL
   OR EXCLUDED.import_batch_id >= pos_sales_raw.import_batch_id;
"""

UPSERT_CLEAN = """
INSERT INTO pos_sales (
  sale_id, sale_date, est_delivery_date, delivery_confirmed_date, last_payment_date,
  salesperson, location, receipt_no,
  subtotal, adjustments, additional_fees, tax, grand_total, store_credit_applied, previous_paid, total_collected,
  total_finance_amt, finance_fee, finance_balance, lwy_balance,
  cost, profit, gross_margin,
  customer_name, phone, print_letter, delivery, note, sale_type, sale_status, city, state, zip,
  raw_source_file, last_import_batch_id
)
VALUES %s
ON CONFLICT (sale_id) DO UPDATE SET
  sale_date = EXCLUDED.sale_date,
  est_delivery_date = EXCLUDED.est_delivery_date,
  delivery_confirmed_date = EXCLUDED.delivery_confirmed_date,
  last_payment_date = EXCLUDED.last_payment_date,
  salesperson = EXCLUDED.salesperson,
  location = EXCLUDED.location,
  receipt_no = EXCLUDED.receipt_no,
  subtotal = EXCLUDED.subtotal,
  adjustments = EXCLUDED.adjustments,
  additional_fees = EXCLUDED.additional_fees,
  tax = EXCLUDED.tax,
  grand_total = EXCLUDED.grand_total,
  store_credit_applied = EXCLUDED.store_credit_applied,
  previous_paid = EXCLUDED.previous_paid,
  total_collected = EXCLUDED.total_collected,
  total_finance_amt = EXCLUDED.total_finance_amt,
  finance_fee = EXCLUDED.finance_fee,
  finance_balance = EXCLUDED.finance_balance,
  lwy_balance = EXCLUDED.lwy_balance,
  cost = EXCLUDED.cost,
  profit = EXCLUDED.profit,
  gross_margin = EXCLUDED.gross_margin,
  customer_name = EXCLUDED.customer_name,
  phone = EXCLUDED.phone,
  print_letter = EXCLUDED.print_letter,
  delivery = EXCLUDED.delivery,
  note = EXCLUDED.note,
  sale_type = EXCLUDED.sale_type,
  sale_status = EXCLUDED.sale_status,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  raw_source_file = EXCLUDED.raw_source_file,
  last_import_batch_id = EXCLUDED.last_import_batch_id
WHERE pos_sales.last_import_batch_id IS NULL
   OR EXCLUDED.last_import_batch_id >= pos_sales.last_import_batch_id;
"""

UPSERT_ITEMS_RAW = """
INSERT INTO pos_sale_items_raw (row_hash, sale_id, sale_date, raw_source_file, import_batch_id, row_json)
VALUES %s
ON CONFLICT (row_hash) DO UPDATE SET
  sale_id = EXCLUDED.sale_id,
  sale_date = EXCLUDED.sale_date,
  raw_source_file = EXCLUDED.raw_source_file,
  import_batch_id = EXCLUDED.import_batch_id,
  row_json = EXCLUDED.row_json
WHERE pos_sale_items_raw.import_batch_id IS NULL
   OR EXCLUDED.import_batch_id >= pos_sale_items_raw.import_batch_id;
"""

UPSERT_ITEMS = """
INSERT INTO pos_sale_items (
  row_hash, sale_id, sale_date, location, manufacturer, category, item_no, item_description,
  qty_sold, total_cost, total_sale_price, total_profit, gross_margin, delivery_confirmed_date,
  is_pro1st,
  raw_source_file, import_batch_id
)
VALUES %s
ON CONFLICT (row_hash) DO UPDATE SET
  sale_id = EXCLUDED.sale_id,
  sale_date = EXCLUDED.sale_date,
  location = EXCLUDED.location,
  manufacturer = EXCLUDED.manufacturer,
  category = EXCLUDED.category,
  item_no = EXCLUDED.item_no,
  item_description = EXCLUDED.item_description,
  qty_sold = EXCLUDED.qty_sold,
  total_cost = EXCLUDED.total_cost,
  total_sale_price = EXCLUDED.total_sale_price,
  total_profit = EXCLUDED.total_profit,
  gross_margin = EXCLUDED.gross_margin,
  delivery_confirmed_date = EXCLUDED.delivery_confirmed_date,
  is_pro1st = EXCLUDED.is_pro1st,
  raw_source_file = EXCLUDED.raw_source_file,
  import_batch_id = EXCLUDED.import_batch_id;
"""

def to_date(s):
    # pandas handles most date formats; coerce invalid to NaT -> None
    if s is None:
        return None
    dt = pd.to_datetime(s, errors="coerce")
    if pd.isna(dt):
        return None
    return dt.date()

def to_num(x):
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except Exception:
        pass
    # handle strings like "$1,234.00", "(1,234.00)", "1,234.00-", or "35%"
    if isinstance(x, str):
        t = x.strip()
        if t == "":
            return None

        negative = False
        # Accounting negatives: "(123.45)"
        if t.startswith("(") and t.endswith(")"):
            negative = True
            t = t[1:-1].strip()
        # Trailing minus: "123.45-"
        if t.endswith("-") and t[:-1].strip():
            negative = True
            t = t[:-1].strip()

        # Remove common formatting
        t = (
            t.replace("$", "")
            .replace(",", "")
            .replace("\u00a0", " ")  # nbsp
            .strip()
        )
        if t.endswith("%"):
            t = t[:-1]
        if t.lower() == "nan":
            return None
        try:
            n = float(t)
            return -n if negative else n
        except:
            return None
    try:
        return float(x)
    except:
        return None

def clean_row(df: pd.DataFrame, source_file: str) -> pd.DataFrame:
    # normalize headers
    df.columns = [str(c).strip() for c in df.columns]

    # Some exports include separate before/after tax columns; merge them into the single clean columns.
    if "Adjustments Before Tax" in df.columns or "Adjustments After Tax" in df.columns:
        df["adjustments"] = df.get("Adjustments Before Tax", 0) + df.get("Adjustments After Tax", 0)
    if "Addit Fees Before Tax" in df.columns or "Addit Fees After Tax" in df.columns:
        df["additional_fees"] = df.get("Addit Fees Before Tax", 0) + df.get("Addit Fees After Tax", 0)

    # Prefer a single phone field when exports provide multiple.
    if "phone" not in df.columns:
        if "Cell Phone" in df.columns:
            df["phone"] = df["Cell Phone"]
        elif "Home Phone" in df.columns:
            df["phone"] = df["Home Phone"]

    # rename columns we care about
    present = {k:v for k,v in COLMAP.items() if k in df.columns}
    df = df.rename(columns=present)

    # ensure required id exists
    if "sale_id" not in df.columns:
        raise ValueError("Missing required column: 'Sales#' (mapped to sale_id)")

    df["raw_source_file"] = source_file

    # create any missing clean columns as None
    for c in CLEAN_COLS:
        if c not in df.columns:
            df[c] = None

    df = df[CLEAN_COLS].copy()

    # trim sale_id
    df["sale_id"] = df["sale_id"].astype(str).str.strip()
    df = df[df["sale_id"].notna() & (df["sale_id"] != "")]

    # dates
    for c in ["sale_date","est_delivery_date","delivery_confirmed_date","last_payment_date"]:
        df[c] = df[c].apply(to_date)

    # numbers
    for c in [
        "subtotal",
        "adjustments",
        "additional_fees",
        "tax",
        "grand_total",
        "store_credit_applied",
        "previous_paid",
        "total_collected",
        "total_finance_amt",
        "finance_fee",
        "finance_balance",
        "lwy_balance",
        "cost",
        "profit",
        "gross_margin",
    ]:
        df[c] = df[c].apply(to_num)

    return df

def compute_sales_date_range(df: pd.DataFrame) -> tuple[str, str, str]:
    sale_dates = df["sale_date"].dropna().tolist()
    if sale_dates:
        start = min(sale_dates).isoformat()
        end = max(sale_dates).isoformat()
        return ("sale_date", start, end)
    # Fallback only when sales date is missing from the source file.
    delivery_dates = df["delivery_confirmed_date"].dropna().tolist()
    if delivery_dates:
        start = min(delivery_dates).isoformat()
        end = max(delivery_dates).isoformat()
        return ("delivery_confirmed_date", start, end)
    return ("sale_date", "1900-01-01", "1900-01-01")

def is_sales_report(df: pd.DataFrame) -> bool:
    cols = {str(c).strip().lower() for c in df.columns}
    required = {"sales#", "date of sale", "sales person", "sales location", "grand total"}
    # allow for alternate label "sale #" in some exports
    if "sales#" not in cols and "sale #" in cols:
        cols.add("sales#")
    return required.issubset(cols)

def is_item_export(df: pd.DataFrame) -> bool:
    cols = {str(c).strip().lower() for c in df.columns}
    required = {"sale #", "sales date", "item #", "item description", "qty sold", "total sale price"}
    if "sales#" in cols and "sale #" not in cols:
        cols.add("sale #")
    return required.issubset(cols)

def batch_key_from_filename(name: str) -> str | None:
    import re
    m = re.match(r"^(sales_report|topitems_report)(\d+)\.(xlsx|xls)$", name, re.IGNORECASE)
    if not m:
        return None
    return m.group(2)

def upsert_batch(cur, batch_key: str, sales_file: str | None, items_file: str | None, warnings: str) -> int:
    cur.execute(
        """
        INSERT INTO pos_import_batch (batch_key, sales_file, items_file, warnings, updated_at)
        VALUES (%s, %s, %s, %s, now())
        ON CONFLICT (batch_key) DO UPDATE SET
          sales_file = EXCLUDED.sales_file,
          items_file = EXCLUDED.items_file,
          warnings = EXCLUDED.warnings,
          updated_at = now()
        RETURNING id;
        """,
        (batch_key, sales_file, items_file, warnings),
    )
    return int(cur.fetchone()[0])

def clean_item_rows(df: pd.DataFrame, source_file: str) -> pd.DataFrame:
    df.columns = [str(c).strip() for c in df.columns]
    present = {k:v for k,v in ITEM_COLMAP.items() if k in df.columns}
    df = df.rename(columns=present)

    if "sale_id" not in df.columns:
        raise ValueError("Missing required column: 'Sale #' (mapped to sale_id)")

    df["raw_source_file"] = source_file

    for c in ITEM_COLS:
        if c not in df.columns:
            df[c] = None

    df = df[ITEM_COLS].copy()

    df["sale_id"] = df["sale_id"].astype(str).str.strip()
    df = df[df["sale_id"].notna() & (df["sale_id"] != "")]

    df["sale_date"] = df["sale_date"].apply(to_date)
    df["delivery_confirmed_date"] = df["delivery_confirmed_date"].apply(to_date)

    for c in [
        "qty_sold",
        "total_cost",
        "total_sale_price",
        "total_profit",
        "gross_margin",
    ]:
        df[c] = df[c].apply(to_num)

    def is_pro1st_row(row) -> bool:
        fields = [
            row.get("item_description"),
            row.get("category"),
            row.get("item_no"),
            row.get("manufacturer"),
        ]
        normalized = [str(val).lower() for val in fields if val]
        excluded_terms = (
            "mattress",
            "box spring",
            "box springs",
            "boxspring",
            "boxsprings",
            "foundation",
            "foundations",
            "adjustable base",
            "adjustable bases",
            "power base",
            "power bases",
            "bunkie board",
            "bunkie boards",
        )
        if any(term in s for s in normalized for term in excluded_terms):
            return False
        for val in fields:
            if not val:
                continue
            s = str(val).lower()
            if "pro1st" in s or "pro 1st" in s or "pro-1st" in s:
                return True
        return False

    df["is_pro1st"] = df.apply(is_pro1st_row, axis=1)

    return df

def row_hash_from_values(values: list, source_file: str, row_index: int, batch_key: str) -> str:
    import hashlib, json as _json
    payload = _json.dumps([batch_key, source_file, row_index, values], default=str, sort_keys=False)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()

def main():
    ap = argparse.ArgumentParser(description="Import POS export XLSX files into Postgres (upsert by sale_id).")
    ap.add_argument("--incoming", default=INCOMING, help="Folder to scan for XLSX files (default: %(default)s)")
    ap.add_argument("--processed", default=PROCESSED, help="Folder to move processed XLSX files into (default: %(default)s)")
    ap.add_argument("--include-processed", action="store_true", help="Also scan the processed folder (useful for re-imports)")
    ap.add_argument("--no-move", action="store_true", help="Do not move processed files")
    ap.add_argument("--allow-id-collisions", action="store_true", help="Allow sale_id collisions across different dates (not recommended)")
    args = ap.parse_args()

    incoming_dir = args.incoming
    processed_dir = args.processed

    os.makedirs(incoming_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)

    files = sorted(glob.glob(os.path.join(incoming_dir, "*.xlsx"))) + sorted(glob.glob(os.path.join(incoming_dir, "*.xls")))
    if args.include_processed:
        files += sorted(glob.glob(os.path.join(processed_dir, "*.xlsx"))) + sorted(glob.glob(os.path.join(processed_dir, "*.xls")))
        files = sorted(set(files))

    if not files:
        print(f"No XLSX files in {incoming_dir}" + (" or processed" if args.include_processed else ""))
        return

    conn = psycopg2.connect(**PG)
    try:
        with conn, conn.cursor() as cur:
            batches = {}
            for path in files:
                source = os.path.basename(path)
                key = batch_key_from_filename(source) or f"file:{source}"
                entry = batches.setdefault(key, {"files": [], "sales_file": None, "items_file": None, "warnings": []})
                entry["files"].append(path)
                if source.lower().startswith("sales_report"):
                    entry["sales_file"] = source
                if source.lower().startswith("topitems_report"):
                    entry["items_file"] = source

            for batch_key, entry in batches.items():
                warnings = []
                if not entry["sales_file"] or not entry["items_file"]:
                    warnings.append("Expected sales_report and topitems_report pair for batch.")
                warnings.extend(entry["warnings"])
                warning_text = "; ".join(warnings)
                batch_id = upsert_batch(cur, batch_key, entry["sales_file"], entry["items_file"], warning_text)

                entries = []
                for path in entry["files"]:
                    source = os.path.basename(path)
                    df = read_pos_excel(path)
                    if is_sales_report(df):
                        df2 = clean_row(df, source)
                        date_field, range_start, range_end = compute_sales_date_range(df2)
                        if isinstance(range_start, str):
                            range_start = pd.to_datetime(range_start).date()
                        if isinstance(range_end, str):
                            range_end = pd.to_datetime(range_end).date()
                        if not range_start or not range_end:
                            span_days = 0
                        else:
                            span_days = (range_end - range_start).days if range_start <= range_end else 0
                        entries.append({
                            "type": "sales",
                            "path": path,
                            "source": source,
                            "df": df,
                            "df2": df2,
                            "date_field": date_field,
                            "range_start": range_start,
                            "range_end": range_end,
                            "span_days": span_days,
                        })
                    elif is_item_export(df):
                        df2 = clean_item_rows(df, source)
                        sale_ids = list({str(x).strip() for x in df2["sale_id"].tolist() if str(x).strip()})
                        entries.append({
                            "type": "items",
                            "path": path,
                            "source": source,
                            "df": df,
                            "df2": df2,
                            "sale_ids": sale_ids,
                            "sale_count": len(sale_ids),
                        })
                    else:
                        entries.append({
                            "type": "unknown",
                            "path": path,
                            "source": source,
                        })

                sales_entries = sorted(
                    [e for e in entries if e.get("type") == "sales"],
                    key=lambda e: (e.get("span_days", 0), e.get("source", "")),
                    reverse=True,
                )
                item_entries = sorted(
                    [e for e in entries if e.get("type") == "items"],
                    key=lambda e: (e.get("sale_count", 0), e.get("source", "")),
                    reverse=True,
                )
                other_entries = [e for e in entries if e.get("type") == "unknown"]
                ordered_entries = sales_entries + item_entries + other_entries

                for entry_info in ordered_entries:
                    source = entry_info["source"]
                    print(f"\n=== Importing {source} (batch {batch_key}) ===")
                    entry_type = entry_info.get("type")
                    if entry_type == "sales":
                        df2 = entry_info["df2"]
                        date_field = entry_info["date_field"]
                        range_start = entry_info["range_start"]
                        range_end = entry_info["range_end"]
                        if range_start and range_end and range_start <= range_end:
                            print(f"Detected sales range {date_field} between {range_start} and {range_end} (no date-range deletes).")
                        raw_df = entry_info["df"].copy()
                        raw_df.columns = [str(c).strip() for c in raw_df.columns]
                        raw_rows = []
                        clean_rows = []

                        # Safety: detect sale_id collisions (common if Sales# resets each year)
                        sale_ids = list({str(x).strip() for x in df2["sale_id"].tolist() if str(x).strip()})
                        if sale_ids:
                            cur.execute(
                                "SELECT sale_id, sale_date FROM pos_sales WHERE sale_id = ANY(%s)",
                                (sale_ids,),
                            )
                            existing = {r[0]: (r[1].isoformat() if r[1] else None) for r in cur.fetchall()}
                            collisions = []
                            for _, row in df2.iterrows():
                                sid = row["sale_id"]
                                if sid in existing and existing[sid] and row["sale_date"] and existing[sid] != row["sale_date"].isoformat():
                                    collisions.append((sid, existing[sid], row["sale_date"].isoformat()))
                            if collisions:
                                print("\n⚠️ Detected sale_id collisions with different sale_date. Latest import will overwrite by sale_id.")
                                for sid, prev, nxt in collisions[:25]:
                                    print(f"  sale_id={sid} existing={prev} incoming={nxt}")
                                if len(collisions) > 25:
                                    print(f"  ... and {len(collisions) - 25} more")

                        for idx, row in df2.iterrows():
                            raw_json = {k: json_safe(v) for k, v in (raw_df.loc[idx].to_dict() if idx in raw_df.index else {}).items()}
                            raw_rows.append((
                                row["sale_id"],
                                row["sale_date"],
                                source,
                                batch_id,
                                Json(raw_json),
                            ))
                            clean_rows.append(tuple(row[c] for c in CLEAN_COLS) + (batch_id,))

                        execute_values(cur, UPSERT_RAW, raw_rows, page_size=2000)
                        execute_values(cur, UPSERT_CLEAN, clean_rows, page_size=2000)

                        print(f"Upserted: {len(clean_rows)} rows (clean) + {len(raw_rows)} rows (raw)")
                    elif entry_type == "items":
                        df2 = entry_info["df2"]
                        sale_ids = entry_info["sale_ids"]
                        if sale_ids:
                            print(f"Replacing existing item data for {len(sale_ids)} sales (latest upload wins)...")
                            cur.execute(
                                """
                                DELETE FROM pos_sale_items_raw
                                WHERE sale_id = ANY(%s)
                                  AND (import_batch_id IS NULL OR import_batch_id <= %s);
                                """,
                                (sale_ids, batch_id),
                            )
                            cur.execute(
                                """
                                DELETE FROM pos_sale_items
                                WHERE sale_id = ANY(%s)
                                  AND (import_batch_id IS NULL OR import_batch_id <= %s);
                                """,
                                (sale_ids, batch_id),
                            )
                        raw_df = entry_info["df"].copy()
                        raw_df.columns = [str(c).strip() for c in raw_df.columns]
                        raw_rows = []
                        clean_rows = []

                        for idx, row in df2.iterrows():
                            raw_json = {k: json_safe(v) for k, v in (raw_df.loc[idx].to_dict() if idx in raw_df.index else {}).items()}
                            values = [row[c] for c in ITEM_COLS]
                            row_hash = row_hash_from_values(values, source, int(idx) if isinstance(idx, (int, float)) else 0, batch_key)
                            raw_rows.append((
                                row_hash,
                                row["sale_id"],
                                row["sale_date"],
                                source,
                                batch_id,
                                Json(raw_json),
                            ))
                            clean_rows.append((row_hash,) + tuple(row[c] for c in ITEM_COLS) + (batch_id,))

                        execute_values(cur, UPSERT_ITEMS_RAW, raw_rows, page_size=2000)
                        execute_values(cur, UPSERT_ITEMS, clean_rows, page_size=2000)

                        print(f"Upserted: {len(clean_rows)} item rows")
                    else:
                        print("Skipped: unrecognized export type.")
                        continue

                    if args.no_move:
                        print("Skipped moving file (--no-move).")
                    else:
                        dest = os.path.join(processed_dir, source)
                        if os.path.abspath(path) != os.path.abspath(dest):
                            shutil.move(path, dest)
                            print(f"Moved to processed: {dest}")
                        else:
                            print("File already in processed folder.")

        print("\n✅ Done.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
