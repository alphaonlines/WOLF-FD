---
Last Modified: 2026-06-06 21:50 -0400
Modified By: Mason S. Ives / gpt-5.5
Related Kanban: N/A
Project: WOLF FD Dashboard
Machine: AlphaHS
---

# WOLF FD Dashboard System Map

## Machines And Runtime

WOLF FD Dashboard runs on AlphaHS as a public Furniture Distributors dashboard.

```text
Anthony / browser
  |
  v
https://furnituredistributors.wolf.discount/fd/
  |
  v
Nginx on AlphaHS
  |-- static frontend: /srv/www/wolf.discount/fd
  |-- /fd/api/ proxy: FD backend API

Source repo:
/home/alphahs/WOLF-FD
  |-- Frontend: Vite + React + TypeScript
  |-- Backend: pos-dashboard-backend/ Node + Express + TypeScript
  |-- Importers: pos-dashboard-backend/importer/
  |-- Static Smart Calc: public/tools/smart-pricing-calculator.html
```

## Source vs Live

The repo is the editable source of truth only after it is reconciled with live. Live is currently safer than source for the recently restored Pulse Sales Analysis feature because live static was restored from a verified backup.

Current restored live proof:

- Live version: `1.6.3.1554`.
- Live bundle: `assets/index-BqRqdO81.js`.
- Live markers: `Finance Cost`, `fd-sales-analysis-card-order`, `SHOP_CALCULATOR`, `AMP_FDCONNECT`, `AMP_KIOSKS`.

## Major Frontend Areas

- Dashboard Overview: landing cards and cross-module shortcuts.
- Pulse Sales Analysis: `PulseWorkspace`, `SalesDashboard`, sales utilities, compare labels, Finance Cost KPI.
- Shop: Product Search, Smart Calc, cart-to-quote flow.
- AMP: FD Connect and Kiosks.
- Den: Work Advertising / Social Publisher.
- CRM: CRM workspace and objection tools.
- BotBot: local assistant UI, chat panel, settings/admin.
- Settings: users, permissions, integrations.

## Data Flows

### POS Sales Flow

```text
POS XLS/XLSX export
  -> pos-dashboard-backend/incoming/
  -> importer/import_pos_xlsx.py
  -> PostgreSQL normalized tables and raw JSON
  -> Express reporting API
  -> SalesDashboard / Pulse UI
```

### Static Deploy Flow

```text
/home/alphahs/WOLF-FD source
  -> npm run build
  -> dist/assets/<hash>.js
  -> marker verification
  -> backup /srv/www/wolf.discount/fd
  -> rsync dist/ to live static root
  -> public curl/version/API/asset marker verification
```

## Do-Not-Touch Without Checkpoint

- `/srv/www/wolf.discount/fd`
- `/home/alphahs/backups/fd-static-20260605-215740`
- `/home/alphahs/backups/wolf-fd-live-before-restore-20260606-213907`
- `.env`, `.env.production`, credential-adjacent files
- Upload/runtime data directories
- `refs/stash` until source reconciliation is complete
