import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preparePreview } from './prepare-preview.mjs';
import { PUBLIC_ASSETS } from './public-assets.mjs';

test('artefakt zawiera wyłącznie publiczne pliki, komplet modułów i izolację pamięci', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'benger-preview-unit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const revision = 'b'.repeat(40);
  await preparePreview(directory, revision);
  const files = (await readdir(directory, { recursive: true, withFileTypes: true })).filter(file => file.isFile()).map(file => join(file.parentPath, file.name).slice(directory.length + 1));
  assert.deepEqual(files.sort(), [...PUBLIC_ASSETS, '.nojekyll'].sort());
  for (const file of ['index.html', 'off-diagnostics.html']) {
    const html = await readFile(join(directory, file), 'utf8');
    assert.match(html, /benger-storage-namespace" content="preview-etap-3/);
    assert.ok(html.includes(`name="benger-build" content="${revision}"`));
    assert.ok(html.includes('Oddzielne dane lokalne'));
  }
  assert.match(await readFile(join(directory, 'app.js'), 'utf8'), /\.\/app-storage\.js/);
  assert.match(await readFile(join(directory, 'product-providers/open-food-facts.js'), 'utf8'), /OFF_API_VERSION = '3.6'/);
});

test('nieprawidłowy SHA i katalog obejmujący repozytorium są odrzucane przed kopiowaniem', async () => {
  await assert.rejects(preparePreview('/tmp/not-used', '<script>'), /SHA/);
  await assert.rejects(preparePreview(fileURLToPath(new URL('../', import.meta.url)), 'a'.repeat(40)), /Katalog/);
});

test('publikacja nie uruchamia się bez jawnego --push', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./publish-preview.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /wymaga jawnego/);
});
