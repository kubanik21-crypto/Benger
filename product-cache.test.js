import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProductCache, createProductStorage, PRODUCT_TTL_MS, SEARCH_TTL_MS } from './product-cache.js';
import { normalizeOffProduct } from './product-providers/open-food-facts.js';
import { getLocalProducts } from './product-providers/local.js';

const raw = JSON.parse(await readFile(new URL('./tests/fixtures/off-products.json', import.meta.url))).products[0];
const product = n => ({ ...normalizeOffProduct(raw), id: `off:test-${n}`, sourceId: String(n), barcode: null, name: `Produkt ${n}` });
function setup(maxProducts = 300) {
  let time = 1700000000000;
  const storage = createProductStorage({ indexedDBFactory: null });
  const cache = createProductCache({ storage, now: () => time, maxProducts });
  return { cache, storage, now: () => time, tick: ms => { time += ms; } };
}

test('cache zapisuje wyłącznie znormalizowane dane OFF i zwraca niezależne kopie', async () => {
  const { cache } = setup();
  const p = product(1);
  await cache.putProducts([{ ...p, rawResponse: { huge: true } }, ...getLocalProducts()]);
  const cached = await cache.getProduct(p.id);
  assert.equal(cached.fresh, true);
  assert.equal(Object.hasOwn(cached.product, 'rawResponse'), false);
  cached.product.per100.kcal = 999;
  assert.equal((await cache.getProduct(p.id)).product.per100.kcal, 50);
  assert.equal((await cache.allProducts()).length, 1);
});

test('TTL produktu wygasa dokładnie po 7 dniach; użycie i gwiazdka go nie odnawiają', async () => {
  const { cache, tick } = setup();
  const p = product(1);
  await cache.putProducts([p]);
  const fetchedAt = (await cache.getProduct(p.id)).fetchedAt;
  tick(PRODUCT_TTL_MS - 1);
  assert.equal((await cache.getProduct(p.id)).fresh, true);
  tick(1);
  assert.equal((await cache.getProduct(p.id)).fresh, false);
  await cache.markUsed([p]); await cache.setFavorite(p, true);
  assert.equal((await cache.getProduct(p.id)).fetchedAt, fetchedAt);
  assert.equal((await cache.getProduct(p.id)).fresh, false);
});

test('cache wyników, także pustych, jest krótki i normalizuje zapytanie', async () => {
  const { cache, tick } = setup();
  const p = product(1);
  await cache.putProducts([p]);
  await cache.putSearch(' MLEKO ŁACIATE ', [p]);
  assert.equal((await cache.getSearch('mleko laciate'))[0].id, p.id);
  await cache.putSearch('brak', []);
  assert.deepEqual(await cache.getSearch('brak'), []);
  tick(SEARCH_TTL_MS);
  assert.equal(await cache.getSearch('mleko laciate'), null);
  assert.equal(await cache.getSearch('brak'), null);
});

test('uszkodzone rekordy i czas z przyszłości nie udają świeżego cache', async () => {
  const { cache, storage, now } = setup();
  await storage.mutate('products', 'bad', () => ({ key: 'bad', product: { name: 'broken' }, fetchedAt: now() }));
  assert.equal(await cache.getProduct('bad'), null);
  const p = product(1);
  await cache.putProducts([p], now() + 1);
  assert.equal((await cache.getProduct(p.id)).fresh, false);
});

test('ostatnie 20 unikalnych ID, najnowsze pierwsze, również przy tym samym czasie', async () => {
  const { cache } = setup();
  const products = Array.from({ length: 22 }, (_, i) => product(i));
  await cache.markUsed(products);
  const ids = await cache.recentIds();
  assert.equal(ids.length, 20);
  assert.equal(ids[0], products[21].id);
  await cache.markUsed([products[3]]);
  assert.equal((await cache.recentIds())[0], products[3].id);
  assert.equal(new Set(await cache.recentIds()).size, 20);
});

