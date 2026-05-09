# UPS Customer Tracking Expansion Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the WOLF-FD Opportunity Queue / UPS list useful for real customer tracking by showing and saving the customer name, what they are interested in, and the key notes/outcome fields directly on the UPS row instead of hiding them behind the customer profile area.

**Architecture:** Reuse the existing UPS queue/history data model first: `crm_ups_active_customers` and `crm_ups_history` already store `customer`, `customer_type`, `customer_details`, `city`, `wants_needs`, `did_purchase`, `purchase_amount`, and `objection_note`. Extend the start/edit UI and API payloads so staff can fill these fields at the time they add an up, keep the active queue row readable, and preserve the same details in daily UPS history/printouts. Only add new database columns if the business confirms phone/email must survive on the UPS row before a customer account is saved.

**Tech Stack:** React + TypeScript frontend (`components/CRMWorkspace.tsx`, `services/crmApi.ts`, `types.ts`), Express/TypeScript backend (`pos-dashboard-backend/src/routes/crmRoutesV2.ts`, `pos-dashboard-backend/src/startupBootstrap.ts` if schema changes are approved), PostgreSQL, Vite, Vitest.

---

## Current Findings

- Repo inspected on AlphaHS: `/home/alphahs/WOLF-FD`.
- Current branch/status at inspection: clean working tree.
- Current visible dashboard display version: `1.5.9.1454`.
- The UPS backend already has active/history fields for:
  - Customer name: `customer`
  - Customer type: `customer_type` (`Regular Up` / `B-Back`)
  - General note/details: `customer_details`
  - City: `city`
  - Interest / wants / needs: `wants_needs`
  - Purchase outcome: `did_purchase`, `purchase_amount`
  - Objection note: `objection_note`
- The current add-customer UI only captures one text field and customer type. It sends the same text as both `customer` and `customer_details`, so the row becomes redundant and does not capture enough structured info.
- The current working-customer card shows name and a short details line, but not a clear `Interested in` line or outcome fields.
- The existing “Quick Edit” area has useful fields, but it is tied to the selected customer/profile card and is not obvious enough as the main UPS tracking workflow.
- Phone/email exist on CRM customer accounts, but not on `crm_ups_active_customers` or `crm_ups_history`. If phone/email must display and persist on UPS rows before saving a CRM customer account, add those columns in a separate task.

## Recommended Field Set

### MVP fields to add/surface without a database migration

- `Customer Name` — required.
- `Interested In / Looking For` — maps to `wants_needs`; visible on the row.
- `Notes / Details` — maps to `customer_details`; visible as secondary text.
- `City` — optional; already persisted.
- `Customer Type` — `New Opportunity` or `B-Back`; already persisted.
- `Did Purchase?` — unknown / yes / no; already persisted.
- `Purchase Amount` — optional money amount; already persisted.
- `Objection / Reason No Sale` — optional; already persisted.

### Optional phase if confirmed by the business

- `Phone` and `Email` directly on UPS active/history rows.
  - Requires schema additions to `crm_ups_active_customers` and `crm_ups_history`.
  - Also requires mapper/type/API updates.
  - Without this, phone/email can still be saved through CRM customer account flow, but they will not survive as part of the UPS row itself.

---

## Acceptance Criteria

1. A salesperson/manager can add an active customer from the UPS row with separate fields for customer name and interest/wants-needs.
2. The collapsed working row shows enough context at a glance:
   - customer name
   - B-Back/New Opportunity badge
   - interested-in/wants-needs text
   - notes/details when present
3. Clicking the working customer opens an obvious “Up Details” editor that is always available for the selected active customer, even if no customer profile/history was found.
4. Saving the editor updates both `crm_ups_active_customers` and linked `crm_ups_history` so today’s printed UPS sheet and history retain the details.
5. Completing an up saves any unsaved fields before marking the customer complete.
6. Existing queue behavior remains intact: check-in, selected-store filtering, manager reorder, on-break, remove-up, and print today's UPS.
7. Dashboard visible version is bumped before deployment.
8. Tests/build pass, live route is verified, `AGENTS.md` is updated, and the finished implementation is committed.

