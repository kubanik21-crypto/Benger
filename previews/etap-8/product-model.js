import { isPortionDefinition, copyPortionDefinition } from './portion-model.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
export const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs'];

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l')
    .replace(/Ł/g, 'L').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeBarcode(value) {
  if (typeof value !== 'string') return null;
  const code = value.replace(/\s/g, '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return null;
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(code[i]) * weight;
  return (10 - sum % 10) % 10 === Number(code.at(-1)) ? code : null;
}

export function barcodeKey(code) {
  const valid = normalizeBarcode(code);
  return valid ? valid.padStart(14, '0') : null;
}

export function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'images.openfoodfacts.org'
      && !url.username && !url.password && !url.port && url.pathname.startsWith('/images/products/')
      && url.href.length <= 2048 ? url.href : null;
  } catch { return null; }
}

export function isProduct(product) {
  return product !== null && typeof product === 'object'
    && ['id', 'source', 'sourceId', 'name'].every(key => typeof product[key] === 'string' && product[key].trim() !== '' && product[key].length <= 240)
    && (product.brand === null || (typeof product.brand === 'string' && product.brand.length <= 240))
    && (product.barcode === null || normalizeBarcode(product.barcode) === product.barcode)
    && ['g', 'ml'].includes(product.unit)
    && ['declared', 'legacy'].includes(product.basis)
    && (product.estimated === undefined || typeof product.estimated === 'boolean')
    && product.per100 !== null && typeof product.per100 === 'object'
    && NUTRIENTS.every(key => typeof product.per100[key] === 'number' && Number.isFinite(product.per100[key])
      && product.per100[key] >= 0 && product.per100[key] <= (product.unit === 'ml' ? (key === 'kcal' ? 10000 : 1000) : (key === 'kcal' ? 1000 : 100)))
    // Limit masy dotyczy 100 g; bez gęstości nie wolno narzucać go 100 ml.
    && (product.unit === 'ml' || product.per100.protein + product.per100.fat + product.per100.carbs <= 101)
    && (product.imageUrl === null || safeImageUrl(product.imageUrl) === product.imageUrl)
    && (product.quantity === null || (typeof product.quantity === 'string' && product.quantity.length <= 120))
    && (product.source !== 'usda' || ['description','category','dataType'].every(key=>product[key]===undefined || typeof product[key]==='string' && product[key].length<=240))
    && (product.portions === undefined || Array.isArray(product.portions) && product.portions.length <= 30 && product.portions.every(d=>isPortionDefinition(d)&&d.productId===product.id&&d.normalizedUnit===product.unit))
    && (product.updatedAt === null || (typeof product.updatedAt === 'string' && Number.isFinite(Date.parse(product.updatedAt))));
}

// Zwraca tylko publiczny model Bengera; żadne pola surowej odpowiedzi API nie przechodzą dalej.
export function copyProduct(product) {
  if (!isProduct(product)) throw new TypeError('Nieprawidłowe dane produktu.');
  return {
    id: product.id, source: product.source, sourceId: product.sourceId, barcode: product.barcode,
    name: product.name, brand: product.brand, unit: product.unit, basis: product.basis, estimated: product.estimated ?? false,
    nutritionCompleteness: 'COMPLETE',
    ...(product.portions ? {portions:product.portions.map(copyPortionDefinition)} : {}),
    per100: Object.fromEntries(NUTRIENTS.map(key => [key, product.per100[key]])),
    imageUrl: product.imageUrl, quantity: product.quantity, updatedAt: product.updatedAt,
    ...(product.source === 'usda' ? {description:product.description ?? product.name,category:product.category ?? 'Unknown',dataType:product.dataType ?? 'Unknown'} : {}),
  };
}

export function deduplicateProducts(products) {
  const result = [];
  const seen = new Set();
  for (const product of products) {
    if (!isProduct(product)) continue;
    const barcode = barcodeKey(product.barcode);
    const key = barcode ? `barcode:${barcode}` : `source:${product.source}:${product.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(copyProduct(product));
  }
  return result;
}

export function searchProducts(products, query, limit = 20) {
  const text = normalizeText(query);
  const words = text.split(' ').filter(Boolean);
  return deduplicateProducts(products)
    .map(product => {
      const name = normalizeText(product.name);
      const combined = `${name} ${normalizeText(product.brand)}`;
      const matches = words.every(word => combined.includes(word));
      return { product, score: name === text ? 3 : name.startsWith(text) ? 2 : 1, matches };
    })
    .filter(item => item.matches)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'pl'))
    .slice(0, limit).map(item => item.product);
}

export const productSourceLabel = product => ({openfoodfacts:'Open Food Facts',benger:'Archiwalny produkt',usda:'USDA · żywność ogólna',custom:'Własny produkt'})[product.source] ?? product.source;

export function nutritionCompleteness(product){
 const count=NUTRIENTS.filter(key=>typeof product?.per100?.[key]==='number'&&Number.isFinite(product.per100[key])&&product.per100[key]>=0).length;
 return count===4?'COMPLETE':count?'PARTIAL':'INSUFFICIENT';
}
