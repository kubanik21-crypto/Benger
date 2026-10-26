import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{createUsdaProvider}from'./usda.js';import{GENERIC_COVERAGE}from'../tests/generic-coverage.mjs';
const provider=createUsdaProvider({fetchImpl:async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))})});
assert.ok(GENERIC_COVERAGE.length>=100);
for(const[query,identity,group]of GENERIC_COVERAGE)test(`Polish coverage: ${query}`,async()=>{
 const results=await provider.search(query);assert.ok(results.length,query);const first=results[0],name=first.name.toLowerCase().replace(/ies\b/g,'y');assert.ok(name.includes(identity),query+': '+first.name);
 const p=first.per100;for(const value of Object.values(p))assert.ok(Number.isFinite(value)&&value>=0);assert.ok(p.kcal<=1000);assert.ok(p.protein+p.fat+p.carbs<=101);
 if(['meat','fish'].includes(group))assert.ok(p.protein>=10,query+': '+first.name);
 if(group==='fat')assert.ok(p.fat>=50,query+': '+first.name);
 if(group==='water')assert.ok(p.kcal<=2,query+': '+first.name);
 if(group==='starch')assert.ok(p.carbs>=10,query+': '+first.name);
});
test('missing exact Polish skyr/sausage never becomes falsely precise generic product',async()=>{assert.deepEqual(await provider.search('skyr Pilos'),[]);assert.deepEqual(await provider.search('kiełbasa krakowska marka'),[]);});
