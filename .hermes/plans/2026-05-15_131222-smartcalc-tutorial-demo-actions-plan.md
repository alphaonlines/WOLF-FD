# Smart Calc Tutorial Demo Actions Implementation Plan

> **For Hermes:** Use test-driven-development skill first. This plan is planning-only; do not implement until Anthony approves.

**Goal:** Polish the Smart Calc guided tutorial so pressing **Next** demonstrates the current step by intentionally filling/clicking example controls, then advances and scrolls the next highlighted area into view; also move the tutorial card into a right-side tall callout on desktop so the center workspace stays visible.

**Architecture:** Keep this inside the existing standalone Smart Calc HTML/tutorial system. Add declarative demo-action metadata to `smartCalcTutorialSteps`, route every advancing control through one `advanceGuidedTutorial()` function, make demo actions deterministic by overwriting the tutorial walkthrough fields with known example data, and lock page interaction during the tour so the only user controls are tutorial navigation. Rework tutorial card positioning into a right rail on desktop with mobile/tablet fallbacks.

**Tech Stack:** Static HTML/CSS/vanilla JS in `public/tools/smart-pricing-calculator.html`; smoke coverage through `scripts/smartcalc-tutorial-smoke.cjs`; version sync/build through npm/Vite.

---

## Confirmed Current Context

- Repo: `C:/Users/antho/WOLF-FD-git`
- Branch: `botbot-tutorial-revive`
- Current deployed/pushed commit: `b1b896e30f6e`
- Current app version: `package.json` `0.5.15.1255`, display version `1.5.15.1255`
- Existing tutorial source: `public/tools/smart-pricing-calculator.html`
  - Tutorial step list: roughly lines `1196-1269`
  - Tutorial wiring: roughly lines `1301-1319`
  - `showNextTutorialStep()`: roughly lines `1369-1376`
  - `renderGuidedTutorialStep()`: roughly lines `1408-1438`
  - Card positioning: roughly lines `1445-1508`
  - Spotlight/highlight/scroll: roughly lines `1571-1701`
  - Pricing input listeners: roughly lines `1703+`
- Existing tutorial smoke test: `scripts/smartcalc-tutorial-smoke.cjs`
  - jsdom viewport currently mocks mobile `375x667`
  - existing assertions already protect against target/card overlap; update the old no-overwrite assertion so tutorial **Next** intentionally overwrites demo fields while tutorial startup itself can remain non-mutating
- Existing React wrapper: `components/SmartPricingCalculatorPage.tsx`
  - only sends `FD_SMART_CALC_START_TUTORIAL` into the iframe
  - probably does not need behavior changes for this polish pass
- Existing uncommitted/untracked repo files that should stay unrelated unless Anthony explicitly says otherwise:
  - `M @agents.md`
  - `?? .hermes/plans/2026-05-15_124119-smartcalc-interactive-tour-highlight-plan.md`
  - `?? AGENT_PROJECT_GAME_PLAN.md`

## Product Behavior Target

### New tutorial behavior

When the user presses **Next** while on a step:

1. BotBot performs a deterministic example action for that current step, if one exists.
2. The calculator updates normally through real events (`input`, `change`, or `.click()`), not hidden state mutation.
3. The tutorial advances to the next step.
4. The next target scrolls into view and gets the spotlight.
5. The callout card stays off the center workspace when possible.
6. While the tutorial is open, page controls underneath the overlay are locked out: the user should only be able to use **Next**, **Back**, or **Skip tutorial**.

### Tutorial overwrite and interaction-lock rule

Anthony clarified that during the tutorial BotBot **should overwrite** the walkthrough fields. The point is a clean, guaranteed demo path that gets through the tutorial without a user having to manually type or click calculator controls.

Required behavior:

