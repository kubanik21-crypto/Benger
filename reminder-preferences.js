import {STORAGE_NAMESPACE} from './app-storage.js';
import {createProductStorage} from './product-cache.js';
import {REMINDER_DEFAULTS,loadReminderSettings,validateReminderSettings} from './training-reminders.js';
export const TRAINING_PREFERENCES_KEY='notification-training-v1';
export const ROUTINE_PREFERENCES_KEY='notification-routine-v1';
export const ROUTINE_TYPES=Object.freeze({breakfast:'Śniadanie',lunch:'Obiad',dinner:'Kolacja',snack:'Przekąska',weight:'Masa ciała',pressure:'Ciśnienie i tętno',body:'Obwody'});
export const WEEKDAYS=Object.freeze({2:'Pon',3:'Wt',4:'Śr',5:'Czw',6:'Pt',7:'Sob',1:'Niedz'});
const defaults={breakfast:['08:00',[2,3,4,5,6,7,1]],lunch:['13:00',[2,3,4,5,6,7,1]],dinner:['19:00',[2,3,4,5,6,7,1]],snack:['16:00',[2,3,4,5,6,7,1]],weight:['07:00',[2,4,6]],pressure:['08:00',[2,3,4,5,6,7,1]],body:['09:00',[1]]};
export const defaultRoutineSettings=()=>({version:1,items:Object.entries(defaults).map(([kind,[time,weekdays]])=>({kind,enabled:false,time,weekdays:[...weekdays]}))});
const plain=v=>v&&Object.getPrototypeOf(v)===Object.prototype;
export function validateRoutineSettings(value){
 if(!plain(value)||value.version!==1||Object.keys(value).some(k=>!['version','items'].includes(k))||!Array.isArray(value.items)||value.items.length!==Object.keys(ROUTINE_TYPES).length)throw new TypeError('Sprawdź ustawienia przypomnień.');
 const seen=new Set();const items=value.items.map(row=>{if(!plain(row)||!Object.hasOwn(ROUTINE_TYPES,row.kind)||seen.has(row.kind)||Object.keys(row).some(k=>!['kind','enabled','time','weekdays'].includes(k))||typeof row.enabled!=='boolean'||typeof row.time!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time)||!Array.isArray(row.weekdays)||row.weekdays.length>7||row.enabled&&!row.weekdays.length||row.weekdays.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(row.weekdays).size!==row.weekdays.length)throw new TypeError('Sprawdź godzinę i dni przypomnienia.');seen.add(row.kind);return {kind:row.kind,enabled:row.enabled,time:row.time,weekdays:[...row.weekdays].sort((a,b)=>a-b)};});
 return {version:1,items:Object.keys(ROUTINE_TYPES).map(kind=>items.find(r=>r.kind===kind))};
}
export function validateNotificationPreferences(value){if(!plain(value)||Object.keys(value).some(k=>!['training','routine'].includes(k)))throw new TypeError('Nieprawidłowe ustawienia powiadomień w kopii.');return {training:validateReminderSettings(value.training),routine:validateRoutineSettings(value.routine)};}
export function notificationPreferencesFromRecords(meta,local){const training=meta.find(r=>r.key===TRAINING_PREFERENCES_KEY),routine=meta.find(r=>r.key===ROUTINE_PREFERENCES_KEY);if(!training&&!routine&&(STORAGE_NAMESPACE||!local?.getItem?.('benger.training-reminders.v1')))return null;return validateNotificationPreferences({training:training?training.value:(local&&!STORAGE_NAMESPACE?loadReminderSettings(local):{...REMINDER_DEFAULTS}),routine:routine?routine.value:defaultRoutineSettings()});}
export function createReminderPreferences({storage=createProductStorage()}={}){
 async function durable(){await storage.ready?.();if(storage.persistent&& !storage.persistent())throw new Error('Pamięć przypomnień jest niedostępna. Nie potwierdzono zapisu.');}
 async function save(key,value){await durable();await storage.mutate('meta',key,()=>({value}));await durable();return value;}
 return {async readTraining(local){await durable();const row=await storage.read('meta',TRAINING_PREFERENCES_KEY);await durable();return row?validateReminderSettings(row.value):STORAGE_NAMESPACE?{...REMINDER_DEFAULTS}:loadReminderSettings(local);},saveTraining:v=>save(TRAINING_PREFERENCES_KEY,validateReminderSettings(v)),async readRoutine(){await durable();const row=await storage.read('meta',ROUTINE_PREFERENCES_KEY);await durable();return row?validateRoutineSettings(row.value):validateRoutineSettings(defaultRoutineSettings());},saveRoutine:v=>save(ROUTINE_PREFERENCES_KEY,validateRoutineSettings(v)),close:storage.close};
}
