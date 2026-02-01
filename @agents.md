@agents

Changes applied in this repo (summary):
- Replaced WOLF-FD contents with upcoming-posts-showcase source, including frontend + pos-dashboard-backend.
- Added app-wide passcode gate (password: 1111) with session unlock and blur overlay.
- Added loading overlay (2 seconds) with wolf emoji and animated loading bar; blurred background during load.
- Added Update Database page with header validation and backend upload integration.
- Added backend upload endpoint that saves files to pos-dashboard-backend/incoming and triggers importer.
- Hardened Postgres env defaults in backend (PG* fallbacks).
- Updated available-years API to include sale/delivery/payment years (now shows 2026+).
- Updated sales dashboard upload to use backend when available and refresh data after upload.
- Importer now handles sales reports + item exports, with date-range replacement on import to prevent duplicates.
- Added item analytics endpoints (best sellers, category, manufacturer) and Pro1st attach rate with sale links.
- Added monthly missing-coverage audit (sales vs items) in Update Database panel.
- Added upload retry UI and simplified error/warning handling for file name warnings.
- Reverted experimental sticky filter/compare employees UI back to prior behavior.
- Reintroduced Pro1st/best-seller/category/manufacturer analytics and sale links in the dashboard.
- Embedded Update Database at the top of the dashboard (removed the old one-off upload button).
- Added Pro1st tagging to item imports and item-date-range deletes on import.

Key files touched:
- App.tsx
- components/UpdateDatabase.tsx
- components/SalesDashboard.tsx
- services/posBackendApi.ts
- pos-dashboard-backend/src/server.ts
- pos-dashboard-backend/importer/import_pos_xlsx.py
- package.json / package-lock.json (frontend)
- pos-dashboard-backend/package.json / package-lock.json (backend)

Notes:
- Items exports (ITEMS SOLD / TOPITEMS / CATEGORY) are not imported yet; only sales_report*.xls are ingested into pos_sales.
- Uploading a sales report in the dashboard now triggers backend import automatically.

Deployment notes (wolf.discount/fd):
- Frontend built with Vite base set to /fd/ and deployed to /srv/www/wolf.discount/fd.
- Production API base uses /fd/api (set in .env.production).
- POS backend runs via PM2 as fd-pos-api on PORT=5057 (npm run dev, cwd pos-dashboard-backend).
- Nginx routes added in /etc/nginx/sites-available/wolf.discount:
  - /fd/ -> alias /srv/www/wolf.discount/fd (SPA fallback to /fd/index.html)
  - /fd/api/ -> proxy to http://127.0.0.1:5057/
  - /fd/api/health -> proxy to http://127.0.0.1:5057/health
- Postgres role salesapp created; schema applied to salesdb; privileges granted on public schema.
- Importer uses venv Python at pos-dashboard-backend/.venv/bin/python (POS_IMPORT_PYTHON in pos-dashboard-backend/.env).
- PM2 process list saved (pm2 save) so fd-pos-api restores on reboot via pm2-alphahs service.

## Recent Changes (2026-01-31)
- Moved FD public pages to subdomain: https://furnituredistributors.wolf.discount/
- Added redirects from https://wolf.discount/furnituredistributors/* and /fd/ to the new subdomain.
- Enabled /fd/ app on the subdomain with /fd/api/* routed to :5057.
- Added quick-links index page on the subdomain root with a dashboard button.
- Bedroom page restored with mobile-friendly stacking only (no snow effect).
- Added CSV upload modal button to FD dashboard (/fd/) gated by dashboard unlock; posts to /fd-upload-csv.
- Nginx now listens on 0.0.0.0:80/443 and :443/:80 IPv6; SSL issued for subdomain.
