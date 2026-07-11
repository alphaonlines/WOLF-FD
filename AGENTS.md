---
Last Modified: 2026-07-10 17:05 EDT
Modified By: Kali / gpt-5.5
Related Kanban: t_6a73a6e3
Project: WOLF FD Dashboard
Machine: AlphaHS
Version: 0.7.4.1148
---

# WOLF FD Dashboard Agent Front Door

## Read This First

This is the canonical agent guide for `/home/alphahs/WOLF-FD` on AlphaHS.

If another file points here, this file wins unless Anthony explicitly says otherwise.

## Current Operating State

- Project: WOLF FD Dashboard / Furniture Distributors dashboard.
- Repo path: `/home/alphahs/WOLF-FD`.
- Live public route: `https://furnituredistributors.wolf.discount/fd/`.
- Live API route: `https://furnituredistributors.wolf.discount/fd/api/`.
- Live static web root: `/srv/www/wolf.discount/fd`.
- Backend app/API: Node/Express under `pos-dashboard-backend/`.
- Frontend: Vite + React + TypeScript.
- Database: PostgreSQL-backed POS/reporting data.
- Current branch when this guide was created: `botbot-tutorial-revive`.








## Latest Change - FD Blog File Inventory Recorded

- Timestamp: `2026-07-10 16:36 EDT`.
- Inventory source: discovered new Furniture Distributors blog/resource-center files under live root `/srv/www/wolf.discount/furnituredistributors/blog/` and staging/temp root `/tmp/fd-blog-resource-center/`.
- Live files recorded: `index.html`, `will-it-fit.html`, `furniture-style-quiz.html`, `sofa-cleaning-codes.html`, `measure-your-room.html`, `delivery-day-checklist.html`, `manufacturer-spotlights.html`, `styles.css`, `sitemap.xml`.
- Public URLs verified: `https://furnituredistributors.wolf.discount/blog/` and `https://furnituredistributors.wolf.discount/blog/will-it-fit.html` returned HTTP 200.
- Rollback/backup: AGENTS backup `/home/alphahs/backups/WOLF-FD-AGENTS-before-fd-blog-inventory-20260710-163643.md`; existing blog backups remain `/home/alphahs/backups/fd-blog-20260710-161611/` and `/home/alphahs/backups/fd-blog-fit-20260710-162050/`.
- Risk: documentation/inventory update only; no live site files, services, nginx config, cron jobs, or databases changed.


## Latest Change - Outdoor Deals Blog Page Added

- Timestamp: `2026-07-10 17:05 EDT`.
- Change: added `/srv/www/wolf.discount/furnituredistributors/blog/outdoor-furniture-deals-morehead-newport.html` with three outdoor product images, linked it from the Resource Center home page, and included it in the blog sitemap for the Furniture Distributors outdoor social/Google post.
- Rollback/backup: `/home/alphahs/backups/fd-blog-outdoor-20260710-165703/` plus AGENTS backup `/home/alphahs/backups/WOLF-FD-AGENTS-before-outdoor-blog-20260710-1705.md`.
- Validation: public blog page returned HTTP 200 and rendered cleanly with product photos; Resource Center home returned HTTP 200 and contains the outdoor deals link.
- Risk: static files only; no services restarted or nginx config changed.

## Latest Change - Will It Fit Calculator Added

- Timestamp: `2026-07-10 16:23 EDT`.
- Change: added a static `Will It Fit?` furniture fit calculator at `/srv/www/wolf.discount/furnituredistributors/blog/will-it-fit.html`, linked it from the Resource Center nav/home CTA, and updated `/srv/www/wolf.discount/furnituredistributors/blog/sitemap.xml`.
- Rollback/backup: `/home/alphahs/backups/fd-blog-fit-20260710-162050/` plus AGENTS backup `/home/alphahs/backups/WOLF-FD-AGENTS-before-fd-fit-calculator-20260710-1623.md`.
- Validation: public `https://furnituredistributors.wolf.discount/blog/will-it-fit.html` returned HTTP 200; browser DOM check confirmed the calculator JavaScript renders a result; updated blog sitemap returned HTTP 200.
- Risk: static files only; no services restarted or nginx config changed.

## Latest Change - Public Resource Center / Blog Added

