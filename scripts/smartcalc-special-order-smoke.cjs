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

  // Establish a normal quote so totals/notes are active.
  setValue('vendor-select', 'A AMERICA', 'change');
  setValue('base-cost', '100');
  setValue('retail-price', '500');
  const grandTotalBeforeSpecialOrder = normalizedText('grand-total-display');
  assert.equal(grandTotalBeforeSpecialOrder, '$535.00', 'baseline quote should total $535.00 with 7% tax');

  assert.match(document.querySelector('label[for="add-special-order"]')?.textContent || '', /Special Order/i, 'Special Order checkbox label should exist');
  assert.ok(byId('special-order-wrapper').classList.contains('hidden'), 'special order detail fields should start hidden');

  setChecked('add-special-order', true);
  assert.ok(!byId('special-order-wrapper').classList.contains('hidden'), 'checking Special Order should reveal detail fields');
  assert.match(document.querySelector('label[for="special-order-models"]')?.textContent || '', /Model\(s\)/i, 'Special Order Model(s) label should exist');
  assert.equal(byId('special-order-models').value, '', 'Special Order Model(s) should be optional and start blank');
  assert.equal(byId('special-order-eta').value, '4-6 Weeks', 'Special Order ETA should default to 4-6 Weeks when selected');

  setValue('special-order-description', 'Vendor Special Order', 'change');
  setValue('special-order-models', 'B743-31, B743-36');
  assert.match(byId('sales-order-notes').value, /Special Order: Vendor Special Order; Model\(s\): B743-31, B743-36; ETA: 4-6 Weeks\./, 'sales notes should include optional models and default special order ETA');
  assert.equal(normalizedText('grand-total-display'), grandTotalBeforeSpecialOrder, 'special order details must not change quote total');

  setValue('special-order-eta', '8-10 Weeks');
  assert.match(byId('sales-order-notes').value, /Special Order: Vendor Special Order; Model\(s\): B743-31, B743-36; ETA: 8-10 Weeks\./, 'sales notes should use edited special order ETA with models');
  assert.equal(normalizedText('grand-total-display'), grandTotalBeforeSpecialOrder, 'editing special order ETA/models must not change quote total');

  setValue('special-order-models', '');
  assert.match(byId('sales-order-notes').value, /Special Order: Vendor Special Order; ETA: 8-10 Weeks\./, 'blank special order models should be omitted from sales notes');
  assert.doesNotMatch(byId('sales-order-notes').value, /Model\(s\):\s*;/, 'blank special order models should not leave an empty label in sales notes');

  setValue('special-order-description', '', 'change');
  setValue('special-order-eta', '');
  assert.match(byId('sales-order-notes').value, /Special Order: \[description needed\]; ETA: \[ETA needed\]\./, 'missing special order fields should show clear note placeholders while optional models stay omitted');

  setValue('special-order-description', 'Vendor Special Order', 'change');
  setValue('special-order-models', 'B743-31, B743-36');
  setValue('special-order-eta', '4-6 Weeks');
  byId('top-reset-btn').click();
  assert.equal(byId('add-special-order').checked, false, 'reset should uncheck Special Order');
  assert.ok(byId('special-order-wrapper').classList.contains('hidden'), 'reset should hide Special Order fields');
  assert.equal(byId('special-order-description').value, '', 'reset should clear Special Order description');
  assert.equal(byId('special-order-models').value, '', 'reset should clear Special Order models');
  assert.equal(byId('special-order-eta').value, '', 'reset should clear Special Order ETA');

  assert.match(html, /special_order/, 'quote payload should include a special_order snapshot field');
  assert.match(html, /models:\s*\(allElements\.specialOrderModelsInput\?\.value \|\| ''\)\.trim\(\)/, 'quote payload details should include Special Order models');
  assert.match(html, /special-order-models/, 'Smart Calc source should include Special Order Model(s) input');
  assert.match(html, /Special Order:/, 'print/order details code should include Special Order output');
  assert.doesNotMatch(document.body.textContent, /Competitor Pricing/i, 'Smart Calc UI should not include Competitor Pricing module copy');

  console.log('Smart Calc special order smoke PASS');
})();
