const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'public/tools/smart-pricing-calculator.html');
const pagePath = path.join(repoRoot, 'components/SmartPricingCalculatorPage.tsx');
const html = readFileSync(htmlPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');

const jsErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  // External CSS/font resources are irrelevant to this calculator smoke test.
  if (!String(error?.message || '').includes('Could not load')) jsErrors.push(error);
});
virtualConsole.on('error', (message) => jsErrors.push(new Error(String(message))));

function makeRect(left, top, width, height) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this;
    },
  };
}

function numericStyle(value, fallback) {
  const parsed = Number.parseFloat(String(value || ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html',
  virtualConsole,
  beforeParse(window) {
    window.tailwind = {};
    window.alert = () => {};
    window.__smartCalcOpenCount = 0;
    window.open = () => {
      window.__smartCalcOpenCount += 1;
      return null;
    };
    window.__smartCalcScrollLog = [];
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, writable: true, configurable: true });
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
      window.__smartCalcScrollLog.push({
        id: this.id || '',
        tag: this.tagName,
        options: options || {},
      });
    };
    window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.classList?.contains('hidden')) {
        return makeRect(0, 0, 0, 0);
      }
      if (this.id === 'smartcalc-tour-card') {
        const width = numericStyle(this.style.width, Math.min(430, window.innerWidth - 32));
        const height = numericStyle(this.style.maxHeight, 328);
        const fallbackLeft = (window.innerWidth - width) / 2;
        const fallbackTop = (window.innerHeight - height) / 2;
        return makeRect(
          numericStyle(this.style.left, fallbackLeft),
          numericStyle(this.style.top, fallbackTop),
          width,
          Math.min(height, window.innerHeight - 32),
        );
      }
      if (this.id === 'smartcalc-tour-spotlight') {
        return makeRect(
          numericStyle(this.style.left, 0),
          numericStyle(this.style.top, 0),
          numericStyle(this.style.width, 0),
          numericStyle(this.style.height, 0),
        );
      }
      if (this.id === 'smartcalc-tour-botbot-pointer') {
        return makeRect(
          numericStyle(this.style.left, 0),
          numericStyle(this.style.top, 0),
          numericStyle(this.style.width, 44),
          numericStyle(this.style.height, 44),
        );
      }
      if (window.innerWidth >= 1080) {
        if (this.id === 'base-cost-section') return makeRect(120, 190, 520, 224);
        if (this.id === 'smartcalc-tour-entry-mode') return makeRect(120, 122, 520, 52);
        if (this.id === 'calculator-section') return makeRect(120, 430, 520, 220);
        if (this.id === 'addons-section') return makeRect(120, 520, 520, 260);
        if (this.id === 'smartcalc-tour-discount-reasons' || this.matches?.('#addons-section fieldset')) return makeRect(120, 220, 520, 420);
        if (this.id === 'financing-section') return makeRect(120, 260, 520, 148);
        if (this.id === 'sales-notes-section') return makeRect(120, 200, 520, 340);
        if (this.id === 'smartcalc-tour-copy-print-section') return makeRect(120, 180, 520, 410);
        if (this.id === 'reset-btn') return makeRect(120, 545, 520, 44);
        if (this.tagName === 'HEADER') return makeRect(120, 24, 520, 132);
      }
      if (this.id === 'base-cost-section') {
        return makeRect(32, 221.5, 311, 223);
      }
      if (this.id === 'smartcalc-tour-entry-mode') {
        return makeRect(32, 161, 311, 52);
      }
      if (this.tagName === 'HEADER') {
        return makeRect(16, 20, 343, 132);
      }
      return makeRect(32, 120, 240, 48);
    };
  },
});

const { window } = dom;
const { document } = window;

function waitForReady() {
  return new Promise((resolve) => {
    if (document.readyState !== 'loading') {
      window.setTimeout(resolve, 0);
      return;
    }
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(resolve, 0), { once: true });
  });
}

function settle() {
  return new Promise((resolve) => window.setTimeout(resolve, 35));
}

function byId(id) {
  const element = document.getElementById(id);
  assert.ok(element, `missing #${id}`);
  return element;
}

function setValue(id, value, eventName = 'input') {
  const element = byId(id);
  element.value = value;
  element.dispatchEvent(new window.Event(eventName, { bubbles: true }));
  return element;
}

function setViewport(width, height) {
  window.innerWidth = width;
  window.innerHeight = height;
  window.dispatchEvent(new window.Event('resize'));
}

function activeOverlay() {
  const overlay = byId('smartcalc-tour-overlay');
  assert.equal(overlay.getAttribute('aria-hidden'), 'false', 'tutorial overlay should be open');
  return overlay;
}

