# Smart Calc updates plan — 2026-05-28 15:04 EDT

## Goal

Update the Furniture Distributors Smart Calc with the requested sales-floor workflow changes:

1. Bring the visible version up to today's date.
2. Add Ashley Express Fee support.
3. Add Closeout / AS IS item handling.
4. Remove Equal Monthly Payments from the customer printout.
5. Move the Copy Notes button directly under the Notes field.
6. Add `Stearns & Foster` as a Vendor Advertisement vendor.
7. Add/suggest an expiration date on the printout.

Planning only. No implementation performed in this turn.

## Current context / assumptions

- Active repo/workspace: `C:\Users\antho\WOLF-FD-git`
- Main Smart Calc file: `C:\Users\antho\WOLF-FD-git\public\tools\smart-pricing-calculator.html`
- Current Smart Calc visible marker in the HTML header: `Smart Calc v1.5.24.2341`
- Current `package.json` values:
  - `version`: `0.5.24.2341`
  - `displayVersion`: `1.5.24.2341`
- Existing build hook: `npm run build` runs `npm run sync:smartcalc-version`, which syncs `package.json.displayVersion` into:
  - `public/tools/smart-pricing-calculator.html`
  - `public/smartcalc/index.html`
- Repo convention in `AGENTS.md`: for visible UI changes, bump only `package.json.displayVersion` using `1.<month>.<day>.<HHMM>` local military time.
- If executed immediately from this planning timestamp, the likely target display version would be `1.5.28.1504`; if execution happens later, use the actual execution time instead.

## Proposed approach

Keep this as a focused single-file Smart Calc UI/logic update plus version bump. Avoid touching backend/database code unless later requirements expand.

Default implementation posture:

- Use existing inline Smart Calc patterns instead of introducing a framework migration.
- Add new DOM elements near related controls.
- Wire new controls into the existing `allElements` object, event listeners, calculation helpers, notes builder, and print builder.
- Keep customer-facing printout clean and audit-friendly.
- Preserve internal notes/adjustment workflow separately from customer printout.

## Step-by-step plan

### 1. Version update

Files:

- `package.json`
- generated/synced by script:
  - `public/tools/smart-pricing-calculator.html`
  - `public/smartcalc/index.html`

Steps:

1. Set `package.json.displayVersion` to the execution timestamp using the repo rule: `1.5.28.HHMM` for today, May 28.
2. Leave `package.json.version` unchanged unless Anthony explicitly wants the package/internal version bumped too.
3. Run `npm run sync:smartcalc-version` during execution so Smart Calc header and iframe URL cache-bust update.
4. Confirm the Smart Calc header shows the new `Smart Calc v...` value.

Open question:

- Do we also bump `package.json.version` from `0.5.24.2341` to `0.5.28.HHMM`, or follow `AGENTS.md` and bump only `displayVersion`? Default: bump only `displayVersion`.

### 2. Add Ashley Express Fee

Likely file:

- `public/tools/smart-pricing-calculator.html`

Existing relevant areas:

- Delivery/add-ons UI around delivery fee controls.
- `allElements` object around delivery and add-on DOM refs.
- `updateAddonCosts()` and `updateGrandTotal()`.
- `printCustomerCopy()` delivery fee row builder.

Proposed implementation:

1. Add a checkbox under the delivery/add-ons area: `Ashley Express Fee`.
2. Add an amount input next to/under it unless Anthony confirms this is a fixed amount.
   - Safer default: make it editable, because the fee amount was not specified.
   - If Anthony provides the fixed fee, hardcode that amount and display it like the existing delivery/assembly fee labels.
3. Add DOM references:
   - `addAshleyExpressCheckbox`
   - `ashleyExpressWrapper`
   - `ashleyExpressAmountInput`
4. Add a helper such as `getAshleyExpressFee()`.
5. Include the fee in:
   - on-screen grand total breakdown
   - customer printout delivery/add-on section
6. If Ashley Express is selected, print row label should be explicit: `Ashley Express Fee`.

Open question:

- What is the Ashley Express Fee amount? If not fixed, implementation should use a user-entered amount field.

### 3. Add Closeout / AS IS item handling

Likely file:

- `public/tools/smart-pricing-calculator.html`

Existing relevant areas:

