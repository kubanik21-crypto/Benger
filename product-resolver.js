import { variantCompatible, phraseSimilarity } from './product-variants.js';
import { barcodeKey, copyProduct, deduplicateProducts, normalizeBarcode } from './product-model.js';
import { hasPercentageConflict, matchesFoodQuery, normalizeFoodQuery } from './food-query.js';

function validIntent(intent) {
  return intent && typeof intent === 'object'
    && (intent.amount === undefined || (typeof intent.amount === 'number' && Number.isFinite(intent.amount) && intent.amount > 0))
    && (intent.unit === undefined || ['g', 'ml'].includes(intent.unit));
}
const compatible = (product, intent) => (!intent.unit || product.unit === intent.unit) && !hasPercentageConflict(product, intent.query ?? '') && variantCompatible(product, intent.query ?? '');
const result = (product, confidence, alternatives, reason, extra = {}) => ({
  product: product ? copyProduct(product) : null, confidence,
  alternatives: deduplicateProducts(alternatives).filter(item => item.id !== product?.id).slice(0, 5),
  reason, requiresConfirmation: true, ...extra,
});

// Rozstrzyga tożsamość produktu. Nigdy nie pobiera makro z intentu ani nie zapisuje dziennika.
export function createProductResolver({ repository }) {
  async function resolve(intent, { allowExternal = false, signal } = {}) {
    if (!validIntent(intent)) return result(null, 'LOW', [], 'invalid-intent');
    const query = typeof intent.query === 'string' ? intent.query.trim() : '';
    const aliasId=await repository.resolveAlias?.(query);
    if(aliasId){const product=await repository.getProductById(aliasId);if(product && compatible(product,intent))return result(product,'HIGH',[],'explicit-user-alias');}
    const barcode = normalizeBarcode(intent.barcode ?? query);
    if (intent.barcode !== undefined && !barcode) return result(null, 'LOW', [], 'invalid-barcode');
    if (barcode) {
      const cached = (await repository.allCachedProducts()).find(product => barcodeKey(product.barcode) === barcodeKey(barcode));
      const response = cached ? { product: cached } : allowExternal ? await repository.getProductByBarcode(barcode, { signal }) : { product: null };
      if (!response.product) return result(null, 'LOW', [], 'barcode-not-available', { error: response.error?.code ?? null });
      return compatible(response.product, intent) ? result(response.product, 'HIGH', [], 'exact-barcode')
        : result(null, 'LOW', [response.product], 'unit-or-variant-mismatch');
    }
    const phrase = normalizeFoodQuery(query);
    if (phrase.length < 3 || phrase.length > 120) return result(null, 'LOW', [], 'invalid-query');
    const [memory, recent, favorites, cached] = await Promise.all([
      repository.selectionMemory(phrase), repository.recentProducts(), repository.favoriteProducts({ limit: Infinity }), repository.allCachedProducts(),
    ]);
    const preferred = (await Promise.all(memory.map(choice => repository.getProductById(choice.productId)))).filter(Boolean);
    const all = deduplicateProducts([...preferred, ...favorites, ...recent, ...cached]);
    const remembered = memory.filter(choice => all.some(product => product.id === choice.productId && compatible(product, intent)));
    const firstChoice = remembered[0];
    if (firstChoice) {
      const product = all.find(item => item.id === firstChoice.productId);
      const total = remembered.reduce((sum, choice) => sum + choice.count, 0);
      const dominant = firstChoice.count >= 2 && firstChoice.count / total >= 0.75;
      if (dominant || remembered.length === 1) return result(product, dominant && matchesFoodQuery(product,query) ? 'HIGH' : 'MEDIUM',
        all.filter(item => compatible(item, intent) && matchesFoodQuery(item, query)), dominant ? 'repeated-user-choice' : 'previous-user-choice');
    }
    const history=await repository.selectionHistory?.() ?? [];
    const similar=history.filter(record=>record.key!==phrase && !record.key.startsWith('alias ') && phraseSimilarity(record.key,phrase)>=2/3).flatMap(record=>record.choices.filter(choice=>choice.count>=2).map(choice=>({choice,score:phraseSimilarity(record.key,phrase)}))).sort((a,b)=>b.score-a.score || b.choice.count-a.choice.count);
    const related=deduplicateProducts((await Promise.all(similar.map(row=>repository.getProductById(row.choice.productId)))).filter(product=>product && compatible(product,intent) && matchesFoodQuery(product,query)));
    if(related.length===1)return result(related[0],'MEDIUM',[],'similar-confirmed-phrase');
    const eligible = all.filter(product => compatible(product, intent) && matchesFoodQuery(product, query));
    if (eligible.length === 1) {
      const product = eligible[0];
      const origin = recent.some(item => item.id === product.id) ? 'recent' : favorites.some(item => item.id === product.id) ? 'favorite' : 'local-cache';
      return result(product, 'MEDIUM', [], `unique-${origin}`);
    }
    if (eligible.length > 1) return result(null, 'LOW', eligible, 'ambiguous-products');
    const localMismatch=all.filter(product=>matchesFoodQuery(product,query));
    if(localMismatch.length)return result(null,'LOW',localMismatch,'unit-or-variant-mismatch');
    const generic=(await repository.genericMatches?.(query) ?? []).filter(product=>compatible(product,intent));
    if(generic.length===1)return result(generic[0],'MEDIUM',[],'unique-generic');
    if(generic.length>1)return result(null,'LOW',generic,'ambiguous-generic-products');
    if (allowExternal) {
      const response = await repository.searchProducts(query, { signal });
      const products = deduplicateProducts(response.products).filter(product => compatible(product, intent) && matchesFoodQuery(product, query));
      if (products.length === 1) return result(products[0], 'MEDIUM', [], 'unique-external-match', { error: response.error?.code ?? null });
      return result(null, 'LOW', products, products.length ? 'ambiguous-products' : 'not-found', { error: response.error?.code ?? null });
    }
    const differentUnit = all.filter(product => matchesFoodQuery(product, query));
    return result(null, 'LOW', differentUnit, differentUnit.length ? 'unit-or-variant-mismatch' : 'not-found');
  }
  return {
    resolve,
    async rememberUserChoice(query, productId) {
      const product = await repository.getProductById(productId);
      if (!product) throw new TypeError('Nie można zapamiętać produktu spoza katalogu.');
      await repository.rememberSelection(query, product);
    },
  };
}
