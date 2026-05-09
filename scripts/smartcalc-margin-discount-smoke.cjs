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

function setChecked(id, checked = true) {
  const element = byId(id);
  element.checked = checked;
  element.dispatchEvent(new window.Event('change', { bubbles: true }));
  return element;
}

function normalizedText(id) {
  return byId(id).textContent.replace(/\s+/g, ' ').trim();
}

(async () => {
  await waitForReady();
  assert.equal(jsErrors.length, 0, jsErrors.map((error) => error.message).join('\n'));

  setValue('vendor-select', 'A AMERICA', 'change');
  setValue('base-cost', '100'); // A AMERICA 20% freight -> $120 total cost
  setValue('retail-price', '500');
  assert.match(normalizedText('result-content'), /76\.00%/, 'baseline merchandise margin should be 76.00%');

  setChecked('add-delivery', true);
  setChecked('discount-delivery', true);
  assert.equal(byId('delivery-discount-amount').value, '169.99', 'local delivery discount should default to the selected local delivery charge');

  setChecked('add-pro1st', true);
  setChecked('discount-pro1st', true);
  assert.equal(byId('pro1st-discount-amount').value, '129.99', 'Pro1st discount should default to the selected Pro1st charge');

  const resultText = normalizedText('result-content');
  assert.match(resultText, /Discounts Used for GPM:\s*-\$299\.98/, 'delivery + Pro1st discounts must be included in the GPM discount basis');
  assert.match(resultText, /Selling Price for GPM:\s*\$200\.02/, 'GPM selling price should be merchandise total minus delivery and Pro1st discounts');
  assert.match(resultText, /Adjusted GPM:\s*40\.01%/, 'adjusted GPM should decrease after delivery and Pro1st discounts');

  console.log('Smart Calc margin discount smoke PASS');
})();
