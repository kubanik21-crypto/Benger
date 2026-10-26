import { PRODUCTS } from './nutrition.js?v=604eb6266ad289ce68114ab3dc2993b2908f816f';

// To wyłącznie aliasy językowe. Produkty i jednostki pochodzą z przekazanego katalogu (domyślnie PRODUCTS).
const PRODUCT_ALIASES = {
  'oat-flakes': ['płatki owsiane', 'płatków owsianych', 'płatki', 'płatków'],
  'peeled-banana': ['banan', 'banana', 'banany'],
  'natural-yogurt': ['jogurt naturalny', 'jogurtu naturalnego', 'jogurt'],
  'milk-2-percent': ['mleko 2%', 'mleka 2%', 'mleko', 'mleka'],
};
const MEAL_ALIASES = {
  sniadanie: 'breakfast', sniadania: 'breakfast',
  obiad: 'lunch', obiadu: 'lunch',
  kolacja: 'dinner', kolacje: 'dinner',
  przekaska: 'snack', przekaske: 'snack',
};

function normalize(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l')
    .replace(/Ł/g, 'L').toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const aliases = Object.entries(PRODUCT_ALIASES).flatMap(([productId, names]) =>
  names.map(name => [normalize(name), productId]));
const productIds = new Map(aliases);
const productPattern = new RegExp(`(?<![a-z0-9])(?:${aliases.map(([name]) => escapeRegExp(name))
  .sort((a, b) => b.length - a.length).join('|')})(?![a-z0-9])`, 'g');
const mealPattern = new RegExp(`\\b(?:na\\s+)?(${Object.keys(MEAL_ALIASES).join('|')})\\b\\s*:?`, 'g');
const quantityPattern = /(?<![a-z0-9.,+\-])([+\-]?[\d.,]+)\s*(mililitrow|mililitry|mililitra|mililitr|ml|gramow|gramy|grama|gram|g)(?![a-z0-9])/g;
const introPattern = /^(?:(?:zjadlem|zjadlam|wypilem|wypilam|jadlem|jadlam|dzis|dzisiaj)\b[\s:]*|[\s:])+/;

function parseItem(source, itemIndex, products) {
  const issues = [];
  const issue = (code, message) => issues.push({ code, message, itemIndex });
  const foundProducts = [];
  const quantities = [];
  let rest = source.replace(introPattern, '').replace(/[.!?]+$/, '');
  rest = rest.replace(productPattern, alias => {
    foundProducts.push(productIds.get(alias));
    return ' ';
  });
  rest = rest.replace(quantityPattern, (_, rawAmount, rawUnit) => {
    quantities.push({ rawAmount, unit: rawUnit.startsWith('m') ? 'ml' : 'g' });
    return ' ';
  }).trim();

  const product = foundProducts.length === 1
    ? products.find(candidate => candidate.id === foundProducts[0]) : undefined;
  if (foundProducts.length > 1) {
    issue('ambiguous-product', 'Oddziel produkty przecinkiem lub słowem „i”, aby ich ilości były jednoznaczne.');
  } else if (!product) {
    issue('unknown-product', 'Nie rozpoznano produktu z lokalnego katalogu. Popraw jego nazwę.');
  }

  let amount = null;
  let unit = null;
  if (quantities.length === 0) {
    issue('missing-quantity', 'Podaj ilość wraz z jednostką, np. 50 g albo 200 ml.');
  } else if (quantities.length > 1) {
    issue('ambiguous-quantity', 'Dla jednego produktu podaj dokładnie jedną ilość z jednostką.');
  } else {
    const quantity = quantities[0];
    unit = quantity.unit;
    const numeric = Number(quantity.rawAmount.replace(',', '.'));
    if (!/^\d+(?:[.,]\d+)?$/.test(quantity.rawAmount) || !Number.isFinite(numeric) || numeric <= 0) {
      issue('invalid-quantity', 'Ilość musi być dodatnią liczbą, np. 50 lub 50,5.');
    } else {
      amount = numeric;
    }
    if (product && unit !== product.unit) {
      issue('unit-mismatch', `Produkt „${product.name}” wymaga jednostki ${product.unit}, a podano ${unit}. Nie przeliczamy ml na g.`);
    }
  }
  // Nie pomijamy nieznanych dodatków, np. „jogurt truskawkowy” lub „mleko 3%”.
  if (rest && product) {
    issue('unrecognized-text', `Nie rozpoznano fragmentu „${rest}”. Popraw tekst zamiast zgadywać produkt lub porcję.`);
  }
  return {
    item: { source, productId: product?.id ?? null, amount, unit, status: issues.length ? 'needs-review' : 'recognized' },
    issues,
  };
}

// Czysta funkcja: nie oblicza makro, nie korzysta z DOM ani localStorage.
// issues z itemIndex odnoszą się do pozycji; pozostałe dotyczą całej propozycji.
export function parseMealText(text, { defaultMeal, products = PRODUCTS } = {}) {
  const issues = [];
  const items = [];
  const validMeals = Object.values(MEAL_ALIASES);
  let meal = validMeals.includes(defaultMeal) ? defaultMeal : null;
  if (typeof text !== 'string' || text.trim() === '') {
    return { meal, items, issues: [{ code: 'empty-text', message: 'Wpisz opis posiłku do przeanalizowania.' }] };
  }

  const normalized = normalize(text);
  const foundMeals = [...normalized.matchAll(mealPattern)].map(match => MEAL_ALIASES[match[1]]);
  const uniqueMeals = [...new Set(foundMeals)];
  if (uniqueMeals.length > 1) {
    meal = null;
    issues.push({ code: 'ambiguous-meal', message: 'Opisz jeden posiłek na raz. W tekście wskazano kilka różnych posiłków.' });
  } else if (uniqueMeals.length === 1) {
    [meal] = uniqueMeals;
  } else if (meal === null) {
    issues.push({ code: 'missing-meal', message: 'Wybierz posiłek w formularzu albo podaj go w tekście.' });
  }

  // Przecinek pomiędzy cyframi jest częścią liczby, pozostałe rozdzielają produkty.
  const content = normalized.replace(mealPattern, ' ').trim();
  if (/^(?:i|oraz)\b|\b(?:i|oraz)\s*[,;.!?]*$|\b(?:i|oraz)\s+(?:i|oraz)\b/.test(content)) {
    issues.push({ code: 'incomplete-list', message: 'Lista produktów jest niedokończona. Podaj produkt po każdym „i” lub „oraz”.' });
  }
  const segments = content
    .split(/(?<!\d),|,(?!\d)|;|\b(?:i|oraz)\b/)
    .map(segment => segment.trim()).filter(Boolean);
  for (const source of segments) {
    const parsed = parseItem(source, items.length, products);
    items.push(parsed.item);
    issues.push(...parsed.issues);
  }
  if (items.length === 0) {
    issues.push({ code: 'missing-items', message: 'Podaj produkty z ilościami, np. 50 g płatków owsianych.' });
  }
  return { meal, items, issues };
}