test('ulubione są niezależne od ostatnich i od instancji repozytorium', async () => {
  const { cache, storage, now } = setup();
  const p = product(1), local = getLocalProducts()[0];
  await cache.setFavorite(p, true); await cache.setFavorite(local, true);
  assert.equal((await cache.recentIds()).length, 0);
  const reloaded = createProductCache({ storage, now });
  assert.deepEqual(new Set(await reloaded.favoriteIds()), new Set([p.id, local.id]));
  await reloaded.setFavorite(p, false);
  assert.deepEqual(await cache.favoriteIds(), [local.id]);
});

test('limit zwykłego cache nie usuwa ulubionych ani ostatnich', async () => {
  const { cache } = setup(2);
  const products = Array.from({ length: 6 }, (_, i) => product(i));
  await cache.setFavorite(products[0], true);
  await cache.markUsed([products[1]]);
  await cache.putProducts(products.slice(2));
  assert.ok(await cache.getProduct(products[0].id));
  assert.ok(await cache.getProduct(products[1].id));
  assert.equal((await cache.allProducts()).length, 4);
  assert.equal(await cache.getProduct(products[2].id), null);
});

test('wygasające zapytanie z usuniętymi produktami jest pominięte', async () => {
  const { cache } = setup(1);
  const first = product(1), second = product(2);
  await cache.putProducts([first]); await cache.putSearch('first', [first]);
  await cache.putProducts([second]);
  assert.equal(await cache.getSearch('first'), null);
});

test('wspólny limiter rezerwuje atomowo, rozdziela typy i respektuje blokadę 429', async () => {
  const { cache, storage, now, tick } = setup();
  const other = createProductCache({ storage, now });
  assert.deepEqual(await Promise.all([cache.reserveRequest('search', 6500), other.reserveRequest('search', 6500)]), [0, 6500]);
  assert.equal(await cache.reserveRequest('product', 4500), 0);
  await cache.blockRequests(60000);
  assert.equal(await other.reserveRequest('product', 4500), 60000);
  tick(60000);
  assert.equal(await cache.reserveRequest('search', 6500), 0);
});

test('brak IndexedDB nie wywraca aplikacji; pamięć awaryjna jawnie nie jest trwała', async () => {
  const storage = createProductStorage({ indexedDBFactory: { open() { throw new Error('Storage blocked'); } } });
  const cache = createProductCache({ storage });
  await cache.ready();
  assert.equal(cache.persistent(), false);
  await cache.putProducts([product(1)]);
  assert.ok(await cache.getProduct(product(1).id));
  await cache.close();
});

test('czyszczenie ponownie sprawdza ochronę ostatnich/ulubionych przed usunięciem', async () => {
  const { cache, storage } = setup();
  const a = product(1), b = product(2), c = product(3);
  await cache.putProducts([a, b, c]);
  // Kandydaci do usunięcia zostali wybrani przed zmianą preferencji w drugiej karcie.
  const staleCandidates = [a.id, b.id, c.id];
  await cache.setFavorite(a, true); await cache.markUsed([b]);
  await storage.removeUnprotectedProducts(staleCandidates);
  assert.ok(await cache.getProduct(a.id)); assert.ok(await cache.getProduct(b.id));
  assert.equal(await cache.getProduct(c.id), null);
});

test('cache sprzed aktualizacji providera pozostaje offline, ale nie blokuje pobrania API 3.6', async () => {
  const { cache, storage, now } = setup();
  const p = product(1);
  await storage.mutate('products', p.id, () => ({ key: p.id, product: p, fetchedAt: now() }));
  await storage.mutate('searches', 'produkt', () => ({ key: 'produkt', ids: [p.id], fetchedAt: now() }));
  assert.equal((await cache.getProduct(p.id)).fresh, false);
  assert.equal((await cache.allProducts())[0].id, p.id);
  assert.equal(await cache.getSearch('produkt'), null);
  await cache.setFavorite(p, true); await cache.markUsed([p]);
  assert.equal((await cache.getProduct(p.id)).fresh, false);
  assert.deepEqual(await cache.favoriteIds(), [p.id]);
  await cache.putProducts([p]); assert.equal((await cache.getProduct(p.id)).fresh, true);
});
