# Repository Guidelines

## Purpose

This file is the shared working memory for `/home/alphahs/WOLF-FD`. Keep it current, concise, and operational so the next work session can resume quickly.

## Logging Rules

- Append a new Running Log entry for every meaningful task.
- Use local timestamps in `YYYY-MM-DD HH:MM TZ` format.
- Keep entries factual and compact. Do not record secrets, tokens, or raw passwords.
- Include what changed, where, and what commands/tests were run, or note `not run`.
- If the log starts getting noisy, condense older history and rely on `git log --follow -- AGENTS.md` for full detail.
- Commit discipline: when a requested major repo change is complete, create a commit unless the user explicitly says not to.

## Current Stack

- Frontend: Vite + React + TypeScript, built from the repo root into `dist/`.
- Backend: Node.js + Express + TypeScript in `pos-dashboard-backend/`.
- Process manager: PM2 process `pos-api`, currently started from `/home/alphahs/WOLF-FD/pos-dashboard-backend` with `npm run start`.
- Database: PostgreSQL via backend `PG*` environment variables.
- Auth: HTTP-only session cookies plus Google Workspace sign-in/request-access flow.
- Live URL: `https://furnituredistributors.wolf.discount/fd/`
- Live API path: `https://furnituredistributors.wolf.discount/fd/api/`
- Current branch: `main`
- Current display version in `package.json`: `0.3.28.15`

## Project Structure

- `App.tsx`, `index.tsx`, `index.html`: app shell and entrypoints.
- `components/`: main workspaces and UI modules.
- Key workspaces:
  - `components/CRMWorkspace.tsx`
  - `components/SalesDashboard.tsx`
  - `components/ProductSearchWorkspace.tsx`
  - `components/ManufacturerPricelistPortal.tsx`
  - `components/UpdateDatabase.tsx`
  - `components/OwnerSettings.tsx`
  - `components/AdminUsers.tsx`
  - `components/MessageBoard.tsx`
- `components/app/`: shell, tabs, auth screen, theme, permissions.
- `components/sales/`: Sales Analysis print/report subcomponents.
- `services/`: frontend API clients and persistence helpers.
- `types.ts`, `constants.ts`: shared frontend contracts.
- `pos-dashboard-backend/src/`: backend runtime and route wiring.
- `pos-dashboard-backend/src/routes/`: feature route modules for auth, CRM, board, sales, tasks, manufacturer pricebooks, and system endpoints.
- `pos-dashboard-backend/db/schema.sql`: database schema baseline.
- `pos-dashboard-backend/importer/`: POS import scripts.
- `pos-dashboard-backend/manufacturer-pricebooks/holding/`: staged manufacturer uploads before preview/publish.
- `dist/`: built frontend output. Treat it as deploy artifact, not source of truth.

## Build, Run, and Deploy

From repo root:

- `npm install`
- `npm run dev`
- `npm run build`

From backend:

- `cd /home/alphahs/WOLF-FD/pos-dashboard-backend && npm install`
- `cd /home/alphahs/WOLF-FD/pos-dashboard-backend && npm run dev`
- `cd /home/alphahs/WOLF-FD/pos-dashboard-backend && npm run build`
- `cd /home/alphahs/WOLF-FD/pos-dashboard-backend && npm run start`

Operational checks:

- `pm2 describe pos-api`
- `pm2 restart pos-api`
- `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`
- `curl -skS -o /tmp/auth-config.out -w '%{http_code}' -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/api/auth/config`

Frontend deploy flow:

1. `cd /home/alphahs/WOLF-FD && npm run build`
2. `cp -r /home/alphahs/WOLF-FD/dist/* /srv/www/wolf.discount/fd/`
3. Hard refresh the browser after deploy.

Backend deploy flow for route/schema/runtime changes:

1. `cd /home/alphahs/WOLF-FD/pos-dashboard-backend && npm run build`
2. `pm2 restart pos-api`
3. Verify through the live nginx path, not just direct localhost assumptions.

