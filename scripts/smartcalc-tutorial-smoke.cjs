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
    window.open = () => null;
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, writable: true, configurable: true });
    window.HTMLElement.prototype.scrollIntoView = () => {};
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
  return new Promise((resolve) => window.setTimeout(resolve, 25));
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

  setValue('vendor-select', 'ASHLEY', 'change');
  setValue('base-cost', '499');
  setValue('margin-percent', '45');
  startButton.click();
  await settle();
  let overlay = activeOverlay();
  assert.match(overlay.textContent, /Welcome to Smart Calc/i, 'first tutorial step should welcome the employee');
  assert.match(overlay.textContent, /BotBot says/i, 'tutorial copy should be presented as BotBot guidance');
  assert.equal(byId('base-cost').value, '499', 'starting the tutorial must not overwrite an in-progress quote');
  assert.equal(byId('margin-percent').value, '45', 'starting the tutorial must not overwrite an in-progress margin');
  assertSpotlightTracksTarget(document.querySelector('header'));

  byId('smartcalc-tour-spotlight').click();
  await settle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /starting point/i, 'clicking the safe highlighted area should advance to the second step');
  assert.ok(
    byId('smartcalc-tour-entry-mode').classList.contains('smartcalc-tour-target'),
    'entry-mode tour target should be highlighted on the matching step',
  );
  assertSpotlightTracksTarget(byId('smartcalc-tour-entry-mode'));

  byId('smartcalc-tour-next').click();
  await settle();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /vendor and base cost/i, 'third step should explain vendor and base cost');
  assert.ok(
    byId('base-cost-section').classList.contains('smartcalc-tour-target'),
    'base-cost tour target should be highlighted on the matching step',
  );
  assertSpotlightTracksTarget(byId('base-cost-section'));

  for (let guard = 0; guard < 10 && !/Pro1st protection/i.test(activeOverlay().textContent || ''); guard += 1) {
    byId('smartcalc-tour-next').click();
    await settle();
  }
  overlay = activeOverlay();
  assert.match(overlay.textContent, /Pro1st protection/i, 'tutorial should reach the Pro1st step');
  assert.ok(
    byId('add-pro1st').classList.contains('smartcalc-tour-target'),
    'hidden Pro1st option details should fall back to the visible Pro1st checkbox row',
  );
  assertSpotlightTracksTarget(byId('add-pro1st'));

  closeOverlay();
  assert.equal(window.localStorage.getItem('fd_smartcalc_tutorial_completed_v1'), null, 'skipping should not mark tutorial completed');

  startButton.click();
  await settle();
  for (let guard = 0; guard < 40 && byId('smartcalc-tour-done').classList.contains('hidden'); guard += 1) {
    byId('smartcalc-tour-next').click();
    await settle();
  }
  assert.equal(byId('smartcalc-tour-done').classList.contains('hidden'), false, 'tutorial should eventually show Done');
  byId('smartcalc-tour-done').click();
  assert.equal(byId('smartcalc-tour-overlay').getAttribute('aria-hidden'), 'true', 'Done should close the tutorial');
  assert.equal(window.localStorage.getItem('fd_smartcalc_tutorial_completed_v1'), 'true', 'Done should persist completion');

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

  console.log('Smart Calc tutorial smoke PASS');
})();
