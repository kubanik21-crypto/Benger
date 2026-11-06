import {occurrences,addDays,civilDate,scheduleId,emptySchedule} from './training-calendar.js';

export const REMINDER_SETTINGS_KEY='benger.training-reminders.v1';
export const REMINDER_OWNER='benger-training-v1';
export const REMINDER_CHANNEL='benger-training-v1';
export const REMINDER_TEST_ID=999999999;
export const REMINDER_DEFAULTS=Object.freeze({version:1,enabled:false,minutesBefore:30,defaultTime:'18:00'});
export const REMINDER_DAYS=60;
export const REMINDER_LIMIT=200;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function validateReminderSettings(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).some(k=>!Object.hasOwn(REMINDER_DEFAULTS,k))||value.version!==1||typeof value.enabled!=='boolean'||![0,15,30,60].includes(value.minutesBefore)||!timePattern.test(value.defaultTime))throw new TypeError('Sprawdź godzinę i wyprzedzenie przypomnienia.');
 return {version:1,enabled:value.enabled,minutesBefore:value.minutesBefore,defaultTime:value.defaultTime};
}
export function loadReminderSettings(local){
 const raw=local.getItem(REMINDER_SETTINGS_KEY);
 if(raw===null)return {...REMINDER_DEFAULTS};
 try{return validateReminderSettings(JSON.parse(raw));}catch{throw new Error('Nie można odczytać ustawień przypomnień. Zapisz je ponownie; dotychczasowych danych treningowych nie zmieniono.');}
}
export function localReminderDate(now){const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function localOccurrenceTime(date,time){
 if(!civilDate(date)||!timePattern.test(time))return null;
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),value=new Date(0);
 value.setFullYear(y,m-1,d);value.setHours(h,min,0,0);
 // A nonexistent civil time during the DST jump must not silently move an hour.
 return value.getFullYear()===y&&value.getMonth()===m-1&&value.getDate()===d&&value.getHours()===h&&value.getMinutes()===min?value:null;
}
function hashId(key){let h=2166136261;for(const c of key){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return 1000000000+(h>>>0)%1000000000;}
export function reminderBase(){return {channelId:REMINDER_CHANNEL,smallIcon:'ic_stat_benger',iconColor:'#174d3c',autoCancel:true,isExactNotification:false,isExactMandatory:false};}
export function buildTrainingReminders(state,settings,{now=Date.now(),idFor=hashId}={}){
 settings=validateReminderSettings(settings);if(!settings.enabled)return {notifications:[],omitted:0,invalidTimes:0};
 const from=localReminderDate(now),through=addDays(from,REMINDER_DAYS-1),completed=new Set([...state.completedWorkouts,...state.completedMobility,...[state.activeWorkout,state.activeMobility].filter(Boolean)].filter(s=>s.scheduled).map(s=>s.scheduled.ruleId+'@'+s.scheduled.date));
 const notifications=[],ids=new Set();let invalidTimes=0;
 for(const row of occurrences(state.schedule??emptySchedule(),from,through)){
  if(completed.has(row.occurrenceId))continue;
  const start=localOccurrenceTime(row.date,row.time??settings.defaultTime);if(!start){invalidTimes++;continue;}
  const at=new Date(start.getTime()-settings.minutesBefore*60000);if(at.getTime()<=now)continue;
  let id=idFor(row.occurrenceId);if(!Number.isInteger(id)||id<1000000000||id>1999999999)throw new Error('Nieprawidłowy identyfikator przypomnienia.');
  while(ids.has(id))id=id===1999999999?1000000000:id+1;ids.add(id);
  notifications.push({...reminderBase(),id,title:`Benger · ${row.kind==='mobility'?'Mobility':'Trening'}`,body:`${row.title} · ${row.date.slice(8)}.${row.date.slice(5,7)}.${row.date.slice(0,4)}, ${row.time??settings.defaultTime}`,schedule:{at,allowWhileIdle:true},extra:{config:1,owner:REMINDER_OWNER,type:'training',key:row.occurrenceId,ruleId:row.id,date:row.date,startsAt:start.toISOString(),remindAt:at.toISOString()}});
 }
 notifications.sort((a,b)=>a.schedule.at-b.schedule.at||a.extra.key.localeCompare(b.extra.key));
 return {notifications:notifications.slice(0,REMINDER_LIMIT),omitted:Math.max(0,notifications.length-REMINDER_LIMIT),invalidTimes};
}
export const ownedReminder=n=>n?.extra?.owner===REMINDER_OWNER&&Number.isInteger(n.id)&&n.id>=REMINDER_TEST_ID&&n.id<=1999999999;
export function notificationTarget(event){
 const n=event?.notification;if(!ownedReminder(n))return null;
 if(n.extra.type==='test'&&n.id===REMINDER_TEST_ID)return {settings:true};
 if(n.extra.type!=='training'||!civilDate(n.extra.date)||!scheduleId(n.extra.ruleId)||n.extra.key!==n.extra.ruleId+'@'+n.extra.date)return null;
 return {date:n.extra.date,ruleId:n.extra.ruleId};
}
// Android getPending omits channelId and may serialize Date with a local zone name.
// Compare our own canonical ISO timestamps, retained intact in the native extra payload.
function signature(n){return JSON.stringify([n.id,n.title,n.body,n.extra?.config,n.isExactNotification,n.extra?.key,n.extra?.startsAt,n.extra?.remindAt]);}
export function reminderChanges(wanted,pending){
 const old=new Map(pending.filter(ownedReminder).map(n=>[n.id,n])),next=new Map(wanted.map(n=>[n.id,n]));
 return {cancel:[...old.values()].filter(n=>!next.has(n.id)||signature(n)!==signature(next.get(n.id))).map(({id})=>({id})),add:wanted.filter(n=>!old.has(n.id)||signature(n)!==signature(old.get(n.id)))};
}

// One serialized owner of native alarms. A failed operation never poisons later retries.
export function createTrainingReminderController({plugin,repository,local,onStatus=()=>{},now=()=>Date.now()}){
 let tail=Promise.resolve();
 const queue=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
 const status=value=>{onStatus(value);return value;};
 async function channel(){try{await plugin.createChannel({id:REMINDER_CHANNEL,name:'Trening i Mobility',description:'Przypomnienia o aktywnościach z kalendarza Bengera',importance:4,visibility:0,vibration:true});}catch(e){if(e?.code!=='UNAVAILABLE')throw e;}}
 async function reconcile(settings){
  const pending=(await plugin.getPending()).notifications??[];
  if(!settings.enabled){
   const cancel=pending.filter(ownedReminder).map(({id})=>({id}));if(cancel.length)await plugin.cancel({notifications:cancel});
   const delivered=(await plugin.getAll({state:'TRIGGERED'})).notifications.filter(ownedReminder);if(delivered.length)await plugin.removeDeliveredNotifications({notifications:delivered});
   return status({state:'off',count:0});
  }
  const permission=await plugin.checkPermissions();
  if(permission.display!=='granted'){const cancel=pending.filter(ownedReminder).map(({id})=>({id}));if(cancel.length)await plugin.cancel({notifications:cancel});return status({state:'denied',count:0});}
  await channel();
  const state=await repository.snapshot(),built=buildTrainingReminders(state,settings,{now:now()}),changes=reminderChanges(built.notifications,pending);
  if(changes.cancel.length)await plugin.cancel({notifications:changes.cancel});
  for(let i=0;i<changes.add.length;i+=40)await plugin.schedule({notifications:changes.add.slice(i,i+40)});
  const keys=new Set(built.notifications.map(n=>n.extra.key)),delivered=(await plugin.getAll({state:'TRIGGERED'})).notifications.filter(n=>ownedReminder(n)&&n.extra.type==='training'&&!keys.has(n.extra.key));
  if(delivered.length)await plugin.removeDeliveredNotifications({notifications:delivered});
  let channels={channels:[]};try{channels=await plugin.listChannels();}catch(e){if(e?.code!=='UNAVAILABLE')throw e;}const blocked=channels.channels?.some(c=>c.id===REMINDER_CHANNEL&&c.importance===0);
  return status({state:blocked?'blocked':'ready',count:built.notifications.length,omitted:built.omitted,invalidTimes:built.invalidTimes});
 }
 const failure=e=>{status({state:'error'});throw e;};
 return {
  sync:()=>queue(async()=>{try{return await reconcile(loadReminderSettings(local));}catch(e){return failure(e);}}),
  save:value=>queue(async()=>{
   try{const checked=validateReminderSettings(value);if(checked.enabled){let permission=await plugin.checkPermissions();if(permission.display!=='granted')permission=await plugin.requestPermissions();if(permission.display!=='granted')throw new Error('Nie udzielono zgody na powiadomienia. Możesz ją włączyć w ustawieniach telefonu.');}
    local.setItem(REMINDER_SETTINGS_KEY,JSON.stringify(checked));return await reconcile(checked);
   }catch(e){return failure(e);}
  }),
  test:()=>queue(async()=>{
   const settings=loadReminderSettings(local);if(!settings.enabled)throw new Error('Najpierw włącz i zapisz przypomnienia.');
   if((await plugin.checkPermissions()).display!=='granted')throw new Error('Powiadomienia są zablokowane w ustawieniach telefonu.');
   await channel();await plugin.schedule({notifications:[{...reminderBase(),id:REMINDER_TEST_ID,title:'Benger · Test powiadomień',body:'Powiadomienia działają. Dotknij, aby wrócić do ustawień Bengera.',extra:{owner:REMINDER_OWNER,type:'test'}}]});
  })
 };
}
