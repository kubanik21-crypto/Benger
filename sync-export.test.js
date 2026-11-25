import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSyncExport, readLocalSyncExport, SYNC_EXPORT_SCHEMA_VERSION} from './sync-export.js';
import {NUTRITION_STORAGE_KEY} from './app-storage.js';
import {EXERCISES} from './training-library.js';
import {dosage} from './training-model.js';

const options = {from:'2026-11-01', to:'2026-11-03', exportedAt:'2026-11-25T10:00:00Z'};
const nutrient = (kcal = 200) => ({kcal, protein:20, fat:0, carbs:30});
const food = (patch = {}) => ({id:'food-1', date:'2026-11-01', createdAt:'2026-11-01T08:00:00Z', meal:'breakfast', productId:'custom:oats', productName:'Płatki', amount:100, unit:'g', nutrition:nutrient(), ...patch});
const exercise = mode => EXERCISES.find(e => e.mode === mode);
function session(kind = 'workout', mode = 'strength') {
  return {id:kind+'-1', kind, status:'completed', name:'Sesja', date:'2026-11-01', startedAt:'2026-11-01T09:00:00Z', completedAt:'2026-11-01T10:00:00Z', index:0,
    note:'PRIVATE_SESSION', before:{note:'PRIVATE_BEFORE', discomfort:4}, after:{note:'PRIVATE_AFTER'},
    items:[{exercise:structuredClone(exercise(mode)), dosage:dosage({sets:3, repsMin:8, repsMax:12, note:'PRIVATE_DOSAGE', physioNote:'PRIVATE_PHYSIO', frequency:'PRIVATE_FREQUENCY'}), completedSets:kind==='mobility'?2:0,
      sets:kind==='mobility'?[]:[{id:'set-1', kind:'work', kg:32, reps:10, rir:0}, {id:'warmup-1', kind:'warmup', kg:0, reps:10}]}]};
}
function source() {
  return {diary:[food()], goals:[{id:'goal-old', effectiveFrom:'2026-10-25', nutrition:{kcal:2000}}, {id:'goal-new', effectiveFrom:'2026-11-02', nutrition:{kcal:2200, protein:120}}],
    training:{completedWorkouts:[session()], completedMobility:[session('mobility','mobility')], activeWorkout:session(), timer:{secret:'PRIVATE_TIMER'}},
    measurements:[{id:'weight-1', type:'weight', date:'2026-11-01', time:'08:30', note:'PRIVATE_MEASUREMENT', values:{kg:82.3}}, {id:'body-1', type:'body', date:'2026-11-02', time:'08:30', note:'PRIVATE_BODY', values:{waist:90}}]};
}
const empty = () => ({diary:[], goals:[], training:{completedWorkouts:[], completedMobility:[]}, measurements:[]});
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('versioned JSON export is deterministic, detached and does not mutate frozen sources', () => {
  const input = freeze(source()), before = JSON.stringify(input), result = buildSyncExport(input, options);
  assert.equal(result.schemaVersion, SYNC_EXPORT_SCHEMA_VERSION);
  assert.equal(result.mode,'snapshot');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.deepEqual(result, buildSyncExport(input, options));
  result.foodEntries[0].nutrition.kcal = 999;
  result.completedWorkouts[0].exercises[0].dosage.sets = 99;
  assert.equal(JSON.stringify(input), before);
});
test('daily nutrition totals use consumed snapshots, preserve zero, count distinct meals', () => {
  const s = source(); s.diary.push(food({id:'food-2', meal:'lunch', nutrition:nutrient(0), unit:'ml'}));
  const out = buildSyncExport(s,options), day = out.dailyNutrition[0];
  assert.deepEqual(day.nutrition, {kcal:200, protein:40, fat:0, carbs:60});
  assert.equal(day.entryCount,2); assert.equal(day.mealCount,2);
  assert.equal(out.foodEntries[1].unit,'ml');
});
test('missing days differ from explicitly recorded zero nutrition', () => {
  const s = empty(); s.diary = [food({nutrition:{kcal:0,protein:0,fat:0,carbs:0}})];
  const out = buildSyncExport(s, options);
  assert.equal(out.dailyNutrition[0].hasEntries,true); assert.equal(out.dailyNutrition[0].nutrition.kcal,0);
  assert.equal(out.dailyNutrition[1].hasEntries,false); assert.equal(out.dailyNutrition[1].nutrition.kcal,null);
  assert.equal(out.dailyNutrition[1].entryCount,0); assert.equal(out.dailyNutrition[1].goalNutrition.kcal,null);
});
test('empty, unbounded and one-sided exports do not invent dates', () => {
  assert.deepEqual(buildSyncExport(empty(), {exportedAt:options.exportedAt}).dailyNutrition,[]);
  assert.equal(buildSyncExport(empty(),options).dailyNutrition.length,3);
  assert.equal(buildSyncExport(source(),{from:'2026-11-02'}).foodEntries.length,0);
  assert.equal(buildSyncExport(source(),{to:'2026-11-01'}).foodEntries.length,1);
});
test('history carries goal before range and correctly changes mid-range; missing macros stay null', () => {
  const out = buildSyncExport(source(),options);
  assert.deepEqual(out.nutritionGoals.map(r=>[r.id,r.effectiveTo]),[['goal-old','2026-11-01'],['goal-new',null]]);
  assert.equal(out.dailyNutrition[0].goalId,'goal-old'); assert.equal(out.dailyNutrition[1].goalId,'goal-new');
  assert.equal(out.dailyNutrition[0].goalNutrition.protein,null); assert.equal(out.dailyNutrition[1].goalNutrition.protein,120);
});
test('goal interval end comes from full history, even beyond selected range; empty nutrition resets goals', () => {
  const s = source(); s.goals.push({id:'reset',effectiveFrom:'2026-11-03',nutrition:{},weight:{kg:70},body:{waist:80}});
  const out = buildSyncExport(s,{...options,to:'2026-11-02'});
  assert.equal(out.nutritionGoals[1].effectiveTo,'2026-11-02');
  const day = buildSyncExport(s,options).dailyNutrition[2]; assert.equal(day.goalId,'reset'); assert.equal(day.goalNutrition.kcal,null);
  assert.ok(!JSON.stringify(buildSyncExport(s,options).nutritionGoals).includes('waist'));
});
test('recipe nutrition and provenance survive missing/deleted/changed live recipe and product', () => {
  const s = source();
  s.diary = [{id:'recipe-entry', date:'2026-11-01',createdAt:food().createdAt, meal:'lunch', kind:'RECIPE',sourceType:'recipe',recipeId:'11111111-1111-4111-8111-111111111111',recipeVersion:1,recipeName:'Curry',recipeYieldSnapshot:{servings:5},amount:1.5,unit:'serving',nutrition:nutrient(500)}];
  s.recipes = [{nutrition:nutrient(900), version:2}];
  const before = buildSyncExport(s,options); delete s.recipes;
  assert.deepEqual(buildSyncExport(s,options),before);
  assert.equal(before.foodEntries[0].recipeVersion,1); assert.equal(before.foodEntries[0].nutrition.kcal,500);
});
test('all four meals, units and date boundaries preserve IDs and timestamps', () => {
  const s = empty(); s.diary = ['breakfast','lunch','dinner','snack'].map((meal,i)=>food({id:'food-'+i,meal,date:i===3?'2026-11-03':'2026-11-01'}));
  s.diary.push(food({id:'outside',date:'2026-11-04'}));
  const out = buildSyncExport(s,options); assert.equal(out.foodEntries.length,4);
  assert.deepEqual(out.foodEntries.map(r=>r.meal),['breakfast','lunch','dinner','snack']); assert.equal(out.foodEntries[0].createdAt,food().createdAt);
});
test('workout snapshots preserve work/warmup, dumbbell meaning, optional RIR and zero load', () => {
  const out = buildSyncExport(source(),options), item = out.completedWorkouts[0].exercises[0];
  assert.equal(item.exerciseId,exercise('strength').id); assert.equal(item.dumbbells,exercise('strength').dumbbells);
  assert.equal(item.sets[0].id,'set-1'); assert.equal(item.sets[0].rir,0); assert.equal(item.sets[0].kg,32); assert.equal(item.sets[0].reps,10);
  assert.equal(item.sets[0].loadBasis,'per-dumbbell'); assert.equal(item.sets[1].kind,'warmup'); assert.equal(item.sets[1].kg,0); assert.equal(item.sets[1].rir,null);
  assert.equal(out.completedWorkouts.length,1); assert.equal(out.completedWorkouts[0].completedAt,session().completedAt);
});
test('same exercise and same set ID at different positions have distinct export keys', () => {
  const s=source(); s.training.completedWorkouts[0].items.push(structuredClone(s.training.completedWorkouts[0].items[0]));
  const items=buildSyncExport(s,options).completedWorkouts[0].exercises;
  assert.notEqual(items[0].key,items[1].key); assert.notEqual(items[0].sets[0].key,items[1].sets[0].key);
  assert.equal(items[0].sets[0].id,items[1].sets[0].id);
});
test('bodyweight missing added load stays null and is not invented as zero', () => {
  const s=source(), w=session('workout','bodyweight'); w.items[0].sets=[{id:'s',kind:'work',reps:8}]; s.training.completedWorkouts=[w];
  const set=buildSyncExport(s,options).completedWorkouts[0].exercises[0].sets[0];
  assert.equal(set.kg,null); assert.equal(set.loadBasis,'additional-load'); assert.equal(set.rir,null);
});
test('time and cardio preserve seconds, kilometres, speed, incline and true zeros', () => {
  for (const mode of ['time','cardio']) {
    const s=source(), w=session('workout',mode); w.items[0].sets=[{id:'s',kind:'work',duration:60,...(mode==='cardio'?{distance:0,speed:0,incline:0}:{})}]; s.training.completedWorkouts=[w];
    const set=buildSyncExport(s,options).completedWorkouts[0].exercises[0].sets[0];
    assert.equal(set.durationSeconds,60); assert.equal(set.reps,null); assert.equal(set.kg,null);
    assert.equal(set.distanceKm,mode==='cardio'?0:null); assert.equal(set.inclinePercent,mode==='cardio'?0:null);
  }
});
test('Mobility contains actual completed count and prescribed dosage, no invented individual sets', () => {
  const item=buildSyncExport(source(),options).completedMobility[0].exercises[0];
  assert.equal(item.completedSets,2); assert.equal(item.dosage.sets,3); assert.deepEqual(item.sets,[]);
});
test('weight and partial circumferences preserve local times, units and missing values', () => {
  const out=buildSyncExport(source(),options); assert.equal(out.measurements[0].values.kg,82.3); assert.equal(out.measurements[0].unit,'kg');
  assert.equal(out.measurements[1].values.waist,90); assert.equal(out.measurements[1].values.neck,null); assert.equal(out.measurements[1].unit,'cm');
  assert.equal(out.measurements[0].time,'08:30'); assert.equal(out.measurements[0].utcOffsetMinutes,null);
});
test('privacy allowlist excludes photos, pressure, pulse, notes, credentials, unknown metadata and active sessions', () => {
  const s=source(); s.measurements.push({id:'pressure',type:'pressure',values:{systolic:123,diastolic:81,pulse:71},note:'PRIVATE_PRESSURE'});
  s.photos=[{data:'PRIVATE_PHOTO'}]; s.credentials={token:'PRIVATE_TOKEN'}; s.diary[0].note='PRIVATE_FOOD'; s.diary[0].apiKey='PRIVATE_KEY';
  s.training.completedWorkouts[0].items[0].exercise.note='PRIVATE_EXERCISE';
  const json=JSON.stringify(buildSyncExport(s,options));
  assert.doesNotMatch(json,/PRIVATE_|systolic|diastolic|pulse|physioNote|credentials|apiKey|activeWorkout|timer|photos|"note"/);
  assert.equal(JSON.parse(json).measurements.length,2);
});
test('changed records retain IDs and update output; old export is detached', () => {
  const s=source(), before=buildSyncExport(s,options);
  s.diary[0].amount=150; s.diary[0].nutrition.kcal=300; s.measurements[0].values.kg=81;
  s.training.completedWorkouts[0].items[0].sets[0].kg=33;
  const after=buildSyncExport(s,options);
  assert.equal(after.foodEntries[0].id,before.foodEntries[0].id); assert.equal(after.dailyNutrition[0].nutrition.kcal,300);
  assert.equal(after.measurements[0].values.kg,81); assert.equal(after.completedWorkouts[0].exercises[0].sets[0].kg,33);
  assert.equal(before.foodEntries[0].nutrition.kcal,200); assert.equal(before.measurements[0].values.kg,82.3);
});
test('deleted records disappear on next snapshot without resurrection or tombstone invention', () => {
  const s=source(); buildSyncExport(s,options); s.diary=[]; s.measurements=[]; s.goals=[]; s.training.completedWorkouts=[]; s.training.completedMobility=[];
  const out=buildSyncExport(s,options);
  for (const key of ['foodEntries','measurements','nutritionGoals','completedWorkouts','completedMobility']) assert.deepEqual(out[key],[]);
  assert.equal(out.dailyNutrition[0].nutrition.kcal,null);
});
test('range filters all dated data without confusing local date and UTC timestamp', () => {
  const s=source(); s.training.completedWorkouts[0].startedAt='2026-10-31T23:30:00Z'; s.training.completedWorkouts[0].completedAt='2026-11-01T00:30:00Z';
  assert.equal(buildSyncExport(s,{...options,from:'2026-11-01',to:'2026-11-01'}).completedWorkouts.length,1);
  const out=buildSyncExport(s,{...options,from:'2026-11-03'});
  assert.equal(out.measurements.length,0); assert.equal(out.completedWorkouts.length,0); assert.equal(out.completedMobility.length,0);
});
for (const patch of [{from:'2026-02-30'},{to:'bad'},{from:'2026-11-03',to:'2026-11-01'},{exportedAt:'bad'},{from:'1900-01-01',to:'2026-01-01'}]) {
  test('invalid options fail: '+JSON.stringify(patch),()=>assert.throws(()=>buildSyncExport(source(),{...options,...patch})));
}
test('leap day and highest YYYY-MM-DD date do not overflow iteration', () => {
  assert.equal(buildSyncExport(empty(),{from:'2024-02-28',to:'2024-03-01'}).dailyNutrition.length,3);
  assert.equal(buildSyncExport(empty(),{from:'9999-12-31',to:'9999-12-31'}).dailyNutrition[0].date,'9999-12-31');
});
test('invalid and duplicate source records fail instead of returning a misleading partial export', () => {
  for (const mutate of [s=>s.diary.push(s.diary[0]),s=>s.measurements.push(s.measurements[0]),s=>s.training.completedWorkouts.push(s.training.completedWorkouts[0]),s=>delete s.diary[0].nutrition.fat,s=>s.diary[0].nutrition.kcal=NaN,s=>s.measurements[0].values.kg=Infinity,s=>s.training.completedWorkouts[0].items[0].sets[0].rir=11,s=>delete s.training.completedMobility]) {
    const s=source(); mutate(s); assert.throws(()=>buildSyncExport(s,options));
  }
});
test('output order independent of input order', () => {
  const s=source(); s.diary.push(food({id:'another',date:'2026-11-02'})); const before=buildSyncExport(s,options);
  s.diary.reverse(); s.goals.reverse(); s.measurements.reverse(); assert.deepEqual(buildSyncExport(s,options),before);
});
function readers(s) {
  return {local:{getItem:key=>{assert.equal(key,NUTRITION_STORAGE_KEY);return JSON.stringify(s.diary);}},goalsStore:{read:async()=>s.goals},trainingRepository:{snapshot:async()=>s.training},progressStore:{measurements:async()=>s.measurements}};
}
test('read adapter uses only read APIs and no network, snapshots/photos or write methods', async () => {
  const s=source(), dependencies=readers(s); dependencies.progressStore.snapshot=()=>assert.fail('must not read photos');
  assert.deepEqual(await readLocalSyncExport(dependencies,options),buildSyncExport(s,options));
});
test('read adapter distinguishes absent diary from corrupt JSON and propagates storage failures', async () => {
  const deps=readers(empty()); deps.local.getItem=()=>null;
  assert.deepEqual((await readLocalSyncExport(deps,options)).foodEntries,[]);
  for (const value of ['', '{bad', 'null']) { deps.local.getItem=()=>value; await assert.rejects(readLocalSyncExport(deps,options)); }
  deps.local.getItem=()=>{throw new Error('storage denied');}; await assert.rejects(readLocalSyncExport(deps,options),/storage denied/);
  const failed=readers(empty()); failed.progressStore.measurements=async()=>{throw new Error('IDB unavailable');};
  await assert.rejects(readLocalSyncExport(failed,options),/IDB unavailable/);
  await assert.rejects(readLocalSyncExport({local:{}},options));
});

test('household input and normalized g are both preserved without exporting descriptions', () => {
  const s=empty();
  s.diary=[food({amount:14,displayPortion:{amount:2,unit:'piece',label:'PRIVATE_LABEL'},portionConversion:{inputAmount:2,inputUnit:'piece',normalizedAmount:14,normalizedUnit:'g',source:'USER',confidence:'HIGH',description:'PRIVATE_DESCRIPTION',definition:{id:'unit-1',productId:'custom:oats',unit:'piece',amount:1,normalizedAmount:7,normalizedUnit:'g',source:'USER',description:'PRIVATE_DEFINITION'}}})];
  const row=buildSyncExport(s,options).foodEntries[0];
  assert.equal(row.amount,14); assert.equal(row.unit,'g'); assert.equal(row.enteredAmount,2); assert.equal(row.enteredUnit,'piece');
  assert.equal(row.portionConversion.source,'USER'); assert.equal(row.portionConversion.normalizedAmount,14);
  assert.doesNotMatch(JSON.stringify(row),/PRIVATE_/);
});