- Demo actions may overwrite existing values once the tutorial is running.
- Demo actions should use fixed example data so every run is predictable.
- The user should not be able to click calculator inputs, checkboxes, selects, copy buttons, print/reset buttons, or the highlighted target while the tutorial is active.
- The only interactive controls exposed during the tour should be **Next**, **Back**, and **Skip tutorial**.
- On the final step, reuse the **Next** button as the completion control if practical; avoid a separate clickable **Done** button so the interaction model stays exactly Next/Back/Skip.
- Do not auto-click browser/permission side-effect buttons such as copy-to-clipboard or print. BotBot can still fill the quote state and highlight those controls as examples, but final copy/print remains after the tutorial exits.

This changes the previous “protect an in-progress quote” idea. New rule: tutorial mode is a controlled demo sandbox over the live form. If someone starts it mid-quote, BotBot is allowed to turn that form into the training example. Blunt but coherent.

## Proposed Step Demo Actions

Add a `demoAction` or similar key to selected items in `smartCalcTutorialSteps`.

Recommended demo action map:

1. **Welcome to Smart Calc**
   - No data action.
   - Only **Next** advances. The spotlight/highlight is visual only because Anthony wants the user limited to Next, Back, and Skip tutorial.

2. **Choose your starting point**
   - BotBot programmatically clicks/selects **Base Cost** mode through `btn-base-cost.click()`.
   - This demonstrates the tab while the user remains locked to tutorial navigation.

3. **Enter vendor and base cost**
   - Overwrite with:
     - vendor: `ASHLEY`
     - base cost: `399 + 299, 179`
   - Dispatch `change` on vendor and `input` on base cost.
   - Expected result: `#calculator-section` becomes visible and `#total-cost` populates.

4. **Set the selling goal**
   - Overwrite with:
     - margin: `55`
   - Dispatch `input` on `#margin-percent`.
   - Expected result: result/add-on sections wake up.

5. **Add delivery and services**
   - Programmatically set a simple service example, preferably `#add-delivery`, to checked.
   - Optionally leave delivery type default.
   - Do not stack too many services; one visible example is enough.

6. **Add Pro1st protection**
   - Programmatically set `#add-pro1st` to checked.
   - Overwrite with:
     - covered items: `sofa and loveseat`
     - covered value: `899`
   - Dispatch input/change events.

7. **Document discounts**
   - Demonstrate one audit trail entry with a small fixed fake discount:
     - Check `#discount-manager-approval` or `#discount-other`.
     - Fill manager/reason and a small amount like `25`.
   - Dispatch change/input events so adjustment/notes update.

8. **Confirm tax and financing**
   - Keep tax default.
   - Programmatically set `#show-financing` to checked, because it is display-only and reversible.

9. **Copy sales order notes**
   - Do not auto-click `#copy-sales-notes` because that writes to clipboard and can trip browser permission behavior.
   - Only scroll/highlight; copy remains a human action after the tutorial exits.

10. **Print the customer copy**
    - Do not auto-click print/reset/customer-copy buttons.
    - Only scroll/highlight; printing remains a human action after the tutorial exits.

11. **You are ready to quote**
    - No demo action.
    - Final **Next** should mark the tutorial completed. If the implementation keeps the existing `#smartcalc-tour-done` element, it should be hidden from the interaction model or treated as the same final Next action, not an extra clickable control.

## Implementation Tasks

### Task 1: Write failing smoke assertions for deterministic demo actions and click lockout

**Objective:** Prove the requested Next-button example behavior exists before editing production code.

**Files:**
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Steps:**
1. Add a scroll spy:
   - Replace the current no-op `window.HTMLElement.prototype.scrollIntoView = () => {};`
   - Record target id/tag and options in an array.
2. Add helpers:
   - `clickNextAndSettle()`
   - `assertScrolledTo(idOrTag)`
   - `assertTutorialOverwritesDemoFields()`
   - `assertOnlyTutorialNavIsClickable()`
3. Adjust the old “must not overwrite in-progress quote” assertion:
   - Starting the tutorial can still avoid mutation before the first navigation click.
   - Pressing **Next** on demoable steps should overwrite fields with the tutorial example data.
