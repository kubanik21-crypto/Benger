import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const DAY = '2026-10-22';
const OTHER_DAY = '2026-10-23';
const KEY = 'benger.nutrition.v1';
const NOTE_KEY = 'benger.meals.v1';

async function startBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'benger-browser-test-'));
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const processes = [];
  let socket;
  const errors = [];
  const requests = [];
  const pending = new Map();
  async function close() {
    if (socket) socket.close();
    for (const request of pending.values()) clearTimeout(request.timer);
    pending.clear();
    for (const child of processes.reverse()) {
      if (child.exitCode !== null) continue;
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await Promise.race([exited, pause(2000)]);
      if (child.exitCode === null) { child.kill('SIGKILL'); await exited; }
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  try {
    const app = spawn(process.execPath, ['server.js'], {
      cwd: import.meta.dirname, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    processes.push(app);
    let serverErrors = '';
    app.stderr.on('data', data => { serverErrors += data; });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(base)).status === 200) { ready = true; break; } } catch {}
      await pause(100);
    }
    assert.ok(ready, `Serwer nie wystartował: ${serverErrors}`);
    const chrome = spawn(process.env.CHROMIUM_PATH || 'chromium', [
      '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
      '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    processes.push(chrome);
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Chromium timeout: ${output}`)), 15000);
      chrome.on('error', error => { clearTimeout(timer); reject(error); });
      chrome.on('exit', code => { clearTimeout(timer); reject(new Error(`Chromium zakończył pracę: ${code}`)); });
      chrome.stderr.on('data', data => {
        output += data;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let nextId = 0;
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
      if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
      const request = pending.get(message.id);
      if (request) {
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
    };
    function command(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
    async function page() {
      const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
      const send = (method, params) => command(method, params, sessionId);
      async function evaluate(expression) {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      }
      for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await send(`${domain}.enable`);
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `
        window.__documentId = crypto.randomUUID();
        window.__pauseStorageSync = false;
        window.addEventListener('storage', event => { if (window.__pauseStorageSync) event.stopImmediatePropagation(); }, true);
        window.confirm = () => true;
        window.SpeechRecognition = class {
          start() { this.onstart?.(); this.onresult?.({ results: [[{ transcript: 'Podyktowana notatka' }]] }); this.onend?.(); }
          stop() { this.onend?.(); }
        };
      ` });
      async function waitReady(previous) {
        for (let i = 0; i < 100; i++) {
          try {
            if (await evaluate(`window.__documentId !== ${JSON.stringify(previous)} && document.getElementById('nutrition-meal')?.options.length === 4 && Boolean(document.getElementById('date')?.value) && document.getElementById('entries').textContent !== ''`)) return;
          } catch {}
          await pause(100);
        }
        throw new Error('Aplikacja nie zakończyła inicjalizacji.');
      }
      async function reload() {
        const previous = await evaluate('window.__documentId');
        await send('Page.reload');
        await waitReady(previous);
      }
      async function date(value) {
        await evaluate(`document.getElementById('date').value = ${JSON.stringify(value)}; document.getElementById('date').dispatchEvent(new Event('change'));`);
      }
      async function choose(product, amount, meal = 'breakfast') {
        await evaluate(`document.getElementById('product').value = ${JSON.stringify(product)}; document.getElementById('product').dispatchEvent(new Event('change')); document.getElementById('amount').value = ${JSON.stringify(amount)}; document.getElementById('amount').dispatchEvent(new Event('input')); document.getElementById('nutrition-meal').value = ${JSON.stringify(meal)};`);
      }
      const submit = () => evaluate("document.getElementById('nutrition-form').requestSubmit()");
      const raw = key => evaluate(`localStorage.getItem(${JSON.stringify(key)})`);
      const setRaw = (key, value) => evaluate(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
      const saved = async () => JSON.parse(await raw(KEY) || '[]');
      const visible = () => evaluate("[...document.querySelectorAll('#nutrition-entries article')].map(article => ({ id: article.dataset.entryId, text: article.textContent }))");
      const outputs = prefix => evaluate(`['kcal', 'protein', 'fat', 'carbs'].map(key => document.getElementById(${JSON.stringify(prefix)} + '-' + key).textContent)`);
      const remove = id => evaluate(`[...document.querySelectorAll('#nutrition-entries article')].find(article => article.dataset.entryId === ${JSON.stringify(id)}).querySelector('button').click()`);
      await send('Page.navigate', { url: base });
      await waitReady(null);
      return { send, evaluate, reload, date, choose, submit, raw, setRaw, saved, visible, outputs, remove };
    }
    return { base, page, errors, requests, close, serverErrors: () => serverErrors };
  } catch (error) { await close(); throw error; }
}

async function waitCount(page, count) {
  for (let i = 0; i < 100; i++) {
    if ((await page.visible()).length === count) return;
    await pause(50);
  }
  assert.fail(`Oczekiwano ${count} wpisów w karcie.`);
}

function contrast(foreground, background) {
  const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
      value /= 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('Etap 1 w Chromium', { timeout: 120000 }, async t => {
  const browser = await startBrowser();
  t.after(() => browser.close());
  const a = await browser.page();
  await a.date(DAY);

  await t.test('strona i moduły są dostępne, katalog pochodzi z PRODUCTS', async () => {
    for (const path of ['/', '/app.js', '/nutrition.js', '/legacy.js', '/style.css', '/manifest.webmanifest']) {
      assert.equal((await fetch(browser.base + path)).status, 200, path);
    }
    assert.equal((await fetch(browser.base + '/missing')).status, 404);
    assert.deepEqual(await a.evaluate("[...document.getElementById('product').options].map(option => option.textContent)"), ['Płatki owsiane', 'Banan bez skórki', 'Jogurt naturalny', 'Mleko 2%']);
  });
  await t.test('podgląd: 50 g płatków, 120 g banana, 200 ml mleka i 50,5 g', async () => {
    for (const [product, amount, unit, expected] of [
      ['oat-flakes', '50', 'g', ['185', '6,5', '3,5', '30']],
      ['peeled-banana', '120', 'g', ['106,8', '1,32', '0,36', '27,36']],
      ['milk-2-percent', '200', 'ml', ['100', '6,8', '4', '9,6']],
      ['oat-flakes', '50,5', 'g', ['186,85', '6,57', '3,54', '30,3']],
    ]) {
      await a.choose(product, amount);
      assert.deepEqual(await a.outputs('portion'), expected);
      assert.equal(await a.evaluate("document.getElementById('amount-unit').textContent"), unit);
      assert.equal(await a.evaluate("document.getElementById('portion-preview').hidden"), false);
    }
  });
  await t.test('pusta ilość, zero, liczby ujemne i nieprawidłowe formaty są odrzucane', async () => {
    for (const amount of ['', '0', '-5', 'abc', '--5', '5,5,5', 'Infinity', '1e3', '0x10']) {
      await a.choose('oat-flakes', amount);
      await a.submit();
      assert.equal((await a.saved()).length, 0);
      assert.equal(await a.evaluate("document.getElementById('portion-preview').hidden"), true);
      assert.equal(await a.evaluate("document.getElementById('amount').getAttribute('aria-invalid')"), 'true');
      assert.ok(await a.evaluate("document.getElementById('amount-error').textContent"));
    }
  });
  await t.test('brak daty oznacza błąd przy polu, fokus i brak zapisu', async () => {
    await a.date(''); await a.choose('oat-flakes', '50'); await a.submit();
    assert.equal(await a.evaluate('document.activeElement.id'), 'date');
    assert.equal(await a.evaluate("document.getElementById('date').getAttribute('aria-invalid')"), 'true');
    assert.ok(await a.evaluate("document.getElementById('date-error').textContent"));
    assert.equal((await a.saved()).length, 0);
    assert.equal(await a.evaluate("document.getElementById('day-summary').hidden"), true);
    await a.date(DAY);
    assert.deepEqual(await a.outputs('total'), ['0', '0', '0', '0']);
  });
  await t.test('dodawanie do czterech posiłków, snapshot danych i suma dnia', async () => {
    for (const [product, amount, meal] of [['oat-flakes', '50', 'breakfast'], ['peeled-banana', '120', 'lunch'], ['milk-2-percent', '200', 'dinner'], ['natural-yogurt', '100', 'snack']]) {
      await a.choose(product, amount, meal); await a.submit();
      assert.equal(await a.evaluate("document.getElementById('amount').value"), '');
      assert.equal(await a.evaluate('document.activeElement.id'), 'amount');
      assert.ok(await a.evaluate("document.getElementById('calculator-message').textContent.includes('Dodano:')"));
    }
    assert.equal((await a.visible()).length, 4);
    assert.deepEqual(await a.evaluate("[...document.querySelectorAll('.meal-group')].map(group => group.dataset.meal)"), ['breakfast', 'lunch', 'dinner', 'snack']);
    assert.deepEqual(await a.outputs('total'), ['451,8', '18,62', '9,86', '72,96']);
    const entry = (await a.saved())[0];
    assert.deepEqual(Object.keys(entry).sort(), ['id', 'date', 'createdAt', 'meal', 'productId', 'productName', 'amount', 'unit', 'nutrition'].sort());
    assert.equal(new Date(entry.createdAt).toISOString(), entry.createdAt);
    assert.match(entry.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.deepEqual(entry.nutrition, { kcal: 185, protein: 6.5, fat: 3.5, carbs: 30 });
    if (process.env.BENGER_SCREENSHOT_PATH) {
      const { data } = await a.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(process.env.BENGER_SCREENSHOT_PATH, Buffer.from(data, 'base64'));
    }
  });
  await t.test('dwa dni i przełączanie dat nie mieszają wpisów ani sum', async () => {
    await a.date(OTHER_DAY); assert.equal((await a.visible()).length, 0);
    await a.choose('oat-flakes', '100', 'lunch'); await a.submit();
    assert.deepEqual(await a.outputs('total'), ['370', '13', '7', '60']);
    await a.date(DAY); assert.equal((await a.visible()).length, 4);
    assert.deepEqual(await a.outputs('total'), ['451,8', '18,62', '9,86', '72,96']);
  });
  await t.test('usunięcie jednego wpisu aktualizuje listę, pamięć i sumę', async () => {
    const banana = (await a.saved()).find(entry => entry.productId === 'peeled-banana');
    await a.remove(banana.id);
    assert.equal((await a.visible()).length, 3);
    assert.ok(!(await a.saved()).some(entry => entry.id === banana.id));
    assert.deepEqual(await a.outputs('total'), ['345', '17,3', '9,5', '45,6']);
    assert.equal((await a.saved()).filter(entry => entry.date === OTHER_DAY).length, 1);
  });
  await t.test('odświeżenie zachowuje produkty i podsumowanie', async () => {
    const before = await a.raw(KEY); await a.reload(); await a.date(DAY);
    assert.equal(await a.raw(KEY), before); assert.equal((await a.visible()).length, 3);
    assert.deepEqual(await a.outputs('total'), ['345', '17,3', '9,5', '45,6']);
  });
  await t.test('ilość z przecinkiem zapisuje liczby bez zaokrąglania', async () => {
    await a.choose('oat-flakes', '50,5', 'lunch'); await a.submit();
    const entry = (await a.saved()).at(-1);
    assert.equal(entry.amount, 50.5); assert.ok(Math.abs(entry.nutrition.protein - 6.565) < 1e-12);
    assert.ok((await a.visible()).find(item => item.id === entry.id).text.includes('6,57 g'));
  });
  await t.test('zmiana katalogu w pamięci nie przelicza historii', async () => {
    const before = await a.raw(KEY), totals = await a.outputs('total');
    await a.evaluate("(async () => { const module = await import('./nutrition.js'); const old = module.PRODUCTS[0].per100.kcal; module.PRODUCTS[0].per100.kcal = 9999; document.getElementById('date').dispatchEvent(new Event('change')); module.PRODUCTS[0].per100.kcal = old; })()");
    assert.equal(await a.raw(KEY), before); assert.deepEqual(await a.outputs('total'), totals);
  });
  await t.test('dwie karty zachowują kolejne zapisy i synchronizują widoki', async () => {
    await a.evaluate(`localStorage.removeItem('${KEY}')`); await a.reload(); await a.date(DAY);
    const b = await browser.page(); await b.date(DAY);
    await a.choose('oat-flakes', '50'); await a.submit(); await waitCount(b, 1);
    await b.choose('milk-2-percent', '200', 'dinner'); await b.submit();
    await waitCount(a, 2); await waitCount(b, 2);
    assert.deepEqual((await a.saved()).map(entry => entry.productId), ['oat-flakes', 'milk-2-percent']);
    assert.deepEqual(await a.outputs('total'), ['285', '13,3', '7,5', '39,6']);
    await b.evaluate('window.__pauseStorageSync = true');
    await a.choose('peeled-banana', '120', 'snack'); await a.submit();
    assert.equal((await b.visible()).length, 2);
    const milk = (await b.saved()).find(entry => entry.productId === 'milk-2-percent');
    await b.remove(milk.id);
    assert.deepEqual((await b.saved()).map(entry => entry.productId), ['oat-flakes', 'peeled-banana']);
    await waitCount(a, 2);
    await b.evaluate('window.__pauseStorageSync = false');
  });
  const legacy = [{ id: 'old-note', date: DAY, meal: 'Śniadanie', text: 'Zachowana notatka' }];
  await t.test('uszkodzony JSON, niepełne wpisy i duplikaty ID nie są nadpisywane', async () => {
    const good = await a.raw(KEY);
    await a.setRaw(NOTE_KEY, JSON.stringify(legacy));
    const record = (await a.saved())[0];
    for (const raw of ['{broken', '[{"id":"broken"}]', JSON.stringify([record, record])]) {
      await a.setRaw(KEY, raw); await a.reload(); await a.date(DAY);
      assert.equal(await a.raw(KEY), raw);
      assert.equal(await a.evaluate("document.getElementById('add-nutrition').disabled"), true);
      assert.equal(await a.evaluate("document.getElementById('day-summary').hidden"), true);
      assert.equal(await a.raw(NOTE_KEY), JSON.stringify(legacy));
      assert.ok(await a.evaluate("document.getElementById('nutrition-storage-message').textContent"));
    }
    await a.setRaw(KEY, good); await a.reload(); await a.date(DAY);
  });
  await t.test('brak miejsca blokuje dodawanie i usuwanie bez fałszywego sukcesu', async () => {
    const before = await a.raw(KEY), visible = await a.visible();
    await a.evaluate(`window.__originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === '${KEY}') throw new DOMException('Test quota', 'QuotaExceededError'); return window.__originalSetItem.call(this, key, value); };`);
    await a.choose('oat-flakes', '44'); await a.submit();
    assert.equal(await a.raw(KEY), before); assert.deepEqual(await a.visible(), visible);
    assert.equal(await a.evaluate("document.getElementById('amount').value"), '44');
    assert.ok(await a.evaluate("document.getElementById('nutrition-storage-message').textContent.includes('Nie udało się zapisać')"));
    await a.remove(visible[0].id); assert.equal(await a.raw(KEY), before);
    await a.evaluate('Storage.prototype.setItem = window.__originalSetItem');
  });
  await t.test('brak randomUUID uruchamia bezpieczny wariant zastępczy', async () => {
    const before = (await a.saved()).length;
    await a.evaluate("Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })");
    await a.choose('oat-flakes', '50'); await a.submit();
    assert.equal((await a.saved()).length, before + 1);
    assert.match((await a.saved()).at(-1).id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.ok(await a.evaluate("document.getElementById('calculator-message').textContent.includes('Dodano:')"));
    await a.reload(); await a.date(DAY);
  });
  await t.test('przycisk ma kontrast 4,5:1, obszar 48 px i widoczny focus', async () => {
    await a.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await a.evaluate("document.getElementById('add-nutrition').focus()");
    const style = await a.evaluate("(() => { const button = document.getElementById('add-nutrition'); const style = getComputedStyle(button); return { color: style.color, background: style.backgroundColor, height: button.getBoundingClientRect().height, outline: style.outlineStyle, width: parseFloat(style.outlineWidth) }; })()");
    assert.ok(contrast(style.color, style.background) >= 4.5); assert.ok(style.height >= 48);
    assert.equal(style.outline, 'solid'); assert.ok(style.width >= 2);
    for (const width of [320, 390, 1024]) {
      await a.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 720 });
      assert.ok(await a.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    }
    const ids = await a.evaluate("[...document.querySelectorAll('[id]')].map(element => element.id)");
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ['product', 'amount', 'nutrition-meal', 'date']) {
      assert.ok(await a.evaluate(`Boolean(document.querySelector('label[for="${id}"]'))`));
    }
  });
  await t.test('stare notatki: zapis, usuwanie, eksport i symulacja mikrofonu', async () => {
    const food = await a.raw(KEY);
    await a.evaluate("document.querySelector('details').open = true; document.getElementById('words').value = 'Nowa notatka'; document.getElementById('meal').value = 'Obiad'; document.getElementById('save').click()");
    let notes = JSON.parse(await a.raw(NOTE_KEY)); assert.equal(notes.length, 2); assert.deepEqual(notes[0], legacy[0]);
    await a.evaluate("document.querySelector('#entries button').click()");
    notes = JSON.parse(await a.raw(NOTE_KEY)); assert.equal(notes.length, 1); assert.equal(notes[0].text, 'Nowa notatka');
    await a.evaluate("document.getElementById('words').value = ''; document.getElementById('mic').click()");
    assert.equal(await a.evaluate("document.getElementById('words').value"), 'Podyktowana notatka');
    const exported = await a.evaluate("(async () => { let blob; const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click; URL.createObjectURL = value => { blob = value; return 'blob:test'; }; HTMLAnchorElement.prototype.click = function() {}; try { document.getElementById('export').click(); return JSON.parse(await blob.text()); } finally { URL.createObjectURL = create; HTMLAnchorElement.prototype.click = click; } })()");
    assert.deepEqual(exported, notes); assert.equal(await a.raw(KEY), food);
    await a.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await a.evaluate('document.documentElement.scrollWidth <= innerWidth'));
  });
  await t.test('usunięcie ostatnich produktów daje zerową sumę i pusty dzień', async () => {
    for (const entry of (await a.saved()).filter(entry => entry.date === DAY)) await a.remove(entry.id);
    assert.equal((await a.visible()).length, 0);
    assert.deepEqual(await a.outputs('total'), ['0', '0', '0', '0']);
    assert.ok(await a.evaluate("document.getElementById('nutrition-entries').textContent.includes('pierwszy posiłek')"));
    assert.equal(JSON.parse(await a.raw(NOTE_KEY)).length, 1);
  });
  await t.test('konsola i serwer bez błędów, bez zewnętrznych zasobów', async () => {
    assert.deepEqual(browser.errors, []);
    assert.equal(browser.serverErrors(), '');
    assert.deepEqual(browser.requests.filter(url => /^https?:/.test(url) && !url.startsWith(browser.base + '/')), []);
  });
});
