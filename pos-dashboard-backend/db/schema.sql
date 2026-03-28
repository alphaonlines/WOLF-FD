-- RAW: store full row so imports never break if columns change
CREATE TABLE IF NOT EXISTS pos_sales_raw (
  sale_id         TEXT PRIMARY KEY,
  sale_date       DATE,
  raw_source_file TEXT,
  import_batch_id BIGINT,
  row_json        JSONB NOT NULL,
  imported_at     TIMESTAMPTZ DEFAULT now()
);

-- CLEAN: columns you’ll chart/filter on
CREATE TABLE IF NOT EXISTS pos_sales (
  sale_id                 TEXT PRIMARY KEY,
  sale_date               DATE,
  est_delivery_date       DATE,
  delivery_confirmed_date DATE,
  last_payment_date       DATE,

  salesperson             TEXT,
  location                TEXT,

  receipt_no              TEXT,

  subtotal                NUMERIC,
  adjustments             NUMERIC,
  additional_fees         NUMERIC,
  tax                     NUMERIC,
  grand_total             NUMERIC,
  store_credit_applied    NUMERIC,
  previous_paid           NUMERIC,
  total_collected         NUMERIC,

  total_finance_amt       NUMERIC,
  finance_fee             NUMERIC,
  finance_balance         NUMERIC,
  lwy_balance             NUMERIC,

  cost                    NUMERIC,
  profit                  NUMERIC,
  gross_margin            NUMERIC,

  customer_name           TEXT,
  phone                   TEXT,
  print_letter            TEXT,
  delivery                TEXT,
  note                    TEXT,
  sale_type               TEXT,
  sale_status             TEXT,
  city                    TEXT,
  state                   TEXT,
  zip                     TEXT,

  raw_source_file         TEXT,
  last_import_batch_id    BIGINT,
  imported_at             TIMESTAMPTZ DEFAULT now()
);

