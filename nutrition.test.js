import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePortion, sumNutrition } from './nutrition.js';
import { TEST_PRODUCTS } from './tests/fixtures/nutrition-products.mjs';

const oats = TEST_PRODUCTS.find(product => product.id === 'custom:test-oats');
const milk = TEST_PRODUCTS.find(product => product.id === 'custom:test-milk');
const banana = TEST_PRODUCTS.find(product => product.id === 'custom:test-banana');

function assertNutritionClose(actual, expected) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
  for (const nutrient of Object.keys(expected)) {
    assert.ok(
      Math.abs(actual[nutrient] - expected[nutrient]) < 1e-10,
      `${nutrient}: oczekiwano ${expected[nutrient]}, otrzymano ${actual[nutrient]}`,
    );
  }
}

test('fixtures własnych produktów mają poprawny kontrakt i unikalne ID', () => {
  assert.equal(TEST_PRODUCTS.length, 4);
  assert.equal(new Set(TEST_PRODUCTS.map(product => product.id)).size, 4);
  for (const product of TEST_PRODUCTS) {
    assert.equal(typeof product.id, 'string');
    assert.ok(product.id.length > 0);
    assert.equal(typeof product.name, 'string');
    assert.ok(product.name.length > 0);
    assert.ok(['g', 'ml'].includes(product.unit));
    assertNutritionClose(calculatePortion(product, 100), product.per100);
  }
});

test('100 g płatków: wartości dla pełnych 100 g', () => {
  assert.deepEqual(calculatePortion(oats, 100), {
    kcal: 370, protein: 13, fat: 7, carbs: 60,
  });
});

test('50 g płatków: połowa wartości', () => {
  assert.deepEqual(calculatePortion(oats, 50), {
    kcal: 185, protein: 6.5, fat: 3.5, carbs: 30,
  });
});

test('200 g płatków: podwojone wartości', () => {
  assert.deepEqual(calculatePortion(oats, 200), {
    kcal: 740, protein: 26, fat: 14, carbs: 120,
  });
});

test('200 ml mleka: obliczenia na podstawie 100 ml', () => {
  assertNutritionClose(calculatePortion(milk, 200), {
    kcal: 100, protein: 6.8, fat: 4, carbs: 9.6,
  });
});

test('ilość ułamkowa zachowuje więcej niż dwa miejsca po przecinku', () => {
  assertNutritionClose(calculatePortion(oats, 12.34), {
    kcal: 45.658, protein: 1.6042, fat: 0.8638, carbs: 7.404,
  });
});

test('sumowanie płatków, mleka i banana obejmuje wszystkie wartości', () => {
  const portions = [
    calculatePortion(oats, 50),
    calculatePortion(milk, 200),
    calculatePortion(banana, 100),
  ];
  assertNutritionClose(sumNutrition(portions), {
    kcal: 374, protein: 14.4, fat: 7.8, carbs: 62.4,
  });
});

test('sumowanie nie zaokrągla wartości poszczególnych porcji', () => {
  const portion = calculatePortion(oats, 12.34);
  assertNutritionClose(sumNutrition([portion, portion, portion]), {
    kcal: 136.974, protein: 4.8126, fat: 2.5914, carbs: 22.212,
  });
});

test('pusta lista pozycji daje zerowe podsumowanie', () => {
  assert.deepEqual(sumNutrition([]), { kcal: 0, protein: 0, fat: 0, carbs: 0 });
});

test('obliczenia nie modyfikują produktu ani przekazanych porcji', () => {
  const original = structuredClone(oats);
  const portion = calculatePortion(oats, 50);
  const originalPortion = structuredClone(portion);
  sumNutrition([portion]);
  assert.deepEqual(oats, original);
  assert.deepEqual(portion, originalPortion);
});

for (const amount of [0, -1, -0.5]) {
  test(`odrzucanie niedodatniej ilości: ${amount}`, () => {
    assert.throws(() => calculatePortion(oats, amount), RangeError);
  });
}

const invalidAmounts = [
  ['', 'pusty tekst'],
  ['   ', 'same spacje'],
  [undefined, 'brak ilości'],
  [null, 'null'],
  ['abc', 'nieprawidłowy tekst'],
  ['50', 'liczba zapisana jako tekst'],
  [NaN, 'NaN'],
  [Infinity, 'Infinity'],
  [-Infinity, '-Infinity'],
  [false, 'wartość logiczna'],
];

for (const [amount, label] of invalidAmounts) {
  test(`odrzucanie ilości, która nie jest skończoną liczbą: ${label}`, () => {
    assert.throws(() => calculatePortion(oats, amount), TypeError);
  });
}

test('odrzucanie nieprawidłowego produktu i niekompletnych wartości', () => {
  assert.throws(() => calculatePortion(null, 100), TypeError);
  assert.throws(() => calculatePortion({ ...oats, unit: 'kg' }, 100), TypeError);
  assert.throws(() => calculatePortion({ ...oats, per100: { kcal: 370 } }, 100), TypeError);
});

test('sumowanie odrzuca brak listy i nieprawidłowe wartości zamiast traktować je jako zero', () => {
  assert.throws(() => sumNutrition(null), TypeError);
  assert.throws(() => sumNutrition([{ kcal: 100 }]), TypeError);
  assert.throws(() => sumNutrition([{ kcal: -1, protein: 0, fat: 0, carbs: 0 }]), TypeError);
});

test('wynik przekraczający zakres liczb jest odrzucany', () => {
  assert.throws(() => calculatePortion(oats, Number.MAX_VALUE), TypeError);
  const hugePortion = { kcal: Number.MAX_VALUE, protein: 0, fat: 0, carbs: 0 };
  assert.throws(() => sumNutrition([hugePortion, hugePortion]), TypeError);
});
