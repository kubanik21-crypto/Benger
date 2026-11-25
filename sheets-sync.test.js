import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSyncExport} from './sync-export.js';
import {SHEET_NAMES,SHEET_COLUMNS,mapSheetExport,rowObject,same,fingerprint} from './sheets-mapper.js';
import {emptySheetsState,prepareSheetsPlan,prepareSheetsBatchUpdate,acknowledgeSheetsPlan} from './sheets-reconcile.js';
import {EXERCISES} from './training-library.js';
import {dosage} from './training-model.js';
const range={from:'2026-11-01',to:'2026-11-03'},stamp='2026-11-25T10:00:00Z';
function source(){return {diary:Array.from({length:8},(_,i)=>({id:'food'+i,date:i<6?'2026-11-01':'2026-11-05',createdAt:'2026-11-01T08:00:00Z',meal:i%2?'lunch':'breakfast',productId:'custom:food',productName:i?'Produkt':'=IMPORTXML("bad")',amount:100,unit:'g',nutrition:{kcal:100,protein:10,fat:0,carbs:15}})),goals:[{id:'goal',effectiveFrom:'2026-10-01',nutrition:{kcal:2000}}],training:{completedWorkouts:[session('workout')],completedMobility:[session('mobility')]},measurements:[{id:'weight',type:'weight',date:'2026-11-01',time:'08:00',note:'PRIVATE_WEIGHT',values:{kg:80}}]};}
function session(kind){return {id:kind,kind,status:'completed',name:'Test',date:'2026-11-01',startedAt:'2026-11-01T09:00:00Z',completedAt:'2026-11-01T10:00:00Z',index:0,note:'PRIVATE_NOTE',before:{note:'PRIVATE_BEFORE'},after:null,items:[{exercise:EXERCISES.find(e=>e.mode===(kind==='mobility'?'mobility':'strength')),dosage:dosage({sets:2,note:'PRIVATE_DOSE',physioNote:'PRIVATE_PHYSIO'}),completedSets:kind==='mobility'?1:0,sets:kind==='mobility'?[]:[{id:'s1',kind:'warmup',kg:0,reps:10,rir:0},{id:'s2',kind:'work',kg:32,reps:10}]}]};}
const full=s=>buildSyncExport(s,{exportedAt:stamp});
const args=s=>({fullExport:full(s),current:emptySheetsState('spreadsheet'),profileId:'profile',deviceId:'phone',range,initialize:true});
async function seeded(s=source(),r={from:'2026-11-01',to:'2026-11-05'}){const plan=await prepareSheetsPlan({...args(s),range:r});assert.deepEqual(plan.blockers,[]);const current=plan.nextState,baseline=await acknowledgeSheetsPlan(plan,current);return {current,baseline,profileId:'profile',deviceId:'phone',range};}
async function authorize(options){let plan=await prepareSheetsPlan(options);plan=await prepareSheetsPlan({...options,confirmDeletionDigest:plan.deletionDigest,confirmImpactDigest:plan.impactDigest});return plan;}
const obj=(state,name)=>state.tables[name].rows.map(row=>rowObject(name,row));

