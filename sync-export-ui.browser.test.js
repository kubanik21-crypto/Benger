import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {startBrowser} from './tests/browser-harness.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(p,expression){for(let i=0;i<300;i++){if(await p.evaluate(expression))return;await pause(30);}assert.fail(expression);}
async function range(p,from='2026-11-01',to='2026-11-02'){await p.evaluate(`for(const [id,value]of ${JSON.stringify([['sync-export-from',from],['sync-export-to',to]])}){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input'));}`);}
async function preview(p){await p.evaluate("document.querySelector('#sync-export form').requestSubmit()");await wait(p,"!document.querySelector('#sync-export button').disabled");}
async function exportFile(p){await p.evaluate("document.querySelector('#sync-export .button-primary').click()");await wait(p,"!document.querySelector('#sync-export button').disabled");}
const seed=`(async()=>{
 const {NUTRITION_STORAGE_KEY}=await import('./app-storage.js');const {createProductStorage}=await import('./product-cache.js');const {createGoalsStore}=await import('./goals.js');const {createProgressStore}=await import('./progress.js');const {EXERCISES}=await import('./training-library.js');const {dosage}=await import('./training-model.js');
 localStorage.setItem(NUTRITION_STORAGE_KEY,JSON.stringify([{id:'sync-food',date:'2026-11-01',createdAt:'2026-11-01T08:00:00Z',meal:'lunch',productId:'custom:test',productName:'Test',amount:100,unit:'g',nutrition:{kcal:200,protein:20,fat:0,carbs:30},note:'PRIVATE_FOOD'}]));
 const goals=createGoalsStore();await goals.add({id:'sync-goal',effectiveFrom:'2026-10-30',nutrition:{kcal:2300}});await goals.close();
 const progress=createProgressStore();await progress.save({id:'sync-weight',type:'weight',date:'2026-11-01',time:'08:00',note:'PRIVATE_WEIGHT',values:{kg:80}});await progress.save({id:'sync-pressure',type:'pressure',date:'2026-11-01',time:'08:00',period:'morning',note:'PRIVATE_BP',values:{systolic:120,diastolic:80,pulse:60}});await progress.close();
 const storage=createProductStorage();for(const [kind,mode]of [['workout','strength'],['mobility','mobility']]){const id='sync-'+kind;const value={id,name:kind==='workout'?'Trening A':'Mobility',kind,status:'completed',date:'2026-11-01',startedAt:'2026-11-01T10:00:00Z',completedAt:'2026-11-01T11:00:00Z',index:0,note:'PRIVATE_SESSION',before:null,after:null,items:[{exercise:EXERCISES.find(e=>e.mode===mode),dosage:dosage(),sets:kind==='workout'?[{id:'set',kind:'warmup',kg:0,reps:10,rir:0}]:[],completedSets:kind==='mobility'?1:0}]};const key='training:'+ (kind==='workout'?'completedWorkouts:':'completedMobility:')+id;await storage.mutate('meta',key,()=>({key,value}));}await storage.close();
 window.syncSource=async()=>{const s=createProductStorage(),p=createProgressStore();try{return JSON.stringify({diary:localStorage.getItem(NUTRITION_STORAGE_KEY),db:await s.snapshot(),progress:await p.snapshot()});}finally{await s.close();await p.close();}};
 window.syncOriginal=await window.syncSource();
})()`;

