import test from 'node:test';
import assert from 'node:assert/strict';
import {startBrowser} from './tests/browser-harness.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(p,s){for(let i=0;i<250;i++){if(await p.evaluate(s))return;await pause(25);}throw new Error(s);}
const click=(p,s)=>p.evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
test('manual meal builder keeps context, user units, cart edits and immutable diary',{timeout:90000},async t=>{
 const b=await startBrowser({staticPrefix:'/Benger/',productionBuild:true,mockOFF:true,seedProducts:true});t.after(()=>b.close());const p=await b.page(b.base);await p.date('2026-11-01');
 await p.evaluate("location.hash='/produkty'");await click(p,'#start-manual-meal');
 async function search(q){await p.evaluate(`document.getElementById('search-internet').checked=false;document.getElementById('product-search').value=${JSON.stringify(q)};document.getElementById('product-search-form').requestSubmit()`);await wait(p,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");await click(p,'#search-results [data-product-id]');await wait(p,"document.getElementById('manual-quantity-dialog').open");}
 async function amount(v){await p.evaluate(`document.getElementById('amount').value=${JSON.stringify(v)};document.getElementById('amount').dispatchEvent(new Event('input'))`);}
 async function add(){await p.evaluate("document.getElementById('nutrition-form').requestSubmit()");await wait(p,"!document.getElementById('manual-quantity-dialog').open");}
 await t.test('unknown piece requires an explicit mass; user definition is remembered',async()=>{
  await search('1 banan');await amount('2');assert.equal(await p.evaluate("document.getElementById('manual-unit').value"),'piece');assert.match(await p.evaluate("document.getElementById('manual-conversion').textContent"),/Nie znam/);
  await p.evaluate("document.getElementById('manual-unit-mass').value='118';document.querySelector('#manual-unit-weight button').click()");await wait(p,"document.getElementById('manual-unit-weight').hidden");await add();assert.equal((await p.saved())[0].amount,236);assert.equal((await p.saved())[0].nutrition.kcal,210.04);
 });
 await t.test('sequential adds clear search, preserve day and meal, and total nutrition',async()=>{
  assert.equal(await p.evaluate("document.getElementById('product-search').value"),'');await search('200 g płatków owsianych');await add();await search('200 ml mleka');await add();const rows=await p.saved();assert.equal(rows.length,3);assert.ok(rows.every(r=>r.date==='2026-11-01'&&r.meal==='breakfast'));assert.equal(rows[1].amount,200);assert.equal(rows[2].unit,'ml');assert.match(await p.evaluate("document.getElementById('manual-bottom-bar').textContent"),/1050,04 kcal/);
 });
 await t.test('edit preserves entry identity and delete affects only chosen session item',async()=>{
  const id=(await p.saved())[0].id;await click(p,'#manual-cart article button');await wait(p,"document.getElementById('manual-quantity-dialog').open");await amount('1');await add();assert.equal((await p.saved())[0].id,id);assert.equal((await p.saved())[0].amount,118);await click(p,'#manual-cart article button:last-child');assert.equal((await p.saved()).length,2);
 });
 await t.test('mobile search and footer remain available without horizontal overflow',async()=>{for(const width of [320,390,430,1000]){await p.send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:width<500});assert.equal(await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);assert.equal(await p.evaluate("getComputedStyle(document.getElementById('manual-bottom-bar')).position"),'fixed');}});
 await t.test('done returns to same diary day; backup retains the user unit and last choice',async()=>{
  await click(p,'#manual-bottom-bar button');await wait(p,"location.hash==='#/dziennik'");assert.equal(await p.evaluate("document.getElementById('date').value"),'2026-11-01');const data=await p.evaluate("(async()=>{const{exportBackup}=await import('./backup.js');const b=await exportBackup();return {version:b.schemaVersion,units:b.data.portionMemory,prefs:b.data.portionSettings}})()");assert.equal(data.version,8);assert.equal(data.units[0].normalizedAmount,118);assert.ok(data.prefs.lastUsed.some(r=>r.unit==='piece'));
 });
 assert.deepEqual(b.errors,[]);
});
