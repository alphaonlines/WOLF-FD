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
- Importer now skips non–sales report exports to avoid duplicate sale_id conflicts.

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