test('settings export previews real data, writes browser JSON offline and preserves source databases',{timeout:90000},async t=>{
 const b=await startBrowser({staticPrefix:'/Benger/',productionBuild:true,mockOFF:true});t.after(()=>b.close());const p=await b.page(b.base);
 await p.evaluate(seed);await p.evaluate("location.hash='/ustawienia'");await wait(p,"document.documentElement.dataset.route==='ustawienia'");await range(p);await preview(p);
 const text=await p.evaluate("document.querySelector('#sync-export-preview').textContent");assert.match(text,/200 kcal · B 20 g · T 0 g · W 30 g/);assert.match(text,/Wykonane treningi: 1 · Mobility: 1/);
 assert.match(text,/Wpisy żywieniowe1/);assert.match(text,/Pomiary masy1/);assert.doesNotMatch(text,/PRIVATE_|120/);
 assert.match(await p.evaluate("document.querySelector('#sync-export-last').textContent"),/Nie wykonano/);
 await p.evaluate(`window.syncBlob=null;const originalURL=URL.createObjectURL;URL.createObjectURL=blob=>{window.syncBlob=blob;return originalURL(blob);};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download.startsWith('benger-sync-')){window.syncFilename=this.download;return;}return click.call(this);};`);
 await p.evaluate('navigator.serviceWorker.ready');await wait(p,'Boolean(navigator.serviceWorker.controller)');await p.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 // Change after preview: file and visible totals must use fresh data, not the old payload.
 await p.evaluate(`(async()=>{const {NUTRITION_STORAGE_KEY}=await import('./app-storage.js');const rows=JSON.parse(localStorage.getItem(NUTRITION_STORAGE_KEY));rows[0].nutrition.kcal=300;localStorage.setItem(NUTRITION_STORAGE_KEY,JSON.stringify(rows));window.syncOriginal=await window.syncSource();})()`);
 await exportFile(p);assert.equal(await p.evaluate('window.syncFilename'),'benger-sync-2026-11-01-2026-11-02.json');
 const payload=await p.evaluate('(async()=>JSON.parse(await window.syncBlob.text()))()');assert.equal(payload.foodEntries[0].nutrition.kcal,300);assert.equal(payload.measurements.length,1);assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_|systolic|diastolic|pulse|"note"/);
 assert.match(await p.evaluate("document.querySelector('#sync-export-last').textContent"),/Ostatni eksport/);assert.equal(await p.evaluate('(async()=>window.syncOriginal===await window.syncSource())()'),true);
 for(const width of [320,390,430,1024]){await p.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});assert.equal(await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);}
 await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:1400,deviceScaleFactor:1,mobile:true});await p.evaluate("document.documentElement.dataset.theme='dark';document.querySelector('#sync-export').scrollIntoView({block:'start'})");
 const screenshot=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('/tmp/benger-sync-export-settings.png',Buffer.from(screenshot.data,'base64'));
 await p.reload();await wait(p,"Boolean(document.querySelector('#sync-export'))");assert.match(await p.evaluate("document.querySelector('#sync-export-last').textContent"),/Ostatni eksport/);
 await p.evaluate("location.hash='/dziennik'");await wait(p,"document.documentElement.dataset.route==='dziennik'");await p.evaluate('history.back()');await wait(p,"document.documentElement.dataset.route==='ustawienia'");assert.deepEqual(b.errors,[]);
});

