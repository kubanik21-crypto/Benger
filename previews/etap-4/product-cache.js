import { copyProduct, isProduct, normalizeText } from './product-model.js?v=d9c621f21a24d07670f8e44abfdbed54027be3e3';
import { PRODUCT_DB_NAME } from './app-storage.js?v=d9c621f21a24d07670f8e44abfdbed54027be3e3';
import { normalizeFoodQuery } from './food-query.js?v=d9c621f21a24d07670f8e44abfdbed54027be3e3';

export const PRODUCT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SEARCH_TTL_MS = 15 * 60 * 1000;
// Rev 2: nazwy marek z API 3.6. Starsze kopie pozostają dostępne offline, ale nie są świeże.
export const PRODUCT_CACHE_REVISION = 2;
const STORES = ['products', 'usage', 'searches', 'meta', 'selections'];
function availableIndexedDB() {
  try { return globalThis.indexedDB; } catch { return null; }
}
const validUsage = record => record && typeof record.key === 'string' && typeof record.favorite === 'boolean'
  && (record.lastUsedAt === null || Number.isFinite(record.lastUsedAt)) && Number.isFinite(record.order);
const recentUsage = records => records.filter(validUsage).filter(record => record.lastUsedAt !== null)
  .sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.order - a.order).slice(0, 20);
const validSelection = record => record && typeof record.key === 'string' && record.key.length >= 3 && record.key.length <= 120
  && normalizeFoodQuery(record.key) === record.key && Array.isArray(record.choices) && record.choices.length > 0 && record.choices.length <= 5
  && record.choices.every(choice => choice && typeof choice.productId === 'string' && choice.productId.length > 0 && choice.productId.length <= 240
    && Number.isSafeInteger(choice.count) && choice.count > 0 && Number.isFinite(choice.lastUsedAt) && choice.lastUsedAt >= 0)
  && new Set(record.choices.map(choice => choice.productId)).size === record.choices.length;
const protectedIds = (records, selections = []) => new Set([
  ...recentUsage(records).map(record => record.key), ...records.filter(validUsage).filter(record => record.favorite).map(record => record.key),
  ...selections.filter(validSelection).flatMap(record => record.choices.map(choice => choice.productId)),
]);

// Produkty OFF są oddzielnym zbiorem. usage przechowuje tylko referencje i preferencje użytkownika.
export function createProductStorage({ indexedDBFactory = availableIndexedDB(), name = PRODUCT_DB_NAME } = {}) {
  const memory = Object.fromEntries(STORES.map(store => [store, new Map()]));
  let pendingDb;
  let persistent = false;
  let degraded = !indexedDBFactory;
  async function database() {
    if (degraded) return null;
    if (!pendingDb) pendingDb = new Promise(resolve => {
      let settled = false;
      const finish = db => {
        if (settled) { db?.close(); return; }
        settled = true; clearTimeout(timer); persistent = Boolean(db); degraded = !db; resolve(db);
      };
      const timer = setTimeout(() => finish(null), 3000);
      try {
        const request = indexedDBFactory.open(name, 2);
        request.onupgradeneeded = () => {
          for (const store of STORES) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'key' });
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); pendingDb = null; persistent = false; };
          finish(db);
        };
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
      } catch { finish(null); }
    });
    return pendingDb;
  }
  function degrade() { degraded = true; persistent = false; void pendingDb?.then(db => db?.close()); }
  async function read(store, key) {
    const db = await database();
    if (db) {
      try {
        const value = await new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readonly');
          const request = key === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(key);
          let result;
          request.onsuccess = () => { result = request.result; };
          tx.oncomplete = () => resolve(result);
          tx.onerror = tx.onabort = () => reject(tx.error);
        });
        if (key === undefined) memory[store] = new Map(value.map(record => [record.key, record]));
        else if (value === undefined) memory[store].delete(key);
        else memory[store].set(key, value);
        return structuredClone(value);
      } catch { degrade(); }
    }
    return structuredClone(key === undefined ? [...memory[store].values()] : memory[store].get(key));
  }
  async function mutate(store, key, change) {
    const db = await database();
    let next;
    if (db) {
      try {
        next = await new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          const objectStore = tx.objectStore(store);
          const request = objectStore.get(key);
          request.onsuccess = () => {
            try {
              next = change(request.result);
              if (next === null) objectStore.delete(key); else objectStore.put({ ...next, key });
            } catch (error) { tx.abort(); reject(error); }
          };
          tx.oncomplete = () => resolve(next);
          tx.onerror = tx.onabort = () => reject(tx.error);
        });
      } catch { degrade(); }
    }
    if (!persistent) next = change(structuredClone(memory[store].get(key)));
    if (next === null) memory[store].delete(key); else memory[store].set(key, { ...next, key });
    return structuredClone(next);
  }
  async function removeUnprotectedProducts(keys) {
    if (!keys.length) return;
    const db = await database();
    let removed;
    if (db) {
      try {
        removed = await new Promise((resolve, reject) => {
          // Sprawdzenie preferencji i usuwanie w jednej transakcji: inna karta nie utraci ulubionego.
          const tx = db.transaction(['products', 'usage', 'selections'], 'readwrite');
          const request = tx.objectStore('usage').getAll();
          const selectionRequest = tx.objectStore('selections').getAll();
          let usage, selections;
          let deleted = [];
          const remove = () => {
            if (!usage || !selections) return;
            const pinned = protectedIds(usage, selections);
            deleted = keys.filter(key => !pinned.has(key));
            for (const key of deleted) tx.objectStore('products').delete(key);
          };
          request.onsuccess = () => { usage = request.result; remove(); };
          selectionRequest.onsuccess = () => { selections = selectionRequest.result; remove(); };
          tx.oncomplete = () => resolve(deleted);
          tx.onerror = tx.onabort = () => reject(tx.error);
        });
      } catch { degrade(); }
    }
    if (!persistent) {
      const pinned = protectedIds([...memory.usage.values()], [...memory.selections.values()]);
      removed = keys.filter(key => !pinned.has(key));
    }
    for (const key of removed) memory.products.delete(key);
  }
  return {
    read, mutate, removeUnprotectedProducts, ready: database, persistent: () => persistent,
    async close() { const db = await pendingDb; db?.close(); pendingDb = null; persistent = false; },
  };
}

