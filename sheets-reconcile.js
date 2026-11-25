// Dry-run only. All inputs/outputs are plain data; no network or storage writes.
import {SHEETS_SCHEMA_VERSION,SHEETS_TITLE,SHEET_NAMES,SHEET_COLUMNS,NUTRIENTS,mapSheetExport,validateRange,within,keyFor,makeRow,rowObject,dailyRows,goalFields,canonical,fingerprint,same,identity,fail} from './sheets-mapper.js';
import {validDate} from './goals.js';
const clone=value=>structuredClone(value);
const sorted=rows=>rows.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
const STATUS='Synchronizacja', DAYS='Dziennik żywieniowy';
export function emptySheetsState(spreadsheetId){
 identity(spreadsheetId);return {spreadsheetId,title:SHEETS_TITLE,schemaVersion:SHEETS_SCHEMA_VERSION,tables:Object.fromEntries(SHEET_NAMES.map((name,i)=>[name,{sheetId:9100+i,exists:false,columns:[...SHEET_COLUMNS[name]],rows:[]}]))};
}
export function validateSheetsState(state){
 if(!state||Object.getPrototypeOf(state)!==Object.prototype||!same(Object.keys(state).sort(),['spreadsheetId','title','schemaVersion','tables'].sort())||state.title!==SHEETS_TITLE||state.schemaVersion!==SHEETS_SCHEMA_VERSION)fail('niezgodny arkusz lub wersja schematu.');identity(state.spreadsheetId);
 if(!same(Object.keys(state.tables??{}).sort(),[...SHEET_NAMES].sort()))fail('brak lub nieznana zakładka zarządzana.');
 const ids=new Set();
 for(const name of SHEET_NAMES){const tab=state.tables[name];if(!tab||!same(Object.keys(tab).sort(),['sheetId','exists','columns','rows'].sort())||!Number.isInteger(tab.sheetId)||tab.sheetId<0||ids.has(tab.sheetId)||typeof tab.exists!=='boolean'||!same(tab.columns,SHEET_COLUMNS[name])||!Array.isArray(tab.rows)||tab.rows.length>200000||!tab.exists&&tab.rows.length)fail('niekompletna zakładka/nagłówki.');ids.add(tab.sheetId);
  const keys=new Set();for(const row of tab.rows){if(!Array.isArray(row)||row.length!==tab.columns.length||row.some(v=>!(v===null||typeof v==='string'&&v.length<=5000||typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean')))fail('nieprawidłowy wiersz.');const r=rowObject(name,row);identity(r.profileId);if(typeof r.key!=='string'||typeof r.recordId!=='string'||!r.recordId||keys.has(r.key)||name!==STATUS&&!validDate(r.date))fail('niespójny lub powtórzony klucz.');keys.add(r.key);
   const kind=({[DAYS]:'day','Posiłki':'food','Treningi':'workout','Serie':r.rowType==='set'?'set':r.rowType==='exercise'?'workout-exercise':null,'Pomiary':'measurement','Cele':'goal',[STATUS]:'sync'})[name]??(r.rowType==='session'?'mobility-session':r.rowType==='exercise'?'mobility-exercise':null);
   if(!kind||r.key!==keyFor(r.profileId,kind,r.recordId))fail('klucz nie odpowiada profilowi.');
   if(name===STATUS&&(r.recordId!==r.profileId||r.sheetSchemaVersion!==SHEETS_SCHEMA_VERSION||r.exportSchemaVersion!==1||typeof r.writerDeviceId!=='string'))fail('nieprawidłowy status/powiązanie.');
  }
 }
 // No half-session state is accepted as an authoritative remote read.
 for(const row of state.tables.Treningi.rows){const p=rowObject('Treningi',row),sets=state.tables.Serie.rows.map(r=>rowObject('Serie',r)).filter(r=>r.profileId===p.profileId&&r.sessionId===p.recordId);if(p.setCount!==sets.filter(r=>r.rowType==='set').length||p.exerciseCount!==sets.filter(r=>r.rowType==='exercise').length||sets.some(s=>s.date!==p.date))fail('niekompletny snapshot treningu.');}
 for(const row of state.tables.Serie.rows){const s=rowObject('Serie',row);if(!state.tables.Treningi.rows.some(r=>r[1]===s.profileId&&r[2]===s.sessionId))fail('osierocona seria.');}
 const mobility=state.tables.Mobility.rows.map(r=>rowObject('Mobility',r));
 for(const p of mobility.filter(r=>r.rowType==='session')){const items=mobility.filter(r=>r.profileId===p.profileId&&r.rowType==='exercise'&&r.sessionId===p.sessionId);if(p.sessionExerciseCount!==items.length||items.some(r=>r.date!==p.date))fail('niekompletna sesja Mobility.');}
 for(const e of mobility.filter(r=>r.rowType==='exercise'))if(!mobility.some(r=>r.rowType==='session'&&r.profileId===e.profileId&&r.sessionId===e.sessionId))fail('osierocone ćwiczenie Mobility.');
 return state;
}
function primaryInventory(mapped){
 const result=[];for(const table of ['Posiłki','Treningi','Mobility','Pomiary','Cele'])for(const row of mapped.rows[table]){const r=rowObject(table,row);if(table!=='Mobility'||r.rowType==='session')result.push({key:r.key,date:r.date,table});}return result.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
}
function diff(current,next,profile){
 return Object.fromEntries(SHEET_NAMES.filter(n=>n!==STATUS).map(name=>{const old=new Map(current.tables[name].rows.filter(r=>r[1]===profile).map(r=>[r[0],r])),now=new Map(next.tables[name].rows.filter(r=>r[1]===profile).map(r=>[r[0],r]));return [name,{added:[...now.keys()].filter(k=>!old.has(k)),updated:[...now.keys()].filter(k=>old.has(k)&&!same(now.get(k),old.get(k))),deleted:[...old.keys()].filter(k=>!now.has(k))}];}));
}
export async function prepareSheetsPlan({fullExport,current,baseline=null,profileId,deviceId,range,initialize=false,confirmDeletionDigest=null,confirmImpactDigest=null}){
 identity(profileId);identity(deviceId);range=validateRange(range);current=clone(current);fullExport=clone(fullExport);baseline=clone(baseline);validateSheetsState(current);
 const mapped=mapSheetExport(fullExport,{profileId}),inventory=primaryInventory(mapped),baseHash=await fingerprint(current);
 const blockers=[];
 const ownStatus=current.tables[STATUS].rows.find(r=>r[1]===profileId);
 const ownCount=SHEET_NAMES.reduce((n,name)=>n+current.tables[name].rows.filter(r=>r[1]===profileId).length,0);
 if(ownStatus&&rowObject(STATUS,ownStatus).writerDeviceId!==deviceId)blockers.push('Arkusz jest przypisany do innego urządzenia.');
 if(!baseline){if(!initialize||ownCount)blockers.push('Brak potwierdzonego punktu odniesienia; dozwolona tylko jawna inicjalizacja pustego profilu.');}
 else if(baseline.schemaVersion!==1||baseline.spreadsheetId!==current.spreadsheetId||baseline.profileId!==profileId||baseline.deviceId!==deviceId||baseline.stateHash!==baseHash||!Array.isArray(baseline.inventory))blockers.push('Nieaktualny punkt odniesienia, inne urządzenie lub zmieniony arkusz.');
 const lookup=Object.fromEntries(SHEET_NAMES.map(name=>[name,new Map(mapped.rows[name].map(r=>[r[0],r]))]));
 const next=clone(current),affectedSessions=new Set(),affectedMobility=new Set(),movedFoodDates=new Set();
 for(const name of ['Treningi','Mobility']){
  const set=name==='Treningi'?affectedSessions:affectedMobility;
  for(const row of [...current.tables[name].rows,...mapped.rows[name]]){const r=rowObject(name,row);if(r.profileId===profileId&&within(r.date,range)&&(name==='Treningi'||r.rowType==='session'))set.add(r.recordId);}
 }
 for(const name of ['Posiłki','Treningi','Serie','Mobility','Pomiary','Cele']){
  const old=current.tables[name].rows,ownOld=new Map(old.filter(r=>r[1]===profileId).map(r=>[r[0],r]));
  function eligible(row){const r=rowObject(name,row);return name==='Cele'||name==='Serie'?name==='Cele'||affectedSessions.has(r.sessionId):name==='Mobility'?affectedMobility.has(r.sessionId):name==='Treningi'?affectedSessions.has(r.recordId):within(r.date,range)||within(ownOld.get(r.key)?.[3]??null,range);}
  const rows=new Map(old.map(row=>[row[0],row]));
  for(const row of old)if(row[1]===profileId&&eligible(row))rows.delete(row[0]);
  for(const row of mapped.rows[name])if(eligible(row)){
   if(name==='Posiłki'&&ownOld.has(row[0])&&ownOld.get(row[0])[3]!==row[3]){movedFoodDates.add(row[3]);movedFoodDates.add(ownOld.get(row[0])[3]);}
   rows.set(row[0],row);
  }
  next.tables[name].rows=sorted([...rows.values()]);
 }
 // Derive affected daily totals from the reconciled meal rows, not unrelated fresh local data.
 const daySource={nutritionGoals:fullExport.nutritionGoals,foodEntries:next.tables['Posiłki'].rows.filter(r=>r[1]===profileId).map(row=>{const r=rowObject('Posiłki',row);return {...r,nutrition:Object.fromEntries(NUTRIENTS.map(k=>[k,r[k]]))};})};
 const days=new Map(current.tables[DAYS].rows.map(r=>[r[0],r]));
 const addDays=(from,to)=>{for(const d of dailyRows(daySource,from,to))days.set(keyFor(profileId,'day',d.id),makeRow(DAYS,{key:keyFor(profileId,'day',d.id),profileId,recordId:d.id,date:d.date,hasEntries:d.hasEntries,entryCount:d.entryCount,mealCount:d.mealCount,...d.nutrition,...goalFields(fullExport.nutritionGoals,d.date)}));};
 addDays(range.from,range.to);for(const date of movedFoodDates)if(!within(date,range))addDays(date,date);
 for(const [key,row]of days)if(row[1]===profileId&&!within(row[3],range)&&!movedFoodDates.has(row[3]))days.set(key,makeRow(DAYS,{...rowObject(DAYS,row),...goalFields(fullExport.nutritionGoals,row[3])}));
 next.tables[DAYS].rows=sorted([...days.values()]);
 const changes=diff(current,next,profileId),deleteKeys=Object.values(changes).flatMap(c=>c.deleted).sort();
 const outsideChanges=[];
 for(const name of Object.keys(changes))if(name!=='Cele')for(const key of [...changes[name].added,...changes[name].updated,...changes[name].deleted]){
  const old=current.tables[name].rows.find(r=>r[0]===key),row=next.tables[name].rows.find(r=>r[0]===key);
  if(old&&!within(old[3],range)||row&&!within(row[3],range))outsideChanges.push({table:name,key,oldDate:old?.[3]??null,newDate:row?.[3]??null});
 }
 const sourceHash=await fingerprint({profileId,rows:mapped.rows});
 const deletionDigest=deleteKeys.length?await fingerprint({baseHash,sourceHash,range,deleteKeys}):null;
 const impactDigest=outsideChanges.length?await fingerprint({baseHash,sourceHash,range,outsideChanges}):null;
 const currentKeys=new Set(inventory.map(r=>r.key));
 if(baseline&&Array.isArray(baseline.inventory)){
  const lost=baseline.inventory.filter(r=>!currentKeys.has(r.key));
  if(lost.some(r=>r.table!=='Cele'&&!within(r.date,range)))blockers.push('Lokalna baza utraciła rekordy spoza zakresu. Poszerz zakres lub sprawdź kompletność bazy.');
  if(lost.length&&(!inventory.length||lost.length/baseline.inventory.length>0.25))blockers.push('Ubytek ponad 25% rekordów źródłowych: podejrzenie niepełnej lokalnej bazy. Odzyskanie wymaga osobnego procesu.');
 }
 if(deletionDigest&&confirmDeletionDigest!==deletionDigest)blockers.push('Usunięcia wymagają potwierdzenia dokładnego podglądu.');
 if(impactDigest&&confirmImpactDigest!==impactDigest)blockers.push('Zmiany poza zakresem (przeniesienia dat / cele) wymagają potwierdzenia dokładnego podglądu.');
 const hasChanges=Object.values(changes).some(c=>c.added.length||c.updated.length||c.deleted.length)||SHEET_NAMES.some(n=>!current.tables[n].exists);
 const operationId=hasChanges?await fingerprint({schemaVersion:1,spreadsheetId:current.spreadsheetId,profileId,deviceId,baseHash,sourceHash,exportedAt:fullExport.exportedAt,range,target:next}):null;
 if(hasChanges){
  const counters={foodEntries:next.tables['Posiłki'].rows.filter(r=>r[1]===profileId).length,workouts:next.tables.Treningi.rows.filter(r=>r[1]===profileId).length,sets:next.tables.Serie.rows.filter(r=>r[1]===profileId&&rowObject('Serie',r).rowType==='set').length,mobilitySessions:next.tables.Mobility.rows.filter(r=>r[1]===profileId&&rowObject('Mobility',r).rowType==='session').length,measurements:next.tables.Pomiary.rows.filter(r=>r[1]===profileId).length,goals:fullExport.nutritionGoals.length};
  const status=makeRow(STATUS,{key:keyFor(profileId,'sync',profileId),profileId,recordId:profileId,date:null,writerDeviceId:deviceId,sheetSchemaVersion:SHEETS_SCHEMA_VERSION,exportSchemaVersion:1,operationId,status:'committed',exportedAt:fullExport.exportedAt,from:range.from,to:range.to,...counters});
  next.tables[STATUS].rows=sorted([...current.tables[STATUS].rows.filter(r=>r[1]!==profileId),status]);
  for(const tab of Object.values(next.tables))tab.exists=true;
 }
 validateSheetsState(next);
 const plan={schemaVersion:1,spreadsheetId:current.spreadsheetId,profileId,deviceId,range,sourceHash,baseHash,operationId,inventory,changes,outsideChanges,deletionDigest,impactDigest,blockers,noop:!hasChanges,nextState:next,targetHash:await fingerprint(next)};
 plan.integrity=await fingerprint(plan);return plan;
}
async function validatePlan(plan){const {integrity,...rest}=plan;if(integrity!==await fingerprint(rest))fail('plan zmieniony po podglądzie.');validateSheetsState(plan.nextState);if(plan.targetHash!==await fingerprint(plan.nextState))fail('zmieniony cel operacji.');}
export async function prepareSheetsBatchUpdate(plan,current){
 plan=clone(plan);current=clone(current);await validatePlan(plan);validateSheetsState(current);
 if(current.spreadsheetId!==plan.spreadsheetId)fail('inny arkusz.');
 const actual=await fingerprint(current);
 if(plan.operationId&&actual===plan.targetHash)return {alreadyApplied:true,body:null};
 if(actual!==plan.baseHash)fail('arkusz zmienił się po podglądzie.');
 if(plan.blockers.length)fail(plan.blockers.join(' '));
 if(plan.noop)return {alreadyApplied:false,body:null};
 const requests=[];
 for(const name of SHEET_NAMES){const old=current.tables[name],tab=plan.nextState.tables[name],height=Math.max(old.rows.length,tab.rows.length)+1,width=tab.columns.length;
  if(!old.exists)requests.push({addSheet:{properties:{sheetId:tab.sheetId,title:name,gridProperties:{rowCount:height,columnCount:width}}}});
  else requests.push({updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{rowCount:height,columnCount:width}},fields:'gridProperties.rowCount,gridProperties.columnCount'}});
  const cell=value=>value===null?{}:{userEnteredValue:{[typeof value==='number'?'numberValue':typeof value==='boolean'?'boolValue':'stringValue']:value}};
  requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:0,endRowIndex:height,startColumnIndex:0,endColumnIndex:width},rows:[tab.columns,...tab.rows].map(row=>({values:row.map(cell)})),fields:'userEnteredValue'}});
 }
 const body={requests,includeSpreadsheetInResponse:false};
 if(new TextEncoder().encode(JSON.stringify(body)).length>1800000)fail('operacja przekracza bezpieczny budżet 1,8 MB; nie wolno dzielić jej na niezależne zapisy.');
 return {alreadyApplied:false,operationId:plan.operationId,expectedBaseHash:plan.baseHash,expectedTargetHash:plan.targetHash,body};
}
export async function acknowledgeSheetsPlan(plan,observedState){
 plan=clone(plan);observedState=clone(observedState);await validatePlan(plan);if(plan.blockers.length)fail('nie można zatwierdzić zablokowanego planu.');validateSheetsState(observedState);
 if(await fingerprint(observedState)!==plan.targetHash)fail('brak potwierdzenia pełnego wyniku operacji.');
 return {schemaVersion:1,spreadsheetId:plan.spreadsheetId,profileId:plan.profileId,deviceId:plan.deviceId,stateHash:plan.targetHash,inventory:clone(plan.inventory)};
}
