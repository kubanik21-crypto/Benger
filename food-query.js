import {rankProductCandidates} from './product-matching.js?v=963d8df5fa23bacbd584e97be484d52eb2c76bf7';
import { replaceSpokenNumbers } from './polish-numbers.js?v=963d8df5fa23bacbd584e97be484d52eb2c76bf7';
import { canonicalWord } from './food-language.js?v=963d8df5fa23bacbd584e97be484d52eb2c76bf7';
import { normalizeText } from './product-model.js?v=963d8df5fa23bacbd584e97be484d52eb2c76bf7';

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