## Environment Notes

- Backend default runtime port is `5057` (`pos-dashboard-backend/src/runtimeConfig.ts`).
- Backend default DB fallbacks are `127.0.0.1:5432 / salesdb / salesapp`, but production values may be overridden by `.env`.
- Frontend production traffic goes through nginx at `/fd/` and `/fd/api/`.
- Frontend services intentionally hit `/fd/api/api/...` for the backend’s Express route layout. Do not “simplify” that path without checking the live proxy behavior.
- Manufacturer catalog work is now a first-class workflow:
  - staging uploads
  - preview/publish by manufacturer
  - shared catalog search
  - dedicated `Product Search` workspace
- Do not commit secrets from `.env`, auth config, DB credentials, or uploaded private vendor files.

## Coding and Maintenance Conventions

- TypeScript + React throughout the frontend; TypeScript + Express in the backend.
- Use 2-space indentation and follow surrounding file style.
- `PascalCase` for components, `camelCase` for functions/variables, `SCREAMING_SNAKE_CASE` for constants.
- Prefer small focused route modules and typed service APIs.
- Bump `displayVersion` in `package.json` when shipping visible live UI changes.
- Do not hand-edit deployed assets under `/srv/www/...`; always rebuild and sync from `dist/`.
- Keep this file useful: summarize patterns, current topology, and meaningful milestones rather than dumping every exploratory command forever.

## Working Snapshot

- Current active areas: CRM queue/workflow polish, Sales Analysis reporting, employee permissions, manufacturer pricebook ingest/publish, and Product Search.
- The backend route surface is now modularized under `pos-dashboard-backend/src/routes/`.
- Older pre-cleanup AGENTS detail was condensed on `2026-03-28 23:14 EDT`; use `git log --follow -- AGENTS.md` if you need the full historical trail.

## Running Log

