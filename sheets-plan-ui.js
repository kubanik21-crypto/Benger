import {emptySheetsState,prepareSheetsPlan,prepareSheetsBatchUpdate,acknowledgeSheetsPlan} from './sheets-reconcile.js';
import {SHEET_NAMES,SHEET_COLUMNS} from './sheets-mapper.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
/** In-memory simulation only. No Google access and no persisted copy of source data. */
export function initSheetsPlanUi({container,readFull,beforeRead=async()=>{},getRange}){
 const root=el('details');root.id='sheets-plan-lab';
 root.append(el('summary','Google Sheets — lokalny podgląd planu'));
 root.append(el('p','Symulacja bez połączenia z Google. Porównanie istnieje tylko do zamknięcia lub przeładowania aplikacji. Nie potwierdza stanu rzeczywistego arkusza i niczego do niego nie wysyła.'));
 const prepare=el('button','Przygotuj lokalny plan');prepare.type='button';prepare.className='button-secondary';
 const accept=el('button','Przyjmij jako lokalny punkt porównania');accept.type='button';accept.className='button-secondary';accept.disabled=true;
 const output=el('div');output.id='sheets-plan-preview';
 const status=el('p');status.id='sheets-plan-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const delLabel=el('label'),del=el('input');del.type='checkbox';del.id='sheets-plan-confirm-delete';delLabel.append(del,document.createTextNode(' Potwierdzam wskazane usunięcia w tej symulacji.'));
 const impactLabel=el('label'),impact=el('input');impact.type='checkbox';impact.id='sheets-plan-confirm-impact';impactLabel.append(impact,document.createTextNode(' Potwierdzam wskazany wpływ poza zakresem dat.'));
 const schema=el('details');schema.append(el('summary','Zakładki i kolumny schematu 1'));for(const name of SHEET_NAMES)schema.append(el('h4',name),el('p',SHEET_COLUMNS[name].join(' · ')));
 root.append(prepare,delLabel,impactLabel,output,accept,status,schema);container.append(root);
 let current=emptySheetsState('local-simulation'),baseline=null,plan=null,busy=false,revision=0;
 function invalidate(){revision++;plan=null;accept.disabled=true;del.checked=false;impact.checked=false;output.replaceChildren();status.textContent='Dane lub zakres zmieniły się. Przygotuj plan ponownie.';}
 for(const event of ['benger:diary','benger:training','benger:progress','benger:goals','benger:native-resume','storage'])window.addEventListener(event,invalidate);
 for(const id of ['sync-export-from','sync-export-to'])document.getElementById(id)?.addEventListener('input',invalidate);
 function render(p,batch){
  output.replaceChildren(el('h4',p.noop?'Brak zmian':'Zmiany w lokalnej symulacji'));
  const list=el('ul');for(const [name,c]of Object.entries(p.changes))list.append(el('li',`${name}: +${c.added.length} nowych · ${c.updated.length} zmienionych · −${c.deleted.length} usuniętych`));output.append(list);
  const details=el('details');details.append(el('summary','Identyfikatory zmienianych rekordów'));
  const recordList=el('ul');for(const [name,c]of Object.entries(p.changes))for(const [kind,keys]of Object.entries(c))for(const key of keys){const old=current.tables[name].rows.find(r=>r[0]===key),next=p.nextState.tables[name].rows.find(r=>r[0]===key);const fields=SHEET_COLUMNS[name].flatMap((column,i)=>i<4||old?.[i]===next?.[i]?[]:[`${column}: ${old?.[i]??'brak'} → ${next?.[i]??'brak'}`]);recordList.append(el('li',`${name} · ${kind} · ${key} · ${fields.join(' · ')}`));}details.append(recordList);output.append(details);
  if(p.outsideChanges.length){output.append(el('p',`Wpływ poza zakresem: ${p.outsideChanges.length} wierszy. Dotyczy przeniesionych dat lub celów; nie przelicza zapisanych kalorii z bieżących przepisów.`));const dates=el('ul');for(const r of p.outsideChanges)dates.append(el('li',`${r.table}: ${r.oldDate??'—'} → ${r.newDate??'—'} · ${r.key}`));output.append(dates);}
  if(batch?.body){const request=el('details');request.append(el('summary','Szkic batchUpdate — bez wysyłania'));const pre=el('pre',JSON.stringify(batch.body,null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';request.append(pre);output.append(request);}
  for(const message of p.blockers)output.append(el('p',message));
  status.textContent=p.blockers.length?'Plan zablokowany. Żadne żądanie zapisu nie jest gotowe.':p.noop?'Lokalny stan jest zgodny. Brak żądania zapisu.':`Gotowy szkic jednego batchUpdate: ${batch.body.requests.length} poleceń. Operacja ${p.operationId}. Nic nie wysłano.`;
 }
 prepare.onclick=async()=>{
  if(busy)return;busy=true;prepare.disabled=true;accept.disabled=true;const generation=revision,prior=plan;plan=null;output.replaceChildren();status.textContent='Odczytuję pełny lokalny snapshot…';
  try{
   const range=getRange();await beforeRead();const fullExport=await readFull({});
   const candidate=await prepareSheetsPlan({fullExport,current,baseline,profileId:'local-profile',deviceId:'local-session',range,initialize:baseline===null,confirmDeletionDigest:del.checked?prior?.deletionDigest:null,confirmImpactDigest:impact.checked?prior?.impactDigest:null});
   if(generation!==revision){status.textContent='Dane zmieniły się podczas odczytu. Przygotuj plan ponownie.';return;}
   const batch=candidate.blockers.length?null:await prepareSheetsBatchUpdate(candidate,current);
   if(generation!==revision){status.textContent='Dane zmieniły się podczas przygotowania żądania. Przygotuj plan ponownie.';return;}
   plan=candidate;render(candidate,batch);accept.disabled=candidate.blockers.length>0;
  }catch(e){status.textContent=`Nie przygotowano planu: ${e instanceof Error?e.message:'błąd danych'}`;}
  finally{busy=false;prepare.disabled=false;}
 };
 accept.onclick=async()=>{
  if(busy||!plan||plan.blockers.length)return;busy=true;prepare.disabled=true;accept.disabled=true;const chosen=plan,generation=revision;
  try{
   const receipt=await acknowledgeSheetsPlan(chosen,chosen.nextState);
   if(generation!==revision){status.textContent='Dane zmieniły się. Nie przyjęto punktu porównania.';return;}
   current=structuredClone(chosen.nextState);baseline=receipt;plan=null;del.checked=false;impact.checked=false;
   status.textContent='Przyjęto punkt porównania wyłącznie w pamięci tej symulacji. Nie zapisano do Google ani nie zmieniono danych Bengera.';
  }catch(e){status.textContent=`Nie przyjęto punktu porównania: ${e.message}`;}
  finally{busy=false;prepare.disabled=false;}
 };
 return {root};
}
