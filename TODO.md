# WOLF-FD Todo List

Last updated: 2026-03-29

---

## Completed (2026-03-29 Sprint)

### Objections Drawer — Full Rework ✅
- [x] Remove discount-offering language from all 14 rebuttals
- [x] Wire "Submit Objection" form to POST real task to `/api/tasks` assigned to "Support"
- [x] Create voting system — `objection_votes` DB table + API routes (`GET/POST/DELETE /api/objection-votes`)
- [x] Frontend voting UI in ObjectionsDrawer — show all rebuttals with thumbs-up + vote bar + percentage
- [x] **Redesign ObjectionsDrawer UX:**
  - [x] Remove "Tip of the Day" section
  - [x] Remove dropdown picker
  - [x] Show random **objection** (the label text) in the main display area — cycle with "Try Another"
  - [x] Show all 5 rebuttals for the current objection below it with vote buttons
  - [x] "Submit an Objection" becomes a button that reveals the textarea (not always visible)
  - [x] Submitted objections should create a special `task_type = 'objection_submission'` task

### Objections — Database-Backed List ✅
- [x] Add `tasks` table migrations: `task_type TEXT`, `task_meta JSONB`
- [x] Update `tasksRoutes.ts` GET/POST/PATCH to include `task_type` and `task_meta`
- [x] Update `Task` type in `types.ts` to add `taskType?` and `taskMeta?`
- [x] Update `tasksApi.ts` to pass/return `task_type` and `task_meta`
- [x] Create `custom_objections` DB table (`id, objection_id, label, rebuttals JSONB, sort_order, is_active, source, created_at`)
- [x] Add `customObjectionsRoutes.ts`: `GET/POST/PATCH/DELETE /api/custom-objections`
- [x] Register new routes in `routeWiring.ts`
- [x] Create `customObjectionsApi.ts` frontend service
- [x] ObjectionsDrawer loads custom objections from DB + merges with hardcoded list
- [x] When submitting from drawer, create task with `task_type: 'objection_submission'` and `task_meta: { submitted_text: "..." }`

### TaskManager — Special Objection Task Cards ✅
- [x] Detect `task_type === 'objection_submission'` in task card list (show special badge/label)
- [x] In task detail modal for objection tasks, show:
  - [x] Submitted text (read-only)
  - [x] Editable "Objection Label" field (pre-filled from submitted text)
  - [x] Up to 5 rebuttal input fields
  - [x] "Publish to Objections List" button → calls `POST /api/custom-objections` and marks task DONE

### Settings — Objections Management ✅
- [x] Add "Objections" section to Settings page
- [x] List all custom (DB) objections with edit/delete controls
- [x] Add ability to create new custom objections from Settings

### Sticky Tabs ✅
- [x] Module sub-navigation bars already sticky under main app header at `top-20` offset

---

## Version Tracking
- Current: `0.3.29.25`
- Bump `displayVersion` in `package.json` with each visible deploy

---

## Notes for Next Agent

**All main TODO items are complete!**

Key files created/modified:
- `components/crm/ObjectionsDrawer.tsx` — Redesigned UX with random objection cycle
- `components/TaskManager.tsx` — Special objection submission cards with publish form
- `components/settings/ObjectionsSettings.tsx` — New settings panel for managing custom objections
- `services/tasksApi.ts` — Added taskType/taskMeta support
- `services/customObjectionsApi.ts` — New service for custom objections CRUD
- `pos-dashboard-backend/db/schema.sql` — Added task_type, task_meta, custom_objections tables
- `pos-dashboard-backend/src/routes/tasksRoutes.ts` — Added task_type/task_meta handling
- `pos-dashboard-backend/src/routes/customObjectionsRoutes.ts` — New API for custom objections
- `pos-dashboard-backend/src/routeWiring.ts` — Registered new routes
- `types.ts` — Added taskType and taskMeta to Task interface

**Deploy commands:**
```bash
# Frontend
cd /home/alphahs/WOLF-FD && npm run build && sudo cp -r dist/. /srv/www/wolf.discount/fd/

# Backend
cd /home/alphahs/WOLF-FD/pos-dashboard-backend && npm run build && pm2 restart pos-api
```