- 2026-03-28 17:58 EDT — Added the new manufacturer price-book portal entry inside `Update Database` and shipped the first large frontend portal pass for upload, validation, correction, and search. Files: `App.tsx`, `components/UpdateDatabase.tsx`, `components/ManufacturerPricelistPortal.tsx`, `MANUFACTURER_PRICELIST_TODO.md`, `package.json`. Commands: frontend `npm run build`, deploy copy to `/srv/www/wolf.discount/fd/`, live bundle string checks. Tests: frontend build PASS; live bundle sync PASS.
- 2026-03-28 18:11 EDT — Added the real holding-upload flow for manufacturer files, owner-only upload/list APIs, upload metadata storage, and the frontend `Upload to Holding Folder` path. Files: `.gitignore`, `components/ManufacturerPricelistPortal.tsx`, `services/manufacturerPricelistApi.ts`, `types.ts`, `pos-dashboard-backend/db/schema.sql`, `pos-dashboard-backend/src/routes/manufacturerPricebookRoutes.ts`, `pos-dashboard-backend/src/startupBootstrap.ts`, `package.json`. Commands: frontend/backend `npm run build`, `pm2 restart pos-api`, deploy copy, authenticated API checks. Tests: frontend build PASS; backend build PASS; backend route verification PASS.
- 2026-03-28 18:41 EDT — Built the first live Liberty manufacturer pipeline from the uploaded PDF and expanded the portal for multi-file and ZIP staging plus richer search/notes support. Files: `components/ManufacturerPricelistPortal.tsx`, `services/manufacturerPricelistApi.ts`, `types.ts`, `pos-dashboard-backend/src/parsers/libertyPricebook.ts`, `pos-dashboard-backend/src/routes/manufacturerPricebookRoutes.ts`, `pos-dashboard-backend/src/startupBootstrap.ts`, `package.json`. Commands: `pdfinfo`, `pdftotext -layout`, frontend/backend `npm run build`, `pm2 restart pos-api`, authenticated preview/publish/catalog checks. Tests: frontend build PASS; backend build PASS; Liberty preview PASS; Liberty publish PASS.
- 2026-03-28 18:54 EDT — Added ZIP auto-unpack for manufacturer uploads so archive children are extracted into holding, linked by `parent_upload_id`, and surfaced in the portal. Files: `components/ManufacturerPricelistPortal.tsx`, `services/manufacturerPricelistApi.ts`, `types.ts`, `pos-dashboard-backend/db/schema.sql`, `pos-dashboard-backend/src/routes/manufacturerPricebookRoutes.ts`, `pos-dashboard-backend/src/startupBootstrap.ts`, `package.json`. Commands: frontend/backend `npm run build`, `pm2 restart pos-api`, ZIP smoke upload, direct archive unpack for existing `Best` upload. Tests: frontend build PASS; backend build PASS; ZIP upload smoke PASS.
- 2026-03-28 19:14 EDT — Added the Best workbook parser and published the first Best catalog from the staged residential workbook. Files: `components/ManufacturerPricelistPortal.tsx`, `MANUFACTURER_PRICELIST_TODO.md`, `package.json`, `pos-dashboard-backend/src/parsers/bestPricebook.ts`, `pos-dashboard-backend/src/routes/manufacturerPricebookRoutes.ts`, `pos-dashboard-backend/package.json`, `pos-dashboard-backend/package-lock.json`. Commands: workbook inspection with `node` + `xlsx`, backend/frontend builds, deploy copy, `pm2 restart pos-api`, authenticated preview/publish/catalog checks. Tests: frontend build PASS; backend build PASS; Best preview PASS; Best publish PASS.
- 2026-03-28 20:29 EDT — Improved light-mode readability in the CRM queue and committed the fix as `dc05022` (`fix: improve crm queue contrast in light mode`). Files: `components/CRMWorkspace.tsx`, `package.json`. Commands: `git diff`, `npm run build`, deploy copy, `git add`, `git commit`. Tests: frontend build PASS; live bundle sync PASS.
- 2026-03-28 20:34 EDT — Added the dedicated `Product Search` workspace to the app shell, wired permission support for `module.product_search`, and committed it as `4ee23b9` (`feat: add dedicated product search workspace`). Files: `components/ProductSearchWorkspace.tsx`, `components/app/tabs.ts`, `components/app/permissions.ts`, `App.tsx`, `package.json`, `pos-dashboard-backend/src/permissionCatalog.ts`. Commands: frontend/backend builds, deploy copy, `pm2 restart pos-api`, health check, `git add`, `git commit`. Tests: frontend build PASS; backend build PASS; backend health PASS.
- 2026-03-28 20:42 EDT — Backfilled `module.product_search` for older explicit-permission Owner accounts and updated owner fallback permission logic so new owner-default modules stay visible. Files: `components/app/permissions.ts`, `package.json`. Commands: Postgres permission backfill query, verification query, frontend `npm run build`, deploy copy, backend health check. Tests: DB backfill PASS; frontend build PASS; backend health PASS.
- 2026-03-28 20:51 EDT — Tightened manufacturer ingest behavior so publish stays manufacturer-scoped and upload type detection can default automatically. Files: `pos-dashboard-backend/src/routes/manufacturerPricebookRoutes.ts`, `components/ManufacturerPricelistPortal.tsx`, `package.json`. Commands: frontend/backend builds, deploy copy, `pm2 restart pos-api`, health check, manufacturer coexistence query. Tests: frontend build PASS; backend build PASS; backend health PASS; catalog coexistence PASS.
- 2026-03-28 20:56 EDT — Updated `pro1st` handling to exclude mattress and box spring rows everywhere the dashboard calculates Pro1st, added `Pro1st` sales to Sales Analysis, and committed the change as `063faa3` (`feat: add filtered pro1st sales to sales analysis`). Files: `components/sales/SalesReportCard.tsx`, `components/salesReportUtils.ts`, `services/posBackendApi.ts`, `pos-dashboard-backend/src/pro1stSql.ts`, `pos-dashboard-backend/src/routes/reportRoutes.ts`, `pos-dashboard-backend/src/routes/salesDetailRoutes.ts`, `pos-dashboard-backend/src/routes/itemProRoutes.ts`, `pos-dashboard-backend/importer/import_pos_xlsx.py`. Commands: frontend/backend builds, deploy copy, `pm2 restart pos-api`, health probe, auth-guarded report probe, `git add`, `git commit`. Tests: backend build PASS; frontend build PASS; backend health PASS.
- 2026-03-28 20:57 EDT — Removed the `160`-row cap from the dedicated Product Search workspace, increased the fetch limit to `5000`, and shipped display version `0.3.28.15`. Files: `components/ProductSearchWorkspace.tsx`, `package.json`. Commands: frontend `npm run build`, deploy copy, live bundle grep, manufacturer-count query. Tests: frontend build PASS; live bundle sync PASS; DB manufacturer counts PASS.
- 2026-03-28 23:14 EDT — Cleaned up `AGENTS.md` to reflect the current WOLF-FD stack and workflow. Removed stale Firebase/general-server guidance, rewrote the repo overview around the actual frontend/backend/PM2/nginx setup, condensed the running log to recent actionable history, and kept older detail recoverable through git history instead of leaving the file bloated. Files: `AGENTS.md`. Commands: `sed`, `find`, `pm2 describe pos-api`, `ss -ltnup`, live nginx health probe, `git log --oneline`, `date`. Tests: doc-only change; live health probe via nginx PASS (`{"ok":true,"db":1}`).
- 2026-03-28 23:16 EDT — Committed the WOLF-FD AGENTS cleanup as `db2d757` (`docs: streamline repo guidance`). Files: `AGENTS.md`. Commands: `git -C /home/alphahs/WOLF-FD add AGENTS.md`, `git -C /home/alphahs/WOLF-FD commit -m "docs: streamline repo guidance"`. Tests: not run after commit; prior live health probe remained PASS.
- 2026-03-28 23:30 EDT — Updated the CRM opportunity queue to support multiple active customers per salesperson instead of a single shared `current_customer` slot. Added `crm_ups_active_customers` storage plus bootstrap/schema migration, migrated existing live working rows into active-customer records, updated CRM queue APIs to return aggregated active customer lists per rep and added per-customer update/complete/remove endpoints, then rewired `components/CRMWorkspace.tsx` and `services/crmApi.ts` so the selected rep card shows a stack of active customers with per-customer load/sync/complete/remove actions. Files: `components/CRMWorkspace.tsx`, `services/crmApi.ts`, `types.ts`, `pos-dashboard-backend/src/routes/crmRoutesV2.ts`, `pos-dashboard-backend/src/startupBootstrap.ts`, `pos-dashboard-backend/db/schema.sql`. Commands: frontend `npm run build`, backend `npm run build`, `sudo cp -r /home/alphahs/WOLF-FD/dist/. /srv/www/wolf.discount/fd/`, `pm2 restart pos-api`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: frontend build PASS; backend build PASS; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-28 23:35 EDT — Exposed the multi-customer CRM flow in the live UI by letting reps who are already `With Customer` add another active customer directly from the selected queue card. Also removed the `Sync Opportunity Card` and `Load Into Panel` buttons to simplify the workflow; active customer cards are now directly selectable instead. Files: `components/CRMWorkspace.tsx`. Commands: frontend `npm run build`, `sudo cp -r /home/alphahs/WOLF-FD/dist/. /srv/www/wolf.discount/fd/`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: frontend build PASS; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-28 23:42 EDT — Simplified the CRM customer panel by replacing the separate `Save Lead` and `Save Account` actions with one `Save Customer` button. The unified save now updates the customer account first, updates or creates the lead automatically when a phone number is present, and syncs the selected active queue customer behind the scenes when the panel is tied to a live opportunity. Files: `components/CRMWorkspace.tsx`. Commands: frontend `npm run build`, `sudo cp -r /home/alphahs/WOLF-FD/dist/. /srv/www/wolf.discount/fd/`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: frontend build PASS; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-28 23:44 EDT — Bumped the visible WOLF-FD app version from `0.3.28.15` to `0.3.28.16` in `package.json`, rebuilt the frontend, redeployed the live bundle, and rechecked the FD health path. Files: `package.json`. Commands: frontend `npm run build`, `sudo cp -r /home/alphahs/WOLF-FD/dist/. /srv/www/wolf.discount/fd/`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: frontend build PASS; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-28 23:56 EDT — Aligned the CRM save flow with the showroom workflow so `Complete Up` is now the UPS-history save path and `Save Customer` only updates the customer account. Updated `components/CRMWorkspace.tsx` so completing a loaded active customer first syncs the current panel name/description back into the active UPS record, then completes it into history; `Save Customer` no longer creates or updates CRM leads and now only upserts the customer account plus the linked active queue customer details when present. Files: `components/CRMWorkspace.tsx`. Commands: frontend `npm run build`, `sudo cp -r /home/alphahs/WOLF-FD/dist/. /srv/www/wolf.discount/fd/`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: frontend build PASS; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-28 23:57 EDT — Committed the CRM save-flow alignment as `baf3a21` (`fix: align crm save flow with ups history`). Files: `AGENTS.md`, `components/CRMWorkspace.tsx`. Commands: `git -C /home/alphahs/WOLF-FD add AGENTS.md components/CRMWorkspace.tsx`, `git -C /home/alphahs/WOLF-FD commit -m "fix: align crm save flow with ups history"`, `date`. Tests: not run after commit; prior frontend build and live health check remained PASS.
- 2026-03-29 00:05 EDT — Fixed a regression in the CRM `Complete` button so active ups complete reliably again even when the panel has a blank customer name. Updated `components/CRMWorkspace.tsx` to only pre-sync valid changed fields before completion, skip the blocking customer-name patch when blank, and set/reset the queue saving state around the complete flow. Files: `components/CRMWorkspace.tsx`. Commands: frontend `npm run build`, `sudo cp -r /home/alphahs/WOLF-FD/dist/. /srv/www/wolf.discount/fd/`, `ls -lt /srv/www/wolf.discount/fd/assets | head -n 3`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: frontend build PASS; live bundle updated to `assets/index-CoXQItb8.js`; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-29 00:09 EDT — Fixed the CRM customer-name editor so typing in the panel no longer gets reverted by the 4-second UPS queue poll. Updated `components/CRMWorkspace.tsx` so the draft only hydrates from the selected active customer when switching to a different queue customer, instead of reloading the same active record on every refreshed queue payload. Files: `components/CRMWorkspace.tsx`. Commands: frontend `npm run build`, `sudo cp -r /home/alphahs/WOLF-FD/dist/. /srv/www/wolf.discount/fd/`, `ls -lt /srv/www/wolf.discount/fd/assets | head -n 3`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: frontend build PASS; live bundle updated to `assets/index-BQJ7xlnO.js`; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-29 00:03 EDT — Tightened the shared `pro1st` exclusions so Sales Analysis and related Pro1st reporting no longer count mattresses, box springs, foundations, adjustable bases, power bases, or bunkie boards. Updated `pos-dashboard-backend/src/pro1stSql.ts` and the import-time `is_pro1st` filter in `pos-dashboard-backend/importer/import_pos_xlsx.py`, rebuilt the backend, restarted `pos-api`, and verified the live FD API health endpoint. Commands: backend `npm run build`, `pm2 restart pos-api`, `grep -RIn "foundation\\|adjustable base\\|bunkie board" /home/alphahs/WOLF-FD/pos-dashboard-backend/dist`, `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`, `date`. Tests: backend build PASS; dist grep PASS; live health PASS (`{"ok":true,"db":1}`).
- 2026-03-29 00:04 EDT — Committed the Pro1st bedding-foundation exclusion fix as `badb8ed` (`fix: exclude bedding foundations from pro1st`). Files: `AGENTS.md`, `pos-dashboard-backend/src/pro1stSql.ts`, `pos-dashboard-backend/importer/import_pos_xlsx.py`. Commands: `git -C /home/alphahs/WOLF-FD add AGENTS.md pos-dashboard-backend/src/pro1stSql.ts pos-dashboard-backend/importer/import_pos_xlsx.py`, `git -C /home/alphahs/WOLF-FD commit -m "fix: exclude bedding foundations from pro1st"`, `date`. Tests: not run after commit; prior backend build and live health check remained PASS.
- 2026-03-29 00:06 EDT — Changed the Sales Analysis `Pro1st` column to show percent of sale instead of raw dollars by calculating `pro1st_sales / total_retail * 100` for each row and the totals footer in `components/sales/SalesReportCard.tsx`. Rebuilt the frontend, redeployed `/srv/www/wolf.discount/fd/`, and verified the live bundle contains the new `Pro1st % of Sale` label. Commands: frontend `npm run build`, `cp -r /home/alphahs/WOLF-FD/dist/* /srv/www/wolf.discount/fd/`, `grep -RIn "Pro1st % of Sale\\|foundation-related lines" /srv/www/wolf.discount/fd/index.html /srv/www/wolf.discount/fd/assets`, `ls -lt /srv/www/wolf.discount/fd/assets | head -n 3`, `date`. Tests: frontend build PASS; live bundle string check PASS.
- 2026-03-29 00:07 EDT — Committed the Sales Analysis Pro1st percent-of-sale fix as `6424b73` (`fix: show pro1st as percent of sale`). Files: `AGENTS.md`, `components/sales/SalesReportCard.tsx`. Commands: `git -C /home/alphahs/WOLF-FD add AGENTS.md components/sales/SalesReportCard.tsx`, `git -C /home/alphahs/WOLF-FD commit -m "fix: show pro1st as percent of sale"`, `git -C /home/alphahs/WOLF-FD status --short --branch`, `date`. Tests: not run after commit; prior frontend build and live bundle check remained PASS.
- 2026-03-29 00:20 EDT — Consolidated the Sales Dashboard top stat cards into fewer toggle-aware summary cards in `components/SalesDashboard.tsx`. Replaced the separate transactions/total-sales/average-ticket/financed-amount/financed-transactions cards with combined `Sales Overview` and `Finance Overview` cards, made their primary metric follow the header toggle (`Sales` shows dollars first; `QTY` shows transaction counts first), normalized saved card-order preferences to collapse legacy layouts into the new three-card row, rebuilt the frontend, redeployed `/srv/www/wolf.discount/fd/`, and verified the live bundle contains the new overview labels/tooltips. Commands: frontend `npm run build`, `cp -r /home/alphahs/WOLF-FD/dist/* /srv/www/wolf.discount/fd/`, `grep -RIn "Sales Overview\\|Finance Overview\\|QTY mode is showing transaction count first\\|The main number follows the header toggle" /srv/www/wolf.discount/fd/index.html /srv/www/wolf.discount/fd/assets`, `ls -lt /srv/www/wolf.discount/fd/assets | head -n 3`, `date`. Tests: frontend build PASS; live bundle string check PASS.
- 2026-03-29 00:20 EDT — Committed the Sales Dashboard summary-card consolidation as `0dea07d` (`feat: consolidate sales dashboard summary cards`). Files: `AGENTS.md`, `components/SalesDashboard.tsx`. Commands: `git -C /home/alphahs/WOLF-FD add components/SalesDashboard.tsx AGENTS.md`, `git -C /home/alphahs/WOLF-FD commit -m "feat: consolidate sales dashboard summary cards"`, `date`. Tests: not run after commit; prior frontend build and live bundle check remained PASS.