test('empty/invalid ranges, corrupt data and native save cancel/error/success are safe',{timeout:90000},async t=>{
 const b=await startBrowser({staticPrefix:'/Benger/',productionBuild:true,mockOFF:true});t.after(()=>b.close());const p=await b.page(b.base);await p.evaluate("location.hash='/ustawienia'");await range(p,'2026-11-03','2026-11-01');await preview(p);assert.match(await p.evaluate("document.querySelector('#sync-export-status').textContent"),/nieprawidłowy zakres/);
 await range(p,'','2026-11-01');await preview(p);assert.match(await p.evaluate("document.querySelector('#sync-export-status').textContent"),/Wybierz datę/);
 await range(p);await preview(p);assert.match(await p.evaluate("document.querySelector('#sync-export-preview').textContent"),/Brak danych żywieniowych/);assert.match(await p.evaluate("document.querySelector('#sync-export-preview').textContent"),/Możesz zapisać pusty zakres/);
 await p.evaluate(`window.nativeWrites=[];window.nativeOutcome='cancel';window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{BengerNative:{beginBackup:async({filename})=>{if(!/^benger-sync-\\d{4}-\\d{2}-\\d{2}-\\d{4}-\\d{2}-\\d{2}\\.json$/.test(filename))throw new Error('Invalid sync filename');window.nativeFilename=filename;if(window.nativeOutcome==='cancel')return{saved:false};if(window.nativeOutcome==='error')throw new Error('Błąd zapisu testowy');return{id:'test'};},writeBackup:async({data})=>window.nativeWrites.push(data),finishBackup:async()=>({saved:true}),abortBackup:async()=>{}}}};`);
 await exportFile(p);assert.match(await p.evaluate("document.querySelector('#sync-export-status').textContent"),/Anulowano/);assert.match(await p.evaluate("document.querySelector('#sync-export-last').textContent"),/Nie wykonano/);
 await p.evaluate("window.nativeOutcome='error'");await exportFile(p);assert.match(await p.evaluate("document.querySelector('#sync-export-status').textContent"),/Błąd zapisu testowy/);assert.match(await p.evaluate("document.querySelector('#sync-export-last').textContent"),/Nie wykonano/);
 await p.evaluate("window.nativeOutcome='success'");await p.evaluate("document.querySelector('#sync-export .button-primary').click();document.querySelector('#sync-export .button-primary').click()");await wait(p,"!document.querySelector('#sync-export button').disabled");
 const saved=await p.evaluate('JSON.parse(window.nativeWrites.join(""))');assert.equal(saved.schemaVersion,1);assert.equal(saved.dailyNutrition.length,2);assert.equal(await p.evaluate('window.nativeWrites.length'),1);
 assert.match(await p.evaluate("document.querySelector('#sync-export-status').textContent"),/Plik JSON zapisany/);
 await p.evaluate(`(async()=>{const {NUTRITION_STORAGE_KEY}=await import('./app-storage.js');localStorage.setItem(NUTRITION_STORAGE_KEY,'{broken');})()`);await preview(p);assert.equal(await p.evaluate("document.querySelector('#sync-export-preview').hidden"),true);assert.match(await p.evaluate("document.querySelector('#sync-export-status').textContent"),/Nie udało/);
 assert.equal(await p.evaluate(`(async()=>{const{NUTRITION_STORAGE_KEY}=await import('./app-storage.js');return localStorage.getItem(NUTRITION_STORAGE_KEY)})()`),'{broken');
 assert.deepEqual(b.errors,[]);
});

test('pending preview ignores double submission, clears stale results and reports timestamp quota failure',{timeout:90000},async t=>{
 const b=await startBrowser({mockOFF:true});t.after(()=>b.close());const p=await b.page(b.base);
 await p.evaluate(`(async()=>{document.querySelector('#sync-export').remove();const {initSyncExportUi}=await import('./sync-export-ui.js');const {buildSyncExport}=await import('./sync-export.js');window.readCalls=0;window.saveCalls=0;const local={getItem:()=>null,setItem:()=>{throw new Error('quota');}};initSyncExportUi({local,read:async options=>{window.readCalls++;await new Promise(r=>window.releaseSync=r);return buildSyncExport({diary:[],goals:[],training:{completedWorkouts:[],completedMobility:[]},measurements:[]},options);},save:async()=>{window.saveCalls++;return{saved:true,native:true};}});})()`);
 await range(p);await p.evaluate("document.querySelector('#sync-export .button-primary').click();document.querySelector('#sync-export .button-primary').click()");await wait(p,'Boolean(window.releaseSync)');assert.equal(await p.evaluate('window.readCalls'),1);await p.evaluate('window.releaseSync()');await wait(p,"!document.querySelector('#sync-export button').disabled");assert.equal(await p.evaluate('window.saveCalls'),1);assert.match(await p.evaluate("document.querySelector('#sync-export-status').textContent"),/Nie udało się zapamiętać daty/);
 await p.evaluate("window.dispatchEvent(new Event('benger:progress'))");assert.equal(await p.evaluate("document.querySelector('#sync-export-preview').hidden"),true);
 await p.evaluate(`(async()=>{const descriptor=Object.getOwnPropertyDescriptor(window,'localStorage');try{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('denied');}});document.querySelector('#sync-export').remove();const {initSyncExportUi}=await import('./sync-export-ui.js');initSyncExportUi();}finally{Object.defineProperty(window,'localStorage',descriptor);}})()`);
 assert.match(await p.evaluate("document.querySelector('#sync-export-last').textContent"),/Nie można odczytać/);
 assert.deepEqual(b.errors,[]);
});
