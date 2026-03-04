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

-- Employee auth/session foundation
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE users ALTER COLUMN active SET DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)));

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
