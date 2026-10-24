// Dane przykładowe, wyłącznie do celów edukacyjnych.
// Nie są to zweryfikowane wartości konkretnych marek produktów.
// per100 opisuje kcal oraz gramy białka, tłuszczu i węglowodanów
// na 100 g lub 100 ml, zgodnie z jednostką danego produktu.
export const PRODUCTS = [
  {
    id: 'oat-flakes',
    name: 'Płatki owsiane',
    unit: 'g',
    per100: { kcal: 370, protein: 13, fat: 7, carbs: 60 },
  },
  {
    id: 'peeled-banana',
    name: 'Banan bez skórki',
    unit: 'g',
    per100: { kcal: 89, protein: 1.1, fat: 0.3, carbs: 22.8 },
  },
  {
    id: 'natural-yogurt',
    name: 'Jogurt naturalny',
    unit: 'g',
    per100: { kcal: 60, protein: 4, fat: 2, carbs: 6 },
  },
  {
    id: 'milk-2-percent',
    name: 'Mleko 2%',
    unit: 'ml',
    per100: { kcal: 50, protein: 3.4, fat: 2, carbs: 4.8 },
  },
];

const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs'];

function validateNutrition(values) {
  if (values === null || typeof values !== 'object') {
    throw new TypeError('Brakuje wartości odżywczych.');
  }

  for (const nutrient of NUTRIENTS) {
    if (!Number.isFinite(values[nutrient]) || values[nutrient] < 0) {
      throw new TypeError(`Wartość ${nutrient} musi być skończoną, nieujemną liczbą.`);
    }
  }
}

// amount musi być liczbą w jednostce produktu. Nie konwertujemy tekstu
// ani mililitrów na gramy. Zaokrąglanie należy do warstwy wyświetlania.
export function calculatePortion(product, amount) {
  if (!Number.isFinite(amount)) {
    throw new TypeError('Ilość musi być skończoną liczbą.');
  }
  if (amount <= 0) {
    throw new RangeError('Ilość musi być większa od zera.');
  }
  if (product === null || typeof product !== 'object'
      || !['g', 'ml'].includes(product.unit)) {
    throw new TypeError('Produkt musi mieć jednostkę g lub ml.');
  }
  validateNutrition(product.per100);

  const result = {};
  for (const nutrient of NUTRIENTS) {
    result[nutrient] = product.per100[nutrient] * (amount / 100);
  }
  validateNutrition(result);
  return result;
}

// Przyjmuje tablicę wyników calculatePortion, a nie ilości produktów.
export function sumNutrition(portions) {
  if (!Array.isArray(portions)) {
    throw new TypeError('Pozycje muszą być tablicą.');
  }

  const total = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const portion of portions) {
    validateNutrition(portion);
    for (const nutrient of NUTRIENTS) {
      total[nutrient] += portion[nutrient];
    }
  }
  validateNutrition(total);
  return total;
}
