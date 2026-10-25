import { OFF_API_VERSION, OFF_APP_ID } from './product-providers/open-food-facts.js?v=0dd26ac7e3d5bd2730a15f6f4680b1b2cf734d65';
import { createCgiSearchProvider } from './product-providers/off-search.js?v=0dd26ac7e3d5bd2730a15f6f4680b1b2cf734d65';
import { createProductCache } from './product-cache.js?v=0dd26ac7e3d5bd2730a15f6f4680b1b2cf734d65';
import { ProductError, productErrorMessage } from './product-errors.js?v=0dd26ac7e3d5bd2730a15f6f4680b1b2cf734d65';

export const SEARCHALICIOUS_URL = 'https://search.openfoodfacts.org/search';
export function searchaliciousDiagnosticUrl() {
  const url = new URL(SEARCHALICIOUS_URL);
  for (const [key, value] of Object.entries({ q: 'mleko 2%', langs: 'pl,en', page: 1, page_size: 5,
    fields: 'code,product_name,product_name_pl,brands,last_modified_t,nutriments,nutrition,image_front_small_url' })) url.searchParams.set(key, value);
  return url;
}

// Porównanie transportów, bez zmiany identyfikacji używanej w aplikacji.
// JavaScript nie dostaje odpowiedzi OPTIONS. Jej faktyczny status sprawdza CDP/DevTools.
export async function compareSearchTransports({ fetchImpl = globalThis.fetch, reserve = async () => {}, onRateLimit = async () => {}, onProgress = () => {}, timeoutMs = 10000 } = {}) {
  const report = { checkedAt: new Date().toISOString(), apiVersion: OFF_API_VERSION, query: 'mleko 2%', comparisons: [] };
  for (const [variant, headers, preflightRequired] of [
    ['A: CGI + X-User-Agent', { Accept: 'application/json', 'X-User-Agent': OFF_APP_ID }, true],
    ['B: CGI simple GET', {}, false],
    ['C: CGI + Accept', { Accept: 'application/json' }, false],
    ['D: Search-a-licious simple GET', {}, false],
  ]) {
    const entry = { variant, http: null, corsReadable: false, preflightRequired,
      preflightObserved: 'Nie jest widoczny dla fetch; sprawdź DevTools Network lub raport CDP.' };
    report.comparisons.push(entry);
    onProgress(structuredClone(report));
    try {
      await reserve();
      const transport = async (url, options) => {
        entry.url = String(url);
        const response = await fetchImpl(url, { ...options, headers: headers ?? options.headers });
        entry.http = response.status; entry.corsReadable = response.type === 'cors';
        return response;
      };
      if (variant.startsWith('D:')) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await transport(searchaliciousDiagnosticUrl(), { mode: 'cors', credentials: 'omit', signal: controller.signal });
          if (response.status === 429) throw new ProductError('rate-limit', 60000);
          if (!response.ok) throw new ProductError(response.status >= 500 ? 'server' : 'response');
          let data;
          try { data = await response.json(); } catch { throw new ProductError('response'); }
          if (!Array.isArray(data?.hits)) throw new ProductError('response');
          entry.count = data.count ?? data.hits.length;
          entry.hits = data.hits.slice(0, 3).map(hit => ({
            keys: Object.keys(hit), code: hit.code ?? null, name: hit.product_name_pl ?? hit.product_name ?? null,
            brand: hit.brands ?? null, lastModified: hit.last_modified_t ?? null,
            per100: hit.nutriments ? Object.fromEntries(['energy-kcal_100g', 'proteins_100g', 'fat_100g', 'carbohydrates_100g'].map(key => [key, hit.nutriments[key] ?? null])) : null,
            aggregate: hit.nutrition?.aggregated_set ? { per: hit.nutrition.aggregated_set.per, preparation: hit.nutrition.aggregated_set.preparation } : null,
            imageUrl: hit.image_front_small_url ?? null,
          }));
          entry.indexFreshness = 'Niepotwierdzona. last_modified_t produktu nie jest datą odświeżenia indeksu; wymaga porównania z Product API.';
        } catch (error) {
          if (controller.signal.aborted) throw new ProductError('timeout');
          throw error;
        } finally { clearTimeout(timer); }
      } else {
        const provider = createCgiSearchProvider({ fetchImpl: transport, timeoutMs });
        const products = await provider.searchProducts('mleko 2%');
        entry.count = products.length; entry.products = products.slice(0, 3);
      }
      entry.ok = entry.http === 200 && entry.corsReadable && entry.count > 0;
    } catch (error) {
      entry.ok = false; entry.code = error.code ?? 'network'; entry.message = productErrorMessage(error);
      entry.networkError = entry.http === null;
      if (entry.code === 'rate-limit') { await onRateLimit(error.retryAfterMs ?? 60000); onProgress(structuredClone(report)); break; }
    }
    onProgress(structuredClone(report));
  }
  return report;
}

export function initSearchDiagnostics() {
  const button = document.getElementById('compare-off-search');
  const output = document.getElementById('search-diagnostic-report');
  if (!button) return;
  const cache = createProductCache();
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await compareSearchTransports({
        onRateLimit: delay => cache.blockRequests(delay),
        reserve: async () => {
          const delay = await cache.reserveRequest('search', 6500);
          if (delay > 0) {
            document.getElementById('search-diagnostic-status').textContent = 'Przerwa między zapytaniami zgodnie z limitem OFF…';
            await new Promise(resolve => setTimeout(resolve, delay));
            if (await cache.reserveRequest('search', 6500) > 0) throw new ProductError('throttle');
          }
        },
        onProgress: report => { output.textContent = JSON.stringify(report, null, 2); },
      });
      document.getElementById('search-diagnostic-status').textContent = 'Porównanie zakończone. Wyniki A/B/C wskazują, czy problem zależy od nagłówka; same nie dowodzą przyczyny preflight.';
    } finally { button.disabled = false; }
  });
}
