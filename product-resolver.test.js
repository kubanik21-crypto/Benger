import { createTestCustomProvider } from './tests/fixtures/nutrition-products.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProductCache, createProductStorage } from './product-cache.js';
import { createProductRepository } from './product-repository.js';
import { createProductResolver } from './product-resolver.js';
import { normalizeFoodQuery } from './food-query.js';
import { normalizeOffProduct } from './product-providers/open-food-facts.js';
import { confirmMealItem, resolveMealIntents, summarizeMealProposal } from './meal-resolution.js';

const fixtures = JSON.parse(await readFile(new URL('./tests/fixtures/off-products.json', import.meta.url))).products;
const milk = { ...normalizeOffProduct(fixtures[0]), name: 'Mleko 2%', brand: 'Marka A' };
const other = { ...milk, id: 'off:05901234123464', sourceId: '5901234123464', barcode: '5901234123464', brand: 'Marka B' };
const skyr = { ...normalizeOffProduct(fixtures[1]), id: 'off:test-skyr', sourceId: '123456', barcode: null, name: 'Skyr waniliowy', brand: 'Pilos' };

async function setup(products = [milk, other, skyr]) {
  let calls = 0;
  const storage = createProductStorage({ indexedDBFactory: null });
  const cache = createProductCache({ storage }); await cache.putProducts(products);
  const repository = createProductRepository({ custom:createTestCustomProvider(), cache, searchProvider: { id: 'test', searchProducts: async () => { calls++; return [skyr]; } } });
  return { cache, repository, resolver: createProductResolver({ repository }), calls: () => calls, storage };
}

