# WOLF-FD Agent Handoff

## Resume Checklist

- Current branch: `integration/wolf-fd-cleanup` for the cleanup merge; live source remains `/home/alphahs/WOLF-FD` until this branch is applied/deployed.
- Dirty/uncommitted files to inspect first: after the cleanup merge, expected source repos should end clean except local-only `.env*` files and private backups. Treat `.env.production` and backup/env files as sensitive; do not print secrets into chat or logs.
- Latest source version: `displayVersion` `1.5.24.2146` in `package.json`; deploy verification still required after the cleanup branch is applied.
- Last deploy status: frontend deployed on 2026-05-23 after hardening the Pulse Website analytics render path; Chrome signed-in QA opened the live Website module on asset `assets/index-CWzH_huq.js` with no Pulse render error.
- Live URLs and health checks: `https://furnituredistributors.wolf.discount/fd/`, `https://furnituredistributors.wolf.discount/fd/api/health`, and local nginx probe `curl -skS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health`.
- Active risks/gotchas: this cleanup merge combines Pulse GA4, Stripe/Shopify top-up, Den Recorder, Docker portability, and WOLFbot pricing work. Frontend API calls intentionally resolve through `/fd/api/api/...`; do not simplify that path without live proxy verification. Use local/LAN LLM routes only unless Anthony explicitly approves cloud inference.
- Next recommended task: run full frontend/backend validation on `integration/wolf-fd-cleanup`, then fast-forward/update the live repo and deploy from a clean tree.

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


## Repo Cleanliness Rule

- Canonical source for live FD work is `/home/alphahs/WOLF-FD` on `alphahs`; Windows copies are secondary and must sync through Git branches, not ad-hoc file edits.
- Start every work session with `git fetch --all --prune` and `git status --short --branch` on the repo being edited. If the tree is dirty, inventory it before touching code.
- Do not stack unrelated work in one dirty tree. Create a named branch for each feature/fix, commit coherent checkpoints, and push the branch before switching tasks.
- End every meaningful task with one of two states: clean working tree with branch pushed, or an explicit WIP branch/patch path recorded in this handoff. No mystery dirt. Gremlins breed in untracked files.
- Never commit `.env*`, secret backups, private vendor uploads, or generated deploy artifacts. Use `.env.example` for documented knobs and keep deployed `/srv/www/...` output generated from `dist/` only.
- Merge multi-source work through a temporary integration branch, run frontend/backend validation there, then update the live branch from that known-good merge. Do not merge directly inside the live dirty checkout.

## Active Work Queue

- Current active sprint: Tutorial fix, sidebar cleanup, module navigation polish, and recent GA4/Stripe/backend runtime work.
- Immediate review target: dirty backend files and untracked `ga4Routes.ts` / Stripe top-up routes before changing API behavior.
- Existing next-task thread: ObjectionsDrawer UX, typed task metadata, custom objections routes/service, objection submission task cards, settings management for custom objections, and sticky module tabs.
- BotBot historical handoff: older `HANDOFF.md` content has been folded into this canonical handoff system. BotBot Phase 1-3 work created backend schema/routes, frontend orb/chat/settings/admin panels, workspace context wiring, and a manual QA path through `BOTBOT_QA_TEST_PLAN.md`.
- Handoff rules: update `AGENTS.md` after meaningful work; include timestamp, files changed, what changed, commands/tests, deploy status, and remaining risk or next step. Any frontend deploy log must mention built asset/version and live verification. Any backend route/runtime log must mention backend build, PM2 restart, and `/fd/api/health`.

## Recent Running Log

- 2026-05-24 22:00 EDT - Boxed Furniture Distributors migration assets into WOLF-FD.
  - Files: `public/furnituredistributors/`, `scripts/manager-specials/`, `scripts/migration/`, `docs/migration/fd-server-inventory-2026-05-24.md`, `docs/plans/fd-consolidation-migration-plan.md`, `AGENTS.md`.
  - Changes: copied the live FD marketing/Manager Specials static output into the repo, archived the legacy Manager Specials Python upload service, added safe DB verification and post-move smoke-check scripts, and documented the FD server inventory plus consolidation plan.
  - Commands/tests: syntax checks PASS for migration shell scripts and legacy Manager Specials Python; secret-pattern scan found no matches; frontend `npm test` PASS (16 tests), backend `npm test -- --run` PASS (21 tests), frontend `npm run build` PASS with FD static pages present in `dist/furnituredistributors/`, backend `npm run build` PASS.
  - Deploy: not deployed; this is migration packaging only.
  - Remaining risk: Manager Specials still needs a real WOLF-FD Express route/module to remove the standalone Python `127.0.0.1:8000` service.

