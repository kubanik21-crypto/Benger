import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startBrowser, startStaticHost } from './tests/browser-harness.mjs';
import { PUBLIC_ASSETS as STATIC_ASSETS } from './scripts/public-assets.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const DAY = '2026-10-22';
const OTHER_DAY = '2026-10-23';
const KEY = 'benger.nutrition.v1';
const NOTE_KEY = 'benger.meals.v1';

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
    for (const path of ['/', '/app.js', '/nutrition.js', '/meal-parser.js', '/legacy.js', '/style.css', '/manifest.webmanifest']) {
      assert.equal((await fetch(browser.base + path)).status, 200, path);
    }
    assert.equal((await fetch(browser.base + '/missing')).status, 404);
    assert.deepEqual(await a.evaluate("[...document.querySelectorAll('#basic-products .product-name')].map(node => node.textContent)"), ['Płatki owsiane', 'Banan bez skórki', 'Jogurt naturalny', 'Mleko 2%']);
    assert.equal(await a.evaluate("document.getElementById('product-error').textContent"), '');
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
    assert.deepEqual(Object.keys(entry).sort(), ['id', 'date', 'createdAt', 'meal', 'productId', 'productName', 'amount', 'unit', 'nutrition', 'brand', 'source', 'sourceId', 'barcode'].sort());
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
    for (const id of ['amount', 'nutrition-meal', 'date']) {
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

for (const prefix of ['/', '/Benger/']) {
  test(`hosting statyczny pod ${prefix}`, { timeout: 120000 }, async t => {
    const browser = await startBrowser({ staticPrefix: prefix });
    t.after(() => browser.close());
    const a = await browser.page();
    await a.date(DAY);
    const origin = new URL(browser.base).origin;
    const allowedOrigins = new Set([origin]);
    const audit = { prefix, widths: [], pwa: {} };

    await t.test('publiczny frontend działa bez server.js, bez zasobów zastępczych pod root domeny', async () => {
      for (const file of STATIC_ASSETS) {
        const response = await fetch(new URL(file, browser.base));
        assert.equal(response.status, 200, file);
        assert.equal(await response.text(), await readFile(new URL(file, import.meta.url), 'utf8'), file);
        if (file.endsWith('.js')) assert.match(response.headers.get('content-type'), /javascript/);
      }
      for (const file of ['server.js', 'package.json', 'browser.test.js']) {
        assert.equal((await fetch(new URL(file, browser.base))).status, 404, file);
      }
      if (prefix !== '/') {
        for (const file of ['app.js', 'style.css', 'manifest.webmanifest']) assert.equal((await fetch(`${origin}/${file}`)).status, 404);
        const redirect = await fetch(`${origin}${prefix.slice(0, -1)}`, { redirect: 'manual' });
        assert.equal(redirect.status, 301);
        assert.equal(redirect.headers.get('location'), prefix);
      }
      assert.equal(await a.evaluate("document.querySelector('link[rel=stylesheet]').href"), new URL('style.css', browser.base).href);
      assert.equal(await a.evaluate('getComputedStyle(document.body).margin'), '0px');
      assert.equal(await a.evaluate("document.querySelectorAll('#basic-products [data-product-id]').length"), 4);
    });

    await t.test('importy, ręczne dodawanie i propozycja tekstowa korzystają ze wspólnego dziennika', async () => {
      await a.choose('oat-flakes', '50'); await a.submit();
      const raw = await a.raw(KEY);
      await a.analyze('Na śniadanie zjadłem 200 ml mleka 2% i banana 120 g');
      assert.equal(await a.raw(KEY), raw);
      assert.deepEqual(await a.outputs('proposal'), ['206,8', '8,12', '4,36', '36,96']);
      await a.accept();
      assert.equal((await a.saved()).length, 3);
      assert.deepEqual(await a.outputs('total'), ['391,8', '14,62', '7,86', '66,96']);
    });

    await t.test('odświeżenie, index.html i logo pozostają we właściwym podkatalogu', async () => {
      const raw = await a.raw(KEY);
      await a.reload(); await a.date(DAY);
      assert.equal(await a.raw(KEY), raw);
      assert.equal((await a.visible()).length, 3);
      await a.navigate(new URL('index.html', browser.base).href);
      const home = await a.evaluate("document.querySelector('.brand').href");
      assert.equal(home, browser.base);
      await a.navigate(home); await a.date(DAY);
      assert.equal(await a.evaluate('location.pathname'), prefix);
      assert.equal(await a.raw(KEY), raw);
      assert.deepEqual(await a.outputs('total'), ['391,8', '14,62', '7,86', '66,96']);
    });

    await t.test('manifest ma względny start_url i scope oraz spójny theme-color', async () => {
      const pwa = await a.evaluate(`(async () => {
        const url = document.querySelector('link[rel=manifest]').href;
        const response = await fetch(url);
        const manifest = await response.json();
        return { url, manifest, startUrl: new URL(manifest.start_url, url).href,
          scope: new URL(manifest.scope, url).href,
          theme: document.querySelector('meta[name=theme-color]').content,
          secureContext: isSecureContext,
          serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length };
      })()`);
      assert.equal(pwa.url, new URL('manifest.webmanifest', browser.base).href);
      assert.equal(pwa.startUrl, browser.base);
      assert.equal(pwa.scope, browser.base);
      assert.equal(pwa.manifest.display, 'standalone');
      assert.equal(pwa.theme, pwa.manifest.theme_color);
      audit.pwa = pwa;
      // Diagnoza zależna od wersji przeglądarki, bez narzucania braków PWA jako wymagań regresji.
      if (process.env.BENGER_AUDIT_DIR) {
        try { audit.pwa.installability = await a.send('Page.getInstallabilityErrors'); }
        catch (error) { audit.pwa.installabilityDiagnostic = error.message; }
      }
    });

    await t.test('układ mieści się na 320, 390, 768, 1024 i 1440 px', async () => {
      for (const width of [320, 390, 768, 1024, 1440]) {
        await a.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 720 });
        await a.evaluate('window.scrollTo(0, 0)');
        const metrics = await a.evaluate(`(() => {
          const rect = selector => {
            const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
            return { x, y, width, height };
          };
          return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            main: rect('main'), textForm: rect('.text-meal'), workspace: rect('.workspace'),
            summary: rect('#day-summary'), diary: rect('#nutrition-entries'),
            columns: getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns };
        })()`);
        assert.ok(metrics.scrollWidth <= width, JSON.stringify(metrics));
        assert.ok(metrics.summary.width > 0);
        audit.widths.push({ width, ...metrics });
        if (process.env.BENGER_AUDIT_DIR && prefix === '/Benger/') {
          await mkdir(process.env.BENGER_AUDIT_DIR, { recursive: true });
          const { data } = await a.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          await writeFile(join(process.env.BENGER_AUDIT_DIR, `layout-${width}.png`), Buffer.from(data, 'base64'));
          if ([390, 1440].includes(width)) {
            await a.evaluate("document.getElementById('day-summary').scrollIntoView({block:'start'})");
            const diary = await a.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            await writeFile(join(process.env.BENGER_AUDIT_DIR, `diary-${width}.png`), Buffer.from(diary.data, 'base64'));
            await a.evaluate('window.scrollTo(0, 0)');
          }
        }
      }
      if (process.env.BENGER_AUDIT_DIR) {
        await mkdir(process.env.BENGER_AUDIT_DIR, { recursive: true });
        await writeFile(join(process.env.BENGER_AUDIT_DIR, `audit-${prefix === '/' ? 'root' : 'Benger'}.json`), JSON.stringify(audit, null, 2));
      }
      t.diagnostic(`Szerokości bez poziomego przewijania: ${audit.widths.map(item => item.width).join(', ')}.`);
    });

    await t.test('localStorage zależy od origin, a nie od ścieżki strony', async () => {
      const raw = await a.raw(KEY);
      const sameOrigin = await a.evaluate(`(() => {
        const original = location.href;
        try { history.replaceState(null, '', '/inna-sciezka/'); return localStorage.getItem('${KEY}'); }
        finally { history.replaceState(null, '', original); }
      })()`);
      assert.equal(sameOrigin, raw);
      const otherSite = await startStaticHost(prefix);
      allowedOrigins.add(new URL(otherSite.base).origin);
      try {
        // Ta sama instancja Chromium i ten sam profil, ale inny port (inny origin).
        const b = await browser.page(otherSite.base);
        assert.equal(await b.raw(KEY), null);
        await b.choose('milk-2-percent', '100'); await b.submit();
        assert.equal((await b.saved()).length, 1);
        assert.equal(await a.raw(KEY), raw);
      } finally { await otherSite.close(); }
    });

    await t.test('konsola i zasoby frontendu bez błędów; brak zewnętrznych API', async () => {
      assert.deepEqual(browser.errors, []);
      assert.equal(browser.serverErrors(), '');
      const webResponses = browser.responses.filter(response => /^https?:/.test(response.url));
      assert.deepEqual(webResponses.filter(response => response.status >= 400), []);
      assert.deepEqual(browser.requests.filter(url => /^https?:/.test(url) && !allowedOrigins.has(new URL(url).origin)), []);
      const initialRequests = browser.requests.filter(url => url.startsWith(origin + '/'));
      if (prefix !== '/') assert.ok(initialRequests.every(url => new URL(url).pathname.startsWith(prefix)));
    });
  });
}