---

### Task 1: Add a static regression guard for UPS tracking fields

**Objective:** Create a small test that fails until the UPS UI/API explicitly handles the expanded customer fields.

**Files:**
- Create: `scripts/crm-ups-customer-tracking-static-smoke.cjs`
- Modify: `package.json`

**Step 1: Write failing test**

Create `scripts/crm-ups-customer-tracking-static-smoke.cjs` that reads these files and asserts:

- `components/CRMWorkspace.tsx` contains visible labels/placeholders for `Customer Name`, `Interested In`, `Notes`, `City`, and `Objection`.
- `components/CRMWorkspace.tsx` sends `wantsNeeds`, `city`, and `objectionNote` when starting/saving/completing an up.
- `services/crmApi.ts` allows `startCrmUpsQueueCustomerInApi` to send `wants_needs` and `city`.
- `pos-dashboard-backend/src/routes/crmRoutesV2.ts` accepts `wants_needs`, `city`, and `objection_note` in the `/ups-queue/:id/start` path.

Add package script:

```json
"test:crm-ups-customer-tracking": "node scripts/crm-ups-customer-tracking-static-smoke.cjs"
```

**Step 2: Run test to verify failure**

Run:

```bash
npm run test:crm-ups-customer-tracking
```

Expected: FAIL because the current start form/API only handles one customer text field and customer type.

**Step 3: Commit only after implementation passes**

Do not commit this failing test by itself unless intentionally doing a RED commit. Prefer carrying it through the following tasks and committing when green.

---

### Task 2: Expand frontend start-draft state

**Objective:** Let the waiting-row add-customer form hold structured customer-tracking fields instead of one generic string.

**Files:**
- Modify: `components/CRMWorkspace.tsx`

**Step 1: Add a start-draft type**

Near the other local types, add:

```ts
type UpsStartDraft = {
  customer: string;
  customerType: UpsQueueCustomerType;
  wantsNeeds: string;
  customerDetails: string;
  city: string;
  objectionNote: string;
};

const emptyUpsStartDraft = (): UpsStartDraft => ({
  customer: "",
  customerType: "Regular Up",
  wantsNeeds: "",
  customerDetails: "",
  city: "",
  objectionNote: "",
});
```

**Step 2: Replace inline start-draft state shape**

Change:

```ts
const [startDrafts, setStartDrafts] = useState<Record<string, { customer: string; customerType: UpsQueueCustomerType }>>({});
```

to:

```ts
const [startDrafts, setStartDrafts] = useState<Record<string, UpsStartDraft>>({});
```

Use `emptyUpsStartDraft()` wherever the old `{ customer: "", customerType: "Regular Up" }` object was used.

**Step 3: Run TypeScript/build check**

Run:

```bash
npm run build
```

Expected: build may still fail until API payload changes are complete, but no stale object shape should remain after Task 4.

---

### Task 3: Extend start-customer API payloads

**Objective:** Allow the start customer endpoint to receive the same fields already supported by the edit endpoint.

**Files:**
- Modify: `services/crmApi.ts`
- Modify: `pos-dashboard-backend/src/routes/crmRoutesV2.ts`

**Step 1: Frontend API client**

Change `startCrmUpsQueueCustomerInApi` payload from:

```ts
payload: { customer: string; customerType: "Regular Up" | "B-Back"; details?: string }
```

to:

```ts
payload: {
  customer: string;
  customerType: "Regular Up" | "B-Back";
  details?: string;
  city?: string;
  wantsNeeds?: string;
  objectionNote?: string;
}
```

Send these as snake_case JSON:

