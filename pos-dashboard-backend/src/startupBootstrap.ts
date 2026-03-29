import type { Pool } from "pg";
import { PERMISSION_CATALOG, getRoleDefaultPermissionKeys } from "./permissionCatalog";

type RunStartupBootstrapDeps = {
  pool: Pool;
  envString: (key: string, fallback?: string) => string | undefined;
  hashPassword: (password: string, saltHex?: string) => string;
  setUserRolesByKeys: (userId: number, roleKeys: string[]) => Promise<void>;
};

async function ensureAuthSchema(pool: Pool) {
  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS salesperson_name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_requested_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_approved_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by_user_id BIGINT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN auth_provider SET DEFAULT 'password';`);
  await pool.query(`ALTER TABLE users ALTER COLUMN access_status SET DEFAULT 'approved';`);
  await pool.query(`ALTER TABLE users ALTER COLUMN active SET DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`
    UPDATE users
    SET first_name = COALESCE(NULLIF(first_name, ''), NULLIF(split_part(trim(name), ' ', 1), '')),
        last_name = COALESCE(
          NULLIF(last_name, ''),
          NULLIF(trim(regexp_replace(trim(name), '^\\S+\\s*', '')), '')
        )
    WHERE COALESCE(trim(name), '') <> '';
  `);
  await pool.query(`UPDATE users SET auth_provider = COALESCE(NULLIF(auth_provider, ''), 'password') WHERE auth_provider IS NULL OR auth_provider = '';`);
  await pool.query(`UPDATE users SET access_status = COALESCE(NULLIF(access_status, ''), 'approved') WHERE access_status IS NULL OR access_status = '';`);
  await pool.query(`UPDATE users SET access_approved_at = COALESCE(access_approved_at, created_at, now()) WHERE access_status = 'approved';`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)));`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_access_status ON users(access_status);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id         BIGSERIAL PRIMARY KEY,
      role_key   TEXT NOT NULL UNIQUE,
      label      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_key TEXT;`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS label TEXT;`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE roles ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE roles ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_key ON roles(role_key);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id    BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, role_id)
    );
  `);
  await pool.query(`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS user_id BIGINT;`);
  await pool.query(`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role_id BIGINT;`);
  await pool.query(`ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE user_roles ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);`);

  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_id BIGINT;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
  await pool.query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;`);
  await pool.query(`ALTER TABLE auth_sessions ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE auth_sessions ALTER COLUMN last_seen_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id         BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_key  TEXT NOT NULL,
      allowed         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (role_id, permission_key)
    );
  `);
  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS role_id BIGINT;`);
  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS permission_key TEXT;`);
  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS allowed BOOLEAN;`);
  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE role_permissions ALTER COLUMN allowed SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE role_permissions ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE role_permissions ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON role_permissions(permission_key);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_key  TEXT NOT NULL,
      allowed         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, permission_key)
    );
  `);
  await pool.query(`ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS user_id BIGINT;`);
  await pool.query(`ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS permission_key TEXT;`);
  await pool.query(`ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS allowed BOOLEAN;`);
  await pool.query(`ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE user_permissions ALTER COLUMN allowed SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE user_permissions ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE user_permissions ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_permissions_key ON user_permissions(permission_key);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT PRIMARY KEY,
      value_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS key TEXT;`);
  await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS value_json JSONB;`);
  await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE app_settings ALTER COLUMN value_json SET DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE app_settings ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE app_settings ALTER COLUMN updated_at SET DEFAULT now();`);
}

async function ensureDefaultRoles(pool: Pool) {
  const roleRows = [
    { role_key: "Owner", label: "Owner" },
    { role_key: "Manager", label: "Manager" },
    { role_key: "Sales", label: "Sales" },
    { role_key: "Marketing", label: "Marketing" },
  ];
  for (const role of roleRows) {
    await pool.query(
      `
        INSERT INTO roles (role_key, label, created_at, updated_at)
        VALUES ($1, $2, now(), now())
        ON CONFLICT (role_key) DO UPDATE
        SET label = EXCLUDED.label, updated_at = now()
      `,
      [role.role_key, role.label]
    );
  }
}

async function ensureDefaultRolePermissions(pool: Pool) {
  const roles = await pool.query("SELECT id, role_key FROM roles");
  const roleRows = Array.isArray(roles.rows) ? roles.rows : [];
  for (const role of roleRows) {
    const roleId = Number(role.id);
    const roleKey = String(role.role_key || "");
    if (!Number.isFinite(roleId) || !roleKey) continue;
    const defaults = new Set(getRoleDefaultPermissionKeys(roleKey));
    for (const permission of PERMISSION_CATALOG) {
      const allowed = defaults.has(permission.key);
      await pool.query(
        `
          INSERT INTO role_permissions (role_id, permission_key, allowed, created_at, updated_at)
          VALUES ($1, $2, $3, now(), now())
          ON CONFLICT (role_id, permission_key) DO NOTHING
        `,
        [roleId, permission.key, allowed]
      );
    }
  }
}

async function ensureDefaultAuthUser({
  pool,
  envString,
  hashPassword,
  setUserRolesByKeys,
}: RunStartupBootstrapDeps) {
  const existing = await pool.query("SELECT COUNT(*)::int AS n FROM users;");
  const count = Number(existing.rows[0]?.n ?? 0);
  const defaultEmail = (envString("AUTH_BOOTSTRAP_EMAIL", "owner@wolffd.local") || "owner@wolffd.local").toLowerCase();
  if (count <= 0) {
    const defaultName = envString("AUTH_BOOTSTRAP_NAME", "WOLF FD Owner") || "WOLF FD Owner";
    const defaultPassword = envString("AUTH_BOOTSTRAP_PASSWORD", "1111") || "1111";
    const passwordHash = hashPassword(defaultPassword);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, active, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, now(), now())
       ON CONFLICT (email) DO NOTHING;`,
      [defaultName, defaultEmail, passwordHash]
    );
    console.log(`Auth bootstrap user ready: ${defaultEmail}`);
  }

  const ownerUser = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1", [defaultEmail]);
  if (ownerUser.rows.length) {
    await setUserRolesByKeys(Number(ownerUser.rows[0].id), ["Owner"]);
  }

  await pool.query(`
    INSERT INTO user_roles (user_id, role_id, created_at)
    SELECT u.id, r.id, now()
    FROM users u
    JOIN roles r ON r.role_key = 'Owner'
    WHERE NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
    )
    ON CONFLICT DO NOTHING;
  `);
}