test('dokładny wcześniejszy wybór: pierwszy MEDIUM, powtórzony HIGH, bez requestu', async () => {
  const { repository, resolver, calls } = await setup();
  await resolver.rememberUserChoice('mleko 2%', milk.id);
  assert.equal((await resolver.resolve({ query: 'mleko 2 procent', amount: 250, unit: 'ml' })).confidence, 'MEDIUM');
  await resolver.rememberUserChoice('MLEKO 2 PROCENT', milk.id);
  const result = await resolver.resolve({ query: 'Mleko 2 %', amount: 250, unit: 'ml' });
  assert.equal(result.confidence, 'HIGH'); assert.equal(result.product.id, milk.id);
  assert.equal(result.reason, 'repeated-user-choice'); assert.equal(result.requiresConfirmation, true);
  assert.equal(calls(), 0);
  assert.equal((await repository.selectionMemory('mleko 2%'))[0].count, 2);
  await resolver.resolve({ query: 'mleko 2%' });
  assert.equal((await repository.selectionMemory('mleko 2%'))[0].count, 2, 'Wnioskowanie samo nie uczy aliasu.');
});
test('kilka podobnych produktów i różne marki: LOW, bez zgadywania, 2–5 propozycji', async () => {
  const { resolver } = await setup();
  const result = await resolver.resolve({ query: 'mleko 2%', unit: 'ml' });
  assert.equal(result.confidence, 'LOW'); assert.equal(result.product, null);
  assert.ok(result.alternatives.length >= 2 && result.alternatives.length <= 5);
  assert.equal((await resolver.resolve({ query: 'mleko 2% Marka A' })).product.id, milk.id);
});
test('ulubiony ma priorytet przed ostatnio używanym, ale nie usuwa niejednoznaczności', async () => {
  const { repository, resolver } = await setup();
  await repository.setFavorite(milk, true); await repository.markUsed([other]);
  const result = await resolver.resolve({ query: 'mleko 2%', unit: 'ml' });
  assert.equal(result.confidence, 'LOW'); assert.equal(result.alternatives[0].id, milk.id);
});
test('jedyny pasujący ulubiony: MEDIUM i szybkie potwierdzenie', async () => {
  const { repository, resolver } = await setup(); await repository.setFavorite(skyr, true);
  const result = await resolver.resolve({ query: 'skyr waniliowy Pilos', amount: 150, unit: 'g' });
  assert.equal(result.product.id, skyr.id); assert.equal(result.confidence, 'MEDIUM'); assert.equal(result.reason, 'unique-favorite');
});
test('wielkość liter, polskie znaki i procenty normalizują się deterministycznie', async () => {
  assert.equal(normalizeFoodQuery(' MLEKO 2,0 procent '), 'mleko 2%');
  assert.equal(normalizeFoodQuery('PŁATKI OWSIANE'), 'platki owsiane');
  const { resolver } = await setup();
  assert.equal((await resolver.resolve({ query: 'PLATKI OWSIANE', amount: 50, unit: 'g' })).product.id, 'custom:test-oats');
});
test('dokładny barcode HIGH; g/ml nigdy nie są przeliczane przez resolver', async () => {
  const { resolver, calls } = await setup();
  const exact = await resolver.resolve({ query: '5901234123457', amount: 200, unit: 'ml' });
  assert.equal(exact.confidence, 'HIGH'); assert.equal(exact.product.id, milk.id);
  const wrong = await resolver.resolve({ barcode: '5901234123457', amount: 200, unit: 'g' });
  assert.equal(wrong.product, null); assert.equal(wrong.reason, 'unit-or-variant-mismatch');
  assert.equal((await resolver.resolve({ barcode: '123' })).reason, 'invalid-barcode'); assert.equal(calls(), 0);
});
test('brak wyników i złe ilości nie prowadzą do wymyślenia produktu', async () => {
  const { resolver, calls } = await setup();
  for (const amount of [0, -1, NaN, Infinity, '150']) {
    assert.equal((await resolver.resolve({ query: 'skyr Pilos', amount })).reason, 'invalid-intent');
  }
  const result = await resolver.resolve({ query: 'produkt nieznany' });
  assert.equal(result.product, null); assert.equal(result.confidence, 'LOW'); assert.deepEqual(result.alternatives, []); assert.equal(calls(), 0);
});
test('2% nie jest dopasowywane do 12%, a Pilos do Superpilos', async () => {
  const altered = { ...milk, name: 'Mleko 12%', brand: 'Superpilos' };
  const { resolver } = await setup([altered]);
  assert.equal((await resolver.resolve({ query: 'mleko 2% pilos' })).product, null);
});
test('sprzeczne zapamiętane wybory wymagają wyboru, nie zwiększają confidence', async () => {
  const { resolver } = await setup();
  await resolver.rememberUserChoice('mleko 2%', milk.id); await resolver.rememberUserChoice('mleko 2%', other.id);
  const result = await resolver.resolve({ query: 'mleko 2%', unit: 'ml' }); assert.equal(result.confidence, 'LOW'); assert.equal(result.product, null);
});
test('zewnętrzny search jest jawny; nie uruchamia się dla każdego intentu domyślnie', async () => {
  const { resolver, calls } = await setup([]);
  assert.equal((await resolver.resolve({ query: 'skyr waniliowy Pilos' })).confidence, 'LOW');
  assert.equal(calls(), 0);
  const result = await resolver.resolve({ query: 'skyr waniliowy Pilos' }, { allowExternal: true });
  assert.equal(result.product.id, skyr.id); assert.equal(result.confidence, 'MEDIUM'); assert.equal(calls(), 1);
});
test('pamięć przyjmuje tylko istniejący Product, nigdy makro podane przez parser/AI', async () => {
  const { resolver } = await setup();
  await assert.rejects(resolver.rememberUserChoice('produkt AI', 'invented-product'));
  const proposal = await resolveMealIntents([{ query: 'skyr waniliowy Pilos', amount: 150, unit: 'g', nutrition: { kcal: 9999 }, per100: { protein: 999 } }], { resolver });
  assert.equal(proposal.items[0].portion.nutrition.kcal, 90);
});
test('posiłek zachowuje rozpoznane pozycje; potwierdzenie jednego wiersza nie zeruje reszty', async () => {
  const { resolver, repository } = await setup();
  const proposal = await resolveMealIntents([
    { id: 'oats', query: 'płatki owsiane', amount: 80, unit: 'g' },
    { id: 'milk', query: 'mleko 2%', amount: 250, unit: 'ml' },
    { id: 'banana', query: 'banan bez skórki', amount: 120, unit: 'g' },
    { id: 'skyr', query: 'skyr waniliowy Pilos', amount: 150, unit: 'g' },
  ], { resolver });
  assert.equal(summarizeMealProposal(proposal).resolved, 3); assert.equal(summarizeMealProposal(proposal).unresolved, 1);
  const confirmed = await confirmMealItem(proposal, 'milk', milk.id, { repository });
  assert.equal(summarizeMealProposal(confirmed).unresolved, 0);
  assert.deepEqual(confirmed.items[0], proposal.items[0]); assert.equal(proposal.items[1].portion, null);
  assert.equal(confirmed.items[1].portion.nutrition.kcal, 125);
  await assert.rejects(confirmMealItem(proposal, 'milk', skyr.id, { repository }), /Jednostki/);
});

