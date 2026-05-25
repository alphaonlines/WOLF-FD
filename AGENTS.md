# WOLF-FD Agent Handoff

## Resume Checklist

- Current branch: `botbot-tutorial-revive`.
- Dirty/uncommitted files to inspect first: `.env.production, AGENTS.md, components/PulseWorkspace.tsx, index.html, index.tsx, index.css, postcss.config.js, tailwind.config.js, package-lock.json, pos-dashboard-backend/package.json, pos-dashboard-backend/package-lock.json, pos-dashboard-backend/src/routeWiring.ts, pos-dashboard-backend/src/runtimeConfig.ts, pos-dashboard-backend/src/server.ts, pos-dashboard-backend/src/startupBootstrap.ts, pos-dashboard-backend/src/routes/ga4Routes.ts, pos-dashboard-backend/src/routes/stripeTopupRoutes.ts, pos-dashboard-backend/src/routes/stripeTopupRoutes.test.ts`. Treat `.env.production` and backup/env files as sensitive; do not print secrets into chat or logs.
- Latest deployed version: `displayVersion` `1.5.15.1225` in `package.json`.
- Last deploy status: frontend deployed on 2026-05-23 after removing Tailwind CDN and fixing the Pulse Website GA4 stats request path; live HTML check confirmed no `cdn.tailwindcss.com` and a compiled `/fd/assets/*.css` link.
- Live URLs and health checks: `https://furnituredistributors.wolf.discount/fd/`, `https://furnituredistributors.wolf.discount/fd/api/health`, and local nginx probe `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`.
- Active risks/gotchas: this repo has unrelated dirty backend/Stripe/GA4/runtime changes; inspect before editing. Frontend API calls intentionally resolve through `/fd/api/api/...`; do not simplify that path without live proxy verification. Use local/LAN LLM routes only unless Anthony explicitly approves cloud inference.
- Next recommended task: finish or review the in-progress GA4/Stripe backend work, then run backend build, frontend build, PM2 restart if backend changed, and live health checks before any deploy.

## Current Stack

- Frontend: Vite + React + TypeScript, built from the repo root into `dist/`.
- Backend: Node.js + Express + TypeScript in `pos-dashboard-backend/`.
- Process manager: PM2 process `pos-api`, started from `/home/alphahs/WOLF-FD/pos-dashboard-backend` with `npm run start`.
- Database: PostgreSQL via backend `PG*` environment variables.
- Auth: HTTP-only session cookies plus Google Workspace sign-in/request-access flow.
- Live app: `https://furnituredistributors.wolf.discount/fd/`.
- Live API base: `https://furnituredistributors.wolf.discount/fd/api/`.
- Important source areas: app shell in `App.tsx`; workspaces in `components/`; API clients in `services/`; backend routes in `pos-dashboard-backend/src/routes/`; schema baseline in `pos-dashboard-backend/db/schema.sql`; deployed artifacts in `dist/` are build output only.

## Deploy / Verify Commands

- Frontend build: `cd /home/alphahs/WOLF-FD && npm run build`.
- Frontend deploy: `cd /home/alphahs/WOLF-FD && sudo cp -r dist/. /srv/www/wolf.discount/fd/`.
- Backend build: `cd /home/alphahs/WOLF-FD/pos-dashboard-backend && npm run build`.
- Backend restart: `pm2 restart pos-api`.
- PM2 inspection: `pm2 describe pos-api`.
- Live API health: `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`.
- Auth config probe: `curl -skS -o /tmp/auth-config.out -w '%{http_code}' -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/api/auth/config`.
- Public HTML check: `curl -sS https://furnituredistributors.wolf.discount/fd/ | grep -E 'assets/index-|cdn.tailwindcss'`.

## Production Gotchas

- Frontend production traffic is mounted at `/fd/`; Vite base is `/fd/`.
- Nginx proxies `/fd/api/` to the backend, whose Express routes are also under `/api`; frontend service calls commonly become `/fd/api/api/...` in production.
- Do not hand-edit `/srv/www/wolf.discount/fd/`; rebuild and copy from `dist/`.
- Bump only `displayVersion` in `package.json` for visible live UI changes. Use Anthony's live deploy date/time convention: `1.<month>.<day>.<HHMM>` in local military time.
- Do not commit secrets from `.env`, auth config, DB credentials, uploaded vendor files, or private backups.
- Treat this machine as local-LLM infrastructure first. Do not add cloud model keys or hosted inference fallbacks unless Anthony explicitly changes that direction.
- WOLFbot Playground work for `https://wolf.discount/ai` lives outside this repo at `/home/alphahs/wolfbot-playground`; do not replace live `/srv/www/wolf.discount/ai-guest/` without explicit deployment confirmation.

## Active Work Queue

- Current active sprint: Tutorial fix, sidebar cleanup, module navigation polish, and recent GA4/Stripe/backend runtime work.
- Immediate review target: dirty backend files and untracked `ga4Routes.ts` / Stripe top-up routes before changing API behavior.
- Existing next-task thread: ObjectionsDrawer UX, typed task metadata, custom objections routes/service, objection submission task cards, settings management for custom objections, and sticky module tabs.
- BotBot historical handoff: older `HANDOFF.md` content has been folded into this canonical handoff system. BotBot Phase 1-3 work created backend schema/routes, frontend orb/chat/settings/admin panels, workspace context wiring, and a manual QA path through `BOTBOT_QA_TEST_PLAN.md`.
- Handoff rules: update `AGENTS.md` after meaningful work; include timestamp, files changed, what changed, commands/tests, deploy status, and remaining risk or next step. Any frontend deploy log must mention built asset/version and live verification. Any backend route/runtime log must mention backend build, PM2 restart, and `/fd/api/health`.