- Discount reason fieldset starts around the `Discount reason(s) for Adjustment` section.
- `getDiscountReasonEntries()` builds audit entries.
- `getDiscountReasonDetails()` formats notes.
- `buildSalesOrderNotes()` writes Sales Order notes.
- `printCustomerCopy()` can add order details/fine print.

Proposed implementation:

1. Add a new checkbox/control group: `Closeout / AS IS`.
2. Add supporting fields:
   - item/details text field, e.g. `Item(s) / reason`
   - optional discount amount if this is intended to be an adjustment reason
3. Decide behavior based on Anthony's intent:
   - If Closeout / AS IS is a discount reason: include it in `getDiscountReasonEntries()` and subtract its amount like other subtotal discounts.
   - If Closeout / AS IS is only a condition/disclaimer: do not subtract money; add the note only.
4. Add generated Sales Order note text, likely:
   - `Closeout / AS IS: [item/details]. Customer acknowledges item is sold as-is; no returns/exchanges except as stated by store policy.`
5. Add customer printout wording only if appropriate. Customer-facing copy should be short and non-legalistic unless Anthony provides exact policy language.

Open questions:

- Should Closeout / AS IS create a discount amount/adjustment, or is it only a condition note?
- Exact customer-facing AS IS wording/policy should be confirmed if this is legally sensitive. Hardware rule: do not invent policy language out of foam and hope.

### 4. Remove Equal Monthly Payments from printout

Likely file:

- `public/tools/smart-pricing-calculator.html`

Existing relevant area:

- `printCustomerCopy()` currently builds `financingHtml` when `show-financing` is checked, then injects it with `${financingHtml}`.

Proposed implementation:

1. Keep the on-screen `Equal Monthly Payments` calculator available in the Smart Calc UI.
2. Remove customer printout inclusion only:
   - either delete/disable `financingHtml`, or force it to `''`
   - remove `${financingHtml}` from the print template
3. Verify that checking Equal Monthly Payments still updates the on-screen UI but the printed customer copy contains no `Payment Options`, no term table, and no monthly payment amounts.

### 5. Move Copy Notes to directly under Notes

Likely file:

- `public/tools/smart-pricing-calculator.html`

Existing relevant area:

- Sales notes section around lines containing:
  - `textarea id="sales-order-notes"`
  - `button id="copy-sales-notes"`
  - `span id="copy-notes-status"`
  - adjustment field block currently sits between the textarea and copy button.

Proposed implementation:

1. Move the `Copy Notes` button row so it appears immediately after:
   - `textarea id="sales-order-notes"`
   - the helper paragraph about manual edits
2. Keep the copy status beside or under the button.
3. Move the `Adjustment Field Amount` block below the Copy Notes row.
4. Do not change `copySalesOrderNotes()` logic unless DOM structure requires it. Same IDs should keep behavior intact.

### 6. Add Vendor: Stearns & Foster for Advertising

Likely file:

- `public/tools/smart-pricing-calculator.html`

Existing relevant area:

- `vendor-ad-select` currently has:
  - `Nectar`
  - `Tempurpedic`

Proposed implementation:

1. Add option:
   - `<option value="Stearns & Foster">Stearns & Foster</option>`
2. Verify selected vendor appears in:
   - Sales Order note: `Vendor Discount: Stearns & Foster ...`
   - print discount row detail under `Vendor Advertisement`

Possible polish:

- Consider spelling `Tempur-Pedic` consistently later, but do not include that in this requested change unless Anthony asks. Scope creep is a tiny gremlin with invoices.

### 7. Add/suggest expiration date on printout

Likely file:

- `public/tools/smart-pricing-calculator.html`

Existing relevant area:

- `printCustomerCopy()` already computes `today` and prints `Prepared <date>`.
- Print fine print currently says final availability/scheduling/financing approval are confirmed at checkout.

Proposed implementation options:

Option A — safer/default if no fixed policy exists:

1. Add an optional date input near discount/advertising controls or near the Print Customer Copy button:
   - label: `Print Expiration Date`
   - default blank
2. If filled, print:
   - `Quote / advertised pricing valid through <date>.`
3. If blank, print no expiration line.

Option B — suggested default date:

1. Add the same date input.
2. Auto-fill with a suggested date, e.g. 7 days from today, but allow override.
3. Print the chosen date.

Option C — print-only automatic suggestion:

