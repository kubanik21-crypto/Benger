import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpenFoodFactsProvider, normalizeOffProduct, OFF_FIELDS, OFF_APP_ID } from './open-food-facts.js';
import { isProduct } from '../product-model.js';

const fixtures = JSON.parse(await readFile(new URL('../tests/fixtures/off-products.json', import.meta.url)));
const sample = () => structuredClone(fixtures.products[0]);
const response = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const legacy = () => ({ code: '3017620422003', product_name: 'Produkt testowy', quantity: '1 l',
  nutriments: { 'energy-kcal_100g': 50, proteins_100g: 3.4, fat_100g: 2, carbohydrates_100g: 4.8 } });

test('nowy schemat: jawne 100 ml, polska nazwa, marka i URL zdjęcia', () => {
  const product = normalizeOffProduct(sample());
  assert.ok(isProduct(product));
  assert.equal(product.name, 'Mleko 2% — test');
  assert.equal(product.brand, 'Marka testowa');
  assert.equal(product.unit, 'ml');
  assert.equal(product.basis, 'declared');
  assert.equal(product.source, 'openfoodfacts');
  assert.equal(product.barcode, '5901234123457');
  assert.deepEqual(product.per100, { kcal: 50, protein: 3.4, fat: 2, carbs: 4.8 });
  assert.equal(product.updatedAt, new Date(1760000000000).toISOString());
  assert.equal(Object.hasOwn(product, 'nutrition'), false);
});

test('starszy schemat: wyłącznie *_100g; litrowe opakowanie nie zmienia jednostki na ml', () => {
  const product = normalizeOffProduct(legacy());
  assert.equal(product.unit, 'g');
  assert.equal(product.basis, 'legacy');
  assert.equal(product.imageUrl, null);
  assert.equal(product.brand, null);
});

test('100 g pozostaje g bez względu na quantity; dane prepared i serving są odrzucane', () => {
  const raw = sample();
  raw.nutrition.aggregated_set.per = '100g';
  assert.equal(normalizeOffProduct(raw).unit, 'g');
  for (const per of ['serving', '100l', '', undefined]) {
    raw.nutrition.aggregated_set.per = per;
    assert.equal(normalizeOffProduct(raw), null);
  }
  raw.nutrition.aggregated_set.per = '100ml';
  raw.nutrition.aggregated_set.preparation = 'prepared';
  assert.equal(normalizeOffProduct(raw), null);
});

test('brak nazwy, źródłowego ID lub wymaganych makro eliminuje produkt', () => {
  for (const name of ['', '  ', null, undefined]) {
    const raw = sample(); raw.product_name_pl = name; raw.product_name = name;
    assert.equal(normalizeOffProduct(raw), null);
  }
  for (const field of ['energy-kcal', 'proteins', 'fat', 'carbohydrates']) {
    const raw = sample(); delete raw.nutrition.aggregated_set.nutrients[field];
    assert.equal(normalizeOffProduct(raw), null);
  }
  const raw = sample(); delete raw.code;
  assert.equal(normalizeOffProduct(raw), null);
});

test('złe wartości, nieprawidłowe jednostki składników i ograniczenia < > nie stają się liczbami', () => {
  for (const value of [null, undefined, '', ' ', 'abc', NaN, Infinity, -2, true]) {
    const raw = sample(); raw.nutrition.aggregated_set.nutrients['energy-kcal'].value = value;
    assert.equal(normalizeOffProduct(raw), null, String(value));
  }
  const raw = sample(); raw.nutrition.aggregated_set.nutrients.proteins.unit = 'mg';
  assert.equal(normalizeOffProduct(raw), null);
  for (const modifier of ['<', '<=', '>', '>=']) {
    const raw = sample(); raw.nutrition.aggregated_set.nutrients.proteins.modifier = modifier;
    assert.equal(normalizeOffProduct(raw), null);
  }
});

