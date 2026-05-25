# WOLF FD Dashboard

Furniture Distributors dashboard (Vite + React) with a local POS backend API and Postgres data store.

## Architecture

- **Frontend:** Vite + React (served by Nginx in production)
- **Backend API:** Node.js Express (running in Docker Swarm)
- **Database:** PostgreSQL 16 (Docker)
- **Python Importer:** Python 3 + Pandas/Lxml for processing POS exports

## Production Environment

- **Public URL:** `https://furnituredistributors.wolf.discount/fd/`
- **API URL:** `https://furnituredistributors.wolf.discount/fd/api/`
- **Backend Port:** `5057`
- **Database Port (Host):** `5433`
- **Display Versioning:** UI labels read one source: `displayVersion` from `package.json`, exported as `APP_VERSION` from `constants.ts`. Keep package `version` semver-valid for npm metadata.

### Nginx Routing
Nginx acts as a reverse proxy, mapping `/fd/api/` to the internal Swarm service. Note that the path mapping includes a redundant `/api` in the frontend code to correctly trigger the backend's relative routing logic.

## Quick Start (Local Dev)

From repo root:

1) Install frontend deps:
   `npm install`
2) Start frontend:
   `npm run dev`

From backend folder:

1) Install backend deps:
   `cd pos-dashboard-backend && npm install`
2) Start backend API (dev mode):
   `npm run dev`
3) Health check:
   `curl -s http://127.0.0.1:5057/health`

## CSV/XLSX Import Workflow

- Upload via the Dashboard "Upload to Backend" modal.
- Or manual: Put `.xlsx`/`.xls` files into `pos-dashboard-backend/incoming/` and run the script within the container.

## Notes

- The backend is consolidated on **Port 5057**.
- Database connectivity uses host IP with Port **5433** to bridge Swarm and standard Docker networks.
- For historical context, see `PROJECT_NOTES.md` and `AGENTS.md`.

## Migration/host-move onboarding (reproducible)

Use this as the minimum process when moving WOLF FD to a new host.

### What to commit for sharing
- Application source and runtime config: `src/`, `components/`, `services/`, `public/`, `pos-dashboard-backend/src/`, `pos-dashboard-backend/db/schema.sql`.
- Deployment manifests: `Dockerfile.*`, `docker-compose.yml`, `deploy.sh`, `nginx.conf`.
- Validation and migration docs: `README.md`, `MOVE_AND_HOSTING_BRIEF.md`, `.env.example`, docs/scripts used for checks.

### What to keep out of git
- Environment files: `.env`, `.env.*`, `pos-dashboard-backend/.env`, `WOLF-CENTRAL.env` and any real secrets.
- Runtime data and generated artifacts: `dist`, `node_modules`, `pos-dashboard-backend/node_modules`, `pos-dashboard-backend/.venv`, uploaded/import files, DB dumps/backups, private keys/certs.
- Any local host-only overrides or one-off recovery notes.

### Branch / sharing process
1. Work from a migration branch created from the current host baseline (currently `botbot-tutorial-revive`):
   - `git checkout botbot-tutorial-revive`
   - `git pull`
   - `git switch -c move/<YYYYMMDD>-wolf-fd-host`
2. Push branch and keep PRs docs+ops focused (no feature churn).
3. Merge only after verification and sign-off, then tag if needed.

### Seed a fresh environment on target host
```bash
# start fresh
git clone https://github.com/alphaonlines/WOLF-FD.git
cd WOLF-FD
cp .env.example .env   # then fill real values
chmod 600 .env

# generate strong values if you need fresh secrets
# generate 24+ random chars: $(openssl rand -base64 24)

# required runtime values
PGPASSWORD=<strong random password>
AUTH_BOOTSTRAP_EMAIL=owner@example.com
AUTH_BOOTSTRAP_PASSWORD=<one-time initial password>
GOOGLE_WORKSPACE_CLIENT_ID=<from Google OAuth if using Workspace sign-in>
OPENAI_API_KEY=<optional>
```

