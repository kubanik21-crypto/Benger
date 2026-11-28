import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoSync,AUTO_SYNC_KEY,attachAutoSyncEvents} from './sheets-auto.js';
import {createAutoSync as legacyAutoSync} from './fixtures/sheets-auto-1.0.23.mjs';
import {fake} from './fixtures/smart-sync.mjs';
import {createSheetsCoordinator} from './google-sheets.js';
import {buildSyncExport} from './sync-export.js';
const settle=()=>new Promise(r=>setImmediate(r));
async function idleMeasurement(factory){
 const f=fake(),data=new Map();let time=0,id=0,fullReads=0,localReads=0,localWrites=0,attempts=0,hashes=0;
 const local={getItem:k=>{localReads++;return data.get(k)??null;},setItem:(k,v)=>{localWrites++;data.set(k,v);}};
 const coordinator=createSheetsCoordinator({transport:f.transport,readFull:async()=>{fullReads++;return buildSyncExport(f.s);}});
 await coordinator.send(await coordinator.prepareAll());f.transport.setAutomation=async enabled=>{f.binding.automationEnabled=enabled;return structuredClone(f.binding);};
 const timers=new Map();const service=factory({coordinator:{setAutomation:v=>coordinator.setAutomation(v),automatic:async a=>{attempts++;return coordinator.automatic(a);}},local,delay:1500,now:()=>time,online:()=>true,visible:()=>true,setTimer:(cb,ms)=>{timers.set(++id,{cb,at:time+ms});return id;},clearTimer:id=>timers.delete(id)});
 async function drain(){for(let i=0;i<5000;i++){await new Promise(r=>setTimeout(r,1));if(service.snapshot().status!=='syncing')return;}assert.fail('automatic operation did not settle');}
 async function advance(ms){time+=ms;for(const[k,t]of [...timers])if(t.at<=time){timers.delete(k);t.cb();}await drain();}
 await service.enable(true);await advance(1500);assert.equal(service.snapshot().status,'current');
 fullReads=localReads=localWrites=attempts=0;for(const k of Object.keys(f.calls))f.calls[k]=0;
 const digest=crypto.subtle.digest;crypto.subtle.digest=function(...args){hashes++;return digest.apply(this,args);};
 try{for(let i=1;i<=40;i++){await advance(1500);if(i%40===0){await service.sync();await drain();}}}
 finally{crypto.subtle.digest=digest;service.dispose();}
 return{windowMs:60000,automaticAttempts:attempts,fullSourceReads:fullReads,sha256Calculations:hashes,localStorageReads:localReads,localStorageWrites:localWrites,googleReads:f.calls.read,googleWrites:f.calls.write};
}
test('BUG-03: 60 seconds idle, real snapshot/coordinator, baseline compared with event-driven queue',async()=>{
 const before=await idleMeasurement(legacyAutoSync),after=await idleMeasurement(createAutoSync);
 assert.equal(before.automaticAttempts,41);assert.equal(before.fullSourceReads,41);assert.ok(before.sha256Calculations>=41);assert.equal(before.localStorageWrites,82);
 for(const key of ['automaticAttempts','fullSourceReads','sha256Calculations','localStorageReads','localStorageWrites','googleReads','googleWrites'])assert.equal(after[key],0,key);
 assert.equal(before.googleReads,0);assert.equal(before.googleWrites,0);
 console.log('BUG-03 synthetic idle comparison:',JSON.stringify({before,after}));
});
function simple(){let time=0,id=0,online=true;const timers=new Map(),data=new Map();const count={attempts:0,writes:0};const local={getItem:k=>data.get(k)??null,setItem:(k,v)=>{count.writes++;data.set(k,v);}};const coordinator={setAutomation:async()=>({accountKey:'a',profileId:'p',spreadsheetId:'s'}),automatic:async()=>{count.attempts++;return {sourceHash:'1'.padStart(64,'0'),binding:{lastSuccess:1}};}};const options={coordinator,local,delay:1500,now:()=>time,online:()=>online,visible:()=>true,setTimer:(cb,ms)=>{timers.set(++id,{cb,at:time+ms});return id;},clearTimer:k=>timers.delete(k)};const service=createAutoSync(options);return{service,options,data,count,timers,setOnline:v=>online=v,async advance(ms){time+=ms;for(const[k,t]of [...timers])if(t.at<=time){timers.delete(k);t.cb();}await settle();}};}
test('clean status stays stable; actual changes alone restart the debounce and manual force remains available',async()=>{const f=simple();await f.service.enable(true);await f.advance(1500);const writes=f.count.writes;for(let i=0;i<5;i++){await f.advance(60000);await f.service.sync();}assert.equal(f.count.attempts,1);assert.equal(f.count.writes,writes);assert.equal(f.timers.size,0);assert.equal(f.service.snapshot().status,'current');f.service.changed();await f.advance(1000);f.service.changed();await f.advance(1499);assert.equal(f.count.attempts,1);await f.advance(1);assert.equal(f.count.attempts,2);assert.equal(f.timers.size,0);await f.service.sync({force:true});assert.equal(f.count.attempts,3);assert.equal(f.timers.size,0);});
test('offline pending work stays durable and cold start/resume recover without creating a clean loop',async()=>{const f=simple();await f.service.enable(true);f.setOnline(false);await f.advance(1500);assert.equal(f.service.snapshot().dirty,true);assert.equal(f.service.snapshot().status,'offline');const writes=f.count.writes;await f.service.sync();assert.equal(f.count.writes,writes);assert.equal(f.count.attempts,0);f.service.dispose();f.setOnline(true);const next=createAutoSync(f.options);next.start();await f.advance(0);assert.equal(next.snapshot().status,'current');assert.equal(f.count.attempts,1);assert.equal(f.timers.size,0);next.dispose();const cold=createAutoSync(f.options);cold.start();await f.advance(0);assert.equal(f.count.attempts,2);assert.equal(cold.snapshot().status,'current');assert.equal(f.timers.size,0);cold.dispose();assert.ok(f.count.writes>writes);});
test('60-second recovery tick does not mark clean data dirty and is detached on disposal',()=>{const win=new EventTarget(),doc=new EventTarget();doc.hidden=false;let interval,period,cleared=false;win.setInterval=(cb,ms)=>{interval=cb;period=ms;return 4;};win.clearInterval=id=>{assert.equal(id,4);cleared=true;};const calls=[];const service=Object.fromEntries(['changed','resume','sync','start','pauseRestore','dispose'].map(k=>[k,()=>calls.push(k)]));const dispose=attachAutoSyncEvents(service,{window:win,document:doc});interval();assert.equal(period,60000);assert.deepEqual(calls,['start','sync']);doc.hidden=true;interval();assert.deepEqual(calls,['start','sync']);dispose();assert.ok(cleared);});
test('a mutation during an in-flight upload schedules exactly one debounced follow-up',async()=>{const f=simple();await f.service.enable(true);const immediate=f.options.coordinator.automatic;let release;f.options.coordinator.automatic=()=>{f.count.attempts++;return new Promise(r=>release=r);};const first=f.service.sync({force:true});f.service.changed();assert.equal(f.timers.size,0);f.options.coordinator.automatic=immediate;release({sourceHash:'1'.padStart(64,'0'),binding:{lastSuccess:1}});await first;assert.equal(f.service.snapshot().dirty,true);assert.equal(f.timers.size,1);await f.advance(1499);assert.equal(f.count.attempts,1);await f.advance(1);assert.equal(f.count.attempts,2);assert.equal(f.service.snapshot().dirty,false);assert.equal(f.timers.size,0);});