```ts
body: JSON.stringify({
  customer: payload.customer,
  customer_type: payload.customerType,
  customer_details: payload.details || "",
  city: payload.city || "",
  wants_needs: payload.wantsNeeds || "",
  objection_note: payload.objectionNote || "",
})
```

**Step 2: Backend route parser**

In `app.post("/api/crm/ups-queue/:id/start", ...)`, add parsing after `customerDetails`:

```ts
const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
const wantsNeeds = typeof req.body?.wants_needs === "string" ? req.body.wants_needs.trim() : "";
const objectionNote = typeof req.body?.objection_note === "string" ? req.body.objection_note.trim() : "";
```

**Step 3: Backend inserts**

In the `crm_ups_history` insert, replace the hard-coded empty values for city/wants/objection with `$` parameters.

In the `crm_ups_active_customers` insert, replace the hard-coded empty values for city/wants/objection with `$` parameters.

Keep `did_purchase` and `purchase_amount` null on start unless the UI later adds outcome fields to the start form.

**Step 4: Build backend**

Run:

```bash
cd pos-dashboard-backend
npm run build
```

Expected: PASS.

---

### Task 4: Redesign the waiting-row Add Customer form

**Objective:** Give staff enough fields when they first start the up.

**Files:**
- Modify: `components/CRMWorkspace.tsx`

**Step 1: Replace single-line form**

For both waiting and working “Add Customer” areas, replace the current `grid gap-2 md:grid-cols-[1.8fr_150px_auto]` one-line form with a compact stacked card:

- First row:
  - `Customer Name` input — required.
  - Customer type select.
- Second row:
  - `Interested In / Looking For` input or textarea.
  - `City` input.
- Third row:
  - `Notes / Details` textarea.
  - optional `Objection / reason no sale` textarea if space allows.
- Footer:
  - `Add Customer` button.

**Step 2: Update state handlers**

Every `setStartDrafts` update should preserve the full draft object:

```ts
[item.id]: { ...startDraft, wantsNeeds: event.target.value }
```

**Step 3: Update `handleStartCustomer`**

Change the call to:

```ts
const row = await startCrmUpsQueueCustomerInApi(item.id, {
  customer: startDraft.customer.trim(),
  customerType: startDraft.customerType,
  details: startDraft.customerDetails.trim(),
  city: startDraft.city.trim(),
  wantsNeeds: startDraft.wantsNeeds.trim(),
  objectionNote: startDraft.objectionNote.trim(),
});
```

When putting the new active customer into `draft`, set:

```ts
visualDescription: latestActiveCustomer?.customerDetails || current.visualDescription,
city: latestActiveCustomer?.city || current.city,
wantsNeeds: latestActiveCustomer?.wantsNeeds || current.wantsNeeds,
objectionNote: latestActiveCustomer?.objectionNote || current.objectionNote,
```

Reset the row draft with `emptyUpsStartDraft()`.

**Step 4: Run frontend build**

Run:

```bash
npm run build
```

Expected: PASS.

---

### Task 5: Make the working row show useful customer context

**Objective:** The collapsed UPS row should show what the customer is interested in without requiring clicks.

**Files:**
- Modify: `components/CRMWorkspace.tsx`

**Step 1: Add display helper**

Add a helper such as:

```ts
const buildUpsCustomerSummary = (customer: CRMUpsQueueItem["activeCustomers"][number]) => {
  const lines = [
    customer.wantsNeeds ? `Interested in: ${customer.wantsNeeds}` : "",
    customer.customerDetails ? `Notes: ${customer.customerDetails}` : "",
    customer.city ? `City: ${customer.city}` : "",
  ].filter(Boolean);
  return lines;
};
```

**Step 2: Update collapsed row text**

For `item.status === "working"`, show the latest/selected active customer with:

- Name.
- Active customer count if more than one.
- `Interested in: ...` line if available.
- `Notes: ...` line if available.

Keep truncation reasonable on mobile; use two visible lines instead of one long concatenated string.

