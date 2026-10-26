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
 for(const [name,query,unit] of products)for(const amount of [50,80,100,120,250])for(const separator of [', ',' i ',' oraz ',' '])for(const before of [false,true])for(const secondBefore of [false,true]){
 const one=before?`${amount} ${unit} ${name}`:`${name} ${amount} ${unit}`;
 const second=secondBefore?'150 g banana':'banan 150 g';
 const result=understandMeal(`${one}${separator}${second}`,{defaultMeal:'breakfast'});
 // Identyczne nazwy też pozostają osobnymi pozycjami.
 assert.deepEqual(result.intents.map(i=>[i.query,i.amount,i.unit]),[[query,amount,unit],['banan',150,'g']],one+separator);
 }
});
test('niezależna pewność struktury i niepełna przybliżona ilość bez zgadywania jednostki',()=>{
 const read=text=>understandMeal(text,{defaultMeal:'breakfast'}).intents[0];
 assert.equal(read('80 gram płatków').structureConfidence,'HIGH');
 assert.equal(read('płatki około 80 gram').structureConfidence,'MEDIUM');
 const uncertain=read('płatki chyba z osiemdziesiąt');
 assert.equal(uncertain.amount,80);assert.equal(uncertain.unit,null);assert.equal(uncertain.query,'platki owsiane');
 assert.equal(uncertain.structureConfidence,'MEDIUM');assert.equal(uncertain.issues[0].code,'missing-unit');
 assert.equal(read('banan').structureConfidence,'LOW');
 assert.equal(read('2 jajka').structureConfidence,'HIGH');
});
test('częściowe odzyskanie zachowuje trzy produkty oraz nierozpoznany fragment',()=>{
 const result=understandMeal('80 gram płatków 250 ml mleka coś tam dziwnego banan 120 gram',{defaultMeal:'breakfast'});
 assert.deepEqual(result.intents.map(i=>[i.query,i.amount,i.unit]),[['platki owsiane',80,'g'],['mleko',250,'ml'],['cos tam dziwnego',null,null],['banan',120,'g']]);
 assert.equal(result.intents[2].structureConfidence,'LOW');
});
test('nieznane nazwy podobne do właściwości Object pozostają tekstem, nie prototypem',()=>{
 for(const name of ['constructor','__proto__']){
  const intent=understandMeal(`${name} 80 g`,{defaultMeal:'breakfast'}).intents[0];
  assert.equal(intent.query,name);assert.equal(intent.amount,80);
 }
});