4. Add a fresh blank-form tutorial run that verifies:
   - leaving “Choose your starting point” keeps/selects Base Cost mode
   - leaving “Enter vendor and base cost” fills vendor/base cost and reveals calculator section
   - leaving “Set the selling goal” fills margin and reveals result/add-ons
   - leaving “Add delivery and services” checks a delivery/service example
   - leaving “Add Pro1st protection” checks Pro1st and reveals options
   - discount/financing actions happen with fixed example data when those steps advance
5. Add a pre-filled form run that proves tutorial **Next** overwrites existing user-entered values with the demo values.
6. Assert page controls under the overlay do not respond to user clicks while the tutorial is open. At minimum test one input/checkbox target, one highlighted spotlight/target click, and one destructive-ish button such as reset/print remains blocked.
7. Assert each step scrolls its next target into view before/while spotlighting.
8. Run:

```bash
npm run test:smartcalc-tutorial
```

Expected RED: fails because current `showNextTutorialStep()` only advances; it does not run step demo actions, block underlying clicks, or enforce the requested right-rail desktop layout.

### Task 2: Centralize tutorial advancement

**Objective:** Make all advancing paths run the same logic.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Steps:**
1. Add `advanceGuidedTutorial()`.
2. Make `showNextTutorialStep()` call `advanceGuidedTutorial()` or rename it carefully while preserving event listener names.
3. Disable spotlight-target advancement. `handleTutorialSpotlightClick()` should not advance the tour; the spotlight/highlight is visual only.
4. Keep Back behavior unchanged: Back should not undo/redo demo actions.

Pseudo-shape:

```js
function showNextTutorialStep() {
  advanceGuidedTutorial();
}

function advanceGuidedTutorial() {
  const step = smartCalcTutorialSteps[currentTutorialStepIndex];
  applyTutorialDemoAction(step);
  if (currentTutorialStepIndex >= smartCalcTutorialSteps.length - 1) {
    closeGuidedTutorial(true);
    return;
  }
  currentTutorialStepIndex += 1;
  renderGuidedTutorialStep({ scrollTarget: true });
}
```

Also remove or ignore `clickTargetToAdvance` from the active behavior so the first step cannot advance by clicking the highlighted page area.

### Task 3: Add deterministic demo-action helpers

**Objective:** Auto-fill/click examples by intentionally overwriting the tutorial walkthrough fields with known values.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Steps:**
1. Add helpers near tutorial functions:

```js
function setTutorialDemoValue(element, value, eventName = 'input') { ... }
function selectTutorialDemoValue(element, value) { ... }
function setTutorialCheckbox(element, checked = true) { ... }
function dispatchTutorialEvent(element, eventName) { ... }
```

2. These helpers should overwrite every time they run and then dispatch real DOM events. Do not gate on blank fields.

3. Optional: mark demo-written fields with a data attribute for debugging/test visibility, not for overwrite permission:

```js
element.dataset.smartcalcTourDemoValue = value;
```

4. Use real DOM events so existing calculator logic runs.
5. Keep side-effect browser buttons out of demo actions: no programmatic copy-to-clipboard, print dialog, reset, or external navigation.

### Task 4: Add declarative demo actions to tutorial steps

**Objective:** Bind each tutorial step to its example behavior.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Steps:**
1. Add `demoAction` values to steps in `smartCalcTutorialSteps`.
2. Add `applyTutorialDemoAction(step)` with a `switch` on `step.demoAction`.
3. Use the existing calculator functions indirectly through real events.
4. Keep copy/print/reset actions excluded from programmatic demo actions.
5. Keep highlighted targets visual-only. Demo actions are executed by BotBot from **Next**, not by letting the user click underlying controls.

Suggested step metadata:

```js
{ title: 'Choose your starting point', ..., demoAction: 'choose-base-cost' }
{ title: 'Enter vendor and base cost', ..., demoAction: 'fill-base-cost-example' }
{ title: 'Set the selling goal', ..., demoAction: 'fill-margin-example' }
{ title: 'Add delivery and services', ..., demoAction: 'toggle-delivery-example' }
{ title: 'Add Pro1st protection', ..., demoAction: 'toggle-pro1st-example' }
{ title: 'Document discounts', ..., demoAction: 'fill-discount-example' }
{ title: 'Confirm tax and financing', ..., demoAction: 'toggle-financing-example' }
```

