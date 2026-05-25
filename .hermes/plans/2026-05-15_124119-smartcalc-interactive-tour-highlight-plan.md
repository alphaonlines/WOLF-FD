# Smart Calc Interactive Tutorial Spotlight Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the Smart Calc tutorial feel like the WOLF dashboard BotBot tour: the talked-about section remains visible, receives a moving/pulsing highlight, and the tutorial card follows the target instead of sitting as a generic central modal.

**Architecture:** Keep Smart Calc as a standalone HTML tool, but port the dashboard tour behavior concept from `components/app/TutorialOverlay.tsx` into `public/tools/smart-pricing-calculator.html`. Replace the current full-screen backdrop with a BotBot-style spotlight layer: four dim panels around the target, an animated ring/halo over the target, a small moving BotBot pointer, and card placement that is anchored beside/below the highlighted target. Preserve the existing wrapper `postMessage` launch path and avoid changing quote values unless the user explicitly opts into sample/demo mode.

**Tech Stack:** Plain HTML/CSS/JavaScript in `public/tools/smart-pricing-calculator.html`; JSDOM smoke coverage in `scripts/smartcalc-tutorial-smoke.cjs`; Vite build via `npm run build`.

---

## Confirmed Current Context

- Main tutorial file: `public/tools/smart-pricing-calculator.html`.
- Current tutorial overlay CSS uses one full-screen backdrop:
  - `.smartcalc-tour-overlay`: lines 101-109.
  - `.smartcalc-tour-backdrop`: lines 110-118.
- Current card is positioned separately:
  - `.smartcalc-tour-card`: lines 119-135.
  - `positionGuidedTutorialCard()`: lines 1328-1379.
- Current target highlighting adds `.smartcalc-tour-target` to the real element:
  - CSS: lines 300-306.
  - JS: `highlightTutorialTarget()`, lines 1388-1395.
- The target is currently given `z-index: 9998`, while the overlay/backdrop is `z-index: 9999`. That means the highlighted real element can still sit under the dark/blur layer. Tiny electrical smell: the LED is on, but the lid is closed.
- The WOLF dashboard tour already has the behavior Anthony likes:
  - `components/app/TutorialOverlay.tsx` dims four regions around the highlight and draws a pulsing target overlay, lines 126-184.
  - `components/botbot/BotBotTutorial.tsx` caps oversized highlight rectangles with `buildTargetRect()`, lines 63-90, so large sections do not become useless full-screen rectangles.
- Several Smart Calc tutorial targets are hidden by default until the calculator reaches a quote state:
  - `#calculator-section` starts `hidden`, line 421.
  - `#addons-section` starts `hidden`, line 451.
  - `#pro1st-options-wrapper` starts `hidden`, line 518.
  - `#financing-section` starts `hidden`, line 800.
  - `#adjustment-field-section` starts `hidden`, line 827.
  - `#reset-btn` starts `hidden`, line 843.
- Current test coverage exists in `scripts/smartcalc-tutorial-smoke.cjs` and already asserts:
  - tutorial opens/closes,
  - some targets receive `.smartcalc-tour-target`,
  - card does not cover target on mobile,
  - wrapper `postMessage` origin checks still work.

## Recommended UX Direction

### Primary behavior

When the tutorial step changes, the user should see:

1. Page scrolls the section into view.
2. Everything except the target area dims.
3. Target area remains readable and gets a moving orange/sky halo.
4. BotBot orb animates near the target edge, not locked inside the card.
5. Card appears beside the target on desktop or as a bottom sheet on mobile.
6. Copy says what to look at and what to do next.
7. User can click **Next**, press arrow keys, or optionally click the highlighted target area to continue when safe.

### Mason recommendation

Do this in two passes:

- **Pass 1 — Visual interactivity:** spotlight, moving BotBot, target-visible dimming, better card anchoring. Low risk; does not alter quote data.
- **Pass 2 — True guided walkthrough:** optional sample/demo values or user-driven clicks/typing. Higher UX value, but needs guardrails so we do not mutate a salesperson’s real in-progress quote.

Do **not** silently fill sample quote values by default. Sales tools should not ghost-type numbers into a live quote. That is how software develops a haunted-house reputation.

---

## Step-by-Step Plan

### Task 1: Add failing smoke assertions for the new spotlight layer

