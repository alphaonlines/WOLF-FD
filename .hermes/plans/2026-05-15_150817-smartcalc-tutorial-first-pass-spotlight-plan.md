# Smart Calc Tutorial First-Pass Spotlight Fix Plan

> **For Hermes:** Planning-only handoff. Use `test-driven-development` before changing production code, then `frontend-release-deployment` before shipping.

**Goal:** Fix the Smart Calc guided tutorial so steps 5-7 do not show a tiny first-pass spotlight box and then a larger box only after going forward/back. The same step should resolve to the same intended section target the first time and on backtracking.

**Architecture:** Keep the existing standalone Smart Calc tutorial system in `public/tools/smart-pricing-calculator.html`, but separate “prepare this step so its intended target is visible” from “perform the demo action when leaving this step.” The bug is caused by measuring/highlighting targets before their own demo action reveals the section. Add regression coverage in `scripts/smartcalc-tutorial-smoke.cjs` that explicitly compares first-pass and backtrack target/spotlight sizes.

**Tech Stack:** Static HTML/CSS/vanilla JS; JSDOM smoke test; npm/Vite build/deploy workflow.

---

## Confirmed facts from investigation

- Repo: `C:/Users/antho/WOLF-FD-git`
- Branch: `botbot-tutorial-revive`
- Current version in `package.json`: `0.5.15.1427`
- Current display version: `1.5.15.1427`
- Existing Smart Calc tutorial test passes today:

```bash
npm run test:smartcalc-tutorial
# Smart Calc tutorial smoke PASS
```

- Relevant source:
  - Tutorial step metadata: `public/tools/smart-pricing-calculator.html:1201-1281`
  - Step advancement: `public/tools/smart-pricing-calculator.html:1380-1393`
  - Demo action executor: `public/tools/smart-pricing-calculator.html:1429-1465`
  - Step render/highlight pipeline: `public/tools/smart-pricing-calculator.html:1483-1516`
  - Target resolver/highlighter: `public/tools/smart-pricing-calculator.html:1752-1782`
  - Pro1st checkbox reveal listener: `public/tools/smart-pricing-calculator.html:1860-1863`
  - Discount reveal logic: `public/tools/smart-pricing-calculator.html:2552-2558`

## Reproduction evidence

I ran an instrumented JSDOM pass that logged active target and spotlight size through the tutorial. Key result:

```text
FORWARD_TO_STEP_6 {"title":"Add Pro1st protection","target":"add-pro1st","pro1stHidden":true,"spotlight":{"w":80,"h":52}}
FORWARD_TO_STEP_7 {"title":"Document discounts","target":"smartcalc-tour-discount-reasons","pro1stHidden":false,"spotlight":{"w":552,"h":452}}
BACK_TO_STEP_6    {"title":"Add Pro1st protection","target":"pro1st-options-wrapper","pro1stHidden":false,"spotlight":{"w":552,"h":210}}
```

That proves the Pro1st step is not random rendering noise. First pass uses the fallback checkbox because the full Pro1st options wrapper is still hidden. After going forward, the previous step’s demo action has revealed it, so Back sees the large wrapper.

## Root cause

Current `advanceGuidedTutorial()` does this:

1. Look at the current step.
2. Run the current step’s `demoAction`.
3. Increment the tutorial step index.
4. Render/highlight the next step.

That means the “Add Pro1st protection” step is rendered before its own `toggle-pro1st-example` action has executed. Since `#pro1st-options-wrapper` starts hidden, `resolveTutorialTarget()` falls back to `#add-pro1st`, which is a tiny checkbox. When the user goes past that step, `toggle-pro1st-example` finally runs and reveals the full wrapper. Going Back then measures the large wrapper.

Electrical translation: the spotlight is measuring the board before the relay energizes. Of course it sees the tiny terminal instead of the whole circuit.

There is probably a related version of the same bug around discount-detail rows: `fill-discount-example` reveals `#manager-approval-wrapper` only when leaving the Document discounts step, so first-pass and backtrack height may differ even if the fieldset target is already visible.

---

## Proposed fix direction

Use two kinds of tutorial actions:

1. **prepareAction** — runs before rendering/highlighting a step. It reveals enough UI so the intended target exists at full size.
2. **demoAction** — runs when pressing Next to leave the step. It can finish the training example state and feed later steps.

This avoids a blunt “run every demo action early” change, which could make step copy feel out of order and mutate too much too soon.

### Recommended step behavior

