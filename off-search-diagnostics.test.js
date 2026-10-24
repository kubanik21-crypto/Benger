import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareSearchTransports } from './off-search-diagnostics.js';
const fixture = JSON.parse(await readFile(new URL('./tests/fixtures/off-products.json', import.meta.url)));
function json(value, status = 200) {
  const response = new Response(JSON.stringify(value), { status });
  Object.defineProperty(response, 'type', { value: 'cors' });
  return response;
}
test('diagnostyka porównuje identyczne CGI URL i jawnie odróżnia wymóg preflight od obserwacji', async () => {
  const calls = [];
  const result = await compareSearchTransports({ fetchImpl: async (url, options) => {
    calls.push({ url: String(url), ...options });
    if (options.headers['X-User-Agent']) throw new TypeError('Simulated blocked preflight');
    return json(String(url).includes('search.openfoodfacts.org') ? { hits: [{ code: '123', last_modified_t: 1700000000 }], count: 1 } : fixture);
  } });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, calls[1].url); assert.equal(calls[1].url, calls[2].url);
  assert.deepEqual(calls[1].headers, {}); assert.deepEqual(calls[2].headers, { Accept: 'application/json' });
  assert.equal(result.comparisons[0].http, null);
  assert.equal(result.comparisons[0].preflightRequired, true);
  assert.equal(result.comparisons[1].preflightRequired, false);
  assert.equal(result.comparisons[1].ok, true);
  assert.equal(result.comparisons[3].ok, true);
  assert.match(result.comparisons[3].indexFreshness, /Niepotwierdzona/);
  assert.equal(new URL(calls[3].url).searchParams.get('langs'), 'pl,en');
});
test('429 przerywa porównanie i przekazuje cooldown; diagnostyka nie spamuje kolejnych endpointów', async () => {
  let calls = 0, blocked;
  const result = await compareSearchTransports({ fetchImpl: async () => { calls++; return json({}, 429); }, onRateLimit: async delay => { blocked = delay; } });
  assert.equal(calls, 1); assert.equal(blocked, 60000); assert.equal(result.comparisons.length, 1);
});
