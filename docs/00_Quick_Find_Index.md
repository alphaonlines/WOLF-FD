---
Last Modified: 2026-06-06 21:50 -0400
Modified By: Mason S. Ives / gpt-5.5
Related Kanban: N/A
Project: WOLF FD Dashboard
Machine: AlphaHS
---

# WOLF FD Dashboard Quick Find Index

## First Reads

- `AGENTS.md` — canonical agent operating guide.
- `docs/architecture/WOLF-FD-System-Map.md` — system topology and module map.
- `docs/operations/Deploy-Runbook.md` — safe frontend/backend deploy steps.
- `docs/operations/Live-Recovery-Runbook.md` — static backup restore procedure.
- `docs/operations/Versioning-Policy.md` — display-version and marker rules.
- `docs/operations/Backup-and-Cleanup-Policy.md` — cleanup classification and checkpoint rules.

## Current Emergency Context

Live FD was restored from `/home/alphahs/backups/fd-static-20260605-215740` to recover the Pulse / Sales Analysis changes. The restored live static version is `1.6.3.1554`.

The source tree must not be deployed until it builds a bundle with these markers:

- `Finance Cost`
- `fd-sales-analysis-card-order`
- `SHOP_CALCULATOR`
- `AMP_FDCONNECT`
- `AMP_KIOSKS`

## Common Paths

- Repo: `/home/alphahs/WOLF-FD`
- Live static root: `/srv/www/wolf.discount/fd`
- Public URL: `https://furnituredistributors.wolf.discount/fd/`
- Public API: `https://furnituredistributors.wolf.discount/fd/api/`
- Backups: `/home/alphahs/backups/`

## Module Docs To Add Next

- `docs/modules/Pulse-Sales-Analysis.md`
- `docs/modules/Shop-Product-Search-Smart-Calc.md`
- `docs/modules/AMP-FD-Connect-Kiosks.md`
- `docs/modules/Den-Social-Publisher.md`
- `docs/modules/BotBot.md`
- `docs/modules/Settings-Permissions.md`
