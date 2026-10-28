import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startBrowser} from '../tests/browser-harness.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(p,expression){const end=Date.now()+20000;while(Date.now()<end){if(await p.evaluate(expression))return;await pause(50);}throw new Error('Timeout: '+expression);}
const click=(p,s)=>p.evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
export const QUERIES=['marchewka','200 g marchewki','sos sojowy','15 g sosu sojowego','300 g kartofli','100 g mozarelli'];
// Real deployed frontend and real bundled USDA records; no mocked product responses or seeded aliases.
export async function smokeProductPreview(p,sha){
 assert.equal(await p.evaluate("document.querySelector('meta[name=benger-build]').content"),sha);
 assert.equal(await p.evaluate("document.querySelector('meta[name=benger-storage-namespace]').content"),'preview-global-product-resolution');
 assert.equal(await p.evaluate("(async()=>typeof(await import('./product-resolver.js')).resolveProductQuery)()"),'function');
 const results=[];await p.date('2026-10-28');
 for(const query of QUERIES){
  await p.evaluate(`location.hash='/produkty';document.getElementById('search-internet').checked=false;document.getElementById('product-search').value=${JSON.stringify(query)};document.getElementById('product-search-form').requestSubmit()`);
  await wait(p,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");
  const product=await p.evaluate("(()=>{const b=document.querySelector('#search-results [data-product-id]');return b?{id:b.dataset.productId,name:b.textContent}:null})()");assert.ok(product,'Search: '+query);
  const before=(await p.saved()).length;
  await p.analyze('na śniadanie '+query);
  await wait(p,"Boolean(document.querySelector('#meal-proposal-items [data-item-id]'))");
  await p.evaluate(`(()=>{const c=document.querySelector('#meal-proposal-items [data-item-id]');const b=[...c.querySelectorAll('[data-choice-id]')].find(b=>b.dataset.choiceId===${JSON.stringify(product.id)})||c.querySelector('[data-choice-id]');if(b)b.click()})()`);
  await pause(150);
  await p.evaluate("(()=>{const c=document.querySelector('#meal-proposal-items [data-item-id]'),u=c.querySelector('[data-unit]'),a=c.querySelector('[data-amount]');if(!u.value){u.value='g';u.dispatchEvent(new Event('change'))}if(!a.value){a.value='100';a.dispatchEvent(new Event('input',{bubbles:true}))}})()");
  await wait(p,"!document.getElementById('save-meal-proposal').disabled");await p.accept();
  await wait(p,`(async()=>{const{NUTRITION_STORAGE_KEY}=await import('./app-storage.js');return JSON.parse(localStorage.getItem(NUTRITION_STORAGE_KEY)||'[]').length===${before+1}})()`);
  const entry=(await p.saved()).at(-1);assert.ok(Number.isFinite(entry.nutrition.kcal));
  results.push({query,search:product.id,diary:entry.productId,nutrition:entry.nutrition});
 }
 await p.evaluate("location.hash='/przepisy'");await click(p,'#recipe-new');await wait(p,"!document.getElementById('recipe-editor').hidden");
 for(const [i,query]of QUERIES.entries()){
  await p.evaluate(`document.getElementById('recipe-text').value=${JSON.stringify(query)};document.getElementById('recipe-text').dispatchEvent(new Event('input'));document.getElementById('recipe-event-form').requestSubmit()`);
  await wait(p,"document.getElementById('recipe-editor').dataset.analysisState==='complete'&&!document.getElementById('recipe-event-review').hidden");
  await p.evaluate(`(()=>{const c=document.querySelector('#recipe-event-items [data-item-id]');const b=[...c.querySelectorAll('[data-choice-id]')].find(b=>b.dataset.choiceId===${JSON.stringify(results[i].diary)})||c.querySelector('[data-choice-id]');if(b)b.click()})()`);await pause(150);
  await p.evaluate("(()=>{const c=document.querySelector('#recipe-event-items [data-item-id]'),u=c.querySelector('[data-unit]'),a=c.querySelector('[data-amount]');if(!u.value){u.value='g';u.dispatchEvent(new Event('change'))}if(!a.value){a.value='100';a.dispatchEvent(new Event('input',{bubbles:true}))}})()");
  await wait(p,"!document.getElementById('recipe-event-accept').disabled");await click(p,'#recipe-event-accept');await wait(p,"document.getElementById('recipe-autosave').textContent==='Szkic zapisany na urządzeniu.'&&document.getElementById('recipe-event-review').hidden");
 }
 const ingredients=await p.evaluate("(async()=>{const{createRecipeRepository}=await import('./recipe-repository.js');const r=createRecipeRepository();try{return(await r.drafts())[0].ingredients}finally{await r.close()}})()");
 assert.equal(ingredients.length,QUERIES.length);for(const [i,row]of ingredients.entries()){assert.equal(row.productId,results[i].diary,QUERIES[i]);results[i].recipe=row.productId;}
 await p.evaluate('navigator.serviceWorker.ready');await wait(p,'Boolean(navigator.serviceWorker.controller)');
 const scope=await p.evaluate('(async()=>(await navigator.serviceWorker.ready).scope)()');assert.equal(scope,await p.evaluate("new URL('./',location.href).href"));
 await p.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await p.reload();
 assert.equal(await p.evaluate("document.querySelector('meta[name=benger-build]').content"),sha);assert.equal((await p.saved()).length,QUERIES.length);
 assert.equal(await p.evaluate("(async()=>typeof(await import('./product-resolver.js')).resolveProductQuery)()"),'function');
 return {sha,scope,offlineReload:true,results};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [url,sha]=process.argv.slice(2);assert.equal(url,'https://kubanik21-crypto.github.io/Benger/previews/global-product-resolution/');assert.match(sha,/^[a-f0-9]{40}$/);
 const b=await startBrowser({staticPrefix:'/',respectProxy:true});try{const p=await b.page(url);console.log(JSON.stringify(await smokeProductPreview(p,sha),null,2));assert.deepEqual(b.errors,[]);}finally{await b.close();}
}