- Step 5, **Add delivery and services**
  - Existing `demoAction: 'toggle-delivery-example'` can stay as an exit action.
  - This makes step 6 possible.

- Step 6, **Add Pro1st protection**
  - Add `prepareAction: 'reveal-pro1st-example'` or move the existing reveal/check part into a prepare action.
  - Before highlighting step 6, check/reveal Pro1st enough that `#pro1st-options-wrapper` is visible.
  - Then spotlight `#pro1st-options-wrapper` on first pass and backtrack.
  - Keep field-filling deterministic: `standard`, `sofa and loveseat`, `899`.

- Step 7, **Document discounts**
  - Prefer a stable whole-section target for first pass.
  - Either:
    - keep target as `#smartcalc-tour-discount-reasons` and add a test that its first-pass/backtrack spotlight does not shrink/grow unexpectedly, or
    - add `prepareAction: 'reveal-discount-example'` so the manager-approval detail row is already open when the Document discounts step is first highlighted.
  - If we reveal manager approval before rendering step 7, update the copy to say BotBot has prepared the example discount rather than “will add.”

---

## Implementation tasks

### Task 1: Add failing regression coverage for first-pass/backtrack spotlight stability

**Objective:** Prove the current bug before touching product code.

**Files:**
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Steps:**
1. Add a helper:

```js
function activeTutorialTarget() {
  return document.querySelector('.smartcalc-tour-target');
}
```

2. Add a helper to read the spotlight rectangle:

```js
function spotlightRect() {
  const rect = byId('smartcalc-tour-spotlight').getBoundingClientRect();
  return { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
}
```

3. During the existing forward tutorial path, capture first-pass data for:
   - Step 6 / `Add Pro1st protection`
   - Step 7 / `Document discounts`

4. For Pro1st first pass, assert the intended full target is used:

```js
assert.equal(activeTutorialTarget()?.id, 'pro1st-options-wrapper');
assertSpotlightCoversWholeArea(byId('pro1st-options-wrapper'), 'Pro1st options', 480, 150);
```

5. Go forward one step, then Back to Pro1st and assert target/size are still the same target family:

```js
const firstPassPro1st = spotlightRect();
await clickNextAndSettle();
byId('smartcalc-tour-back').click();
await settle();
const backtrackPro1st = spotlightRect();
assert.equal(activeTutorialTarget()?.id, 'pro1st-options-wrapper');
assert.ok(Math.abs(firstPassPro1st.width - backtrackPro1st.width) <= 2);
assert.ok(Math.abs(firstPassPro1st.height - backtrackPro1st.height) <= 2);
```

6. Add a similar first-pass/backtrack stability check for Document discounts.

**Expected RED now:** Existing code fails because first-pass Pro1st target is `#add-pro1st` with an ~`80x52` spotlight, while backtrack target is `#pro1st-options-wrapper` with a much larger spotlight.

---

### Task 2: Add a prepare-action hook before target resolution

**Objective:** Ensure a step’s intended target is visible before `highlightTutorialTarget()` measures it.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Steps:**
1. Add a new function near `applyTutorialDemoAction()`:

```js
function prepareTutorialStep(step) {
  switch (step?.prepareAction) {
    case 'reveal-pro1st-example':
      // reveal/check enough state for #pro1st-options-wrapper to be visible
      break;
    case 'reveal-discount-example':
      // optional: reveal manager approval details before measuring discounts
      break;
    default:
      break;
  }
}
```

2. Call it in `renderGuidedTutorialStep()` before `highlightTutorialTarget(step)`:

```js
prepareTutorialStep(step);
const target = highlightTutorialTarget(step);
```

3. Keep the existing `requestAnimationFrame()` reposition pass. If the step prepare action triggers layout, the second pass is still useful.

**Acceptance criteria:** The step’s target is made visible before `resolveTutorialTarget()` chooses fallback targets.

---

### Task 3: Split Pro1st reveal/fill behavior cleanly

**Objective:** Make step 6 first-pass target large without creating duplicate or order-dependent mutations.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Steps:**
1. Add `prepareAction` to the Pro1st step metadata:

```js
{
  title: 'Add Pro1st protection',
  ...
  target: '#pro1st-options-wrapper',
  fallbackTarget: '#add-pro1st',
  prepareAction: 'reveal-pro1st-example',
  demoAction: 'toggle-pro1st-example'
}
```

2. Implement `reveal-pro1st-example` so it is idempotent:

