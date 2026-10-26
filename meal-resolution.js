import { calculatePortion, sumNutrition } from './nutrition.js';
import { copyProduct } from './product-model.js';

export function portionFor(intent, resolution) {
  if (!resolution.product || resolution.confidence === 'LOW') return null;
  if (intent.unit !== resolution.product.unit) return null;
  try { return { product: copyProduct(resolution.product), amount: intent.amount, nutrition: calculatePortion(resolution.product, intent.amount) }; }
  catch { return null; }
}

export function updateMealItemPortion(item, patch) {
  const intent = { ...item.intent };
  for (const key of ['amount', 'unit', 'meal']) if (Object.hasOwn(patch, key)) intent[key] = patch[key];
  return { ...item, intent, portion: portionFor(intent, item.resolution) };
}

// SpeechToText i parser dostarczą intents. Domyślnie nie ma requestu dla każdego fragmentu.
export async function resolveMealIntents(intents, { resolver, allowExternal = false, signal } = {}) {
  if (!Array.isArray(intents) || intents.length > 20) throw new TypeError('Posiłek może mieć najwyżej 20 pozycji.');
  if (intents.some(intent => !intent || typeof intent !== 'object')) throw new TypeError('Nieprawidłowa pozycja posiłku.');
  const ids = intents.map((intent, index) => intent.id ?? `food-${index + 1}`);
  if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) throw new TypeError('Pozycje muszą mieć unikalne tekstowe ID.');
  const items = [];
  let externalBudget = allowExternal ? 1 : 0;
  for (const [index, intent] of intents.entries()) {
    if (signal?.aborted) throw signal.reason;
    // Brak/nieprawidłowa ilość nie blokuje rozpoznania tożsamości; nadal blokuje porcję.
    const identity = { query: intent.query, ...(intent.barcode ? { barcode: intent.barcode } : {}),
      ...(['g', 'ml'].includes(intent.unit) ? { unit: intent.unit } : {}) };
    let resolution = await resolver.resolve(identity, { allowExternal: false, signal });
    if (resolution.reason === 'not-found' && externalBudget > 0 && intent.amount > 0 && intent.unit && !intent.issues?.length) {
      externalBudget--; resolution = await resolver.resolve(identity, { allowExternal: true, signal });
    }
    items.push({ id: ids[index], intent: { query: intent.query, barcode: intent.barcode, amount: intent.amount, unit: intent.unit,
      raw: intent.raw, structureConfidence:intent.structureConfidence, metadata:intent.metadata, meal: intent.meal, amountApproximate: intent.amountApproximate === true, source: intent.source, issues: intent.issues ?? [] },
      resolution, portion: portionFor(intent, resolution), confirmed: false });
  }
  return { items, requiresConfirmation: true };
}

// Zmiana jednej pozycji nie pobiera API i nie przelicza pozostałych wierszy.
export async function editMealItem(proposal, itemId, patch, { repository }) {
  const item = proposal.items.find(row => row.id === itemId);
  if (!item) throw new TypeError('Nie znaleziono pozycji.');
  const intent = { ...item.intent };
  for (const key of ['amount', 'unit', 'meal']) if (Object.hasOwn(patch, key)) intent[key] = patch[key];
  let resolution = item.resolution;
  if (patch.productId) {
    const product = await repository.getProductById(patch.productId);
    if (!product) throw new TypeError('Wybierz produkt z katalogu.');
    resolution = { product: copyProduct(product), confidence: 'HIGH', alternatives: [], reason: 'explicit-user-confirmation', requiresConfirmation: true };
  }
  const portion = portionFor(intent, resolution);
  return { ...proposal, items: proposal.items.map(row => row.id !== itemId ? row : {
    ...row, intent, resolution, portion, confirmed: Boolean(patch.productId) || row.confirmed,
  }) };
}

// Wymieniamy tylko jeden niepewny wiersz; rozpoznane pozycje pozostają zachowane.
export async function confirmMealItem(proposal, itemId, productId, { repository }) {
  const item = proposal.items.find(row => row.id === itemId);
  if (!item) throw new TypeError('Nie znaleziono pozycji.');
  const product = await repository.getProductById(productId);
  if (!product) throw new TypeError('Wybierz produkt z katalogu.');
  if (item.intent.unit !== product.unit) throw new TypeError('Jednostki muszą się zgadzać; nie przeliczamy gęstości.');
  const nutrition = calculatePortion(product, item.intent.amount);
  return { ...proposal, items: proposal.items.map(row => row.id !== itemId ? row : {
    ...row, confirmed: true, resolution: { product: copyProduct(product), confidence: 'HIGH', alternatives: [], reason: 'explicit-user-confirmation', requiresConfirmation: true },
    portion: { product: copyProduct(product), amount: item.intent.amount, nutrition },
  }) };
}

export function summarizeMealProposal(proposal) {
  const portions = proposal.items.filter(item => item.portion).map(item => item.portion);
  return { resolved: portions.length, unresolved: proposal.items.length - portions.length, nutrition: sumNutrition(portions.map(portion => portion.nutrition)) };
}
