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
 await p.evaluate('navigator.serviceWorker.ready');
 const scope=await p.evaluate('(async()=>(await navigator.serviceWorker.ready).scope)()');
 assert.equal(scope,url);
 const report={sha,url,storage,scope,off};
 console.log(JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Production OFF smoke\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
 for(const row of off.searches)console.log('::notice title=Production OFF search::'+JSON.stringify(row).replaceAll('%','%25').replaceAll('\n','%0A').replaceAll('\r','%0D'));
 console.log('::notice title=Production identity::'+JSON.stringify({sha,url,storage,scope}));
}finally{await b.close();}
