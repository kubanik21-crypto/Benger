import test from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {buildSyncExport} from './sync-export.js';
import {summarizeSyncExport, LAST_SYNC_EXPORT_KEY} from './sync-export-ui.js';
import {NUTRITION_STORAGE_KEY} from './app-storage.js';
const empty=()=>({diary:[],goals:[],training:{completedWorkouts:[],completedMobility:[]},measurements:[]});
test('UI summary distinguishes no nutrition from zero and uses exported snapshot values',()=>{
 const source=empty(),options={from:'2026-11-01',to:'2026-11-03'};
 const noData=summarizeSyncExport(buildSyncExport(source,options));
 assert.equal(noData.nutrition.kcal,null);assert.equal(noData.counts.days,3);assert.equal(noData.counts.daysWithEntries,0);
 source.diary=[{id:'f',date:'2026-11-01',createdAt:'2026-11-01T08:00:00Z',meal:'breakfast',productId:'custom:test',productName:'Test',amount:100,unit:'g',nutrition:{kcal:0,protein:0,fat:0,carbs:0}}];
 assert.equal(summarizeSyncExport(buildSyncExport(source,options)).nutrition.kcal,0);
 source.diary[0].nutrition={kcal:200,protein:20,fat:0,carbs:30};source.diary.push({...source.diary[0],id:'f2'});
 const result=summarizeSyncExport(buildSyncExport(source,options));assert.deepEqual(result.nutrition,{kcal:400,protein:40,fat:0,carbs:60});assert.equal(result.counts.foodEntries,2);assert.equal(result.counts.daysWithEntries,1);
});
test('UI counts sessions, exercise positions, individual sets and measurement categories independently',()=>{
 const payload=buildSyncExport(empty(),{});
 payload.completedWorkouts=[{exercises:[{sets:[{},{}]},{sets:[]}]}];payload.completedMobility=[{exercises:[{sets:[],completedSets:3}]}];
 payload.measurements=[{type:'weight'},{type:'body'},{type:'body'}];payload.nutritionGoals=[{}];
 const {counts}=summarizeSyncExport(payload);assert.deepEqual(counts,{days:0,daysWithEntries:0,foodEntries:0,goals:1,workouts:1,mobility:1,exercises:3,sets:2,weight:1,body:2});
});
test('export operational timestamp key is namespace-specific and separate from business data',()=>{
 assert.equal(LAST_SYNC_EXPORT_KEY,NUTRITION_STORAGE_KEY+'.sync-export.last.v1');assert.notEqual(LAST_SYNC_EXPORT_KEY,NUTRITION_STORAGE_KEY);
});
test('UI combines product and historical recipe macros without consulting live recipes',()=>{
 const source=empty();
 source.diary=[{id:'product',date:'2026-11-01',createdAt:'2026-11-01T08:00:00Z',meal:'breakfast',productId:'custom:test',productName:'Test',amount:100,unit:'g',nutrition:{kcal:200,protein:20,fat:0,carbs:30}},
 {id:'recipe',date:'2026-11-01',createdAt:'2026-11-01T12:00:00Z',meal:'lunch',kind:'RECIPE',sourceType:'recipe',recipeId:'11111111-1111-4111-8111-111111111111',recipeVersion:1,recipeName:'Curry',recipeYieldSnapshot:{servings:5},amount:1,unit:'serving',nutrition:{kcal:500,protein:30,fat:20,carbs:50}}];
 source.recipes=[{version:2,nutrition:{kcal:900}}];
 const out=buildSyncExport(source,{from:'2026-11-01',to:'2026-11-01'}),summary=summarizeSyncExport(out);
 assert.deepEqual(summary.nutrition,{kcal:700,protein:50,fat:20,carbs:80});assert.equal(summary.counts.foodEntries,2);assert.equal(out.foodEntries[1].recipeVersion,1);
});

test('Android filename allowlist retains backup names and accepts only bounded sync JSON names',async()=>{
 const java=await readFile('android/app/src/main/java/io/github/kubanik21crypto/benger/BengerNativePlugin.java','utf8');
 const guard=java.split('@PluginMethod public void beginBackup')[1].split('backupPending')[0];
 const expressions=[...guard.matchAll(/name\.matches\(("(?:[^"\\]|\\.)*")\)/g)].map(match=>new RegExp('^(?:'+JSON.parse(match[1])+')$'));
 assert.equal(expressions.length,2);
 const allowed=name=>expressions.some(pattern=>pattern.test(name));
 for(const name of ['benger-backup.json','benger-full-backup.json','benger-sync-2026-11-01-2026-11-30.json'])assert.equal(allowed(name),true,name);
 for(const name of ['../benger-backup.json','benger-sync-test.json','benger-sync-2026-11-01-2026-11-30.json.exe','benger-sync-2026-11-01-2026-11-30/secret.json','anything.json','benger-sync-2026-1-1-2026-11-30.json'])assert.equal(allowed(name),false,name);
});
