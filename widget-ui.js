import {createMatchStore,buildMatchWeek,prepareMatch} from './basketball-match.js';
import {createProgressStore} from './progress.js';
import {createReminderPreferences} from './reminder-preferences.js';
import {addDays,weekStart} from './training-calendar.js';
import {isAndroidNative,getNativePlugin} from './native-platform.js';
import {STORAGE_NAMESPACE,NUTRITION_STORAGE_KEY} from './app-storage.js';
import {createGoalsStore} from './goals.js';
import {createTrainingRepository,localTrainingDate} from './training-repository.js';
import {openTrainingCalendar} from './training-calendar-ui.js';
import {openRoutineTarget} from './routine-reminders-ui.js';
import {navigate} from './navigation.js';
import {buildWidgetSnapshot} from './widget-model.js';
const actions=new Set(['open','refresh','meal','weight','training','match']);
export async function openWidgetAction(action,{training}){
 if(!actions.has(action))return false;
 if(action==='match'){navigate('ustawienia');document.getElementById('basketball-match')?.scrollIntoView({block:'start'});}
 else if(action==='weight')openRoutineTarget({measurement:'weight'});
 else if(action==='meal'){openRoutineTarget({meal:document.getElementById('nutrition-meal').value||'breakfast'});const voice=document.getElementById('voice-microphone');voice.scrollIntoView({block:'center'});voice.focus({preventScroll:true});}
 else if(action==='training'){const s=await training.snapshot();if(s.activeWorkout||s.activeMobility){navigate('trening');const tab=document.querySelector(`[data-training-tab=${s.activeWorkout?'workout':'mobility'}]`);if(tab?.getAttribute('aria-pressed')!=='true')tab?.click();}else openTrainingCalendar(localTrainingDate());}
 else navigate('dziennik');
 return true;
}
export async function initWidget(){
 if(!isAndroidNative()||STORAGE_NAMESPACE)return;
 const plugin=getNativePlugin('BengerNative');if(typeof plugin.updateWidgetSnapshot!=='function'||typeof plugin.widgetStatus!=='function')return;
 const panel=document.createElement('section');panel.className='panel';panel.id='widget-settings';const heading=document.createElement('h2');heading.textContent='Widżet Benger — Mecz tygodnia';const help=document.createElement('p');help.textContent='Na ekranie głównym telefonu przytrzymaj puste miejsce → Widżety → Benger → Mecz tygodnia. Widżet pokazuje kalorie i trening; skróty otwierają posiłek i wagę.';const status=document.createElement('p');status.id='widget-status';status.setAttribute('role','status');const add=document.createElement('button');add.type='button';add.className='button-secondary';add.id='widget-add';add.textContent='Dodaj widżet na ekran główny';const refresh=document.createElement('button');refresh.type='button';refresh.className='button-secondary';refresh.id='widget-refresh';refresh.textContent='Odśwież dane widżetu';const matchPanel=document.createElement('div');matchPanel.id='basketball-match';panel.append(heading,help,matchPanel,status,add,refresh);document.getElementById('route-ustawienia').append(panel);
 const matchStore=createMatchStore(),progress=createProgressStore(),preferences=createReminderPreferences();const training=createTrainingRepository(),goals=createGoalsStore();let tail=Promise.resolve(),revision=0,timer=null,last='',pendingAction=false;
 const queue=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
 async function sync(force=false){const token=++revision;return queue(async()=>{try{const info=await plugin.widgetStatus();add.hidden=!info.pinSupported;const [periods,state,measurements,routine]=await Promise.all([goals.read(),training.snapshot(),progress.measurements(),preferences.readRoutine()]);const entries=JSON.parse(localStorage.getItem(NUTRITION_STORAGE_KEY)??'[]'),today=localTrainingDate();const matchState=await matchStore.advance({today,goals:periods,training:state,routine});const data=buildWidgetSnapshot({entries,goals:periods,training:state,matchState,measurements});renderMatches(matchPanel,{state:matchState,entries,training:state,measurements},today);if(!force&&token!==revision)return;const signature=JSON.stringify(data.days);if((force||info.count)&&(force||signature!==last||info.date!==data.days[0].date)){await plugin.updateWidgetSnapshot({snapshot:JSON.stringify(data)});last=signature;}status.textContent='Dane widżetu odświeżone. Android może opóźniać aktualizację w tle.';return true;}catch{last='';try{await plugin.clearWidgetSnapshot();}catch{/* Source data stay intact if the native bridge is unavailable. */}status.textContent='Nie udało się odświeżyć widżetu. Dziennik i pomiary pozostają bez zmian. Spróbuj ponownie.';return false;}});}
 async function action(){if(document.hidden){pendingAction=true;return;}pendingAction=false;try{const event=await plugin.consumeWidgetAction();if(await openWidgetAction(event.action,{training}))await sync(true);}catch{status.textContent='Nie udało się otworzyć skrótu widżetu. Otwórz odpowiednią sekcję aplikacji.';}}
 await plugin.addListener('widgetAction',()=>void action());
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{void sync();},150);};
 for(const name of ['benger:diary','benger:training','benger:goals','benger:progress','benger:reminders','storage'])window.addEventListener(name,schedule);
 const resume=()=>{if(document.hidden)return;if(pendingAction)void action();void sync(true);};window.addEventListener('benger:native-resume',resume);document.addEventListener('visibilitychange',resume);
 refresh.onclick=()=>{refresh.disabled=true;void sync(true).finally(()=>{refresh.disabled=false;});};
 add.onclick=async()=>{add.disabled=true;try{if(!await sync(true))return;const result=await plugin.requestWidgetPin();status.textContent=result.requested?'Potwierdź dodanie widżetu na ekranie telefonu.':'Dodaj widżet przez ekran główny → Widżety → Benger.';}catch{status.textContent='Dodaj widżet przez ekran główny → Widżety → Benger.';}finally{add.disabled=false;}};
 await sync(true);await action();return {flush:async()=>{clearTimeout(timer);await sync();await tail;}};
}