**Step 3: Update active customer cards**

Inside each active customer card, replace `No extra notes yet.` with structured lines:

- `Interested in: ...`
- `Notes: ...`
- `City: ...`
- `Outcome: Purchased / No sale / Not set`
- `Objection: ...` when present.

**Step 4: Run static smoke**

Run:

```bash
npm run test:crm-ups-customer-tracking
```

Expected: still may fail until quick editor/completion is updated, but UI label assertions should now pass.

---

### Task 6: Split “Customer Profile” from “Up Details” editing

**Objective:** Make editing the active up obvious and always available.

**Files:**
- Modify: `components/CRMWorkspace.tsx`

**Step 1: Move Quick Edit out of profile gating**

Currently the quick edit block is inside a conditional that depends on customer profile/history state. Move it to render whenever:

```ts
isSelected && item.status === "working" && draft.queueId === item.id && draft.activeCustomerId
```

Rename the block header from `Quick Edit` to `Up Details`.

**Step 2: Add/rename fields**

Show these fields in the editor:

- First name / last name or one `Customer Name` field. Prefer one field unless preserving existing customer account save needs split name.
- Phone/email can remain in this area for CRM customer saving, but mark them as “Save Customer Account” fields unless phone/email are added to UPS schema.
- `Interested In / Looking For` -> `draft.wantsNeeds`.
- `City` -> `draft.city`.
- `Notes / Details` -> `draft.visualDescription` and/or `draft.notes`; avoid duplicating details unless both are clearly labeled.
- `Did Purchase?` -> `draft.didPurchase` tri-state.
- `Purchase Amount` -> `draft.purchaseAmount`.
- `Objection / Reason No Sale` -> `draft.objectionNote`.

**Step 3: Button labels**

Use clear buttons:

- `Save Up Details` — updates active UPS/history even without phone/email.
- `Save Customer Account` or keep current combined `Save Customer` behavior, but explain with status text when phone/email are missing.

**Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

---

### Task 7: Save full up details before completion

**Objective:** Prevent lost notes when a rep completes the up without clicking save first.

**Files:**
- Modify: `components/CRMWorkspace.tsx`

**Step 1: Update completion payload**

In `handleCompleteCustomer`, expand payload from only `customer`/`details` to include:

```ts
const payload = {
  customer: customerName || undefined,
  details: queueDetails,
  city: draft.city.trim(),
  wantsNeeds: draft.wantsNeeds.trim(),
  didPurchase: draft.didPurchase ?? undefined,
  purchaseAmount: draft.purchaseAmount.trim() ? Number(draft.purchaseAmount) : null,
  objectionNote: draft.objectionNote.trim(),
};
```

Use the same `queueDetails` logic as `handleSaveCustomer`, or better extract a small helper so save and complete use identical details.

**Step 2: Validate purchase amount**

Before sending, if `draft.purchaseAmount` is non-empty and not a finite non-negative number, show an error and do not complete.

**Step 3: Run build and static smoke**

Run:

```bash
npm run test:crm-ups-customer-tracking
npm run build
```

Expected: PASS.

---

### Task 8: Optional phone/email persistence on UPS rows

**Objective:** Add phone/email directly to UPS active/history rows if the business confirms they must show on UPS list before saving a CRM customer account.

**Files:**
- Modify: `pos-dashboard-backend/src/startupBootstrap.ts`
- Modify: `pos-dashboard-backend/src/routes/crmRoutesV2.ts`
- Modify: `types.ts`
- Modify: `services/crmApi.ts`
- Modify: `components/CRMWorkspace.tsx`

**Step 1: Schema additions**

In `startupBootstrap.ts`, add:

```sql
ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS email TEXT;
```

Set defaults to `''` like the existing text fields.

**Step 2: Backend select/mappers**

Add `phone` and `email` to:

