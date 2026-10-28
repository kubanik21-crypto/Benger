import {parseProductQuery} from './product-query.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import {rankProductCandidates} from './product-matching.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { createPortionRepository } from './portion-repository.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { createUsdaProvider } from './product-providers/usda.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { createCustomProvider } from './product-providers/custom.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { barcodeKey, copyProduct, deduplicateProducts, normalizeBarcode, normalizeText, searchProducts } from './product-model.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { createOpenFoodFactsProvider } from './product-providers/open-food-facts.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { createProductCache } from './product-cache.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { ProductError } from './product-errors.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { defaultSearchProvider } from './product-providers/off-search.js?v=2cd6943878b18f1baff06f924c897fa580672a97';

export const SEARCH_INTERVAL_MS = 6500; // poniżej 10 wyszukiwań/minutę
export const PRODUCT_INTERVAL_MS = 4500; // poniżej 15 odczytów produktu/minutę

export function createProductRepository({ portions = createPortionRepository(), generic = createUsdaProvider(), custom = createCustomProvider(), remote = createOpenFoodFactsProvider(), searchProvider = defaultSearchProvider(), cache = createProductCache(), isOnline = () => globalThis.navigator?.onLine !== false } = {}) {
  const inFlight = new Map();
  const fromCache = async id => {
    if(id.startsWith('usda:'))return await generic.getById(id).catch(()=>null) ?? (await cache.getProduct(id))?.product ?? null;
    return await custom.getById(id) ?? (await cache.getProduct(id))?.product ?? null;
  };
  const localMatches = async raw => {
    const query=parseProductQuery(raw).normalizedQuery;
    const [own, starred, used, cached, usda] = await Promise.all([custom.list(), productsFor(await cache.favoriteIds()), productsFor(await cache.recentIds()), cache.allProducts(), generic.search(query).catch(()=>[])]);
    const alias = await cache.resolveAlias(raw)??await cache.resolveAlias(parseProductQuery(raw).intent.query)??await cache.resolveAlias(query);
    return rankProductCandidates(deduplicateProducts([...(alias ? await productsFor([alias]) : []), ...searchProducts([...own,...starred,...used,...cached.map(p=>usda.find(fresh=>fresh.id===p.id)??p)],query), ...usda]),query).slice(0,20).map(r=>r.product);
  };
  const merge = (products,query) => rankProductCandidates(deduplicateProducts(products),query).slice(0,20).map(r=>r.product);
  async function request(key, kind, operation) {
    if (inFlight.has(key)) return inFlight.get(key);
    const pending = (async () => {
      const delay = await cache.reserveRequest(kind, kind === 'search' ? SEARCH_INTERVAL_MS : PRODUCT_INTERVAL_MS);
      if (delay > 0) throw new ProductError('throttle', delay);
      try { return await operation(); }
      catch (error) {
        if (error.code === 'rate-limit') await cache.blockRequests(error.retryAfterMs);
        throw error;
      }
    })();
    inFlight.set(key, pending);
    try { return await pending; } finally { inFlight.delete(key); }
  }
  function failure(error) {
    return error instanceof ProductError ? error : new ProductError(isOnline() ? 'network' : 'offline');
  }
  async function productsFor(ids) {
    return (await Promise.all(ids.map(fromCache))).filter(Boolean).map(copyProduct);
  }
  return {
    ready: cache.ready,
    portions,
    customProducts: custom.list,
    saveCustomProduct: (input,id) => custom.save(input,id),
    deleteCustomProduct: id => custom.remove(id),
    genericMatches: query => generic.search(parseProductQuery(query).normalizedQuery).catch(()=>[]),
    findLocalProducts: localMatches,
    async similarProducts(query){const term=parseProductQuery(query).normalizedQuery;const cached=await this.allCachedProducts(),genericSuggestions=await generic.search(term,{partial:true}).catch(()=>[]);return rankProductCandidates(deduplicateProducts([...cached,...genericSuggestions]),term).filter(r=>r.similarity>=.5).sort((a,b)=>b.similarity-a.similarity||b.score-a.score).slice(0,5).map(r=>r.product);},
    async allCachedProducts() { return deduplicateProducts([...(await custom.list()), ...(await cache.allProducts())]); },
    getProductById: fromCache,
    persistent: cache.persistent,
    async searchProducts(query, options = {}) {
      // Keep the user's commercial name, brand and Polish accents for OFF.
      const term = typeof query === 'string' ? query.trim().replace(/\s+/g,' ') : '';
      if (term.length < 3 || term.length > 120) throw new ProductError('query');
      const available = await localMatches(query);
      if (options.allowExternal === false) return {products:available,status:isOnline()?'local':'offline',error:null};
      if (available.some(p=>p.source==='usda'||p.source==='custom') && !options.forceExternal && !options.refreshExternal) return {products:available,status:isOnline()?'local':'offline',error:isOnline()?null:new ProductError('offline')};
      if (!isOnline()) return { products: available, status: 'offline', error: new ProductError('offline') };
      const searchKey = `${searchProvider.id ?? 'custom'}:${term}`;
      const cached = await cache.getSearch(searchKey);
      if (cached !== null && !options.refreshExternal) return { products: merge(options.forceExternal?[...cached,...available]:[...available,...cached],term), status: 'cached', error: null };
      try {
        let diagnostics=null;
        const products = await request(`search:${normalizeText(searchKey)}`, 'search', () => searchProvider.searchProducts(term, {...options,onDiagnostics:value=>{diagnostics=value;}}));
        await cache.putProducts(products);
        await cache.putSearch(searchKey, products);
        const normalized = await productsFor(products.map(product => product.id));
        return { products: merge(options.forceExternal?[...normalized,...(await localMatches(term))]:[...(await localMatches(term)),...normalized],term), status: 'online', remoteCount:normalized.length, rejectedCount:diagnostics?.rejected??0, error: null };
      } catch (error) {
        return { products: merge([...available,...(cached??[])],term), status: 'fallback', error: failure(error) };
      }
    },
    async getProductByBarcode(value, options = {}) {
      const barcode = normalizeBarcode(value);
      if (!barcode) throw new ProductError('barcode');
      const own=(await custom.list()).find(product=>barcodeKey(product.barcode)===barcodeKey(barcode));
      if(own)return {product:own,status:'local',error:null};
      const records = await cache.allProducts();
      const existing = records.find(product => barcodeKey(product.barcode) === barcodeKey(barcode));
      const record = existing ? await cache.getProduct(existing.id) : null;
      if (record?.fresh) return { product: record.product, status: isOnline() ? 'cached' : 'offline', error: isOnline() ? null : new ProductError('offline') };
      if (!isOnline()) return { product: existing ?? null, status: 'offline', error: new ProductError('offline') };
      try {
        const product = await request(`barcode:${barcodeKey(barcode)}`, 'product', () => remote.getProductByBarcode(barcode, options));
        if (product) await cache.putProducts([product]);
        return { product: product ? copyProduct(product) : null, status: 'online', error: null };
      } catch (error) {
        return { product: existing ?? null, status: 'fallback', error: failure(error) };
      }
    },
    async recentProducts() { return productsFor(await cache.recentIds()); },
    async favoriteProducts({ limit = 20 } = {}) { return productsFor((await cache.favoriteIds()).slice(0, limit)); },
    favoriteIds: cache.favoriteIds,
    setFavorite: cache.setFavorite,
    markUsed: cache.markUsed,
    selectionHistory: cache.selectionHistory,
    async createAlias(query,productId){const product=await fromCache(productId);if(!product)throw new TypeError('Produkt nie istnieje w katalogu.');await cache.createAlias(query,product);},
    resolveAlias: cache.resolveAlias,
    listAliases: cache.listAliases,
    removeAlias: cache.removeAlias,
    selectionMemory: cache.selectionMemory,
    rememberSelection: cache.rememberSelection,
    async seedRecentFromDiary(entries) {
      if ((await cache.recentIds()).length) return;
      // Starsze wpisy Etapu 2 mogą wskazywać wyłącznie katalog lokalny.
      const seen = new Set();
      const recent = entries.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .filter(entry => { if (seen.has(entry.productId)) return false; seen.add(entry.productId); return true; }).slice(0, 20).reverse();
      for (const entry of recent) {
        const product = await fromCache(entry.productId);
        if (product) await cache.markUsed([product], Date.parse(entry.createdAt));
      }
    },
    async close(){await Promise.all([cache.close(),custom.close(),portions.close()]);},
  };
}
