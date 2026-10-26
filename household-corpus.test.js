import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { understandMeal } from './meal-understanding.js';
import { normalizeTranscript } from './transcript-normalizer.js';
const corpus=JSON.parse(await readFile(new URL('./tests/fixtures/household-corpus.json',import.meta.url)));
assert.ok(corpus.length>=150);
for(const c of corpus)test(`Household corpus: ${c.text}`,()=>{const analysis=understandMeal(c.text,{defaultMeal:'breakfast'});assert.equal(analysis.intents.length,1);const intent=analysis.intents[0];assert.deepEqual([intent.query,intent.amount,intent.unit],[c.query,c.amount,c.unit]);assert.deepEqual(intent.issues,[]);assert.equal(analysis.rawTranscript,c.text);});
test('counted nouns and contextual fractions preserve brand text',()=>{for(const [text,query,count]of [['2 jajka','jajko',2],['3 banany','banan',3],['2 jabłka','jablko',2],['jedna bułka','bulka',1],['pół banana','banan',.5]]){const i=understandMeal(text).intents[0];assert.deepEqual([i.query,i.amount,i.unit],[query,count,'piece']);}assert.match(normalizeTranscript('100 g Produkt Północ').normalizedTranscript,/polnoc/);});
test('mixed household and canonical products keep order and one quantity per item',()=>{const a=understandMeal('Na śniadanie 2 jajka 2 kromki chleba i łyżeczka masła i 200 ml mleka');assert.deepEqual(a.intents.map(i=>[i.query,i.amount,i.unit]),[['jajko',2,'piece'],['chleb',2,'slice'],['maslo',1,'teaspoon'],['mleko',200,'ml']]);});
// Cross product identity/order/amount must not get lost by normalization or segmentation.
for(const [food,query]of [['chleba','chleb'],['mleka','mleko'],['oliwy','oliwa'],['cukru','cukier']])test(`generated household syntax and ordering: ${query}`,()=>{for(const [form,unit]of [['łyżki','tablespoon'],['łyżeczki','teaspoon'],['kromki','slice'],['szklanki','cup'],['opakowania','package'],['garści','handful']])for(const amount of [.25,.5,1,1.5,2,3])for(const text of [`${amount} ${form} ${food}`,`${food} ${amount} ${form}`]){const [intent]=understandMeal(text).intents;assert.deepEqual([intent.query,intent.amount,intent.unit],[query,amount,unit],text);}});
