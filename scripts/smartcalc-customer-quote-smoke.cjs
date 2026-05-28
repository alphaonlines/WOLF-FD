const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const htmlPath = path.resolve(__dirname, '../public/tools/smart-pricing-calculator.html');
const html = readFileSync(htmlPath, 'utf8');
const jsErrors = [];
const alerts = [];
const fetchCalls = [];
const openedWindows = [];
const events = [];
let fetchMode = 'success';

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  if (!String(error?.message || '').includes('Could not load')) jsErrors.push(error);
});
virtualConsole.on('error', (message) => jsErrors.push(new Error(String(message))));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://wolf.discount/fd/tools/smart-pricing-calculator.html',
  virtualConsole,
  beforeParse(window) {
    window.tailwind = {};
    window.alert = (message) => alerts.push(String(message));
    window.fetch = async (url, init = {}) => {
      events.push('fetch-start');
      const parsedBody = init.body ? JSON.parse(init.body) : null;
      fetchCalls.push({ url: String(url), init, body: parsedBody });
      if (fetchMode === 'failure') {
        events.push('fetch-failure');
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'smoke failure' }),
          text: async () => 'smoke failure',
        };
      }
      events.push('fetch-resolve');
      return {
        ok: true,
        status: 201,
        json: async () => ({
          quote: {
            id: 'quote-smoke-123',
            customer_id: 'crm-smoke-42',
            quote_total: parsedBody?.quote?.quote_total,
            quote_valid_until: parsedBody?.quote?.quote_valid_until,
          },
          customer: {
            id: 'crm-smoke-42',
            name: `${parsedBody?.customer?.first_name || ''} ${parsedBody?.customer?.last_name || ''}`.trim(),
            phone: parsedBody?.customer?.phone || '',
            email: parsedBody?.customer?.email || '',
          },
          matches: { salesOrders: [], upsVisits: [] },
        }),
      };
    };
    window.open = (url, target, features) => {
      events.push('window-open');
      const writes = [];
      const popup = {
        document: {
          open() {},
          write(markup) { writes.push(String(markup)); },
          close() {},
        },
        focus() { events.push('focus'); },
        print() { events.push('print'); },
        addEventListener(type, callback) {
          if (type === 'load') window.setTimeout(callback, 0);
        },
        __writes: writes,
        __features: features,
        __target: target,
        __url: url,
      };
      openedWindows.push(popup);
      return popup;
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

function tick(ms = 25) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function click(id) {
  byId(id).click();
}

function visible(element) {
  return !element.classList.contains('hidden') && element.getAttribute('aria-hidden') !== 'true';
}

function latestPrintHtml() {
  const popup = openedWindows.at(-1);
  assert.ok(popup, 'expected a print popup to be opened');
  return popup.__writes.join('\n');
}

function clearSideEffects() {
  alerts.length = 0;
  fetchCalls.length = 0;
  openedWindows.length = 0;
  events.length = 0;
}

(async () => {
  await waitForReady();
  assert.equal(jsErrors.length, 0, jsErrors.map((error) => error.message).join('\n'));

  const modal = byId('smartcalc-customer-modal');
  byId('smartcalc-customer-first-name');
  byId('smartcalc-customer-last-name');
  byId('smartcalc-customer-phone');
  byId('smartcalc-customer-email');
  byId('smartcalc-customer-save-print');
  byId('smartcalc-customer-cancel');
  byId('smartcalc-customer-print-without-save');
  byId('smartcalc-customer-status');

  click('reset-btn');
  assert.deepEqual(alerts, ['Enter a selling price before printing a customer copy.']);
  assert.equal(fetchCalls.length, 0, 'empty quote must not call quote API');
  assert.equal(openedWindows.length, 0, 'empty quote must not open print window');

  clearSideEffects();
  setValue('vendor-select', 'A AMERICA', 'change');
  setValue('base-cost', '100');
  setValue('retail-price', '500');
  setValue('quote-valid-days', '3');
  setValue('sales-order-notes', 'Smoke quote notes');

  click('reset-btn');
  assert.ok(visible(modal), 'valid customer copy click should open customer capture modal');
  assert.equal(fetchCalls.length, 0, 'opening modal should not save until customer submits');
  assert.equal(openedWindows.length, 0, 'opening modal should not print until customer submits');

  setValue('smartcalc-customer-first-name', 'Jane');
  setValue('smartcalc-customer-last-name', 'Buyer');
  click('smartcalc-customer-save-print');
  await tick();
  assert.equal(fetchCalls.length, 0, 'missing phone/email should block save');
  assert.match(byId('smartcalc-customer-status').textContent, /phone or email/i);

  setValue('smartcalc-customer-phone', '(864) 555-1212');
  setValue('smartcalc-customer-email', 'JANE@EXAMPLE.COM');
  click('smartcalc-customer-save-print');
  await tick(50);

  assert.equal(fetchCalls.length, 1, 'valid customer should save one quote');
  assert.equal(fetchCalls[0].url, '/fd/api/api/crm/quotes');
  assert.equal(fetchCalls[0].init.method, 'POST');
  assert.equal(fetchCalls[0].init.credentials, 'include');
  assert.equal(fetchCalls[0].body.customer.first_name, 'Jane');
  assert.equal(fetchCalls[0].body.customer.last_name, 'Buyer');
  assert.equal(fetchCalls[0].body.customer.phone, '(864) 555-1212');
  assert.equal(fetchCalls[0].body.customer.email, 'JANE@EXAMPLE.COM');
  assert.equal(fetchCalls[0].body.quote.store, 'FD7');
  assert.equal(fetchCalls[0].body.quote.source_context, 'shop-smart-calc');
  assert.equal(fetchCalls[0].body.quote.quote_valid_days, 3);
  assert.ok(fetchCalls[0].body.quote.quote_total > 0, 'quote_total should be populated');
  assert.ok(fetchCalls[0].body.quote.subtotal_before_tax > 0, 'subtotal_before_tax should be populated');
  assert.ok(fetchCalls[0].body.quote.quote_snapshot?.charges?.length > 0, 'quote_snapshot should include charge rows');

  assert.ok(events.indexOf('fetch-resolve') > -1, 'successful save should resolve');
  assert.ok(events.indexOf('window-open') > events.indexOf('fetch-resolve'), 'print window should open after save succeeds');
  const savedPrintHtml = latestPrintHtml();
  assert.match(savedPrintHtml, /Quote ID:\s*quote-smoke-123/);
  assert.match(savedPrintHtml, /Jane Buyer/);
  assert.match(savedPrintHtml, /864\) 555-1212|8645551212/);
  assert.match(savedPrintHtml, /JANE@EXAMPLE\.COM/i);
  assert.match(savedPrintHtml, /Quote valid through/);
  assert.match(savedPrintHtml, /Smoke quote notes/);

  clearSideEffects();
  fetchMode = 'failure';
  click('reset-btn');
  setValue('smartcalc-customer-first-name', 'Failed');
  setValue('smartcalc-customer-last-name', 'Save');
  setValue('smartcalc-customer-phone', '864-555-9999');
  setValue('smartcalc-customer-email', 'failed@example.com');
  click('smartcalc-customer-save-print');
  await tick(50);

  assert.equal(fetchCalls.length, 1, 'failure scenario should attempt one save');
  assert.equal(openedWindows.length, 0, 'failed save must not auto-print');
  assert.ok(!byId('smartcalc-customer-print-without-save').classList.contains('hidden'), 'fallback print button should appear after save failure');
  assert.match(byId('smartcalc-customer-status').textContent, /could not save|print without saving/i);

  click('smartcalc-customer-print-without-save');
  await tick(25);
  const fallbackPrintHtml = latestPrintHtml();
  assert.match(fallbackPrintHtml, /Quote ID:\s*Not saved to CRM/);
  assert.match(fallbackPrintHtml, /Failed Save/);

  console.log('Smart Calc customer quote smoke PASS');
})();
