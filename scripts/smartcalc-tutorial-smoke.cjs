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

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html',
  virtualConsole,
  beforeParse(window) {
    window.tailwind = {};
    window.alert = () => {};
    window.open = () => null;
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.classList?.contains('hidden')) {
        return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0 };
      }
      return { top: 0, right: 240, bottom: 48, left: 0, width: 240, height: 48, x: 0, y: 0 };
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

(async () => {
  await waitForReady();
  assert.equal(jsErrors.length, 0, jsErrors.map((error) => error.message).join('\n'));

  assert.match(pageSource, /FD_SMART_CALC_START_TUTORIAL/, 'React wrapper should send the tutorial start postMessage');
  assert.match(pageSource, /Start guided tutorial|Restart tutorial/, 'React wrapper should expose a tutorial toolbar action');

  assert.equal(window.localStorage.getItem('fd_smartcalc_tutorial_completed_v1'), null, 'completion flag should start empty');
  assert.equal(byId('smartcalc-tour-overlay').getAttribute('aria-hidden'), 'true', 'tutorial overlay should be hidden by default');

  const startButton = byId('smartcalc-tutorial-btn');
  assert.match(startButton.textContent, /tutorial/i, 'standalone calculator should expose a tutorial start button');

  setValue('base-cost', '499');
  startButton.click();
  let overlay = activeOverlay();
  assert.match(overlay.textContent, /Welcome to Smart Calc/i, 'first tutorial step should welcome the employee');
  assert.equal(byId('base-cost').value, '499', 'starting the tutorial must not overwrite an in-progress quote');

  byId('smartcalc-tour-next').click();
  overlay = activeOverlay();
  assert.match(overlay.textContent, /starting point/i, 'second step should explain the starting point choice');
  assert.ok(
    byId('smartcalc-tour-entry-mode').classList.contains('smartcalc-tour-target'),
    'entry-mode tour target should be highlighted on the matching step',
  );

  closeOverlay();
  assert.equal(window.localStorage.getItem('fd_smartcalc_tutorial_completed_v1'), null, 'skipping should not mark tutorial completed');

  startButton.click();
  for (let guard = 0; guard < 40 && byId('smartcalc-tour-done').classList.contains('hidden'); guard += 1) {
    byId('smartcalc-tour-next').click();
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
  assert.equal(byId('smartcalc-tour-overlay').getAttribute('aria-hidden'), 'true', 'wrong-origin postMessage must be ignored');

  window.dispatchEvent(new window.MessageEvent('message', {
    origin: 'https://furnituredistributors.wolf.discount',
    data: { type: 'FD_SMART_CALC_START_TUTORIAL' },
  }));
  overlay = activeOverlay();
  assert.match(overlay.textContent, /Welcome to Smart Calc/i, 'allowed-origin postMessage should start the tutorial');

  console.log('Smart Calc tutorial smoke PASS');
})();
