import {createReminderPreferences} from './reminder-preferences.js';
import {initRoutineReminders} from './routine-reminders-ui.js';
import {isAndroidNative,getNativePlugin} from './native-platform.js';
import {STORAGE_NAMESPACE} from './app-storage.js';
import {createTrainingRepository} from './training-repository.js';
import {openTrainingCalendar} from './training-calendar-ui.js';
import {REMINDER_DEFAULTS,REMINDER_DAYS,loadReminderSettings,createTrainingReminderController,notificationTarget} from './training-reminders.js';

const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
function message(s){
 if(s.state==='off')return 'Przypomnienia są wyłączone.';
 if(s.state==='denied')return 'Android blokuje powiadomienia Bengera. Włącz zgodę w ustawieniach telefonu.';
 if(s.state==='blocked')return 'Kanał „Trening i Mobility” jest wyłączony w telefonie. Włącz go w ustawieniach powiadomień.';
 if(s.state==='error')return 'Nie udało się odświeżyć przypomnień. Zapisane w telefonie powiadomienia mogą być nieaktualne. Spróbuj ponownie.';
 return `Przypomnienia aktywne: ${s.count} terminów na najbliższe ${REMINDER_DAYS} dni.${s.count?'':' Dodaj terminy w kalendarzu.'}${s.omitted?` Limit osiągnięty — ${s.omitted} dalszych terminów czeka na kolejne odświeżenie.`:''}${s.invalidTimes?' Pominięto godzinę nieistniejącą przy zmianie czasu.':''}`;
}
function errorMessage(e){
 if(e?.name==='QuotaExceededError')return 'Brakuje miejsca na zapis ustawień przypomnień. Nie potwierdzono zapisu.';
 if(/^(Sprawdź|Nie udzielono|Nie można odczytać|Najpierw włącz|Powiadomienia są)/.test(e?.message??''))return e.message;
 return message({state:'error'});
}
export async function initTrainingReminders(){
 const settingsRoute=document.getElementById('route-ustawienia');if(!settingsRoute)return;
 const panel=el('section');panel.id='training-reminders';panel.className='panel';panel.append(el('h2','Powiadomienia i przypomnienia'));settingsRoute.append(panel);
 if(!isAndroidNative()||STORAGE_NAMESPACE){panel.append(el('p','Przypomnienia działają w aplikacji APK na Androidzie. Wersja przeglądarkowa nie planuje powiadomień.'));return;}
 const plugin=getNativePlugin('LocalNotifications');
 if(typeof plugin.checkPermissions!=='function'){panel.append(el('p','Zainstaluj nowszą APK Bengera, aby włączyć powiadomienia.'));return;}
 const preferences=createReminderPreferences();
 let settings={...REMINDER_DEFAULTS};try{settings=await preferences.readTraining(localStorage);}catch{/* Recoverable only through an explicit Save. */}
 const form=el('form');form.id='training-reminders-form';form.noValidate=true;
 const label=el('label'),enabled=el('input');enabled.id='training-reminders-enabled';enabled.type='checkbox';enabled.checked=settings.enabled;label.htmlFor=enabled.id;label.append(enabled,document.createTextNode(' Przypominaj o treningach i Mobility z kalendarza'));form.append(label);
 const leadLabel=el('label','Kiedy przypomnieć?'),lead=el('select');lead.id='training-reminders-lead';leadLabel.htmlFor=lead.id;
 for(const[value,text]of [[0,'O godzinie rozpoczęcia'],[15,'15 minut wcześniej'],[30,'30 minut wcześniej'],[60,'Godzinę wcześniej']]){const option=el('option',text);option.value=String(value);lead.append(option);}lead.value=String(settings.minutesBefore);
 const timeLabel=el('label','Godzina dla planów bez ustawionej godziny'),time=el('input');time.id='training-reminders-time';timeLabel.htmlFor=time.id;time.type='time';time.required=true;time.value=settings.defaultTime;
 form.append(leadLabel,lead,timeLabel,time,el('p','Godzina wpisana przy terminie ma pierwszeństwo. Dla planu listopadowego bez godzin użyj powyższej godziny domyślnej. Zgoda Androida jest potrzebna dopiero po włączeniu i zapisaniu.'));
 const save=el('button','Zapisz przypomnienia');save.className='button-primary';form.append(save);panel.append(form);
 const status=el('p','Sprawdzam przypomnienia…');status.id='training-reminders-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
 const test=el('button','Wyślij powiadomienie testowe');test.type='button';test.id='training-reminders-test';test.className='button-secondary';
 const refresh=el('button','Odśwież przypomnienia');refresh.type='button';refresh.className='button-secondary';refresh.id='training-reminders-refresh';
 const system=el('button','Ustawienia powiadomień w telefonie');system.type='button';system.id='training-reminders-system';system.className='button-secondary';panel.append(test,refresh,system);
 panel.append(el('p','To lokalne powiadomienia Androida, bez internetu i konta. Telefon steruje dźwiękiem, wibracją i ekranem blokady. Oszczędzanie baterii oraz tryb „Nie przeszkadzać” mogą opóźnić lub wyciszyć przypomnienie. To nie jest dokładny alarm.'));
 panel.append(el('p',`Treningi: planowane są najbliższe ${REMINDER_DAYS} dni; lista odnawia się po otwarciu aplikacji. Po zmianie strefy czasowej otwórz Bengera. Wymuszone zatrzymanie aplikacji w ustawieniach Androida blokuje przypomnienia do jej ponownego otwarcia.`));
 const calendar=el('a','Otwórz kalendarz treningów');calendar.href='#/trening/kalendarz';panel.append(calendar);
 const repository=createTrainingRepository();let lastWarning='',busy=false,lastState='off';
 const controller=createTrainingReminderController({plugin,repository,local:localStorage,preferences,onStatus:value=>{
  lastState=value.state;status.textContent=message(value);test.disabled=value.state!=='ready';
  const warning=document.getElementById('training-status');if(['denied','blocked','error'].includes(value.state)){lastWarning=message(value);if(warning)warning.textContent=lastWarning;}else if(warning?.textContent===lastWarning)warning.textContent='';
 }});
 async function run(task){if(busy)return;busy=true;for(const b of [save,test,refresh,system])b.disabled=true;try{await task();}catch(e){status.textContent=errorMessage(e);}finally{busy=false;save.disabled=refresh.disabled=system.disabled=false;test.disabled=lastState!=='ready';}}
 form.onsubmit=e=>{e.preventDefault();void run(async()=>{if(!time.validity.valid)throw new Error('Sprawdź godzinę przypomnienia.');await controller.save({version:1,enabled:enabled.checked,minutesBefore:Number(lead.value),defaultTime:time.value});});};
 test.onclick=()=>void run(async()=>{await controller.test();status.textContent='Wysłano powiadomienie testowe. Sprawdź pasek powiadomień telefonu; dźwięk zależy od ustawień Androida.';});
 refresh.onclick=()=>void run(()=>controller.sync());
 system.onclick=()=>void run(async()=>{await getNativePlugin('BengerNative').openNotificationSettings();});
 const routine=await initRoutineReminders({plugin,parent:panel,preferences});
 let pendingAction=null;
 const handleAction=event=>{if(routine?.handleAction(event))return;const target=notificationTarget(event);if(!target)return;if(document.hidden){pendingAction=event;return;}if(target.settings){location.hash='/ustawienia';return;}openTrainingCalendar(target.date);};
 try{await plugin.addListener('localNotificationActionPerformed',handleAction);}catch{status.textContent='Nie można obsłużyć otwierania przypomnień. Spróbuj zamknąć i ponownie otworzyć aplikację.';return;}
 let debounce;
 const sync=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{void controller.sync().catch(e=>{status.textContent=errorMessage(e);});},150);};
 window.addEventListener('benger:training',sync);
 const flushAction=()=>{if(!pendingAction||document.hidden)return;const event=pendingAction;pendingAction=null;handleAction(event);};
 window.addEventListener('benger:native-resume',()=>{flushAction();sync();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){flushAction();sync();}});
 window.addEventListener('focus',sync);
 setInterval(()=>{if(!document.hidden)sync();},6*60*60*1000);
 try{await controller.sync();}catch(e){status.textContent=errorMessage(e);}
 return {...controller,flush:async()=>{await controller.flush();await routine?.controller.flush();}};
}
