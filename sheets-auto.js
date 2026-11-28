import {NUTRITION_STORAGE_KEY} from './app-storage.js';
export const AUTO_SYNC_KEY=`${NUTRITION_STORAGE_KEY}.sheets-auto.v1`;
export const AUTO_MESSAGES={disabled:'Automatyczna synchronizacja wyłączona.',pending:'Oczekujące zmiany.',syncing:'Synchronizacja w toku.',current:'Wszystkie dane aktualne.',offline:'Oczekiwanie na internet.',authorization:'Wymagana ponowna autoryzacja lub właściwe konto Google.',confirmation:'Wymagane potwierdzenie zmian w podglądzie ręcznym.',conflict:'Synchronizacja wstrzymana. Zweryfikuj arkusz i dane lokalne.',retry:'Błąd synchronizacji. Zaplanowano kontrolowane ponowienie.',storage:'Brak trwałego zapisu kolejki. Synchronizacja wstrzymana.',restore:'Import backupu wstrzymał automatyzację. Zweryfikuj historię ręcznie.'};
const defaults=()=>({version:1,enabled:false,identity:null,dirty:true,revision:0,sourceHash:null,seenSources:[],nextAttempt:0,debounceUntil:0,attempts:0,lastSuccess:0,status:'disabled',paused:false,hold:null});
export function createAutoSync({coordinator,local=globalThis.localStorage,now=Date.now,online=()=>globalThis.navigator?.onLine!==false,visible=()=>!globalThis.document?.hidden,setTimer=setTimeout,clearTimer=clearTimeout,onChange=()=>{},delay=60000}={}){
 let state=defaults(),timer=null,running=false,disposed=false,durable=true;
 try{const raw=local.getItem(AUTO_SYNC_KEY);if(raw!==null){const s=JSON.parse(raw);if(s.version!==1||typeof s.enabled!=='boolean'||!Number.isSafeInteger(s.revision)||s.revision<0||typeof s.dirty!=='boolean'||!Array.isArray(s.seenSources)||s.seenSources.length>64||s.seenSources.some(x=>!/^([a-f0-9]{64})$/.test(x))||s.sourceHash!==null&&!/^[a-f0-9]{64}$/.test(s.sourceHash)||s.enabled&&typeof s.identity!=='string'||!Object.hasOwn(AUTO_MESSAGES,s.status)||!Number.isFinite(s.nextAttempt)||!Number.isFinite(s.attempts))throw new Error();state=Object.fromEntries(Object.entries(defaults()).map(([k,v])=>[k,s[k]??v]));}}catch{durable=false;state.status='storage';state.paused=true;}
 const snapshot=()=>structuredClone(state);
 function publish(){onChange(snapshot());}
 function persist(){try{local.setItem(AUTO_SYNC_KEY,JSON.stringify(state));durable=true;publish();return true;}catch{durable=false;state.paused=true;state.status='storage';publish();return false;}}
 function stop(){if(timer!==null)clearTimer(timer);timer=null;}
 function schedule(ms=delay){stop();if(!disposed&&state.enabled&&state.dirty&&!running&&!state.paused&&durable&&visible()){timer=setTimer(()=>{timer=null;void sync();},Math.max(ms,state.nextAttempt-now(),0));}}
 function changed(event){if(event?.type==='storage'&&[AUTO_SYNC_KEY,`${NUTRITION_STORAGE_KEY}.user-operations.v1`].includes(event.key))return;state.revision++;state.dirty=true;state.debounceUntil=now()+delay;if(!state.paused)state.status=state.enabled?'pending':'disabled';persist();schedule();}
 async function enable(value){stop();if(!value){state.enabled=false;state.status='disabled';persist();try{await coordinator.setAutomation(false);}catch{}return snapshot();}
  if(!durable||state.status==='storage'||state.hold)throw new Error(state.hold?'Wymagana ręczna weryfikacja pełnego zakresu przed wznowieniem.':AUTO_MESSAGES.storage);
  const b=await coordinator.setAutomation(true),identity=[b.accountKey,b.profileId,b.spreadsheetId].join('|');
  if(identity!==state.identity){state.sourceHash=null;state.seenSources=[];state.lastSuccess=0;}state.identity=identity;state.lastSuccess=b.lastSuccess??state.lastSuccess;state.enabled=true;state.dirty=true;state.paused=false;state.status='pending';state.attempts=0;state.nextAttempt=0;
  if(!persist()){try{await coordinator.setAutomation(false);}catch{}return snapshot();}schedule();return snapshot();
 }
 async function sync({force=false}={}){
  // A recovery tick is not a data mutation. A clean queue must do no work.
  if(disposed||running||!state.enabled||state.paused||!durable||(!force&&!state.dirty))return;
  if(!force&&Math.max(state.nextAttempt,state.debounceUntil??0)>now()){schedule(Math.max(state.nextAttempt,state.debounceUntil??0)-now());return;}
  stop();if(disposed||running||!state.enabled||state.paused||!durable)return;
  if(!visible()){schedule();return;}
  if(!online()){if(state.status!=='offline'){state.status='offline';persist();}return;}
  running=true;const revision=state.revision;state.dirty=true;state.status='syncing';if(!persist()){running=false;return;}
  try{const result=await coordinator.automatic({identity:state.identity,knownSourceHash:state.sourceHash,seenSources:state.seenSources});
   if(state.sourceHash&&state.sourceHash!==result.sourceHash)state.seenSources=[...new Set([...state.seenSources,state.sourceHash])].slice(-64);
   state.sourceHash=result.sourceHash;state.dirty=revision!==state.revision||state.paused;state.lastSuccess=result.binding?.lastSuccess??state.lastSuccess;state.attempts=0;state.nextAttempt=0;
   if(!state.paused)state.status=state.enabled?(state.dirty?'pending':'current'):'disabled';persist();
  }catch(error){const code=error?.code;
   if(!state.paused){if(code==='source-changed'){state.status='pending';state.nextAttempt=now()+delay;}else if((['offline','api-error','quota','busy'].includes(code)||code==='pending-operation'&&state.attempts<3)){state.attempts=Math.min(state.attempts+1,16);state.nextAttempt=now()+Math.min(60000*2**(state.attempts-1),30*60000);state.status=code==='offline'?'offline':'retry';}
    else{state.status=code==='authorization-required'?'authorization':code==='confirmation-required'?'confirmation':'conflict';state.paused=true;if(code!=='authorization-required')state.hold='verification';}}
   if(!state.enabled)state.status='disabled';persist();
  }finally{running=false;if(state.dirty)schedule(Math.max(0,(state.debounceUntil??0)-now()));}
 }
 function resume(){if(disposed)return;state.dirty=true;if(state.enabled&&!['restore','storage'].includes(state.status)){if(state.status==='authorization'){state.paused=false;state.nextAttempt=0;}if(state.status==='offline')state.nextAttempt=0;if(!state.paused){state.status='pending';persist();schedule(0);}}}
 function pauseRestore(){stop();state.revision++;state.paused=true;state.hold='restore';state.dirty=true;state.status='restore';persist();}
 // Only a completed manual verification can release a restore/conflict hold.
 function manualVerified(){if(state.status==='storage')return;state.hold=null;state.paused=false;state.dirty=true;state.sourceHash=null;state.seenSources=[];state.nextAttempt=0;state.attempts=0;state.status=state.enabled?'pending':'disabled';persist();schedule();}
 function start(){if(state.enabled&&!state.paused){state.dirty=true;state.status='pending';}if(state.status==='syncing'){state.status='pending';state.dirty=true;}persist();if(state.enabled&&!state.paused)schedule(0);else publish();}
 return {snapshot,enable,changed,sync,resume,pauseRestore,manualVerified,start,dispose(){disposed=true;stop();}};
}
export function attachAutoSyncEvents(service,{window:win=globalThis.window,document:doc=globalThis.document}={}){
 const edits=['benger:diary','benger:training','benger:goals','benger:progress','benger:user-mutation','storage'],wake=['online','pageshow','benger:native-resume','benger:google-auth-state'];
 for(const e of edits)win.addEventListener(e,service.changed);for(const e of wake)win.addEventListener(e,service.resume);
 const visibility=()=>{if(!doc.hidden)service.resume();};doc.addEventListener('visibilitychange',visibility);
 const restore=e=>{if(e.target?.closest?.('#backup-import')&&!e.target.disabled)service.pauseRestore();};doc.addEventListener('click',restore,true);win.addEventListener('benger:restore-started',service.pauseRestore);
 // Recovery tick only retries pending durable work; clean queues return without reads or writes.
 // Cold start/resume verifies the source once, including missed events while inactive.
 const poll=win.setInterval(()=>{if(!doc.hidden)void service.sync();},60000);
 service.start();return()=>{win.clearInterval(poll);for(const e of edits)win.removeEventListener(e,service.changed);for(const e of wake)win.removeEventListener(e,service.resume);doc.removeEventListener('visibilitychange',visibility);doc.removeEventListener('click',restore,true);win.removeEventListener('benger:restore-started',service.pauseRestore);service.dispose();};
}
