# WOLF FD Docker Move & Verify Runbook (Docker-only)

Scope:
- Clone WOLF-FD
- Configure env from `.env.example` without embedding secrets
- Run fresh deploy or migrate existing DB/data
- Verify stack and migrate integrity
- Rollback checkpoints and checks

Assumptions:
- Commands run from Bash in repo root
- Repo path: `C:/Users/antho/WOLF-FD-git`
- Compose version supports `docker compose`
- DB defaults:
  - database: `salesdb`
  - user: `salesapp`
  - exposed host DB port from compose: `5433`
  - backend API port: `5057`
  - frontend port: `8080`

## 0) Pre-flight checks (same on old and new host)
```bash
cd /c/Users/antho/WOLF-FD-git

docker version

docker compose version

docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head
```

Success criteria:
- Docker engine + compose respond
- No active unrelated containers on critical ports (8080, 5057, 5433)

## 1) Fresh clone on new host
```bash
git clone https://github.com/alphaonlines/WOLF-FD.git
cd WOLF-FD-git
git fetch --all --prune
git checkout botbot-tutorial-revive
```

Success criteria:
- Branch checked out and clean (`git status --short` is empty)

## 2) Environment setup (no secrets in repository)
```bash
cp .env.example .env
chmod 600 .env
```

Open `.env` and set values (examples only):
```text
VITE_POS_API_BASE_URL=/fd/api
PGHOST=postgres
PGPORT=5432
PGDATABASE=salesdb
PGUSER=salesapp
PGPASSWORD=<db-strong-password>
PORT=5057
NODE_ENV=production
AUTH_BOOTSTRAP_EMAIL=<owner@domain>
AUTH_BOOTSTRAP_NAME=<owner-name>
AUTH_BOOTSTRAP_PASSWORD=<one-time-bootstrap-password>
```

Optional (if features enabled):
```text
GOOGLE_WORKSPACE_CLIENT_ID=<oauth-client-id>
GOOGLE_WORKSPACE_DOMAIN=furnituredistributors.net
OPENAI_API_KEY=<optional>
OPENAI_BASE_URL=<optional>
```

Security note:
- Never paste secrets in chat/docs.
- After validation, load secrets from vault/CI env and overwrite `.env` temporarily if needed.

Success criteria:
- `.env` exists, readable only by owner, no real secret values committed

## 3) Required directories (bind mounts)
```bash
mkdir -p pos-dashboard-backend/incoming pos-dashboard-backend/processed
```

Success criteria:
- Directories exist in repo.

## 4) Source backup (from old host)
Choose one:

### 4A) Logical DB export (recommended)
```bash
cd /path/to/source/WOLF-FD-git
BACKUP_DIR=/tmp/wolffd-migration
mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres pg_dump -U salesapp -d salesdb \
  --format=custom --blobs --no-owner --no-acl > "$BACKUP_DIR/wolffd-salesdb-$(date +%Y%m%d-%H%M%S).dump"

docker run --rm -v "$BACKUP_DIR:/backup" -u "$UID:$GID" alpine sh -lc 'sha256sum /backup/*.dump > /backup/.sha256sum'
```

### 4B) Include runtime import artifacts
```bash
cd /path/to/source/WOLF-FD-git
tar -czf /tmp/wolffd-migration/import-artifacts-$(date +%Y%m%d-%H%M%S).tgz \
  pos-dashboard-backend/incoming pos-dashboard-backend/processed

tar -czf /tmp/wolffd-migration/manufacturer-artifacts-$(date +%Y%m%d-%H%M%S).tgz \
  pos-dashboard-backend/manufacturer-pricebooks pos-dashboard-backend/board-uploads pos-dashboard-backend/social-uploads 2>/dev/null || true
```

Success criteria:
- `*.dump`/tar files created and `sha256sum` file exists.

Transfer backups to the new host (example):
```bash
scp /tmp/wolffd-migration/wolffd-salesdb-*.dump <new-host>:~/
scp /tmp/wolffd-migration/*.tgz <new-host>:~/
scp /tmp/wolffd-migration/.sha256sum <new-host>:~/
```

## 5) Restore target DB on new host (before app services start)
```bash
cd /c/Users/antho/WOLF-FD-git
cp .env.example .env   # ensure values are set as above
chmod 600 .env

# start only postgres first for clean restore window
docker compose up -d --pull always postgres

docker compose exec -T postgres pg_isready -U salesapp -d salesdb

# quick checkpoint (optional): backup empty/new db before restore so you can rollback immediately
docker compose exec -T postgres pg_dump -U salesapp -d salesdb --format=custom --blobs --no-owner --no-acl > /tmp/pre-restore.dump

# restore source backup
cat ~/wolffd-salesdb-*.dump | docker compose exec -T postgres pg_restore -U salesapp -d salesdb --clean --if-exists --no-owner --no-acl
```

