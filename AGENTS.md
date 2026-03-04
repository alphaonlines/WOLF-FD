# Repository Guidelines

## Project Structure & Module Organization

- `index.html`, `index.tsx`: Vite + React entry points.
- `App.tsx`: top-level application shell and feature composition.
- `components/`: UI modules (PascalCase files like `SalesDashboard.tsx`).
- `services/`: integrations and data access (`posBackendApi.ts`, `tasksService.ts`, `tasksApi.ts`, `firebase.ts`, `geminiService.ts`, `dataService.ts`).
- `functions/`: Firebase Cloud Functions (TypeScript) under `functions/src`.
- `constants.ts`, `types.ts`: shared constants and TypeScript types.

## Build, Test, and Development Commands

From the repo root:
- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server.
- `npm run build`: create a production build (`dist/`).
- `npm run preview`: serve the production build locally.

## Dev vs Live Workflow (Quick)

- Dev (local): `npm run dev` serves the app on the Vite dev server (default `http://localhost:5173`).
- Live (FD site): the `/fd` route is a static build served by nginx from `/srv/www/wolf.discount/fd`.
- To deploy UI changes to `/fd`:
  1) `cd /home/alphahs/WOLF-FD && npm run build`
  2) `cp -r /home/alphahs/WOLF-FD/dist/* /srv/www/wolf.discount/fd/`
  3) Hard refresh the browser (`Ctrl+Shift+R`).
- Backend API for both dev and live: `http://127.0.0.1:5055` (proxied as `/fd/api/*` on the live site).

## Home Server Deployment Guide

This guide walks through setting up the Furniture Distributors Dashboard on your home server for production use. Assumes a Linux server (e.g., Ubuntu/Debian) with sudo access, Node.js 18+, Python 3.8+, and internet access. Total time: 1-2 hours.

### Prerequisites
- **Server OS**: Linux (Ubuntu 20.04+ recommended).
- **Node.js**: v18+ (install via `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs`).
- **Python**: 3.8+ with pip (usually pre-installed; `sudo apt install python3-pip` if needed).
- **PostgreSQL**: `sudo apt update && sudo apt install postgresql postgresql-contrib`.
- **PM2**: `npm install -g pm2` (for process management).
- **Git**: `sudo apt install git`.
- **Optional**: Nginx/Apache for reverse proxy, SSL certs.

### Step 1: Clone and Install
1. SSH into your server: `ssh user@your-server-ip`.
2. Clone the repo: `git clone https://github.com/your-repo/furniture-distributors-dashboard.git` (replace with actual repo URL).
3. Enter directory: `cd furniture-distributors-dashboard`.
4. Install frontend deps: `npm install`.
5. Install backend deps: `cd pos-dashboard-backend && npm install`.
6. Set up Python venv: `python3 -m venv .venv && source .venv/bin/activate && pip install -r importer/requirements.txt`.

### Step 2: Set Up Database
1. Start PostgreSQL: `sudo systemctl start postgresql && sudo systemctl enable postgresql`.
2. Create DB user/role: `sudo -u postgres createuser salesapp && sudo -u postgres createdb salesdb && sudo -u postgres psql -c "ALTER USER salesapp PASSWORD 'your_secure_password';"`.
3. Apply schema: `psql -U salesapp -d salesdb -f db/schema.sql` (replace password in command or use env vars).
4. **Security Note**: Change default password to something strong; avoid hardcoding.

### Step 3: Import Data
1. Upload Excel files (.xls/.xlsx) to `pos-dashboard-backend/incoming/` (via SCP/SFTP).
2. Run import: `source .venv/bin/activate && python importer/import_pos_xlsx.py`.
3. Verify: `psql -U salesapp -d salesdb -c "SELECT COUNT(*) FROM pos_sales;"` (should show rows, e.g., 10k+).
4. **Automation**: Set up cron for daily imports: `crontab -e` add `0 2 * * * cd /path/to/repo/pos-dashboard-backend && source .venv/bin/activate && python importer/import_pos_xlsx.py`.

