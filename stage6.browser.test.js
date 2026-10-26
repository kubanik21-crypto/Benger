import test from'node:test';import assert from'node:assert/strict';import{writeFile,readFile,mkdtemp,rm}from'node:fs/promises';import{join}from'node:path';import{tmpdir}from'node:os';import{startBrowser}from'./tests/browser-harness.mjs';
const DAY='2026-10-26',prefix='/Benger/previews/etap-6/';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(page,expression,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await page.evaluate(expression))return;await pause(40);}assert.fail(expression);}
const click=(p,id)=>p.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
async function search(p,query){await p.evaluate(`document.getElementById('search-internet').checked=false;document.getElementById('product-search').value=${JSON.stringify(query)};document.getElementById('product-search-form').requestSubmit()`);await wait(p,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");}
const CAMERA=`
window.__cameraStarts=0;window.__cameraStops=0;window.__cameraCode='3017620422003';window.__cameraError=null;window.__nativeCalls=0;
Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async options=>{window.__cameraStarts++;if(window.__cameraError)throw Object.assign(new Error('camera'),{name:window.__cameraError});const canvas=document.createElement('canvas');canvas.width=420;canvas.height=220;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,420,220);const stream=canvas.captureStream(10);stream.getTracks().forEach(track=>{const original=track.stop.bind(track);track.stop=()=>{window.__cameraStops++;original();};});return stream;}});
window.BarcodeDetector=class{static async getSupportedFormats(){return ['ean_13','ean_8','upc_a','upc_e'];}async detect(){window.__nativeCalls++;return window.__cameraCode?[{rawValue:window.__cameraCode,format:'ean_13'}]:[];}};
`;

test('Etap 6 — PWA, offline katalog, aparat, backup i bezpieczny update',{timeout:180000},async t=>{
 const browser=await startBrowser({staticPrefix:prefix,previewBuild:true,mockOFF:true});t.after(()=>browser.close());browser.off.products=[{...browser.off.products[0],code:'3017620422003',product_name_pl:'Nutella — fixture',quantity:'350 g',nutrition:{aggregated_set:{per:'100g',preparation:'as_sold',nutrients:{'energy-kcal':{value:539,unit:'kcal'},proteins:{value:6.3,unit:'g'},fat:{value:30.9,unit:'g'},carbohydrates:{value:57.5,unit:'g'}}}}}];const started=performance.now(),a=await browser.page(browser.base,{initScript:CAMERA});await a.date(DAY);
 const metrics={coldMs:performance.now()-started};
 await t.test('manifest, prawdziwe ikony, scope, gotowy shell i brak automatycznej kamery',async()=>{
  await a.evaluate('navigator.serviceWorker.ready');await wait(a,'Boolean(navigator.serviceWorker.controller)');
  const scope=await a.evaluate('(async()=>{const r=await navigator.serviceWorker.ready;return r.scope})()');assert.equal(scope,browser.base);
  assert.equal(await a.evaluate("navigator.serviceWorker.getRegistration(new URL('/Benger/',location.href).href).then(Boolean)"),false);
  const manifest=await a.evaluate("fetch('./manifest.webmanifest').then(r=>r.json())");assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,2);
  assert.equal(await a.evaluate('window.__cameraStarts'),0);assert.equal(await a.evaluate('typeof window.ZXingBrowser'),'undefined');
  await search(a,'płatki owsiane');await a.evaluate("document.querySelector('#search-results [data-product-id^=\"usda:\"]').click();document.getElementById('amount').value='50';document.getElementById('amount').dispatchEvent(new Event('input'));document.getElementById('nutrition-meal').value='breakfast'");await a.submit();assert.equal((await a.saved()).length,1);
  await a.evaluate("caches.open('benger-shell:/Benger/:production-sentinel')");
 });
 await t.test('USDA po polsku, bez OFF i z poprawnymi wartościami na porcję',async()=>{
  const before=browser.off.requests.length;await search(a,'pierś z kurczaka');
  const product=await a.evaluate("document.querySelector('#search-results [data-product-id]').dataset.productId");assert.match(product,/^usda:/);await a.evaluate("document.querySelector('#search-results [data-product-id]').click();document.getElementById('amount').value='100';document.getElementById('amount').dispatchEvent(new Event('input'))");
  assert.ok(Number((await a.outputs('portion'))[0].replace(',','.'))>50);assert.equal(browser.off.requests.length,before);
 });
 await t.test('native skan odczytuje raz, lookup barcode, zatrzymuje kamerę i nie ładuje ZXing',async()=>{
  await click(a,'scan-barcode');await wait(a,"document.getElementById('barcode').value==='3017620422003' && !document.getElementById('scanner-dialog').open");await wait(a,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");
  assert.equal(await a.evaluate('window.__cameraStarts'),1);assert.ok(await a.evaluate('window.__cameraStops>=1'));assert.equal(await a.evaluate('typeof window.ZXingBrowser'),'undefined');
  assert.equal(browser.off.requests.filter(r=>r.method==='GET'&&r.url.includes('/product/3017620422003')).length,1);assert.ok(await a.evaluate("document.querySelector('#search-results [data-product-id^=\"off:\"]')!==null"));
 });
 await t.test('nieznany kod proponuje własny produkt z wpisanym kodem',async()=>{
  browser.off.mode='empty';await a.evaluate("window.__advanceClock(65000);document.getElementById('barcode').value='4006381333931';document.getElementById('barcode-form').requestSubmit()");await wait(a,"document.getElementById('search-results').getAttribute('aria-busy')==='false'");
  assert.match(await a.evaluate("document.getElementById('catalog-message').textContent"),/Nie znaleźliśmy/);await click(a,'create-from-barcode');assert.equal(await a.evaluate("document.getElementById('custom-barcode').value"),'4006381333931');await click(a,'custom-cancel');browser.off.mode='ok';
 });
 await t.test('custom create, barcode lokalnie, voice, ulubione i alias',async()=>{
  await click(a,'create-custom');await a.evaluate("(()=>{const values={name:'Moje paliwo',brand:'Moja marka',barcode:'5901234123457',unit:'g',kcal:'200',protein:'10',fat:'4',carbs:'30'};for(const[k,v]of Object.entries(values))document.getElementById('custom-'+k).value=v;document.getElementById('custom-form').requestSubmit()})()");
  await wait(a,"!document.getElementById('custom-dialog').open && document.querySelector('#custom-products').textContent.includes('Moje paliwo')");
  const before=browser.off.requests.length;const lookup=await a.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const p=await r.getProductByBarcode('5901234123457');await r.setFavorite(p.product,true);await r.createAlias('moje paliwko',p.product.id);await r.close();return p})()");
  assert.equal(lookup.product.source,'custom');assert.equal(browser.off.requests.length,before);
  await a.analyze('na kolację 50 g moje paliwo');assert.equal(await a.evaluate("document.getElementById('save-meal-proposal').disabled"),false);await a.accept();assert.equal((await a.saved()).at(-1).nutrition.kcal,100);
 });
 await t.test('offline reload, diary, USDA, custom, cached OFF i analiza tekstu',async()=>{
  await a.evaluate('navigator.serviceWorker.ready');const before=(await a.saved()).length;
  await a.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});const start=performance.now();await a.reload();metrics.offlineMs=performance.now()-start;await a.date(DAY);assert.equal((await a.saved()).length,before);
  for(const query of ['banan','ryż','pierś z kurczaka']){await search(a,query);assert.ok(await a.evaluate("document.querySelector('#search-results [data-product-id^=\"usda:\"]')!==null"),query);}
  const state=await a.evaluate("(async()=>{const{createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const result={custom:await r.getProductByBarcode('5901234123457'),off:await r.getProductByBarcode('3017620422003'),favorites:await r.favoriteProducts(),alias:await r.resolveAlias('moje paliwko')};await r.close();return result})()");assert.equal(state.custom.product.source,'custom');assert.equal(state.off.product.source,'openfoodfacts');assert.ok(state.favorites.length);assert.ok(state.alias);
  await a.analyze('na kolację 10 g moje paliwko');assert.equal(await a.evaluate("document.getElementById('save-meal-proposal').disabled"),false);
  await a.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});const warm=performance.now();await a.reload();metrics.warmMs=performance.now()-warm;
 });
 await t.test('anulowanie i błędy kamery; mobilny dialog nie zasłania przycisku',async()=>{
  await a.evaluate("window.__cameraCode=null");
  for(const width of [320,360,390,430]){await a.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await click(a,'scan-barcode');await wait(a,'Boolean(document.getElementById("scanner-video").srcObject)');const dims=await a.evaluate("(()=>{const r=document.getElementById('cancel-scanner').getBoundingClientRect();return{scroll:document.documentElement.scrollWidth,width:innerWidth,bottom:r.bottom}})()");assert.ok(dims.scroll<=dims.width);assert.ok(dims.bottom<=844);await click(a,'cancel-scanner');assert.equal(await a.evaluate("document.getElementById('scanner-video').srcObject"),null);}
  await a.evaluate("window.__cameraError='NotAllowedError'");await click(a,'scan-barcode');await wait(a,"document.getElementById('scanner-status').textContent.includes('dostępu')");await click(a,'cancel-scanner');await a.evaluate('window.__cameraError=null');
 });
 await t.test('backup pełny, invalid import bez zmiany danych, quota rollback i recovery',async()=>{
  const data=await a.evaluate("(async()=>{const{exportBackup}=await import('./backup.js');return exportBackup()})()");assert.ok(data.data.customProducts.length);assert.ok(data.data.aliases.length);assert.ok(data.data.favorites.length);
  const directory=await mkdtemp(join(tmpdir(),'benger-import-ui-'));try{
   const file=join(directory,'backup.json');await writeFile(file,JSON.stringify(data));const {root}=await a.send('DOM.getDocument');const {nodeId}=await a.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#backup-file'});await a.send('DOM.setFileInputFiles',{nodeId,files:[file]});await wait(a,"document.getElementById('backup-status').textContent.includes('Sprawdzono')");assert.equal(await a.evaluate("document.getElementById('backup-import').disabled"),true);await click(a,'backup-confirm');const id=await a.evaluate('window.__documentId');await click(a,'backup-import');await wait(a,`window.__documentId!==${JSON.stringify(id)} && document.getElementById('product-catalog')?.dataset.ready==='true'`);assert.equal((await a.saved()).length,data.data.diary.length);
  }finally{await rm(directory,{recursive:true,force:true});}
  const result=await a.evaluate(`(async()=>{const{importBackup,exportBackup}=await import('./backup.js');const before=(await exportBackup()).data;try{await importBackup('{')}catch{};const invalid=(await exportBackup()).data;const original=Storage.prototype.setItem;let count=0;Storage.prototype.setItem=function(k,v){if(k.includes('nutrition')&&++count===2)throw new Error('quota test');return original.call(this,k,v)};let rejected=false;try{await importBackup(${JSON.stringify(JSON.stringify(data))})}catch{rejected=true}finally{Storage.prototype.setItem=original}return{before,invalid,after:(await exportBackup()).data,rejected}})()`);
  assert.deepEqual(result.invalid,result.before);assert.deepEqual(result.after,result.before);assert.equal(result.rejected,true);
  await a.evaluate(`(async()=>{const{importBackup}=await import('./backup.js');await importBackup(${JSON.stringify(JSON.stringify(data))})})()`);assert.equal((await a.saved()).length,data.data.diary.length);
  await a.evaluate("(async()=>{const{createProductStorage}=await import('./product-cache.js');const{NUTRITION_STORAGE_KEY}=await import('./app-storage.js');const s=createProductStorage(),snapshot=await s.snapshot();await s.replace({...snapshot,meta:[...snapshot.meta,{key:'backup-import-journal-v1',snapshot,diary:localStorage.getItem(NUTRITION_STORAGE_KEY)}]});localStorage.setItem(NUTRITION_STORAGE_KEY,'[]');await s.close()})()");await a.reload();assert.equal((await a.saved()).length,data.data.diary.length);
 });
 await t.test('edycja/usunięcie custom nie zmienia historycznej porcji',async()=>{
  const before=await a.saved();await a.evaluate("[...document.querySelectorAll('#custom-products button')].find(b=>b.textContent==='Edytuj').click()");await a.evaluate("document.getElementById('custom-kcal').value='300';document.getElementById('custom-form').requestSubmit()");await wait(a,"!document.getElementById('custom-dialog').open");assert.deepEqual(await a.saved(),before);
  await a.evaluate("[...document.querySelectorAll('#custom-products button')].find(b=>b.textContent==='Usuń').click()");await wait(a,"!document.getElementById('custom-products').textContent.includes('Moje paliwo')");assert.deepEqual(await a.saved(),before);
 });
 await t.test('install prompt tylko po kliknięciu, standalone nie pokazuje instalacji',async()=>{
  await a.evaluate("(()=>{window.__installPrompted=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.__installPrompted++};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e)})()");assert.equal(await a.evaluate("document.getElementById('install-app').hidden"),false);assert.equal(await a.evaluate('window.__installPrompted'),0);await click(a,'install-app');await wait(a,"document.getElementById('install-app').hidden");assert.equal(await a.evaluate('window.__installPrompted'),1);
  await a.evaluate("(()=>{const original=window.matchMedia;window.matchMedia=()=>({matches:true});const e=new Event('beforeinstallprompt',{cancelable:true});window.dispatchEvent(e);window.matchMedia=original})()");assert.equal(await a.evaluate("document.getElementById('install-app').hidden"),true);
 });
 await t.test('SW update nie odświeża edycji sam, po zgodzie zmienia cache bez utraty danych',async()=>{
  assert.ok(browser.staticDirectory);const before=await a.saved();await a.evaluate("document.getElementById('meal-text').value='Niezapisana edycja'");
  const source=await readFile(join(browser.staticDirectory,'sw-assets.js'),'utf8');await writeFile(join(browser.staticDirectory,'sw-assets.js'),source.replace(/self.BENGER_VERSION="[^"]+"/,'self.BENGER_VERSION="update-test"'));await (await import('node:fs/promises')).appendFile(join(browser.staticDirectory,'service-worker.js'),'\n// update test\n');
  await a.evaluate('(async()=>{const r=await navigator.serviceWorker.ready;await r.update()})()');await wait(a,"!document.getElementById('update-app').hidden");assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'Niezapisana edycja');
  const old=await a.evaluate('window.__documentId');await click(a,'update-app');await wait(a,`window.__documentId!==${JSON.stringify(old)} && document.getElementById('product-catalog')?.dataset.ready==='true'`);assert.deepEqual(await a.saved(),before);
  const caches=await a.evaluate('caches.keys()');assert.ok(caches.includes('benger-shell:/Benger/:production-sentinel'));assert.equal(caches.filter(k=>k.startsWith('benger-shell:'+prefix)).length,1);assert.ok(caches.some(k=>k.endsWith(':update-test')));
 });
 console.log('Stage6 browser timings:',JSON.stringify(metrics));assert.deepEqual(browser.errors,[]);
});

