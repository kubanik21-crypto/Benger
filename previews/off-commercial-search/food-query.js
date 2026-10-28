import {rankProductCandidates} from './product-matching.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { replaceSpokenNumbers } from './polish-numbers.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { canonicalWord } from './food-language.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
import { normalizeText } from './product-model.js?v=2cd6943878b18f1baff06f924c897fa580672a97';

export function normalizeFoodQuery(value, {canonical=true} = {}) {
  if (typeof value !== 'string') return '';
  return replaceSpokenNumbers(normalizeText(value)).split(' ').map(word=>canonical?canonicalWord(word):word).join(' ').replace(/\b(\d+(?:[.,]\d+)?)\s*(?:%|(?:procent(?:ow|a|y)?|proc)\b)/g,
    (_, number) => `${Number(number.replace(',', '.'))}%`);
}

export function matchesFoodQuery(product, query) {
  return rankProductCandidates([product],query)[0]?.score>0;
}

export function hasPercentageConflict(product, query) {
  const percentages = text => [...normalizeFoodQuery(text).matchAll(/\b\d+(?:\.\d+)?%/g)].map(match => match[0]);
  const requested = percentages(query), actual = percentages(product.name);
  return requested.length > 0 && actual.length > 0 && requested.some(value => !actual.includes(value));
}