### Step 4: Configure and Build
1. **Environment Vars**: Create `.env` in `pos-dashboard-backend/` with `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGDATABASE=salesdb`, `PGUSER=salesapp`, `PGPASSWORD=your_password`.
2. **Optional**: For Gemini AI, add `API_KEY=your_key` (Vite uses `VITE_API_KEY` in root `.env.local`).
3. Build frontend: `cd .. && npm run build` (creates `dist/`).
4. **Reverse Proxy (Nginx Example)**:
   - Install: `sudo apt install nginx`.
   - Create site: `sudo nano /etc/nginx/sites-available/furniture-dashboard`.
     ```
     server {
         listen 80;
         server_name your-domain.com;  # Or IP
         root /path/to/repo/dist;
         index index.html;
         location / {
             try_files $uri $uri/ /index.html;
         }
         location /api/ {
             proxy_pass http://127.0.0.1:5055;
             proxy_set_header Host $host;
         }
     }
     ```
   - Enable: `sudo ln -s /etc/nginx/sites-available/furniture-dashboard /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`.
   - **SSL**: Use Certbot for HTTPS: `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx`.

### Step 5: Start Services with PM2
1. Start backend: `pm2 start npm --name furniture-backend -- run dev` (in `pos-dashboard-backend/`).
2. Start frontend: `pm2 start npm --name furniture-frontend -- run preview` (in root, or serve via Nginx).
3. Save config: `pm2 save`.
4. Enable auto-start: `pm2 startup` (run the generated sudo command).
5. Check: `pm2 list` (both should be online).
6. Access: `http://your-server-ip` or `https://your-domain.com`.

### Step 6: Post-Setup Tasks
- **Backups**: Schedule DB dumps: `pg_dump salesdb > backup.sql` via cron.
- **Monitoring**: Use `pm2 logs` or set up alerts.
- **Updates**: Pull latest code, rebuild, restart PM2.
- **Security**: Firewall (ufw), regular updates, no root processes.
- **Troubleshooting**:
  - Ports in use: Change defaults (e.g., API to 5056).
  - DB issues: Check logs, ensure PG is running.
  - Import fails: Verify Excel format, permissions.

### Features Overview
- **Sales Dashboard**: Analytics with leaderboards, trends, finance summaries.
- **Lowest Margins**: Table of top 5 low-margin sales per salesperson, sortable, with clickable links to external sale pages.
- **Tasks**: Shared task board via DB.
- **Data**: Supports 2024-2025 sales; margins calculated correctly.

Contact support if issues arise. Enjoy your self-hosted dashboard!

### POS Dashboard Backend (Postgres + Importer + API)

Backend lives in `pos-dashboard-backend/` and is used by the React dashboard via HTTP.

- Start Postgres (local service):
  - Ensure `postgresql` is running on `127.0.0.1:5432`.
  - On Ubuntu/Debian: `sudo systemctl start postgresql`
- Apply/upgrade schema (safe to re-run):
  - `cd pos-dashboard-backend`
  - `psql "postgres://salesapp:dev_password_change_me@127.0.0.1:5432/salesdb" -f db/schema.sql`
- Import POS exports:
  - Put export files in `pos-dashboard-backend/incoming/` (supports `.xlsx` and `.xls`).
  - Create/activate venv: `cd pos-dashboard-backend && source .venv/bin/activate`
  - Install deps: `pip install -r importer/requirements.txt`
  - Run import: `python importer/import_pos_xlsx.py`
  - Re-import without moving files: `python importer/import_pos_xlsx.py --include-processed --no-move`
  - Safety: importer stops on `sale_id` collisions across different `sale_date` unless `--allow-id-collisions` is passed (important if `Sales#` repeats across years).
- `.xls` note:
  - Some `.xls` exports are actually HTML tables; importer parses them and attempts to preserve `<a href>` links (e.g. Note links).
- Start API:
  - `cd pos-dashboard-backend && npm run dev` (defaults to `http://127.0.0.1:5055`)

### Frontend ↔ Backend

- Frontend defaults to the POS backend at `http://127.0.0.1:5055`; override with `VITE_POS_API_BASE_URL`.
- If `localhost:5173` refuses to connect, Vite is configured to bind to `::` in `vite.config.ts` so both `localhost` and `127.0.0.1` should work; ensure `npm run dev` is running.
- On the production FD subdomain, `/fd/api/*` is proxied by nginx to `http://127.0.0.1:5055` for the dashboard.

### Tasks Board (Local DB)

The Tasks page is a shared task board stored in the local Postgres DB via the POS backend API.

