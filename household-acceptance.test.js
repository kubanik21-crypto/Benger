import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUsdaPortionProvider } from './product-providers/usda-portions.js';
import { createUsdaProvider } from './product-providers/usda.js';
import { sourcePortions } from './product-providers/source-portions.js';
import { understandMeal } from './meal-understanding.js';
import { resolvePortion } from './portion-resolver.js';
import { calculatePortion, sumNutrition } from './nutrition.js';
const fetchImpl=async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))});
const usda=createUsdaProvider({fetchImpl}),portions=createUsdaPortionProvider({fetchImpl});
const milk={id:'custom:milk',unit:'ml',per100:{kcal:50,protein:3.2,fat:2,carbs:4.8}},skyr={id:'custom:skyr',unit:'g'},yogurt={id:'off:yogurt',unit:'g'},own={id:'custom:pack',unit:'g'};
const scenarios=[
 ['2 łyżki oliwy','usda:171413',27],
 ['łyżeczka masła','usda:173430',null],
 ['2 jajka','usda:171287',null],
 ['3 kromki chleba','usda:167532',84],
 ['2 plastry sera','usda:170899',null],
 ['pół opakowania skyra',skyr,75],
 ['jedno opakowanie jogurtu',yogurt,150],
 ['szklanka mleka',milk,250],
 ['pół szklanki mleka',milk,125],
 ['garść migdałów','usda:170567',null],
 ['1 banan','usda:173944',null],
 ['2 jabłka','usda:171688',null],
 ['jedna bułka','usda:172683',null],
 ['półtorej łyżki masła orzechowego','usda:174265',24],
 ['jedna miarka odżywki białkowej',{id:'custom:protein',unit:'g'},null],
 ['3 łyżeczki cukru','usda:169655',12.6],
 ['2 łyżki mleka',milk,30],
 ['2 kromki mojego chleba',{id:'custom:bread',unit:'g'},76],
 ['pół opakowania produktu własnego',own,250],
];
for(const [sentence,reference,expected]of scenarios)test(`Acceptance: ${sentence} → ${expected??'jawny wybór / ważenie'}`,async()=>{
 const product=typeof reference==='string'?await usda.getById(reference):reference;assert.ok(product,reference);
 let definitions=await portions.getPortions(product.id);
 if(product.id===skyr.id||product.id===yogurt.id||product.id===own.id)definitions=sourcePortions({quantity:`${product.id===own.id?500:150} g`},product);
 if(product.id==='custom:bread')definitions=[{id:'user-bread',productId:product.id,unit:'slice',amount:1,normalizedAmount:38,normalizedUnit:'g',source:'USER',description:'Moja kromka'}];
 const [intent]=understandMeal(sentence,{defaultMeal:'breakfast'}).intents;assert.ok(intent.amount>0);const result=resolvePortion({product,amount:intent.amount,unit:intent.unit,definitions,settings:{cupMl:250}});
 if(expected===null)assert.equal(result.confidence,'LOW');else {assert.equal(result.confidence,'HIGH');assert.ok(Math.abs(result.normalizedAmount-expected)<1e-9);}
});
test('Acceptance: mixed breakfast keeps all rows; missing butter definition needs explicit weighing',async()=>{
 const intents=understandMeal('Na śniadanie 2 jajka 2 kromki chleba i łyżeczka masła').intents;assert.equal(intents.length,3);const products=await Promise.all(['usda:171287','usda:167532','usda:173430'].map(id=>usda.getById(id)));
 const results=await Promise.all(products.map(async(product,index)=>resolvePortion({product,amount:intents[index].amount,unit:intents[index].unit,definitions:await portions.getPortions(product.id)})));
 assert.deepEqual(results.map(r=>r.confidence),['LOW','HIGH','LOW']);assert.equal(results[1].normalizedAmount,56);
 const chosen=resolvePortion({product:products[0],amount:2,unit:'piece',definitions:await portions.getPortions(products[0].id),definitionId:'usda:171287:portion:88374'});assert.equal(chosen.normalizedAmount,100);
 const user={id:'butter-user',productId:products[2].id,unit:'teaspoon',amount:1,normalizedAmount:5,normalizedUnit:'g',source:'USER',description:'Zważone przez użytkownika'};
 const butter=resolvePortion({product:products[2],amount:1,unit:'teaspoon',definitions:[user]});assert.equal(butter.normalizedAmount,5);
 const total=sumNutrition(products.map((p,i)=>calculatePortion(p,[100,56,5][i])));assert.ok(total.kcal>200&&total.kcal<600);assert.ok(Object.values(total).every(Number.isFinite));
});
