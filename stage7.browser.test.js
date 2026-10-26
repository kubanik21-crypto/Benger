import test from 'node:test';
import assert from 'node:assert/strict';
import { startBrowser } from './tests/browser-harness.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(page,expression,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(expression))return;await pause(35);}assert.fail(expression);}
const click=(p,selector)=>p.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const count=p=>p.evaluate("document.querySelector('[data-amount]').value");
const gram=p=>p.evaluate("document.querySelector('[data-portion-detail]').textContent");
const disabled=p=>p.evaluate("document.getElementById('save-meal-proposal').disabled");
async function amount(p,value,unit){await p.evaluate(`(()=>{const c=document.querySelector('.proposal-card'),i=c.querySelector('[data-amount]');i.value=${JSON.stringify(value)};i.dispatchEvent(new Event('input'));${unit?`const u=c.querySelector('[data-unit]');u.value=${JSON.stringify(unit)};u.dispatchEvent(new Event('change'));`:''}})()`);}
async function learn(p,weight,remember){await p.evaluate(`document.querySelector('[data-portion-weight]').value=${JSON.stringify(weight)}`);await click(p,`[data-portion-remember="${remember}"]`);await wait(p,"document.querySelector('[data-item-id=food-1]').dataset.ready==='true'");}

test('Etap 7 — porcje domowe, jawne uczenie, snapshot, backup, offline i scope',{timeout:180000},async t=>{
 const b=await startBrowser({staticPrefix:'/Benger/previews/etap-7/',previewBuild:true,mockOFF:true});t.after(()=>b.close());const p=await b.page(b.base);await p.date('2026-10-26');
 await p.evaluate(`(async()=>{const {createProductRepository}=await import('./product-repository.js');const r=createProductRepository();window.__foodIds={};for(const [key,name,unit,weight,portionUnit]of [['bread','Chleb testowy','g',38,'slice'],['other','Inny chleb','g',null,'slice'],['milk','Mleko testowe','ml',null,'cup'],['butter','Masło testowe','g',null,'teaspoon'],['skyr','Skyr testowy','g',150,'package']]){const product=await r.saveCustomProduct({name,unit,per100:{kcal:100,protein:5,fat:2,carbs:10},...(portionUnit==='package'?{packageAmount:weight}:weight?{portions:[{id:key+'-portion',productId:'pending',unit:portionUnit,amount:1,normalizedAmount:weight,normalizedUnit:unit,source:'USER',description:'Etykieta testowa'}]}:{})});window.__foodIds[key]=product.id;await r.createAlias(key==='bread'?'mój chleb':key==='other'?'inny chleb':key==='milk'?'moje mleko':key==='butter'?'moje masło':'mój skyr',product.id);}await r.close();})()`);
 await t.test('alias → 3 kromki → 114g; edit 2 → 76g; zapis i snapshot',async()=>{
  await p.analyze('3 kromki mojego chleba');assert.equal(await count(p),'3');assert.match(await gram(p),/114 g/);assert.equal(await disabled(p),false);
  await amount(p,'2');assert.match(await gram(p),/76 g/);await p.accept();const entry=(await p.saved()).at(-1);assert.equal(entry.amount,76);assert.equal(entry.displayPortion.unit,'slice');assert.equal(entry.portionConversion.normalizedAmount,76);assert.match((await p.visible()).at(-1).text,/2 kromki.*76 g/);
 });
 await t.test('unknown teaspoon mass blocks save, one-shot does not learn',async()=>{
  await p.analyze('łyżeczka mojego masła');assert.equal(await disabled(p),true);await learn(p,'5',false);assert.match(await gram(p),/5 g/);await p.accept();
  await p.analyze('łyżeczka mojego masła');assert.equal(await disabled(p),true);
  await learn(p,'6',true);assert.match(await gram(p),/6 g/);await p.accept();await p.reload();await p.date('2026-10-26');await p.analyze('2 łyżeczki mojego masła');assert.match(await gram(p),/12 g/);assert.equal(await disabled(p),false);
 });
 await t.test('changing grams does not implicitly teach; preserved old historical entry',async()=>{
  await amount(p,'75','g');assert.equal(await disabled(p),false);await p.accept();await p.analyze('łyżeczka mojego masła');assert.match(await gram(p),/6 g/);const old=(await p.saved()).find(row=>row.displayPortion?.unit==='teaspoon');assert.equal(old.amount,5);
 });
 await t.test('half package uses exact custom pack; cups need explicit ml vessel setting',async()=>{
  await p.analyze('pół opakowania mojego skyra');assert.match(await gram(p),/75 g/);await p.accept();
  await p.analyze('pół szklanki mojego mleka');assert.equal(await disabled(p),true);await p.evaluate("document.getElementById('portion-cup').value='250';document.getElementById('portion-settings-form').requestSubmit()");await wait(p,"document.getElementById('portion-settings-status').textContent.includes('Zapisano')");
  await p.analyze('pół szklanki mojego mleka');assert.match(await gram(p),/125 ml/);await p.accept();
 });
 await t.test('product change invalidates old slice definition, explicit weight restores only changed row',async()=>{
  await p.analyze('2 kromki mojego chleba i łyżeczka mojego masła');const id=await p.evaluate('window.__foodIds?.other');
  const other=await p.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const result=await r.resolveAlias('inny chleb');await r.close();return result;})()");
  await p.evaluate("(()=>{const q=document.querySelector('[data-item-id=food-1] [data-query]');q.value='Inny chleb';q.dispatchEvent(new Event('input'));document.querySelector('[data-item-id=food-1] [data-search]').click();})()");
  await wait(p,`Boolean(document.querySelector('[data-choice-id="${other}"]'))`);await click(p,`[data-choice-id="${other}"]`);await wait(p,"document.querySelector('[data-item-id=food-1] h4').textContent==='Inny chleb'");assert.equal(await disabled(p),true);assert.equal(await p.evaluate("document.querySelector('[data-item-id=food-2]').dataset.ready"),'true');await learn(p,'35',false);assert.match(await gram(p),/70 g/);
 });
 await t.test('real USDA olive tablespoon and egg choices remain product-specific',async()=>{
  await p.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();await r.createAlias('moja oliwa','usda:171413');await r.createAlias('moje jajko','usda:171287');await r.close()})()");
  await p.analyze('2 łyżki mojej oliwy');assert.match(await gram(p),/27 g/);await p.accept();
  await p.analyze('2 sztuki moje jajko');assert.equal(await disabled(p),true);assert.ok(await p.evaluate("document.querySelectorAll('.portion-choice').length>=4"));await click(p,'.portion-choice button');await wait(p,"document.querySelector('.proposal-card').dataset.ready==='true'");assert.equal(await disabled(p),false);
 });
 await t.test('backup retains memory, vessel settings and snapshot; invalid import rolls back',async()=>{
  const result=await p.evaluate("(async()=>{const{exportBackup,importBackup}=await import('./backup.js');const before=await exportBackup();let rejected=false;try{await importBackup(JSON.stringify({...before,data:{...before.data,portionMemory:[{...before.data.portionMemory[0],normalizedAmount:-1}]}}))}catch{rejected=true;}const after=await exportBackup();await importBackup(JSON.stringify(before),{mode:'replace'});return{before,after,rejected,restored:await exportBackup()}})()");
  assert.equal(result.rejected,true);assert.deepEqual(result.after.data,result.before.data);assert.deepEqual(result.restored.data,result.before.data);assert.ok(result.before.data.portionMemory.length);assert.equal(result.before.data.portionSettings.cupMl,250);assert.ok(result.before.data.diary.some(e=>e.portionConversion));
 });
 await t.test('offline reload and household resolution preserve snapshots, USDA and memory',async()=>{
  await p.evaluate('navigator.serviceWorker.ready');await p.reload();await wait(p,'Boolean(navigator.serviceWorker.controller)');const before=await p.saved();
  await p.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await p.reload();await p.date('2026-10-26');assert.deepEqual(await p.saved(),before);await p.analyze('2 łyżki mojej oliwy');assert.match(await gram(p),/27 g/);await p.analyze('2 łyżeczki mojego masła');assert.match(await gram(p),/12 g/);
  await p.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 });
 await t.test('320/360/390/430px, labels, focus targets and console',async()=>{
  for(const width of [320,360,390,430]){await p.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await p.evaluate('document.documentElement.scrollWidth<=innerWidth'));}
  assert.ok(await p.evaluate("Boolean(document.querySelector('label[for=food-1-portion-weight]'))"));
  assert.equal(await p.evaluate("document.querySelector('[data-portion-remember]').getBoundingClientRect().height>=44"),true);assert.deepEqual(b.errors,[]);assert.deepEqual(b.responses.filter(r=>r.url.startsWith(b.base)&&r.status>=400),[]);
 });
});