test('mapper has exactly eight versioned sheets, original IDs, source units, nulls and no private notes',()=>{
 const mapped=mapSheetExport(full(source()),{profileId:'profile'});assert.deepEqual(Object.keys(mapped.rows),SHEET_NAMES);assert.equal(mapped.schemaVersion,1);
 const sets=mapped.rows.Serie.map(r=>rowObject('Serie',r)).filter(r=>r.rowType==='set');assert.equal(sets[0].setId,'s1');assert.equal(sets[0].kg,0);assert.equal(sets[0].rir,0);assert.equal(sets[1].rir,null);assert.equal(sets[1].loadBasis,'per-dumbbell');assert.equal(sets[0].kind,'warmup');
 assert.doesNotMatch(JSON.stringify(mapped),/PRIVATE_|physioNote|"note"/);assert.equal(mapped.rows.Mobility.length,2);
});
test('canonical keys independent of export time, object property order and profile namespace',()=>{
 const a=full(source()),b=structuredClone(a);b.exportedAt='2026-11-26T10:00:00Z';
 assert.deepEqual(mapSheetExport(a,{profileId:'p'}).rows,mapSheetExport(b,{profileId:'p'}).rows);
 assert.notEqual(mapSheetExport(a,{profileId:'p'}).rows['Posiłki'][0][0],mapSheetExport(a,{profileId:'other'}).rows['Posiłki'][0][0]);
 assert.ok(same({a:0,b:null},{b:null,a:0}));
});
test('first dry run creates all tabs, native typed values and one atomic body with status',async()=>{
 const a=args(source()),plan=await prepareSheetsPlan(a),batch=await prepareSheetsBatchUpdate(plan,a.current);
 assert.equal(batch.body.requests.filter(r=>r.addSheet).length,8);assert.equal(batch.body.requests.filter(r=>r.updateCells).length,8);
 assert.ok(JSON.stringify(batch.body).includes('"stringValue":"=IMPORTXML'));assert.ok(!JSON.stringify(batch.body).includes('formulaValue'));
 assert.equal(obj(plan.nextState,'Synchronizacja')[0].operationId,plan.operationId);assert.equal(obj(plan.nextState,'Dziennik żywieniowy')[1].kcal,null);
 assert.equal(obj(plan.nextState,'Dziennik żywieniowy')[0].fat,0);assert.equal(plan.changes['Posiłki'].added.length,6);
});
test('repeat plan ID is deterministic, applied retry is detected and fresh acknowledged read is a noop',async()=>{
 const a=args(source()),one=await prepareSheetsPlan(a),two=await prepareSheetsPlan(a);assert.equal(one.operationId,two.operationId);
 const duplicate=await prepareSheetsBatchUpdate(one,one.nextState);assert.equal(duplicate.alreadyApplied,true);assert.equal(duplicate.body,null);
 const baseline=await acknowledgeSheetsPlan(one,one.nextState),next=await prepareSheetsPlan({...a,current:one.nextState,baseline});
 assert.equal(next.noop,true);assert.equal((await prepareSheetsBatchUpdate(next,one.nextState)).body,null);
});
test('updates preserve ID and use saved nutrition snapshots; outside range edits are preserved remotely',async()=>{
 const s=source(),context=await seeded(s);s.diary[0].nutrition.kcal=200;s.diary[6].nutrition.kcal=999;
 const plan=await prepareSheetsPlan({...context,fullExport:full(s)});assert.deepEqual(plan.blockers,[]);assert.equal(plan.changes['Posiłki'].updated.length,1);
 assert.equal(obj(plan.nextState,'Posiłki').find(r=>r.recordId==='food6').kcal,100);
 assert.equal(obj(plan.nextState,'Dziennik żywieniowy').find(r=>r.date==='2026-11-05').kcal,200);
});
test('deletion requires bound confirmation; changed source invalidates confirmation and leaves input untouched',async()=>{
 const s=source(),context=await seeded(s),old=JSON.stringify(context.current);s.diary.shift();
 let plan=await prepareSheetsPlan({...context,fullExport:full(s)});assert.equal(plan.changes['Posiłki'].deleted.length,1);await assert.rejects(prepareSheetsBatchUpdate(plan,context.current),/potwierdzenia/);
 const confirmed=await authorize({...context,fullExport:full(s)});assert.deepEqual(confirmed.blockers,[]);assert.ok((await prepareSheetsBatchUpdate(confirmed,context.current)).body);
 s.diary[0].nutrition.kcal=123;plan=await prepareSheetsPlan({...context,fullExport:full(s),confirmDeletionDigest:confirmed.deletionDigest});assert.ok(plan.blockers.some(r=>r.includes('potwierdzenia')));assert.equal(JSON.stringify(context.current),old);
});
test('records outside range never disappear when locally deleted; suspicious loss blocks operation',async()=>{
 const s=source(),context=await seeded(s);s.diary=s.diary.filter(r=>r.id!=='food6');const plan=await authorize({...context,fullExport:full(s)});
 assert.ok(plan.blockers.some(r=>r.includes('spoza zakresu')));assert.ok(obj(plan.nextState,'Posiłki').some(r=>r.recordId==='food6'));await assert.rejects(prepareSheetsBatchUpdate(plan,context.current));
});
test('empty or sharply reduced full database is blocked even with exact deletion confirmation',async()=>{
 const context=await seeded();const s=source();s.diary=[];s.training.completedWorkouts=[];s.training.completedMobility=[];s.measurements=[];s.goals=[];
 const plan=await authorize({...context,range:{from:'2026-10-01',to:'2026-11-30'},fullExport:full(s)});assert.ok(plan.blockers.some(r=>r.includes('25%')));await assert.rejects(prepareSheetsBatchUpdate(plan,context.current));
});
test('unknown device, lost baseline, stale remote and wrong spreadsheet are blocked',async()=>{
 const s=source(),context=await seeded(s);
 for(const patch of [{deviceId:'other'},{baseline:null},{baseline:{...context.baseline,stateHash:'wrong'}},{current:{...context.current,spreadsheetId:'different'}}]){
  const plan=await prepareSheetsPlan({...context,fullExport:full(s),...patch});assert.ok(plan.blockers.length);await assert.rejects(prepareSheetsBatchUpdate(plan,plan.nextState===context.current?context.current:patch.current??context.current));
 }
});
test('moving a meal across boundary updates one ID and recomputes both dates from merged remote entries',async()=>{
 const s=source(),context=await seeded(s);s.diary[0].date='2026-11-05';s.diary[6].nutrition.kcal=999;
 const plan=await authorize({...context,fullExport:full(s)});assert.deepEqual(plan.blockers,[]);assert.ok(plan.outsideChanges.some(r=>r.table==='Posiłki'));
 const foods=obj(plan.nextState,'Posiłki');assert.equal(foods.filter(r=>r.recordId==='food0').length,1);assert.equal(foods.find(r=>r.recordId==='food0').date,'2026-11-05');
 const days=obj(plan.nextState,'Dziennik żywieniowy');assert.equal(days.find(r=>r.date==='2026-11-01').kcal,500);assert.equal(days.find(r=>r.date==='2026-11-05').kcal,300);
});
test('moving a meal from outside into range preserves identity, fixes former day, needs impact confirmation',async()=>{
 const s=source(),context=await seeded(s);s.diary[6].date='2026-11-02';const plan=await prepareSheetsPlan({...context,fullExport:full(s)});
 assert.ok(plan.impactDigest);await assert.rejects(prepareSheetsBatchUpdate(plan,context.current),/poza zakresem/);
 const confirmed=await authorize({...context,fullExport:full(s)});assert.equal(obj(confirmed.nextState,'Dziennik żywieniowy').find(r=>r.date==='2026-11-05').kcal,100);
});
test('whole workout replaces all sets and moves them with the session, even outside range',async()=>{
 const s=source(),context=await seeded(s);s.training.completedWorkouts[0].items[0].sets.pop();s.training.completedWorkouts[0].date='2026-11-05';
 const plan=await authorize({...context,fullExport:full(s)});assert.deepEqual(plan.blockers,[]);assert.equal(obj(plan.nextState,'Serie').length,2);assert.equal(obj(plan.nextState,'Serie')[0].date,'2026-11-05');
 assert.equal(obj(plan.nextState,'Treningi')[0].setCount,1);assert.ok((await prepareSheetsBatchUpdate(plan,context.current)).body);
});
test('delete session removes all children, without resurrecting custom or live exercise data',async()=>{
 const s=source(),context=await seeded(s);s.training.completedWorkouts=[];const plan=await authorize({...context,fullExport:full(s)});
 assert.deepEqual(plan.blockers,[]);assert.equal(plan.nextState.tables.Serie.rows.length,0);assert.equal(plan.nextState.tables.Treningi.rows.length,0);assert.equal(plan.changes.Serie.deleted.length,3);
});
test('Mobility is reconciled as a complete session and missing children are removed',async()=>{
 const s=source();s.training.completedMobility[0].items.push(structuredClone(s.training.completedMobility[0].items[0]));const context=await seeded(s);s.training.completedMobility[0].items.pop();
 const plan=await authorize({...context,fullExport:full(s)});assert.equal(plan.changes.Mobility.deleted.length,1);assert.equal(plan.nextState.tables.Mobility.rows.length,2);assert.deepEqual(plan.blockers,[]);
});
test('full goals history updates earlier remote summaries only in goal fields, with explicit impact approval',async()=>{
 const s=source(),context=await seeded(s);s.goals[0].nutrition.kcal=2200;s.diary[6].nutrition.kcal=900;
 const plan=await prepareSheetsPlan({...context,range:{from:'2026-11-02',to:'2026-11-03'},fullExport:full(s)});
 assert.ok(plan.outsideChanges.some(r=>r.oldDate==='2026-11-01'));assert.ok(plan.impactDigest);await assert.rejects(prepareSheetsBatchUpdate(plan,context.current));
 const confirmed=await authorize({...context,range:{from:'2026-11-02',to:'2026-11-03'},fullExport:full(s)});
 const days=obj(confirmed.nextState,'Dziennik żywieniowy');assert.equal(days.find(r=>r.date==='2026-11-01').kcal,600);assert.equal(days.find(r=>r.date==='2026-11-01').goal_kcal,2200);assert.equal(days.find(r=>r.date==='2026-11-05').kcal,200);
});
test('goal removal unsets old goal and leaves calories intact; zero values never become null',async()=>{
 const s=source(),context=await seeded(s);s.goals=[];const plan=await authorize({...context,fullExport:full(s)});assert.deepEqual(plan.blockers,[]);
 const d=obj(plan.nextState,'Dziennik żywieniowy')[0];assert.equal(d.goal_kcal,null);assert.equal(d.fat,0);assert.equal(d.kcal,600);
});
test('foreign profile is retained and other device cannot overwrite its rows',async()=>{
 const s=source(),a=await prepareSheetsPlan({...args(s),profileId:'foreign',deviceId:'foreign-phone'});
 const plan=await prepareSheetsPlan({...args(s),current:a.nextState});assert.deepEqual(plan.blockers,[]);
 for(const name of SHEET_NAMES)assert.deepEqual(plan.nextState.tables[name].rows.filter(r=>r[1]==='foreign'),a.nextState.tables[name].rows);
});
test('incomplete/ranged/corrupt snapshots and duplicate IDs fail closed before planning',async()=>{
 const valid=full(source());
 for(const mutate of [s=>s.range.from='2026-11-01',s=>delete s.foodEntries,s=>s.foodEntries.push(s.foodEntries[0]),s=>s.foodEntries.pop(),s=>s.foodEntries[0].nutrition.kcal=NaN,s=>delete s.completedWorkouts[0].exercises[0].sets[0].rir,s=>s.completedWorkouts[0].exercises[0].sets[0].kg=null,s=>s.nutritionGoals[0].effectiveTo='2026-12-31',s=>s.schemaVersion=2,s=>s.credentials='secret',s=>s.dailyNutrition[0].nutrition.kcal=0]){
  const bad=structuredClone(valid);mutate(bad);await assert.rejects(prepareSheetsPlan({...args(source()),fullExport:bad}));
 }
});
test('modified plan, changed remote after preview and partial observed result cannot be acknowledged',async()=>{
 const a=args(source()),plan=await prepareSheetsPlan(a),mutated=structuredClone(plan);mutated.nextState.tables['Posiłki'].rows[0][3]='2026-11-02';
 await assert.rejects(prepareSheetsBatchUpdate(mutated,a.current),/zmieniony/);
 const partial=structuredClone(plan.nextState);partial.tables['Posiłki'].rows.pop();await assert.rejects(acknowledgeSheetsPlan(plan,partial),/potwierdzenia/);
 const changed=structuredClone(a.current);changed.tables['Posiłki'].exists=true;await assert.rejects(prepareSheetsBatchUpdate(plan,changed),/zmienił/);
});
test('unknown schema/columns, duplicate rows and incomplete session state cannot be used as remote baseline',async()=>{
 const context=await seeded();
 for(const mutate of [s=>s.schemaVersion=2,s=>s.tables['Posiłki'].columns.push('private'),s=>s.tables['Posiłki'].rows.push(s.tables['Posiłki'].rows[0]),s=>s.tables.Serie.rows.pop()]){
  const current=structuredClone(context.current);mutate(current);await assert.rejects(prepareSheetsPlan({...context,current,fullExport:full(source())}));
 }
});
test('dry-run body uses one request range per sheet, bounded fields and no formula values or network',async()=>{
 const a=args(source()),plan=await prepareSheetsPlan(a),batch=await prepareSheetsBatchUpdate(plan,a.current);
 for(const request of batch.body.requests.filter(r=>r.updateCells)){assert.equal(request.updateCells.fields,'userEnteredValue');assert.equal(request.updateCells.range.startRowIndex,0);assert.ok(request.updateCells.rows.length<=request.updateCells.range.endRowIndex);}
 assert.equal(await fingerprint(plan),await fingerprint(structuredClone(plan)));assert.equal(batch.expectedBaseHash,plan.baseHash);
});

