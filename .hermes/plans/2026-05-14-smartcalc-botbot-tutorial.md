# Plan: BotBot-style Tutorial for Smart Calc

Date: 2026-05-14
Project: `/home/alphahs/WOLF-FD`
Relevant branch observed: `botbot-tutorial-revive`
Relevant deployed tool: `/fd/tools/smart-pricing-calculator.html` and `/fd/smartcalc/`

## Goal

Add a BotBot-style guided tutorial to Smart Calc so a new FD employee can open the calculator and be walked through the full selling workflow: choosing a starting point, entering cost or tagged price, setting margin/retail, adding delivery/protection/tax/discounts, reviewing grand total, generating sales order notes, copying adjustment values, and printing the customer copy.

## Current Code Shape

- Existing dashboard tutorial lives in:
  - `components/botbot/BotBotTutorial.tsx`
  - `components/app/TutorialOverlay.tsx`
  - `App.tsx` `buildBotBotTutorialSteps(...)`
- It already supports:
  - `highlightId` / `data-tour-id` or element `id` targeting.
  - Spotlight overlay with current step and total steps.
  - Manual steps and state-based advancement.
  - Auto scroll to highlighted target.
  - Back / next / skip / retry / restart / help recovery actions.
  - Permission-filtered tutorial steps.
  - Completion storage through BotBot settings.
- Smart Calc itself is currently a standalone static HTML tool:
  - `public/tools/smart-pricing-calculator.html`
- The dashboard embeds Smart Calc in:
  - `components/SmartPricingCalculatorPage.tsx`
  - `components/ShopWorkspace.tsx`
- Because Smart Calc is an iframe/static page, it should have its own tutorial runtime instead of trying to directly mount the React `BotBotTutorial` component inside the iframe.

## Recommended Architecture

Build a lightweight Smart Calc tutorial module directly inside `public/tools/smart-pricing-calculator.html`, matching the BotBot tutorial behavior and visual style.

### Why this route

- Works on both URLs:
  - Embedded dashboard iframe.
  - Direct full-page calculator URL.
- Avoids React/iframe state coupling.
- Keeps the tutorial close to the elements it highlights.
- Can reuse the same targeting convention: `data-tour-id` first, fallback to `id`.
- Allows the parent dashboard to launch/reset it via `postMessage` later.

## User Experience

### Entry points

1. Auto-show the tutorial once for first-time Smart Calc users.
2. Add a visible **Start tutorial** / **Help me use this** button near the Smart Calc header.
3. Add parent toolbar support in `SmartPricingCalculatorPage.tsx` so the embedded version has a top-level **Start tutorial** button next to **Open full page**.
4. Let BotBot settings eventually reset this, but do not block the first version on settings integration.

### Completion / persistence

Use local storage keys scoped to Smart Calc and versioned so future major tutorial changes can re-run:

- `fd_smartcalc_tutorial_completed_v1`
- `fd_smartcalc_tutorial_skipped_v1`
- optional: `fd_smartcalc_tutorial_last_step_v1`

Behavior:

- First visit: show intro prompt or start tutorial.
- Complete: mark completed.
- Skip: mark skipped but keep Start tutorial available.
- Query flag `?tutorial=1`: force launch regardless of completed/skipped.
- Parent message `{ type: 'smartcalc:startTutorial' }`: force launch from iframe wrapper.

## Tutorial Content Outline

Use a practical sales-ticket story instead of only describing buttons. Example scenario: “customer is looking at a sofa set, you have vendor/base cost, and you need final ticket, delivery, protection, and notes.”

### Step list

1. **Welcome to Smart Calc**
   - Target: header / page title.
   - Message: explain this tool turns cost/tagged price into the final ticket with policy-safe notes.

2. **Choose your starting point**
   - Target: starting mode button group.
   - Explain Base Cost vs EZ Pro Cost Code vs Tagged Price.
   - Mention Base Cost is the normal purchase-order workflow; Tagged Price is for known selling price.

