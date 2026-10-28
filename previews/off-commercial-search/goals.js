import {BODY} from './progress.js?v=a5088bfa87afa7fbb70214b05617addb7e242943';
import {createProductStorage} from './product-cache.js?v=a5088bfa87afa7fbb70214b05617addb7e242943';
export const GOALS_KEY='goal-periods-v1';
export const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateGoals(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw new Error('Nieprawidłowa historia celów (limit 1000 okresów).');
 const out=rows.map(r=>{
  if(!r||typeof r.id!=='string'||! /^[\w-]{1,100}$/.test(r.id)||!validDate(r.effectiveFrom))throw new Error('Sprawdź datę obowiązywania celu.');
  for(const key of ['nutrition','weight','body'])if(r[key]!==undefined&&(!r[key]||typeof r[key]!=='object'||Array.isArray(r[key])))throw new Error('Nieprawidłowy format celu.');
  const nutrition={},body={};
  for(const [k,max]of [['kcal',20000],['protein',1000],['fat',1000],['carbs',3000]])if(r.nutrition?.[k]!==undefined){if(!bounded(r.nutrition[k],0.01,max))throw new Error('Cele żywieniowe muszą być dodatnimi liczbami w dopuszczalnym zakresie.');nutrition[k]=r.nutrition[k];}
  for(const k of Object.keys(r.body??{})){if(!Object.hasOwn(BODY,k)||!bounded(r.body[k],1,350))throw new Error('Cel obwodu musi wynosić 1–350 cm.');body[k]=r.body[k];}
  const weight={};if(r.weight?.kg!==undefined){if(!bounded(r.weight.kg,1,600))throw new Error('Cel masy musi wynosić 1–600 kg.');weight.kg=r.weight.kg;}
  if(r.weight?.targetDate){if(!weight.kg||!validDate(r.weight.targetDate)||r.weight.targetDate<r.effectiveFrom)throw new Error('Sprawdź datę docelową masy.');weight.targetDate=r.weight.targetDate;}
  return {id:r.id,effectiveFrom:r.effectiveFrom,nutrition,weight,body};
 });
 if(new Set(out.map(r=>r.id)).size!==out.length||new Set(out.map(r=>r.effectiveFrom)).size!==out.length)throw new Error('Dla jednej daty może istnieć tylko jeden okres celów.');
 return out.sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
}
export function goalsOn(rows,date){return rows.filter(r=>r.effectiveFrom<=date).at(-1)??null;}
export function createGoalsStore(){
 const storage=createProductStorage();
 async function transaction(mode,change){const db=await storage.ready();if(!db)throw new Error('Pamięć celów jest niedostępna. Sprawdź ustawienia przeglądarki.');return new Promise((resolve,reject)=>{const tx=db.transaction('meta',mode),store=tx.objectStore('meta'),q=store.get(GOALS_KEY);let result;q.onsuccess=()=>{try{const previous=validateGoals(q.result?.periods??[]);result=change(previous);if(mode==='readwrite')store.put({key:GOALS_KEY,periods:result});}catch(error){tx.abort();reject(error);}};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error);});}
 return {read:()=>transaction('readonly',rows=>rows),async add(row,{replaceToday=false}={}){row=validateGoals([row])[0];return transaction('readwrite',rows=>{const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;const previous=replaceToday&&row.effectiveFrom===today?rows.filter(r=>r.effectiveFrom!==today):rows;return validateGoals([...previous,row]);});},close:()=>storage.close()};
}