-- Import batches (pair of files per update)
CREATE TABLE IF NOT EXISTS pos_import_batch (
  id            BIGSERIAL PRIMARY KEY,
  batch_key     TEXT UNIQUE NOT NULL,
  sales_file    TEXT,
  items_file    TEXT,
  warnings      TEXT,
  imported_at   TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Line items (from topitems / items exports)
CREATE TABLE IF NOT EXISTS pos_sale_items_raw (
  row_hash        TEXT PRIMARY KEY,
  sale_id         TEXT,
  sale_date       DATE,
  raw_source_file TEXT,
  import_batch_id BIGINT,
  row_json        JSONB NOT NULL,
  imported_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_sale_items (
  row_hash            TEXT PRIMARY KEY,
  sale_id             TEXT,
  sale_date           DATE,
  location            TEXT,
  manufacturer        TEXT,
  category            TEXT,
  item_no             TEXT,
  item_description    TEXT,
  qty_sold            NUMERIC,
  total_cost          NUMERIC,
  total_sale_price    NUMERIC,
  total_profit        NUMERIC,
  gross_margin        NUMERIC,
  delivery_confirmed_date DATE,
  is_pro1st           BOOLEAN DEFAULT FALSE,
  raw_source_file     TEXT,
  import_batch_id     BIGINT,
  imported_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pos_sales_raw ADD COLUMN IF NOT EXISTS import_batch_id BIGINT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS last_import_batch_id BIGINT;
ALTER TABLE pos_sale_items_raw ADD COLUMN IF NOT EXISTS import_batch_id BIGINT;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS import_batch_id BIGINT;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS is_pro1st BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale_id ON pos_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_category ON pos_sale_items(category);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_item_no ON pos_sale_items(item_no);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_batch ON pos_sale_items(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_pro1st ON pos_sale_items(is_pro1st);
CREATE INDEX IF NOT EXISTS idx_pos_sales_batch ON pos_sales(last_import_batch_id);

-- Ensure columns exist for older DB volumes (safe no-ops when already present)
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS adjustments NUMERIC;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS additional_fees NUMERIC;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS store_credit_applied NUMERIC;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS previous_paid NUMERIC;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS lwy_balance NUMERIC;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS print_letter TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS delivery TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS sale_type TEXT;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS sale_status TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_sales_date ON pos_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_pos_sales_salesperson ON pos_sales(salesperson);


CREATE INDEX IF NOT EXISTS idx_pos_sales_location ON pos_sales(location);

CREATE TABLE IF NOT EXISTS manufacturer_pricebook_uploads (
  id                  BIGSERIAL PRIMARY KEY,
  manufacturer        TEXT NOT NULL,
  manufacturer_slug   TEXT NOT NULL,
  original_name       TEXT NOT NULL,
  storage_name        TEXT NOT NULL,
  relative_path       TEXT NOT NULL,
  mime_type           TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size_bytes     BIGINT NOT NULL DEFAULT 0,
  replace_existing    BOOLEAN NOT NULL DEFAULT TRUE,
  status              TEXT NOT NULL DEFAULT 'holding',
  uploaded_by_user_id BIGINT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS manufacturer_slug TEXT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS storage_name TEXT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS relative_path TEXT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS replace_existing BOOLEAN;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS uploaded_by_user_id BIGINT;
ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN mime_type SET DEFAULT 'application/octet-stream';
ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN file_size_bytes SET DEFAULT 0;
ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN replace_existing SET DEFAULT TRUE;
ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN status SET DEFAULT 'holding';
ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_manufacturer_pricebook_uploads_manufacturer_created
  ON manufacturer_pricebook_uploads(manufacturer, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manufacturer_pricebook_uploads_status_created
  ON manufacturer_pricebook_uploads(status, created_at DESC);

-- Analytics: split "A and B" (or "A & B") combos into one row per person.
-- Totals are split evenly across the participants.
CREATE OR REPLACE VIEW pos_sales_people AS
WITH base AS (
  SELECT
    sale_id,
    sale_date,
    location,
    CASE
      WHEN grand_total IS NULL OR grand_total <> grand_total THEN 0
      ELSE grand_total
    END AS grand_total,
    CASE
      WHEN profit IS NULL OR profit <> profit THEN 0
      ELSE profit
    END AS profit,
    CASE
      WHEN total_finance_amt IS NULL OR total_finance_amt <> total_finance_amt THEN 0
      ELSE total_finance_amt
    END AS total_finance_amt,
    CASE
      WHEN finance_fee IS NULL OR finance_fee <> finance_fee THEN 0
      ELSE finance_fee
    END AS finance_fee,
    CASE
      WHEN finance_balance IS NULL OR finance_balance <> finance_balance THEN 0
      ELSE finance_balance
    END AS finance_balance,
    regexp_split_to_array(
      regexp_replace(COALESCE(salesperson, ''), E'\\s*&\\s*', ' and ', 'g'),
      E'\\s+and\\s+',
      'i'
    ) AS people
  FROM pos_sales
),
expanded AS (
  SELECT
    sale_id,
    sale_date,
    location,
    grand_total,
    profit,
    total_finance_amt,
    finance_fee,
    finance_balance,
    NULLIF(trim(p.person), '') AS salesperson,
    array_length(people, 1) AS people_count
  FROM base
  CROSS JOIN LATERAL unnest(people) AS p(person)
)
SELECT
  sale_id,
  sale_date,
  location,
  salesperson,
  grand_total / NULLIF(people_count, 0) AS grand_total_split,
  profit / NULLIF(people_count, 0) AS profit_split,
  total_finance_amt / NULLIF(people_count, 0) AS total_finance_amt_split,
  finance_fee / NULLIF(people_count, 0) AS finance_fee_split,
  finance_balance / NULLIF(people_count, 0) AS finance_balance_split
FROM expanded;

-- Simple shared task board (used by frontend Tasks page)
CREATE TABLE IF NOT EXISTS tasks (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  assignee   TEXT NOT NULL DEFAULT 'Unassigned',
  status     TEXT NOT NULL DEFAULT 'TODO',
  priority   TEXT NOT NULL DEFAULT 'medium',
  deadline   DATE NULL,
  sort_index INT NOT NULL DEFAULT 0,
  responded_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist for older DB volumes (safe no-ops when already present)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_index INT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Defaults (safe to re-run)
ALTER TABLE tasks ALTER COLUMN assignee SET DEFAULT 'Unassigned';
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'TODO';
ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE tasks ALTER COLUMN sort_index SET DEFAULT 0;
ALTER TABLE tasks ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE tasks ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tasks_status_sort ON tasks(status, sort_index, id);

-- Public web tracking for reusable page analytics across WOLF sites
CREATE TABLE IF NOT EXISTS web_page_events (
  id           BIGSERIAL PRIMARY KEY,
  site         TEXT NOT NULL DEFAULT '',
  page_path    TEXT NOT NULL DEFAULT '/',
  page_url     TEXT NOT NULL DEFAULT '',
  page_title   TEXT NOT NULL DEFAULT '',
  event_type   TEXT NOT NULL DEFAULT 'pageview',
  event_name   TEXT NOT NULL DEFAULT '',
  element_text TEXT NOT NULL DEFAULT '',
  link_url     TEXT NOT NULL DEFAULT '',
  referrer     TEXT NOT NULL DEFAULT '',
  visitor_id   TEXT NOT NULL DEFAULT '',
  session_id   TEXT NOT NULL DEFAULT '',
  ip_address   TEXT NOT NULL DEFAULT '',
  user_agent   TEXT NOT NULL DEFAULT '',
  meta_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS site TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS page_path TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS page_url TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS page_title TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS element_text TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS meta_json JSONB;
ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_web_page_events_created_at ON web_page_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_page_events_site_page_created ON web_page_events(site, page_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_page_events_site_type_created ON web_page_events(site, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_page_events_site_visitor_created ON web_page_events(site, visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_page_events_site_session_created ON web_page_events(site, session_id, created_at DESC);

-- CRM: shared lead pipeline + automation controls
CREATE TABLE IF NOT EXISTS crm_leads (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'SMS',
  source       TEXT NOT NULL DEFAULT 'Website',
  interest     TEXT NOT NULL DEFAULT '',
  budget       TEXT NOT NULL DEFAULT 'Unspecified',
  store        TEXT NOT NULL DEFAULT 'FD7',
  owner        TEXT NOT NULL DEFAULT 'Unassigned',
  owner_user_id BIGINT NULL,
  stage        TEXT NOT NULL DEFAULT 'New',
  next_action  TEXT NOT NULL DEFAULT 'First contact',
  due_date     DATE NULL,
  last_message TEXT NOT NULL DEFAULT '',
  last_touch   TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS interest TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS store TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS last_touch TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE crm_leads ALTER COLUMN channel SET DEFAULT 'SMS';
ALTER TABLE crm_leads ALTER COLUMN source SET DEFAULT 'Website';
ALTER TABLE crm_leads ALTER COLUMN budget SET DEFAULT 'Unspecified';
ALTER TABLE crm_leads ALTER COLUMN store SET DEFAULT 'FD7';
ALTER TABLE crm_leads ALTER COLUMN owner SET DEFAULT 'Unassigned';
ALTER TABLE crm_leads ALTER COLUMN stage SET DEFAULT 'New';
ALTER TABLE crm_leads ALTER COLUMN next_action SET DEFAULT 'First contact';
ALTER TABLE crm_leads ALTER COLUMN last_message SET DEFAULT '';
ALTER TABLE crm_leads ALTER COLUMN last_touch SET DEFAULT '';
ALTER TABLE crm_leads ALTER COLUMN notes SET DEFAULT '';
ALTER TABLE crm_leads ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE crm_leads ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_due ON crm_leads(stage, due_date, id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner ON crm_leads(owner);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_user_id ON crm_leads(owner_user_id);

CREATE TABLE IF NOT EXISTS crm_automations (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_automations ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE crm_automations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE crm_automations ADD COLUMN IF NOT EXISTS enabled BOOLEAN;
ALTER TABLE crm_automations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE crm_automations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE crm_automations ALTER COLUMN description SET DEFAULT '';
ALTER TABLE crm_automations ALTER COLUMN enabled SET DEFAULT TRUE;
ALTER TABLE crm_automations ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE crm_automations ALTER COLUMN updated_at SET DEFAULT now();

CREATE TABLE IF NOT EXISTS crm_ups_items (
  id            TEXT PRIMARY KEY,
  customer      TEXT NOT NULL,
  task          TEXT NOT NULL DEFAULT '',
  owner         TEXT NOT NULL DEFAULT 'Unassigned',
  owner_user_id BIGINT NULL,
  lane          TEXT NOT NULL DEFAULT 'Unattended',
  priority      TEXT NOT NULL DEFAULT 'Today',
  due_at        DATE NULL,
  channel       TEXT NOT NULL DEFAULT 'SMS',
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  started_at    TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS customer TEXT;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS task TEXT;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS lane TEXT;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS due_at DATE;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS done BOOLEAN;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE crm_ups_items ALTER COLUMN task SET DEFAULT '';
ALTER TABLE crm_ups_items ALTER COLUMN owner SET DEFAULT 'Unassigned';
ALTER TABLE crm_ups_items ALTER COLUMN lane SET DEFAULT 'Unattended';
ALTER TABLE crm_ups_items ALTER COLUMN priority SET DEFAULT 'Today';
ALTER TABLE crm_ups_items ALTER COLUMN channel SET DEFAULT 'SMS';
ALTER TABLE crm_ups_items ALTER COLUMN done SET DEFAULT FALSE;
ALTER TABLE crm_ups_items ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE crm_ups_items ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_crm_ups_owner_user_id ON crm_ups_items(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_ups_done ON crm_ups_items(done, updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_ups_queue (
  id                    TEXT PRIMARY KEY,
  store                 TEXT NOT NULL DEFAULT 'FD7',
  rep                   TEXT NOT NULL,
  rep_user_id           BIGINT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'waiting',
  queue_position        INTEGER NOT NULL DEFAULT 1,
  checked_in_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_customer      TEXT NULL,
  current_customer_type TEXT NULL,
  started_at            TIMESTAMPTZ NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS store TEXT;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS rep TEXT;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS rep_user_id BIGINT;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_customer TEXT;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_customer_type TEXT;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE crm_ups_queue ALTER COLUMN store SET DEFAULT 'FD7';
ALTER TABLE crm_ups_queue ALTER COLUMN status SET DEFAULT 'waiting';
ALTER TABLE crm_ups_queue ALTER COLUMN checked_in_at SET DEFAULT now();
ALTER TABLE crm_ups_queue ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE crm_ups_queue ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_crm_ups_queue_store_pos ON crm_ups_queue(store, queue_position ASC);
CREATE INDEX IF NOT EXISTS idx_crm_ups_queue_rep_user_id ON crm_ups_queue(rep_user_id);

CREATE TABLE IF NOT EXISTS crm_customers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  store       TEXT NOT NULL DEFAULT 'FD7',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS store TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE crm_customers ALTER COLUMN phone SET DEFAULT '';
ALTER TABLE crm_customers ALTER COLUMN email SET DEFAULT '';
ALTER TABLE crm_customers ALTER COLUMN store SET DEFAULT 'FD7';
ALTER TABLE crm_customers ALTER COLUMN notes SET DEFAULT '';
ALTER TABLE crm_customers ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE crm_customers ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_crm_customers_phone ON crm_customers(phone);
CREATE INDEX IF NOT EXISTS idx_crm_customers_email_lower ON crm_customers((lower(email)));

CREATE TABLE IF NOT EXISTS board_posts (
  id             BIGSERIAL PRIMARY KEY,
  channel        TEXT NOT NULL DEFAULT 'announcements',
  body           TEXT NOT NULL,
  priority       BOOLEAN NOT NULL DEFAULT FALSE,
  author_name    TEXT NOT NULL,
  author_email   TEXT NOT NULL,
  author_user_id BIGINT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS priority BOOLEAN;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS author_user_id BIGINT;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE board_posts ALTER COLUMN channel SET DEFAULT 'announcements';
ALTER TABLE board_posts ALTER COLUMN priority SET DEFAULT FALSE;
ALTER TABLE board_posts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE board_posts ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_board_posts_channel_created ON board_posts(channel, created_at DESC);

CREATE TABLE IF NOT EXISTS board_comments (
  id             BIGSERIAL PRIMARY KEY,
  post_id        BIGINT NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  author_name    TEXT NOT NULL,
  author_email   TEXT NOT NULL,
  author_user_id BIGINT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS post_id BIGINT;
ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS author_user_id BIGINT;
ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE board_comments ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE board_comments ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_board_comments_post_id_created ON board_comments(post_id, created_at ASC);

-- Employee auth/session foundation
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT,
  salesperson_name TEXT,
  google_sub    TEXT UNIQUE,
  auth_provider TEXT NOT NULL DEFAULT 'password',
  access_status TEXT NOT NULL DEFAULT 'approved',
  access_requested_at TIMESTAMPTZ,
  access_approved_at TIMESTAMPTZ,
  approved_by_user_id BIGINT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS salesperson_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_approved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by_user_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE users ALTER COLUMN auth_provider SET DEFAULT 'password';
ALTER TABLE users ALTER COLUMN access_status SET DEFAULT 'approved';
ALTER TABLE users ALTER COLUMN active SET DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();
UPDATE users
SET first_name = COALESCE(NULLIF(first_name, ''), NULLIF(split_part(trim(name), ' ', 1), '')),
    last_name = COALESCE(
      NULLIF(last_name, ''),
      NULLIF(trim(regexp_replace(trim(name), '^\S+\s*', '')), '')
    )
WHERE COALESCE(trim(name), '') <> '';
UPDATE users SET auth_provider = COALESCE(NULLIF(auth_provider, ''), 'password') WHERE auth_provider IS NULL OR auth_provider = '';
UPDATE users SET access_status = COALESCE(NULLIF(access_status, ''), 'approved') WHERE access_status IS NULL OR access_status = '';
UPDATE users SET access_approved_at = COALESCE(access_approved_at, created_at, now()) WHERE access_status = 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_access_status ON users(access_status);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent    TEXT,
  ip_address    TEXT
);

ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE auth_sessions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE auth_sessions ALTER COLUMN last_seen_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS roles (
  id         BIGSERIAL PRIMARY KEY,
  role_key   TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_key TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE roles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE roles ALTER COLUMN updated_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_key ON roles(role_key);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role_id BIGINT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE user_roles ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key  TEXT NOT NULL,
  allowed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);

ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS role_id BIGINT;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS permission_key TEXT;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS allowed BOOLEAN;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE role_permissions ALTER COLUMN allowed SET DEFAULT FALSE;
ALTER TABLE role_permissions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE role_permissions ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON role_permissions(permission_key);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key  TEXT NOT NULL,
  allowed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS permission_key TEXT;
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS allowed BOOLEAN;
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE user_permissions ALTER COLUMN allowed SET DEFAULT FALSE;
ALTER TABLE user_permissions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE user_permissions ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_key ON user_permissions(permission_key);
