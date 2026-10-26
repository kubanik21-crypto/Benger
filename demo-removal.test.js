import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{createProductRepository}from'./product-repository.js';import{createUsdaProvider}from'./product-providers/usda.js';import{createProductResolver}from'./product-resolver.js';import{LEGACY_PRODUCT_IDS}from'./legacy-product-references.js';import{PUBLIC_ASSETS}from'./scripts/public-assets.mjs';
test('production exports no demo product data or provider',async()=>{const module=await import('./nutrition.js');assert.equal(Object.hasOwn(module,'PRODUCTS'),false);assert.ok(!PUBLIC_ASSETS.includes('product-providers/local.js'));assert.ok(!PUBLIC_ASSETS.some(file=>file.startsWith('tests/')));for(const file of PUBLIC_ASSETS.filter(f=>f.endsWith('.js')||f.endsWith('.html'))){assert.ok(!(await readFile(file,'utf8')).includes('Benger · przykład'),file);}});
test('fresh search and resolver use USDA without recreating historical demo IDs',async()=>{
 let external=0;const generic=createUsdaProvider({fetchImpl:async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))})});const repo=createProductRepository({generic,searchProvider:{id:'guard',searchProducts:async()=>{external++;return[];}}});
 for(const id of LEGACY_PRODUCT_IDS)assert.equal(await repo.getProductById(id),null);
 assert.deepEqual(await repo.allCachedProducts(),[]);
 const results=await repo.searchProducts('banan');assert.ok(results.products.length);assert.ok(results.products.every(p=>p.source==='usda'));assert.equal(external,0);
 const resolved=await createProductResolver({repository:repo}).resolve({query:'banan',unit:'g'});for(const p of[resolved.product,...resolved.alternatives].filter(Boolean)){assert.equal(p.source,'usda');assert.ok(!LEGACY_PRODUCT_IDS.has(p.id));}await repo.close();
});
test('experimental notes are not published or initialized; primary voice entry remains',async()=>{
 assert.ok(!PUBLIC_ASSETS.includes('legacy.js'));
 const app=await readFile('app.js','utf8'),html=await readFile('index.html','utf8');
 assert.ok(!app.includes('initLegacyNotes'));assert.ok(!html.includes('Notatki głosowe — eksperymentalne'));
 assert.ok(app.includes('initVoiceEntry'));assert.ok(html.includes('id="voice-microphone"'));
});
