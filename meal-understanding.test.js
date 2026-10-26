import test from 'node:test';
import assert from 'node:assert/strict';
import { understandMeal } from './meal-understanding.js';

// Każdy wiersz jest niezależnym zdaniem z oczekiwaną nazwą, ilością, jednostką i posiłkiem.
const examples = [
  ['banan 120 g', 'banan', 120, 'g'],
  ['120 g banana', 'banan', 120, 'g'],
  ['zjadłem banana 120 gram', 'banan', 120, 'g'],
  ['zjadłam 120 gramów banana', 'banan', 120, 'g'],
  ['BANAN 120G', 'banan', 120, 'g'],
  ['banany 120 gramy', 'banan', 120, 'g'],
  ['  banan\u00a0 120\t g  ', 'banan', 120, 'g'],
  ['na śniadanie 80 gram płatków owsianych', 'platki owsiane', 80, 'g', 'breakfast'],
  ['płatki owsiane 80 g', 'platki owsiane', 80, 'g'],
  ['80g płatków', 'platki owsiane', 80, 'g'],
  ['płatków owsianych 80 gramów', 'platki owsiane', 80, 'g'],
  ['płatki owsiane osiemdziesiąt gramów', 'platki owsiane', 80, 'g'],
  ['osiemdziesiąt gram płatków', 'platki owsiane', 80, 'g'],
  ['50,5 g płatków', 'platki owsiane', 50.5, 'g'],
  ['płatki 50.5g', 'platki owsiane', 50.5, 'g'],
  ['śniadanie: 80 g płatków.', 'platki owsiane', 80, 'g', 'breakfast'],
  ['na obiad 200 gram kurczaka', 'kurczak', 200, 'g', 'lunch'],
  ['kurczak 200g', 'kurczak', 200, 'g'],
  ['kurczaka dwieście gramów', 'kurczak', 200, 'g'],
  ['100 gram ryżu', 'ryz', 100, 'g'],
  ['ryż sto gramów', 'ryz', 100, 'g'],
  ['10 gram oliwy', 'oliwa', 10, 'g'],
  ['oliwa dziesięć gramów', 'oliwa', 10, 'g'],
  ['kolacja: skyr Pilos 150 g', 'skyr pilos', 150, 'g', 'dinner'],
  ['skyr waniliowy Pilos 150 gram', 'skyr waniliowy pilos', 150, 'g'],
  ['150g skyra waniliowego', 'skyr waniliowy', 150, 'g'],
  ['na kolację jogurt naturalny 200 g', 'jogurt naturalny', 200, 'g', 'dinner'],
  ['200 gram jogurtu naturalnego', 'jogurt naturalny', 200, 'g'],
  ['jogurt dwieście pięćdziesiąt gramów', 'jogurt naturalny', 250, 'g'],
  ['150 g jogurt', 'jogurt naturalny', 150, 'g'],
  ['przekąska: 100 g jabłka', 'jablko', 100, 'g', 'snack'],
  ['na przekąskę jabłko 150g', 'jablko', 150, 'g', 'snack'],
  ['mleko 250 ml', 'mleko', 250, 'ml'],
  ['250ml mleka', 'mleko', 250, 'ml'],
  ['mleko 2% 250 ml', 'mleko 2%', 250, 'ml'],
  ['250 mililitrów mleka 2%', 'mleko 2%', 250, 'ml'],
  ['mleko 2 procent 250 ml', 'mleko 2%', 250, 'ml'],
  ['mleko dwa procent 250 ml', 'mleko 2%', 250, 'ml'],
  ['mleko 2,0% 250ml', 'mleko 2%', 250, 'ml'],
  ['wypiłem mleko 200 mililitr', 'mleko', 200, 'ml'],
  ['wypiłam 200 mililitry mleka', 'mleko', 200, 'ml'],
  ['mleko 200 mililitrów', 'mleko', 200, 'ml'],
  ['mleko dwieście trzydzieści pięć mililitrów', 'mleko', 235, 'ml'],
  ['mleko 50,5 ml', 'mleko', 50.5, 'ml'],
  ['około 100 gram banana', 'banan', 100, 'g'],
  ['banan jakieś 100 gram', 'banan', 100, 'g'],
  ['mniej więcej 100 gram banana', 'banan', 100, 'g'],
  ['dzisiaj zjadłem 100g banana', 'banan', 100, 'g'],
  ['DZIŚ JADŁAM BANANA 100 G!', 'banan', 100, 'g'],
  ['makaronu 100 g', 'makaron', 100, 'g'],
  ['ziemniaków 200 g', 'ziemniaki', 200, 'g'],
  ['chleba 50 g', 'chleb', 50, 'g'],
  ['cola zero 200 ml', 'cola zero', 200, 'ml'],
  ['jogurt truskawkowy 150 g', 'jogurt truskawkowy', 150, 'g'],
  ['na śniadanie 12,5 g masła', 'masla', 12.5, 'g', 'breakfast'],
];
for (const [text, query, amount, unit, meal = 'snack'] of examples) {
  test(`Rozumienie: ${text}`, () => {
    const result = understandMeal(text, { defaultMeal: 'snack' });
    assert.equal(result.meal, meal); assert.deepEqual(result.issues, []);
    assert.equal(result.intents.length, 1);
    const intent = result.intents[0]; assert.equal(intent.query, query); assert.equal(intent.amount, amount); assert.equal(intent.unit, unit);
    assert.deepEqual(intent.issues, []); assert.equal(Object.hasOwn(intent, 'nutrition'), false);
  });
}
for (const [text, queries, meal = 'snack'] of [
  ['na śniadanie zjadłem 80 gram płatków owsianych i 250 ml mleka 2%', ['platki owsiane', 'mleko 2%'], 'breakfast'],
  ['na obiad 200 gram kurczaka, 100 gram ryżu i 10 gram oliwy', ['kurczak', 'ryz', 'oliwa'], 'lunch'],
  ['kolacja: skyr Pilos 150 g i banan 120 g', ['skyr pilos', 'banan'], 'dinner'],
  ['zjadłem banana 120 gram i jogurt naturalny 200 gram', ['banan', 'jogurt naturalny']],
  ['80g płatków, mleko 250ml i banan 120g', ['platki owsiane', 'mleko', 'banan']],
  ['banan 100g oraz jogurt 150g', ['banan', 'jogurt naturalny']],
  ['banan 100g; jogurt 150g', ['banan', 'jogurt naturalny']],
  ['banan 100g\njogurt 150g', ['banan', 'jogurt naturalny']],
  ['banan 100g,50g płatków', ['banan', 'platki owsiane']],
  ['banan 100g i mleko 200ml i płatki 80g i skyr 150g i ryż 100g', ['banan', 'mleko', 'platki owsiane', 'skyr', 'ryz']],
  ['na śniadanie 80 gram płatków owsianych, 250 mililitrów mleka 2%, banana 120 gram i skyr waniliowy Pilos 150 gram.', ['platki owsiane', 'mleko 2%', 'banan', 'skyr waniliowy pilos'], 'breakfast'],
]) test(`Cały posiłek: ${text}`, () => {
  const result = understandMeal(text, { defaultMeal: 'snack' });
  assert.equal(result.meal, meal); assert.deepEqual(result.intents.map(item => item.query), queries);
  assert.ok(result.intents.every(item => item.amount > 0 && item.unit && !item.issues.length));
});

