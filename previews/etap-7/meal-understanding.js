import { HOUSEHOLD_UNITS } from './portion-model.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { canonicalWord } from './food-language.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { normalizeTranscript } from './transcript-normalizer.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { segmentFoodText } from './food-segmentation.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { tokenizeFood } from './food-tokenizer.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { normalizeText } from './product-model.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { normalizeFoodQuery } from './food-query.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { readPolishNumber } from './polish-numbers.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';

export const MEAL_LABELS = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąska' };
const meals = { sniadanie: 'breakfast', sniadania: 'breakfast', obiad: 'lunch', obiadu: 'lunch', kolacja: 'dinner', kolacje: 'dinner', kolacji: 'dinner', przekaska: 'snack', przekaske: 'snack', przekaski: 'snack' };
const mealPattern = () => /\b(?:na\s+)?(sniadanie|sniadania|obiad|obiadu|kolacja|kolacje|kolacji|przekaska|przekaske|przekaski)\b/g;
const unitNames = { ...Object.fromEntries(Object.keys(HOUSEHOLD_UNITS).map(unit=>[unit,unit])), piece:'piece',slice:'slice',tablespoon:'tablespoon',teaspoon:'teaspoon', g: 'g', gram: 'g', grama: 'g', gramy: 'g', gramow: 'g', ml: 'ml', mililitr: 'ml', mililitra: 'ml', mililitry: 'ml', mililitrow: 'ml' };
const quantityPattern = () => /(?<![\d.,+\-])([+\-]?[\d.,]+)\s*(piece|slice|slab|tablespoon|teaspoon|cup|mug|package|serving|handful|scoop|mililitrow|mililitry|mililitra|mililitr|ml|gramow|gramy|grama|gram|g)(?![a-z])/g;
const helpers = /\b(?:zjadlem|zjadlam|jadlem|jadlam|wypilem|wypilam|pije|jem|dzisiaj|dzis|potem|nastepnie|takze|mialem|mialam|jeszcze|chyba|do tego|na koniec)\b/g;
const approximation = /\b(?:okolo|jakies|mniej wiecej(?: tak)?)\b/g;

export function normalizeMealText(text) {
  return normalizeTranscript(text).normalizedTranscript;
}
function productQuery(text) {
  let query = text.replace(/^[\s:.,!?]+|[\s:.,!?]+$/g, '').replace(/\s+/g, ' ').trim();
  query = query.split(' ').map(word => canonicalWord(word)).join(' ');
  if (query === 'platki') query = 'platki owsiane';
  if (query === 'jogurt') query = 'jogurt naturalny';
  return query;
}
export function splitFoodSegments(text) {
  return segmentFoodText(text);
}
function readFoodIntent(source, index, meal) {
  const issues = [];
  const quantities = [...source.matchAll(quantityPattern())];
  let amount = null, unit = null;
  const hedgedNumber = source.match(/\bchyba z ([a-z ]+)$/);
  const hedgedAmount = hedgedNumber ? readPolishNumber(hedgedNumber[1]) : null;
  const amountApproximate = hedgedAmount !== null || approximation.test(source); approximation.lastIndex = 0;
  let rest = source.replace(approximation, ' ').replace(helpers, ' ');
  if (quantities.length === 1) {
    const quantity = quantities[0];
    unit = unitNames[quantity[2]];
    if (/^\d+(?:[.,]\d+)?$/.test(quantity[1])) amount = Number(quantity[1].replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { amount = null; issues.push({ code: 'invalid-amount', message: 'Podaj dodatnią ilość, np. 100 lub 50,5.' }); }
    rest = rest.replace(quantity[0], ' ');
  } else if (quantities.length > 1) issues.push({ code: 'ambiguous-amount', message: 'Oddziel produkty słowem „i” lub przecinkiem; podaj jedną ilość dla pozycji.' });
  else {
    // Sama liczba przy nazwie nie daje prawa do zgadywania jednostki. Procent zostaje nazwą.
    if (hedgedAmount !== null && hedgedAmount > 0) {
      amount = hedgedAmount;
      rest = rest.replace(/\bz [a-z ]+$/, ' ');
    }
    const bare = [...rest.matchAll(/(?<![\d.,+\-])([+\-]?[\d.,]+)(?![\d.,%])(?!\s*%)/g)];
    if (bare.length === 1 && /^\d+(?:[.,]\d+)?$/.test(bare[0][1])) {
      const value = Number(bare[0][1].replace(',', '.'));
      if (Number.isFinite(value) && value > 0) { amount = value; rest = rest.replace(bare[0][0], ' '); }
    }
    issues.push({ code: amount === null ? 'missing-amount' : 'missing-unit', message: amount === null ? 'Podaj ilość i jednostkę. Nie zgadujemy porcji.' : 'Wybierz jednostkę ilości: g albo ml.' });
  }
  const query = productQuery(rest);
  if (!query || !/[a-z]/.test(query)) issues.push({ code: 'missing-product', message: 'Podaj nazwę produktu.' });
  if (query.length > 120) issues.push({ code: 'long-query', message: 'Skróć nazwę produktu do 120 znaków.' });
  return { id: `food-${index + 1}`, raw: source, source, query, amount, unit, amountApproximate, meal, issues, structureConfidence: issues.some(issue => !['missing-unit', 'mass-required'].includes(issue.code)) ? 'LOW' : amountApproximate || !unit ? 'MEDIUM' : 'HIGH', metadata: {} };
}

// Rozumie tekst, ale nie wyszukuje produktów, nie oblicza makro i niczego nie zapisuje.
export function understandMeal(text, { defaultMeal } = {}) {
  const issues = [];
  let meal = Object.hasOwn(MEAL_LABELS, defaultMeal) ? defaultMeal : null;
  if (typeof text !== 'string' || !text.trim()) return { meal, intents: [], issues: [{ code: 'empty-text', message: 'Powiedz lub wpisz opis posiłku.' }] };
  if (text.length > 2000) return { meal, intents: [], issues: [{ code: 'long-text', message: 'Opis może mieć najwyżej 2000 znaków.' }] };
  const normalized = normalizeMealText(text);
  const found = [...new Set([...normalized.matchAll(mealPattern())].map(match => meals[match[1]]))];
  if (found.length === 1) [meal] = found;
  if (found.length > 1) { meal = null; issues.push({ code: 'ambiguous-meal', message: 'W opisie są różne posiłki. Opisz jeden posiłek i przeanalizuj ponownie.' }); }
  if (!meal && !found.length) issues.push({ code: 'missing-meal', message: 'Wybierz posiłek lub podaj jego nazwę w tekście.' });
  const content = normalized.replace(mealPattern(), ' ').replace(/^[\s:]+/, '');
  if (/^(?:i|oraz)\b|\b(?:i|oraz)\s*[,.!?]*$|\b(?:i|oraz)\s+(?:i|oraz)\b/.test(content)) issues.push({ code: 'incomplete-list', message: 'Lista jest niedokończona. Uzupełnij produkt po „i” lub „oraz”.' });
  const segments = splitFoodSegments(content);
  if (segments.length > 20) return { meal, intents: [], issues: [{ code: 'too-many-items', message: 'Jedna propozycja może mieć najwyżej 20 produktów.' }] };
  const intents = segments.map((source, index) => readFoodIntent(source, index, meal));
  return { meal, intents, issues, rawTranscript:text, normalizedTranscript:normalized, tokens:tokenizeFood(normalized), segments };
}
