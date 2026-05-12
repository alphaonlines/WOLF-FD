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
  assert.match(resultText, /Adjusted Ticket GPM:\s*71\.44%/, 'adding Pro1st should use line-item ticket margin math with the 0-799.99 $59.95 cost tier');
  assert.doesNotMatch(resultText, /Merchandise Retail:|Pro1st Line:|Selling Price Basis:|Merchandise Cost:|Pro1st Cost:|Cost Basis:/, 'result box should not show detailed basis lines below adjusted ticket GPM');

  setChecked('discount-delivery', true);
  setChecked('discount-pro1st', true);
  assert.equal(byId('pro1st-discount-amount').value, '129.99', 'Pro1st discount should default to the selected Pro1st charge');

  resultText = normalizedText('result-content');
  assert.match(resultText, /Adjusted Ticket GPM:\s*45\.47%/, 'adjusted ticket GPM should use line-item Pro1st math after discounts');
  assert.doesNotMatch(resultText, /Discounts Used for GPM:|Adjusted Selling Price:|Selling Price Basis:|Cost Basis:/, 'result box should hide GPM basis detail lines after discounts');

  setChecked('discount-delivery', false);
  setChecked('discount-pro1st', false);
  setValue('retail-price', '800');
  setChecked('add-pro1st', true);
  resultText = normalizedText('result-content');
  assert.match(resultText, /Adjusted Ticket GPM:\s*80\.42%/, '800+ merchandise should use the correct Pro1st retail tier and $69.95 plan cost');
  assert.doesNotMatch(resultText, /Pro1st Line:|Pro1st Cost:|Cost Basis:/, '800+ result box should still hide detailed basis lines');

  setValue('pro1st-covered-items', 'Sofa only');
  setValue('pro1st-covered-value', '500');
  resultText = normalizedText('result-content');
  assert.match(resultText, /Adjusted Ticket GPM:\s*80\.65%/, 'covered dollar value should select the Pro1st retail/cost tier instead of full merchandise total');
  assert.match(normalizedText('pro1st-plan-retail-display'), /\$129\.99/, 'covered value 500 should show the 500-799.99 Pro1st retail charge');
  assert.match(byId('sales-order-notes').value, /Pro1st Coverage: Sofa only; Covered Value: \$500\.00; Plan Charge: \$129\.99\./, 'coverage item/value should appear in sales order notes');

  setValue('pro1st-plan-type', 'power-base', 'change');
  setValue('pro1st-power-base-quantity', '2');
  resultText = normalizedText('result-content');
  assert.match(resultText, /Adjusted Ticket GPM:\s*83\.28%/, 'two power bases should use $149.99 retail and $31.95 cost per base');
  assert.match(normalizedText('pro1st-plan-retail-display'), /\$299\.98/, 'two power bases should show $299.98 retail charge');
  assert.match(normalizedText('pro1st-plan-cost-display'), /\$63\.90/, 'two power bases should show $63.90 plan cost');
  assert.match(byId('sales-order-notes').value, /Power Bases: 2 @ \$149\.99 = \$299\.98\./, 'power base quantity should appear in sales order notes');

  console.log('Smart Calc margin discount smoke PASS');
})();