test('brak gramatury nie staje się wymyśloną porcją; procent nie jest ilością', () => {
  for (const text of ['zjadłem banana', 'mleko 2%', 'skyr Pilos']) {
    const intent = understandMeal(text, { defaultMeal: 'breakfast' }).intents[0];
    assert.equal(intent.amount, null); assert.equal(intent.unit, null); assert.equal(intent.issues[0].code, 'missing-amount');
  }
  const bare = understandMeal('banan 120').intents[0]; assert.equal(bare.amount, 120); assert.equal(bare.unit, null);
});
test('złe ilości, brak produktu i konflikt posiłku są jawne, nie znikają z listy', () => {
  for (const text of ['banan 0 g', 'banan -5g', 'banan --5g', 'banan 5,5,5g', 'banan 1.2.3g', '100 g', 'banan 100g 200g', 'banan dw ieście gram']) {
    const result = understandMeal(text, { defaultMeal: 'breakfast' }); assert.ok(result.intents[0].issues.length, text);
  }
  const result = understandMeal('śniadanie banan 100g i obiad mleko 200ml');
  assert.equal(result.meal, null); assert.equal(result.intents.length, 2); assert.equal(result.issues[0].code, 'ambiguous-meal');
});
test('przybliżenie jest flagą, a brak posiłku używa wyłącznie UI', () => {
  const result = understandMeal('około 100 g banana', { defaultMeal: 'lunch' });
  assert.equal(result.meal, 'lunch'); assert.equal(result.intents[0].amountApproximate, true); assert.equal(result.intents[0].amount, 100);
  assert.ok(understandMeal('banan 100g').issues.some(issue => issue.code === 'missing-meal'));
});
test('limity, puste wejście i niedokończone listy chronią przed niepełnym zapisem', () => {
  for (const text of ['', null, 'a'.repeat(2001), 'banan 120g i', 'banan 120g oraz']) assert.ok(understandMeal(text).issues.length);
  assert.equal(understandMeal(Array(21).fill('banan 120g').join(' i ')).intents.length, 0);
});
