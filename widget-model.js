import {buildMatchWeek,validateMatchView,prepareMatch} from './basketball-match.js';
import {sumNutrition} from './nutrition.js';
import {validDiaryEntry} from './diary-entry.js';
import {goalsOn,validateGoals} from './goals.js';
import {addDays,occurrences,plannedStatus,emptySchedule,civilDate} from './training-calendar.js';
export const WIDGET_DAYS=8;
export const widgetDate=(now=new Date())=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
export function widgetTrainingLabel(training,date){
 const rows=occurrences(training.schedule??emptySchedule(),date,date);
 if(!rows.length)return 'Brak zaplanowanego treningu';
 const labels=rows.slice(0,2).map(row=>{const s=plannedStatus(row,training);return `${s.completed.length?'✓ ':s.active?'W toku: ':row.time?row.time+' · ':''}${row.title}`;});
 return (labels.join(' / ')+(rows.length>2?` (+${rows.length-2})`:'')).slice(0,240);
}
export function validateWidgetSnapshot(value){
 const number=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e15;
 if(!value||value.version!==1||!number(value.generatedAt)||value.generatedAt===0||!Array.isArray(value.days)||value.days.length!==WIDGET_DAYS||Object.keys(value).some(k=>!['version','generatedAt','days'].includes(k)))throw new TypeError('Nieprawidłowe podsumowanie widżetu.');
 const days=value.days.map((r,i)=>{if(!r||!civilDate(r.date)||i&&r.date!==addDays(value.days[i-1].date,1)||!number(r.kcal)||r.goalKcal!==null&&(!number(r.goalKcal)||r.goalKcal===0)||typeof r.training!=='string'||!r.training.trim()||r.training.length>240||Object.keys(r).some(k=>!['date','kcal','goalKcal','training','match'].includes(k)))throw new TypeError('Nieprawidłowe dane dnia widżetu.');return {date:r.date,kcal:r.kcal,goalKcal:r.goalKcal,training:r.training,...(r.match===undefined?{}:{match:validateMatchView(r.match)})};});
 return {version:1,generatedAt:value.generatedAt,days};
}
export function buildWidgetSnapshot({entries,goals,training,now=new Date(),matchState,measurements=[]}={}){
 if(!Array.isArray(entries)||entries.length>20000||!entries.every(validDiaryEntry)||!Number.isFinite(now.getTime()))throw new TypeError('Nie można odczytać dziennika dla widżetu.');
 goals=validateGoals(goals);const start=widgetDate(now),byDate=new Map();for(const entry of entries){if(!byDate.has(entry.date))byDate.set(entry.date,[]);byDate.get(entry.date).push(entry.nutrition);}
 const matchContext=matchState===undefined?null:prepareMatch({state:matchState,entries,training,measurements});
 return validateWidgetSnapshot({version:1,generatedAt:now.getTime(),days:Array.from({length:WIDGET_DAYS},(_,i)=>{const date=addDays(start,i),goal=goalsOn(goals,date);let label=widgetTrainingLabel(training,date);const active=training.activeWorkout??training.activeMobility;if(i===0&&active)label=`W toku: ${active.name}`.slice(0,240);return {date,kcal:sumNutrition(byDate.get(date)??[]).kcal,goalKcal:goal?.nutrition.kcal??null,training:label,...(matchState===undefined?{}:{match:buildMatchWeek(matchContext,date)})};})});
}
