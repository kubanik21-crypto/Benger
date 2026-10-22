import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMealText } from './meal-parser.js';
import { PRODUCTS } from './nutrition.js';

const parse = (text, options = {}) => parseMealText(text, { defaultMeal: 'breakfast', ...options });

for (const [text, productId, amount, unit] of [
  ['50 g płatków owsianych', 'oat-flakes', 50, 'g'],
  ['płatki owsiane 50 g', 'oat-flakes', 50, 'g'],
  ['200 ml mleka 2%', 'milk-2-percent', 200, 'ml'],
  ['mleko 2% 200ml', 'milk-2-percent', 200, 'ml'],
  ['banan 120 g', 'peeled-banana', 120, 'g'],
  ['120 g banana', 'peeled-banana', 120, 'g'],
  ['150 g jogurtu naturalnego', 'natural-yogurt', 150, 'g'],
  ['50,5 g płatków', 'oat-flakes', 50.5, 'g'],
  ['płatki 50g', 'oat-flakes', 50, 'g'],
  ['płatki 50 gram', 'oat-flakes', 50, 'g'],
  ['50 gramów płatków', 'oat-flakes', 50, 'g'],
  ['200 mililitrów mleka', 'milk-2-percent', 200, 'ml'],
  ['banany 120 gramów', 'peeled-banana', 120, 'g'],
  ['jogurt 150 g', 'natural-yogurt', 150, 'g'],
  ['mleko 200 ml', 'milk-2-percent', 200, 'ml'],
  ['jogurt naturalny 150 g', 'natural-yogurt', 150, 'g'],
  ['  NA ŚNIADANIE: ZJADŁAM\t50,5\u00a0GRAMÓW   PŁATKÓW OWSIANYCH.  ', 'oat-flakes', 50.5, 'g'],
]) {
  test(`rozpoznanie: ${text.trim()}`, () => {
    const result = parse(text);
    assert.deepEqual(result.issues, []);
    assert.equal(result.items.length, 1);
    assert.deepEqual({ ...result.items[0], source: undefined }, { source: undefined, productId, amount, unit, status: 'recognized' });
    assert.ok(PRODUCTS.some(product => product.id === result.items[0].productId && product.unit === unit));
  });
}

test('pełne śniadanie z dwoma produktami', () => {
  const result = parse('Na śniadanie zjadłem 50 g płatków owsianych i 200 ml mleka 2%', { defaultMeal: 'dinner' });
  assert.equal(result.meal, 'breakfast');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.items.map(({ productId, amount, unit }) => [productId, amount, unit]), [
    ['oat-flakes', 50, 'g'], ['milk-2-percent', 200, 'ml'],
  ]);
});

test('trzy produkty, przecinki i ilości przed lub po nazwie', () => {
  const result = parse('Na śniadanie 50 g płatków owsianych, 200 ml mleka 2% i banan 120 g');
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.items.map(item => item.amount), [50, 200, 120]);
});

test('przykładowy obiad z banana i jogurtu', () => {
  const result = parse('Obiad: banan 120 g i 150 g jogurtu naturalnego');
  assert.equal(result.meal, 'lunch');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.items.map(item => item.productId), ['peeled-banana', 'natural-yogurt']);
});

for (const [phrase, meal] of [
  ['na śniadanie', 'breakfast'], ['śniadanie:', 'breakfast'],
  ['na obiad', 'lunch'], ['obiad:', 'lunch'],
  ['na kolację', 'dinner'], ['kolacja:', 'dinner'],
  ['na przekąskę', 'snack'], ['przekąska:', 'snack'],
]) {
  test(`rozpoznanie posiłku: ${phrase}`, () => {
    const result = parse(`${phrase} banan 120 g`);
    assert.equal(result.meal, meal);
    assert.deepEqual(result.issues, []);
  });
}

