import test from 'node:test';
import assert from 'node:assert/strict';
import {startBrowser} from './tests/browser-harness.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));

test('local export reads real stores offline, preserves sources and never reads photos/pressure into JSON', {timeout:90000}, async t => {
  const browser = await startBrowser({staticPrefix:'/Benger/', productionBuild:true, mockOFF:true});
  t.after(()=>browser.close());
  const page = await browser.page(browser.base);
  await page.evaluate('navigator.serviceWorker.ready');
  for (let i=0;i<300;i++) { if (await page.evaluate('Boolean(navigator.serviceWorker.controller)')) break; await pause(30); }
  assert.equal(await page.evaluate('Boolean(navigator.serviceWorker.controller)'),true);
  await page.evaluate(`(async()=>{
    const {NUTRITION_STORAGE_KEY}=await import('./app-storage.js');
    const {createGoalsStore}=await import('./goals.js');
    const {createProgressStore}=await import('./progress.js');
    const {createTrainingRepository}=await import('./training-repository.js');
    const {createProductStorage}=await import('./product-cache.js');
    const {EXERCISES}=await import('./training-library.js');
    const {dosage}=await import('./training-model.js');
    const goalsStore=createGoalsStore(), progressStore=createProgressStore(), trainingRepository=createTrainingRepository(), storage=createProductStorage();
    localStorage.setItem(NUTRITION_STORAGE_KEY,JSON.stringify([{id:'sync-food',date:'2026-11-01',createdAt:'2026-11-01T08:00:00Z',meal:'breakfast',productId:'custom:test',productName:'Test',amount:100,unit:'g',nutrition:{kcal:200,protein:10,fat:0,carbs:30}}]));
    await goalsStore.add({id:'sync-goal',effectiveFrom:'2026-10-30',nutrition:{kcal:2300}});
    await progressStore.save({id:'sync-weight',type:'weight',date:'2026-11-01',time:'08:00',note:'PRIVATE_NOTE',values:{kg:80}});
    await progressStore.save({id:'sync-pressure',type:'pressure',date:'2026-11-01',time:'09:00',period:'morning',note:'PRIVATE_PRESSURE',values:{systolic:120,diastolic:80,pulse:60}});
    const exercise=EXERCISES.find(e=>e.mode==='strength');
    const value={id:'sync-workout',name:'Test',kind:'workout',status:'completed',date:'2026-11-01',startedAt:'2026-11-01T10:00:00Z',completedAt:'2026-11-01T11:00:00Z',index:0,note:'PRIVATE_WORKOUT',before:null,after:null,items:[{exercise,dosage:dosage(),completedSets:0,sets:[{id:'sync-set',kind:'work',kg:32,reps:10,rir:0}]}]};
    await storage.mutate('meta','training:completedWorkouts:sync-workout',()=>({key:'training:completedWorkouts:sync-workout',value}));
    window.syncReaders={local:{getItem:key=>localStorage.getItem(key)},goalsStore,progressStore,trainingRepository};
    window.syncBefore=JSON.stringify({diary:localStorage.getItem(NUTRITION_STORAGE_KEY),goals:await goalsStore.read(),training:await trainingRepository.snapshot(),measurements:await progressStore.measurements()});
    await storage.close();
  })()`);
  // The module has never been imported before going offline; it must be in the app shell.
  await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  const output=await page.evaluate(`(async()=>{const {readLocalSyncExport}=await import('./sync-export.js');return readLocalSyncExport(window.syncReaders,{from:'2026-11-01',to:'2026-11-02',exportedAt:'2026-11-25T10:00:00Z'});})()`);
  assert.equal(output.schemaVersion,1); assert.equal(output.dailyNutrition[0].nutrition.kcal,200);
  assert.equal(output.dailyNutrition[1].nutrition.kcal,null); assert.equal(output.dailyNutrition[0].goalNutrition.kcal,2300);
  assert.equal(output.completedWorkouts[0].exercises[0].sets[0].rir,0);
  assert.equal(output.measurements.length,1); assert.doesNotMatch(JSON.stringify(output),/PRIVATE_|systolic|diastolic|pulse|"note"/);
  assert.equal(await page.evaluate(`(async()=>{const {NUTRITION_STORAGE_KEY}=await import('./app-storage.js');const r=window.syncReaders;return window.syncBefore===JSON.stringify({diary:localStorage.getItem(NUTRITION_STORAGE_KEY),goals:await r.goalsStore.read(),training:await r.trainingRepository.snapshot(),measurements:await r.progressStore.measurements()});})()`),true);
  assert.deepEqual(browser.errors,[]);
});