- Timestamp: `2026-07-10 16:19 EDT`.
- Change: added a first-pass public Furniture Distributors Resource Center/blog under `/srv/www/wolf.discount/furnituredistributors/blog/` and added a `Resource Center` quick-link to `/srv/www/wolf.discount/furnituredistributors/index.html`.
- Pages added: `index.html`, `sofa-cleaning-codes.html`, `measure-your-room.html`, `delivery-day-checklist.html`, `manufacturer-spotlights.html`, `furniture-style-quiz.html`, `styles.css`, `sitemap.xml`.
- Rollback/backup: `/home/alphahs/backups/fd-blog-20260710-161611/` plus AGENTS backup `/home/alphahs/backups/WOLF-FD-AGENTS-before-fd-resource-center-20260710-1619.md`.
- Validation: public `https://furnituredistributors.wolf.discount/blog/` and starter guide pages returned HTTP 200; stylesheet returned HTTP 200; browser render check showed the Resource Center page readable/polished; quiz JavaScript result display verified via browser DOM.
- Risk: static files only; no services restarted or nginx config changed.

## Latest Change - Manager Specials Upload Page Restored

- Timestamp: `2026-07-07 10:12 EDT`.
- Root cause: `/srv/www/wolf.discount/fd/manager-specials-upload.html` was missing, so nginx `location ^~ /fd/` fell back to `/fd/index.html`; the URL changed but the FD dashboard/login page rendered instead of the uploader.
- Fix: restored known-good uploader HTML from `/home/alphahs/backups/wolf-fd-live-before-kiosk-detail-20260621-170625/manager-specials-upload.html` to live `/srv/www/wolf.discount/fd/manager-specials-upload.html` and copied it into source at `/home/alphahs/WOLF-FD/public/manager-specials-upload.html` so future Vite builds keep it.
- Rollback/backup: `/home/alphahs/backups/manager-specials-upload-restore-20260707-101138/` and AGENTS backup `/home/alphahs/backups/WOLF-FD-AGENTS-before-manager-specials-upload-restore-20260707-101222.md`.
- Validation: public `/fd/manager-specials-upload.html` returns `200`, title `Manager Specials Uploader | WOLF FD`, contains file input and posts to `/fd-upload-csv`; browser snapshot shows `Browse Files`; adjacent `/fd/` returns `200`; `/fd/api/health` returns `200`.

## Latest Change - Training Podcast Media Playback Fixed