Success criteria:
- `pg_isready` returns ready
- `pg_restore` exits 0

## 6) Start application services
```bash
# restore import artifacts if present
mkdir -p pos-dashboard-backend/incoming pos-dashboard-backend/processed
[ -f ~/import-artifacts-*.tgz ] && tar -xzf ~/import-artifacts-*.tgz -C /c/Users/antho/WOLF-FD-git
[ -f ~/manufacturer-artifacts-*.tgz ] && tar -xzf ~/manufacturer-artifacts-*.tgz -C /c/Users/antho/WOLF-FD-git

# build and start backend/frontend
docker compose up -d --build backend frontend

docker compose up -d
```

Success criteria:
- `docker compose ps` shows `wolffd-postgres`, `wolffd-backend`, `wolffd-frontend` as `Up`

## 7) Health & runtime verification
```bash
# container and health state

docker compose ps -a

docker compose exec -T postgres pg_isready -U salesapp -d salesdb
curl -fsS http://127.0.0.1:5057/health
curl -I -s http://127.0.0.1:8080 | head -n 1
```

Expected success:
- `curl http://127.0.0.1:5057/health` returns JSON including `{ "ok": true, "db": 1 }`
- Frontend responds with HTTP 200

DB integrity checks:
```bash
docker compose exec -T postgres psql -U salesapp -d salesdb -c "
SELECT 'users' table, count(*) FROM users
UNION ALL
SELECT 'pos_sales', count(*) FROM pos_sales
UNION ALL
SELECT 'pos_sale_items', count(*) FROM pos_sale_items
UNION ALL
SELECT 'manufacturer_pricebook_uploads', count(*) FROM manufacturer_pricebook_uploads;
"

docker compose exec -T postgres psql -U salesapp -d salesdb -c "SELECT table_name FROM information_schema.views WHERE table_name = 'pos_sales_people';"

docker compose exec -T postgres psql -U salesapp -d salesdb -c "SELECT column_name FROM information_schema.columns WHERE table_name='pos_sales' AND column_name IN ('lwy_balance','store_credit_applied','previous_paid','adjustments') ORDER BY 1;"
```

## 8) Functional smoke checks (first validation)
```bash
# API endpoint smoke (returns JSON)
curl -fsS http://127.0.0.1:5057/health

# auth bootstrap sanity check (no secrets)
docker compose exec -T postgres psql -U salesapp -d salesdb -c "SELECT id, name, email FROM users ORDER BY id LIMIT 5;"

# confirm imports directory writable
docker compose exec -T backend test -w /app/incoming && docker compose exec -T backend test -w /app/processed
```

Success criteria:
- Health endpoint returns 200 with valid JSON
- At least one expected table and rowset visible after restore
- Required view and migration columns exist
- Backend can write to mapped ingest directories

## 9) Production cutover checks (if fronted by HTTPS proxy)
```bash
# If proxy points /fd/api -> backend
curl -fsS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health --insecure
```

Expected: 200/healthy response from backend through proxy.

## 10) Rollback plan
### A) DB rollback (during migration window)
```bash
# stop app services to avoid half-state writes

docker compose stop backend frontend

docker compose exec -T postgres pg_restore -U salesapp -d salesdb --clean --if-exists --no-owner --no-acl < /tmp/pre-restore.dump

docker compose start backend frontend
```

### B) Full stack rollback
```bash
docker compose down -v
# (this removes docker volume and containers)
# restore from latest good db backup and rerun from section 5
```

Rollback checks:
- Post-rollback, re-run section 7 health checks and confirm services return to expected state.

## 11) Ongoing operational checklist (after go-live)
```bash
docker compose logs -f --tail=200 backend

docker system df

docker compose ps
```

Every 24h (or before releases):
```bash
docker compose exec -T postgres pg_dump -U salesapp -d salesdb --format=custom --blobs --no-owner --no-acl > ~/backups/wolffd-salesdb-$(date +%Y%m%d-%H%M%S).dump
sha256sum ~/backups/wolffd-salesdb-*.dump | tail -n 1 > ~/backups/latest.sha256
```

- For a quick move-from-backup script, repeat sections 4B and 5–8 with a verified dump plus checksum match.