- Backend storage:
  - Table: `tasks` (created in `pos-dashboard-backend/db/schema.sql`)
  - Endpoints:
    - `GET /api/tasks`
    - `POST /api/tasks`
    - `PATCH /api/tasks/:id`
- Frontend implementation:
  - UI: `components/TaskManager.tsx` (drag between columns; due date can be set after marking Done)
  - API client: `services/tasksApi.ts` (talks to POS backend)
  - Sync/persistence: `services/tasksService.ts` (uses POS backend when available; falls back to browser `localStorage` if the backend is offline)
- Status visibility:
  - `components/SalesDashboard.tsx` shows POS backend connectivity + whether Tasks are using Postgres (shared) or browser-only fallback.

For Cloud Functions:
- `cd functions && npm install`: install function dependencies.
- `cd functions && npm run build`: compile to `functions/lib/`.
- Firebase CLI required for emulator/deploy (e.g., `npm i -g firebase-tools`).
- `cd functions && npm run serve`: run Firebase emulators for functions.
- `cd functions && npm run deploy`: deploy functions to Firebase.

## Coding Style & Naming Conventions

- Language: TypeScript + React; prefer small, focused components and typed service APIs.
- Styling: Tailwind is loaded via CDN in `index.html`; use utility classes in JSX.
- Formatting: follow existing style (2-space indentation, mostly double quotes).
- Naming: `PascalCase` for React components, `camelCase` for functions/variables, `SCREAMING_SNAKE_CASE` for constants.
- Keep types close to usage; share cross-cutting types via `types.ts`.

## Testing Guidelines

No test framework is currently configured in the root app. If you add tests, keep them colocated (e.g., `components/__tests__/...`) and add a `test` script in `package.json`. The `functions/` package includes `firebase-functions-test` but no test runner is wired up yet.

## Commit & Pull Request Guidelines

There’s no established commit style yet; use clear, imperative messages (prefer Conventional Commits like `feat: ...`, `fix: ...`).
For PRs: include a short summary, linked issues, manual test steps, and screenshots for UI changes.

## Security & Configuration

- Do not commit secrets: use `.env.local` for local-only keys.
- Frontend auth/CRM/tasks rely on the local POS backend API (`/fd/api/*` proxy or `http://127.0.0.1:5055` in dev). Keep credentials in backend `.env` and avoid exposing secrets in browser code.

