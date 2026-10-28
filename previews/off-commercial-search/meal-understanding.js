import {parseProductQuery,normalizeProductInput} from './product-query.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { segmentFoodText } from './food-segmentation.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { tokenizeFood } from './food-tokenizer.js?v=2cd6943878b18f1baff06f924c897fa580672a97';

export const MEAL_LABELS = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąska' };
const meals = { sniadanie: 'breakfast', sniadania: 'breakfast', obiad: 'lunch', obiadu: 'lunch', kolacja: 'dinner', kolacje: 'dinner', kolacji: 'dinner', przekaska: 'snack', przekaske: 'snack', przekaski: 'snack' };
const mealPattern = () => /\b(?:na\s+)?(sniadanie|sniadania|obiad|obiadu|kolacja|kolacje|kolacji|przekaska|przekaske|przekaski)\b/g;

export function normalizeMealText(text) {
  return normalizeProductInput(text);
}

export function splitFoodSegments(text) {
  return segmentFoodText(text);
}
function readFoodIntent(source,index,meal){return {...parseProductQuery(source,{normalized:true}).intent,id:`food-${index+1}`,meal};}

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