3. **Base Cost workflow**
   - Target: `base-cost-section` / `vendor-select` / `base-cost`.
   - Explain vendor freight and entering multiple costs with `+`, commas, or spaces.

4. **EZ Pro workflow**
   - Target: `btn-ez-code` and `cost-code`.
   - Explain the cipher and when to use the cost code path.
   - This can be a click-to-show step.

5. **Tagged Price workflow**
   - Target: `btn-tagged-price` and `manual-retail-price`.
   - Explain tagged price starts from known selling price, so margin is not shown because cost is unknown.

6. **Set margin or retail**
   - Target: `calculator-section`, especially `margin-percent` and `retail-price`.
   - Explain enter one side and Smart Calc solves the other.

7. **Read the result and margin warning**
   - Target: `result-section` / `margin-note`.
   - Explain color-coded margin result and manager awareness if low.

8. **Delivery choices**
   - Target: `addons-section`, `add-threshold-delivery`, `add-delivery`, `delivery-type`.
   - Explain threshold vs local delivery, local mileage, sleeper/motion minimum, power-base setup.

9. **Protection plan**
   - Target: `add-pro1st` / `pro1st-options-wrapper`.
   - Explain Pro1st retail tier, covered value, power-base plan, and documenting discounts.

10. **Removal and extra services**
    - Target: `add-removal` / `removal-wrapper`.
    - Explain base removal fee and additional item add-on.

11. **Tax and store location**
    - Target: `add-tax` / `store-location`.
    - Explain default Camp/Greenville 7% and when to switch to other stores.

12. **Discount reasons and adjustment field**
    - Target: discount fieldset around “Discount reason(s) for Adjustment”.
    - Explain every discount reason must be checked and documented; adjustment total must match notes.

13. **Grand total review**
    - Target: `grand-total-section` / `breakdown-display` / `grand-total-display`.
    - Explain final customer total and breakdown.

14. **Financing view**
    - Target: `financing-section` / `show-financing`.
    - Explain equal monthly payments and approval requirements over standard terms.

15. **Sales order notes helper**
    - Target: `sales-notes-section` / `sales-order-notes` / `copy-sales-notes`.
    - Explain copy notes into the ticket comments; edits are preserved.

16. **Copy adjustment amount**
    - Target: `adjustment-field-section` / `copy-adjustment-field`.
    - Explain plain number for POS adjustment field.

17. **Print customer copy / reset**
    - Target: `reset-btn` and `top-reset-btn`.
    - Explain print customer copy after review and reset between customers.

18. **Done: use Smart Calc on every quote**
    - Target: header / footer.
    - Encourage consistent use and remind that policy notes protect the salesperson and manager.

## Implementation Plan

### Phase 1 — Add tutorial target IDs and launch button

Files:

- `public/tools/smart-pricing-calculator.html`

Tasks:

1. Add `data-tour-id` markers to existing sections where the plain `id` is too small or not semantically ideal:
   - `smartcalc-header`
   - `smartcalc-entry-modes`
   - `smartcalc-base-cost`
   - `smartcalc-ez-code`
   - `smartcalc-tagged-price`
   - `smartcalc-price-solver`
   - `smartcalc-result`
   - `smartcalc-addons`
   - `smartcalc-delivery`
   - `smartcalc-pro1st`
   - `smartcalc-removal`
   - `smartcalc-tax`
   - `smartcalc-discounts`
   - `smartcalc-grand-total`
   - `smartcalc-financing`
   - `smartcalc-notes`
   - `smartcalc-adjustment`
   - `smartcalc-print-reset`
2. Add a header button:
   - `id="smartcalc-start-tutorial"`
   - Text: `Start tutorial`
3. Keep existing element IDs unchanged so existing Smart Calc scripts and tests do not break.

### Phase 2 — Build standalone tutorial runtime

File:

- `public/tools/smart-pricing-calculator.html`

