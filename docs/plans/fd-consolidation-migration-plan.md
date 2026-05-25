# Furniture Distributors Consolidation and Migration Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Consolidate Furniture Distributors dashboard, marketing pages, Manager Specials, data, and migration documentation into WOLF-FD so the stack can move to a new server with fewer loose production files.

**Architecture:** WOLF-FD becomes the canonical deploy/migration repo. Existing static FD pages are versioned under `public/furnituredistributors/`; the legacy Manager Specials upload script is archived under `scripts/manager-specials/` first, then replaced by a typed Express route and database-backed model. Server-specific secrets, database dumps, nginx configs, and PM2 process files stay out of Git but are documented as required migration artifacts.

**Tech Stack:** Vite + React + TypeScript frontend, Express + TypeScript backend, PostgreSQL, nginx, PM2/systemd, Python legacy Manager Specials importer during transition.

---

## Task 1: Keep migration inventory current

**Objective:** Make the repo tell future us exactly what must move.

**Files:**
- Modify: `docs/migration/fd-server-inventory-2026-05-24.md`
- Modify: `AGENTS.md`

**Steps:**
1. Re-run inventory before each migration attempt: Git status, PM2 list, listening ports, nginx FD references, and database row-count verification.
2. Update the inventory doc if paths, ports, or service names change.
3. Commit inventory-only changes separately.

**Verification:** Inventory doc matches current server output and contains no secret values.

## Task 2: Normalize FD static pages under WOLF-FD

**Objective:** Version the public Furniture Distributors static site so it can be deployed with the dashboard.

**Files:**
- Source: `/srv/www/wolf.discount/furnituredistributors/`
- Target: `public/furnituredistributors/`

**Steps:**
1. Copy static files into the repo with metadata preserved.
2. Search for stale URLs and secret-looking values.
3. Build frontend with `npm run build`.
4. Confirm copied pages exist in `dist/furnituredistributors/`.
5. Commit static sync separately.

**Verification:** `dist/furnituredistributors/index.html`, `living-room.html`, `bedroom.html`, `kitchen-dining.html`, and `recliners.html` exist after build.

## Task 3: Replace Manager Specials Python service with WOLF-FD backend route

**Objective:** Move Manager Specials upload into the POS API so the new server needs one backend app instead of a separate Python listener.

**Files:**
- Create: `pos-dashboard-backend/src/routes/managerSpecialsRoutes.ts`
- Modify: `pos-dashboard-backend/src/routeWiring.ts`
- Modify: `pos-dashboard-backend/src/startupBootstrap.ts`
- Modify: `pos-dashboard-backend/db/schema.sql`
- Create: `pos-dashboard-backend/src/routes/managerSpecialsRoutes.test.ts`

**Data model:**
- `manager_special_uploads`: upload metadata, uploader, original filename, status, generated page count, errors.
- `manager_special_items`: section, title, sku/model, brand, original price, special price, store/location, image path, sort order, availability/status.
- `manager_special_pages`: generated static HTML snapshot per section if we keep static page publishing.

**Steps:**
1. Port parser logic from `scripts/manager-specials/fd-manager-specials-upload.py` into TypeScript helpers.
2. Add tests for the four known section mappings: living room, bedroom, dinning/dining room, recliner.
3. Add authenticated owner/manager-only upload endpoint under `/api/manager-specials/upload`.
4. Store parsed items in Postgres.
5. Generate static HTML into a configured output directory or return JSON for a React-rendered page.
6. Add nginx compatibility redirect/proxy from old upload endpoint to the new route after deploy.

**Verification:** Backend tests pass, upload parser produces the same four section pages from a known fixture, and old public pages remain reachable.

## Task 4: Add Manager Specials dashboard module

**Objective:** Let approved users manage specials from `/fd/` instead of a hidden upload endpoint.

**Files:**
- Create: `components/ManagerSpecialsWorkspace.tsx`
- Create: `services/managerSpecialsApi.ts`
- Modify: `App.tsx`
- Modify: permission catalog if needed.

**Steps:**
1. Add a Manager Specials tab/workspace behind owner/manager access.
2. Show current upload status and generated public page links.
3. Support upload, preview, publish, and rollback to previous generated set.
4. Add a smoke test around the service API shape.

**Verification:** User can upload a fixture, preview parsed rows, publish, and open the public pages.

## Task 5: Move the database safely outside Git

**Objective:** Make moving `salesdb` repeatable and verifiable without putting private dumps in the repo.

**Files:**
- Use: `scripts/migration/verify-fd-database-counts.sh`
- Document private dump/restore commands in operator notes, not in committed secret files.

**Steps:**
1. Create a private `pg_dump -Fc` outside the repo on the old server.
2. Transfer the dump over SSH/SCP to a private path on the new server.
3. Restore with `pg_restore --clean --if-exists` on the new server.
4. Run row-count verification on old and new servers.

**Verification:** Row counts for customers, sales, sale items, catalog items, and uploads match old server.

## Task 6: Cutover rehearsal

**Objective:** Prove the new server can run the stack before DNS changes.

**Steps:**
1. Deploy to the new server using a temporary hostname or hosts-file override.
2. Restore database dump outside Git.
3. Recreate production env file from private values.
4. Start backend and static serving.
5. Run smoke checks:
   - `/fd/api/health`
   - sign-in page loads
   - CRM customer search route authenticates/works
   - Manager Specials pages load
   - Manager Specials upload route rejects unauthenticated users or succeeds for authorized test account
6. Only then change DNS/proxy routing.

**Verification:** Old and new server row counts match, public pages match expected markers, and rollback is a DNS/proxy reversal.
