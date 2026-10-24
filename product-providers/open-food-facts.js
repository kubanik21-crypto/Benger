import { barcodeKey, copyProduct, isProduct, normalizeBarcode, safeImageUrl } from '../product-model.js';
import { ProductError } from '../product-errors.js';

export const OFF_BASE_URL = 'https://world.openfoodfacts.org';
export const OFF_REQUEST_TIMEOUT_MS = 10_000;
export const OFF_APP_ID = 'Benger/0.3 (https://github.com/kubanik21-crypto/Benger)';
const COMMON_FIELDS = ['code', 'product_name', 'product_name_pl', 'brands', 'quantity', 'image_front_small_url', 'last_modified_t'];
export const OFF_FIELDS = [
  ...COMMON_FIELDS, 'nutrition.aggregated_set.per', 'nutrition.aggregated_set.preparation',
  ...['energy-kcal', 'proteins', 'fat', 'carbohydrates'].map(key => `nutrition.aggregated_set.nutrients.${key}`),
];
const legacyKeys = { kcal: 'energy-kcal_100g', protein: 'proteins_100g', fat: 'fat_100g', carbs: 'carbohydrates_100g' };
const currentKeys = { kcal: 'energy-kcal', protein: 'proteins', fat: 'fat', carbs: 'carbohydrates' };

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

// v3.5: jawna podstawa aggregated_set; starsze odpowiedzi: wyłącznie znormalizowane *_100g.
// Nie wyliczamy kcal z kJ ani gęstości z wielkości opakowania.
export function normalizeOffProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sourceId = text(raw.code, 24);
  const name = text(raw.product_name_pl, 240) || text(raw.product_name, 240);
  if (!/^\d{1,24}$/.test(sourceId) || !name) return null;
  const aggregate = raw.nutrition?.aggregated_set;
  let unit = 'g', basis = 'legacy', estimated = false;
  const per100 = {};
  if (aggregate !== undefined) {
    if (!aggregate || !['100g', '100ml'].includes(aggregate.per) || aggregate.preparation !== 'as_sold') return null;
    unit = aggregate.per === '100ml' ? 'ml' : 'g';
    basis = 'declared';
    for (const [key, offKey] of Object.entries(currentKeys)) {
      const nutrient = aggregate.nutrients?.[offKey];
      if (!nutrient || nutrient.unit !== (key === 'kcal' ? 'kcal' : 'g')
          || (nutrient.modifier && nutrient.modifier !== '~')) return null;
      per100[key] = number(nutrient.value);
      estimated ||= nutrient.modifier === '~' || nutrient.source === 'estimate';
    }
  } else {
    for (const [key, offKey] of Object.entries(legacyKeys)) per100[key] = number(raw.nutriments?.[offKey]);
  }
  const barcode = normalizeBarcode(sourceId);
  const modified = number(raw.last_modified_t);
  const date = modified !== null && modified > 0 ? new Date(modified * 1000) : null;
  const product = {
    id: `off:${barcodeKey(barcode) ?? sourceId}`, source: 'openfoodfacts', sourceId, barcode,
    name, brand: text(raw.brands, 240) || null, unit, basis, estimated, per100,
    imageUrl: safeImageUrl(raw.image_front_small_url), quantity: text(raw.quantity, 120) || null,
    updatedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
  };
  return isProduct(product) ? copyProduct(product) : null;
}

function retryDelay(value) {
  if (value === null) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(60_000, Math.min(Number.MAX_SAFE_INTEGER - Date.now(), seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(60_000, date - Date.now()) : 60_000;
}

export function createOpenFoodFactsProvider({ fetchImpl = globalThis.fetch, timeoutMs = OFF_REQUEST_TIMEOUT_MS, baseUrl = OFF_BASE_URL } = {}) {
  async function getJson(url, signal) {
    if (signal?.aborted) throw new ProductError('cancelled');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    let timer;
    try {
      const operation = (async () => {
        const response = await fetchImpl(url.href, {
          method: 'GET', mode: 'cors', credentials: 'omit',
          headers: { Accept: 'application/json', 'X-User-Agent': OFF_APP_ID }, signal: controller.signal,
        });
        if (response.status === 429) throw new ProductError('rate-limit', retryDelay(response.headers.get('Retry-After')));
        if (response.status >= 500) throw new ProductError('server');
        if (response.status === 404) return null;
        if (!response.ok) throw new ProductError('response');
        try { return await response.json(); } catch { throw new ProductError('response'); }
      })();
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new ProductError('timeout')); }, timeoutMs);
      });
      return await Promise.race([operation, deadline]);
    } catch (error) {
      if (timedOut) throw new ProductError('timeout');
      if (signal?.aborted) throw new ProductError('cancelled');
      if (error instanceof ProductError) throw error;
      throw new ProductError('network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  function url(path) {
    const target = new URL(path, baseUrl);
    target.searchParams.set('fields', OFF_FIELDS.join(','));
    target.searchParams.set('lc', 'pl');
    return target;
  }
  return {
    source: 'openfoodfacts',
    async search(query, { signal } = {}) {
      const term = typeof query === 'string' ? query.trim().replace(/\s+/g, ' ') : '';
      if (term.length < 3 || term.length > 120) throw new ProductError('query');
      // Oficjalne CGI obsługuje pełny tekst i api_version; /api/v2/search nie obsługuje search_terms.
      const target = url('/cgi/search.pl');
      for (const [key, value] of Object.entries({ search_terms: term, search_simple: 1, action: 'process', json: 1, api_version: '3.5', page: 1, page_size: 20 })) target.searchParams.set(key, value);
      const data = await getJson(target, signal);
      if (!data || !Array.isArray(data.products)) throw new ProductError('response');
      return data.products.slice(0, 20).map(normalizeOffProduct).filter(Boolean);
    },
    async getProductByBarcode(value, { signal } = {}) {
      const code = normalizeBarcode(value);
      if (!code) throw new ProductError('barcode');
      const data = await getJson(url(`/api/v3.5/product/${code}`), signal);
      if (data === null || data?.status === 0 || data?.result?.id === 'product_not_found') return null;
      if (!data || typeof data !== 'object' || !data.product) throw new ProductError('response');
      const product = normalizeOffProduct(data.product);
      if (product && barcodeKey(product.barcode) !== barcodeKey(code)) throw new ProductError('response');
      return product;
    },
  };
}