- Version stamp: `1.6.24.1636` / package `0.6.24-1636`.
- Root cause: the training page pointed at the podcast file, but the backend had no streaming route for the media asset; unauthenticated media probes returned 401/404 and the browser video player could not get byte ranges.
- Fix: added allowlisted training media streaming route with `Range` support for `jackson-feature-catnapper.mp4`, allowed that media path through auth middleware, kept frontend source at the deployed nginx path `/fd/api/api/training/media/jackson-feature-catnapper.mp4`, rebuilt/redeployed frontend, rebuilt/restarted `pos-api`.
- Validation: `npm run build`; `cd pos-dashboard-backend && npm run build`; live `/fd/smartcalc/version.json` returns `1.6.24.1636`; live `/fd/api/health` returns `{"ok":true,"db":1}`; live media request with `Range: bytes=0-1023` returns `206 Partial Content`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`, and `Content-Range: bytes 0-1023/877780526`.

## Latest Change - Dashboard Version + Training Module Enabled

- Version stamp: `1.6.24.1614` / package `0.6.24-1614`.
- Root cause: the dashboard display version was still old, and the Training podcast card had source/live markers but the Training module itself was not fully wired into the app shell/backend permission catalog.
- Fix: bumped `package.json` display version, synced Smart Calc version files, wired `TRAINING_PODCASTS` dashboard navigation to `Tab.TRAINING`, added the Training sidebar item and `TrainingWorkspace` render case, added backend permission catalog entries for `module.training` and `card.dashboard.training_podcasts`, and enabled those permissions for Owner/Manager/Sales/Marketing roles in the live DB.
- Live backup before deploy: `/home/alphahs/backups/wolf-fd-live-before-version-training-20260624-162530`.
- Validation: `npm run build`; `cd pos-dashboard-backend && npm run build`; live `/fd/smartcalc/version.json` returns `1.6.24.1614`; live `/fd/api/health` returns `{"ok":true,"db":1}`; live asset `index-CONvJAAC.js` contains `1.6.24.1614`, `training-podcasts`, `TRAINING_PODCASTS`, `sidebar-training-nav-item`, and `Jackson & Catnapper`; live role permissions verified true for Owner/Manager/Sales/Marketing and false for Support.

## Latest Change - Training Podcast Dashboard Card Forced Visible

- Version stamp: 0.6.24.1609.
- Root cause: the Training/Podcasts card existed and was default-visible in source, but older customized dashboard localStorage could keep it hidden for users who had saved card visibility before the podcast card was added.
- Fix: `components/DashboardOverview.tsx` now forces `training-podcasts` into the visible-card set when the card is available.
- Live backup before deploy: `/home/alphahs/backups/wolf-fd-live-before-training-card-force-20260624-160935`.
- Validation: `npm run build`; deploy-marker checks for `Finance Cost`, `fd-sales-analysis-card-order`, `SHOP_CALCULATOR`, `AMP_FDCONNECT`, `AMP_KIOSKS`, `training-podcasts`, and `TRAINING_PODCASTS`; `git diff --check`; public `/fd/` returned 200; public `/fd/api/health` returned `{"ok":true,"db":1}`; live asset `index-Dwaphq9I.js` contains `training-podcasts`, `TRAINING_PODCASTS`, and `Jackson & Catnapper`.

## Latest Change - EZPro Import Date Basis Restored

- Version stamp: `0.6.07.1238`.
- Root cause: `/home/alphahs/.hermes/scripts/ezpro_wolf_fd_reports.py` passed `--date-basis delivered|written`, but `pos-dashboard-backend/importer/import_pos_xlsx.py` no longer accepted that argument. EZPro downloads were succeeding; imports failed with `unrecognized arguments: --date-basis ...`.
- Fix: restored importer `--date-basis {delivered,written}` support and route import coverage through `delivery_confirmed_date` for delivered basis or `sale_date` for written basis.
- Safety backup before edit: `/home/alphahs/WOLF-FD/pos-dashboard-backend/importer/import_pos_xlsx.py.bak-20260607-123815`.
- Validation: `.import-venv/bin/python -m py_compile importer/import_pos_xlsx.py`; importer `--help` shows `--date-basis`; reran yesterday delivered import (`complete ok=1 failed=0`, 4 sales rows + 7 item rows); reran yesterday written items-only import (`complete ok=1 failed=0`, 26 item rows); verified latest `pos_import_coverage` rows use `delivery_confirmed_date` for delivered and `sale_date` for written.

## Latest Change - FD Pulse Organic Header Tab Visibility

- Version stamp: `0.6.07.0145`.
- Root cause: `components/PulseWorkspace.tsx` contained the new `Organic + GA4` child subtab, but `App.tsx` renders Pulse with `hideTabBar={true}` and uses the app header as the only visible Pulse subtab bar. The parent header did not include the new `marketing` subtab, so users could not see or click it.
- Fix: `App.tsx` now adds a visible `Organic + GA4` Pulse header button (`data-tour-id="pulse-tab-marketing"`) wired to the existing embedded `/fd/pulse-organic/` iframe.
- Build asset after fix: `index-CGB8PIr0.js`.
- Checkpoint before fix: `/home/alphahs/backups/fd-pulse-organic-visible-fix-20260607-014234`.
- Validation before live deploy: `npm run build`, marker checks for `pulse-tab-marketing`, `Organic + GA4`, `FD Pulse Organic + GA4`, `/fd/pulse-organic/`, and required deploy-safety markers; `git diff --check`; `npm run test -- --run` (7 files / 18 tests passed).

## Previous Change - FD Pulse Organic Embed

- Version stamp: `0.6.07.0131`.
- Added standalone FD Pulse organic/GA4 SQLite dashboard service at `/home/alphahs/fd-pulse-dashboard`, PM2 process `fd-pulse-dashboard`, local port `8879`.
- Public proxied route: `https://furnituredistributors.wolf.discount/fd/pulse-organic/`.
- Pulse `Organic + GA4` subtab now embeds that route via `components/PulseWorkspace.tsx`.
- Live frontend asset after deploy: `index-DNTUziDL.js`.
- Live backup before deploy: `/home/alphahs/backups/wolf-fd-live-before-deploy-20260607-013526`.
- Wider checkpoint before modifications: `/home/alphahs/backups/fd-pulse-ga4-replace-20260607-013301`.
- Validation: `npm run build`, required live-marker grep checks, `git diff --check`, `npm run test -- --run` (7 files / 18 tests passed), public dashboard/API/FD app health probes.

## Critical Live/Source Warning

The live site was restored from a good static backup after Pulse / Sales Analysis reverted to an older bundle.

Confirmed good live static restore:

- Restored source: `/home/alphahs/backups/fd-static-20260605-215740`.
- Safety backup of overwritten live root: `/home/alphahs/backups/wolf-fd-live-before-restore-20260606-213907`.
- Live version after restore: `1.6.3.1554`.
- Live asset after restore: `assets/index-BqRqdO81.js`.

The repo source may still report older version metadata (`1.5.28.1535`) until source reconciliation is finished.