### Task 5: Make scrolling deterministic before spotlight/card positioning

**Objective:** Ensure each new step visibly moves to the thing BotBot is explaining.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Steps:**
1. Extract scroll logic from `highlightTutorialTarget()` into a dedicated helper:

```js
function scrollTutorialTargetIntoView(target) { ... }
```

2. Use `block: 'center', inline: 'nearest'`.
3. Use `behavior: 'smooth'` normally and `behavior: 'auto'` when `prefers-reduced-motion` is active or tests need deterministic behavior.
4. Render after scroll using `requestAnimationFrame`, possibly two frames if needed:

```js
scrollTutorialTargetIntoView(target);
window.requestAnimationFrame(() => {
  positionGuidedTutorialCard(currentTutorialTarget);
  renderTutorialSpotlight(currentTutorialTarget, smartCalcTutorialSteps[currentTutorialStepIndex]);
});
```

5. Keep `smartcalc-tour-no-scroll` from blocking programmatic scroll. If needed, add the no-scroll class after the scroll request rather than before.

### Task 6: Rework the tutorial card into a desktop right rail

**Objective:** Move the instruction box out of the center workspace on desktop.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Steps:**
1. Add desktop-specific card dimensions:
   - width around `340-380px`
   - height/max-height close to `calc(100dvh - 2rem)`
   - top/right margin around `1rem` to `1.5rem`
2. Update `getTutorialCardSize()` and `positionGuidedTutorialCard()` so on desktop the default is:

```text
right rail: right side, tall, vertically stable
```

3. Keep fallbacks:
   - if the right rail would cover the current target/spotlight, move left or use existing above/below placement
   - on mobile, keep the current centered/stacked card behavior
4. Add a smoke assertion with a desktop viewport, such as `1280x800`, proving:
   - card is right-docked
   - card does not overlap the highlighted center target
   - spotlight remains around the target

### Task 7: Preserve existing tutorial/accessibility behavior

**Objective:** Avoid regressions from the previous polish pass.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Checks to preserve / update:**
- Skip closes without marking completed.
- Final **Next** saves completion; separate Done should not be an extra visible/clickable tutorial control.
- Wrong-origin `postMessage` is ignored.
- Allowed-origin `postMessage` starts tutorial.
- Spotlight/dim panels/pointer still render.
- Highlighted spotlight/targets are visual-only and do not advance or mutate the tutorial when clicked by the user.
- Tutorial demo actions intentionally overwrite the walkthrough fields when **Next** is pressed.
- Underlying calculator controls are blocked while the overlay is active.

### Task 8: Bump and sync version

**Objective:** Match Anthony’s versioning convention on this software touch.

**Files:**
- Modify: `package.json`
- Generated/synced by script:
  - `public/tools/smart-pricing-calculator.html`
  - `public/smartcalc/index.html`

**Steps:**
1. At implementation time, generate a fresh date-time version, e.g. `0.5.15.HHMM` / display `1.5.15.HHMM`.
2. Update `package.json`.
3. Run:

```bash
npm run sync:smartcalc-version
```

Do not hardcode `1312` from this plan unless implementation happens immediately at that exact minute. Version drift is a tiny bent pin; it still breaks the socket.

### Task 9: Run validation gates

**Objective:** Prove the polish is safe.

Run, in order:

```bash
git diff --check
npm run test:smartcalc-tutorial
npm run test:smartcalc-margin-discounts
npm run test:smartcalc-number-input-wheel
npm test
npm run build
```

Expected:
- All commands pass.
- Existing warnings may remain, but no new failures.
- `dist/smartcalc/index.html` and `dist/tools/smart-pricing-calculator.html` contain the new version.

### Task 10: Commit, push, and optionally deploy

**Objective:** Keep the polish isolated and deploy only after verification.

