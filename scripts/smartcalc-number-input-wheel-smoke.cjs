const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const htmlPath = path.resolve(__dirname, '../public/tools/smart-pricing-calculator.html');
const html = readFileSync(htmlPath, 'utf8');
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

function assertWheelIsBlocked(id, value) {
  const element = setValue(id, value);
  element.focus();
  assert.equal(document.activeElement, element, `#${id} should be focused before wheel test`);

  const event = typeof window.WheelEvent === 'function'
    ? new window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 })
    : new window.Event('wheel', { bubbles: true, cancelable: true });
  const dispatchResult = element.dispatchEvent(event);

  assert.equal(dispatchResult, false, `wheel on #${id} should be canceled`);
  assert.equal(event.defaultPrevented, true, `wheel on #${id} should prevent default value changes`);
  assert.equal(element.value, value, `wheel on #${id} should not change the typed value`);
}

(async () => {
  await waitForReady();
  assert.equal(jsErrors.length, 0, jsErrors.map((error) => error.message).join('\n'));

  setValue('vendor-select', 'A AMERICA', 'change');
  setValue('base-cost', '100');

  assertWheelIsBlocked('retail-price', '500');
  assertWheelIsBlocked('delivery-discount-amount', '169.99');
  assertWheelIsBlocked('pro1st-discount-amount', '129.99');
  assertWheelIsBlocked('manager-approval-amount', '25');

  console.log('Smart Calc number input wheel smoke PASS');
})();
