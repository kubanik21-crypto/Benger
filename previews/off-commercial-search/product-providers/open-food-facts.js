import { sourcePortions } from './source-portions.js?v=4b08409364df21d546782bfb81ac63458f986959';
import { barcodeKey, copyProduct, isProduct, normalizeBarcode, safeImageUrl } from '../product-model.js?v=4b08409364df21d546782bfb81ac63458f986959';
import { ProductError } from '../product-errors.js?v=4b08409364df21d546782bfb81ac63458f986959';
import { createOffJsonClient } from './off-http.js?v=4b08409364df21d546782bfb81ac63458f986959';

export const OFF_BASE_URL = 'https://world.openfoodfacts.org';
export const OFF_API_VERSION = '3.6';
export const OFF_REQUEST_TIMEOUT_MS = 10_000;
export const OFF_APP_ID = 'Benger/0.3 (https://github.com/kubanik21-crypto/Benger)';
const COMMON_FIELDS = ['code', 'product_name', 'product_name_pl', 'brands_tags_pl', 'quantity', 'image_front_small_url', 'last_modified_t','serving_size','serving_quantity','serving_quantity_unit','product_quantity','product_quantity_unit'];
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

// v3.6: jawna podstawa aggregated_set; starsze odpowiedzi: wyłącznie znormalizowane *_100g.
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
    // Lokalizowane nazwy wyświetla serwer OFF. Nie używamy stratnych brands_tags jako etykiety.
    name, brand: Array.isArray(raw.brands_tags_pl)
      ? [...new Set(raw.brands_tags_pl.map(value => text(value, 240)).filter(Boolean))].join(', ').slice(0, 240) || null
      : raw.brands_tags_pl === undefined ? text(raw.brands, 240) || null : null,
    unit, basis, estimated, per100,
    imageUrl: safeImageUrl(raw.image_front_small_url), quantity: text(raw.quantity, 120) || null,
    updatedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
  };
  product.portions=sourcePortions(raw,product);
  return isProduct(product) ? copyProduct(product) : null;
}

export function createOpenFoodFactsProvider({ fetchImpl = globalThis.fetch, timeoutMs = OFF_REQUEST_TIMEOUT_MS, baseUrl = OFF_BASE_URL } = {}) {
  const getJson = createOffJsonClient({ fetchImpl, timeoutMs, headers: { Accept: 'application/json', 'X-User-Agent': OFF_APP_ID } });
  function url(path) {
    const target = new URL(path, baseUrl);
    target.searchParams.set('fields', OFF_FIELDS.join(','));
    target.searchParams.set('lc', 'pl');
    return target;
  }
  return {
    source: 'openfoodfacts',
    async getProductByBarcode(value, { signal } = {}) {
      const code = normalizeBarcode(value);
      if (!code) throw new ProductError('barcode');
      const data = await getJson(url(`/api/v${OFF_API_VERSION}/product/${code}`), signal);
      if (data === null || data?.status === 0 || data?.result?.id === 'product_not_found') return null;
      if (!data || typeof data !== 'object' || !data.product) throw new ProductError('response');
      if(barcodeKey(normalizeBarcode(String(data.product.code??'')))!==barcodeKey(code))throw new ProductError('response');
      const product = normalizeOffProduct(data.product);
      if(!product)throw new ProductError('nutrition');
      if (product && barcodeKey(product.barcode) !== barcodeKey(code)) throw new ProductError('response');
      return product;
    },
  };
}