If you run backend services outside Docker compose, keep your secret store in a host-local env file path and set permissions tightly (this repo currently also documents `/home/alphahs/WOLF-CENTRAL.env` as one such host file).

Validate, then deploy:
```bash
./deploy.sh

# optional non-container artifact sync (legacy site mounts)
npm run build
sudo mkdir -p /srv/www/wolf.discount/fd/tools \
  /srv/www/wolf.discount/fd/smartcalc \
  /srv/www/wolf.discount/smartcalc \
  /srv/www/wolf.discount/furnituredistributors/smartcalc
sudo cp -r dist/* /srv/www/wolf.discount/fd/
sudo cp -r public/tools/smart-pricing-calculator.html /srv/www/wolf.discount/fd/tools/
sudo cp -r public/smartcalc/* /srv/www/wolf.discount/fd/smartcalc/
sudo cp -r public/smartcalc/* /srv/www/wolf.discount/smartcalc/
sudo cp -r public/smartcalc/* /srv/www/wolf.discount/furnituredistributors/smartcalc/

# quick checks
curl -fsS http://127.0.0.1:8080
curl -fsS http://127.0.0.1:5057/health
curl -fsS https://furnituredistributors.wolf.discount/fd/api/health
```

If any secret rotates in a migration, update only `.env`/host secret file and never paste it into git notes.

## Employee Access Rollout

- Password login still exists as a temporary fallback.
- Preferred employee path is `Sign in with Google` using a `@furnituredistributors.net` Google Workspace account.
- First-time Google users land in a request-access step and must provide a phone number.
- The backend stores `name`, `first_name`, `last_name`, `email`, and `phone` for pending requests so the same identity record can be reused later for app/mobile rollout.
- Owners approve or return employees to pending status from **Settings → Users**.
- Owners can link an employee profile to a salesperson name pulled from the sales-report data so reporting and profile access can line up later.
- Owners can assign role defaults and per-employee permission overrides from **Settings → Employee Permissions**.

## Auth Configuration

Set these on the FD backend environment before enabling live Google sign-in:

- `GOOGLE_WORKSPACE_CLIENT_ID` — Google Identity Services web client ID for the FD dashboard
- `GOOGLE_WORKSPACE_DOMAIN` — defaults to `furnituredistributors.net`
- `AUTH_BOOTSTRAP_EMAIL` — bootstrap owner email
- `AUTH_BOOTSTRAP_PASSWORD` — bootstrap owner password

Public auth endpoints used by the frontend:

- `GET /api/auth/config`
- `POST /api/auth/login`
- `POST /api/auth/google/start`
- `POST /api/auth/google/request-access`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## UI Overview (2026-02-06)

- **Dashboard (Overview):** Draggable snapshot cards for key areas (Sales Analysis, CRM, AlphaOS, Nightowl, Message Board, WOLFbot, AlphaPulse, FD Connect, QuickLinks).
- **Sales Analysis:** Full analytics view; print output now uses tabular reports (lowest margins, store totals, salesperson totals).
- **CRM:** Planner, Inbox, Reviews, Drip Flows, Customers, Analytics (tasks removed).
- **AlphaOS:** Kiosk status plus Desktops/Tablet sections (FD7 desktop, FD7T/FD7T1 tablets).
- **Nightowl:** Camera status with per-location camera counts and Night Owl login link.
- **Message Board:** Slack-style layout with channels, DMs, tasks panel, and voice/video sections.
- **WOLFbot:** Conversational AI owner console with recent calls, routing, flows, and a test chat window.

## Sales Report Filters

- **Totals + Lowest Margins** share category/manufacturer filters.
- Low margin endpoint now accepts `category` and `manufacturer` query params.

## Current State Note (2026-02-06)

The live nginx config routes `/fd/api/` to `127.0.0.1:5057`. The Docker backend is now published on host `:5057`, and no listener was found on `:5055` in this repo. This aligns nginx and container deployment on `5057`.