// Minimal transactional emulator: all changes apply to a clone, or none are returned.
function simulateBatch(current,body,failAt=-1){
 const working=structuredClone(current);
 body.requests.forEach((request,i)=>{
  if(i===failAt)throw new Error('simulated request failure');
  const id=request.addSheet?.properties.sheetId??request.updateSheetProperties?.properties.sheetId??request.updateCells?.range.sheetId;
  const [name,tab]=Object.entries(working.tables).find(([,t])=>t.sheetId===id)??[];assert.ok(tab,'known managed sheet');
  if(request.addSheet){assert.equal(tab.exists,false);tab.exists=true;}
  else if(request.updateSheetProperties){assert.equal(tab.exists,true);}
  else if(request.updateCells){const rows=request.updateCells.rows.map(r=>r.values.map(cell=>{const v=cell.userEnteredValue;return v?Object.values(v)[0]:null;}));assert.deepEqual(rows[0],SHEET_COLUMNS[name]);tab.columns=rows[0];tab.rows=rows.slice(1);}
  else assert.fail('unsupported request');
 });
 return working;
}
test('integration: batch emulator applies all eight tables atomically and acknowledgement verifies the result',async()=>{
 const a=args(source()),plan=await prepareSheetsPlan(a),batch=await prepareSheetsBatchUpdate(plan,a.current),before=structuredClone(a.current);
 assert.throws(()=>simulateBatch(a.current,batch.body,7),/simulated/);assert.deepEqual(a.current,before);
 const observed=simulateBatch(a.current,batch.body);assert.deepEqual(observed,plan.nextState);
 const receipt=await acknowledgeSheetsPlan(plan,observed);assert.equal(receipt.stateHash,plan.targetHash);
 const s=source();s.diary.pop();const changed=await authorize({...a,current:observed,baseline:receipt,range:{from:'2026-11-01',to:'2026-11-05'},fullExport:full(s)});
 const update=await prepareSheetsBatchUpdate(changed,observed);const after=simulateBatch(observed,update.body);assert.deepEqual(after,changed.nextState);assert.equal(after.tables['Posiłki'].rows.length,7);
});
test('history: recipe v1 remains v1 and macros stay saved after live recipe edit/delete',async()=>{
 const s=source();s.diary.push({id:'recipe-entry',date:'2026-11-01',createdAt:'2026-11-01T12:00:00Z',meal:'lunch',kind:'RECIPE',sourceType:'recipe',recipeId:'11111111-1111-4111-8111-111111111111',recipeVersion:1,recipeName:'Curry',recipeYieldSnapshot:{servings:5},amount:1.5,unit:'serving',nutrition:{kcal:500,protein:30,fat:10,carbs:70}});s.recipes=[{version:2,nutrition:{kcal:900}}];
 const plan=await prepareSheetsPlan(args(s));const entry=obj(plan.nextState,'Posiłki').find(r=>r.recordId==='recipe-entry');assert.equal(entry.recipeVersion,1);assert.equal(entry.kcal,500);assert.equal(entry.unit,'serving');assert.equal(entry.amount,1.5);
 delete s.recipes;assert.equal((await prepareSheetsPlan(args(s))).sourceHash,plan.sourceHash);
});
test('cardio/time execution retains original units and zero values, exercises without sets remain visible',async()=>{
 for(const mode of ['time','cardio']){
  const s=source(),w=s.training.completedWorkouts[0];w.items[0].exercise=EXERCISES.find(e=>e.mode===mode);w.items[0].sets=[{id:'t',kind:'work',duration:60,...(mode==='cardio'?{distance:0,speed:0,incline:0}:{})}];w.items.push({...structuredClone(w.items[0]),sets:[]});
  const plan=await prepareSheetsPlan(args(s)),rows=obj(plan.nextState,'Serie');assert.equal(rows.filter(r=>r.rowType==='exercise').length,2);assert.equal(rows.filter(r=>r.rowType==='set').length,1);const set=rows.find(r=>r.rowType==='set');assert.equal(set.durationSeconds,60);assert.equal(set.kg,null);assert.equal(set.distanceKm,mode==='cardio'?0:null);
 }
});
test('input mutation while hashing cannot alter an in-flight operation',async()=>{
 const a=args(source()),promise=prepareSheetsPlan(a);a.fullExport.foodEntries[0].nutrition.kcal=999;a.current.tables['Posiłki'].exists=true;
 const plan=await promise;assert.equal(obj(plan.nextState,'Posiłki')[0].kcal,100);assert.equal(plan.baseHash,await fingerprint(emptySheetsState('spreadsheet')));
});
test('oversized single batch fails closed instead of producing partial chunked writes',async()=>{
 const s=source();s.diary=Array.from({length:2500},(_,i)=>({...s.diary[0],id:'large-'+i,productName:'N'.repeat(240)}));
 const a=args(s),plan=await prepareSheetsPlan(a);await assert.rejects(prepareSheetsBatchUpdate(plan,a.current),/1,8 MB/);
});
test('malformed dose, provenance, nested metadata and timestamp cannot masquerade as full export',async()=>{
 for(const mutate of [x=>x.completedWorkouts[0].exercises[0].dosage.sets=null,x=>x.foodEntries[0].sourceType='recipe',x=>x.foodEntries[0].recipeVersion=1,x=>x.measurements[0].values.note='private',x=>x.foodEntries[0].createdAt='2026-02-30T08:00:00Z']){
  const data=full(source());mutate(data);await assert.rejects(prepareSheetsPlan({...args(source()),fullExport:data}));
 }
});
for(const amount of [0,1,1.5,99.9])for(const date of ['2026-11-01','2026-11-02','2026-11-05'])test(`generated totals and scope ${amount} @ ${date}`,async()=>{
 const s=source();s.diary=s.diary.map(r=>({...r,date,nutrition:{kcal:amount,protein:0,fat:0,carbs:0}}));const a=args(s),plan=await prepareSheetsPlan(a);
 const entries=obj(plan.nextState,'Posiłki');assert.equal(entries.length,date==='2026-11-05'?0:8);
 const day=obj(plan.nextState,'Dziennik żywieniowy').find(r=>r.date===date);if(day){assert.ok(Math.abs(day.kcal-amount*8)<1e-9);assert.equal(day.fat,0);}
});