**Objective:** Lock the desired behavior before modifying the UI.

**Files:**
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`
- Test target: `npm run test:smartcalc-tutorial`

**Steps:**

1. Add helpers to inspect a new spotlight element and optional dim panels:
   - `#smartcalc-tour-spotlight`
   - `#smartcalc-tour-botbot-pointer`
   - `#smartcalc-tour-dim-top`
   - `#smartcalc-tour-dim-left`
   - `#smartcalc-tour-dim-right`
   - `#smartcalc-tour-dim-bottom`
2. After clicking to step 2 and step 3, assert:
   - spotlight is visible,
   - spotlight bounds match the target bounds plus padding,
   - card does not intersect the spotlight/target,
   - target text remains in the document and is not relying only on `.smartcalc-tour-target` below the backdrop.
3. Add a mobile test path and a desktop test path by mutating `window.innerWidth` / `window.innerHeight` in the JSDOM harness.
4. Expected before implementation: `npm run test:smartcalc-tutorial` fails because the new spotlight elements do not exist yet.

**Acceptance criteria:**
- The test fails for the right reason: missing spotlight/pointer elements or missing spotlight styles.

---

### Task 2: Replace the single dark backdrop with a BotBot-style spotlight DOM

**Objective:** Make the discussed section visibly remain on screen instead of being buried behind a central modal/backdrop.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Change concept:**

Replace the single visual behavior of:

```html
<div class="smartcalc-tour-backdrop" aria-hidden="true"></div>
```

with a structured layer like:

```html
<div id="smartcalc-tour-dim-top" class="smartcalc-tour-dim-panel" aria-hidden="true"></div>
<div id="smartcalc-tour-dim-left" class="smartcalc-tour-dim-panel" aria-hidden="true"></div>
<div id="smartcalc-tour-dim-right" class="smartcalc-tour-dim-panel" aria-hidden="true"></div>
<div id="smartcalc-tour-dim-bottom" class="smartcalc-tour-dim-panel" aria-hidden="true"></div>
<div id="smartcalc-tour-spotlight" class="smartcalc-tour-spotlight" aria-hidden="true"></div>
<div id="smartcalc-tour-botbot-pointer" class="smartcalc-tour-botbot-pointer" aria-hidden="true">...</div>
```

**CSS rules to add:**

- `.smartcalc-tour-overlay` should become mostly `pointer-events: none;`.
- `.smartcalc-tour-dim-panel` should be fixed, dark, blurred, and `pointer-events: auto;` so dimmed page areas do not accidentally receive clicks.
- `.smartcalc-tour-spotlight` should be fixed above the dim panels and below the card:
  - rounded rectangle for sections,
  - oval/circle for small controls,
  - orange/sky border,
  - pulsing `box-shadow`,
  - smooth `transition` for left/top/width/height so it appears to move.
- `.smartcalc-tour-card` remains `pointer-events: auto;` and gets a slightly higher z-index than the spotlight.
- Add `@media (prefers-reduced-motion: reduce)` to disable pulsing/movement.

**Z-index target:**

- dim panels: `10000`
- spotlight ring: `10001`
- BotBot pointer: `10002`
- card: `10003`

This avoids relying on the real target’s `z-index`, which is the current weak point.

**Acceptance criteria:**
- Target area is visible through the dimming system.
- The ring/halo is visible even when the target itself cannot be raised above siblings.
- The card still receives clicks.
- Dimmed background areas do not accidentally trigger calculator controls.

---

### Task 3: Add target-rectangle calculation and spotlight rendering functions

**Objective:** Compute a stable highlight box for each step and keep it synced while scrolling/resizing.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Functions to add/refactor:**

- `getTutorialViewport()`
- `getTutorialTargetRect(target)`
- `buildTutorialSpotlightRect(targetRect, targetSelector)`
- `renderTutorialSpotlight(target)`
- `clearTutorialSpotlight()`
- `positionBotBotPointer(spotlightRect)`

**Behavior:**

1. Use `target.getBoundingClientRect()` as the source of truth.
2. Add padding around the highlight, around `10px` to `18px` depending on viewport size.
3. Cap giant section highlights, similar to dashboard `buildTargetRect()`:
   - Max height: about `72vh` normally.
   - Max width: about `88vw` normally.
   - For very large sections, focus on the top/label region instead of boxing the entire giant area.
