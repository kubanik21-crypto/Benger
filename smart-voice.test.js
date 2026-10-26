import test from 'node:test';
import assert from 'node:assert/strict';
import {understandMeal} from './meal-understanding.js';
import {VOICE_CORPUS} from './voice-corpus.js';
for(const [text,expected] of VOICE_CORPUS)test(`Smart corpus: ${text}`,()=>{
 const actual=understandMeal(text,{defaultMeal:'breakfast'});
 assert.deepEqual(actual.intents.map(i=>[i.query,i.amount,i.unit]),expected);
 assert.equal(actual.rawTranscript,text);assert.ok(actual.tokens.every(t=>Number.isInteger(t.start)));
});
test('generowane kombinacje nie gubią produktu ani nie przenoszą ilości',()=>{
 const products=[['banan','banan','g'],['ryż','ryz','g'],['kurczak','kurczak','g'],['płatki','platki owsiane','g'],['mleko 2%','mleko 2%','ml']];
 for(const [name,query,unit] of products)for(const amount of [50,80,100,120,250])for(const separator of [', ',' i ',' oraz ',' '])for(const before of [false,true]){
 const one=before?`${amount} ${unit} ${name}`:`${name} ${amount} ${unit}`;
 const result=understandMeal(`${one}${separator}banan 150 g`,{defaultMeal:'breakfast'});
 // Identyczne nazwy też pozostają osobnymi pozycjami.
 assert.deepEqual(result.intents.map(i=>[i.query,i.amount,i.unit]),[[query,amount,unit],['banan',150,'g']],one+separator);
 }
});
