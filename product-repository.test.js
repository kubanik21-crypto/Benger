import { createTestCustomProvider } from './tests/fixtures/nutrition-products.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProductRepository, SEARCH_INTERVAL_MS } from './product-repository.js';
import { createProductCache, createProductStorage, PRODUCT_TTL_MS } from './product-cache.js';
import { normalizeOffProduct } from './product-providers/open-food-facts.js';
import { ProductError } from './product-errors.js';

const products = JSON.parse(await readFile(new URL('./tests/fixtures/off-products.json', import.meta.url))).products.map(normalizeOffProduct);
function setup({ search = async () => products, lookup = async () => products[0] } = {}) {
  let time = 1700000000000, online = true, searches = 0, lookups = 0;
  const cache = createProductCache({ storage: createProductStorage({ indexedDBFactory: null }), now: () => time });
  const remote = {
    getProductByBarcode: async (...args) => { lookups++; return lookup(...args); },
  };
  const repository = createProductRepository({ custom:createTestCustomProvider(), cache, remote, searchProvider: { id: 'mock-search', searchProducts: async (...args) => { searches++; return search(...args); } }, isOnline: () => online });
  const searchProducts=repository.searchProducts.bind(repository);repository.searchProducts=(query,options={})=>searchProducts(query,{forceExternal:true,...options});
  return { repository, cache, tick: ms => { time += ms; }, offline: () => { online = false; }, counts: () => ({ searches, lookups }) };
}

test('łączy lokalne i OFF, deduplikuje i ponownie używa wyników bez requestu', async () => {
  const { repository, counts } = setup();
  const result = await repository.searchProducts('mleko');
  assert.ok(result.products.some(p=>p.id==='custom:test-milk'));
  assert.ok(result.products.some(product => product.source === 'openfoodfacts'));
  const again = await repository.searchProducts(' MLEKO ');
  assert.equal(again.status, 'cached');
  assert.equal(new Set(again.products.map(product => product.id)).size, again.products.length);
  assert.deepEqual(counts(), { searches: 1, lookups: 0 });
});

test('identyczne zapytania równoległe współdzielą request', async () => {
  let resolve;
  const { repository, counts } = setup({ search: () => new Promise(done => { resolve = done; }) });
  const first = repository.searchProducts('mleko'), second = repository.searchProducts('mleko');
  await new Promise(done => setImmediate(done));
  assert.equal(counts().searches, 1);
  resolve(products);
  assert.deepEqual((await first).products, (await second).products);
});

test('nowy query jest ograniczony, pusty wynik zapamiętany, bez automatycznego retry', async () => {
  const { repository, tick, counts } = setup({ search: async () => [] });
  assert.equal((await repository.searchProducts('nieistniejący')).products.length, 0);
  assert.equal((await repository.searchProducts('nieistniejący')).status, 'cached');
  assert.equal((await repository.searchProducts('inny produkt')).error.code, 'throttle');
  assert.equal(counts().searches, 1);
  tick(SEARCH_INTERVAL_MS);
  await repository.searchProducts('inny produkt');
  assert.equal(counts().searches, 2);
});

test('barcode korzysta ze świeżego produktu, także z cache wyszukiwania', async () => {
  const { repository, counts } = setup();
  await repository.searchProducts('mleko');
  assert.equal((await repository.getProductByBarcode(products[0].barcode)).product.id, products[0].id);
  assert.equal(counts().lookups, 0);
  await assert.rejects(repository.getProductByBarcode('abc'), error => error.code === 'barcode');
});

test('wygasły produkt odświeża się po kodzie, a offline nadal ma kopię', async () => {
  const newer = { ...products[0], per100: { ...products[0].per100, kcal: 51 } };
  const { repository, cache, tick, counts, offline } = setup({ lookup: async () => newer });
  await cache.putProducts([products[0]]);
  tick(PRODUCT_TTL_MS);
  assert.equal((await repository.getProductByBarcode(products[0].barcode)).product.per100.kcal, 51);
  assert.equal(counts().lookups, 1);
  offline(); tick(PRODUCT_TTL_MS);
  const result = await repository.getProductByBarcode(products[0].barcode);
  assert.equal(result.product.per100.kcal, 51);
  assert.equal(result.error.code, 'offline');
  assert.equal(counts().lookups, 1);
});

test('po TTL query nowa odpowiedź nie jest zasłaniana starą wersją z cache', async () => {
  let response = products;
  const { repository, tick } = setup({ search: async () => response });
  await repository.searchProducts('mleko');
  response = [{ ...products[0], per100: { ...products[0].per100, kcal: 51 } }];
  tick(16 * 60 * 1000);
  const result = await repository.searchProducts('mleko');
  assert.equal(result.products.find(product => product.id === products[0].id).per100.kcal, 51);
});

test('offline pokazuje lokalne i cached bez próby wywołania OFF', async () => {
  const { repository, cache, offline, counts } = setup();
  await cache.putProducts(products); offline();
  const result = await repository.searchProducts('mleko');
  assert.equal(result.status, 'offline');
  assert.ok(result.products.some(product => product.source === 'custom'));
  assert.ok(result.products.some(product => product.source === 'openfoodfacts'));
  assert.deepEqual(counts(), { searches: 0, lookups: 0 });
});

test('429 blokuje kolejne typy zapytań; timeout/5xx zachowują fallback', async () => {
  const { repository, counts, tick } = setup({ search: async () => { throw new ProductError('rate-limit', 120000); } });
  assert.equal((await repository.searchProducts('mleko')).error.code, 'rate-limit');
  assert.equal((await repository.getProductByBarcode(products[0].barcode)).error.code, 'throttle');
  assert.deepEqual(counts(), { searches: 1, lookups: 0 });
  tick(120000);
  await repository.getProductByBarcode(products[0].barcode);
  assert.equal(counts().lookups, 1);
  for (const code of ['timeout', 'server', 'response', 'network']) {
    const setupCase = setup({ search: async () => { throw new ProductError(code); } });
    const result = await setupCase.repository.searchProducts('mleko');
    assert.equal(result.error.code, code);
    assert.ok(result.products.some(product => product.id === 'custom:test-milk'));
  }
});

test('ostatnie i ulubione są dostępne offline, stare notatki dziennika nie są zmieniane', async () => {
  const { repository, offline } = setup();
  const old = [{ productId: 'custom:test-oats', createdAt: '2023-10-20T10:00:00Z' }];
  const snapshot = structuredClone(old);
  await repository.seedRecentFromDiary(old);
  await repository.markUsed([products[0]]);
  await repository.setFavorite(products[0], true);
  offline();
  assert.equal((await repository.recentProducts())[0].id, products[0].id);
  assert.equal((await repository.favoriteProducts())[0].id, products[0].id);
  await repository.setFavorite(products[0], false);
  assert.equal((await repository.favoriteProducts()).length, 0);
  assert.deepEqual(old, snapshot);
});
