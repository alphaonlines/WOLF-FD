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
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN active SET DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(email)));`);

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
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN store SET DEFAULT 'FD7';`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN status SET DEFAULT 'waiting';`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN checked_in_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_ups_queue ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_queue_store_pos ON crm_ups_queue(store, queue_position ASC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_ups_queue_rep_user_id ON crm_ups_queue(rep_user_id);`);

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
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN phone SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN email SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN store SET DEFAULT 'FD7';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN notes SET DEFAULT '';`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN created_at SET DEFAULT now();`);
  await pool.query(`ALTER TABLE crm_customers ALTER COLUMN updated_at SET DEFAULT now();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_phone ON crm_customers(phone);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_email_lower ON crm_customers((lower(email)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_name_lower ON crm_customers((lower(name)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_customers_notes_lower ON crm_customers((lower(notes)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_name_lower ON crm_leads((lower(name)));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_leads_notes_lower ON crm_leads((lower(notes)));`);

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
}

export async function runStartupBootstrap(deps: RunStartupBootstrapDeps) {
  await ensureAuthSchema(deps.pool);
  await ensureDefaultRoles(deps.pool);
  await ensureDefaultRolePermissions(deps.pool);
  await ensureDefaultAuthUser(deps);
  await ensureCrmSchema(deps.pool);
}