- 2026-05-24 21:46 EDT - Consolidated dirty WOLF-FD work into a cleanup integration branch.
  - Files: `AGENTS.md`, `package.json`, `package-lock.json`, Pulse GA4 frontend/backend files, Stripe/Shopify top-up routes, Den Recorder routes/workspace/service, Docker portability files, WOLFbot pricing page, and local planning docs.
  - Changes: merged GitHub `botbot-tutorial-revive`, `move/docker-portable`, local `feat/den-recorder-cleanup`, and uncommitted server/local work into `integration/wolf-fd-cleanup`; added the Repo Cleanliness Rule so future work starts clean, branches by task, and never leaves mystery dirt.
  - Commands/tests: branch merge and conflict-resolution checks run; full build/test/deploy still pending for this integration branch.
  - Deploy: not deployed yet; apply only after frontend/backend validation passes.
  - Remaining risk: integration branch intentionally combines several feature streams, so targeted route/UI review is required before live deploy.

- 2026-05-23 09:15 EDT - Fixed Pulse Website render-boundary crash after analytics deploy.
  - Files: `components/PulseWorkspace.tsx`, `AGENTS.md`.
  - Changes: guarded Website analytics reads through `current?.*` and reused safe default arrays for top pages, channels, devices, cities, referrers, and daily trend data so partial/mixed GA4 responses cannot throw `undefined.map`.
  - Commands/tests: frontend `npm run build` PASS; focused `npx tsc --noEmit | grep PulseWorkspace` returned no Pulse errors; deployed `dist/.` to `/srv/www/wolf.discount/fd/`; live `/fd/api/health` PASS; Chrome signed-in QA hard-refreshed the live app and opened Pulse > Website successfully.
  - Deploy: live frontend asset `assets/index-CWzH_huq.js`, CSS `assets/index-DgJcr-EG.css`; backend unchanged/restart not required for this fix.
  - Remaining risk: Chrome dev log still contains stale pre-refresh errors from old asset `assets/index-D5KdYcd9.js`; fresh page content is on `assets/index-CWzH_huq.js` with no visible Pulse error.

- 2026-05-23 07:43 EDT - Added hover explanations to Pulse Website analytics.
  - Files: `components/PulseWorkspace.tsx`, `AGENTS.md`.
  - Changes: added reusable hover tooltip descriptions for Website date range controls, metric cards, daily trend, top pages, traffic sources, devices, top cities, and source/medium sections.
  - Commands/tests: frontend `npm run build` PASS; focused `npx tsc --noEmit | grep PulseWorkspace` returned no Pulse errors; deployed `dist/.` to `/srv/www/wolf.discount/fd/`; public HTML probe confirmed live asset update and no Tailwind CDN.
  - Deploy: live frontend asset `assets/index-YEZvSGAC.js`, CSS `assets/index-DgJcr-EG.css`.
  - Remaining risk: authenticated browser QA is still needed to hover through the live Website tab inside a signed-in session.

- 2026-05-23 07:41 EDT - Expanded Pulse Website analytics with date ranges and comparison.
  - Files: `components/PulseWorkspace.tsx`, `pos-dashboard-backend/src/routes/ga4Routes.ts`, `AGENTS.md`.
  - Changes: Website tab now supports preset/custom ranges, previous-period or custom comparison, expanded GA4 metric cards, daily trend, top pages, traffic sources, devices, cities, and source/medium tables. GA4 backend endpoint now accepts `start`, `end`, `compareStart`, and `compareEnd` query params and returns richer current/compare data with range-keyed caching.
  - Commands/tests: backend `npm run build` PASS; frontend `npm run build` PASS; focused `npx tsc --noEmit | grep PulseWorkspace` returned no Pulse errors; `pm2 restart pos-api`; deployed `dist/.` to `/srv/www/wolf.discount/fd/`; live `/fd/api/health` PASS; ranged GA4 endpoint reached authenticated API guard (`401`) instead of missing route.
  - Deploy: live frontend asset `assets/index-DiF8vVPF.js`, CSS `assets/index-Br9nEsvz.css`; backend `pos-api` restarted.
  - Remaining risk: full root `tsc --noEmit` still has pre-existing unrelated project errors outside Pulse; authenticated browser QA is still needed inside an approved user session to verify real GA4 data rendering.

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
