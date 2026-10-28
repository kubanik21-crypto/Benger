import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDiaryAmount,resizeDiaryEntry} from './diary-quantity.js';
import {validDiaryEntry} from './diary-entry.js';
const entry={id:'saved-entry',date:'2026-10-28',createdAt:'2026-10-28T10:00:00Z',meal:'breakfast',productId:'old-product',productName:'Produkt archiwalny',amount:50,unit:'g',nutrition:{kcal:185,protein:6.5,fat:3.5,carbs:30}};
test('amount parser accepts integers/Polish decimals and rejects empty, zero, negatives, malformed and excessive amounts',()=>{
 for(const [raw,expected]of [['100',100],['50,5',50.5],[' 1.25 ',1.25]])assert.equal(parseDiaryAmount(raw),expected);
 for(const raw of ['',null,undefined,'0','-1','abc','--5','5,5,5','Infinity','1e3','10000001'])assert.throws(()=>parseDiaryAmount(raw));
});
test('resizing a historical snapshot preserves identity, date, meal and provenance without mutating input',()=>{
 const before=JSON.stringify(entry),next=resizeDiaryEntry(entry,100);
 assert.equal(next.id,entry.id);assert.equal(next.date,entry.date);assert.equal(next.createdAt,entry.createdAt);assert.equal(next.meal,entry.meal);assert.equal(next.productId,entry.productId);
 assert.deepEqual(next.nutrition,{kcal:370,protein:13,fat:7,carbs:60});assert.equal(JSON.stringify(entry),before);assert.ok(validDiaryEntry(next));
 assert.equal(resizeDiaryEntry({...entry,unit:'ml'},200).unit,'ml');
 assert.equal(resizeDiaryEntry(entry,50.5).nutrition.protein,6.565);
});
test('recipe resizing uses only the saved version, including servings, grams and ml',()=>{
 for(const unit of ['serving','g','ml']){
  const recipe={...entry,kind:'RECIPE',sourceType:'recipe',recipeId:'11111111-1111-4111-8111-111111111111',recipeName:'Curry v1',recipeVersion:1,recipeYieldSnapshot:{servings:5,finalWeight:1250,finalVolume:2000},unit};delete recipe.productId;delete recipe.productName;
  const next=resizeDiaryEntry(recipe,100);assert.equal(next.recipeVersion,1);assert.equal(next.recipeId,recipe.recipeId);assert.deepEqual(next.recipeYieldSnapshot,recipe.recipeYieldSnapshot);assert.equal(next.nutrition.kcal,370);assert.ok(validDiaryEntry(next));
 }
});
test('explicit gram correction clears an outdated household count, unchanged quantity preserves it',()=>{
 const definition={id:'user-piece',productId:entry.productId,unit:'piece',normalizedUnit:'g',source:'USER',amount:1,normalizedAmount:25,description:'Moja sztuka'};
 const household={...entry,displayPortion:{amount:2,unit:'piece',label:'2 sztuki'},portionConversion:{inputAmount:2,inputUnit:'piece',normalizedAmount:50,normalizedUnit:'g',source:'USER',confidence:'HIGH',description:'Moja sztuka',definition}};
 assert.ok(validDiaryEntry(household));assert.deepEqual(resizeDiaryEntry(household,50),household);
 const changed=resizeDiaryEntry(household,75);assert.equal(changed.displayPortion,undefined);assert.equal(changed.portionConversion,undefined);assert.ok(validDiaryEntry(changed));
});
test('invalid edits and nutrition overflow fail before any data can be saved',()=>{
 for(const amount of [0,-1,NaN,Infinity,1e7+1])assert.throws(()=>resizeDiaryEntry(entry,amount));
 assert.throws(()=>resizeDiaryEntry({...entry,amount:1,nutrition:{...entry.nutrition,kcal:1e10}},2));
 assert.throws(()=>resizeDiaryEntry({...entry,nutrition:{kcal:NaN}},50));
});