async function ensureCrmSchema(pool: Pool) {
  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_due ON crm_leads(stage, due_date, id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_owner ON crm_leads(owner);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_user_id ON crm_leads(owner_user_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_automations (
      id          TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      enabled     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS customer TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS task TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS owner TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS lane TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS priority TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS due_at DATE;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS channel TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS done BOOLEAN;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN task SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN owner SET DEFAULT 'Unassigned';`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN lane SET DEFAULT 'Unattended';`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN priority SET DEFAULT 'Today';`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN channel SET DEFAULT 'SMS';`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN done SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_items ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_owner_user_id ON crm_ups_items(owner_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_done ON crm_ups_items(done, updated_at DESC);`);

  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS store TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS rep TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS rep_user_id BIGINT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS status TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS queue_position INTEGER;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_customer TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_customer_type TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_customer_details TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_weather_location TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_weather_summary TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_weather_temp_f NUMERIC(5,1);`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_weather_precip_pct INTEGER;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_weather_wind_mph NUMERIC(5,1);`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_weather_fetched_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS current_weather_source TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS active_history_id TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN store SET DEFAULT 'FD7';`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN status SET DEFAULT 'waiting';`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN rep_user_id DROP NOT NULL;`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN checked_in_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_queue_store_pos ON crm_ups_queue(store, queue_position ASC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_queue_rep_user_id ON crm_ups_queue(rep_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_queue_active_history_id ON crm_ups_queue(active_history_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_ups_active_customers (
      id               TEXT PRIMARY KEY,
      queue_entry_id   TEXT NOT NULL,
      history_id       TEXT NULL,
      store            TEXT NOT NULL DEFAULT 'FD7',
      rep              TEXT NOT NULL DEFAULT '',
      rep_user_id      BIGINT NULL,
      customer         TEXT NOT NULL DEFAULT '',
      customer_type    TEXT NULL,
      customer_details TEXT NOT NULL DEFAULT '',
      started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS queue_entry_id TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS history_id TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS store TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS rep TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS rep_user_id BIGINT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS customer TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS customer_type TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS customer_details TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS city TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS wants_needs TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS did_purchase BOOLEAN;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS purchase_amount NUMERIC(12,2);`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS objection_note TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN store SET DEFAULT 'FD7';`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN rep SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN customer SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN customer_details SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN city SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN wants_needs SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN objection_note SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN started_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_active_customers ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_active_customers_queue_entry_id ON crm_ups_active_customers(queue_entry_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_active_customers_history_id ON crm_ups_active_customers(history_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_active_customers_rep_user_id ON crm_ups_active_customers(rep_user_id);`);
  await pool.query(`
    INSERT INTO crm_ups_active_customers (
      id,
      queue_entry_id,
      history_id,
      store,
      rep,
      rep_user_id,
      customer,
      customer_type,
      customer_details,
      started_at,
      created_at,
      updated_at
    )
    SELECT
      'upactive-' || COALESCE(NULLIF(q.active_history_id, ''), q.id || '-' || floor(extract(epoch from COALESCE(q.started_at, now())))::text),
      q.id,
      q.active_history_id,
      q.store,
      q.rep,
      q.rep_user_id,
      q.current_customer,
      q.current_customer_type,
      COALESCE(q.current_customer_details, ''),
      COALESCE(q.started_at, now()),
      now(),
      now()
    FROM crm_ups_queue q
    WHERE
      q.status = 'working'
      AND COALESCE(NULLIF(q.current_customer, ''), '') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM crm_ups_active_customers ac
        WHERE ac.queue_entry_id = q.id
          AND (
            (q.active_history_id IS NOT NULL AND q.active_history_id <> '' AND ac.history_id = q.active_history_id)
            OR (
              (q.active_history_id IS NULL OR q.active_history_id = '')
              AND ac.customer = q.current_customer
              AND COALESCE(ac.started_at, now()) = COALESCE(q.started_at, now())
            )
          )
      );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_ups_history (
      id                          TEXT PRIMARY KEY,
      queue_entry_id              TEXT NOT NULL,
      store                       TEXT NOT NULL DEFAULT 'FD7',
      rep                         TEXT NOT NULL DEFAULT '',
      rep_user_id                 BIGINT NULL,
      customer                    TEXT NOT NULL DEFAULT '',
      customer_type               TEXT NULL,
      customer_details            TEXT NOT NULL DEFAULT '',
      city                        TEXT NOT NULL DEFAULT '',
      wants_needs                 TEXT NOT NULL DEFAULT '',
      did_purchase                BOOLEAN NULL,
      purchase_amount             NUMERIC(12,2) NULL,
      objection_note              TEXT NOT NULL DEFAULT '',
      started_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at                TIMESTAMPTZ NULL,
      weather_location            TEXT NULL,
      weather_summary             TEXT NULL,
      weather_temp_f              NUMERIC(5,1) NULL,
      weather_precip_pct          INTEGER NULL,
      weather_wind_mph            NUMERIC(5,1) NULL,
      weather_fetched_at          TIMESTAMPTZ NULL,
      weather_source              TEXT NULL,
      ended_reason                TEXT NOT NULL DEFAULT 'completed',
      counts_as_up                BOOLEAN NOT NULL DEFAULT TRUE,
      is_door_traffic             BOOLEAN NOT NULL DEFAULT TRUE,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS queue_entry_id TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS store TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS rep TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS rep_user_id BIGINT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS customer TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS customer_type TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS customer_details TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS city TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS wants_needs TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS did_purchase BOOLEAN;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS purchase_amount NUMERIC(12,2);`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS objection_note TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS weather_location TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS weather_summary TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS weather_temp_f NUMERIC(5,1);`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS weather_precip_pct INTEGER;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS weather_wind_mph NUMERIC(5,1);`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS weather_fetched_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS weather_source TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS ended_reason TEXT;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS counts_as_up BOOLEAN;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS is_door_traffic BOOLEAN;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN store SET DEFAULT 'FD7';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN rep SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN customer SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN customer_details SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN city SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN wants_needs SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN objection_note SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN ended_reason SET DEFAULT 'completed';`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN counts_as_up SET DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN is_door_traffic SET DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN started_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_history ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`UPDATE crm_ups_history SET ended_reason = COALESCE(NULLIF(ended_reason, ''), 'completed') WHERE ended_reason IS NULL OR ended_reason = '';`);
  await pool.query(`UPDATE crm_ups_history SET counts_as_up = TRUE WHERE counts_as_up IS NULL;`);
  await pool.query(`UPDATE crm_ups_history SET is_door_traffic = TRUE WHERE is_door_traffic IS NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_history_store_started_at ON crm_ups_history(store, started_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_history_queue_entry_id ON crm_ups_history(queue_entry_id);`);

  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS name TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS phone TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS store TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS channel TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS source TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS interest TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS budget TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS owner TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS stage TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS next_action TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS due_date DATE;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS last_message TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS last_touch TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN phone SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN email SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN store SET DEFAULT 'FD7';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN channel SET DEFAULT 'SMS';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN source SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN interest SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN budget SET DEFAULT 'Unspecified';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN owner SET DEFAULT 'Unassigned';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN stage SET DEFAULT 'New';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN next_action SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN last_message SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN last_touch SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN notes SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_phone ON crm_customers(phone);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_email_lower ON crm_customers((lower(email)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_owner_user_id ON crm_customers(owner_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_stage_due ON crm_customers(stage, due_date, id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_name_lower ON crm_customers((lower(name)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_notes_lower ON crm_customers((lower(notes)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_name_lower ON crm_leads((lower(name)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_notes_lower ON crm_leads((lower(notes)));`);
  await pool.query(`
    WITH matched_leads AS (
      SELECT
        l.*,
        COALESCE(
          (
            SELECT c.id
            FROM crm_customers c
            WHERE
              regexp_replace(COALESCE(l.phone, ''), '\\D', '', 'g') <> ''
              AND regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') = regexp_replace(COALESCE(l.phone, ''), '\\D', '', 'g')
            ORDER BY c.updated_at DESC
            LIMIT 1
          ),
          l.id
        ) AS merged_customer_id
      FROM crm_leads l
    )
    INSERT INTO crm_customers (
      id,
      name,
      phone,
      email,
      store,
      channel,
      source,
      interest,
      budget,
      owner,
      owner_user_id,
      stage,
      next_action,
      due_date,
      last_message,
      last_touch,
      notes,
      created_at,
      updated_at
    )
    SELECT
      merged_customer_id,
      COALESCE(NULLIF(name, ''), 'Unknown Customer'),
      COALESCE(phone, ''),
      '',
      COALESCE(NULLIF(store, ''), 'FD7'),
      COALESCE(NULLIF(channel, ''), 'SMS'),
      COALESCE(source, ''),
      COALESCE(interest, ''),
      COALESCE(NULLIF(budget, ''), 'Unspecified'),
      COALESCE(NULLIF(owner, ''), 'Unassigned'),
      owner_user_id,
      COALESCE(NULLIF(stage, ''), 'New'),
      COALESCE(next_action, ''),
      due_date,
      COALESCE(last_message, ''),
      COALESCE(last_touch, ''),
      COALESCE(notes, ''),
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM matched_leads
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(NULLIF(EXCLUDED.name, ''), crm_customers.name),
      phone = CASE WHEN COALESCE(NULLIF(crm_customers.phone, ''), '') = '' THEN EXCLUDED.phone ELSE crm_customers.phone END,
      store = CASE WHEN COALESCE(NULLIF(crm_customers.store, ''), '') = '' OR crm_customers.store = 'FD7' THEN EXCLUDED.store ELSE crm_customers.store END,
      channel = CASE WHEN COALESCE(NULLIF(crm_customers.channel, ''), '') = '' THEN EXCLUDED.channel ELSE crm_customers.channel END,
      source = CASE WHEN COALESCE(NULLIF(crm_customers.source, ''), '') = '' THEN EXCLUDED.source ELSE crm_customers.source END,
      interest = CASE WHEN COALESCE(NULLIF(crm_customers.interest, ''), '') = '' THEN EXCLUDED.interest ELSE crm_customers.interest END,
      budget = CASE WHEN COALESCE(NULLIF(crm_customers.budget, ''), '') = '' OR crm_customers.budget = 'Unspecified' THEN EXCLUDED.budget ELSE crm_customers.budget END,
      owner = CASE WHEN COALESCE(NULLIF(crm_customers.owner, ''), '') = '' OR crm_customers.owner = 'Unassigned' THEN EXCLUDED.owner ELSE crm_customers.owner END,
      owner_user_id = COALESCE(crm_customers.owner_user_id, EXCLUDED.owner_user_id),
      stage = CASE
        WHEN COALESCE(NULLIF(crm_customers.stage, ''), '') = '' OR crm_customers.stage = 'New' THEN EXCLUDED.stage
        ELSE crm_customers.stage
      END,
      next_action = CASE WHEN COALESCE(NULLIF(crm_customers.next_action, ''), '') = '' THEN EXCLUDED.next_action ELSE crm_customers.next_action END,
      due_date = COALESCE(crm_customers.due_date, EXCLUDED.due_date),
      last_message = CASE WHEN COALESCE(NULLIF(crm_customers.last_message, ''), '') = '' THEN EXCLUDED.last_message ELSE crm_customers.last_message END,
      last_touch = CASE WHEN COALESCE(NULLIF(crm_customers.last_touch, ''), '') = '' THEN EXCLUDED.last_touch ELSE crm_customers.last_touch END,
      notes = CASE
        WHEN COALESCE(NULLIF(crm_customers.notes, ''), '') = '' THEN EXCLUDED.notes
        WHEN COALESCE(NULLIF(EXCLUDED.notes, ''), '') = '' THEN crm_customers.notes
        WHEN position(EXCLUDED.notes in crm_customers.notes) > 0 THEN crm_customers.notes
        ELSE crm_customers.notes || E'\\n\\n' || EXCLUDED.notes
      END,
      updated_at = GREATEST(crm_customers.updated_at, EXCLUDED.updated_at);
  `);
}

async function ensureSocialSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_assets (
      id               BIGSERIAL PRIMARY KEY,
      storage_name     TEXT NOT NULL,
      original_name    TEXT NOT NULL,
      mime_type        TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size_bytes  BIGINT NOT NULL DEFAULT 0,
      asset_kind       TEXT NOT NULL DEFAULT 'image',
      created_by_user_id BIGINT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE social_assets ADD COLUMN IF NOT EXISTS storage_name TEXT;`);
  await pool.query(`ALTER TABLE social_assets ADD COLUMN IF NOT EXISTS original_name TEXT;`);
  await pool.query(`ALTER TABLE social_assets ADD COLUMN IF NOT EXISTS mime_type TEXT;`);
  await pool.query(`ALTER TABLE social_assets ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;`);
  await pool.query(`ALTER TABLE social_assets ADD COLUMN IF NOT EXISTS asset_kind TEXT;`);
  await pool.query(`ALTER TABLE social_assets ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;`);
  await pool.query(`ALTER TABLE social_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_assets ALTER COLUMN mime_type SET DEFAULT 'application/octet-stream';`);
  await pool.query(`ALTER TABLE social_assets ALTER COLUMN file_size_bytes SET DEFAULT 0;`);
  await pool.query(`ALTER TABLE social_assets ALTER COLUMN asset_kind SET DEFAULT 'image';`);
  await pool.query(`ALTER TABLE social_assets ALTER COLUMN created_at SET DEFAULT now();`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id                BIGSERIAL PRIMARY KEY,
      platform          TEXT NOT NULL UNIQUE,
      label             TEXT NOT NULL DEFAULT '',
      external_id       TEXT NOT NULL DEFAULT '',
      access_token      TEXT NOT NULL DEFAULT '',
      refresh_token     TEXT NOT NULL DEFAULT '',
      token_expires_at  TIMESTAMPTZ NULL,
      active            BOOLEAN NOT NULL DEFAULT FALSE,
      config_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS platform TEXT;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS label TEXT;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS external_id TEXT;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS access_token TEXT;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS refresh_token TEXT;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS active BOOLEAN;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS config_json JSONB;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_key;`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN label SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN external_id SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN access_token SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN refresh_token SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN active SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN config_json SET DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE social_accounts ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform, active, updated_at DESC);`);

  await pool.query(`
    INSERT INTO social_accounts (platform, label, active, created_at, updated_at)
    SELECT 'facebook', 'Facebook Page', FALSE, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM social_accounts WHERE platform = 'facebook');
  `);
  await pool.query(`
    INSERT INTO social_accounts (platform, label, active, created_at, updated_at)
    SELECT 'instagram', 'Instagram Professional', FALSE, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM social_accounts WHERE platform = 'instagram');
  `);
  await pool.query(`
    INSERT INTO social_accounts (platform, label, active, created_at, updated_at)
    SELECT 'google', 'Google Business Profile', FALSE, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM social_accounts WHERE platform = 'google');
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_posts (
      id                  BIGSERIAL PRIMARY KEY,
      title               TEXT NOT NULL DEFAULT '',
      caption             TEXT NOT NULL DEFAULT '',
      status              TEXT NOT NULL DEFAULT 'draft',
      scheduled_for       TIMESTAMPTZ NULL,
      timezone            TEXT NOT NULL DEFAULT 'America/New_York',
      link_url            TEXT NOT NULL DEFAULT '',
      cta_label           TEXT NOT NULL DEFAULT 'LEARN_MORE',
      google_topic_type   TEXT NOT NULL DEFAULT 'STANDARD',
      google_event_title  TEXT NOT NULL DEFAULT '',
      google_event_start  TIMESTAMPTZ NULL,
      google_event_end    TIMESTAMPTZ NULL,
      platforms           TEXT[] NOT NULL DEFAULT '{}'::text[],
      asset_id            BIGINT NULL REFERENCES social_assets(id) ON DELETE SET NULL,
      created_by_user_id  BIGINT NULL,
      updated_by_user_id  BIGINT NULL,
      published_at        TIMESTAMPTZ NULL,
      last_error          TEXT NOT NULL DEFAULT '',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS title TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS caption TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS status TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS timezone TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS link_url TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS cta_label TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS google_topic_type TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS google_event_title TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS google_event_start TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS google_event_end TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS platforms TEXT[];`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS platform_account_ids JSONB;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS asset_id BIGINT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS updated_by_user_id BIGINT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS last_error TEXT;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN title SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN caption SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN status SET DEFAULT 'draft';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN timezone SET DEFAULT 'America/New_York';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN link_url SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN cta_label SET DEFAULT 'LEARN_MORE';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN google_topic_type SET DEFAULT 'STANDARD';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN google_event_title SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN platforms SET DEFAULT '{}'::text[];`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN platform_account_ids SET DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN last_error SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE social_posts ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_posts_status_schedule ON social_posts(status, scheduled_for ASC NULLS LAST);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_publish_jobs (
      id                BIGSERIAL PRIMARY KEY,
      post_id           BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      platform          TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_for     TIMESTAMPTZ NOT NULL,
      attempt_count     INTEGER NOT NULL DEFAULT 0,
      provider_post_id  TEXT NULL,
      provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_error        TEXT NOT NULL DEFAULT '',
      started_at        TIMESTAMPTZ NULL,
      finished_at       TIMESTAMPTZ NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS post_id BIGINT;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS platform TEXT;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS status TEXT;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS account_id BIGINT;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS attempt_count INTEGER;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS provider_post_id TEXT;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS provider_response JSONB;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_publish_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_publish_jobs ALTER COLUMN status SET DEFAULT 'scheduled';`);
  await pool.query(`ALTER TABLE social_publish_jobs ALTER COLUMN attempt_count SET DEFAULT 0;`);
  await pool.query(`ALTER TABLE social_publish_jobs ALTER COLUMN provider_response SET DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE social_publish_jobs ALTER COLUMN last_error SET DEFAULT '';`);
  await pool.query(`ALTER TABLE social_publish_jobs ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE social_publish_jobs ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_jobs_due ON social_publish_jobs(status, scheduled_for ASC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_jobs_post_id ON social_publish_jobs(post_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_jobs_account_id ON social_publish_jobs(account_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_publish_logs (
      id          BIGSERIAL PRIMARY KEY,
      job_id       BIGINT NOT NULL REFERENCES social_publish_jobs(id) ON DELETE CASCADE,
      level        TEXT NOT NULL DEFAULT 'info',
      message      TEXT NOT NULL,
      meta_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE social_publish_logs ADD COLUMN IF NOT EXISTS job_id BIGINT;`);
  await pool.query(`ALTER TABLE social_publish_logs ADD COLUMN IF NOT EXISTS level TEXT;`);
  await pool.query(`ALTER TABLE social_publish_logs ADD COLUMN IF NOT EXISTS message TEXT;`);
  await pool.query(`ALTER TABLE social_publish_logs ADD COLUMN IF NOT EXISTS meta_json JSONB;`);
  await pool.query(`ALTER TABLE social_publish_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE social_publish_logs ALTER COLUMN level SET DEFAULT 'info';`);
  await pool.query(`ALTER TABLE social_publish_logs ALTER COLUMN meta_json SET DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE social_publish_logs ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_social_logs_job_id_created ON social_publish_logs(job_id, created_at ASC);`);

  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS channel TEXT;`);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS body TEXT;`);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS priority BOOLEAN;`);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS author_name TEXT;`);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS author_email TEXT;`);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS author_user_id BIGINT;`);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_posts ALTER COLUMN channel SET DEFAULT 'announcements';`);
  await pool.query(`ALTER TABLE board_posts ALTER COLUMN priority SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE board_posts ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE board_posts ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_board_posts_channel_created ON board_posts(channel, created_at DESC);`);

  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS post_id BIGINT;`);
  await pool.query(`ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS body TEXT;`);
  await pool.query(`ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS author_name TEXT;`);
  await pool.query(`ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS author_email TEXT;`);
  await pool.query(`ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS author_user_id BIGINT;`);
  await pool.query(`ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_comments ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE board_comments ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_board_comments_post_id_created ON board_comments(post_id, created_at ASC);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_uploads (
      id                 BIGSERIAL PRIMARY KEY,
      storage_name       TEXT NOT NULL,
      original_name      TEXT NOT NULL,
      mime_type          TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size_bytes    BIGINT NOT NULL DEFAULT 0,
      uploaded_by_user_id BIGINT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE board_uploads ADD COLUMN IF NOT EXISTS storage_name TEXT;`);
  await pool.query(`ALTER TABLE board_uploads ADD COLUMN IF NOT EXISTS original_name TEXT;`);
  await pool.query(`ALTER TABLE board_uploads ADD COLUMN IF NOT EXISTS mime_type TEXT;`);
  await pool.query(`ALTER TABLE board_uploads ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;`);
  await pool.query(`ALTER TABLE board_uploads ADD COLUMN IF NOT EXISTS uploaded_by_user_id BIGINT;`);
  await pool.query(`ALTER TABLE board_uploads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_uploads ALTER COLUMN mime_type SET DEFAULT 'application/octet-stream';`);
  await pool.query(`ALTER TABLE board_uploads ALTER COLUMN file_size_bytes SET DEFAULT 0;`);
  await pool.query(`ALTER TABLE board_uploads ALTER COLUMN created_at SET DEFAULT now();`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_messages (
      id                      BIGSERIAL PRIMARY KEY,
      scope                   TEXT NOT NULL DEFAULT 'channel',
      channel                 TEXT NULL,
      body                    TEXT NOT NULL,
      priority                BOOLEAN NOT NULL DEFAULT FALSE,
      author_name             TEXT NOT NULL,
      author_email            TEXT NOT NULL,
      author_user_id          BIGINT NULL,
      recipient_user_id       BIGINT NULL,
      recipient_name          TEXT NOT NULL DEFAULT '',
      recipient_email         TEXT NOT NULL DEFAULT '',
      attachment_upload_id    BIGINT NULL REFERENCES board_uploads(id) ON DELETE SET NULL,
      forwarded_from_message_id BIGINT NULL REFERENCES board_messages(id) ON DELETE SET NULL,
      edited_at               TIMESTAMPTZ NULL,
      deleted_at              TIMESTAMPTZ NULL,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS scope TEXT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS channel TEXT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS body TEXT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS priority BOOLEAN;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS author_name TEXT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS author_email TEXT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS author_user_id BIGINT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS recipient_user_id BIGINT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS recipient_name TEXT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS recipient_email TEXT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS attachment_upload_id BIGINT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS forwarded_from_message_id BIGINT;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE board_messages ALTER COLUMN scope SET DEFAULT 'channel';`);
  await pool.query(`ALTER TABLE board_messages ALTER COLUMN priority SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE board_messages ALTER COLUMN recipient_name SET DEFAULT '';`);
  await pool.query(`ALTER TABLE board_messages ALTER COLUMN recipient_email SET DEFAULT '';`);
  await pool.query(`ALTER TABLE board_messages ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE board_messages ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_board_messages_scope_channel_created ON board_messages(scope, channel, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_board_messages_dm_pair_created ON board_messages(author_user_id, recipient_user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_board_messages_deleted_at ON board_messages(deleted_at);`);
}

async function ensureWebTrackingSchema(pool: Pool) {
  await pool.query(`
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
  `);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS site TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS page_path TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS page_url TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS page_title TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS event_type TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS event_name TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS element_text TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS link_url TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS referrer TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS visitor_id TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS session_id TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS ip_address TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS meta_json JSONB;`);
  await pool.query(`ALTER TABLE web_page_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN site SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN page_path SET DEFAULT '/';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN page_url SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN page_title SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN event_type SET DEFAULT 'pageview';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN event_name SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN element_text SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN link_url SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN referrer SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN visitor_id SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN session_id SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN ip_address SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN user_agent SET DEFAULT '';`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN meta_json SET DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE web_page_events ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_web_page_events_created_at ON web_page_events(created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_web_page_events_site_page_created ON web_page_events(site, page_path, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_web_page_events_site_type_created ON web_page_events(site, event_type, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_web_page_events_site_visitor_created ON web_page_events(site, visitor_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_web_page_events_site_session_created ON web_page_events(site, session_id, created_at DESC);`);
}

async function ensureManufacturerPricebookSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manufacturer_pricebook_uploads (
      id                  BIGSERIAL PRIMARY KEY,
      manufacturer        TEXT NOT NULL,
      manufacturer_slug   TEXT NOT NULL,
      original_name       TEXT NOT NULL,
      storage_name        TEXT NOT NULL,
      relative_path       TEXT NOT NULL,
      document_type       TEXT NOT NULL DEFAULT 'pricebook',
      mime_type           TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size_bytes     BIGINT NOT NULL DEFAULT 0,
      replace_existing    BOOLEAN NOT NULL DEFAULT TRUE,
      status              TEXT NOT NULL DEFAULT 'holding',
      parsed_row_count    INTEGER NOT NULL DEFAULT 0,
      last_error          TEXT,
      previewed_at        TIMESTAMPTZ,
      published_at        TIMESTAMPTZ,
      uploaded_by_user_id BIGINT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS manufacturer TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS manufacturer_slug TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS original_name TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS storage_name TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS relative_path TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS document_type TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS mime_type TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS replace_existing BOOLEAN;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS status TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS parsed_row_count INTEGER;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS last_error TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS previewed_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS uploaded_by_user_id BIGINT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS parent_upload_id BIGINT;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS extracted_file_count INTEGER;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN document_type SET DEFAULT 'pricebook';`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN mime_type SET DEFAULT 'application/octet-stream';`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN file_size_bytes SET DEFAULT 0;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN replace_existing SET DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN status SET DEFAULT 'holding';`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN parsed_row_count SET DEFAULT 0;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN extracted_file_count SET DEFAULT 0;`);
  await pool.query(`ALTER TABLE manufacturer_pricebook_uploads ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_manufacturer_pricebook_uploads_parent_upload ON manufacturer_pricebook_uploads(parent_upload_id, created_at DESC);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_manufacturer_pricebook_uploads_manufacturer_created ON manufacturer_pricebook_uploads(manufacturer, created_at DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_manufacturer_pricebook_uploads_status_created ON manufacturer_pricebook_uploads(status, created_at DESC);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS manufacturer_catalog_items (
      id                  BIGSERIAL PRIMARY KEY,
      manufacturer        TEXT NOT NULL,
      manufacturer_slug   TEXT NOT NULL,
      upload_id           BIGINT REFERENCES manufacturer_pricebook_uploads(id) ON DELETE SET NULL,
      source_sort_order   INTEGER NOT NULL DEFAULT 0,
      collection_code     TEXT,
      collection_name     TEXT,
      category            TEXT NOT NULL DEFAULT '',
      product_type        TEXT NOT NULL DEFAULT '',
      sku                 TEXT NOT NULL,
      description         TEXT NOT NULL DEFAULT '',
      color_finish        TEXT NOT NULL DEFAULT '',
      color_family        TEXT NOT NULL DEFAULT '',
      material            TEXT NOT NULL DEFAULT '',
      shape               TEXT NOT NULL DEFAULT '',
      dimensions_text     TEXT NOT NULL DEFAULT '',
      width_inches        NUMERIC,
      depth_inches        NUMERIC,
      height_inches       NUMERIC,
      cubes               NUMERIC,
      weight_lbs          NUMERIC,
      base_price          NUMERIC,
      is_set              BOOLEAN NOT NULL DEFAULT FALSE,
      set_piece_count     INTEGER,
      is_swatch           BOOLEAN NOT NULL DEFAULT FALSE,
      is_sample           BOOLEAN NOT NULL DEFAULT FALSE,
      is_new_product      BOOLEAN NOT NULL DEFAULT FALSE,
      upholstery_cover    TEXT NOT NULL DEFAULT '',
      hardware_options    TEXT[] NOT NULL DEFAULT '{}'::text[],
      cushion_options     TEXT[] NOT NULL DEFAULT '{}'::text[],
      feature_tags        TEXT[] NOT NULL DEFAULT '{}'::text[],
      search_keywords     TEXT[] NOT NULL DEFAULT '{}'::text[],
      search_text         TEXT NOT NULL DEFAULT '',
      source_note         TEXT NOT NULL DEFAULT '',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS manufacturer TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS manufacturer_slug TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS upload_id BIGINT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS source_sort_order INTEGER;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS collection_code TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS collection_name TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS category TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS product_type TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS sku TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS description TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS color_finish TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS color_family TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS material TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS shape TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS dimensions_text TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS width_inches NUMERIC;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS depth_inches NUMERIC;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS height_inches NUMERIC;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS cubes NUMERIC;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS weight_lbs NUMERIC;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS base_price NUMERIC;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS is_set BOOLEAN;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS set_piece_count INTEGER;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS is_swatch BOOLEAN;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS is_sample BOOLEAN;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS is_new_product BOOLEAN;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS upholstery_cover TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS hardware_options TEXT[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS cushion_options TEXT[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS feature_tags TEXT[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS search_keywords TEXT[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS search_text TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS source_note TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN category SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN product_type SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN description SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN color_finish SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN color_family SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN material SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN shape SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN dimensions_text SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN is_set SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN is_swatch SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN is_sample SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN is_new_product SET DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN upholstery_cover SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN hardware_options SET DEFAULT '{}'::text[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN cushion_options SET DEFAULT '{}'::text[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN feature_tags SET DEFAULT '{}'::text[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN search_keywords SET DEFAULT '{}'::text[];`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN search_text SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN source_note SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_catalog_items ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_manufacturer_catalog_items_lookup ON manufacturer_catalog_items(manufacturer_slug, category, color_family, created_at DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_manufacturer_catalog_items_upload_sort ON manufacturer_catalog_items(upload_id, source_sort_order);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_manufacturer_catalog_items_search_text ON manufacturer_catalog_items USING GIN (to_tsvector('simple', search_text));`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS manufacturer_reference_notes (
      id                BIGSERIAL PRIMARY KEY,
      manufacturer      TEXT NOT NULL,
      manufacturer_slug TEXT NOT NULL,
      upload_id         BIGINT REFERENCES manufacturer_pricebook_uploads(id) ON DELETE SET NULL,
      note_type         TEXT NOT NULL DEFAULT 'reference',
      title             TEXT NOT NULL DEFAULT '',
      content           TEXT NOT NULL DEFAULT '',
      source_sort_order INTEGER NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS manufacturer TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS manufacturer_slug TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS upload_id BIGINT;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS note_type TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS title TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS content TEXT;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS source_sort_order INTEGER;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ALTER COLUMN note_type SET DEFAULT 'reference';`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ALTER COLUMN title SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ALTER COLUMN content SET DEFAULT '';`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ALTER COLUMN source_sort_order SET DEFAULT 0;`);
  await pool.query(`ALTER TABLE manufacturer_reference_notes ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_manufacturer_reference_notes_lookup ON manufacturer_reference_notes(manufacturer_slug, note_type, source_sort_order);`
  );
}

export async function runStartupBootstrap(deps: RunStartupBootstrapDeps) {
  await ensureAuthSchema(deps.pool);
  await ensureDefaultRoles(deps.pool);
  await ensureDefaultRolePermissions(deps.pool);
  await ensureDefaultAuthUser(deps);
  await ensureManufacturerPricebookSchema(deps.pool);
  await ensureCrmSchema(deps.pool);
  await ensureSocialSchema(deps.pool);
  await ensureWebTrackingSchema(deps.pool);
}
