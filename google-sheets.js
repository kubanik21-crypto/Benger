import {isAndroidNative,getNativePlugin} from './native-platform.js';
import {SHEET_NAMES,SHEET_COLUMNS,SHEETS_TITLE,mapSheetExport,fingerprint,rowObject,fail,same} from './sheets-mapper.js';
import {validateSheetsState,prepareSheetsPlan,prepareSheetsBatchUpdate,acknowledgeSheetsPlan} from './sheets-reconcile.js';
const ERRORS={
 'authorization-required':'Połącz ponownie konto Google.',offline:'Brak internetu. Dane lokalne są bezpieczne.',
 'permission-denied':'Google odmówił dostępu. Sprawdź zgodę drive.file.',
 'file-not-private':'Arkusz nie jest prywatny. Usuń udostępnianie w Google Drive przed synchronizacją.',
 'wrong-owner':'Plik nie należy do tego konta i instalacji Bengera.',
 'schema-conflict':'Układ arkusza został zmieniony lub odczyt jest niekompletny. Niczego nie nadpisano.',
 'remote-changed':'Arkusz zmienił się po podglądzie. Przygotuj nowy plan.',
 'pending-operation':'Wynik poprzedniego zapisu jest niepotwierdzony. Sprawdź wynik; nie ponawiam zapisu w ciemno.',
 'creation-unconfirmed':'Utworzenie arkusza jest niepotwierdzone. Ponów sprawdzanie; nie tworzę kolejnego pliku.',
 'other-device':'Znaleziono arkusz innej instalacji. Nie przejmuję jej historii.',
 'local-storage':'Nie zapisano lokalnego potwierdzenia. Sprawdź wynik przed kolejną operacją.',
 quota:'Google ograniczył liczbę żądań. Spróbuj później.',busy:'Trwa inna operacja Google.',
 unavailable:'Ten build nie obsługuje synchronizacji Google Sheets.',
 'api-error':'Google nie potwierdził operacji. Sprawdź status przed ponowieniem.',
};
export function sheetsError(error){return new Error(ERRORS[error?.code]??'Nie udało się bezpiecznie wykonać operacji. Niczego nie ponawiam automatycznie.');}
export function parseGoogleSheets(data,binding){
 if(data?.spreadsheetId!==binding.spreadsheetId||data?.properties?.title!==SHEETS_TITLE||!Array.isArray(data?.sheets))fail('inny lub niekompletny arkusz.');
 const tables={};
 for(const name of SHEET_NAMES){const matches=data.sheets.filter(s=>s.properties?.title===name);if(matches.length!==1)fail('brak lub podwójna zakładka.');const sheet=matches[0],columns=SHEET_COLUMNS[name];
  if(!Array.isArray(sheet.data)||sheet.data.length!==1||(sheet.data[0].startRow??0)!==0||(sheet.data[0].startColumn??0)!==0)fail('niepełny odczyt siatki.');
  const source=sheet.data[0].rowData;if(!Array.isArray(source)||!source.length)fail('brak nagłówków.');
  const rows=source.map(r=>{
   if(r.values!==undefined&&!Array.isArray(r.values))fail('nieprawidłowe komórki.');
   const cells=(r.values??[]).map(c=>{if(c.userEnteredValue===undefined)return null;const v=c.userEnteredValue;if(!v||Object.keys(v).length!==1)fail('nieprawidłowa komórka.');const key=Object.keys(v)[0];if(!['numberValue','stringValue','boolValue'].includes(key))fail('formuła lub nieobsługiwany typ w RAW DATA.');const value=v[key];if(key==='numberValue'&&(typeof value!=='number'||!Number.isFinite(value))||key==='stringValue'&&typeof value!=='string'||key==='boolValue'&&typeof value!=='boolean')fail('nieprawidłowa wartość.');return value;});
   if(cells.slice(columns.length).some(v=>v!==null))fail('nieznane kolumny zawierają dane.');return Array.from({length:columns.length},(_,i)=>cells[i]??null);
  });
  if(!same(rows[0],columns))fail('niezgodne nagłówki.');const records=rows.slice(1).filter(r=>r.some(v=>v!==null));if(records.some(r=>r[1]!==binding.profileId))fail('inny profil w arkuszu.');
  tables[name]={sheetId:sheet.properties.sheetId,exists:true,columns:[...columns],rows:records};
 }
 return validateSheetsState({spreadsheetId:binding.spreadsheetId,title:SHEETS_TITLE,schemaVersion:1,tables});
}
export function createNativeSheetsTransport({native=isAndroidNative(),bridge}={}){
 async function call(method,args={}){if(!native)throw sheetsError({code:'unavailable'});try{return await (bridge??getNativePlugin('BengerGoogleSheets'))[method](args);}catch(e){throw sheetsError(e);}}
 return {binding:()=>call('getBinding'),create:()=>call('createSheet'),read:()=>call('readSheet'),confirm:(ticket,receipt)=>call('confirmSheet',{ticket,receipt}),
  async write({ticket,body,journal}){
   if(new TextEncoder().encode(JSON.stringify(journal)).length>512*1024)throw new Error('Za dużo metadanych do bezpiecznego zapisu. Operacja została zatrzymana.');
   const opened=await call('beginWrite',{ticket,journal});let complete=false;
   try{const raw=JSON.stringify(body);for(let start=0;start<raw.length;){let end=Math.min(raw.length,start+128*1024);if(end<raw.length&&raw.charCodeAt(end-1)>=0xD800&&raw.charCodeAt(end-1)<=0xDBFF)end--;await call('appendWrite',{id:opened.id,data:raw.slice(start,end)});start=end;}
    const result=await call('finishWrite',{id:opened.id});complete=true;return result;
   }finally{if(!complete)await call('abortWrite',{id:opened.id}).catch(()=>{});}
  }};
}
export function createSheetsCoordinator({transport=createNativeSheetsTransport(),readFull}){
 async function observed(){const response=await transport.read();return {...response,current:parseGoogleSheets(response.data,response.binding)};}
 async function recover(){const state=await observed(),pending=state.binding.pending;
  if(!pending)return state;
  const hash=await fingerprint(state.current),status=state.current.tables.Synchronizacja.rows.map(r=>rowObject('Synchronizacja',r)).find(r=>r.profileId===state.binding.profileId);
  if(hash!==pending.targetHash||status?.operationId!==pending.operationId||pending.profileId!==state.binding.profileId||pending.deviceId!==state.binding.deviceId)throw sheetsError({code:'pending-operation'});
  const receipt={schemaVersion:1,spreadsheetId:state.binding.spreadsheetId,profileId:state.binding.profileId,deviceId:state.binding.deviceId,stateHash:hash,inventory:pending.inventory};
  await transport.confirm(state.ticket,receipt);return observed();
 }
 async function prepare(range,{deletionDigest=null,impactDigest=null}={}){
  const fullExport=await readFull({}),state=await recover(),b=state.binding;
  const plan=await prepareSheetsPlan({fullExport,current:state.current,baseline:b.baseline,profileId:b.profileId,deviceId:b.deviceId,range,initialize:b.baseline===null,confirmDeletionDigest:deletionDigest,confirmImpactDigest:impactDigest});
  const batch=plan.blockers.length?null:await prepareSheetsBatchUpdate(plan,state.current);return {plan,current:state.current,binding:b,batch};
 }
 async function send(preview){
  const {plan,binding}=preview;
  if(plan.blockers.length||plan.noop)fail('plan nie wymaga lub nie dopuszcza zapisu.');
  const full=await readFull({}),source=mapSheetExport(full,{profileId:plan.profileId});if(await fingerprint({profileId:plan.profileId,rows:source.rows})!==plan.sourceHash)fail('dane lokalne zmieniły się po podglądzie.');
  const state=await observed(),b=state.binding;if(b.pending)throw sheetsError({code:'pending-operation'});
  if(b.accountKey!==binding.accountKey||b.spreadsheetId!==binding.spreadsheetId||b.profileId!==plan.profileId||b.deviceId!==plan.deviceId)fail('zmieniono konto lub instalację.');
  const prepared=await prepareSheetsBatchUpdate(plan,state.current);
  if(prepared.alreadyApplied){if(b.baseline?.stateHash===plan.targetHash)return {saved:true,binding:b};throw sheetsError({code:'pending-operation'});}
  const latest=mapSheetExport(await readFull({}),{profileId:plan.profileId});if(await fingerprint({profileId:plan.profileId,rows:latest.rows})!==plan.sourceHash)fail('dane lokalne zmieniły się podczas odczytu arkusza.');
  const journal={schemaVersion:1,operationId:plan.operationId,targetHash:plan.targetHash,baseHash:plan.baseHash,profileId:plan.profileId,deviceId:plan.deviceId,range:plan.range,inventory:plan.inventory};
  const result=await transport.write({ticket:state.ticket,body:prepared.body,journal});if(result.cancelled)return {cancelled:true};
  const after=await observed();if(after.binding.accountKey!==b.accountKey)fail('zmieniono konto.');
  const receipt=await acknowledgeSheetsPlan(plan,after.current);await transport.confirm(after.ticket,receipt);return {saved:true,binding:await transport.binding()};
 }
 return {binding:()=>transport.binding(),create:()=>transport.create(),prepare,send,check:recover};
}