function closeOverlay() {
  const overlay = byId('smartcalc-tour-overlay');
  if (overlay.getAttribute('aria-hidden') === 'false') byId('smartcalc-tour-skip').click();
  assert.equal(overlay.getAttribute('aria-hidden'), 'true', 'tutorial overlay should close');
}

function intersectionArea(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

function assertCardDoesNotCoverTarget(card, target) {
  const cardRect = card.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  assert.equal(
    intersectionArea(cardRect, targetRect),
    0,
    `tutorial card should not cover highlighted target; card=${JSON.stringify(cardRect)} target=${JSON.stringify(targetRect)}`,
  );
  assert.ok(cardRect.left >= 0, 'tutorial card should stay inside the left viewport edge');
  assert.ok(cardRect.right <= window.innerWidth, 'tutorial card should stay inside the right viewport edge');
  assert.ok(cardRect.top >= 0, 'tutorial card should stay inside the top viewport edge');
  assert.ok(cardRect.bottom <= window.innerHeight, 'tutorial card should stay inside the bottom viewport edge');
}

function assertSpotlightTracksTarget(target) {
  const spotlight = byId('smartcalc-tour-spotlight');
  const pointer = byId('smartcalc-tour-botbot-pointer');
  ['top', 'left', 'right', 'bottom'].forEach((side) => {
    const panel = byId(`smartcalc-tour-dim-${side}`);
    assert.equal(panel.getAttribute('aria-hidden'), 'false', `dim ${side} panel should be active while the tour is open`);
  });

  assert.equal(spotlight.getAttribute('aria-hidden'), 'false', 'spotlight should be visible for targeted steps');
  assert.equal(pointer.getAttribute('aria-hidden'), 'false', 'BotBot pointer should be visible for targeted steps');

  const targetRect = target.getBoundingClientRect();
  const spotlightRect = spotlight.getBoundingClientRect();
  assert.ok(spotlightRect.width >= targetRect.width, `spotlight should be at least as wide as target; spotlight=${JSON.stringify(spotlightRect)} target=${JSON.stringify(targetRect)}`);
  assert.ok(spotlightRect.height >= targetRect.height, `spotlight should be at least as tall as target; spotlight=${JSON.stringify(spotlightRect)} target=${JSON.stringify(targetRect)}`);
  assert.ok(spotlightRect.left <= targetRect.left, 'spotlight should start at or before target left edge');
  assert.ok(spotlightRect.top <= targetRect.top, 'spotlight should start at or before target top edge');
  assert.ok(spotlightRect.right >= targetRect.right, 'spotlight should end at or after target right edge');
  assert.ok(spotlightRect.bottom >= targetRect.bottom, 'spotlight should end at or after target bottom edge');
  assertCardDoesNotCoverTarget(byId('smartcalc-tour-card'), target);
}

function assertSpotlightCoversWholeArea(target, label, minWidth, minHeight) {
  assert.ok(target, `missing full-area tutorial target for ${label}`);
  assert.ok(
    target.classList.contains('smartcalc-tour-target'),
    `${label} should be the active tutorial target, not a tiny child control`,
  );
  const targetRect = target.getBoundingClientRect();
  assert.ok(targetRect.width >= minWidth, `${label} target should be section-width; rect=${JSON.stringify(targetRect)}`);
  assert.ok(targetRect.height >= minHeight, `${label} target should be section-height; rect=${JSON.stringify(targetRect)}`);
  assertSpotlightTracksTarget(target);
}

function assertScrolledTo(idOrTag) {
  const found = window.__smartCalcScrollLog.some((entry) => entry.id === idOrTag || entry.tag === idOrTag);
  assert.ok(found, `tutorial should scroll ${idOrTag} into view; log=${JSON.stringify(window.__smartCalcScrollLog)}`);
}

function assertOnlyTutorialNavIsClickable() {
  const overlay = activeOverlay();
  assert.equal(window.getComputedStyle(overlay).pointerEvents, 'auto', 'tutorial overlay should intercept page clicks while open');
  assert.equal(byId('smartcalc-tour-spotlight').classList.contains('smartcalc-tour-spotlight-clickable'), false, 'spotlight should be visual-only, not an extra advance target');
  assert.equal(byId('smartcalc-tour-done').classList.contains('hidden'), true, 'Done should stay hidden so the only controls are Next, Back, and Skip tutorial');
  assert.equal(byId('smartcalc-tour-next').classList.contains('hidden'), false, 'Next should remain the visible forward/completion control');
}

async function clickNextAndSettle() {
  byId('smartcalc-tour-next').click();
  await settle();
  assertOnlyTutorialNavIsClickable();
}

function assertDesktopRightRail() {
  const card = byId('smartcalc-tour-card');
  const rect = card.getBoundingClientRect();
  assert.ok(rect.width >= 340 && rect.width <= 390, `desktop tutorial card should use right-rail width, got ${rect.width}`);
  assert.ok(rect.right >= window.innerWidth - 28, `desktop tutorial card should dock to the right rail, rect=${JSON.stringify(rect)}`);
  assert.ok(rect.top <= 28, `desktop tutorial card should start near the top rail, rect=${JSON.stringify(rect)}`);
  assert.ok(rect.height >= window.innerHeight - 64, `desktop tutorial card should be tall, rect=${JSON.stringify(rect)}`);
}

(async () => {
  await waitForReady();
  assert.equal(jsErrors.length, 0, jsErrors.map((error) => error.message).join('\n'));

  assert.match(pageSource, /FD_SMART_CALC_START_TUTORIAL/, 'React wrapper should send the tutorial start postMessage');
  assert.match(pageSource, /Restart tutorial|Start guided tutorial/, 'React wrapper should expose a production tutorial toolbar action');

  assert.equal(window.localStorage.getItem('fd_smartcalc_tutorial_completed_v1'), null, 'completion flag should start empty');
  assert.equal(byId('smartcalc-tour-overlay').getAttribute('aria-hidden'), 'true', 'tutorial overlay should be hidden by default');

  const startButton = byId('smartcalc-tutorial-btn');
  assert.match(startButton.textContent, /start guided tutorial|restart tutorial/i, 'standalone calculator should expose a production tutorial start button');

  const botbot = byId('smartcalc-tour-botbot');
  assert.match(botbot.getAttribute('aria-label') || '', /BotBot/i, 'tutorial card should include the BotBot assistant identity');

  setViewport(1280, 800);
  startButton.click();
  await settle();
  let overlay = activeOverlay();
  assert.match(overlay.textContent, /Welcome to Smart Calc/i, 'first tutorial step should welcome the employee');
  assertOnlyTutorialNavIsClickable();
  assertDesktopRightRail();
  closeOverlay();

  setViewport(375, 667);
  setValue('vendor-select', 'ASHLEY', 'change');
  setValue('base-cost', '499');
  setValue('margin-percent', '45');
  startButton.click();
  await settle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /Welcome to Smart Calc/i, 'first tutorial step should welcome the employee');
  assert.match(overlay.textContent, /BotBot says/i, 'tutorial copy should be presented as BotBot guidance');
  assert.equal(byId('base-cost').value, '499', 'starting the tutorial itself should not mutate the quote before Next runs a demo action');
  assert.equal(byId('margin-percent').value, '45', 'starting the tutorial itself should not mutate margin before Next runs a demo action');
  assertSpotlightTracksTarget(document.querySelector('header'));
  assertScrolledTo('HEADER');
  assertOnlyTutorialNavIsClickable();

  byId('smartcalc-tour-spotlight').click();
  await settle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /Welcome to Smart Calc/i, 'clicking the highlighted area must not advance; only Next, Back, or Skip tutorial should work');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /starting point/i, 'Next should advance to the starting point step');
  assert.ok(
    byId('smartcalc-tour-entry-mode').classList.contains('smartcalc-tour-target'),
    'entry-mode tour target should be highlighted on the matching step',
  );
  assertSpotlightTracksTarget(byId('smartcalc-tour-entry-mode'));
  assertScrolledTo('smartcalc-tour-entry-mode');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /vendor and base cost/i, 'third step should explain vendor and base cost');
  assert.ok(byId('btn-base-cost').classList.contains('active'), 'leaving the starting-point step should select Base Cost mode');
  assert.ok(
    byId('base-cost-section').classList.contains('smartcalc-tour-target'),
    'base-cost tour target should be highlighted on the matching step',
  );
  assertSpotlightTracksTarget(byId('base-cost-section'));
  assertScrolledTo('base-cost-section');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /selling goal/i, 'leaving the cost step should advance to the selling-goal step');
  assert.equal(byId('vendor-select').value, 'ASHLEY', 'tutorial demo should set the vendor');
  assert.equal(byId('base-cost').value, '399 + 299, 179', 'tutorial demo should overwrite existing base cost with the fixed example');
  assert.equal(byId('calculator-section').classList.contains('hidden'), false, 'base-cost demo should reveal calculator section');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /delivery and services/i, 'leaving the margin step should advance to delivery/services');
  assert.equal(byId('margin-percent').value, '55', 'tutorial demo should overwrite margin with the fixed target');
  assert.equal(byId('result-section').classList.contains('hidden'), false, 'margin demo should reveal result section');
  assert.equal(byId('addons-section').classList.contains('hidden'), false, 'margin demo should reveal add-ons section');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /Pro1st protection/i, 'leaving delivery/services should advance to Pro1st');
  assert.equal(byId('add-delivery').checked, true, 'delivery demo should check local delivery');
  assert.equal(byId('delivery-type-wrapper').classList.contains('hidden'), false, 'delivery demo should reveal delivery details');
  assert.ok(
    byId('add-pro1st').classList.contains('smartcalc-tour-target'),
    'hidden Pro1st option details should fall back to the visible Pro1st checkbox row before BotBot checks it',
  );

  closeOverlay();
  assert.equal(window.localStorage.getItem('fd_smartcalc_tutorial_completed_v1'), null, 'skipping should not mark tutorial completed');

  setViewport(1280, 800);
  startButton.click();
  await settle();
  for (let guard = 0; guard < 40 && !/Document discounts/i.test(byId('smartcalc-tour-title').textContent || ''); guard += 1) {
    await clickNextAndSettle();
  }
  overlay = activeOverlay();
  assert.match(byId('smartcalc-tour-title').textContent, /Document discounts/i, 'tutorial should reach the discounts step after applying Pro1st demo');
  const discountReasons = document.getElementById('smartcalc-tour-discount-reasons') || document.querySelector('#addons-section fieldset');
  assertSpotlightCoversWholeArea(discountReasons, 'discount reasons', 480, 300);
  assert.equal(byId('add-pro1st').checked, true, 'Pro1st demo should check protection');
  assert.equal(byId('pro1st-options-wrapper').classList.contains('hidden'), false, 'Pro1st demo should reveal options');
  assert.equal(byId('pro1st-covered-items').value, 'sofa and loveseat', 'Pro1st demo should fill covered items');
  assert.equal(byId('pro1st-covered-value').value, '899', 'Pro1st demo should fill covered value');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /tax and financing/i, 'discount demo should advance to tax/financing');
  assertSpotlightCoversWholeArea(byId('financing-section'), 'financing section', 480, 120);
  assert.equal(byId('discount-manager-approval').checked, true, 'discount demo should check manager approval');
  assert.equal(byId('manager-approval-wrapper').classList.contains('hidden'), false, 'discount demo should reveal manager approval detail fields');
  assert.equal(byId('manager-approval-name').value, 'Other', 'discount demo should select a fixed manager approval value');
  assert.equal(byId('manager-approval-amount').value, '25', 'discount demo should fill a small fixed adjustment amount');
  assert.equal(byId('adjustment-field-section').classList.contains('hidden'), false, 'discount demo should reveal adjustment copy field');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /sales order notes/i, 'financing demo should advance to notes');
  assertSpotlightCoversWholeArea(byId('sales-notes-section'), 'sales notes section', 480, 300);
  assert.equal(byId('show-financing').checked, true, 'financing demo should check the display-only financing option');
  assert.equal(byId('financing-breakdown').classList.contains('hidden'), false, 'financing demo should reveal financing breakdown');

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /print the customer copy/i, 'notes step should advance to print customer copy');
  assertSpotlightCoversWholeArea(byId('smartcalc-tour-copy-print-section'), 'copy/print output section', 480, 360);

  await clickNextAndSettle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /ready to quote/i, 'print step should advance to the final ready-to-quote step');
  assertSpotlightCoversWholeArea(document.querySelector('header'), 'final header section', 480, 120);

  assert.equal(window.__smartCalcOpenCount, 0, 'tutorial should not auto-open print/copy side-effect windows');
  for (let guard = 0; guard < 40 && byId('smartcalc-tour-overlay').getAttribute('aria-hidden') === 'false'; guard += 1) {
    byId('smartcalc-tour-next').click();
    await settle();
  }
  assert.equal(byId('smartcalc-tour-overlay').getAttribute('aria-hidden'), 'true', 'final Next should close the tutorial');
  assert.equal(window.localStorage.getItem('fd_smartcalc_tutorial_completed_v1'), 'true', 'final Next should persist completion');

  window.localStorage.removeItem('fd_smartcalc_tutorial_completed_v1');
  window.dispatchEvent(new window.MessageEvent('message', {
    origin: 'https://evil.example',
    data: { type: 'FD_SMART_CALC_START_TUTORIAL' },
  }));
  await settle();
  assert.equal(byId('smartcalc-tour-overlay').getAttribute('aria-hidden'), 'true', 'wrong-origin postMessage must be ignored');

  window.dispatchEvent(new window.MessageEvent('message', {
    origin: 'https://furnituredistributors.wolf.discount',
    data: { type: 'FD_SMART_CALC_START_TUTORIAL' },
  }));
  await settle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /Welcome to Smart Calc/i, 'allowed-origin postMessage should start the tutorial');
  assertOnlyTutorialNavIsClickable();

  console.log('Smart Calc tutorial smoke PASS');
})();