- `UPS_ACTIVE_CUSTOMER_JSON_SQL`
- `mapUpsQueueRow`
- UPS history select/map response
- start/patch/history sync SQL

**Step 3: Frontend types/API/UI**

Add `phone`/`email` to:

- `CRMUpsActiveCustomer`
- `CRMUpsHistoryEntry` if printed/reporting
- `ApiUpsActiveCustomerRow`
- `mapUpsActiveCustomer`
- `startCrmUpsQueueCustomerInApi`
- `updateCrmUpsQueueCustomerInApi`
- `CRMWorkspace` display/editor

**Step 4: Verification**

Run backend build and root build. Browser verify that a started up with phone/email still shows after refresh.

Only perform this task if confirmed; otherwise keep phone/email as CRM customer-account fields only.

---

### Task 9: Version, docs, deployment, and live verification

**Objective:** Finish according to WOLF-FD maintenance conventions.

**Files:**
- Modify: `package.json`
- Modify: `AGENTS.md`
- Possibly modify: deployment output under Vite `dist/` only through normal build/deploy flow

**Step 1: Bump visible version**

Bump `package.json` `displayVersion` to the next unique visible version before building.

**Step 2: Run verification commands**

Run from `/home/alphahs/WOLF-FD`:

```bash
npm run test:crm-ups-customer-tracking
npm test
npm run build
cd pos-dashboard-backend && npm run build && npm test
```

Expected: all pass. If backend tests are unrelatedly flaky, capture the exact failing test and do not hide it.

**Step 3: Deploy/restart using existing project guidance**

Use the current WOLF-FD deploy flow from `AGENTS.md` / existing scripts. If runtime backend code changed, restart the backend PM2 service and verify health through nginx after the restart.

**Step 4: Browser/live checks**

In the live dashboard:

1. Select a real store, not `ALL`.
2. Add/choose a salesperson in the Opportunity Queue.
3. Add a test active customer with:
   - Name: `Test UPS Customer`
   - Interested In: `Sectional and adjustable base`
   - City: `Havelock`
   - Notes: `Planning for weekend delivery`
4. Verify collapsed row shows customer name and interested-in line.
5. Click active customer and verify `Up Details` editor shows fields immediately.
6. Edit wants/needs and objection note, save, refresh page, verify values persisted.
7. Complete or remove the test up according to safe test-data handling.
8. Check browser console for errors.

**Step 5: Update AGENTS.md and commit**

Add a compact log entry with:

- Behavior change.
- Version.
- Files changed.
- Test commands.
- Live verification.
- Commit hash after commit.

Commit with a message like:

```bash
git add components/CRMWorkspace.tsx services/crmApi.ts types.ts pos-dashboard-backend/src/routes/crmRoutesV2.ts package.json AGENTS.md scripts/crm-ups-customer-tracking-static-smoke.cjs
git commit -m "Expand UPS customer tracking details"
```

If optional phone/email persistence is implemented, include `pos-dashboard-backend/src/startupBootstrap.ts` and any updated tests in the commit.

---

## Open Business Decisions Before Coding

1. Should phone/email be stored directly on the UPS row/history, or is it enough to save them only to the CRM customer account?
2. Should the visible label be `UPS`, `UP List`, or `Opportunity Queue` in the staff-facing UI? Current UI says `Opportunity Queue`, print button says `UPS`.
3. Should `Interested In` be a free-text field only, or should we add quick category buttons like `Living Room`, `Bedroom`, `Mattress`, `Dining`, `Outdoor`, `Financing`, `Delivery`?
4. Should `Did Purchase` and `Purchase Amount` be shown in the active-row editor, or only when completing/printing the daily UPS sheet?

## Recommended Default If No Further Direction

Implement Tasks 1-7 and 9 now; skip Task 8 until phone/email-on-UPS-row is explicitly confirmed. Use the label `Interested In / Looking For` for staff clarity and store it in existing `wants_needs` so the existing daily UPS printout benefits immediately.
