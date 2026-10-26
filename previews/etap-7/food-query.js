import { replaceSpokenNumbers } from './polish-numbers.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { canonicalWord } from './food-language.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { normalizeText } from './product-model.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';

export function normalizeFoodQuery(value, {canonical=true} = {}) {
  if (typeof value !== 'string') return '';
  return replaceSpokenNumbers(normalizeText(value)).split(' ').map(word=>canonical?canonicalWord(word):word).join(' ').replace(/\b(\d+(?:[.,]\d+)?)\s*(?:%|(?:procent(?:ow|a|y)?|proc)\b)/g,
    (_, number) => `${Number(number.replace(',', '.'))}%`);
}

export function matchesFoodQuery(product, query) {
  const tokens = value => normalizeFoodQuery(value).match(/[a-z0-9]+(?:\.\d+)?%?/g) ?? [];
  const words = tokens(query);
  const actual = new Set(tokens(`${product.name} ${product.brand ?? ''}`));
  return words.length > 0 && words.every(word => actual.has(word));
}

export function hasPercentageConflict(product, query) {
  const percentages = text => [...normalizeFoodQuery(text).matchAll(/\b\d+(?:\.\d+)?%/g)].map(match => match[0]);
  const requested = percentages(query), actual = percentages(product.name);
  return requested.length > 0 && actual.length > 0 && requested.some(value => !actual.includes(value));
}