1. Do not add UI.
2. In printout, automatically compute a date like today + N days.
3. Risk: N is a policy assumption unless Anthony confirms it.

Recommended default:

- Option A unless Anthony tells us the expiration window.

Open question:

- What should the suggested expiration window be? Same day, 7 days, 14 days, sale-event end date, or manually selected only?

## Files likely to change during execution

Primary:

- `C:\Users\antho\WOLF-FD-git\public\tools\smart-pricing-calculator.html`
- `C:\Users\antho\WOLF-FD-git\package.json`

Likely generated/synced during build/version sync:

- `C:\Users\antho\WOLF-FD-git\public\smartcalc\index.html`

Possible if adding or updating smoke coverage:

- `C:\Users\antho\WOLF-FD-git\scripts\smartcalc-margin-discount-smoke.cjs`
- or a new focused smoke file, e.g. `scripts\smartcalc-print-output-smoke.cjs`
- `package.json` scripts section if a new smoke command is added

Operational/logging if this becomes a completed repo task:

- `C:\Users\antho\WOLF-FD-git\AGENTS.md` running log entry

Deployment artifact if Anthony wants live deployment:

- `C:\Users\antho\WOLF-FD-git\dist\...` generated by `npm run build`
- live copy under `/srv/www/wolf.discount/fd/` only after explicit deployment step

## Tests / validation

Read-only planning did not run tests. Execution should validate with:

1. Static checks:
   - `git diff --check`
   - parse/sanity check the HTML for duplicate IDs if an existing script/test is available, or run a small Node/JS DOM scan.
2. Smart Calc focused tests already available:
   - `npm run test:smartcalc-margin-discounts`
   - `npm run test:smartcalc-number-input-wheel`
   - `npm run test:smartcalc-tutorial`
3. Build:
   - `npm run build`
4. Manual browser checks:
   - Open `public/tools/smart-pricing-calculator.html` locally or via Vite.
   - Confirm new version marker is visible.
   - Confirm Ashley Express Fee affects total and printout correctly.
   - Confirm Closeout / AS IS note/discount behavior matches chosen policy.
   - Confirm Equal Monthly Payments still works on screen but does not print.
   - Confirm Copy Notes button is directly under the notes textarea and still copies.
   - Confirm `Stearns & Foster` appears in Vendor Advertisement dropdown and flows to notes/print.
   - Confirm printout shows expiration date only per chosen rule.
5. If deploying live:
   - deploy from `dist`, not hand-edit `/srv/www/...`
   - verify live `/fd/tools/smart-pricing-calculator.html` returns 200
   - verify live HTML contains the new version string
   - hard refresh browser due to iframe/cache-bust behavior

## Risks / tradeoffs

- Ashley Express Fee amount is unknown. Hardcoding a guessed amount would be bad accounting dressed as confidence. Use an editable field unless Anthony gives the fee.
- Closeout / AS IS may have legal/customer-policy implications. Exact wording should be supplied or approved before customer-facing print text goes live.
- Expiration date policy is unknown. A manually selected expiration date is safer than assuming a 7-day or 14-day quote window.
- Smart Calc is a large single HTML file. Small targeted edits are safer than refactoring structure during this change.
- Print window behavior is browser-sensitive. Must test pop-up/print preview path after removing financing output.

## Open questions for Anthony before execution

1. Ashley Express Fee: fixed dollar amount, percentage, or manually entered amount?
2. Closeout / AS IS: should this subtract a discount amount, or only add a condition/disclaimer note?
3. Expiration date: should it be blank/manual, default to a suggested number of days, or use a specific sale/event date?
4. Version: follow repo rule and bump only `displayVersion`, or also bump `package.json.version`?
5. After local validation, should this be deployed live to `furnituredistributors.wolf.discount/fd/`?

## First execution batch

When Anthony says `execute the plan`, do this first:

1. Confirm/resolve the three policy values:
   - Ashley Express Fee amount behavior
   - Closeout / AS IS discount-vs-note behavior
   - expiration-date default behavior
2. Edit `public/tools/smart-pricing-calculator.html` with the UI/control changes.
3. Bump `package.json.displayVersion` to `1.5.28.HHMM` using the actual execution time.
4. Run version sync/build/tests.
5. Report exact files changed, validation results, and whether deployment is still pending or completed.
