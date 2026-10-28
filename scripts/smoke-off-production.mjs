// Run only after publishing the exact tested production SHA. No fixture products or API mocks.
import assert from 'node:assert/strict';
import {appendFile} from 'node:fs/promises';
import {startBrowser} from '../tests/browser-harness.mjs';
import {smokeOffPreview} from './smoke-off-preview.mjs';

const sha=process.argv[2];
assert.match(sha??'',/^[a-f0-9]{40}$/);
const url='https://kubanik21-crypto.github.io/Benger/';
const b=await startBrowser({staticPrefix:'/',respectProxy:true});
try{
 const p=await b.page(url);
 assert.equal(await p.evaluate("document.querySelector('meta[name=benger-build]').content"),sha);
 assert.equal(await p.evaluate("document.querySelector('meta[name=benger-storage-namespace]')"),null);
 assert.equal(await p.evaluate("document.querySelector('meta[name=benger-off-search-endpoint]').content"),'https://benger-off-search-preview.kubanik-21.workers.dev/search');
 const storage=await p.evaluate("(async()=>{const s=await import('./app-storage.js');return{namespace:s.STORAGE_NAMESPACE,db:s.PRODUCT_DB_NAME,diary:s.NUTRITION_STORAGE_KEY}})()");
 assert.deepEqual(storage,{namespace:'',db:'BengerDB',diary:'benger.nutrition.v1'});
 assert.equal(await p.evaluate("(async()=>typeof(await import('./product-resolver.js')).resolveProductQuery)()"),'function');
 const off=await smokeOffPreview(p,b);
 assert.ok(off.searches.every(r=>r.http===200&&r.onlineSuccess),'Live production searches must be successful, not just attempt a request');
 assert.ok(off.searches.every(r=>r.uncheckedGETs===0&&!r.fromServiceWorker&&!r.fromDiskCache));
 // Exercise the actual published diary UI using the real bundled local catalog.
 const wait=async expression=>{for(let i=0;i<400;i++){if(await p.evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw new Error(expression);};
 await p.date('2026-10-28');
 await p.evaluate("document.getElementById('search-internet').checked=false;document.getElementById('product-search').value='marchewka';document.getElementById('product-search-form').requestSubmit()");
 await wait("document.getElementById('search-results').getAttribute('aria-busy')==='false'");
 await p.evaluate("document.querySelector('#search-results [data-product-id]').click();document.getElementById('amount').value='100';document.getElementById('amount').dispatchEvent(new Event('input'));document.getElementById('nutrition-meal').value='breakfast';document.getElementById('nutrition-form').requestSubmit();location.hash='/dziennik'");
 await wait("Boolean(document.querySelector('details.meal-group .edit-entry'))");
 const beforeEdit=await p.saved(),previous=beforeEdit.at(-1);
 assert.equal(await p.evaluate("document.querySelector('details.meal-group').open"),false);
 await p.evaluate("document.querySelector('details.meal-group summary').click();document.querySelector('.edit-entry').click();document.getElementById('diary-edit-amount').value='200';document.getElementById('diary-edit-amount').dispatchEvent(new Event('input'));document.getElementById('diary-edit-save').click()");
 const afterEdit=await p.saved(),edited=afterEdit.find(row=>row.id===previous.id);
 assert.equal(afterEdit.length,beforeEdit.length);assert.equal(edited.amount,200);
 assert.equal(edited.nutrition.kcal,previous.nutrition.kcal*2);
 assert.equal(await p.evaluate("document.getElementById('diary-edit-dialog').open"),false);
 const diaryEdit={sameId:true,noDuplicate:true,amount:edited.amount,unit:edited.unit,kcal:edited.nutrition.kcal,initiallyCollapsed:true};
 await p.evaluate('navigator.serviceWorker.ready');
 const scope=await p.evaluate('(async()=>(await navigator.serviceWorker.ready).scope)()');
 assert.equal(scope,url);
 const report={sha,url,storage,scope,off,diaryEdit};
 console.log(JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Production OFF smoke\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
 for(const row of off.searches)console.log('::notice title=Production OFF search::'+JSON.stringify(row).replaceAll('%','%25').replaceAll('\n','%0A').replaceAll('\r','%0D'));
 console.log('::notice title=Production identity::'+JSON.stringify({sha,url,storage,scope}));
 console.log('::notice title=Production diary editing::'+JSON.stringify(diaryEdit));
}finally{await b.close();}