Do not deploy a new frontend build until the build asset proves it contains the restored Sales Analysis markers below.

## Required Frontend Deploy Markers

Before any frontend deploy, the built `dist/assets/*.js` must contain:

- `Finance Cost`
- `fd-sales-analysis-card-order`
- `SHOP_CALCULATOR`
- `AMP_FDCONNECT`
- `AMP_KIOSKS`

Recommended check:

```bash
cd /home/alphahs/WOLF-FD
npm run build
for m in "Finance Cost" "fd-sales-analysis-card-order" "SHOP_CALCULATOR" "AMP_FDCONNECT" "AMP_KIOSKS"; do
  grep -R "$m" dist/assets/*.js >/dev/null || { echo "Missing marker: $m"; exit 1; }
done
```

If any marker is missing, stop. Do not deploy. A missing marker is a bent pin in the deployment socket.

## Backup Rule Before Live Writes

Before replacing `/srv/www/wolf.discount/fd/`, always make a fresh backup:

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
sudo rsync -a /srv/www/wolf.discount/fd/ /home/alphahs/backups/wolf-fd-live-before-deploy-$STAMP/
```

Then deploy only a verified build:

```bash
sudo rsync -a --delete /home/alphahs/WOLF-FD/dist/ /srv/www/wolf.discount/fd/
```

After deploy, verify public route, version, API health, and marker presence in the public asset.

## Do Not Do These

- Do not run `git stash pop` in this repo.
- Do not delete uploads, incoming files, processed POS files, generated media, or backups without a manifest and Anthony approval.
- Do not copy `.env`, tokens, cookies, API keys, or credential values into docs.
- Do not deploy frontend just to apply backend-only changes.
- Do not assume local source is newer than live. Prove with version and marker checks.
- Do not make root-level documentation sprawl worse. Put new operational docs under `docs/`.

## Recovery Handles

Known useful backups/recovery points:

- Good static backup: `/home/alphahs/backups/fd-static-20260605-215740`.
- Live backup before emergency restore: `/home/alphahs/backups/wolf-fd-live-before-restore-20260606-213907`.
- Cleanup checkpoint manifests: `/home/alphahs/backups/wolf-fd-cleanup-checkpoint-*`.
- Possible source recovery: repo `refs/stash` and June 2/June 6 backups under `/home/alphahs/backups/`.

## Main Surfaces / Modules

- Dashboard Overview: `components/DashboardOverview.tsx`.
- Pulse / Sales Analysis: `components/PulseWorkspace.tsx`, `components/SalesDashboard.tsx`, `components/sales/**`.
- Shop / Product Search / Smart Calc: `components/ShopWorkspace.tsx`, `components/ProductSearchWorkspace.tsx`, `components/SmartPricingCalculatorPage.tsx`, `public/tools/smart-pricing-calculator.html`.
- AMP / FD Connect / Kiosks: `components/AmpWorkspace.tsx`, `components/KiosksStatus.tsx`.
- Den / Social Publisher: `components/WorkAdvertising.tsx`, `components/workAdvertising/**`, `services/socialApi.ts`, `pos-dashboard-backend/src/routes/socialRoutes.ts`.
- CRM: `components/CRMWorkspace.tsx`, `components/crm/**`.
- BotBot: `components/botbot/**`, `services/botbotApi.ts`.
- Settings / permissions: `components/OwnerSettings.tsx`, `components/settings/**`, `services/employeePermissionsApi.ts`.

## Docs Map

Start here:

- `docs/00_Quick_Find_Index.md`
- `docs/architecture/WOLF-FD-System-Map.md`
- `docs/operations/Deploy-Runbook.md`
- `docs/operations/Live-Recovery-Runbook.md`
- `docs/operations/Versioning-Policy.md`

## Standard Validation

Frontend:

```bash
cd /home/alphahs/WOLF-FD
npm run test
npm run build
git diff --check
```

Backend when backend files changed:

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test
npm run build
curl -sS https://furnituredistributors.wolf.discount/fd/api/health
```

Live smoke:

```bash
curl -sSI https://furnituredistributors.wolf.discount/fd/
curl -sS https://furnituredistributors.wolf.discount/fd/smartcalc/version.json
curl -sS https://furnituredistributors.wolf.discount/fd/api/health
```

## Update Protocol

After meaningful work, update:

1. This file if the operating rules changed.
2. Relevant docs under `docs/`.
3. Any Obsidian WOLF FD Dashboard front door if the project status changed.
4. Include exact tests/builds/deploys run and live asset/version evidence.
