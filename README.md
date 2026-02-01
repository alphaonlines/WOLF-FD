# WOLF FD Dashboard

Furniture Distributors dashboard (Vite + React) with a local POS backend API and Postgres data store.

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
   `curl -s http://127.0.0.1:5055/health`

Default ports:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5055`

## Backend Environment

Create `pos-dashboard-backend/.env` with Postgres credentials:

```
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=salesdb
PGUSER=salesapp
PGPASSWORD=dev_password_change_me
```

## CSV/XLSX Import Workflow

- Put `.xlsx`/`.xls` files into `pos-dashboard-backend/incoming/`.
- Run importer:
  `cd pos-dashboard-backend && source .venv/bin/activate && python importer/import_pos_xlsx.py`
- Re-import without moving files:
  `python importer/import_pos_xlsx.py --include-processed --no-move`

## Notes

- The backend API is intended to run locally (non-Docker) for development and demos.
- Frontend talks to the backend via `VITE_POS_API_BASE_URL` (defaults to `http://127.0.0.1:5055`).
- For deeper setup, see `PROJECT_NOTES.md` and `AGENTS.md`.