const REAL_FALLBACK_CAMERA=`
Object.defineProperty(window,'BarcodeDetector',{configurable:true,value:undefined});window.__cameraStops=0;
Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
 const canvas=document.createElement('canvas');canvas.width=420;canvas.height=220;const ctx=canvas.getContext('2d');
 const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
 const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
 const R=L.map(s=>s.split('').map(b=>b==='0'?'1':'0').join('')),code='3017620422003',parity='LLGGGL';
 let bits='101';for(let i=1;i<=6;i++)bits+=(parity[i-1]==='L'?L:G)[Number(code[i])];bits+='01010';for(let i=7;i<13;i++)bits+=R[Number(code[i])];bits+='101';
 function draw(){ctx.fillStyle='white';ctx.fillRect(0,0,420,220);ctx.fillStyle='black';for(let i=0;i<bits.length;i++)if(bits[i]==='1')ctx.fillRect(60+i*3,20,3,180);}draw();const interval=setInterval(draw,100),stream=canvas.captureStream(10);
 stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{window.__cameraStops++;clearInterval(interval);stop();};});return stream;
}});
`;
test('ZXing real bundled decoder reads EAN13 pixels and works without CDN',{timeout:60000},async t=>{
 const browser=await startBrowser({staticPrefix:prefix,previewBuild:true,mockOFF:true});t.after(()=>browser.close());const page=await browser.page(browser.base,{initScript:REAL_FALLBACK_CAMERA});
 assert.equal(await page.evaluate('typeof window.ZXingBrowser'),'undefined');await click(page,'scan-barcode');
 await wait(page,"document.getElementById('barcode').value==='3017620422003'",25000);await wait(page,"!document.getElementById('scanner-dialog').open");
 assert.equal(await page.evaluate('typeof window.ZXingBrowser.BrowserMultiFormatReader'),'function');assert.ok(await page.evaluate('window.__cameraStops>=1'));
 assert.equal(browser.requests.filter(r=>/unpkg|jsdelivr/.test(r.url)).length,0);assert.deepEqual(browser.errors,[]);
});