export function createProductCache({ storage = createProductStorage(), now = () => Date.now(), maxProducts = 300 } = {}) {
  const fresh = (timestamp, ttl) => Number.isFinite(timestamp) && now() - timestamp >= 0 && now() - timestamp < ttl;
  const freshProduct = record => record.revision === PRODUCT_CACHE_REVISION && fresh(record.fetchedAt, PRODUCT_TTL_MS);
  const validRecord = record => record && Number.isFinite(record.fetchedAt) && record.fetchedAt >= 0
    && isProduct(record.product) && record.product.source === 'openfoodfacts' && record.key === record.product.id;
  const getRecord = async id => {
    const record = await storage.read('products', id);
    return validRecord(record) ? record : null;
  };
  async function usage() {
    return (await storage.read('usage')).filter(validUsage);
  }
  async function recentIds() {
    return recentUsage(await usage()).map(record => record.key);
  }
  async function prune() {
    const records = (await storage.read('products')).filter(validRecord);
    const pinned = protectedIds(await usage(), await storage.read('selections'));
    const ordinary = records.filter(record => !pinned.has(record.key)).sort((a, b) => a.fetchedAt - b.fetchedAt);
    await storage.removeUnprotectedProducts(ordinary.slice(0, Math.max(0, ordinary.length - maxProducts)).map(record => record.key));
    const searches = await storage.read('searches');
    for (const record of searches.sort((a, b) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0)).slice(50)) {
      await storage.mutate('searches', record.key, () => null);
    }
  }
  async function putProducts(products, fetchedAt = now(), shouldPrune = true) {
    for (const product of products) {
      const normalized = copyProduct(product);
      if (normalized.source !== 'openfoodfacts') continue;
      await storage.mutate('products', normalized.id, previous => {
        // Nie zastępujemy jawnej podstawy 100 ml starszą odpowiedzią bez tej informacji.
        if (validRecord(previous) && freshProduct(previous)
            && previous.product.basis === 'declared' && normalized.basis === 'legacy') return previous;
        return { key: normalized.id, product: normalized, fetchedAt, revision: PRODUCT_CACHE_REVISION };
      });
    }
    if (shouldPrune) await prune();
  }
  async function ensureProducts(products) {
    for (const product of products) {
      copyProduct(product);
      if (product.source === 'openfoodfacts' && !(await getRecord(product.id))) await putProducts([product], now(), false);
    }
  }
  async function setFavorite(product, favorite) {
    copyProduct(product);
    await storage.mutate('usage', product.id, previous => ({
      key: product.id, lastUsedAt: previous?.lastUsedAt ?? null, order: previous?.order ?? 0,
      favorite: Boolean(favorite), favoriteAt: now(),
    }));
    await ensureProducts([product]);
    await prune();
  }
  return {
    ready: storage.ready, persistent: storage.persistent, close: storage.close,
    putProducts,
    async getProduct(id) { const record = await getRecord(id); return record ? { product: copyProduct(record.product), fetchedAt: record.fetchedAt, fresh: freshProduct(record) } : null; },
    async allProducts() { return (await storage.read('products')).filter(validRecord).map(record => copyProduct(record.product)); },
    async getSearch(query) {
      const record = await storage.read('searches', normalizeText(query));
      if (!record || record.revision !== PRODUCT_CACHE_REVISION || !Array.isArray(record.ids) || !fresh(record.fetchedAt, SEARCH_TTL_MS)) return null;
      const records = await Promise.all(record.ids.map(getRecord));
      if (records.some(record => !record || !freshProduct(record))) return null;
      return records.map(record => copyProduct(record.product));
    },
    async putSearch(query, products) {
      const key = normalizeText(query);
      await storage.mutate('searches', key, () => ({ key, ids: products.map(product => product.id), fetchedAt: now(), revision: PRODUCT_CACHE_REVISION }));
      await prune();
    },
    recentIds,
    async favoriteIds() { return (await usage()).filter(record => record.favorite).sort((a, b) => (b.favoriteAt ?? 0) - (a.favoriteAt ?? 0)).map(record => record.key); },
    setFavorite,
    async selectionMemory(query) {
      const record = await storage.read('selections', normalizeFoodQuery(query));
      return validSelection(record) ? structuredClone(record.choices).sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt || a.productId.localeCompare(b.productId)) : [];
    },
    async rememberSelection(query, product) {
      const key = normalizeFoodQuery(query);
      if (key.length < 3 || key.length > 120) throw new TypeError('Nieprawidłowa fraza dopasowania.');
      copyProduct(product);
      await storage.mutate('selections', key, previous => {
        const choices = validSelection(previous) ? structuredClone(previous.choices) : [];
        const choice = choices.find(item => item.productId === product.id);
        if (choice) { choice.count = Math.min(choice.count + 1, 1000000); choice.lastUsedAt = now(); }
        else choices.push({ productId: product.id, count: 1, lastUsedAt: now() });
        choices.sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt || a.productId.localeCompare(b.productId));
        return { key, choices: choices.slice(0, 5) };
      });
      await ensureProducts([product]);
      const records = (await storage.read('selections')).filter(validSelection).sort((a, b) =>
        Math.max(...b.choices.map(choice => choice.lastUsedAt)) - Math.max(...a.choices.map(choice => choice.lastUsedAt)));
      for (const record of records.slice(200)) await storage.mutate('selections', record.key, () => null);
      await prune();
    },
    async markUsed(products, usedAt = now()) {
      products.forEach(copyProduct);
      for (const product of products) {
        const sequence = await storage.mutate('meta', 'usage-sequence', previous => ({ key: 'usage-sequence', value: (Number.isSafeInteger(previous?.value) ? previous.value : 0) + 1 }));
        await storage.mutate('usage', product.id, previous => ({
          key: product.id, favorite: previous?.favorite === true, favoriteAt: previous?.favoriteAt ?? 0,
          lastUsedAt: usedAt, order: sequence.value,
        }));
      }
      await ensureProducts(products);
      await prune();
    },
    async reserveRequest(kind, interval) {
      const key = `off:${kind}:next`;
      let delay = 0;
      await storage.mutate('meta', key, previous => {
        delay = Math.max(0, (Number.isFinite(previous?.value) ? previous.value : 0) - now());
        return { key, value: delay > 0 ? previous.value : now() + interval };
      });
      return delay;
    },
    async blockRequests(delay) {
      for (const kind of ['search', 'product']) await storage.mutate('meta', `off:${kind}:next`, previous => ({
        key: `off:${kind}:next`, value: Math.max(previous?.value ?? 0, now() + delay),
      }));
    },
  };
}