## Recent Changes (2026-01-31)
- Moved FD public pages to subdomain: https://furnituredistributors.wolf.discount/
- Added redirects from https://wolf.discount/furnituredistributors/* and /fd/ to the new subdomain.
- Enabled /fd/ app on the subdomain with /fd/api/* routed to :5057.
- Added quick-links index page on the subdomain root with a dashboard button.
- Bedroom page restored with mobile-friendly stacking only (no snow effect).
- Added CSV upload modal button to FD dashboard (/fd/) gated by dashboard unlock; posts to /fd-upload-csv.
- Nginx now listens on 0.0.0.0:80/443 and :443/:80 IPv6; SSL issued for subdomain.
- Removed Docker swarm services for dashboard APIs on this host; run POS backend locally on :5055 for demos.
- Routed `/fd/api/*` to the local POS backend on :5055 (non-Docker).

## Status Update (2026-01-31)
- Work paused at user request; project manager will review next steps.
- Backend is running locally on :5055 with nginx `/fd/api/*` proxyed to :5055.
- Margin calculations now use item report totals (pos_sale_items) instead of sales report profit.
- 2026-02-01 10:45 EST — Updated Pro1st tracking to be dollar-based (percentage of sales dollars) instead of count-based. Modified backend /api/pro1st/attach-rate to return total sales amount and pro sales amount. Updated frontend SalesDashboard.tsx to format these values as currency. Tests: curl verified backend returns dollar amounts.
- 2026-02-01 11:15 EST — Fixed Pro1st count discrepancy (18 vs 16) by aligning date filtering logic across all endpoints. Now prefers sale_date (written) over delivery_date consistently. Updated pos_sales_people view and backend constants.
- 2026-03-03 04:30 EST — Cross-project AGENTS sync completed. Swarm bs node target is four nodes total (alphabs, alphabs1, alphabs2, alphabs3). Duplicate alphabs swarm entry was removed (kept node ID nrrwqjfd7pz2f1qcbpi7lxhtd; removed duplicate ID 6n2b3tnizkp313jqv9vzmctcx). Installer baseline is version 2026.03.03-7 with sleep and power hardening in Linux/Windows/mac setup scripts. Commands run: find AGENTS inventory, docker node list/remove, targeted SSH checks, USB node identity checks. Tests: swarm membership and SSH checks run; no repo-specific unit/integration tests run in this repo.
- 2026-03-03 21:54 EST — UI navigation/workflow split update completed for FD dashboard. Removed Nightowl/Cameras from sidebar and overview cards, added a dedicated `Social Posts` tab, and separated CRM into its own workspace component (`components/CRMWorkspace.tsx`) while keeping social analytics in `components/WorkAdvertising.tsx` with updated social-focused headings. Updated app routing/tab labels and dashboard card actions accordingly. Tests: `npm run build` succeeded.
- 2026-03-03 22:04 EST — Live rollout completed for the CRM/social split update. Built frontend with `npm run build`, deployed `/home/alphahs/WOLF-FD/dist/*` to `/srv/www/wolf.discount/fd/`, and verified production endpoint now serves `/fd/assets/index-Di1w-aVE.js`. Health check confirmed `https://furnituredistributors.wolf.discount/fd/api/health` returns `{"ok":true,"db":1}`.
- 2026-03-03 22:13 EST — WOLFbot UI relocation and dashboard cleanup completed. Removed WOLFbot from sidebar/tab navigation, added a persistent bottom-right chat bubble launcher with modal panel containing `components/WolfBot.tsx`, shifted the Sales tooltip toggle upward to avoid overlap, and simplified `components/DashboardOverview.tsx` by removing WOLFbot/external cards from the primary grid and moving external destinations into compact quick links. Tests/deploy: `npm run build` succeeded; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-BEfh58nh.js` and `/fd/api/health` returned `{"ok":true,"db":1}`.
- 2026-03-03 22:44 EST — CRM buildout round completed with execution-focused command center implementation. Added root checklist file `CRM_FINISH_TODO.md` and replaced placeholder CRM UI with interactive lead intake, stage-based pipeline board, editable Contact 360 panel, prioritized follow-up queue, unified inbox snapshot, automation toggles, and copyable message templates in `components/CRMWorkspace.tsx` using localStorage persistence. Tests/deploy: `npm run build` succeeded; deployed `/home/alphahs/WOLF-FD/dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-DU5YI33z.js` and `/fd/api/health` returned `{"ok":true,"db":1}`.
- 2026-03-03 22:56 EST — CRM persistence round completed with shared backend sync. Added CRM domain types in `types.ts`; created `services/crmApi.ts`; upgraded `components/CRMWorkspace.tsx` to auto-sync leads/automations with POS backend when healthy (`POS_DB`) with browser fallback, API seeding on empty DB, and visible sync mode badge; added CRM tables/indexes to `pos-dashboard-backend/db/schema.sql`; and added CRM endpoints plus startup schema guard in `pos-dashboard-backend/src/server.ts` (`GET/POST/PATCH` for `/api/crm/leads` and `/api/crm/automations`). Updated checklist in `CRM_FINISH_TODO.md` for backend persistence completion. Tests/deploy: frontend `npm run build` and backend `npm run build` succeeded; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-Cs_kDGlS.js` and `/fd/api/health` returned `{"ok":true,"db":1}`.
- 2026-03-03 23:06 EST — Auth/RBAC planning round started for employee sharing. Added `EMPLOYEE_ACCESS_TODO.md` with phased implementation checklist for login/session auth, role/module permissions, CRM lead assignment ownership, lead comments, message board posts/comments, audit/security hardening, and rollout verification steps. This round is planning-only (no runtime code paths changed, no deploy step).
- 2026-03-03 23:17 EST — Employee auth Phase 1 shipped live. Replaced static passcode lock in `App.tsx` with API-backed employee login (`services/authApi.ts`) and sign-out flow using HTTP-only cookie sessions; added shared `AuthUser` type in `types.ts`; updated POS fetch clients (`services/posBackendApi.ts`, `services/tasksApi.ts`, `services/crmApi.ts`) to send credentials; added auth tables to `pos-dashboard-backend/db/schema.sql` (`users`, `auth_sessions`); and implemented backend auth/session middleware + endpoints in `pos-dashboard-backend/src/server.ts` (`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`) with protected `/api/*` routes, startup schema checks, and bootstrap owner user seed. Updated Phase 1 checklist completion in `EMPLOYEE_ACCESS_TODO.md`. Tests/deploy: frontend and backend builds passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified `/fd/api/api/auth/me` returns unauthenticated before login and authenticated user after login, and protected `/fd/api/api/tasks` now returns `unauthorized` without session.
- 2026-03-03 23:32 EST — Employee access Phase 2 delivered with role-based module control and admin user management. Added backend role schema + assignment support in `pos-dashboard-backend/db/schema.sql` and `pos-dashboard-backend/src/server.ts` (`roles`, `user_roles`, owner-role seeding, role-aware auth user hydration, owner-only admin guard, and new endpoints: `GET /api/admin/roles`, `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`, `PATCH /api/admin/users/:id/roles`, `PATCH /api/admin/users/:id/password`, plus authenticated `POST /api/auth/change-password`). Frontend now supports role-based tab visibility in `App.tsx`, includes new `Admin Users` module (`components/AdminUsers.tsx` + `services/adminUsersApi.ts`) for employee creation/role assignment/activation/password reset, and adds user self-service password change modal via `services/authApi.ts`. Updated auth/domain types in `types.ts` and marked completed items in `EMPLOYEE_ACCESS_TODO.md`. Tests/deploy: frontend and backend builds passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-zhM5fPSu.js`, health `{"ok":true,"db":1}`, owner login success, admin roles endpoint success, and admin users endpoint success with authenticated owner session.
- 2026-03-03 23:37 EST — UI cleanup/polish round completed to remove jagged visual feel. Refined app shell styling in `App.tsx` (simplified background gradients, smoother glass card treatment, antialiased text rendering, softened sidebar/header surfaces, refined nav-item active/hover states, cleaner spacing/padding rhythm) and polished dashboard cards in `components/DashboardOverview.tsx` (more consistent card density, icon containers, expansion panel styling, and hover motion). Tests/deploy: frontend build passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-B9m811PM.js` and health `{"ok":true,"db":1}`.
- 2026-03-03 23:43 EST — CRM enhancement round: added a dedicated `UPS List` section to `components/CRMWorkspace.tsx` with quick-add input, Enter-to-add support, check-off state, and browser persistence (`fd_crm_ups_list_v1`). This allows the CRM team to track active UPS priorities directly inside the CRM command center. Tests/deploy: frontend build passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-DcS1MNZh.js` and health `{"ok":true,"db":1}`.
- 2026-03-04 00:00 EST — CRM UPS layout refresh round shipped. Removed the CRM Finish Checklist/TODO section from `components/CRMWorkspace.tsx` and rebuilt the UPS area into a structured queue with unattended/be-back/quote-follow-up lanes, priority tags, owner + due-date fields, queue KPIs, and done/reopen actions while keeping local persistence (`fd_crm_ups_list_v1`). Reference pass reviewed live PERQ/Podium patterns for cleaner up-list + shared inbox behavior before implementation. Tests/deploy: `npm run build` passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-D_NDCqA8.js` and `/fd/api/health` returned `{"ok":true,"db":1}`.
- 2026-03-04 00:10 EST — CRM UX flow redesign round shipped live. Rebuilt `components/CRMWorkspace.tsx` to improve usability and navigation flow: introduced a top "Daily Lead Flow" header, a prioritized Today follow-up workbench, reorganized pipeline + contact editing into a two-column operations layout, and converted the UPS area into lane-based cards (Unattended / Be-Back / Quote Follow-up) with integrated quick-add and completed-item reopen controls. Kept all core CRM actions (lead add/edit/stage updates, follow-up call actions, automation toggles, template copy, UPS persistence). Tests/deploy: `npm run build` passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-xOal0M5A.js` and `/fd/api/health` returned `{"ok":true,"db":1}`.
- 2026-03-04 02:10 EST — CRM usability tightening round shipped with new `Focused Rep Mode`. Updated `components/CRMWorkspace.tsx` to add a mode toggle in the header (`Focused Rep Mode` / `Full CRM Mode`), introduced a compact rep-focused workflow view (focused follow-up queue, quick UPS action list, selected lead editor, and quick templates), and conditionally hides the heavier operations sections while in focus mode. Existing full CRM mode remains available with all prior pipeline/UPS/automation/inbox tools intact. Tests/deploy: `npm run build` passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-Cby-E65j.js` and `/fd/api/health` returned `{"ok":true,"db":1}`.
- 2026-03-04 02:14 EST — Hotfix for blank CRM page after Focused Rep Mode rollout. Root cause was legacy UPS localStorage entries (`fd_crm_ups_list_v1`) from older schema lacking lane/priority fields, which could break lane grouping during render and blank the CRM UI. Added defensive schema normalization in `components/CRMWorkspace.tsx` (`normalizeUpsList`, enum guards for lane/priority/channel) and safe lane bucket checks before push. Tests/deploy: `npm run build` passed; deployed `dist/*` to `/srv/www/wolf.discount/fd/`; verified live bundle `/fd/assets/index-BTryLlpa.js` and `/fd/api/health` returned `{"ok":true,"db":1}`.
- 2026-03-04 02:28 EST — Repository hygiene/dead-code refactor round completed. Removed orphaned frontend modules (`components/CamerasStatus.tsx`, `services/dataService.ts`, `services/firebase.ts`, `services/geminiService.ts`) and pruned unused root dependencies (`@google/genai`, `firebase`, `dotenv`) from `package.json`/`package-lock.json`. Cleaned backend dead code by removing unused symbols in `pos-dashboard-backend/src/server.ts` and deleting generated artifact files accidentally tracked in `pos-dashboard-backend/src/` (`server.js`, sourcemaps, d.ts files); updated root `.gitignore` to block future tracked artifacts under `pos-dashboard-backend/src/*.js|*.d.ts*`. Validation: frontend `npx tsc --noEmit` and `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` and `npm run build` passed; reachability scan reports 0 orphan TS/TSX files (excluding `vite.config.ts`).
- 2026-03-04 02:47 EST — Phase 1 structural refactor pass shipped (behavior-preserving modularization). Extracted backend parser/date/task/CRM validators into `pos-dashboard-backend/src/parsers.ts` and SQL-safe field expressions/date helpers into `pos-dashboard-backend/src/sqlFields.ts`, then updated `pos-dashboard-backend/src/server.ts` to import these modules (server reduced from 3097 to 2990 lines). Extracted frontend dashboard utility/date/format/math helpers into `components/salesUtils.ts` and CRM UPS typing/normalization/lane-priority helpers into `components/crmUpsUtils.ts`; updated `components/SalesDashboard.tsx` and `components/CRMWorkspace.tsx` to consume these modules (SalesDashboard 3055→2967 lines, CRMWorkspace 1417→1337 lines). Validation: frontend `npx tsc --noEmit` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed. Deploy: updated `/fd` static bundle to `/fd/assets/index-CqNt3Kak.js`. Ops note: `/fd/api/health` briefly returned 502 due `pos-api` crash loop (`Cannot find module 'dotenv/config'` in runtime env); repaired by reinstalling backend deps (`npm install` in `pos-dashboard-backend`) and restarting PM2 `pos-api`, then re-verified external health returns `{"ok":true,"db":1}`.
- 2026-03-04 02:56 EST — Phase 2 structural refactor pass completed for app-shell modularization. Split monolithic `App.tsx` into dedicated modules under `components/app/` (`tabs.ts`, `NavItem.tsx`, `AuthScreen.tsx`, `LoadingOverlay.tsx`, `themeStyles.ts`) and rewired imports/usages to keep behavior unchanged while reducing `App.tsx` from 1120 to 742 lines. Validation: frontend `npx tsc --noEmit` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed. Current code footprint snapshot: `*.ts|tsx|js|jsx` = 14,074 lines, tracked code/docs/scripts (`ts/tsx/js/jsx/css/html/json/md/py/sql`) = 21,570 lines.
- 2026-03-04 03:05 EST — Phase 3 structural refactor pass shipped (behavior-preserving modularization of largest remaining files). Backend: extracted Tasks and CRM endpoint blocks out of `pos-dashboard-backend/src/server.ts` into `pos-dashboard-backend/src/routes/tasksRoutes.ts` and `pos-dashboard-backend/src/routes/crmRoutes.ts`, then registered route modules from server; `server.ts` reduced from 2990 to 2475 lines. Frontend: extracted sortable card DnD wrapper into `components/sales/SortableItem.tsx` and report totals/percentage math + types into `components/salesReportUtils.ts`, reducing `components/SalesDashboard.tsx` from 2967 to 2893 lines. Validation: frontend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed. Updated footprint snapshot: `*.ts|tsx|js|jsx` = 13,916 lines and tracked code/docs/scripts (`ts/tsx/js/jsx/css/html/json/md/py/sql`) = 21,413 lines.
- 2026-03-04 03:19 EST — Phase 4/5 modular refactor pass shipped live (behavior-preserving). Frontend: decomposed `components/WorkAdvertising.tsx` by extracting shared domain types to `components/workAdvertising/types.ts` and analytics/import/demo helpers to `components/workAdvertising/utils.ts`; `WorkAdvertising.tsx` reduced from 1698 to 1267 lines. Backend: extracted owner/admin user-management routes from `pos-dashboard-backend/src/server.ts` into `pos-dashboard-backend/src/routes/adminRoutes.ts` and registered via dependency-injected route wiring; `server.ts` reduced from 2475 to 2325 lines. Validation: frontend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed. Updated footprint snapshot: `*.ts|tsx|js|jsx` = 13,864 lines and tracked code/docs/scripts (`ts/tsx/js/jsx/css/html/json/md/py/sql`) = 21,362 lines.
- 2026-03-04 03:25 EST — Phase 6 modular refactor pass shipped (behavior-preserving auth + print UI extraction). Backend: extracted auth/session route flow from `pos-dashboard-backend/src/server.ts` into `pos-dashboard-backend/src/routes/authRoutes.ts` (login/logout/me, `/api` auth middleware gate, change-password) and wired through dependency injection; `server.ts` reduced from 2325 to 2268 lines. Frontend: extracted Sales dashboard print options modal into `components/sales/SalesPrintDialog.tsx` and integrated in `components/SalesDashboard.tsx`; `SalesDashboard.tsx` reduced from 2893 to 2822 lines. Validation: frontend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed.
- 2026-03-04 03:35 EST — Phase 7 modular refactor pass shipped (behavior-preserving print/report extraction). Frontend: extracted large print drill-down sections (manufacturer/category) from `components/SalesDashboard.tsx` into `components/sales/SalesDrilldownPrintSections.tsx`, reducing `SalesDashboard.tsx` from 2822 to 2610 lines. Backend: extracted `/api/report/sales-summary` endpoint into `pos-dashboard-backend/src/routes/reportRoutes.ts` and wired registration in `server.ts`, reducing `pos-dashboard-backend/src/server.ts` from 2268 to 2096 lines. Validation: frontend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed. Updated footprint snapshot: `*.ts|tsx|js|jsx` = 14,273 lines and tracked code/docs/scripts (`ts/tsx/js/jsx/css/html/json/md/py/sql`) = 21,773 lines.
- 2026-03-04 03:49 EST — Phase 8 modular refactor pass shipped (behavior-preserving core-print + analytics route extraction). Frontend: extracted remaining print sections (low-margin/store/salesperson tables) from `components/SalesDashboard.tsx` into `components/sales/SalesCorePrintSections.tsx`, reducing `SalesDashboard.tsx` from 2610 to 2467 lines. Backend: extracted analytics endpoints `/api/low-margin`, `/api/summary`, and `/api/leaderboard` from `pos-dashboard-backend/src/server.ts` into `pos-dashboard-backend/src/routes/analyticsRoutes.ts` and wired registration with injected date-field helpers, reducing `server.ts` from 2096 to 1899 lines. Validation: frontend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed. Updated footprint snapshot: `*.ts|tsx|js|jsx` = 14,277 lines and tracked code/docs/scripts (`ts/tsx/js/jsx/css/html/json/md/py/sql`) = 21,778 lines.
- 2026-03-04 03:58 EST — Phase 9 modular refactor pass shipped (behavior-preserving Sales report extraction). Frontend: extracted the remaining interactive `Sales Report / Lowest Margins` UI block from `components/SalesDashboard.tsx` into `components/sales/SalesReportCard.tsx`, wiring existing state/filters/sort handlers through props with no behavior change; `SalesDashboard.tsx` reduced from 2467 to 2252 lines. Backend remained unchanged this phase (`server.ts` stays 1899 lines). Validation: frontend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed; backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` + `npm run build` passed. Updated footprint snapshot: `*.ts|tsx|js|jsx` = 14,486 lines and tracked code/docs/scripts (`ts/tsx/js/jsx/css/html/json/md/py/sql`) = 21,988 lines.