## Recent Running Log

- 2026-05-23 07:30 EDT - Reorganized the agent handoff system.
  - Files: `AGENTS.md`, `HANDOFF.md`, `docs/agent-logs/*.md`.
  - Changes: made `AGENTS.md` the canonical resume checklist, moved older running-log history into monthly archives, and replaced the BotBot-specific handoff with a pointer back to this file.
  - Commands/tests: archive creation check, top-of-file readability check, `grep -nE "Current branch|displayVersion|/fd/api|pm2 restart|Running Log" AGENTS.md`.
  - Deploy: not applicable; documentation-only change.
  - Remaining risk: repo still has unrelated dirty runtime/backend files that should be inspected before future implementation work.

- 2026-05-23 07:23 EDT - Removed the live Tailwind CDN dependency and corrected the Pulse Website GA4 stats request path.
  - Files: `index.html`, `index.tsx`, `index.css`, `tailwind.config.js`, `postcss.config.js`, `components/PulseWorkspace.tsx`, `AGENTS.md`.
  - Commands/tests: `npm run build`, `sudo cp -r dist/. /srv/www/wolf.discount/fd/`, public HTML probe, GA4 route probe. Live HTML no longer contains `cdn.tailwindcss.com`; GA4 route now reaches authenticated API status.

- 2026-05-22 23:25 EDT - Wired `wolf.discount/ai` into the shared BotBot token ledger.
  - Files: WOLF-FD BotBot backend routes/runtime plus `/home/alphahs/wolfbot-playground` server and workspace assets.
  - Commands/tests: backend build, wolfbot syntax checks, `npm test`, `pm2 restart pos-api`, `pm2 restart wolfbot-ai`, `/fd/api/health`, and authenticated `/ai/api/status`.

- 2026-05-15 12:25 EDT - Fixed Smart Calc tutorial mobile overlay placement and deployed Smart Calc artifacts.
  - Files: Smart Calc public HTML/wrappers, `package.json`, `AGENTS.md`.
  - Commands/tests: Smart Calc tutorial, margin, wheel tests, `npm test`, `npm run build`, live SHA/curl checks.

- 2026-05-14 19:21 EDT - Corrected Smart Calc version convention to Anthony's `1.<month>.<day>.<HHMM>` rule.
  - Files: `package.json`, Smart Calc public HTML/wrappers, `AGENTS.md`.
  - Commands/tests: version sync/build/test/deploy planned in that pass.

- 2026-05-12 16:19 EDT - Removed visible Smart Calc plan-cost text while preserving internal protection-cost math.
  - Files: Smart Calc public HTML/wrappers, Smart Calc smoke tests, `package.json`, `AGENTS.md`.
  - Commands/tests: HTML/script checks, margin and wheel tests, `npm run build`, live source/browser verification, `/fd/api/health`.

- 2026-05-12 15:49 EDT - Added Smart Calc protection plan type selector for merchandise/base/max elite vs power bases.
  - Files: Smart Calc public HTML/wrappers and smoke tests.
  - Commands/tests: parser/duplicate-id/script checks, margin and wheel tests, `npm run build`, browser verification.

- 2026-05-12 15:12 EDT - Updated Smart Calc protection plan cost tiers.
  - Files: Smart Calc public HTML/wrappers and margin smoke test.
  - Commands/tests: parser/duplicate-id/script checks, margin and wheel tests, `npm run build`, browser verification.

- 2026-05-12 15:00 EDT - Added BEDGEAR to Smart Calc base-cost vendor list with 20 percent freight.
  - Files: Smart Calc public HTML/wrappers, `package.json`, `AGENTS.md`.
  - Commands/tests: HTML/script checks, wheel test, `npm run build`, live browser verification.

- 2026-05-12 11:34 EDT - Completed remaining historical EZPro/WOLF-FD upload coverage backfill except the normal current-day gap.
  - Commands/tests: EZPro report runner for 231 historical dates, import coverage verification, `/fd/api/health`; no secrets/customer row details printed.

- 2026-05-09 18:45 EDT - Implemented CRM Opportunity Queue / UPS Option B contact tracking.
  - Files: CRM workspace/service/types/backend routes/bootstrap/tests plus Smart Calc wrappers/version files.
  - Commands/tests: frontend and backend tests/builds, schema verification, PM2 restart, live `/fd/`, `/fd/api/health`, deployed bundle grep, browser sign-in smoke.

## Archive Links

- Canonical handoff: `AGENTS.md`.
- BotBot historical context: summarized above; former `HANDOFF.md` now points here.
- `docs/agent-logs/2026-03.md`
- `docs/agent-logs/2026-04.md`
- `docs/agent-logs/2026-05.md`
- Older condensed history can also be recovered with `git log --follow -- AGENTS.md`.