test('archiwalne snapshoty pozostają identyczne; demo nie trafia do UI/rankingu',{timeout:60000},async t=>{
 const b=await startBrowser({staticPrefix:prefix,previewBuild:true,mockOFF:true});t.after(()=>b.close());const p=await b.page(b.base);await p.date(DAY);
 const entries=[['oat-flakes','Płatki owsiane',185,6.5,3.5,30],['peeled-banana','Banan',106.8,1.32,.36,27.36],['natural-yogurt','Jogurt',60,4,2,6],['milk-2-percent','Mleko 2%',100,6.8,4,9.6]].map(([id,name,kcal,protein,fat,carbs],i)=>({id:`historical-${i}`,date:DAY,createdAt:'2026-10-20T10:00:00Z',meal:'breakfast',productId:id,productName:name,source:'benger',amount:100,unit:'g',nutrition:{kcal,protein,fat,carbs}}));
 const raw=JSON.stringify(entries),notes=JSON.stringify([{id:'note-old',date:DAY,meal:'Śniadanie',text:'Moja stara notatka'}]);
 await p.setRaw('benger.preview-etap-6.nutrition.v1',raw);await p.setRaw('benger.preview-etap-6.meals.v1',notes);await p.reload();await p.date(DAY);
 assert.equal((await p.visible()).length,4);assert.equal(await p.raw('benger.preview-etap-6.nutrition.v1'),raw);assert.equal(await p.raw('benger.preview-etap-6.meals.v1'),notes);
 assert.deepEqual(await p.outputs('total'),['451,8','18,62','9,86','72,96']);assert.equal(await p.evaluate("document.body.textContent.includes('Benger · przykład')"),false);assert.equal(await p.evaluate("document.getElementById('basic-products')"),null);
 await search(p,'banan');const results=await p.evaluate("[...document.querySelectorAll('#search-results [data-product-id]')].map(n=>n.dataset.productId)");assert.ok(results.length);assert.ok(results.every(id=>id.startsWith('usda:')));
 const backup=await p.evaluate("(async()=>{const{exportBackup}=await import('./backup.js');return exportBackup()})()");assert.deepEqual(backup.data.diary,entries);assert.equal(await p.raw('benger.preview-etap-6.nutrition.v1'),raw);assert.deepEqual(b.errors,[]);
});