Add a pure JS module near the existing script, ideally after `pricingToolLogic` helpers are defined but before final bootstrap, with this shape:

- `const SMARTCALC_TUTORIAL_STORAGE_KEY = 'fd_smartcalc_tutorial_completed_v1';`
- `const SMARTCALC_TUTORIAL_SKIPPED_KEY = 'fd_smartcalc_tutorial_skipped_v1';`
- `const smartCalcTutorialSteps = [...]`
- `function getSmartCalcTutorialTarget(step)`
- `function buildSmartCalcTutorialOverlay()`
- `function positionSmartCalcTutorialOverlay()`
- `function showSmartCalcTutorialStep(index)`
- `function nextSmartCalcTutorialStep()`
- `function previousSmartCalcTutorialStep()`
- `function skipSmartCalcTutorial()`
- `function completeSmartCalcTutorial()`
- `function startSmartCalcTutorial({ force = false } = {})`
- `function initializeSmartCalcTutorial()`

Required behavior:

- Highlight target using a fixed overlay + transparent spotlight or a ring around target.
- Scroll target into view before measuring.
- Recalculate on resize and scroll.
- Provide buttons: Back, Next, Skip, Done.
- Provide fallback if target is hidden:
  - If step has `prepare`, run it first.
  - If still missing/hidden, show recovery copy and allow skip.

### Phase 3 — Add prepare/actions for hidden sections

Some sections only appear after user input or button clicks. Add per-step `prepare` functions rather than requiring the employee to create fake quote data before the tutorial can explain the tool.

Examples:

- EZ Pro step: click `btn-ez-code` before showing `cost-code`.
- Tagged Price step: click `btn-tagged-price` before showing `manual-retail-price`.
- Margin/result/add-ons sections: set safe demo values or explain they appear after a real input.
- Pro1st/removal/discount/financing sections: either open the relevant checkbox temporarily or target the always-visible parent add-ons/discount area.

Important: do not permanently alter a live quote unexpectedly.

Recommended safe behavior:

- On tutorial start, detect whether the form is empty.
- If empty, offer **Use demo values**.
- If not empty, default to “explain only” mode and avoid changing inputs.
- If demo mode is accepted, set demo values and show a small badge: `Demo values — reset when finished`.

Suggested demo values:

- Vendor: `ASHLEY` or first available vendor.
- Base cost: `399 + 299`.
- Margin: `55`.
- Delivery: local delivery checked.
- Pro1st: checked with covered items `sofa and loveseat`.
- Discount example: manager approval or percentage-off only if demo mode is active.

### Phase 4 — Parent dashboard integration

Files:

- `components/SmartPricingCalculatorPage.tsx`

Tasks:

1. Add a `ref` to the iframe.
2. Add a toolbar button: `Start tutorial`.
3. On click, post a message to the iframe:
   - `iframeRef.current?.contentWindow?.postMessage({ type: 'smartcalc:startTutorial' }, window.location.origin);`
4. In Smart Calc HTML, listen for:
   - `message` event with `event.origin === window.location.origin`
   - payload type `smartcalc:startTutorial`
5. Optionally make **Open full page** link append `&tutorial=1` if user chooses tutorial from parent but iframe is blocked/unavailable.

### Phase 5 — Optional BotBot alignment

This can wait until the standalone Smart Calc tutorial works.

Files:

- `components/botbot/BotBotContext.tsx`
- `components/SmartPricingCalculatorPage.tsx`
- Possibly BotBot settings/admin files

Tasks:

1. Add BotBot suggested action when page context is Shop/Smart Calc:
   - “Start Smart Calc tutorial”
2. Let BotBot settings reset Smart Calc tutorial local storage.
3. Consider adding a small BotBot-styled avatar label to the Smart Calc tutorial card so employees understand it is part of the same training system.

## Testing Plan

Follow RED-GREEN-REFACTOR for the implementation.

