import {navigate} from './navigation.js';
import {localReminderDate} from './training-reminders.js';
import {ROUTINE_TYPES,WEEKDAYS,defaultRoutineSettings} from './reminder-preferences.js';
import {createRoutineReminderController,routineNotificationTarget} from './routine-reminders.js';
import {storageErrorMessage} from './storage-health.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function message(s){return s.state==='off'?'Posiłki i pomiary: przypomnienia wyłączone.':s.state==='denied'?'Android blokuje powiadomienia. Włącz zgodę w ustawieniach telefonu.':s.state==='blocked'?`Wyłączony kanał powiadomień w telefonie: ${s.blocked.join(', ')}.`:s.state==='error'?'Nie udało się zaplanować przypomnień. Zapisane alarmy mogą być nieaktualne. Spróbuj odświeżyć.':`Aktywne przypomnienia tygodniowe: ${s.count}. Działają także po zamknięciu aplikacji.`;}
export function openRoutineTarget(target){
 if(target.meal){navigate('dziennik');const date=document.getElementById('date'),meal=document.getElementById('nutrition-meal');date.value=localReminderDate(Date.now());date.dispatchEvent(new Event('change'));meal.value=target.meal;meal.dispatchEvent(new Event('change'));document.getElementById('nutrition-title')?.focus({preventScroll:true});return;}
 navigate('progres');const form=document.getElementById(`progress-${target.measurement}-form`);if(!form)return;form.closest('details').open=true;
 const values=[...form.querySelectorAll('input')].filter(i=>!['date','time'].includes(i.name));if(values.every(i=>!i.value.trim())){form.elements.date.value=localReminderDate(Date.now());const d=new Date();form.elements.time.value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
 form.scrollIntoView({block:'start'});(form.elements.namedItem(target.measurement==='weight'?'kg':target.measurement==='pressure'?'systolic':'waist')??form.querySelector('input'))?.focus({preventScroll:true});
}
export async function initRoutineReminders({plugin,parent,preferences}){
 const root=el('section');root.id='routine-reminders';root.append(el('h3','Posiłki i pomiary'),el('p','Włącz tylko wybrane przypomnienia. Każde może mieć własną godzinę i dni tygodnia. Godziny są lokalne dla telefonu.'));parent.append(root);
 let saved=defaultRoutineSettings(),readError='';try{saved=await preferences.readRoutine();}catch(e){readError=storageErrorMessage(e);}
 const form=el('form');form.id='routine-reminders-form';form.noValidate=true;root.append(form);const fields=new Map();
 for(const [group,kinds] of [['Posiłki',['breakfast','lunch','dinner','snack']],['Pomiary',['weight','pressure','body']]]){
  const details=el('details'),summary=el('summary',group);details.append(summary);form.append(details);
  for(const kind of kinds){const setting=saved.items.find(r=>r.kind===kind),box=el('fieldset'),legend=el('legend',ROUTINE_TYPES[kind]),label=el('label'),enabled=el('input'),timeLabel=el('label','Godzina'),time=el('input'),days=el('div');box.dataset.reminderKind=kind;enabled.type='checkbox';enabled.id=`reminder-${kind}-enabled`;enabled.checked=setting.enabled;label.htmlFor=enabled.id;label.append(enabled,document.createTextNode(' Włącz przypomnienie'));time.type='time';time.id=`reminder-${kind}-time`;time.value=setting.time;time.required=true;timeLabel.htmlFor=time.id;days.className='reminder-weekdays';days.setAttribute('role','group');days.setAttribute('aria-label',`Dni: ${ROUTINE_TYPES[kind]}`);
   const checks=[];for(const day of [2,3,4,5,6,7,1]){const l=el('label'),c=el('input');c.type='checkbox';c.value=String(day);c.checked=setting.weekdays.includes(day);c.setAttribute('aria-label',`${ROUTINE_TYPES[kind]}: ${WEEKDAYS[day]}`);l.append(c,document.createTextNode(WEEKDAYS[day]));days.append(l);checks.push(c);}box.append(legend,label,timeLabel,time,el('p','Dni tygodnia'),days);details.append(box);fields.set(kind,{enabled,time,checks});
  }
 }
 const save=el('button','Zapisz posiłki i pomiary');save.className='button-primary';save.type='submit';form.append(save);const status=el('p',readError||'Sprawdzam przypomnienia…');status.id='routine-reminders-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
 const targetLabel=el('label','Rodzaj powiadomienia testowego'),target=el('select');target.id='routine-reminders-test-kind';targetLabel.htmlFor=target.id;for(const[k,label]of Object.entries(ROUTINE_TYPES)){const o=el('option',label);o.value=k;target.append(o);}target.value=saved.items.find(r=>r.enabled)?.kind??'breakfast';
 const test=el('button','Test przypomnienia o posiłku / pomiarze'),refresh=el('button','Odśwież posiłki i pomiary');test.id='routine-reminders-test';refresh.id='routine-reminders-refresh';test.type=refresh.type='button';test.className=refresh.className='button-secondary';root.append(targetLabel,target,test,refresh,el('p','Przypomnienie niczego nie zapisuje za Ciebie. Kliknięcie otwiera dziennik albo formularz pomiaru. Powtarza się co tydzień w wybranych dniach; nie wymaga codziennego uruchamiania Bengera. Android może opóźnić dostarczenie, szczególnie przy oszczędzaniu baterii.'));
 let busy=false,state='off',pendingAction=null;
 const controller=createRoutineReminderController({plugin,preferences,onStatus:s=>{state=s.state;status.textContent=message(s);test.disabled=state!=='ready';}});
 const error=e=>/^(Sprawdź|Nie udzielono|Najpierw włącz|Powiadomienia są|Pamięć przypomnień)/.test(e?.message??'')?e.message:e?.name==='QuotaExceededError'?storageErrorMessage(e):message({state:'error'});
 async function run(fn){if(busy)return;busy=true;save.disabled=test.disabled=refresh.disabled=true;try{await fn();}catch(e){status.textContent=error(e);}finally{busy=false;save.disabled=refresh.disabled=false;test.disabled=state!=='ready';}}
 form.onsubmit=e=>{e.preventDefault();void run(async()=>{const value={version:1,items:[...fields].map(([kind,{enabled,time,checks}])=>({kind,enabled:enabled.checked,time:time.value,weekdays:checks.filter(c=>c.checked).map(c=>Number(c.value))}))};for(const row of value.items)if(row.enabled&&!row.weekdays.length)throw new Error(`Sprawdź dni: ${ROUTINE_TYPES[row.kind]} — wybierz przynajmniej jeden dzień.`);await controller.save(value);saved=await preferences.readRoutine();if(!saved.items.some(r=>r.kind===target.value&&r.enabled))target.value=saved.items.find(r=>r.enabled)?.kind??'breakfast';});};
 test.onclick=()=>void run(async()=>{await controller.test(target.value);status.textContent='Wysłano test. Sprawdź pasek powiadomień i dotknij powiadomienia.';});refresh.onclick=()=>void run(()=>controller.sync());
 function handleAction(event){const target=routineNotificationTarget(event);if(!target)return false;if(document.hidden)pendingAction=event;else openRoutineTarget(target);return true;}
 const refreshAll=()=>{if(document.hidden)return;if(pendingAction){const e=pendingAction;pendingAction=null;handleAction(e);}void run(()=>controller.sync());};
 window.addEventListener('benger:native-resume',refreshAll);window.addEventListener('focus',refreshAll);document.addEventListener('visibilitychange',refreshAll);
 await run(()=>controller.sync());return {handleAction,controller};
}
