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
  assert.match(normalizedText('result-content'), /Adjusted Ticket GPM:\s*76\.00%/, 'baseline adjusted ticket GPM should be 76.00%');

  setChecked('add-delivery', true);
  setChecked('discount-delivery', true);
  assert.equal(byId('delivery-discount-amount').value, '169.99', 'local delivery discount should default to the selected local delivery charge');
  setChecked('discount-delivery', false);

  setChecked('add-pro1st', true);
  let resultText = normalizedText('result-content');
  assert.match(resultText, /Pro1st Line:\s*\$129\.99/, 'Pro1st retail should be included as a ticket line');
  assert.match(resultText, /Pro1st Cost:\s*\$71\.94/, 'Pro1st 0-799.99 plan cost should be $71.94');
  assert.match(resultText, /Cost Basis:\s*\$191\.94/, 'cost basis should include merchandise cost plus Pro1st cost');
  assert.match(resultText, /Adjusted Ticket GPM:\s*69\.53%/, 'adding Pro1st should use line-item ticket margin math');

  setChecked('discount-delivery', true);
  setChecked('discount-pro1st', true);
  assert.equal(byId('pro1st-discount-amount').value, '129.99', 'Pro1st discount should default to the selected Pro1st charge');

  resultText = normalizedText('result-content');
  assert.match(resultText, /Selling Price Basis:\s*\$629\.99/, 'GPM selling basis should include Pro1st line price');
  assert.match(resultText, /Discounts Used for GPM:\s*-\$299\.98/, 'delivery + Pro1st discounts must be included in the GPM discount basis');
  assert.match(resultText, /Adjusted Selling Price:\s*\$330\.01/, 'adjusted selling price should subtract discounts from ticket selling basis');
  assert.match(resultText, /Cost Basis:\s*\$191\.94/, 'adjusted ticket cost basis should still include Pro1st plan cost');
  assert.match(resultText, /Adjusted Ticket GPM:\s*41\.84%/, 'adjusted ticket GPM should use line-item Pro1st math after discounts');

  setChecked('discount-delivery', false);
  setChecked('discount-pro1st', false);
  setValue('retail-price', '800');
  setChecked('add-pro1st', true);
  resultText = normalizedText('result-content');
  assert.match(resultText, /Pro1st Line:\s*\$169\.99/, '800+ merchandise should use the correct Pro1st retail tier');
  assert.match(resultText, /Pro1st Cost:\s*\$83\.94/, 'Pro1st 800+ plan cost should be $83.94');

  console.log('Smart Calc margin discount smoke PASS');
})();
