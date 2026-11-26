import {initSheetsPlanUi} from './sheets-plan-ui.js';
import {readLocalSyncExport} from './sync-export.js';
import {NUTRITION_STORAGE_KEY} from './app-storage.js';
import {createGoalsStore} from './goals.js';
import {createTrainingRepository} from './training-repository.js';
import {createProgressStore} from './progress.js';
import {isAndroidNative, saveNativeBackup} from './native-platform.js';

export const LAST_SYNC_EXPORT_KEY = `${NUTRITION_STORAGE_KEY}.sync-export.last.v1`;
const nutrients = ['kcal', 'protein', 'fat', 'carbs'];
const el = (tag, text) => {const node=document.createElement(tag); if(text!==undefined)node.textContent=text; return node;};
const format = new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2});
export function summarizeSyncExport(payload) {
  const sessions=[...payload.completedWorkouts,...payload.completedMobility];
  const items=sessions.flatMap(row=>row.exercises);
  return {
    counts:{days:payload.dailyNutrition.length,daysWithEntries:payload.dailyNutrition.filter(row=>row.hasEntries).length,
      foodEntries:payload.foodEntries.length,goals:payload.nutritionGoals.length,
      workouts:payload.completedWorkouts.length,mobility:payload.completedMobility.length,
      exercises:items.length,sets:items.reduce((n,row)=>n+row.sets.length,0),
      weight:payload.measurements.filter(row=>row.type==='weight').length,
      body:payload.measurements.filter(row=>row.type==='body').length},
    nutrition:Object.fromEntries(nutrients.map(key=>[key,payload.foodEntries.length?payload.foodEntries.reduce((sum,row)=>sum+row.nutrition[key],0):null])),
  };
}
async function readCurrent(options) {
  const goalsStore=createGoalsStore(),trainingRepository=createTrainingRepository(),progressStore=createProgressStore();
  try{return await readLocalSyncExport({local:localStorage,goalsStore,trainingRepository,progressStore},options);}
  finally{await Promise.allSettled([goalsStore.close(),trainingRepository.close(),progressStore.close()]);}
}
export async function saveSyncExportFile(payload) {
  const raw=JSON.stringify(payload,null,2);
  if(new TextEncoder().encode(raw).length>64*1024*1024)throw new Error('Eksport przekracza limit 64 MiB. Wybierz krótszy zakres.');
  const filename=`benger-sync-${payload.range.from}-${payload.range.to}.json`;
  if(isAndroidNative())return {...await saveNativeBackup(raw,filename),native:true};
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  const link=el('a');link.href=url;link.download=filename;document.body.append(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return {saved:true,native:false};
}
export function initSyncExportUi({container=document.getElementById('route-ustawienia'),beforeRead=async()=>{},read=readCurrent,save=saveSyncExportFile,local}={}) {
  if(local===undefined){try{local=globalThis.localStorage;}catch{local={getItem(){throw new Error('Pamięć lokalna jest niedostępna.');},setItem(){throw new Error('Pamięć lokalna jest niedostępna.');}};}}
  const panel=el('section');panel.id='sync-export';panel.className='panel';panel.setAttribute('aria-labelledby','sync-export-title');
  const heading=el('h2','Synchronizacja danych');heading.id='sync-export-title';
  panel.append(heading,el('p','Na razie: eksport lokalny do pliku JSON. Bez połączenia z Google Sheets, ChatGPT ani Garminem.'),
    el('p','Plik zawiera żywienie, cele, ukończone treningi, Mobility, masę i obwody. Bez zdjęć, ciśnienia, tętna i prywatnych notatek. Nazwy pozostają w pliku. Przechowuj go bezpiecznie. To nie jest pełny backup.'));
  const form=el('form');form.noValidate=true;form.className='sync-export-form';
  const now=new Date(),end=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const start=new Date(Date.parse(end)-29*86400000).toISOString().slice(0,10);
  function dateField(id,label,value){const box=el('label',label);box.htmlFor=id;const input=el('input');input.id=id;input.type='date';input.required=true;input.value=value;box.append(input);form.append(box);return input;}
  const from=dateField('sync-export-from','Od dnia',start),to=dateField('sync-export-to','Do dnia',end);
  const preview=el('button','Pokaż podgląd');preview.type='submit';preview.className='button-secondary';
  const download=el('button','Eksportuj JSON');download.type='button';download.className='button-primary';
  form.append(preview,download);
  const result=el('div');result.id='sync-export-preview';result.hidden=true;
  const last=el('p');last.id='sync-export-last';
  const status=el('p');status.id='sync-export-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  panel.append(form,result,last,status);container.append(panel);
  let busy=false;
  function showLast(){try{const stamp=local.getItem(LAST_SYNC_EXPORT_KEY);last.textContent=stamp&&Number.isFinite(Date.parse(stamp))?`Ostatni eksport na tym urządzeniu: ${new Date(stamp).toLocaleString('pl-PL')}`:'Nie wykonano jeszcze eksportu na tym urządzeniu.';}catch{last.textContent='Nie można odczytać daty ostatniego eksportu.';}}
  showLast();
  function invalidate(){if(busy)return;result.replaceChildren();result.hidden=true;status.textContent='Dane lub zakres zmieniły się. Przygotuj aktualny podgląd; eksport zawsze odczytuje dane ponownie.';}
  from.addEventListener('input',invalidate);to.addEventListener('input',invalidate);
  for(const event of ['benger:diary','benger:training','benger:goals','benger:progress','benger:native-resume'])window.addEventListener(event,invalidate);
  window.addEventListener('storage',invalidate);
  function render(payload){
    const summary=summarizeSyncExport(payload),c=summary.counts;
    result.replaceChildren(el('h3',`Zakres: ${payload.range.from} – ${payload.range.to}`));
    const list=el('dl');list.className='sync-export-counts';
    for(const [label,value]of [['Podsumowania dni',c.days],['Dni z wpisami',c.daysWithEntries],['Wpisy żywieniowe',c.foodEntries],['Okresy celów żywieniowych',c.goals],['Ukończone treningi',c.workouts],['Wykonane Mobility',c.mobility],['Pozycje ćwiczeń',c.exercises],['Serie treningowe',c.sets],['Pomiary masy',c.weight],['Pomiary obwodów',c.body]])list.append(el('dt',label),el('dd',String(value)));
    result.append(list,el('h3','Suma zapisanych wpisów'));
    const n=summary.nutrition;
    result.append(el('p',n.kcal===null?'Brak danych żywieniowych w tym zakresie.':`${format.format(n.kcal)} kcal · B ${format.format(n.protein)} g · T ${format.format(n.fat)} g · W ${format.format(n.carbs)} g`),el('p',`Wykonane treningi: ${c.workouts} · Mobility: ${c.mobility}`),el('p','Dni bez wpisów nie oznaczają 0 kcal. Suma dotyczy tylko zapisanej żywności. Serie Mobility są zapisane jako liczba wykonań przy ćwiczeniu, nie jako indywidualne serie treningowe.'));
    if(!c.foodEntries&&!c.workouts&&!c.mobility&&!c.weight&&!c.body)result.append(el('p',`Brak wpisów, wykonań i pomiarów w tym zakresie.${c.goals?' Eksport zawiera historię obowiązujących celów.':''} Możesz zapisać pusty zakres.`));
    result.hidden=false;
  }
  async function run(exportFile){
    if(busy)return;busy=true;for(const control of [from,to,preview,download])control.disabled=true;
    result.hidden=true;status.textContent='Przygotowuję dane…';
    try{
      if(!from.value||!to.value)throw new Error('Wybierz datę początkową i końcową.');
      const options={from:from.value,to:to.value};
      await beforeRead();const payload=await read(options);render(payload);
      if(!exportFile){status.textContent='Podgląd gotowy. Eksport ponownie odczyta aktualne dane.';return;}
      const saved=await save(payload);
      if(!saved?.saved){status.textContent='Anulowano zapisywanie. Data ostatniego eksportu nie zmieniła się.';return;}
      status.textContent=saved.native?'Plik JSON zapisany.':'Plik JSON przekazany do pobrania. Sprawdź folder Pobrane; przeglądarka nie potwierdza zapisu pliku.';
      try{local.setItem(LAST_SYNC_EXPORT_KEY,new Date().toISOString());showLast();}catch{status.textContent+=' Nie udało się zapamiętać daty eksportu. Sam plik został przekazany do zapisu.';}
    }catch(error){result.hidden=true;status.textContent=`Nie udało się przygotować lub zapisać eksportu. ${error instanceof Error?error.message:'Spróbuj ponownie.'}`;}
    finally{busy=false;for(const control of [from,to,preview,download])control.disabled=false;}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void run(false);});download.addEventListener('click',()=>void run(true));
  initSheetsPlanUi({container:panel,readFull:read,beforeRead,getRange:()=>({from:from.value,to:to.value})});
  if(isAndroidNative())void import('./google-auth-ui.js').then(({initGoogleAuthUi})=>initGoogleAuthUi({container:panel,sheets:{readFull:read,beforeRead,getRange:()=>({from:from.value,to:to.value})}})).catch(()=>{const hint=el('p','Autoryzacja Google jest niedostępna w tym buildzie. Eksport lokalny działa nadal.');panel.append(hint);});
  return {panel};
}