4. For small controls/buttons, use a pill/oval highlight.
5. Call `renderTutorialSpotlight()` in:
   - `renderGuidedTutorialStep()` after `highlightTutorialTarget()` resolves target.
   - `repositionGuidedTutorialCardIfOpen()`.
   - resize and scroll listeners.
6. Call `clearTutorialSpotlight()` in `closeGuidedTutorial()` and `clearTutorialTarget()`.

**Acceptance criteria:**
- Ring follows the target during scroll and resize.
- Back/Next moves the ring smoothly between targets.
- First and final header steps still have a visible highlight around the header.

---

### Task 4: Fix hidden-step targeting without mutating real quote data

**Objective:** Prevent later tutorial steps from becoming “background magic” when their target is currently hidden.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Problem:** Several tutorial selectors point to elements hidden until quote data exists. Current `isTutorialTargetVisible()` returns false for hidden elements, so those steps fall back to a generic card placement.

**Recommended safe approach:**

Add optional metadata to each tutorial step:

```js
{
  title: 'Add Pro1st protection',
  target: '#add-pro1st',
  spotlightTarget: '#pro1st-options-wrapper',
  revealForTutorial: ['#addons-section'],
  ...
}
```

or simpler for Pass 1:

- Retarget hidden steps to the nearest always-visible or safely revealable parent/control:
  - Pro1st step: target `#add-pro1st` or the Pro1st row, not only `#pro1st-options-wrapper`.
  - Discounts step: target discount area/section first; if `#adjustment-field-section` is hidden, use the discount checkbox group.
  - Financing step: target `#show-financing`/store-tax area if `#financing-section` is hidden.
  - Print step: target the customer-copy/results area or explain it appears after a calculated quote if `#reset-btn` is hidden.

**Optional later enhancement:**

Add a **Use sample quote for tutorial** button. Only then set safe demo values and reveal the full workflow. If user has existing inputs, show a warning and do not overwrite without explicit confirmation.

**Acceptance criteria:**
- Every step has either a visible real target or a deliberate “not visible yet” fallback target.
- Starting tutorial with an in-progress quote still preserves all user-entered values.
- Smoke test covers a hidden target step and verifies the tutorial still displays a spotlight.

---

### Task 5: Make the card feel anchored to the target, not detached

**Objective:** Move from “modal in the way” to “guide bubble pointing at the machine part.”

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Placement behavior:**

- Desktop / wide viewport:
  - Prefer card to the right of target.
  - If no right space, place left.
  - If neither side works, place below or above.
  - Keep a `16px-24px` air gap from the spotlight.
- Mobile:
  - Use bottom sheet behavior, but keep max height around `42dvh-50dvh` when a target is visible.
  - Scroll the target into the upper/middle viewport so the user can see both target and card.
  - Do not cover the target.

**Add visual connection:**

- Add a tiny arrow/notch or line from card toward the spotlight.
- Add a small “Look here” or “Your next control” pill near the spotlight.
- Let the BotBot pointer orbit/hover near the highlight edge.

**Acceptance criteria:**
- Card never covers the target.
- On mobile, target remains visible above the card.
- On desktop, card feels attached to the highlighted region.

---

### Task 6: Add optional click-to-continue behavior for safe explanatory steps

