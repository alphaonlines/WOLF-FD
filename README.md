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
- **Display Versioning:** UI shows `displayVersion` from `package.json` (for example `0.3.28.2`) while package semver remains valid.

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

## Employee Access Rollout

- Password login still exists as a temporary fallback.
- Preferred employee path is `Sign in with Google` using a `@furnituredistributors.net` Google Workspace account.
- First-time Google users land in a request-access step and must provide a phone number.
- The backend stores `name`, `first_name`, `last_name`, `email`, and `phone` for pending requests so the same identity record can be reused later for app/mobile rollout.
- Owners approve or return employees to pending status from **Settings → Users**.
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

The live nginx config routes `/fd/api/` to `127.0.0.1:5057`. The Docker `alphahs/fd-pos-api:local` container is published on host `:5057`, and no listener was found on `:5055`. This means nginx and the backend deployment are aligned on `5057`.