### Automated tests / smoke scripts

Current package scripts observed:

- `npm run build`
- `npm test`
- `npm run test:smartcalc-margin-discounts`
- `npm run test:smartcalc-number-input-wheel`

Add one new smoke script:

- `scripts/smartcalc-tutorial-smoke.cjs`
- package script: `test:smartcalc-tutorial`

Suggested checks for `smartcalc-tutorial-smoke.cjs` using `jsdom`:

1. Loads `public/tools/smart-pricing-calculator.html` without throwing.
2. Finds every tutorial `targetId` or `data-tour-id` declared in `smartCalcTutorialSteps`.
3. Clicking `smartcalc-start-tutorial` creates the tutorial overlay.
4. Next/Back/Skip/Done controls update state and local storage.
5. `?tutorial=1` or direct `startSmartCalcTutorial({ force: true })` forces launch even if completed.
6. Dispatching `postMessage({ type: 'smartcalc:startTutorial' })` launches the tutorial.
7. Existing calculator globals and event listeners still initialize.

### Manual browser QA

Run locally/staging before deploy:

1. Open `/fd/tools/smart-pricing-calculator.html?tutorial=1`.
2. Verify tutorial starts, spotlights the right elements, and scrolls correctly.
3. Complete without entering demo data.
4. Reset local storage and run with demo values.
5. Open embedded Shop → Smart Calc and start tutorial from parent toolbar.
6. Verify mobile/narrow layout; overlay must not cover the highlighted field completely.
7. Verify direct full-page mode still works.
8. Verify calculator functions still work:
   - Base Cost path.
   - EZ Pro path.
   - Tagged Price path.
   - Delivery/Pro1st/tax/discounts.
   - Copy notes and copy adjustment.
   - Print customer copy.

## Acceptance Criteria

- Smart Calc has a visible tutorial launch button.
- First-time users get prompted or auto-started once.
- Tutorial works in both embedded iframe and direct page.
- Tutorial covers the core FD sales workflow from start to notes/print.
- Completing/skipping persists and does not nag every visit.
- Users can restart the tutorial at any time.
- Tutorial never destroys an in-progress quote without asking.
- Existing calculator behavior is unchanged.
- Existing build/tests pass.
- New Smart Calc tutorial smoke test passes.

## Risks / Pitfalls

- Smart Calc is a static HTML file; adding too much logic inline can make it harder to maintain. Keep the tutorial block clearly labeled and self-contained.
- Hidden sections are common. Use `prepare` functions carefully and avoid changing non-empty customer quotes unless the user chooses demo mode.
- Iframe communication must validate `event.origin` before launching.
- The direct calculator uses a version query string from the React wrapper; tutorial storage should be versioned manually, not tied to every patch version, or it will re-run too often.
- Do not remove or rename existing IDs; current calculator script depends on many exact IDs.

## Rollout Plan

1. Implement on a feature branch, not directly on production branch.
2. Run automated tests and browser QA locally/staging.
3. Deploy to staging or a non-public test path first if available.
4. Have Anthony or one FD user walk through the tutorial and point out confusing wording.
5. Tune copy and step order.
6. Deploy to production during a low-traffic window.
7. Watch for console errors and support feedback.

## Bite-sized Implementation Tasks

1. Add target markers and Start tutorial button to Smart Calc header.
2. Add tutorial data model and static step list.
3. Add overlay DOM/CSS and positioning logic.
4. Add navigation buttons and localStorage persistence.
5. Add hidden-section prepare logic and demo-mode guard.
6. Add `postMessage` listener in Smart Calc.
7. Add iframe ref and Start tutorial button in `SmartPricingCalculatorPage.tsx`.
8. Add `scripts/smartcalc-tutorial-smoke.cjs` and `npm run test:smartcalc-tutorial`.
9. Run full build/test/smoke suite.
10. Manual QA direct URL, iframe URL, mobile layout, and real calculator workflow.