```js
case 'reveal-pro1st-example':
  selectTutorialDemoValue(allElements.pro1stPlanTypeSelect, 'standard');
  setTutorialCheckbox(allElements.addPro1stCheckbox, true);
  setTutorialDemoValue(allElements.pro1stCoveredItemsInput, 'sofa and loveseat');
  setTutorialDemoValue(allElements.pro1stCoveredValueInput, '899');
  break;
```

3. Make `toggle-pro1st-example` reuse the same helper or no-op if prepare already handled all Pro1st demo state. Avoid two diverging copies.

4. Update the existing test assertion that currently expects fallback to the tiny `#add-pro1st` row:

Current intent to replace:

```js
'hidden Pro1st option details should fall back to the visible Pro1st checkbox row before BotBot checks it'
```

New intent:

```js
'Pro1st option details should be revealed before first-pass spotlight measurement'
```

**Acceptance criteria:** First pass and Back both spotlight `#pro1st-options-wrapper`.

---

### Task 4: Decide and implement discount-step stabilization

**Objective:** Prevent the same first-pass/backtrack mismatch on step 7.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Preferred option:** Prepare the discount example before rendering the Document discounts step.

1. Add `prepareAction: 'reveal-discount-example'` to the Document discounts step.
2. Implement it idempotently by checking manager approval and filling the fixed training values:

```js
case 'reveal-discount-example':
  setTutorialCheckbox(allElements.discountManagerApprovalCheckbox, true);
  selectTutorialDemoValue(allElements.managerApprovalNameInput, 'Other');
  setTutorialDemoValue(allElements.managerApprovalAmountInput, '25');
  updateDiscountReasonControls();
  updateGrandTotal();
  break;
```

3. Make `fill-discount-example` reuse this helper or become a no-op when the state already exists.
4. Update tutorial copy if needed:
   - From “BotBot adds one small manager-approval training discount...”
   - To “BotBot has opened one manager-approval training discount...”

**Lower-risk option:** Keep discount action on exit, but assert the fieldset first-pass/backtrack spotlight dimensions stay within tolerance. This may be enough if Anthony only sees the tiny box on Pro1st.

**Mason recommendation:** Prepare the discount example too. Same failure class, same cure. Do not leave a second flaky little goblin in the wall.

---

### Task 5: Re-run targeted validation

**Objective:** Prove the regression is fixed without disturbing unrelated files.

**Commands:**

```bash
npm run test:smartcalc-tutorial
npm run test:smartcalc-margin-discounts
npm run test:smartcalc-number-input-wheel
npm test
npm run build
```

**Expected:** All pass. Existing Vite/esbuild warnings may remain unchanged.

---

### Task 6: Version, deploy, and verify only after Anthony approves implementation

**Objective:** Ship the bugfix with the normal Smart Calc version/deploy discipline.

**Files likely to change for implementation/release:**
- `public/tools/smart-pricing-calculator.html`
- `scripts/smartcalc-tutorial-smoke.cjs`
- `package.json`
- `package-lock.json`
- generated `dist/` output during build/deploy, not committed unless this repo normally tracks it

**Version rule:** Use Anthony’s manual date-time stamp. Do not use `npm version` because these are intentionally non-semver-style pre-1.0 stamps.

Example shape if implemented later today:

```json
"version": "0.5.15.HHMM",
"displayVersion": "1.5.15.HHMM"
```

Then run build/version sync and deploy to all Smart Calc wrappers:

- `/srv/www/wolf.discount/fd/`
- `/srv/www/wolf.discount/smartcalc/`
- `/srv/www/wolf.discount/furnituredistributors/smartcalc/`

Verify live routes include the new display version and no old version markers remain.

---

## Risks / tradeoffs

- Running prepare actions before rendering means the tutorial mutates the form earlier than before. That is acceptable for the current BotBot training-mode behavior, but copy should be honest: “BotBot has opened/filled this example.”
- Back should not undo demo state. The tutorial currently behaves like a forward-built training quote, not a reversible wizard. Keep that unless Anthony asks for a true resettable tutorial state machine.
- Avoid fixing this by just increasing minimum spotlight size. That would hide the symptom but still target the wrong element. Fake big box, wrong board. Bad repair.

## Open question for Anthony

If the first-pass tiny box is visible on Document discounts too, should the tutorial show the manager approval detail row already opened when the Document discounts step appears? My recommendation: yes, open it before measuring so steps 6 and 7 behave consistently.