**Files to stage, expected:**
- `package.json`
- `public/tools/smart-pricing-calculator.html`
- `public/smartcalc/index.html`
- `scripts/smartcalc-tutorial-smoke.cjs`
- possible generated `dist/` files only if the repo tracks them; otherwise deploy from `dist/`

**Do not stage unrelated existing files:**
- `@agents.md`
- old `.hermes/plans/...` files unless Anthony wants them committed
- `AGENT_PROJECT_GAME_PLAN.md`

Suggested commit:

```bash
git add package.json public/tools/smart-pricing-calculator.html public/smartcalc/index.html scripts/smartcalc-tutorial-smoke.cjs
git commit -m "feat: add Smart Calc tutorial demo actions"
git push origin botbot-tutorial-revive
```

If Anthony wants live immediately after implementation, reuse the verified static artifact deploy flow:

1. Build locally.
2. Backup live files on `alphahs@192.168.4.129`.
3. Stage `dist/smartcalc/index.html` and `dist/tools/smart-pricing-calculator.html` to `/tmp/smartcalc-<timestamp>`.
4. Install to:
   - `/srv/www/wolf.discount/smartcalc/index.html`
   - `/srv/www/wolf.discount/fd/smartcalc/index.html`
   - `/srv/www/wolf.discount/fd/tools/smart-pricing-calculator.html`
5. Verify SHA256 local vs remote.
6. Verify public HTTP with cache-busted version URLs.
7. Remove staging only after verification passes.

## Risks / Tradeoffs

- **Overwriting user quote values:** This is now intended tutorial behavior. Make the examples obvious so staff understand the form is being driven by BotBot training mode.
- **Demo actions making fake totals:** Expected during tutorial. Keep examples fixed, obvious, and internally consistent.
- **Blocking underlying clicks:** Required. The overlay/spotlight/card z-index and pointer-event rules need tests, because the highlighted target currently has a high z-index and could accidentally remain clickable.
- **Auto-clicking copy/print/reset:** Do not do it. Those are side-effect-prone and can annoy the browser/user. Highlight only; after tutorial exit the user can copy/print normally.
- **Final completion control:** Prefer reusing **Next** on the last step instead of showing a separate Done button, because Anthony specified Next/Back/Skip as the only tutorial controls.
- **Right rail on small screens:** Desktop only. Mobile should retain current card behavior.
- **Scroll timing:** The spotlight/card may position before the browser finishes scrolling. Use `requestAnimationFrame` after scroll and assert via smoke tests.
- **Discount example complexity:** Use one small fixed example discount, not a pile of toggles. Training should demonstrate the mechanism, not build a fake Black Friday ticket tornado.

## Resolved Decisions from Anthony

1. Tutorial demo actions may overwrite existing form values.
2. Tutorial should be able to progress end-to-end without the user manually clicking calculator controls.
3. During the tutorial, the user should only be able to click **Next**, **Back**, or **Skip tutorial**.
4. Default Pro1st demo: fill covered items and set covered value to `899`.
5. Default discount demo: fill one small fixed example discount, e.g. manager/other discount for `25`, as long as the notes/adjustment smoke assertions pass.

## Acceptance Criteria

- Pressing **Next** from a demoable step performs that step’s deterministic example action before advancing.
- Blank tutorial run produces a visible quote example: vendor/base cost → margin → add-ons → Pro1st → discount/financing.
- Pre-filled user values are intentionally overwritten by tutorial demo values when **Next** runs the relevant step.
- While the tutorial is open, underlying calculator controls, highlighted targets, copy, print, and reset are not user-clickable.
- The only visible/clickable tutorial controls are **Next**, **Back**, and **Skip tutorial**; final completion happens through Next or an equivalent non-extra control.
- Each step scrolls the new target into view before spotlight/card positioning.
- Desktop tutorial card appears as a tall right-side callout when space allows.
- Mobile tutorial card remains usable and does not cover the highlighted target.
- Existing spotlight, dim panels, BotBot pointer, skip/completion persistence, and postMessage origin checks still pass.
- Version is bumped and synced during implementation.
- Full validation gates pass before commit/push/deploy.
