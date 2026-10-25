import { OFF_API_VERSION, OFF_BASE_URL, OFF_FIELDS, normalizeOffProduct } from './open-food-facts.js?v=91447d0038b127b18d80268fa403a0b6de5bf77e';
import { createOffJsonClient } from './off-http.js?v=91447d0038b127b18d80268fa403a0b6de5bf77e';
import { ProductError } from '../product-errors.js?v=91447d0038b127b18d80268fa403a0b6de5bf77e';

export function validateSearchQuery(query) {
  const term = typeof query === 'string' ? query.trim().replace(/\s+/g, ' ') : '';
  if (term.length < 3 || term.length > 120) throw new ProductError('query');
  return term;
}

export function cgiSearchUrl(query) {
  const url = new URL('/cgi/search.pl', OFF_BASE_URL);
  for (const [key, value] of Object.entries({ search_terms: validateSearchQuery(query), search_simple: 1, action: 'process', json: 1,
    api_version: OFF_API_VERSION, lc: 'pl', fields: OFF_FIELDS.join(','), page: 1, page_size: 20 })) url.searchParams.set(key, value);
  return url;
}

export function normalizeSearchResponse(data) {
  if (!data || !Array.isArray(data.products)) throw new ProductError('response');
  return data.products.slice(0, 20).map(normalizeOffProduct).filter(Boolean);
}

export function createCgiSearchProvider({ fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  // Produkcyjny pomiar z Pages: Accept-only zwraca JSON+CORS, wariant z XUA zawiódł.
  // Nie udajemy custom User-Agent parametrem GET. Lookup nadal używa XUA.
  const getJson = createOffJsonClient({ fetchImpl, timeoutMs, headers: { Accept: 'application/json' } });
  return {
    id: 'off-cgi-v3.6-accept',
    async searchProducts(query, { signal } = {}) { return normalizeSearchResponse(await getJson(cgiSearchUrl(query), signal)); },
  };
}

export const defaultSearchProvider = createCgiSearchProvider;
