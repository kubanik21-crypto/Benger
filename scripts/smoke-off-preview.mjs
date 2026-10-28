import assert from 'node:assert/strict';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(p,expression){const end=Date.now()+20000;while(Date.now()<end){if(await p.evaluate(expression))return;await pause(50);}throw new Error('Timeout: '+expression);}
const queries=['Mięsne Specjały','Mięsne Specjały','Mięsne Specjały mięso mielone','mięso mielone wieprzowo wołowe','sos sojowy'];
// Runs on the deployed frontend. Production OFF is never mocked unless the local test opts in.
export async function smokeOffPreview(p,b,{mocked=false}={}){
 await p.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await wait(p,'navigator.onLine===true');
 const endpoint=await p.evaluate("document.querySelector('meta[name=\"benger-off-search-endpoint\"]')?.content??null");
 const searches=()=>b.networkRequests.filter(r=>r.method==='GET'&&(endpoint?r.url.startsWith(endpoint+'?'):r.url.startsWith('https://world.openfoodfacts.org/cgi/search.pl?')));
 const message=()=>p.evaluate("document.getElementById('catalog-message').textContent");
 async function search(query,enabled){await p.evaluate(`location.hash='/produkty';document.getElementById('search-internet').checked=${enabled};document.getElementById('product-search').value=${JSON.stringify(query)};document.getElementById('product-search-form').requestSubmit()`);await wait(p,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");}
 const report=[];let lastRequestAt=0,rateLimited=false;
 for(const [i,query]of queries.entries()){
  if(rateLimited){report.push({query,skipped:'OFF 429: respecting server cooldown'});continue;}
  if(mocked)await p.evaluate('window.__advanceClock(7000)');
  else if(lastRequestAt)await pause(Math.max(0,7000-(Date.now()-lastRequestAt)));
  const before=searches().length;lastRequestAt=Date.now();await search(query,true);
  assert.equal(searches().length,before+1,'Enabled OFF must create a real GET: '+query);
  const url=searches().at(-1).url;assert.equal(new URL(url).searchParams.get(endpoint?'q':'search_terms'),query);
  const responses=b.networkResponses.filter(r=>r.url===url),text=await message();
  const response=responses.at(-1);if(response){assert.equal(response.fromDiskCache,false,'OFF response must bypass browser HTTP cache');assert.equal(response.fromServiceWorker,false,'SW must not intercept OFF');assert.equal(response.fromPrefetchCache,false);}
  const http=responses.at(-1)?.status??null;
  if(http===200)assert.match(text,/katalog \+ Open Food Facts|Nie udało się pobrać wyników/);
  else assert.match(text,/Nie udało się pobrać wyników z Open Food Facts/);
  const visibleProducts=await p.evaluate("[...document.querySelectorAll('#search-results .product-name')].map(n=>n.textContent)");
  const disabledBefore=searches().length;await search(query,false);assert.equal(searches().length,disabledBefore,'Unchecked OFF must make no request');
  report.push({query,repeatedQuery:i===1,networkGET:true,url,http,fromDiskCache:response?.fromDiskCache??null,fromServiceWorker:response?.fromServiceWorker??null,onlineSuccess:text.includes('katalog + Open Food Facts'),uncheckedGETs:0,message:text,visibleProducts:visibleProducts.slice(0,5)});
  rateLimited=http===429||text.includes('ogranicza liczbę zapytań');
 }
 let barcode;
 if(rateLimited)barcode={code:'28037989',skipped:'OFF 429: respecting server cooldown'};
 else{
  if(mocked){b.off.mode='empty';await p.evaluate('window.__advanceClock(7000)');}
  const before=b.networkRequests.length;
  await p.evaluate("document.getElementById('barcode').value='28037989';document.getElementById('barcode-form').requestSubmit()");await wait(p,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");
  assert.ok(b.networkRequests.slice(before).some(r=>r.method==='GET'&&r.url.includes('/api/v3.6/product/28037989')),'Barcode must use product API');
  const text=await message(),notFound=text.includes('Nie znaleziono produktu o tym kodzie w Open Food Facts');
  if(notFound){assert.equal(await p.evaluate("document.getElementById('create-from-barcode').hidden||document.getElementById('search-by-name').hidden"),false);await p.evaluate("document.getElementById('search-by-name').click()");assert.equal(await p.evaluate('document.activeElement.id'),'product-search');await p.evaluate("document.getElementById('create-from-barcode').click()");assert.equal(await p.evaluate("document.getElementById('custom-barcode').value"),'28037989');await p.evaluate("document.getElementById('custom-cancel').click()");}
  if(mocked)assert.equal(notFound,true);
  barcode={code:'28037989',notFound,message:text,http:b.responses.filter(r=>r.url.includes('/api/v3.6/product/28037989')).at(-1)?.status??null};
 }
 assert.equal(b.errors.some(e=>e.exceptionId||e.mockError||Array.isArray(e)),false,'No uncaught JavaScript errors');
 return {mocked,searches:report,barcode,networkFailures:b.failures};
}