function renderMatches(root,input,today){
 const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
 const names={win:'Wygrana',loss:'Przegrana',draw:'Remis',future:'Przed Tobą',unknown:'Brak zapisanych założeń',pending:'W toku / bez zadań',incomplete:'Jedzenie nieuzupełnione'};
 root.replaceChildren(el('h3','Twój koszykarski tydzień'));
 const context=prepareMatch(input),current=buildMatchWeek(context,today);
 root.append(el('p',`Ty ${current.us} : ${current.them} Rywale · od ${current.start} · poziom ${current.level+1}/5`));
 const rules=document.createElement('details');rules.append(el('summary','Zasady i historia meczów'),el('p','Każdy tydzień zaczyna się w poniedziałek od 0:0. Kalorie: ±10% celu = +2; poza zakresem po końcu dnia = 2 dla rywali. Przekroczenie górnej granicy daje rywalom 2 już dzisiaj. Brak jedzenia: dzień nieuzupełniony. Zaplanowane treningi: wszystkie wykonane +2, pominięte 2 dla rywali. Każdy zaplanowany pomiar: +1 lub po końcu dnia 1 dla rywali. Dni bez zadania nie tracą punktów. Spadek ani wzrost masy same w sobie nie dają punktów. Wynik dzisiaj jest tymczasowy. Korekta zapisu aktualizuje wynik, ale stare założenia pozostają zapisane.'));
 for(let i=0;i<8;i++){const start=addDays(weekStart(today),-i*7);if(!input.state.days.some(r=>r.date>=start&&r.date<=addDays(start,6)))continue;const week=buildMatchWeek(context,today,start);rules.append(el('h4',`${start} — ${addDays(start,6)} · ${week.us} : ${week.them}${week.provisional?' · w toku':''}`));for(const row of week.days)rules.append(el('p',`${row.date}: ${names[row.status]} · ${row.us}:${row.them}${row.date===today?' (tymczasowo)':''}${row.reasons.length?' · '+row.reasons.join('; '):''}`));}
 root.append(rules);
}
