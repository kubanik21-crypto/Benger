import test from 'node:test';
import assert from 'node:assert/strict';
import {startBrowser} from './tests/browser-harness.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(p,expression){for(let i=0;i<350;i++){if(await p.evaluate(expression))return;await pause(25);}throw new Error(expression);}
const click=(p,selector)=>p.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function edit(p,meal='breakfast'){
 await p.evaluate(`location.hash='/dziennik';document.querySelector('[data-meal="${meal}"]').open=true`);
 await click(p,`[data-meal="${meal}"] .edit-entry`);
 await wait(p,"document.getElementById('diary-edit-dialog').open");
}
async function amount(p,value){await p.evaluate(`document.getElementById('diary-edit-amount').value=${JSON.stringify(value)};document.getElementById('diary-edit-amount').dispatchEvent(new Event('input'))`);}
test('collapsible meals and in-place quantity editing preserve diary snapshots and storage',{timeout:120000},async t=>{
 const b=await startBrowser({staticPrefix:'/Benger/',productionBuild:true,mockOFF:true,seedProducts:true});t.after(()=>b.close());const p=await b.page(b.base);await p.date('2026-10-28');
 await p.choose('custom:test-oats','50','breakfast');await p.submit();await p.choose('custom:test-milk','200','dinner');await p.submit();
 const initial=await p.saved(),id=initial[0].id;
 await t.test('meals start collapsed with count/kcal, keyboard-accessible native summaries expand',async()=>{
  assert.deepEqual(await p.evaluate("[...document.querySelectorAll('details.meal-group')].map(d=>d.open)"),[false,false]);
  assert.match(await p.evaluate("document.querySelector('[data-meal=breakfast] summary').textContent"),/Śniadanie \(1\).*185 kcal/);
  await click(p,'[data-meal=breakfast] summary');assert.equal(await p.evaluate("document.querySelector('[data-meal=breakfast]').open"),true);
 });
 await t.test('50→100 g replaces one entry, recalculates day/dashboard, retains ID and other meals',async()=>{
  await edit(p);await amount(p,'100');assert.match(await p.evaluate("document.getElementById('diary-edit-preview').textContent"),/370 kcal/);
  await click(p,'#diary-edit-save');const rows=await p.saved();assert.equal(rows.length,2);assert.equal(rows[0].id,id);assert.equal(rows[0].amount,100);assert.equal(rows[0].createdAt,initial[0].createdAt);assert.equal(rows[0].nutrition.kcal,370);assert.deepEqual(rows[1],initial[1]);assert.equal((await p.outputs('total'))[0],'470');
  assert.equal(await p.evaluate("document.querySelector('[data-meal=breakfast]').open"),true);await wait(p,"document.activeElement.classList.contains('edit-entry')");
 });
 await t.test('invalid input hides preview and cannot save; cancel and Escape leave data unchanged',async()=>{
  const before=await p.saved();await edit(p);
  for(const value of ['', '0','-1','abc','5,5,5']){await amount(p,value);assert.equal(await p.evaluate("document.getElementById('diary-edit-save').disabled"),true);assert.equal(await p.evaluate("document.getElementById('diary-edit-preview').textContent"),'');assert.deepEqual(await p.saved(),before);}
  await click(p,'#diary-edit-cancel');await edit(p);await amount(p,'300');await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait(p,"!document.getElementById('diary-edit-dialog').open");assert.deepEqual(await p.saved(),before);
 });
 await t.test('Polish decimal, milk ml and rapid submit do not duplicate entries',async()=>{
  await edit(p);await amount(p,'50,5');await p.evaluate("document.getElementById('diary-edit-save').form.requestSubmit();document.getElementById('diary-edit-save').form.requestSubmit()");assert.equal((await p.saved()).length,2);assert.equal((await p.saved())[0].amount,50.5);
  await edit(p,'dinner');await amount(p,'100');await click(p,'#diary-edit-save');assert.equal((await p.saved())[1].unit,'ml');assert.equal((await p.saved())[1].nutrition.kcal,50);
 });
 await t.test('latest data is read at save; unrelated entries survive and conflicting edits are rejected',async()=>{
  const q=await b.page(b.base);await q.date('2026-10-28');await edit(p);await q.choose('custom:test-banana','120','lunch');await q.submit();await amount(p,'60');await click(p,'#diary-edit-save');assert.equal((await p.saved()).length,3);
  await edit(p);await edit(q);await amount(q,'70');await click(q,'#diary-edit-save');await amount(p,'80');await click(p,'#diary-edit-save');assert.match(await p.evaluate("document.getElementById('diary-edit-error').textContent"),/innej karcie/);assert.equal((await p.saved())[0].amount,70);await click(p,'#diary-edit-cancel');
 });
 await t.test('mobile light/dark, offline reload and day switch retain corrected entries',async()=>{
  for(const width of [320,390,430]){await p.evaluate(`document.documentElement.dataset.theme=${JSON.stringify('dark')}`);await p.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});await edit(p);assert.equal(await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);assert.notEqual(await p.evaluate("getComputedStyle(document.getElementById('diary-edit-dialog')).backgroundColor"),'rgb(255, 255, 255)');await click(p,'#diary-edit-cancel');}
  const saved=await p.saved();await p.evaluate('navigator.serviceWorker.ready');await wait(p,'Boolean(navigator.serviceWorker.controller)');await p.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await p.reload();await p.date('2026-10-28');assert.deepEqual(await p.saved(),saved);await edit(p);await amount(p,'75');await click(p,'#diary-edit-save');assert.equal((await p.saved())[0].amount,75);await p.date('2026-10-29');assert.equal((await p.visible()).length,0);await p.date('2026-10-28');assert.equal((await p.visible()).length,3);
 });
 await t.test('storage quota failure keeps editor open and original entry durable',async()=>{
  const before=await p.saved();await edit(p);await amount(p,'90');
  await p.evaluate("window.__realDiarySet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='benger.nutrition.v1')throw new DOMException('full','QuotaExceededError');return window.__realDiarySet.call(this,k,v)}");
  await click(p,'#diary-edit-save');assert.equal(await p.evaluate("document.getElementById('diary-edit-dialog').open"),true);assert.ok(await p.evaluate("document.getElementById('diary-edit-error').textContent.length>0"));assert.deepEqual(await p.saved(),before);
  await p.evaluate('Storage.prototype.setItem=window.__realDiarySet;delete window.__realDiarySet');await click(p,'#diary-edit-cancel');
 });
 await t.test('saved recipe portion can change offline without a live recipe, retaining version/yield',async()=>{
  const recipe={id:'recipe-snapshot',date:'2026-10-28',createdAt:'2026-10-28T10:00:00Z',meal:'snack',kind:'RECIPE',sourceType:'recipe',recipeId:'11111111-1111-4111-8111-111111111111',recipeName:'Usunięte curry',recipeVersion:2,recipeYieldSnapshot:{servings:5},amount:1,unit:'serving',nutrition:{kcal:200,protein:10,fat:8,carbs:22}};
  await p.evaluate(`localStorage.setItem('benger.nutrition.v1',JSON.stringify([...JSON.parse(localStorage.getItem('benger.nutrition.v1')),${JSON.stringify(recipe)}]))`);await p.reload();await p.date('2026-10-28');await edit(p,'snack');await amount(p,'1,5');await click(p,'#diary-edit-save');
  const saved=(await p.saved()).find(row=>row.id===recipe.id);assert.equal(saved.amount,1.5);assert.equal(saved.nutrition.kcal,300);assert.equal(saved.recipeVersion,2);assert.deepEqual(saved.recipeYieldSnapshot,{servings:5});assert.equal(saved.recipeId,recipe.recipeId);
 });
 await t.test('removing the last item in an expanded meal returns focus to a visible summary',async()=>{await p.remove('recipe-snapshot');assert.equal((await p.saved()).length,3);assert.equal(await p.evaluate("document.activeElement.tagName"),'SUMMARY');});
 assert.deepEqual(b.errors,[]);
});