**Objective:** Make the tutorial feel interactive without forcing users through destructive calculator actions.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`
- Modify: `scripts/smartcalc-tutorial-smoke.cjs`

**Behavior:**

- Add step metadata:

```js
clickTargetToAdvance: true
```

- For non-destructive sections, clicking the spotlight/target advances the tutorial.
- For real controls where a click would change quote state, do not auto-forward the click unless the step explicitly allows it.
- Card copy should say:
  - “Click the highlighted area or press Next.”

**Safe first-pass candidates:**

- Header / welcome.
- Entry mode button group if no quote data would be lost.
- Large explanatory sections.
- Copy notes / print steps should remain explanatory unless the quote is ready.

**Acceptance criteria:**
- Users can proceed by clicking the highlighted area on safe steps.
- Real calculator actions are not triggered unexpectedly.
- Keyboard navigation still works: `ArrowRight`, `ArrowLeft`, `Escape`.

---

### Task 7: Polish BotBot identity and microcopy

**Objective:** Make the tour feel like BotBot is guiding the user, not reading a static manual.

**Files:**
- Modify: `public/tools/smart-pricing-calculator.html`

**Copy/visual additions:**

- Keep the “BotBot says” label.
- Add step-specific short CTA labels:
  - “Look here.”
  - “This is the starting mode selector.”
  - “This area wakes up after cost is entered.”
- Add a progress label that remains concise on mobile.
- Add an optional status line under the body:
  - “Target highlighted on screen.”
  - “This section appears after a quote starts.”

**Acceptance criteria:**
- User understands why a section is highlighted.
- Hidden/unavailable future sections are explained rather than silently skipped.

---

### Task 8: Version, tests, build, and deploy

**Objective:** Ship the improvement safely to the same live Smart Calc routes.

**Files:**
- Modify: `package.json`
- Modify: `public/tools/smart-pricing-calculator.html`
- Modify: `public/smartcalc/index.html`
- Modify: `AGENTS.md`

**Versioning:**

Use Anthony’s Smart Calc visible version convention:

- `displayVersion`: `1.<month>.<day>.<HHMM>`
- package `version`: matching pre-1.0 stamp, e.g. `0.5.15.<HHMM>` for today’s branch pattern.

**Commands:**

```bash
npm run test:smartcalc-tutorial
npm run test:smartcalc-margin-discounts
npm run test:smartcalc-number-input-wheel
npm test
npm run build
```

**Deploy shape:**

- Build locally from `C:/Users/antho/WOLF-FD-git`.
- Back up live server files on `alphahs@192.168.4.129` before copying.
- Deploy built files to:
  - `/srv/www/wolf.discount/smartcalc/index.html`
  - `/srv/www/wolf.discount/fd/smartcalc/index.html`
  - `/srv/www/wolf.discount/fd/tools/smart-pricing-calculator.html`
- Preserve ownership pattern discovered yesterday:
  - apex `/smartcalc/index.html`: `root:root`
  - FD wrapper/tool files: `alphahs:alphahs`

**Post-deploy verification:**

```bash
curl -I 'https://wolf.discount/smartcalc/?v=<new-version>'
curl -I 'https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html?v=<new-version>'
```

Then fetch bodies and confirm:

- new version marker exists,
- spotlight DOM marker exists,
- tutorial marker exists,
- SHA256 of live files matches local `dist/` files.

---

## Manual QA Checklist

Use `https://wolf.discount/smartcalc/?v=<new-version>` after deploy.

Check desktop and mobile widths:

- Tutorial opens from Smart Calc button.
- Tutorial opens from dashboard wrapper toolbar via postMessage.
- Step 1 highlights header/BotBot intro.
- Step 2 highlights entry mode selector visibly.
- Step 3 highlights base cost/vendor section visibly.
- Card never covers the highlighted target.
- Highlight moves smoothly on Next/Back.
- Hidden later sections do not lose the highlight; they show a fallback target or clear explanation.
- Skip closes without marking complete.
- Done closes and saves completion.
- Existing typed base cost survives tutorial start/skip/done.
- Escape closes; ArrowRight/ArrowLeft navigate.
- Reduced-motion browser setting does not pulse wildly.

## Risks / Tradeoffs

- **Hidden dynamic sections:** The tutorial cannot honestly highlight sections that do not exist visually yet. Use visible fallback targets first; only add sample/demo quote mode later.
- **Iframe route:** `wolf.discount/smartcalc/` displays the FD tool in an iframe. Any wrapper launch must keep using allowed `postMessage` origins.
- **Pointer events:** If the overlay blocks too much, the calculator feels dead. If it blocks too little, users may accidentally alter a quote. Keep dim panels blocking outside the spotlight and be explicit about click-through behavior.
- **Z-index:** Do not raise real calculator sections above the card. Draw the spotlight as its own overlay element instead.
- **Mobile viewport:** Bottom sheet can still hide targets unless the target is scrolled high enough before measuring. Measure after scroll settles.

## Final Recommendation

Implement Pass 1 first: spotlight cutout, moving BotBot pointer, anchored card, hidden-target fallbacks, and expanded smoke tests. That directly fixes Anthony’s complaint: the tutorial stops feeling like a central popup doing invisible background work and starts behaving like the dashboard BotBot tour.

Pass 2 can add a true sample quote walkthrough once the visual tour feels right.
