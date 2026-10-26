// Wyłącznie ręczny test zewnętrznej usługi. Nigdy nie jest częścią npm test / CI.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startBrowser } from '../tests/browser-harness.mjs';
import { calculatePortion } from '../nutrition.js';

const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const target = value('--url');
const reportPath = value('--report') ?? '/tmp/benger-off-live-report.json';
if (!target && !args.includes('--local')) throw new Error('Użycie: node scripts/off-live-test.mjs --url https://…/ [--report /tmp/raport.json] lub --local');
if (target && !['http:', 'https:'].includes(new URL(target).protocol)) throw new Error('Adres musi być HTTP(S).');
const report = { checkedAt: new Date().toISOString(), target: target ?? 'local preview', mocked: false, steps: [], passed: false };
let browser;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(page, expression, limit = 15000) {
  const deadline = Date.now() + limit;
  do { if (await page.evaluate(expression)) return; await pause(50); } while (Date.now() < deadline);
  throw new Error(`Nie spełniono warunku: ${expression}`);
}
async function step(name, operation) {
  try { const details = await operation(); report.steps.push({ name, passed: true, ...details }); }
  catch (error) { report.steps.push({ name, passed: false, error: error.message }); }
}
try {
  // Respektuje proxy środowiska; nie usuwa ograniczeń sieci ani weryfikacji TLS.
  browser = await startBrowser({ staticPrefix: '/Benger/previews/etap-7/', previewBuild: true, respectProxy: true });
  const page = await browser.page(target ?? browser.base);
  let selected;
  await step('live search: mleko 2%', async () => {
    await page.evaluate("document.getElementById('product-search').value='mleko 2%';document.getElementById('product-search-form').requestSubmit()");
    await waitFor(page, "document.getElementById('search-results').getAttribute('aria-busy')==='false'");
    const id = await page.evaluate("[...document.querySelectorAll('#search-results [data-product-id]')].find(button=>button.dataset.productId.startsWith('off:'))?.dataset.productId");
    assert.ok(id, await page.evaluate("document.getElementById('catalog-message').textContent"));
    selected = await page.evaluate(`(async()=>{const {createProductCache}=await import('./product-cache.js');const cache=createProductCache();const record=await cache.getProduct(${JSON.stringify(id)});await cache.close();return record.product;})()`);
    assert.ok(selected.brand, 'Wybrany produkt musi mieć markę do weryfikacji.');
    await page.evaluate(`[...document.querySelectorAll('#search-results [data-product-id]')].find(button=>button.dataset.productId===${JSON.stringify(id)}).click()`);
    if (selected.imageUrl) await waitFor(page, "document.querySelector('#product img')?.naturalWidth > 0");
    return { product: selected };
  });
  if (selected) {
    await step('porcja, zapis, podsumowanie, reload, ostatnie i ulubione', async () => {
      await page.evaluate("document.getElementById('amount').value='200';document.getElementById('amount').dispatchEvent(new Event('input'))");
      await page.submit();
      const saved = await page.saved(); assert.equal(saved.length, 1);
      const expected = calculatePortion(selected, 200);
      assert.deepEqual(saved[0].nutrition, expected);
      const format = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
      assert.deepEqual(await page.outputs('total'), Object.values(expected).map(number => format.format(number)));
      await waitFor(page, "Boolean(document.querySelector('#recent-products [data-product-id]'))");
      await page.reload(); assert.equal((await page.visible()).length, 1);
      await page.evaluate("document.querySelector('#recent-products .favorite-product').click()");
      await waitFor(page, "Boolean(document.querySelector('#favorite-products [data-product-id]'))");
      await page.reload(); assert.equal(await page.evaluate("document.querySelectorAll('#favorite-products [data-product-id]').length"), 1);
      return { nutrition: expected, amount: 200, unit: selected.unit };
    });
  }
  await step('live barcode: 3017620422003 (Nutella)', async () => {
    await page.evaluate("document.querySelector('.barcode-lookup').open=true;document.getElementById('barcode').value='3017620422003';document.getElementById('barcode-form').requestSubmit()");
    await waitFor(page, "document.getElementById('search-results').getAttribute('aria-busy')==='false'");
    const product = await page.evaluate("(async()=>{const {createProductCache}=await import('./product-cache.js');const cache=createProductCache();const product=(await cache.allProducts()).find(product=>product.barcode==='3017620422003');await cache.close();return product;})()");
    assert.ok(product, await page.evaluate("document.getElementById('catalog-message').textContent"));
    assert.ok(product.brand);
    await page.evaluate(`[...document.querySelectorAll('#search-results [data-product-id]')].find(button=>button.dataset.productId===${JSON.stringify(product.id)}).click()`);
    if (product.imageUrl) await waitFor(page, "document.querySelector('#product img')?.naturalWidth > 0");
    return { product };
  });
  if (selected) await step('offline: cache, ostatnie, ulubione, dziennik', async () => {
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await waitFor(page, 'navigator.onLine===false');
    await page.evaluate("document.querySelector('#favorite-products [data-product-id]').click();document.getElementById('product-search').value='mleko';document.getElementById('product-search-form').requestSubmit()");
    await waitFor(page, "document.getElementById('search-results').getAttribute('aria-busy')==='false'");
    assert.match(await page.evaluate("document.getElementById('catalog-message').textContent"), /Brak połączenia/);
    assert.equal((await page.visible()).length, 1);
    assert.ok(await page.evaluate("Boolean(document.querySelector('#recent-products [data-product-id]')) && Boolean(document.querySelector('#favorite-products [data-product-id]'))"));
    return { available: true };
  });
  report.passed = report.steps.length === 4 && report.steps.every(item => item.passed)
    && browser.errors.length === 0 && browser.failures.filter(item => !item.canceled).length === 0;
} catch (error) { report.error = error.message; }
finally {
  if (browser) {
    report.http = browser.responses.filter(response => /^https?:/.test(response.url)); report.consoleErrors = browser.errors;
    report.networkFailures = browser.failures;
    await browser.close();
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, report: reportPath, steps: report.steps.map(({ name, passed }) => ({ name, passed })), error: report.error }));
  if (!report.passed) process.exitCode = 1;
}