test('zero jest poprawne; numeryczne stringi są walidowane, szacunek ma jawne oznaczenie', () => {
  const raw = sample();
  for (const nutrient of Object.values(raw.nutrition.aggregated_set.nutrients)) nutrient.value = '0';
  assert.deepEqual(normalizeOffProduct(raw).per100, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  raw.nutrition.aggregated_set.nutrients['energy-kcal'].modifier = '~';
  assert.equal(normalizeOffProduct(raw).estimated, true);
});

test('bez kodu GTIN i zdjęcia nadal możliwy jest produkt ze stabilnym sourceId', () => {
  const raw = sample(); raw.code = '123456'; raw.image_front_small_url = 'javascript:alert(1)';
  const product = normalizeOffProduct(raw);
  assert.equal(product.id, 'off:123456');
  assert.equal(product.barcode, null);
  assert.equal(product.imageUrl, null);
});

test('nie konwertuje kJ ani nie przyjmuje prepared_100g jako danych as sold', () => {
  const raw = legacy(); delete raw.nutriments['energy-kcal_100g'];
  raw.nutriments.energy_100g = 200;
  raw.nutriments['energy-kcal_prepared_100g'] = 50;
  assert.equal(normalizeOffProduct(raw), null);
});

test('provider ogranicza fields i liczbę wyników, używa właściwego full-text endpointu i X-User-Agent', async () => {
  let captured;
  const provider = createOpenFoodFactsProvider({ fetchImpl: async (url, options) => {
    captured = { url: new URL(url), options };
    return response({ products: Array.from({ length: 25 }, sample) });
  } });
  const products = await provider.search('mleko łaciate 2%');
  assert.equal(products.length, 20);
  assert.equal(captured.url.pathname, '/cgi/search.pl');
  assert.equal(captured.url.searchParams.get('search_terms'), 'mleko łaciate 2%');
  assert.equal(captured.url.searchParams.get('api_version'), '3.5');
  assert.equal(captured.url.searchParams.get('page_size'), '20');
  assert.equal(captured.url.searchParams.get('fields'), OFF_FIELDS.join(','));
  assert.equal(captured.options.headers['X-User-Agent'], OFF_APP_ID);
  assert.equal(Object.hasOwn(captured.options.headers, 'User-Agent'), false);
  assert.equal(captured.options.credentials, 'omit');
  assert.equal(captured.options.mode, 'cors');
});

test('puste wyniki i brak makro są poprawnym pustym wynikiem, błędny JSON daje błąd', async () => {
  for (const products of [[], [{}], [{ product_name: 'Bez makro', code: '5901234123457' }]]) {
    const provider = createOpenFoodFactsProvider({ fetchImpl: async () => response({ products }) });
    assert.deepEqual(await provider.search('mleko'), []);
  }
  for (const body of [null, {}, { products: 'wrong' }]) {
    const provider = createOpenFoodFactsProvider({ fetchImpl: async () => response(body) });
    await assert.rejects(provider.search('mleko'), error => error.code === 'response');
  }
  const invalid = createOpenFoodFactsProvider({ fetchImpl: async () => new Response('invalid JSON') });
  await assert.rejects(invalid.search('mleko'), error => error.code === 'response');
});

test('barcode lookup, 404, niepełny produkt i sprzeczny kod odpowiedzi', async () => {
  const provider = createOpenFoodFactsProvider({ fetchImpl: async url => {
    assert.equal(new URL(url).pathname, '/api/v3.5/product/5901234123457');
    return response({ product: sample() });
  } });
  assert.equal((await provider.getProductByBarcode('5901234123457')).unit, 'ml');
  for (const value of [null, { status: 0 }]) {
    const missing = createOpenFoodFactsProvider({ fetchImpl: async () => response(value, value === null ? 404 : 200) });
    assert.equal(await missing.getProductByBarcode('5901234123457'), null);
  }
  const invalid = createOpenFoodFactsProvider({ fetchImpl: async () => response({ product: fixtures.products[1] }) });
  await assert.rejects(invalid.getProductByBarcode('5901234123457'), error => error.code === 'response');
});

test('429 respektuje Retry-After, 5xx, offline i timeout są rozróżniane', async () => {
  const cases = [
    [async () => response({}, 429, { 'Retry-After': '120' }), 'rate-limit'],
    [async () => response({}, 503), 'server'],
    [async () => { throw new TypeError('Network failed'); }, 'network'],
    [async () => new Promise(() => {}), 'timeout'],
  ];
  for (const [fetchImpl, code] of cases) {
    const provider = createOpenFoodFactsProvider({ fetchImpl, timeoutMs: 10 });
    await assert.rejects(provider.search('mleko'), error => error.code === code && (code !== 'rate-limit' || error.retryAfterMs === 120000));
  }
});

test('nieprawidłowe zapytanie i kod nie wykonują fetch; anulowanie nie jest wyciszane', async () => {
  let count = 0;
  const provider = createOpenFoodFactsProvider({ fetchImpl: async (_, { signal }) => {
    count++;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  await assert.rejects(provider.search('a'), error => error.code === 'query');
  await assert.rejects(provider.getProductByBarcode('123'), error => error.code === 'barcode');
  assert.equal(count, 0);
  const controller = new AbortController();
  const pending = provider.search('mleko', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.code === 'cancelled');
  assert.equal(count, 1);
});