test('brak ilości zachowuje rozpoznaną tożsamość, ale nie tworzy porcji', async () => {
  const { resolver } = await setup();
  const proposal = await resolveMealIntents([{ query: 'banan', amount: null, unit: null }], { resolver });
  assert.equal(proposal.items[0].resolution.product.id, 'custom:test-banana');
  assert.equal(proposal.items[0].portion, null);
});
test('pięć nowych produktów zużywa najwyżej jeden zewnętrzny search na analizę', async () => {
  const { resolver, calls } = await setup([]);
  const proposal = await resolveMealIntents(Array.from({length:5}, (_,i)=>({ query: `nieznany produkt ${i}`, amount: 100, unit: 'g' })), { resolver, allowExternal: true });
  assert.equal(proposal.items.length, 5); assert.equal(calls(), 1);
});

test('osobisty alias jest jawny, lokalny i wymaga istniejącego produktu',async()=>{
 const {repository,resolver}=await setup();
 assert.deepEqual(await repository.listAliases(),[]);
 await assert.rejects(repository.createAlias('moje mleko','brak'));
 await repository.createAlias('moje mleko',milk.id);
 assert.equal((await resolver.resolve({query:'moje mleko',unit:'ml'})).product.id,milk.id);
 assert.equal((await resolver.resolve({query:'moje mleko',unit:'ml'})).reason,'explicit-user-alias');
 assert.equal(await repository.resolveAlias('MOJE MLEKO'),milk.id);
 await repository.removeAlias('moje mleko');assert.equal(await repository.resolveAlias('moje mleko'),null);
});
test('pamięć nie omija wariantów procentów, smaku ani zero',async()=>{
 const {repository,resolver,cache}=await setup();
 await resolver.rememberUserChoice('mleko 3,2%',milk.id);await resolver.rememberUserChoice('mleko 3,2%',milk.id);
 assert.equal((await resolver.resolve({query:'mleko 3,2%',unit:'ml'})).product,null);
 const plain={...skyr,name:'Skyr naturalny'};await cache.putProducts([plain]);
 await repository.createAlias('skyr waniliowy',plain.id);
 assert.equal((await resolver.resolve({query:'skyr waniliowy'})).product,null);
 const cola={...milk,id:'off:test-cola',sourceId:'765432',barcode:null,name:'Coca-Cola',brand:'Coca-Cola'};await cache.putProducts([cola]);
 await repository.createAlias('Coca-Cola Zero',cola.id);
 assert.equal((await resolver.resolve({query:'Coca-Cola Zero'})).product,null);
});
test('podobna potwierdzona fraza pomaga bez zmiany wariantu',async()=>{
 const branded={...milk,name:'Mleko Łaciate 2%',brand:'Łaciate'};
 const {resolver}=await setup([branded]);
 await resolver.rememberUserChoice('łaciate dwa procent',branded.id);await resolver.rememberUserChoice('łaciate 2%',branded.id);
 const resolved=await resolver.resolve({query:'mleko łaciate 2%',unit:'ml'});
 assert.equal(resolved.product.id,branded.id);
 assert.notEqual((await resolver.resolve({query:'mleko łaciate 3,2%',unit:'ml'})).confidence,'HIGH');
});
