import test from 'node:test';
import assert from 'node:assert/strict';
import { startBrowser } from './tests/browser-harness.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(p,expression){const end=Date.now()+20000;while(Date.now()<end){if(await p.evaluate(expression))return;await pause(35);}assert.fail(expression);}
const detail=p=>p.evaluate("document.querySelector('[data-portion-detail]').textContent");
const click=(p,selector)=>p.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
test('REFERENCE — branded nutrition, visible estimate, explicit overrides, history and offline',{timeout:120000},async t=>{
 const b=await startBrowser({staticPrefix:'/Benger/previews/etap-7/',previewBuild:true,mockOFF:true});t.after(()=>b.close());const p=await b.page(b.base);await p.date('2026-10-26');
 await p.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();for(const[name,alias]of [['Masło orzechowe','moje masło orzechowe'],['Oliwa z oliwek','moja oliwa'],['Miód','mój miód'],['Domowy sos','mój sos']]){const product=await r.saveCustomProduct({name,brand:'Pilos',unit:'g',per100:{kcal:600,protein:20,fat:50,carbs:15}});await r.createAlias(alias,product.id);}await r.close();})()");
 await t.test('OFF product keeps OFF nutrition while only household mass comes from USDA reference',async()=>{
  b.off.products=[{...b.off.products[0],code:'3017620422003',product_name_pl:'Masło orzechowe Pilos',brands_tags_pl:['Pilos'],quantity:null,nutrition:{aggregated_set:{per:'100g',preparation:'as_sold',nutrients:{'energy-kcal':{value:600,unit:'kcal'},proteins:{value:20,unit:'g'},fat:{value:50,unit:'g'},carbohydrates:{value:15,unit:'g'}}}}}];
  await p.evaluate("window.__advanceClock(65000);document.getElementById('barcode').value='3017620422003';document.getElementById('barcode-form').requestSubmit()");await wait(p,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");
  await p.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const result=await r.getProductByBarcode('3017620422003');await r.createAlias('markowy krem',result.product.id);await r.close()})()");
  await p.analyze('2 łyżki markowy krem');assert.match(await detail(p),/ok\. 32 g/);assert.match(await p.evaluate("document.querySelector('[data-values]').textContent"),/192 kcal/);assert.match(await p.evaluate("document.querySelector('[data-provenance]').textContent"),/Open Food Facts/);
 });
 await t.test('reference is MEDIUM, approx is visible, own nutrition is used and acceptance does not learn a portion',async()=>{
  await p.analyze('2 łyżki mojego masła orzechowego');assert.match(await detail(p),/ok\. 32 g.*typowa wartość/);assert.equal(await p.evaluate("document.querySelector('[data-values]').textContent.includes('192 kcal')"),true);assert.equal(await p.evaluate("document.getElementById('save-meal-proposal').disabled"),false);assert.ok(await p.evaluate("[...document.querySelectorAll('.portion-controls summary')].some(e=>e.textContent==='Ustaw własną porcję')"));await p.accept();
  const row=(await p.saved()).at(-1);assert.equal(row.amount,32);assert.equal(row.estimated,true);assert.equal(row.portionConversion.referenceProductId,'usda:174266');assert.equal(row.portionConversion.confidence,'MEDIUM');assert.match((await p.visible()).at(-1).text,/ok\. 32 g.*typowa wartość/);
  const memory=await p.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const m=await r.portions.list();await r.close();return m})()");assert.deepEqual(memory,[]);
 });
 await t.test('editing a reference count updates estimate; USER overrides it explicitly without changing old diary',async()=>{
  await p.analyze('2 łyżki mojego masła orzechowego');await p.evaluate("document.querySelector('[data-amount]').value='3';document.querySelector('[data-amount]').dispatchEvent(new Event('input'))");assert.match(await detail(p),/ok\. 48 g/);
  await p.evaluate("document.querySelector('[data-portion-weight]').value='20';document.querySelector('[data-portion-remember=true]').click()");await wait(p,"document.querySelector('[data-portion-detail]').textContent.includes('60 g')");assert.doesNotMatch(await detail(p),/ok\.|typowa wartość/);await p.accept();const rows=await p.saved();assert.equal(rows[0].amount,32);assert.equal(rows[0].estimated,true);assert.equal(rows.at(-1).amount,60);assert.equal(rows.at(-1).portionConversion.source,'USER');assert.equal(rows.at(-1).portionConversion.estimated,false);
 });
 await t.test('olive to honey product change recalculates reference without stale provenance',async()=>{
  await p.analyze('2 łyżki mojej oliwy');assert.match(await detail(p),/ok\. 27 g/);const honey=await p.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const id=await r.resolveAlias('mój miód');await r.close();return id})()");
  await p.evaluate("const q=document.querySelector('[data-query]');q.value='Miód';q.dispatchEvent(new Event('input'));document.querySelector('[data-search]').click()");await wait(p,`Boolean(document.querySelector('[data-choice-id="${honey}"]'))`);await click(p,`[data-choice-id="${honey}"]`);await wait(p,"document.querySelector('[data-portion-detail]').textContent.includes('ok. 42 g')");await p.accept();assert.equal((await p.saved()).at(-1).portionConversion.referenceFamily,'honey');
 });
 await t.test('unsafe homemade sauce remains unresolved',async()=>{await p.analyze('2 łyżki mojego sos');assert.equal(await p.evaluate("document.getElementById('save-meal-proposal').disabled"),true);assert.doesNotMatch(await detail(p),/typowa wartość/);});
 await t.test('reference snapshots survive reload, backup roundtrip and offline calculation',async()=>{
  await p.evaluate('navigator.serviceWorker.ready');await p.reload();await wait(p,'Boolean(navigator.serviceWorker.controller)');await p.date('2026-10-26');
  const backup=await p.evaluate("(async()=>{const{exportBackup,importBackup}=await import('./backup.js');const before=await exportBackup();await importBackup(JSON.stringify(before),{mode:'replace'});return{before,after:await exportBackup()}})()");assert.deepEqual(backup.before.data.diary,backup.after.data.diary);assert.ok(backup.after.data.diary.some(e=>e.estimated));
  await p.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await p.reload();await p.date('2026-10-26');await p.analyze('2 łyżki mojej oliwy');assert.match(await detail(p),/ok\. 27 g/);assert.equal((await p.saved())[0].amount,32);assert.deepEqual(b.errors,[]);
 });
});
