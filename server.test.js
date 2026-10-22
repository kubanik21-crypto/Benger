import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('bezpieczne statyczne serwowanie plików', { timeout: 15000 }, async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'benger-static-test-'));
  const site = join(temporary, 'site');
  let server;
  let stderr = '';
  t.after(async () => {
    if (server && server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, pause(2000)]);
      if (server.exitCode === null) { server.kill('SIGKILL'); await exited; }
    }
    await rm(temporary, { recursive: true, force: true });
  });
  for (const directory of [site, join(site, '.git'), join(site, 'assets'), join(site, '.private'), join(site, 'tests'), join(site, 'folder.js')]) {
    await mkdir(directory, { recursive: true });
  }
  await copyFile(new URL('./server.js', import.meta.url), join(site, 'server.js'));
  const publicFiles = new Map([
    ['index.html', ['<!doctype html><p>Test publicznej strony</p>', 'text/html']],
    ['app.js', ['export const app = true;', 'text/javascript']],
    ['nutrition.js', ['export const nutrition = true;', 'text/javascript']],
    ['meal-parser.js', ['export const parser = true;', 'text/javascript']],
    ['legacy.js', ['export const legacy = true;', 'text/javascript']],
    ['style.css', ['body { color: green; }', 'text/css']],
    ['manifest.webmanifest', ['{"name":"Benger"}', 'application/manifest+json']],
  ]);
  for (const [name, [body]] of publicFiles) await writeFile(join(site, name), body);
  await writeFile(join(site, 'package.json'), '{"type":"module","privateMarker":"PRIVATE_FIXTURE"}');
  for (const name of ['.env', '.git/config', '.private/data.js', 'assets/.hidden.js', 'nutrition.test.js', 'meal-parser.test.js', 'browser.test.js', 'server.test.js', 'tests/deep.test.js', 'README.md', 'data.json', 'SERVER.js']) {
    await writeFile(join(site, name), 'PRIVATE_FIXTURE');
  }
  await writeFile(join(temporary, 'outside.js'), 'PRIVATE_FIXTURE');
  await symlink(join(temporary, 'outside.js'), join(site, 'escape.js'));
  await symlink(join(site, 'server.js'), join(site, 'private-alias.js'));
  await symlink(join(site, 'app.js'), join(site, 'public-alias.js'));

  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  // Inny cwd potwierdza, że katalogiem publicznym jest katalog skryptu, a nie procesu.
  server = spawn(process.execPath, [join(site, 'server.js')], {
    cwd: temporary, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  server.stderr.on('data', data => { stderr += data; });
  // http.request zachowuje surowe ../; fetch i URL normalizują je przed wysłaniem.
  const get = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('HTTP timeout')));
    req.end();
  });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await get('/')).status === 200) { ready = true; break; } } catch {}
    await pause(50);
  }
  assert.ok(ready, stderr || 'Serwer nie wystartował.');

  for (const [name, [body, type]] of publicFiles) {
    await t.test(`publiczny plik: ${name}`, async () => {
      const result = await get(name === 'index.html' ? '/' : `/${name}`);
      assert.equal(result.status, 200);
      assert.equal(result.body, body);
      assert.equal(result.headers['content-type'], `${type}; charset=utf-8`);
      assert.equal(result.headers['x-content-type-options'], 'nosniff');
      assert.equal(result.headers['cache-control'], 'no-cache');
    });
  }
  await t.test('nowe moduły i podkatalogi działają bez restartu lub dopisywania tras', async () => {
    await writeFile(join(site, 'new-module.js'), 'export const addedAfterStartup = true;');
    await writeFile(join(site, 'assets/new-module.js'), 'export const nested = true;');
    assert.equal((await get('/new-module.js')).body, 'export const addedAfterStartup = true;');
    assert.equal((await get('/assets/new-module.js')).body, 'export const nested = true;');
  });
  await t.test('index.html, query string i HEAD mają poprawną obsługę', async () => {
    assert.equal((await get('/index.html')).status, 200);
    assert.equal((await get('/app.js?v=2')).body, publicFiles.get('app.js')[0]);
    const head = await get('/app.js', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength(publicFiles.get('app.js')[0]));
  });
  await t.test('prywatne pliki, pliki testowe i niepubliczne rozszerzenia zwracają 404', async () => {
    for (const path of ['/server.js', '/%73erver.js', '/SERVER.js', '/package.json', '/nutrition.test.js', '/meal-parser.test.js', '/browser.test.js', '/server.test.js', '/tests/deep.test.js', '/.env', '/.git/config', '/%2egit/config', '/.private/data.js', '/assets/.hidden.js', '/README.md', '/data.json']) {
      const result = await get(path);
      assert.equal(result.status, 404, path);
      assert.equal(result.body.includes('PRIVATE_FIXTURE'), false, path);
    }
  });
  await t.test('surowe i zakodowane próby path traversal zwracają 404', async () => {
    for (const path of ['/../app.js', '/assets/../app.js', '/%2e%2e/app.js', '/assets/%2E%2E/app.js', '/.%2e/app.js', '/%2e/app.js', '/%2e%2e%2fapp.js', '/..%5capp.js', '/%2e%2e%5capp.js', '/%252e%252e/app.js', '//app.js']) {
      assert.equal((await get(path)).status, 404, path);
    }
  });
  await t.test('dowiązania poza projekt, do serwera i do publicznego pliku są zablokowane', async () => {
    for (const path of ['/escape.js', '/private-alias.js', '/public-alias.js']) assert.equal((await get(path)).status, 404, path);
  });
  await t.test('błędne kodowanie, bajt NUL, katalogi i brakujące pliki zwracają 404', async () => {
    for (const path of ['/%zz.js', '/%E0%A4%A.js', '/%00.js', '/folder.js', '/assets/', '/missing.js']) {
      assert.equal((await get(path)).status, 404, path);
    }
  });
  await t.test('metody inne niż GET i HEAD są odrzucane', async () => {
    const result = await get('/app.js', 'POST');
    assert.equal(result.status, 405);
    assert.equal(result.headers.allow, 'GET, HEAD');
    assert.equal(result.body, '');
  });
  assert.equal(stderr, '');
});
