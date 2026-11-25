// Pure local mapping. Never authenticates, opens storage or calls Google.
import {validDate, validateGoals} from './goals.js';
import {BODY, validateMeasurement} from './progress.js';
import {dosage, validateSet} from './training-model.js';
import {HOUSEHOLD_UNITS, PORTION_SOURCES} from './portion-model.js';
import {isUuid} from './recipe-model.js';
export const SHEETS_SCHEMA_VERSION=1;
export const SHEETS_TITLE='Benger – RAW DATA';
export const NUTRIENTS=Object.freeze(['kcal','protein','fat','carbs']);
const common=['key','profileId','recordId','date'];
export const SHEET_COLUMNS=Object.freeze({
 'Dziennik żywieniowy':[...common,'hasEntries','entryCount','mealCount',...NUTRIENTS,'goalId',...NUTRIENTS.map(k=>'goal_'+k)],
 'Posiłki':[...common,'createdAt','meal','sourceType','productId','productName','recipeId','recipeVersion','recipeName','variantId','amount','unit','enteredAmount','enteredUnit','portionSource','portionConfidence','estimated',...NUTRIENTS],
 'Treningi':[...common,'name','startedAt','completedAt','scheduledRuleId','scheduledDate','exerciseCount','setCount'],
 'Serie':[...common,'rowType','sessionId','exercisePosition','exerciseId','exerciseName','mode','dumbbells','side','setPosition','setId','kind','reps','kg','loadBasis','rir','durationSeconds','distanceKm','speedKmH','inclinePercent','plannedSets','repsMin','repsMax','plannedDurationSeconds','restSeconds'],
 'Mobility':[...common,'rowType','sessionId','name','startedAt','completedAt','exerciseId','exercisePosition','side','plannedSets','completedSets','repsMin','repsMax','durationSeconds','restSeconds','scheduledRuleId','scheduledDate','sessionExerciseCount'],
 'Pomiary':[...common,'type','time','utcOffsetMinutes','unit','kg',...Object.keys(BODY)],
 'Cele':[...common,'effectiveFrom','effectiveTo',...NUTRIENTS],
 'Synchronizacja':[...common,'writerDeviceId','sheetSchemaVersion','exportSchemaVersion','operationId','status','exportedAt','from','to','foodEntries','workouts','sets','mobilitySessions','measurements','goals'],
});
Object.values(SHEET_COLUMNS).forEach(Object.freeze);
export const SHEET_NAMES=Object.freeze(Object.keys(SHEET_COLUMNS));
export const fail=message=>{throw new TypeError('Plan Sheets: '+message);};
export const keyFor=(profile,kind,...ids)=>JSON.stringify([profile,kind,...ids]);
export const same=(a,b)=>canonical(a)===canonical(b);
export function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export async function fingerprint(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function identity(value){if(typeof value!=='string'||! /^[\w:-]{1,100}$/.test(value))fail('nieprawidłowy identyfikator profilu/urządzenia.');return value;}
function object(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(value,k)))fail('niekompletny lub nieobsługiwany obiekt snapshotu.');}
function text(value,max=240){if(typeof value!=='string'||!value.trim()||value.length>max)fail('nieprawidłowy tekst/ID.');}
function number(value,min=0,max=1e10){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail('nieprawidłowa liczba.');}
function list(value,max=100000){if(!Array.isArray(value)||value.length>max)fail('brak lub nadmiar rekordów.');}
function unique(rows,field='id'){if(new Set(rows.map(r=>r[field])).size!==rows.length)fail('zduplikowane ID.');}
function date(value){if(!validDate(value))fail('nieprawidłowa data.');}
function stamp(value){text(value,40);if(!/^\d{4}-\d\d-\d\dT/.test(value)||!Number.isFinite(Date.parse(value))||!validDate(value.slice(0,10)))fail('nieprawidłowy timestamp.');}
function nutrition(value,optional=false){object(value,NUTRIENTS);for(const k of NUTRIENTS)if(!optional||value[k]!==null)number(value[k]);}
export function goalOn(goals,date){return goals.filter(r=>r.effectiveFrom<=date).at(-1)??null;}
export function goalFields(goals,date){const g=goalOn(goals,date);return {goalId:g?.id??null,...Object.fromEntries(NUTRIENTS.map(k=>['goal_'+k,g?.nutrition[k]??null]))};}
export function dailyRows(full,from,to){
 const grouped=new Map();for(const row of full.foodEntries){if(!grouped.has(row.date))grouped.set(row.date,[]);grouped.get(row.date).push(row);}
 const dates=from&&to?Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10)):[...grouped.keys()].sort();
 return dates.map(date=>{const rows=grouped.get(date)??[];return {id:date,date,hasEntries:rows.length>0,entryCount:rows.length,mealCount:new Set(rows.map(r=>r.meal)).size,nutrition:Object.fromEntries(NUTRIENTS.map(k=>[k,rows.length?rows.reduce((n,r)=>n+r.nutrition[k],0):null])),goalId:goalOn(full.nutritionGoals,date)?.id??null,goalNutrition:goalOn(full.nutritionGoals,date)?.nutrition??Object.fromEntries(NUTRIENTS.map(k=>[k,null]))};});
}
export function validateFullSheetExport(full){
 object(full,['app','schemaVersion','exportedAt','mode','range','semantics','dailyNutrition','foodEntries','nutritionGoals','completedWorkouts','completedMobility','measurements']);
 if(full.app!=='Benger'||full.schemaVersion!==1||full.mode!=='snapshot')fail('nieobsługiwana wersja eksportu.');stamp(full.exportedAt);
 if(!same(full.range,{from:null,to:null,inclusive:true,dateBasis:'record-local-date'}))fail('wymagany pełny odczyt lokalny, nie eksport ograniczonego zakresu.');
 if(!same(full.semantics,{missingValue:null,nutritionBasis:'consumed-entry-snapshot',nutritionUnits:{kcal:'kcal',protein:'g',fat:'g',carbs:'g'},dailyCoverage:'days-with-food-entries',deletions:'absent-from-current-snapshot-not-tombstones'}))fail('niekompletny snapshot lub nieznana semantyka.');
 for(const name of ['dailyNutrition','foodEntries','nutritionGoals','completedWorkouts','completedMobility','measurements']){list(full[name]);unique(full[name]);}
 for(const r of full.foodEntries){
  object(r,['id','date','createdAt','meal','sourceType','productId','productName','recipeId','recipeVersion','recipeName','variantId','amount','unit','enteredAmount','enteredUnit','portionConversion','nutrition']);
  text(r.id);date(r.date);stamp(r.createdAt);nutrition(r.nutrition);number(r.amount,Number.MIN_VALUE,1e7);number(r.enteredAmount,Number.MIN_VALUE,1e7);
  if(!['breakfast','lunch','dinner','snack'].includes(r.meal)||!['g','ml','serving'].includes(r.unit)||!['g','ml','serving',...Object.keys(HOUSEHOLD_UNITS)].includes(r.enteredUnit))fail('nieprawidłowy posiłek/jednostka.');
  if(r.sourceType==='product'){text(r.productId);text(r.productName);if(r.unit==='serving'||r.recipeId!==null||r.recipeName!==null||r.recipeVersion!==null||r.variantId!==null)fail('produkt podszywa się pod przepis.');}
  else if(r.sourceType==='recipe'){if(!isUuid(r.recipeId)||!Number.isSafeInteger(r.recipeVersion)||r.recipeVersion<1||r.productId!==null||r.productName!==null||r.portionConversion!==null||r.variantId!==null&&!isUuid(r.variantId))fail('nieprawidłowa proweniencja przepisu.');text(r.recipeName,200);}
  else fail('nieznany typ żywności.');
  if(r.portionConversion!==null){const c=r.portionConversion;object(c,['source','confidence','estimated','normalizedAmount','normalizedUnit']);if(!PORTION_SOURCES.includes(c.source)||c.source==='NONE'||!['HIGH','MEDIUM'].includes(c.confidence)||![null,true,false].includes(c.estimated)||c.normalizedAmount!==r.amount||c.normalizedUnit!==r.unit||!Object.hasOwn(HOUSEHOLD_UNITS,r.enteredUnit))fail('niespójna konwersja porcji.');}
  else if(r.enteredAmount!==r.amount||r.enteredUnit!==r.unit)fail('brak konwersji porcji.');
 }
 const goals=full.nutritionGoals;
 for(const r of goals){object(r,['id','effectiveFrom','effectiveTo','nutrition']);date(r.effectiveFrom);if(r.effectiveTo!==null)date(r.effectiveTo);nutrition(r.nutrition,true);}
 const validated=validateGoals(goals.map(r=>({id:r.id,effectiveFrom:r.effectiveFrom,nutrition:Object.fromEntries(NUTRIENTS.filter(k=>r.nutrition[k]!==null).map(k=>[k,r.nutrition[k]]))})));
 if(!same(goals.map(r=>r.id),validated.map(r=>r.id)))fail('nieuporządkowana historia celów.');
 goals.forEach((r,i)=>{const end=goals[i+1]?new Date(Date.parse(goals[i+1].effectiveFrom)-86400000).toISOString().slice(0,10):null;if(r.effectiveTo!==end)fail('niekompletna historia celów.');});
 for(const [name,kind]of [['completedWorkouts','workout'],['completedMobility','mobility']])for(const r of full[name]){
  object(r,['id','kind','status','name','date','startedAt','completedAt','scheduled','exercises']);text(r.id,100);text(r.name,160);date(r.date);stamp(r.startedAt);stamp(r.completedAt);
  if(r.kind!==kind||r.status!=='completed'||Date.parse(r.completedAt)<Date.parse(r.startedAt))fail('nieukończona/niespójna sesja.');
  if(r.scheduled!==null){object(r.scheduled,['ruleId','date']);text(r.scheduled.ruleId);if(r.scheduled.date!==r.date)fail('niespójny kalendarz.');}
  list(r.exercises,100);if(!r.exercises.length)fail('pusta sesja.');
  r.exercises.forEach((e,i)=>{
   object(e,['key','position','exerciseId','name','mode','dumbbells','dosage','completedSets','sets']);text(e.exerciseId,100);text(e.name,160);
   if(e.position!==i||e.key!==JSON.stringify([kind,r.id,i])||!['strength','bodyweight','time','cardio','mobility'].includes(e.mode)||(kind==='mobility')!==(e.mode==='mobility')||!(e.mode==='strength'?[1,2].includes(e.dumbbells):e.dumbbells===0))fail('niespójne ćwiczenie.');
   object(e.dosage,['sets','repsMin','repsMax','durationSeconds','restSeconds','side']);const d=dosage({...e.dosage,duration:e.dosage.durationSeconds,rest:e.dosage.restSeconds});if(d.sets!==e.dosage.sets||d.rest!==e.dosage.restSeconds||d.side!==e.dosage.side)fail('niekompletne dawkowanie.');
   if(kind==='mobility'){number(e.completedSets,0,100);if(!Number.isInteger(e.completedSets))fail('nieprawidłowe wykonania Mobility.');}else if(e.completedSets!==null)fail('nieznany licznik serii.');
   list(e.sets,200);unique(e.sets);if(kind==='mobility'&&e.sets.length)fail('Mobility bez wymyślonych serii.');
   e.sets.forEach((s,j)=>{
    object(s,['key','id','position','kind','reps','kg','rir','loadBasis','durationSeconds','distanceKm','speedKmH','inclinePercent']);
    if(s.position!==j||s.key!==JSON.stringify([kind,r.id,i,s.id]))fail('niespójny klucz serii.');
    const raw={id:s.id,kind:s.kind};for(const [to,from]of [['reps','reps'],['kg','kg'],['rir','rir'],['duration','durationSeconds'],['distance','distanceKm'],['speed','speedKmH'],['incline','inclinePercent']])if(s[from]!==null)raw[to]=s[from];
    const normalized=validateSet(raw,{mode:e.mode});
    for(const [to,from]of [['reps','reps'],['kg','kg'],['rir','rir'],['duration','durationSeconds'],['distance','distanceKm'],['speed','speedKmH'],['incline','inclinePercent']])if((normalized[to]??null)!==s[from])fail('nieprawidłowa miara serii.');
    if(s.loadBasis!==(e.mode==='strength'?'per-dumbbell':e.mode==='bodyweight'?'additional-load':null))fail('niespójna podstawa obciążenia.');
   });
  });
 }
 for(const r of full.measurements){
  object(r,['id','type','date','time','utcOffsetMinutes','unit','values']);if(!['weight','body'].includes(r.type)||r.utcOffsetMinutes!==null||r.unit!==(r.type==='weight'?'kg':'cm'))fail('niedozwolony pomiar.');
  object(r.values,r.type==='weight'?['kg']:Object.keys(BODY));validateMeasurement({...r,note:'',values:Object.fromEntries(Object.entries(r.values).filter(([,v])=>v!==null))});
 }
 const expected=dailyRows(full,null,null);
 if(full.dailyNutrition.length!==expected.length)fail('niekompletne podsumowania dzienne.');
 for(let i=0;i<expected.length;i++)if(!same(full.dailyNutrition[i],expected[i]))fail('sumy dzienne lub cele nie odpowiadają wpisom.');
 return full;
}
export function validateRange(range){if(!range||!validDate(range.from)||!validDate(range.to)||range.from>range.to||(Date.parse(range.to)-Date.parse(range.from))/86400000>36600)fail('nieprawidłowy zakres.');return {from:range.from,to:range.to};}
export const within=(date,range)=>date!==null&&date>=range.from&&date<=range.to;
export function makeRow(table,values){return SHEET_COLUMNS[table].map(k=>values[k]??null);}
export function rowObject(table,row){return Object.fromEntries(SHEET_COLUMNS[table].map((k,i)=>[k,row[i]]));}
export function mapSheetExport(full,{profileId}={}){
 identity(profileId);validateFullSheetExport(full);
 const rows=Object.fromEntries(SHEET_NAMES.map(n=>[n,[]]));
 const add=(table,kind,id,date,fields={})=>rows[table].push(makeRow(table,{key:keyFor(profileId,kind,id),profileId,recordId:id,date,...fields}));
 for(const r of full.dailyNutrition)add('Dziennik żywieniowy','day',r.id,r.date,{hasEntries:r.hasEntries,entryCount:r.entryCount,mealCount:r.mealCount,...r.nutrition,...goalFields(full.nutritionGoals,r.date)});
 for(const r of full.foodEntries)add('Posiłki','food',r.id,r.date,{...Object.fromEntries(['createdAt','meal','sourceType','productId','productName','recipeId','recipeVersion','recipeName','variantId','amount','unit','enteredAmount','enteredUnit'].map(k=>[k,r[k]])),portionSource:r.portionConversion?.source,portionConfidence:r.portionConversion?.confidence,estimated:r.portionConversion?.estimated,...r.nutrition});
 for(const r of full.completedWorkouts){
  add('Treningi','workout',r.id,r.date,{name:r.name,startedAt:r.startedAt,completedAt:r.completedAt,scheduledRuleId:r.scheduled?.ruleId,scheduledDate:r.scheduled?.date,exerciseCount:r.exercises.length,setCount:r.exercises.reduce((n,e)=>n+e.sets.length,0)});
  for(const e of r.exercises){
   add('Serie','workout-exercise',e.key,r.date,{rowType:'exercise',sessionId:r.id,exercisePosition:e.position,exerciseId:e.exerciseId,exerciseName:e.name,mode:e.mode,dumbbells:e.dumbbells,side:e.dosage.side,plannedSets:e.dosage.sets,repsMin:e.dosage.repsMin,repsMax:e.dosage.repsMax,plannedDurationSeconds:e.dosage.durationSeconds,restSeconds:e.dosage.restSeconds});
   for(const s of e.sets)add('Serie','set',s.key,r.date,{rowType:'set',sessionId:r.id,exercisePosition:e.position,exerciseId:e.exerciseId,exerciseName:e.name,mode:e.mode,dumbbells:e.dumbbells,side:e.dosage.side,setPosition:s.position,setId:s.id,...Object.fromEntries(['kind','reps','kg','loadBasis','rir','durationSeconds','distanceKm','speedKmH','inclinePercent'].map(k=>[k,s[k]])),plannedSets:e.dosage.sets,repsMin:e.dosage.repsMin,repsMax:e.dosage.repsMax,plannedDurationSeconds:e.dosage.durationSeconds,restSeconds:e.dosage.restSeconds});
  }
 }
 for(const r of full.completedMobility){
  add('Mobility','mobility-session',r.id,r.date,{rowType:'session',sessionId:r.id,name:r.name,startedAt:r.startedAt,completedAt:r.completedAt,scheduledRuleId:r.scheduled?.ruleId,scheduledDate:r.scheduled?.date,sessionExerciseCount:r.exercises.length});
  for(const e of r.exercises)add('Mobility','mobility-exercise',e.key,r.date,{rowType:'exercise',sessionId:r.id,name:e.name,exerciseId:e.exerciseId,exercisePosition:e.position,side:e.dosage.side,plannedSets:e.dosage.sets,completedSets:e.completedSets,repsMin:e.dosage.repsMin,repsMax:e.dosage.repsMax,durationSeconds:e.dosage.durationSeconds,restSeconds:e.dosage.restSeconds});
 }
 for(const r of full.measurements)add('Pomiary','measurement',r.id,r.date,{type:r.type,time:r.time,utcOffsetMinutes:null,unit:r.unit,kg:r.values.kg,...Object.fromEntries(Object.keys(BODY).map(k=>[k,r.values[k]]))});
 for(const r of full.nutritionGoals)add('Cele','goal',r.id,r.effectiveFrom,{effectiveFrom:r.effectiveFrom,effectiveTo:r.effectiveTo,...r.nutrition});
 for(const list of Object.values(rows))list.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 return {schemaVersion:SHEETS_SCHEMA_VERSION,profileId,exportedAt:full.exportedAt,rows};
}
