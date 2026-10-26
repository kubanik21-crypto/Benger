import { normalizeText } from './product-model.js?v=d4f0abd38d7f74747ffd1e92c20b2db1a62bb44d';

export function normalizeFoodQuery(value) {
  if (typeof value !== 'string') return '';
  return normalizeText(value).replace(/\b(\d+(?:[.,]\d+)?)\s*(?:%|procent(?:ow|a|y)?\b)/g,
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
