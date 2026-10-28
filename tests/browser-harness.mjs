import { TEST_PRODUCTS } from './fixtures/nutrition-products.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { PUBLIC_ASSETS as STATIC_ASSETS, PRODUCTION_ASSETS } from '../scripts/public-assets.mjs';
import { preparePreview } from '../scripts/prepare-preview.mjs';
const ROOT_URL = new URL('../', import.meta.url);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const CHROMIUM_STARTUP_TIMEOUT_MS = 45_000;
// Osobny hosting wyłącznie plików publicznych, bez uruchamiania server.js.
// Przy /Benger/ nie ma zasobów pod root domeny, które mogłyby zamaskować błędne ścieżki.
export async function startStaticHost(prefix, previewBuild = false, productionBuild = false, productPreview = false) {
  const directory = await mkdtemp(join(tmpdir(), 'benger-static-host-'));
  let server;
  try {
    if(productPreview) await preparePreview(directory, 'a'.repeat(40),{namespace:'preview-off-commercial-search',publicOnly:true});
    else if (productionBuild) await preparePreview(directory, 'a'.repeat(40),{preview:false});
    else if (previewBuild) await preparePreview(directory, 'a'.repeat(40));
    else for (const name of STATIC_ASSETS) { await mkdir(dirname(join(directory, name)), { recursive: true }); await copyFile(new URL(name, ROOT_URL), join(directory, name)); }
    const types = { js: 'text/javascript', css: 'text/css', html: 'text/html', txt: 'text/plain', json: 'application/json', png: 'image/png', webmanifest: 'application/manifest+json' };
    server = createHttpServer(async (request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (prefix !== '/' && pathname === prefix.slice(0, -1)) {
        response.writeHead(301, { Location: prefix }); response.end(); return;
      }
      const file = pathname.startsWith(prefix) ? pathname.slice(prefix.length) || 'index.html' : null;
      if (!(productionBuild?[...PRODUCTION_ASSETS,'release-metadata.json']:[...STATIC_ASSETS,'release-metadata.json','preview-build.json']).includes(file)) { response.writeHead(404); response.end(); return; }
      try {
        response.setHeader('Content-Type', `${types[file.split('.').at(-1)]}; charset=utf-8`);
        response.end(await readFile(join(directory, file)));
      } catch {
        response.writeHead(404); response.end();
      }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return {
      directory,
      base: `http://127.0.0.1:${server.address().port}${prefix}`,
      close: async () => {
        await new Promise(resolve => server.close(resolve));
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function startBrowser({ staticPrefix, mockOFF = false, previewBuild = false, productionBuild = false, respectProxy = false, seedProducts = false, productPreview = false } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'benger-browser-test-'));
  const processes = [];
  let staticSite;
  let socket;
  const errors = [];
  const requests = [];
  const networkRequests = [];
  const responses = [];
  const networkResponses = [];
  const wireResponses = [];
  const failures = [];
  const pending = new Map();
  const off = { mode: 'ok', requests: [], products: mockOFF ? JSON.parse(await readFile(new URL('tests/fixtures/off-products.json', ROOT_URL))).products : [] };
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
    if (staticSite) await staticSite.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  try {
    let serverErrors = '';
    let base;
    if (staticPrefix === undefined) {
      const probe = createServer();
      await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
      const port = probe.address().port;
      await new Promise(resolve => probe.close(resolve));
      const app = spawn(process.execPath, ['server.js'], {
        cwd: fileURLToPath(ROOT_URL), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'],
      });
      processes.push(app);
      app.stderr.on('data', data => { serverErrors += data; });
      base = `http://127.0.0.1:${port}`;
    } else {
      staticSite = await startStaticHost(staticPrefix, previewBuild, productionBuild, productPreview);
      base = staticSite.base;
    }
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(base)).status === 200) { ready = true; break; } } catch {}
      await pause(100);
    }
    assert.ok(ready, `Serwer nie wystartował: ${serverErrors}`);
    const proxy = respectProxy && (process.env.HTTPS_PROXY || process.env.https_proxy);
    const proxyUrl = proxy ? new URL(proxy) : null;
    if (proxyUrl?.username || proxyUrl?.password) throw new Error('Proxy z hasłem nie jest obsługiwane przez test.');
    const chrome = spawn(process.env.CHROMIUM_PATH || 'chromium', [
      ...(proxyUrl ? ['--proxy-server=' + proxyUrl.origin] : []),
      '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
      '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    processes.push(chrome);
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Chromium timeout: ${output}`)), CHROMIUM_STARTUP_TIMEOUT_MS);
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
      if (message.method === 'Network.requestWillBeSent') {requests.push(message.params.request.url);networkRequests.push({url:message.params.request.url,method:message.params.request.method,type:message.params.type,requestId:message.params.requestId});}
      if (message.method === 'Network.responseReceived') {const r=message.params.response;responses.push({url:r.url,status:r.status});networkResponses.push({url:r.url,status:r.status,fromDiskCache:Boolean(r.fromDiskCache),fromServiceWorker:Boolean(r.fromServiceWorker),fromPrefetchCache:Boolean(r.fromPrefetchCache)});}
      if(message.method==='Network.responseReceivedExtraInfo'){const p=message.params,h=Object.fromEntries(Object.entries(p.headers).map(([k,v])=>[k.toLowerCase(),v]));wireResponses.push({requestId:p.requestId,status:p.statusCode,allowOrigin:h['access-control-allow-origin']??null,contentType:h['content-type']??null,retryAfter:h['retry-after']??null,cacheControl:h['cache-control']??null});}
      if (message.method === 'Network.loadingFailed') failures.push({ error: message.params.errorText, cors: message.params.corsErrorStatus ?? null, canceled: message.params.canceled ?? false });
      if (message.method === 'Fetch.requestPaused') void fulfillOFF(message.params, message.sessionId).catch(error => {
        // Wymiana/usunięcie img unieważnia przechwycenie. Chrome nie zawsze wysyła
        // loadingFailed dla współdzielonych miniatur. To dotyczy tylko tego konkretnego
        // błędu protokołu mocka; wyjątki JS, błędy API i inne błędy CDP nadal oblewają test.
        const expiredImageInterception = new URL(message.params.request.url).hostname === 'images.openfoodfacts.org'
          && error.message === '{"code":-32602,"message":"Invalid InterceptionId."}';
        if (!expiredImageInterception) errors.push({ mockError: error.message, url: message.params.request.url });
      });
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
    async function fulfillOFF({ requestId, request }, sessionId) {
      off.requests.push({ url: request.url, method: request.method, headers: request.headers });
      if(off.mode==='network')return command('Fetch.failRequest',{requestId,errorReason:'InternetDisconnected'},sessionId);
      const image = new URL(request.url).hostname === 'images.openfoodfacts.org';
      const cors = [
        { name: 'Access-Control-Allow-Origin', value: '*' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        { name: 'Access-Control-Allow-Headers', value: 'X-User-Agent' },
        { name: 'Access-Control-Max-Age', value: '0' },
      ];
      if (request.method === 'OPTIONS') return command('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: cors }, sessionId);
      if (image) return command('Fetch.fulfillRequest', {
        requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }],
        body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGdQAAAAASUVORK5CYII=',
      }, sessionId);
      if (off.mode === 'timeout') return; // Faktyczny deadline providera, bez opóźniania aplikacji.
      if (off.mode === 'hold') await new Promise(resolve => { off.release = resolve; });
      const url = new URL(request.url);
      let responseCode = 200;
      let data = url.pathname.includes('/product/')
        ? { product: off.products.find(product => product.code === url.pathname.split('/').at(-1)) }
        : { products: off.products };
      if (off.mode === 'empty') data = url.pathname.includes('/product/') ? { status: 0 } : { products: [] };
      if (off.mode === 'invalid') data = { products: [{ code: '5901234123457', product_name: 'Bez makro' }] };
      if (off.mode === '429') responseCode = 429;
      if (off.mode === '500') responseCode = 503;
      const body = off.mode === 'json' ? '{broken' : JSON.stringify(data);
      await command('Fetch.fulfillRequest', {
        requestId, responseCode,
        responseHeaders: [...cors, { name: 'Content-Type', value: 'application/json' }, { name: 'Retry-After', value: '60' }],
        body: Buffer.from(body).toString('base64'),
      }, sessionId);
    }
    async function page(url = base, { diagnostic = false, initScript = '' } = {}) {
      const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
      const send = (method, params) => command(method, params, sessionId);
      async function evaluate(expression) {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      }
      for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await send(`${domain}.enable`);
      if (mockOFF) {
        await send('Fetch.enable', { patterns: [{ urlPattern: 'https://world.openfoodfacts.org/*' }, { urlPattern: 'https://images.openfoodfacts.org/*' }] });
        await send('Page.addScriptToEvaluateOnNewDocument', { source: `
          const actualNow = Date.now;
          Date.now = () => actualNow() + Number(sessionStorage.getItem('test-clock-offset') || 0);
          window.__advanceClock = ms => sessionStorage.setItem('test-clock-offset', String(Number(sessionStorage.getItem('test-clock-offset') || 0) + ms));
        ` });
      }
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `
        // Identyfikator dokumentu testowego, również dla niezabezpieczonej strony błędu Chrome.
        window.__documentId = globalThis.crypto?.randomUUID?.() ?? String(performance.timeOrigin);
        window.__pauseStorageSync = false;
        window.addEventListener('storage', event => { if (window.__pauseStorageSync) event.stopImmediatePropagation(); }, true);
        window.confirm = () => true;
        window.SpeechRecognition = class {
          start() { this.onstart?.(); this.onresult?.({ results: [[{ transcript: 'Podyktowana notatka' }]] }); this.onend?.(); }
          stop() { this.onend?.(); }
        };
      ` });
      if (initScript) await send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });
      async function waitReady(previous) {
        for (let i = 0; i < 100; i++) {
          try {
            if (diagnostic && await evaluate(`window.__documentId !== ${JSON.stringify(previous)} && document.documentElement.dataset.diagnosticsReady === 'true'`)) return;
            if (diagnostic) { await pause(100); continue; }
            if (await evaluate(`window.__documentId !== ${JSON.stringify(previous)} && document.getElementById('nutrition-meal')?.options.length === 4 && document.getElementById('product-catalog')?.dataset.ready === 'true' && Boolean(document.getElementById('date')?.value)`)) return;
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
      async function navigate(nextUrl) {
        const previous = await evaluate('window.__documentId');
        await send('Page.navigate', { url: nextUrl });
        await waitReady(previous);
      }
      async function date(value) {
        await evaluate(`document.getElementById('date').value = ${JSON.stringify(value)}; document.getElementById('date').dispatchEvent(new Event('change'));`);
      }
      async function choose(product, amount, meal = 'breakfast') {
        await evaluate("(async()=>{const{navigate}=await import('./navigation.js');navigate('produkty')})()");
        await evaluate(`document.getElementById('search-internet').checked=false;document.getElementById('product-search').value=${JSON.stringify(TEST_PRODUCTS.find(p=>p.id===product)?.name??product)};document.getElementById('product-search-form').requestSubmit();`);
        for(let i=0;i<200;i++){if(await evaluate("document.getElementById('search-results').getAttribute('aria-busy')==='false'"))break;await pause(20);}
        await evaluate(`[...document.querySelectorAll('#search-results [data-product-id]')].find(button => button.dataset.productId === ${JSON.stringify(product)}).click(); document.getElementById('amount').value = ${JSON.stringify(amount)}; document.getElementById('amount').dispatchEvent(new Event('input')); document.getElementById('nutrition-meal').value = ${JSON.stringify(meal)};`);
      }
      const submit = () => evaluate("document.getElementById('nutrition-form').requestSubmit()");
      const raw = key => evaluate(`localStorage.getItem(${JSON.stringify(key)})`);
      const setRaw = (key, value) => evaluate(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
      const saved = async () => evaluate("(async()=>{const {NUTRITION_STORAGE_KEY}=await import('./app-storage.js');return JSON.parse(localStorage.getItem(NUTRITION_STORAGE_KEY)||'[]')})()");
      const visible = () => evaluate("[...document.querySelectorAll('#nutrition-entries article')].map(article => ({ id: article.dataset.entryId, text: article.textContent }))");
      const outputs = prefix => evaluate(`['kcal', 'protein', 'fat', 'carbs'].map(key => document.getElementById(${JSON.stringify(prefix)} + '-' + key).textContent)`);
      const remove = id => evaluate(`[...document.querySelectorAll('#nutrition-entries article')].find(article => article.dataset.entryId === ${JSON.stringify(id)}).querySelector('button').click()`);
      const analyze = async text => {
        await evaluate("(async()=>{const{navigate}=await import('./navigation.js');navigate('dziennik')})()");
        await evaluate(`document.getElementById('meal-text').value = ${JSON.stringify(text)}; document.getElementById('meal-text').dispatchEvent(new Event('input')); document.getElementById('analyze-meal').click();`);
        for (let attempt = 0; attempt < 300; attempt++) {
          if (await evaluate("document.getElementById('meal-text-form').dataset.analysisState !== 'processing'")) return;
          await pause(50);
        }
        throw new Error('Analiza posiłku nie zakończyła się w limicie.');
      };
      const accept = async () => {await evaluate("document.getElementById('save-meal-proposal').click()");for(let i=0;i<200;i++){if(await evaluate("document.getElementById('meal-text-form').dataset.learningState!=='pending'"))return;await pause(20);}throw new Error('Nie zakończono zapisu pamięci wyboru.');};
      await send('Page.navigate', { url });
      await waitReady(null);
      if(seedProducts && !diagnostic) {
        await evaluate(`(async()=>{const {createProductStorage}=await import('./product-cache.js');const s=createProductStorage();for(const p of ${JSON.stringify(TEST_PRODUCTS)}){if(!await s.read('meta',p.id))await s.mutate('meta',p.id,()=>({product:p}));}await s.close();window.dispatchEvent(new Event('focus'));})()`);
      }
      return { send, evaluate, reload, navigate, date, choose, submit, raw, setRaw, saved, visible, outputs, remove, analyze, accept };
    }
    return { staticDirectory:staticSite?.directory, base, page, errors, requests, networkRequests, networkResponses, wireResponses, responses, failures, off, close, serverErrors: () => serverErrors };
  } catch (error) { await close(); throw error; }
}
