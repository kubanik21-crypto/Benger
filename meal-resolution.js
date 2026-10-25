import { calculatePortion, sumNutrition } from './nutrition.js';
import { copyProduct } from './product-model.js';

function portionFor(intent, resolution) {
  if (!resolution.product || resolution.confidence === 'LOW') return null;
  if (intent.unit !== resolution.product.unit) return null;
  try { return { product: copyProduct(resolution.product), amount: intent.amount, nutrition: calculatePortion(resolution.product, intent.amount) }; }
  catch { return null; }
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
    let resolution = await resolver.resolve(intent, { allowExternal: false, signal });
    if (resolution.reason === 'not-found' && externalBudget > 0) {
      externalBudget--; resolution = await resolver.resolve(intent, { allowExternal: true, signal });
    }
    items.push({ id: ids[index], intent: { query: intent.query, barcode: intent.barcode, amount: intent.amount, unit: intent.unit },
      resolution, portion: portionFor(intent, resolution), confirmed: false });
  }
  return { items, requiresConfirmation: true };
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