test('brak posiłku korzysta wyłącznie z przekazanej wartości domyślnej', () => {
  assert.equal(parse('banan 120 g', { defaultMeal: 'snack' }).meal, 'snack');
  for (const defaultMeal of [undefined, 'Obiad', 'unknown']) {
    const result = parseMealText('banan 120 g', { defaultMeal });
    assert.equal(result.meal, null);
    assert.equal(result.issues[0].code, 'missing-meal');
  }
});

for (const [text, code] of [
  ['zjadłem banana', 'missing-quantity'],
  ['zjadłem 100 g czegoś', 'unknown-product'],
  ['200 g mleka', 'unit-mismatch'],
  ['50 ml płatków', 'unit-mismatch'],
  ['banan 0 g', 'invalid-quantity'],
  ['banan -5 g', 'invalid-quantity'],
  ['banan 5,5,5 g', 'invalid-quantity'],
  ['banan +5 g', 'invalid-quantity'],
  ['banan --5 g', 'missing-quantity'],
  ['banan 1e3 g', 'missing-quantity'],
  ['banan 0x10 g', 'missing-quantity'],
  ['banan abc g', 'missing-quantity'],
  ['banan 1 kg', 'missing-quantity'],
  ['50 g jogurtu truskawkowego', 'unknown-product'],
  ['jogurt truskawkowy 50 g', 'unrecognized-text'],
  ['mleko 3% 200 ml', 'unrecognized-text'],
  ['banan 120 g ze skórką', 'unrecognized-text'],
  ['banan 50 g 100 g', 'ambiguous-quantity'],
  ['50 g płatków mleko 200 ml', 'ambiguous-product'],
  ['bananowy 50 g', 'unknown-product'],
  ['100 g xbanan', 'unknown-product'],
]) {
  test(`bez zgadywania: ${text}`, () => {
    const result = parse(text);
    assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result));
    assert.ok(result.items.some(item => item.status === 'needs-review'));
  });
}

test('brak ilości nie przyjmuje domyślnej porcji', () => {
  const result = parse('zjadłem banana');
  assert.equal(result.items[0].productId, 'peeled-banana');
  assert.equal(result.items[0].amount, null);
  assert.equal(result.items[0].unit, null);
});

test('nieznany produkt nie ukrywa pozostałych poprawnych pozycji ani problemu', () => {
  const result = parse('50 g płatków i 100 g czegoś');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].status, 'recognized');
  assert.equal(result.items[1].status, 'needs-review');
  assert.ok(result.issues.some(issue => issue.itemIndex === 1 && issue.code === 'unknown-product'));
});

test('sprzeczne posiłki nie są zastępowane wartością domyślną', () => {
  const result = parse('Śniadanie: banan 120 g i obiad: jogurt 150 g');
  assert.equal(result.meal, null);
  assert.ok(result.issues.some(issue => issue.code === 'ambiguous-meal'));
});

test('pusty tekst, brak produktów i tekst nierozpoznawalny dają komunikaty', () => {
  for (const text of ['', ' \n\t', null, undefined]) {
    const result = parse(text);
    assert.equal(result.items.length, 0);
    assert.equal(result.issues[0].code, 'empty-text');
  }
  assert.ok(parse('śniadanie:').issues.some(issue => issue.code === 'missing-items'));
  assert.ok(parse('zupełnie nieznane słowa').issues.some(issue => issue.code === 'unknown-product'));
});

test('przecinki dziesiętne nie rozdzielają pozycji; działają „oraz” i średniki', () => {
  const result = parse('50,5 g płatków; mleko 200,5 ml oraz banan 120 g');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.items.map(item => item.amount), [50.5, 200.5, 120]);
});

test('parser jest deterministyczny i nie zmienia katalogu ani opcji', () => {
  const before = structuredClone(PRODUCTS);
  const options = Object.freeze({ defaultMeal: 'dinner' });
  const first = parseMealText('mleko 200 ml', options);
  first.items[0].amount = 999;
  const second = parseMealText('mleko 200 ml', options);
  assert.equal(second.items[0].amount, 200);
  assert.equal(second.meal, 'dinner');
  assert.deepEqual(PRODUCTS, before);
  assert.equal(Object.hasOwn(second.items[0], 'nutrition'), false);
});
