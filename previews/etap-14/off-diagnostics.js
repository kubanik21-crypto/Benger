import { createOpenFoodFactsProvider, OFF_API_VERSION, OFF_APP_ID } from './product-providers/open-food-facts.js?v=b5beacd427a1599d5871763248ff0efa67408024';
import { createProductCache } from './product-cache.js?v=b5beacd427a1599d5871763248ff0efa67408024';
import { productErrorMessage, ProductError } from './product-errors.js?v=b5beacd427a1599d5871763248ff0efa67408024';
import { createCgiSearchProvider } from './product-providers/off-search.js?v=b5beacd427a1599d5871763248ff0efa67408024';
import { initSearchDiagnostics } from './off-search-diagnostics.js?v=b5beacd427a1599d5871763248ff0efa67408024';

const $ = id => document.getElementById(id);
let report = null;
const cache = createProductCache();

async function inspectImage(product) {
  if (!product?.imageUrl) return { available: false, loaded: false };
  return new Promise(resolve => {
    const image = new Image();
    const finish = loaded => { clearTimeout(timer); image.onload = image.onerror = null; if (!loaded) image.removeAttribute('src'); resolve({ available: true, loaded, url: product.imageUrl }); };
    const timer = setTimeout(() => finish(false), 5000);
    image.onload = () => finish(true); image.onerror = () => finish(false);
    image.referrerPolicy = 'no-referrer'; image.src = product.imageUrl;
  });
}

$('run-off-diagnostics').addEventListener('click', async () => {
  const button = $('run-off-diagnostics');
  if (button.disabled) return;
  button.disabled = true; $('download-off-report').disabled = true;
  $('diagnostic-status').textContent = 'Sprawdzam prawdziwe odpowiedzi Open Food Facts…';
  report = { checkedAt: new Date().toISOString(), page: location.href, apiVersion: OFF_API_VERSION,
    identification: { search: 'Native browser User-Agent; Accept only', barcode: OFF_APP_ID },
    requests: [], search: null, barcode: null, passed: false };
  const captureFetch = async (url, options) => {
    const entry = { url, requestHeaders: { ...options.headers }, http: null, corsReadable: false };
    report.requests.push(entry);
    try { const response = await fetch(url, options); entry.http = response.status; entry.corsReadable = response.type === 'cors'; return response; }
    catch { entry.networkError = true; throw new ProductError('network'); }
  };
  const provider = createOpenFoodFactsProvider({ fetchImpl: captureFetch });
  const searchProvider = createCgiSearchProvider({ fetchImpl: captureFetch });
  async function run(kind, interval, operation) {
    try {
      const delay = await cache.reserveRequest(kind, interval);
      if (delay > 0) throw new ProductError('throttle', delay);
      const value = await operation();
      const product = Array.isArray(value) ? value.find(item => item.brand && item.imageUrl) ?? value[0] : value;
      return { ok: Boolean(product), count: Array.isArray(value) ? value.length : Number(Boolean(value)), product: product ?? null, image: await inspectImage(product) };
    } catch (error) {
      if (error.code === 'rate-limit') await cache.blockRequests(error.retryAfterMs);
      return { ok: false, code: error.code ?? 'network', message: productErrorMessage(error) };
    }
  }
  try {
    report.search = await run('search', 6500, () => searchProvider.searchProducts('mleko 2%'));
    report.barcode = await run('product', 4500, () => provider.getProductByBarcode('3017620422003'));
    report.passed = report.search.ok && report.barcode.ok
      && Boolean(report.search.product?.brand) && Boolean(report.barcode.product?.brand)
      && report.requests.length === 2 && report.requests.every(item => item.http === 200 && item.corsReadable)
      && [report.search, report.barcode].every(item => !item.image.available || item.image.loaded);
  } catch {
    report.error = 'Nie udało się zakończyć diagnostyki.';
  } finally {
    $('diagnostic-report').textContent = JSON.stringify(report, null, 2);
    $('diagnostic-status').textContent = report.passed ? 'API odpowiedziało poprawnie. Raport zawiera rzeczywiste produkty i wartości.' : 'Test nie potwierdził połączenia. Szczegóły znajdują się w raporcie.';
    button.disabled = false; $('download-off-report').disabled = false;
  }
});
$('download-off-report').addEventListener('click', () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'benger-off-diagnostic.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.documentElement.dataset.diagnosticsReady = 'true';
initSearchDiagnostics();
