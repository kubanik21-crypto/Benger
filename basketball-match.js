import {addDays,civilDate,weekStart,occurrences,emptySchedule} from './training-calendar.js';
import {goalsOn,validateGoals} from './goals.js';
import {validateRoutineSettings,defaultRoutineSettings} from './reminder-preferences.js';
import {validateMeasurement} from './progress.js';
import {validDiaryEntry} from './diary-entry.js';
import {createProductStorage} from './product-cache.js';
export const MATCH_KEY='basketball-match-v1';
export const MATCH_LIMIT=3650;
const fail=()=>{throw new TypeError('Nieprawidłowa historia meczu koszykarskiego.');};
const keys=(v,allowed)=>v&&Object.getPrototypeOf(v)===Object.prototype&&!Object.keys(v).some(k=>!allowed.includes(k));
export const emptyMatch=()=>({version:1,days:[]});
export function validateMatchState(value){
 if(!keys(value,['version','days'])||value.version!==1||!Array.isArray(value.days)||value.days.length>MATCH_LIMIT)fail();
 const days=value.days.map(r=>{
  if(!keys(r,['date','goalKcal','trainingIds','measurements'])||!civilDate(r.date)||r.goalKcal!==null&&(typeof r.goalKcal!=='number'||!Number.isFinite(r.goalKcal)||r.goalKcal<=0||r.goalKcal>20000)||!Array.isArray(r.trainingIds)||r.trainingIds.length>500||r.trainingIds.some(id=>typeof id!=='string'||!/^[\w:-]{1,100}$/.test(id))||new Set(r.trainingIds).size!==r.trainingIds.length||!Array.isArray(r.measurements)||r.measurements.some(k=>!['weight','pressure','body'].includes(k))||new Set(r.measurements).size!==r.measurements.length)fail();
  return {date:r.date,goalKcal:r.goalKcal,trainingIds:[...r.trainingIds],measurements:[...r.measurements]};
 });
 if(new Set(days.map(r=>r.date)).size!==days.length)fail();
 return {version:1,days:days.sort((a,b)=>a.date.localeCompare(b.date))};
}
/** Past obligations are frozen; today and future follow current settings. Never backfill unknown days. */
export function advanceMatchState(previous,{today,goals,training,routine=defaultRoutineSettings()}){
 if(!civilDate(today))fail();goals=validateGoals(goals);routine=validateRoutineSettings(routine);
 const next=new Map(validateMatchState(previous).days.map(r=>[r.date,r]));
 for(let i=0;i<8;i++){
  const date=addDays(today,i),weekday=new Date(date+'T12:00:00Z').getUTCDay()+1;
  next.set(date,{date,goalKcal:goalsOn(goals,date)?.nutrition.kcal??null,trainingIds:occurrences(training.schedule??emptySchedule(),date,date).map(r=>r.id),measurements:routine.items.filter(r=>r.enabled&&['weight','pressure','body'].includes(r.kind)&&r.weekdays.includes(weekday)).map(r=>r.kind)});
 }
 return validateMatchState({version:1,days:[...next.values()]});
}
export function mergeMatchStates(existing,incoming){const a=validateMatchState(existing),b=validateMatchState(incoming);return validateMatchState({version:1,days:[...new Map([...b.days,...a.days].map(r=>[r.date,r])).values()]});}
export function createMatchStore({storage=createProductStorage()}={}){
 return {async advance(input){await storage.ready();if(!storage.persistent())throw new Error('Nie można zapisać zasad meczu.');const row=await storage.mutate('meta',MATCH_KEY,old=>({key:MATCH_KEY,value:advanceMatchState(old?.value??emptyMatch(),input)}));if(!storage.persistent())throw new Error('Nie można zapisać zasad meczu.');return validateMatchState(row.value);},async read(){return validateMatchState((await storage.read('meta',MATCH_KEY))?.value??emptyMatch());},close:()=>storage.close()};
}
const contexts=new WeakSet();
export function prepareMatch(input){
 if(contexts.has(input))return input;
 let {state,entries,training,measurements=[]}=input;
 if(!Array.isArray(entries)||entries.length>20000||!entries.every(validDiaryEntry)||!Array.isArray(measurements)||measurements.length>20000)fail();
 const rules=new Map(validateMatchState(state).days.map(r=>[r.date,r]));measurements=measurements.map(validateMeasurement);
 const food=new Map();for(const e of entries){const row=food.get(e.date)??{count:0,kcal:0};row.count++;row.kcal+=e.nutrition.kcal;food.set(e.date,row);}
 const completed=new Set([...training.completedWorkouts,...training.completedMobility].filter(r=>r.scheduled).map(r=>r.scheduled.ruleId+'@'+r.scheduled.date));
 const measured=new Set(measurements.map(r=>r.type+'@'+r.date));
 const context={rules,food,completed,measured};contexts.add(context);return context;
}
export function buildMatchWeek(input,asOf,weekDate=asOf){
 if(!civilDate(asOf))fail();const {rules,food,completed,measured}=prepareMatch(input);
 const start=weekStart(weekDate);
 const days=Array.from({length:7},(_,i)=>{
  const date=addDays(start,i),r=rules.get(date);let us=0,them=0;const reasons=[];
  if(date>asOf||!r)return {date,us,them,status:date>asOf?'future':'unknown',reasons};
  const closed=date<asOf,eaten=food.get(date);let incomplete=false,pending=false;
  if(r.goalKcal!==null){
   if(!eaten){incomplete=true;reasons.push('Kalorie: nieuzupełnione');}
   else if(eaten.kcal>=r.goalKcal*.9-1e-8&&eaten.kcal<=r.goalKcal*1.1+1e-8){us+=2;reasons.push('Kalorie w zakresie +2');}
   else if(eaten.kcal>r.goalKcal*1.1+1e-8||closed){them+=2;reasons.push('Kalorie poza zakresem: rywale +2');}
   else {pending=true;reasons.push('Kalorie: dzień w toku');}
  }
  if(r.trainingIds.length){if(r.trainingIds.every(id=>completed.has(id+'@'+date))){us+=2;reasons.push('Zaplanowany trening wykonany +2');}else if(closed){them+=2;reasons.push('Zaplanowany trening niezapisany: rywale +2');}else{pending=true;reasons.push('Trening jeszcze do wykonania');}}
  for(const kind of r.measurements){if(measured.has(kind+'@'+date)){us++;reasons.push(({weight:'Waga',pressure:'Ciśnienie',body:'Obwody'})[kind]+' zapisane +1');}else if(closed){them++;reasons.push('Zaplanowany pomiar pominięty: rywale +1');}else{pending=true;reasons.push('Pomiar jeszcze do zapisania');}}
  const status=incomplete?'incomplete':us===0&&them===0?(pending||!reasons.length?'pending':'draw'):us>them?'win':us<them?'loss':'draw';
  return {date,us,them,status,reasons};
 });
 const us=days.reduce((s,r)=>s+r.us,0),them=days.reduce((s,r)=>s+r.them,0),lead=us-them;
 const level=lead>=10?4:lead>=6?3:lead>=3?2:lead>0?1:0;
 return {start,us,them,level,days,provisional:asOf<=addDays(start,6)};
}
export function validateMatchView(v){
 if(!keys(v,['start','us','them','level','days','provisional'])||!civilDate(v.start)||weekStart(v.start)!==v.start||!Number.isInteger(v.us)||v.us<0||v.us>49||!Number.isInteger(v.them)||v.them<0||v.them>49||!Number.isInteger(v.level)||v.level<0||v.level>4||typeof v.provisional!=='boolean'||!Array.isArray(v.days)||v.days.length!==7)fail();
 let us=0,them=0;const days=v.days.map((r,i)=>{if(!keys(r,['date','us','them','status','reasons'])||r.date!==addDays(v.start,i)||!Number.isInteger(r.us)||r.us<0||r.us>7||!Number.isInteger(r.them)||r.them<0||r.them>7||!['win','loss','draw','future','unknown','pending','incomplete'].includes(r.status)||!Array.isArray(r.reasons)||r.reasons.length>5||r.reasons.some(s=>typeof s!=='string'||s.length>100))fail();us+=r.us;them+=r.them;return {...r,reasons:[...r.reasons]};});if(us!==v.us||them!==v.them)fail();return {...v,days};
}