test('Etap 2 — tekst, sprawdzenie i wspólny dziennik', { timeout: 120000 }, async t => {
  const browser = await startBrowser();
  t.after(() => browser.close());
  const a = await browser.page();
  await a.date(DAY);
  const example = 'Na śniadanie zjadłem 50 g płatków owsianych i 200 ml mleka 2%';
  const three = 'Obiad: 50 g płatków owsianych, 200 ml mleka 2% i banan 120 g';
  const disabled = () => a.evaluate("document.getElementById('save-meal-proposal').disabled");
  const countWrites = () => a.evaluate(`
    window.__nutritionWrites = 0;
    window.__countedSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === '${KEY}') window.__nutritionWrites++;
      return window.__countedSetItem.call(this, key, value);
    };
  `);

  await t.test('analiza pokazuje dwa produkty i sumę, bez zapisu przed akceptacją', async () => {
    await countWrites();
    await a.analyze(example);
    assert.equal(await a.raw(KEY), null);
    assert.equal(await a.evaluate('window.__nutritionWrites'), 0);
    assert.equal((await a.visible()).length, 0);
    const cards = await a.evaluate("[...document.querySelectorAll('#meal-proposal-items .food-entry')].map(card => card.textContent)");
    assert.equal(cards.length, 2);
    assert.ok(cards[0].includes('Płatki owsiane') && cards[0].includes('185 kcal') && cards[0].includes('6,5 g'));
    assert.ok(cards[1].includes('Mleko 2%') && cards[1].includes('100 kcal') && cards[1].includes('6,8 g'));
    assert.deepEqual(await a.outputs('proposal'), ['285', '13,3', '7,5', '39,6']);
    assert.deepEqual(await a.outputs('total'), ['0', '0', '0', '0']);
    assert.equal(await disabled(), false);
    assert.equal(await a.evaluate('document.activeElement.id'), 'meal-proposal-title');
    assert.ok(await a.evaluate("document.getElementById('meal-proposal-context').textContent.includes('Śniadanie')"));
  });

  await t.test('zatwierdzenie tworzy osobne wpisy w jednej operacji, bez podwójnego zapisu', async () => {
    await a.evaluate("document.getElementById('save-meal-proposal').click(); document.getElementById('save-meal-proposal').click()");
    const entries = await a.saved();
    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map(entry => entry.id)).size, 2);
    assert.ok(entries.every(entry => entry.date === DAY && entry.meal === 'breakfast' && new Date(entry.createdAt).toISOString() === entry.createdAt));
    assert.deepEqual(entries.map(entry => entry.nutrition), [
      { kcal: 185, protein: 6.5, fat: 3.5, carbs: 30 }, { kcal: 100, protein: 6.8, fat: 4, carbs: 9.6 },
    ]);
    assert.equal(await a.evaluate('window.__nutritionWrites'), 1);
    assert.equal((await a.visible()).length, 2);
    assert.deepEqual(await a.outputs('total'), ['285', '13,3', '7,5', '39,6']);
    assert.equal(await disabled(), true);
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"), '');
    assert.equal(await a.evaluate('document.activeElement.id'), 'meal-text');
    assert.ok(await a.evaluate("document.getElementById('meal-text-status').textContent.includes('Dodano do dziennika')"));
    assert.equal(await a.raw(NOTE_KEY), null);
  });

  await t.test('odświeżenie zachowuje wpisy; brak nazwy posiłku używa wyboru formularza', async () => {
    const raw = await a.raw(KEY);
    await a.reload(); await a.date(OTHER_DAY);
    assert.equal(await a.raw(KEY), raw);
    assert.equal((await a.visible()).length, 0);
    await a.choose('oat-flakes', '', 'snack');
    await a.analyze('banan 120 g i 150 g jogurtu naturalnego');
    assert.ok(await a.evaluate("document.getElementById('meal-proposal-context').textContent.includes('Przekąska')"));
    assert.deepEqual(await a.outputs('proposal'), ['196,8', '7,32', '3,36', '36,36']);
    assert.equal(await a.raw(KEY), raw);
  });

  await t.test('trzy produkty w jednym zapisie, posiłek z tekstu i rozdzielenie dni', async () => {
    await countWrites();
    await a.analyze(three);
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items .food-entry').length"), 3);
    assert.deepEqual(await a.outputs('proposal'), ['391,8', '14,62', '7,86', '66,96']);
    await a.accept();
    assert.equal(await a.evaluate('window.__nutritionWrites'), 1);
    const entries = await a.saved();
    assert.equal(entries.length, 5);
    assert.ok(entries.slice(-3).every(entry => entry.date === OTHER_DAY && entry.meal === 'lunch'));
    assert.equal(new Set(entries.map(entry => entry.id)).size, 5);
    assert.deepEqual(await a.outputs('total'), ['391,8', '14,62', '7,86', '66,96']);
    await a.date(DAY);
    assert.deepEqual(await a.outputs('total'), ['285', '13,3', '7,5', '39,6']);
    await a.date(OTHER_DAY);
  });

  await t.test('ręczny formularz nadal dodaje i usuwa wpisy we wspólnym dzienniku', async () => {
    await a.choose('natural-yogurt', '100', 'dinner'); await a.submit();
    assert.equal((await a.visible()).length, 4);
    assert.deepEqual(await a.outputs('total'), ['451,8', '18,62', '9,86', '72,96']);
    const added = (await a.saved()).at(-1);
    await a.remove(added.id);
    assert.equal((await a.visible()).length, 3);
    assert.deepEqual(await a.outputs('total'), ['391,8', '14,62', '7,86', '66,96']);
  });

  await t.test('błędne lub niepełne dane blokują całą propozycję i zachowują tekst', async () => {
    const raw = await a.raw(KEY);
    for (const text of ['', 'to zupełnie nieznane jedzenie', 'zjadłem banana', '200 g mleka', '50 g płatków i 100 g czegoś', 'banan -5 g', 'banan 5,5,5 g', 'jogurt truskawkowy 150 g', 'śniadanie banan 100 g i obiad mleko 100 ml', 'banan 120 g i', 'banan 120 g oraz']) {
      await a.analyze(text);
      assert.equal(await disabled(), true, text);
      assert.equal(await a.evaluate("document.getElementById('meal-proposal-summary').hidden"), true, text);
      assert.ok(await a.evaluate("document.getElementById('meal-text-error').textContent"), text);
      assert.equal(await a.evaluate("document.getElementById('meal-text').value"), text);
      await a.accept();
      assert.equal(await a.raw(KEY), raw, text);
    }
  });

  await t.test('poprawienie tekstu i ponowna analiza odblokowują prawidłową propozycję', async () => {
    const raw = await a.raw(KEY);
    await a.analyze('50,5 g płatków i 200 ml mleka');
    assert.equal(await disabled(), false);
    assert.equal(await a.evaluate("document.getElementById('meal-text').getAttribute('aria-invalid')"), 'false');
    assert.deepEqual(await a.outputs('proposal'), ['286,85', '13,37', '7,54', '39,9']);
    assert.equal(await a.raw(KEY), raw);
  });

  await t.test('zmiana tekstu, daty lub domyślnego posiłku unieważnia stary podgląd', async () => {
    const raw = await a.raw(KEY);
    await a.evaluate("document.getElementById('meal-text').value='banan 120 g'; document.getElementById('meal-text').dispatchEvent(new Event('input'))");
    assert.equal(await disabled(), true);
    assert.equal(await a.evaluate("document.getElementById('meal-proposal').hidden"), true);
    await a.analyze(example); await a.date(DAY);
    assert.equal(await disabled(), true);
    await a.analyze('banan 120 g');
    await a.evaluate("document.getElementById('nutrition-meal').value='snack'; document.getElementById('nutrition-meal').dispatchEvent(new Event('change'))");
    assert.equal(await disabled(), true);
    // Zmiany programowe bez zdarzenia także nie mogą zatwierdzić starego podglądu.
    for (const [id, value] of [['meal-text', 'mleko 300 ml'], ['date', OTHER_DAY], ['nutrition-meal', 'lunch']]) {
      await a.analyze(example);
      await a.evaluate(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(value)}`);
      await a.accept();
      assert.equal(await disabled(), true);
      assert.equal(await a.raw(KEY), raw);
      await a.date(DAY);
    }
  });

  await t.test('brak daty blokuje analizę z czytelnym błędem i fokusem', async () => {
    const raw = await a.raw(KEY);
    await a.date(''); await a.analyze(example);
    assert.equal(await disabled(), true);
    assert.equal(await a.evaluate('document.activeElement.id'), 'date');
    assert.ok(await a.evaluate("document.getElementById('date-error').textContent"));
    assert.equal(await a.raw(KEY), raw);
    await a.date(DAY);
  });

  await t.test('błąd setItem nie zapisuje części zestawu; ponowienie zapisuje całość', async () => {
    await a.analyze(three);
    const raw = await a.raw(KEY), before = await a.visible(), totals = await a.outputs('total');
    await a.evaluate(`window.__quotaSetItem=Storage.prototype.setItem; window.__failedWrites=0; Storage.prototype.setItem=function(key,value) { if(key==='${KEY}') { window.__failedWrites++; throw new DOMException('Test quota','QuotaExceededError'); } return window.__quotaSetItem.call(this,key,value); };`);
    await a.accept();
    assert.equal(await a.evaluate('window.__failedWrites'), 1);
    assert.equal(await a.raw(KEY), raw);
    assert.deepEqual(await a.visible(), before);
    assert.deepEqual(await a.outputs('total'), totals);
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"), three);
    assert.equal(await disabled(), false);
    assert.ok(await a.evaluate("document.getElementById('nutrition-storage-message').textContent.includes('Nie udało się zapisać')"));
    assert.ok(!(await a.evaluate("document.getElementById('meal-text-status').textContent")).includes('Dodano'));
    await a.evaluate('Storage.prototype.setItem=window.__quotaSetItem');
    await a.accept();
    assert.equal((await a.saved()).length, JSON.parse(raw).length + 3);
    assert.equal((await a.visible()).length, before.length + 3);
  });

  await t.test('uszkodzenie pamięci po analizie blokuje cały zapis i chroni dane', async () => {
    const raw = await a.raw(KEY);
    await a.analyze(example);
    await a.setRaw(KEY, '{broken');
    await a.accept();
    assert.equal(await a.raw(KEY), '{broken');
    assert.equal(await disabled(), true);
    assert.ok(await a.evaluate("document.getElementById('nutrition-storage-message').textContent.includes('Nie można odczytać')"));
    await a.setRaw(KEY, raw); await a.reload(); await a.date(DAY);
  });

  await t.test('zatwierdzenie propozycji zachowuje nowy wpis drugiej karty i synchronizuje obie', async () => {
    const b = await browser.page(); await b.date(DAY);
    const before = (await a.visible()).length;
    await a.analyze(example);
    await a.evaluate('window.__pauseStorageSync=true');
    await b.choose('natural-yogurt', '150', 'snack'); await b.submit();
    const id = (await b.saved()).at(-1).id;
    assert.equal((await a.visible()).length, before);
    await a.accept();
    await waitCount(a, before + 3); await waitCount(b, before + 3);
    assert.ok((await a.saved()).some(entry => entry.id === id));
    assert.deepEqual(await a.outputs('total'), await b.outputs('total'));
    await a.evaluate('window.__pauseStorageSync=false');
  });

  await t.test('zapis wielu pozycji działa bez crypto.randomUUID', async () => {
    const before = (await a.saved()).length;
    await a.evaluate("Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true})");
    await a.analyze(example); await a.accept();
    const added = (await a.saved()).slice(before);
    assert.equal(added.length, 2);
    assert.equal(new Set(added.map(entry => entry.id)).size, 2);
    for (const entry of added) assert.match(entry.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await a.reload(); await a.date(DAY);
  });

  await t.test('awaria tworzenia drugiego ID nie zapisuje pierwszej pozycji', async () => {
    await a.analyze(three);
    const raw = await a.raw(KEY);
    await a.evaluate("window.__uuid=crypto.randomUUID; window.__uuidCount=0; Object.defineProperty(crypto,'randomUUID',{configurable:true,value:function(){if(++window.__uuidCount===2) throw new Error('Test ID failure'); return window.__uuid.call(crypto);}})");
    await a.accept();
    assert.equal(await a.raw(KEY), raw);
    assert.ok(await a.evaluate("document.getElementById('meal-text-error').textContent"));
    await a.evaluate("Object.defineProperty(crypto,'randomUUID',{configurable:true,value:window.__uuid})");
    await a.accept();
    assert.equal((await a.saved()).length, JSON.parse(raw).length + 3);
  });

  await t.test('zapis zachowuje dokładnie metadane i makro pokazane do akceptacji', async () => {
    await a.analyze('50 g płatków owsianych');
    await a.evaluate("(async()=>{const {PRODUCTS}=await import('./nutrition.js'); const p=PRODUCTS[0]; window.__oldProduct={name:p.name,unit:p.unit,kcal:p.per100.kcal}; p.name='Zmieniony katalog'; p.unit='ml'; p.per100.kcal=9999;})()");
    await a.accept();
    const entry = (await a.saved()).at(-1);
    assert.equal(entry.productName, 'Płatki owsiane');
    assert.equal(entry.unit, 'g');
    assert.deepEqual(entry.nutrition, { kcal: 185, protein: 6.5, fat: 3.5, carbs: 30 });
    await a.evaluate("(async()=>{const {PRODUCTS}=await import('./nutrition.js'); const p=PRODUCTS[0]; p.name=window.__oldProduct.name; p.unit=window.__oldProduct.unit; p.per100.kcal=window.__oldProduct.kcal;})()");
  });

  await t.test('przepełnienie porcji lub sumy i HTML w tekście nie prowadzą do zapisu', async () => {
    const raw = await a.raw(KEY);
    for (const text of [`${'1' + '0'.repeat(308)} g płatków`, `${'3' + '0'.repeat(307)} g płatków i ${'3' + '0'.repeat(307)} g płatków`, '<img src=x onerror=alert(1)> banan 120 g']) {
      await a.analyze(text);
      assert.equal(await disabled(), true);
      assert.equal(await a.raw(KEY), raw);
      assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal img').length"), 0);
      assert.ok(await a.evaluate("document.getElementById('meal-text-error').textContent"));
    }
  });

  await t.test('nowy formularz ma etykietę, komunikaty i focus; widoki 320/390 px bez poziomego scrolla', async () => {
    await a.analyze(three);
    assert.ok(await a.evaluate("Boolean(document.querySelector('label[for=\"meal-text\"]'))"));
    assert.equal(await a.evaluate("document.getElementById('meal-text-error').getAttribute('role')"), 'alert');
    assert.equal(await a.evaluate("document.getElementById('meal-text-status').getAttribute('role')"), 'status');
    for (const width of [320, 390]) {
      await a.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      assert.ok(await a.evaluate('document.documentElement.scrollWidth<=innerWidth'));
      await a.analyze(`${'1' + '0'.repeat(100)} g płatków`);
      assert.equal(await disabled(), false);
      assert.ok(await a.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Długa ilość musi zawijać się na telefonie.');
      await a.analyze(three);
    }
    await a.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    for (const id of ['analyze-meal', 'save-meal-proposal']) {
      const style = await a.evaluate(`(()=>{const b=document.getElementById('${id}'); b.focus(); const s=getComputedStyle(b); return {color:s.color,background:s.backgroundColor,height:b.getBoundingClientRect().height,outline:s.outlineStyle,width:parseFloat(s.outlineWidth)};})()`);
      assert.ok(contrast(style.color, style.background)>=4.5);
      assert.ok(style.height>=48);
      assert.equal(style.outline, 'solid'); assert.ok(style.width>=2);
    }
    if (process.env.BENGER_TEXT_SCREENSHOT_PATH) {
      const { data } = await a.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(process.env.BENGER_TEXT_SCREENSHOT_PATH, Buffer.from(data, 'base64'));
    }
  });

  await t.test('konsola, serwer i importy bez błędów; bez zewnętrznych żądań', async () => {
    assert.deepEqual(browser.errors, []);
    assert.equal(browser.serverErrors(), '');
    assert.deepEqual(browser.requests.filter(url => /^https?:/.test(url) && !url.startsWith(browser.base + '/')), []);
  });
});

async function waitFor(page, expression, timeout = 5000) {
  const end = Date.now() + timeout;
  do {
    if (await page.evaluate(expression)) return;
    await pause(25);
  } while (Date.now() < end);
  assert.fail(`Warunek nie został spełniony: ${expression}`);
}

test('Etap 3 — katalog OFF, prawdziwy fetch/CORS i IndexedDB pod /Benger/', { timeout: 150000 }, async t => {
  const browser = await startBrowser({ staticPrefix: '/Benger/', mockOFF: true });
  t.after(() => browser.close());
  const a = await browser.page();
  await a.date(DAY);
  const apiRequests = () => browser.off.requests.filter(request => request.method === 'GET' && new URL(request.url).hostname === 'world.openfoodfacts.org');
  const advance = (ms = 6500) => a.evaluate(`window.__advanceClock(${ms})`);
  async function search(query) {
    await a.evaluate(`document.getElementById('product-search').value = ${JSON.stringify(query)}; document.getElementById('product-search').dispatchEvent(new Event('input')); document.getElementById('product-search-form').requestSubmit()`);
    await waitFor(a, "document.getElementById('search-results').getAttribute('aria-busy') === 'false'", 13000);
  }
  async function barcode(code) {
    await a.evaluate(`document.querySelector('.barcode-lookup').open = true; document.getElementById('barcode').value = ${JSON.stringify(code)}; document.getElementById('barcode-form').requestSubmit()`);
    await waitFor(a, "document.getElementById('search-results').getAttribute('aria-busy') === 'false'", 13000);
  }
  const resultCount = () => a.evaluate("document.querySelectorAll('#search-results [data-product-id]').length");
  const message = () => a.evaluate("document.getElementById('catalog-message').textContent");
  const chooseOFF = () => a.evaluate("[...document.querySelectorAll('#search-results [data-product-id]')].find(button => button.dataset.productId.startsWith('off:')).click()");

  await t.test('nie wysyła requestów przy pisaniu; minimum 3 znaki; wyszukiwanie przez Enter i identyfikacja CORS', async () => {
    await a.evaluate("document.getElementById('product-search').value='mleko 2%'; document.getElementById('product-search').dispatchEvent(new Event('input'))");
    assert.equal(apiRequests().length, 0);
    await search('ab'); assert.match(await message(), /3 znaki/); assert.equal(apiRequests().length, 0);
    await search('mleko 2%');
    assert.equal(apiRequests().length, 1);
    assert.ok(await resultCount() >= 2);
    assert.match(await a.evaluate("document.getElementById('search-results').textContent"), /Marka testowa/);
    assert.match(await a.evaluate("document.getElementById('search-results').textContent"), /100 ml/);
    const request = apiRequests()[0];
    assert.equal(Object.entries(request.headers).some(([key]) => key.toLowerCase() === 'x-user-agent'), false);
    assert.equal(Object.entries(request.headers).find(([key]) => key.toLowerCase() === 'accept')[1], 'application/json');
    assert.equal(new URL(request.url).searchParams.get('page_size'), '20');
    // Natywny fetch przeszedł kontrolę CORS Chromium; test nie podmienia window.fetch.
    assert.equal(await a.evaluate('fetch.toString().includes("[native code]")'), true);
  });
  await t.test('wybór OFF, 200 ml, wspólne obliczenia i snapshot w dzienniku', async () => {
    await chooseOFF();
    await waitFor(a, "document.querySelector('#product img')?.naturalWidth > 0");
    await a.evaluate("document.getElementById('amount').value='200'; document.getElementById('amount').dispatchEvent(new Event('input'))");
    assert.equal(await a.evaluate("document.getElementById('amount-unit').textContent"), 'ml');
    assert.deepEqual(await a.outputs('portion'), ['100', '6,8', '4', '9,6']);
    await a.submit();
    const entry = (await a.saved())[0];
    assert.equal(entry.source, 'openfoodfacts'); assert.equal(entry.brand, 'Marka testowa');
    assert.equal(entry.barcode, '5901234123457'); assert.equal(entry.nutrition.kcal, 100);
    assert.ok(!Object.hasOwn(entry, 'nutriments')); assert.ok(!Object.hasOwn(entry, 'imageUrl'));
    await waitFor(a, "document.querySelector('#recent-products [data-product-id]')?.dataset.productId.startsWith('off:')");
    await waitFor(a, `(async()=>{const {createProductRepository}=await import('./product-repository.js');const repo=createProductRepository();const memory=await repo.selectionMemory('mleko 2 procent');await repo.close();return memory.length>0;})()`);
    assert.equal(await a.evaluate(`(async()=>{const {createProductRepository}=await import('./product-repository.js');const repo=createProductRepository();const memory=await repo.selectionMemory('mleko 2%');await repo.close();return memory[0].count;})()`), 1);
    assert.deepEqual(await a.outputs('total'), ['100', '6,8', '4', '9,6']);
  });
  await t.test('ulubione i cache są trwałe po odświeżeniu; produkt i świeży query bez kolejnego fetch', async () => {
    await a.evaluate("document.querySelector('#product .favorite-product').click()");
    await waitFor(a, "document.querySelector('#favorite-products .favorite-product')?.getAttribute('aria-pressed') === 'true'");
    await a.reload(); await a.date(DAY);
    assert.equal(await a.evaluate("document.querySelectorAll('#favorite-products [data-product-id]').length"), 1);
    const before = apiRequests().length;
    await search('MLEKO 2%'); assert.equal(apiRequests().length, before);
    await barcode('5901234123457'); assert.equal(apiRequests().length, before);
    assert.equal(await resultCount(), 1);
    const stored = await a.evaluate(`(async () => {
      const {createProductStorage}=await import('./product-cache.js'); const storage=createProductStorage();
      const products=await storage.read('products'); await storage.close(); return products;
    })()`);
    assert.equal(stored.length, 2); assert.equal(stored[0].product.source, 'openfoodfacts');
    assert.ok(Number.isFinite(stored[0].fetchedAt)); assert.ok(!Object.hasOwn(stored[0].product, 'nutrition'));
  });
  await t.test('usunięcie ulubionego nie usuwa ostatnich ani dziennika', async () => {
    const diary = await a.raw(KEY);
    await a.evaluate("document.querySelector('#favorite-products .favorite-product').click()");
    await waitFor(a, "document.querySelectorAll('#favorite-products [data-product-id]').length === 0");
    assert.equal(await a.raw(KEY), diary);
    assert.equal(await a.evaluate("document.querySelectorAll('#recent-products [data-product-id]').length"), 1);
    await chooseOFF();
    await a.evaluate("document.querySelector('#product .favorite-product').click()");
    await waitFor(a, "document.querySelectorAll('#favorite-products [data-product-id]').length === 1");
  });
  await t.test('offline: wyszukiwanie lokalne, ostatnie, ulubione, barcode i zapis bez sieci', async () => {
    await a.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    const before = apiRequests().length;
    await waitFor(a, 'navigator.onLine === false');
    await search('mleko'); assert.match(await message(), /Brak połączenia/);
    assert.ok(await resultCount() >= 2);
    await a.evaluate("document.querySelector('#favorite-products [data-product-id]').click(); document.getElementById('amount').value='50,5'; document.getElementById('amount').dispatchEvent(new Event('input'))");
    assert.equal(await a.evaluate("document.querySelector('#product img') === null"), true);
    await a.submit(); assert.equal((await a.saved()).length, 2);
    assert.equal((await a.saved())[1].amount, 50.5);
    await barcode('5901234123457'); assert.equal(await resultCount(), 1);
    assert.equal(await a.evaluate("document.querySelector('#search-results img') === null"), true);
    assert.equal(apiRequests().length, before);
    await a.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await waitFor(a, 'navigator.onLine === true');
  });
  await t.test('puste wyniki i brak makro są czytelne; puste wyniki mają cache', async () => {
    browser.off.mode = 'empty'; await advance(); await search('nieznany produkt');
    assert.equal(await resultCount(), 0); assert.match(await message(), /Brak wyników/);
    const before = apiRequests().length; await search('nieznany produkt'); assert.equal(apiRequests().length, before);
    browser.off.mode = 'invalid'; await advance(); await search('produkt bez danych'); assert.equal(await resultCount(), 0);
  });
  await t.test('429 i szybkie kolejne query nie spamują API', async () => {
    browser.off.mode = '429'; await advance(); await search('nowy produkt');
    assert.match(await message(), /ogranicza liczbę zapytań/);
    const before = apiRequests().length;
    await search('jeszcze inny'); assert.match(await message(), /Odczekaj/);
    assert.equal(apiRequests().length, before);
    await barcode('5901234123464'); // świeży cache jest nadal dostępny podczas blokady
    assert.equal(await resultCount(), 1); assert.equal(apiRequests().length, before);
    await advance(60000);
  });
  await t.test('timeout, błędny JSON i 5xx pokazują fallback bez błędu JavaScript', async () => {
    browser.off.mode = 'timeout'; await advance();
    const before = apiRequests().length;
    await a.evaluate("document.getElementById('product-search').value='mleko timeout';document.getElementById('product-search-form').requestSubmit();document.getElementById('product-search-form').requestSubmit()");
    assert.equal(await a.evaluate("document.getElementById('search-products').disabled && document.getElementById('find-barcode').disabled"), true);
    await waitFor(a, "document.getElementById('search-results').getAttribute('aria-busy') === 'false'", 13000);
    assert.equal(apiRequests().length - before, 1); assert.match(await message(), /na czas/);
    for (const [mode, expected] of [['json', /odczytać danych/], ['500', /chwilowo niedostępne/]]) {
      browser.off.mode = mode; await advance(); await search(`mleko ${mode}`);
      assert.match(await message(), expected);
    }
  });
  await t.test('barcode lookup z sieci oraz brak produktu i niepoprawny kod', async () => {
    browser.off.mode = 'ok'; await advance(8 * 24 * 60 * 60 * 1000);
    await barcode('5901234123464'); assert.equal(await resultCount(), 1);
    assert.match(await a.evaluate("document.getElementById('search-results').textContent"), /Jogurt/);
    assert.ok(apiRequests().some(request => new URL(request.url).pathname === '/api/v3.6/product/5901234123464'));
    browser.off.mode = 'empty'; await advance(); await barcode('4006381333931');
    assert.equal(await resultCount(), 0); assert.match(await message(), /Brak wyników/);
    const before = apiRequests().length; await barcode('123'); assert.match(await message(), /prawidłowy kod/); assert.equal(apiRequests().length, before);
  });
  await t.test('XSS z API jest tekstem, nie kodem; snapshot nie zmienia się po aktualizacji OFF', async () => {
    const before = await a.raw(KEY);
    browser.off.mode = 'ok'; browser.off.products[0].product_name_pl = '<img src=x onerror="window.__xss=true">';
    browser.off.products[0].nutrition.aggregated_set.nutrients['energy-kcal'].value = 51;
    await advance(); await search('nazwa testowa');
    assert.match(await a.evaluate("document.getElementById('search-results').textContent"), /<img src=x/);
    assert.equal(await a.evaluate("Boolean(window.__xss) || Boolean(document.querySelector('#search-results img[src=x]'))"), false);
    assert.equal(await a.raw(KEY), before);
    browser.off.products[0].product_name_pl = 'Mleko 2% — test';
  });
  await t.test('odpowiedź starego query nie zastępuje wyników po zmianie pola; brak zdjęcia ma placeholder', async () => {
    browser.off.mode = 'hold'; await advance();
    const previousResults = await a.evaluate("document.getElementById('search-results').textContent");
    await a.evaluate("document.getElementById('product-search').value='poprzednia fraza';document.getElementById('product-search-form').requestSubmit()");
    for (let i = 0; i < 100 && !browser.off.release; i++) await pause(20);
    assert.equal(typeof browser.off.release, 'function');
    await a.evaluate("document.getElementById('product-search').value='nowa fraza';document.getElementById('product-search').dispatchEvent(new Event('input'))");
    browser.off.mode = 'ok'; browser.off.release();
    await waitFor(a, "document.getElementById('search-results').getAttribute('aria-busy') === 'false'");
    assert.equal(await a.evaluate("document.getElementById('search-results').textContent"), previousResults);
    assert.match(await message(), /Zapytanie zmienione/);
    await advance(); await search('nowa fraza'); await chooseOFF();
    await waitFor(a, "document.querySelector('#product img')?.complete === true");
    await a.evaluate("document.querySelector('#product img').dispatchEvent(new Event('error'))");
    assert.equal(await a.evaluate("document.querySelector('#product img') === null && Boolean(document.querySelector('#product .product-thumbnail'))"), true);
  });
  await t.test('uszkodzony cache nie psuje dziennika ani lokalnego katalogu', async () => {
    await a.evaluate(`(async () => {
      const {createProductStorage}=await import('./product-cache.js'); const storage=createProductStorage();
      await storage.mutate('products','broken',()=>({key:'broken',product:{name:'bad'},fetchedAt:Date.now()}));
      await storage.mutate('usage','broken',()=>({key:'broken',favorite:'oops'})); await storage.close();
    })()`);
    const before = await a.raw(KEY); await a.reload(); await a.date(DAY);
    assert.equal(await a.raw(KEY), before);
    assert.equal(await a.evaluate("document.querySelectorAll('#basic-products [data-product-id]').length"), 4);
    assert.equal((await a.visible()).length, 2);
    const oldEntries = JSON.parse(before).map(({ brand, source, sourceId, barcode, ...entry }) => entry);
    await a.setRaw(KEY, JSON.stringify(oldEntries)); await a.reload(); await a.date(DAY);
    assert.equal((await a.visible()).length, 2); assert.equal(await a.outputs('total').then(values => values[0]), '125,25');
    await a.setRaw(KEY, before); await a.reload(); await a.date(DAY);
  });
  await t.test('niedostępne IndexedDB uruchamia jawny fallback; dziennik nadal działa', async () => {
    const isolated = await browser.page();
    const { identifier } = await isolated.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('Blocked','SecurityError')}})",
    });
    await isolated.reload();
    assert.match(await isolated.evaluate("document.getElementById('catalog-storage-message').textContent"), /tylko do zamknięcia tej karty/);
    const before = (await isolated.saved()).length;
    await isolated.choose('peeled-banana', '120'); await isolated.submit();
    assert.equal((await isolated.saved()).length, before + 1);
    await isolated.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  });
  await t.test('w dwóch kartach limiter IndexedDB jest wspólny; ostatnie odświeżają się po powrocie', async () => {
    const b = await browser.page();
    const offset = await a.evaluate("sessionStorage.getItem('test-clock-offset')");
    await b.evaluate(`sessionStorage.setItem('test-clock-offset', ${JSON.stringify(offset)})`);
    await advance(); await b.evaluate('window.__advanceClock(6500)');
    const before = apiRequests().length;
    await Promise.all([
      a.evaluate("document.getElementById('product-search').value='karta pierwsza';document.getElementById('product-search-form').requestSubmit()"),
      b.evaluate("document.getElementById('product-search').value='karta druga';document.getElementById('product-search-form').requestSubmit()"),
    ]);
    await waitFor(a, "document.getElementById('search-results').getAttribute('aria-busy') === 'false'");
    await waitFor(b, "document.getElementById('search-results').getAttribute('aria-busy') === 'false'");
    assert.equal(apiRequests().length - before, 1);
    await b.evaluate("window.dispatchEvent(new Event('focus'))");
    await waitFor(b, "document.querySelectorAll('#recent-products [data-product-id]').length > 0");
  });
  await t.test('wyszukiwarka i wyniki mieszczą się na mobile i desktop; etykiety i touch targety', async () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await a.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 720 });
      assert.ok(await a.evaluate('document.documentElement.scrollWidth <= innerWidth'), `${width}px`);
    }
    for (const id of ['product-search', 'barcode', 'amount']) assert.ok(await a.evaluate(`Boolean(document.querySelector('label[for="${id}"]'))`));
    assert.ok(await a.evaluate("[...document.querySelectorAll('.choose-product,.favorite-product,#search-products,#find-barcode')].every(button=>button.getBoundingClientRect().height>=48)"));
    if (process.env.BENGER_CATALOG_SCREENSHOT_PATH) {
      await a.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
      const screenshot = await a.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(process.env.BENGER_CATALOG_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
    }
  });
  await t.test('brak wyjątków aplikacji; błędy sieciowe wystąpiły tylko w kontrolowanych scenariuszach OFF', async () => {
    assert.deepEqual(browser.errors.filter(error => !(error.source === 'network' && error.url?.startsWith('https://world.openfoodfacts.org/'))), []);
    assert.equal(browser.serverErrors(), '');
    assert.ok(browser.requests.filter(url=>/^https?:/.test(url)).every(url=>url.startsWith(new URL(browser.base).origin+'/') || /^https:\/\/(world|images)\.openfoodfacts\.org\//.test(url)));
  });
});

test('Preview Etapu 3 — osobna pamięć i kompletny artefakt w zagnieżdżonym katalogu', { timeout: 120000 }, async t => {
  const browser = await startBrowser({ staticPrefix: '/Benger/previews/etap-3/', previewBuild: true, mockOFF: true });
  t.after(() => browser.close());
  const a = await browser.page();
  await a.setRaw(KEY, 'oryginalny dziennik produkcyjny');
  await a.setRaw(NOTE_KEY, 'oryginalne notatki produkcyjne');
  await a.reload(); await a.date(DAY);
  assert.equal(await a.evaluate("document.querySelector('meta[name=benger-build]').content"), 'a'.repeat(40));
  assert.equal(await a.evaluate("document.querySelector('meta[name=benger-storage-namespace]').content"), 'preview-etap-3');
  assert.equal(await a.evaluate("document.getElementById('nutrition-storage-message').textContent"), '');
  for (const file of STATIC_ASSETS) assert.equal((await fetch(new URL(file, browser.base))).status, 200, file);
  await a.choose('oat-flakes', '50'); await a.submit();
  assert.equal((await a.saved()).length, 1);
  assert.equal((await a.saved())[0].nutrition.kcal, 185);
  await a.evaluate("document.getElementById('words').value='Notatka preview';document.getElementById('save').click()");
  assert.equal(JSON.parse(await a.raw('benger.preview-etap-3.meals.v1')).length, 1);
  assert.equal(await a.raw(KEY), 'oryginalny dziennik produkcyjny');
  assert.equal(await a.raw(NOTE_KEY), 'oryginalne notatki produkcyjne');
  await a.reload(); await a.date(DAY); assert.equal((await a.visible()).length, 1);
  const names = await a.evaluate('(async()=> (await indexedDB.databases()).map(db=>db.name))()');
  assert.ok(names.includes('BengerDB-preview-etap-3')); assert.ok(!names.includes('BengerDB'));
  const before = browser.off.requests.length;
  const diagnostic = await browser.page(new URL('off-diagnostics.html', browser.base).href, { diagnostic: true });
  assert.equal(browser.off.requests.length, before);
  browser.off.products.push({ ...browser.off.products[0], code: '3017620422003', product_name_pl: 'Produkt diagnostyczny — test' });
  await diagnostic.evaluate("document.getElementById('run-off-diagnostics').click()");
  await waitFor(diagnostic, "!document.getElementById('run-off-diagnostics').disabled", 15000);
  const result = await diagnostic.evaluate("JSON.parse(document.getElementById('diagnostic-report').textContent)");
  assert.equal(result.passed, true); assert.equal(result.apiVersion, '3.6');
  assert.equal(result.requests.length, 2); assert.ok(result.requests.every(request => request.http === 200 && request.corsReadable));
  assert.equal(await a.raw(KEY), 'oryginalny dziennik produkcyjny');
  assert.equal(await a.raw(NOTE_KEY), 'oryginalne notatki produkcyjne');
  assert.deepEqual(browser.errors, []);
});

test('Migracja IndexedDB v1 → v2 i pamięć wyborów w dwóch kartach', { timeout: 120000 }, async t => {
  const browser = await startBrowser({ staticPrefix: '/Benger/', mockOFF: true });
  t.after(() => browser.close());
  const initial = await browser.page(new URL('off-diagnostics.html', browser.base).href, { diagnostic: true });
  const raw = JSON.parse(await readFile(new URL('./tests/fixtures/off-products.json', import.meta.url))).products[0];
  const { normalizeOffProduct } = await import('./product-providers/open-food-facts.js');
  const product = normalizeOffProduct(raw);
  await initial.evaluate(`new Promise((resolve,reject)=>{
    const request=indexedDB.open('BengerDB',1);
    request.onupgradeneeded=()=>{for(const name of ['products','usage','searches','meta'])request.result.createObjectStore(name,{keyPath:'key'});};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;const tx=db.transaction(['products','usage'],'readwrite');
      tx.objectStore('products').put({key:${JSON.stringify(product.id)},product:${JSON.stringify(product)},fetchedAt:Date.now(),revision:2});
      tx.objectStore('usage').put({key:${JSON.stringify(product.id)},favorite:true,favoriteAt:Date.now(),lastUsedAt:null,order:0});
      tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>reject(tx.error);
    };
  })`);
  const a = await browser.page(), b = await browser.page();
  assert.equal(await a.evaluate("(async()=> (await indexedDB.databases()).find(db=>db.name==='BengerDB').version)()"), 2);
  assert.equal(await a.evaluate("document.querySelector('#favorite-products [data-product-id]').dataset.productId"), product.id);
  const remember = `(async()=>{const {createProductRepository}=await import('./product-repository.js');const repo=createProductRepository();await repo.rememberSelection('mleko 2 procent',await repo.getProductById(${JSON.stringify(product.id)}));await repo.close();})()`;
  await Promise.all([a.evaluate(remember), b.evaluate(remember)]);
  await a.reload();
  const preference = await a.evaluate(`(async()=>{
    const {createProductRepository}=await import('./product-repository.js');const repo=createProductRepository();const memory=await repo.selectionMemory('MLEKO 2%');await repo.close();return memory;
  })()`);
  assert.equal(preference.length, 1); assert.equal(preference[0].count, 2);
  assert.equal(browser.off.requests.filter(request => new URL(request.url).hostname === 'world.openfoodfacts.org').length, 0, 'Migracja i pamięć nie wywołują API.');
  assert.deepEqual(browser.errors, []);
});
