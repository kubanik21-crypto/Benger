import {isAndroidNative,getNativePlugin} from './native-platform.js';
import {STORAGE_NAMESPACE,NUTRITION_STORAGE_KEY} from './app-storage.js';
import {createGoalsStore} from './goals.js';
import {createTrainingRepository,localTrainingDate} from './training-repository.js';
import {openTrainingCalendar} from './training-calendar-ui.js';
import {openRoutineTarget} from './routine-reminders-ui.js';
import {navigate} from './navigation.js';
import {buildWidgetSnapshot} from './widget-model.js';
const actions=new Set(['open','refresh','meal','weight','training']);
export async function openWidgetAction(action,{training}){
 if(!actions.has(action))return false;
 if(action==='weight')openRoutineTarget({measurement:'weight'});
 else if(action==='meal'){openRoutineTarget({meal:document.getElementById('nutrition-meal').value||'breakfast'});const voice=document.getElementById('voice-microphone');voice.scrollIntoView({block:'center'});voice.focus({preventScroll:true});}
 else if(action==='training'){const s=await training.snapshot();if(s.activeWorkout||s.activeMobility){navigate('trening');const tab=document.querySelector(`[data-training-tab=${s.activeWorkout?'workout':'mobility'}]`);if(tab?.getAttribute('aria-pressed')!=='true')tab?.click();}else openTrainingCalendar(localTrainingDate());}
 else navigate('dziennik');
 return true;
}
export async function initWidget(){
 if(!isAndroidNative()||STORAGE_NAMESPACE)return;
 const plugin=getNativePlugin('BengerNative');if(typeof plugin.updateWidgetSnapshot!=='function'||typeof plugin.widgetStatus!=='function')return;
 const panel=document.createElement('section');panel.className='panel';panel.id='widget-settings';const heading=document.createElement('h2');heading.textContent='Widżet Benger — Dzisiaj';const help=document.createElement('p');help.textContent='Na ekranie głównym telefonu przytrzymaj puste miejsce → Widżety → Benger → Dzisiaj. Widżet pokazuje kalorie i trening; skróty otwierają posiłek i wagę.';const status=document.createElement('p');status.id='widget-status';status.setAttribute('role','status');const add=document.createElement('button');add.type='button';add.className='button-secondary';add.id='widget-add';add.textContent='Dodaj widżet na ekran główny';const refresh=document.createElement('button');refresh.type='button';refresh.className='button-secondary';refresh.id='widget-refresh';refresh.textContent='Odśwież dane widżetu';panel.append(heading,help,status,add,refresh);document.getElementById('route-ustawienia').append(panel);
 const training=createTrainingRepository(),goals=createGoalsStore();let tail=Promise.resolve(),revision=0,timer=null,last='',pendingAction=false;
 const queue=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
 async function sync(force=false){const token=++revision;return queue(async()=>{try{const info=await plugin.widgetStatus();add.hidden=!info.pinSupported;if(!info.count&&!force){status.textContent='Dodaj widżet z ekranu głównego. Przy pierwszym użyciu otwórz Bengera, aby uzupełnić dane.';return;}const [periods,state]=await Promise.all([goals.read(),training.snapshot()]);const data=buildWidgetSnapshot({entries:JSON.parse(localStorage.getItem(NUTRITION_STORAGE_KEY)??'[]'),goals:periods,training:state});if(!force&&token!==revision)return;const signature=JSON.stringify(data.days);if(force||signature!==last||info.date!==data.days[0].date){await plugin.updateWidgetSnapshot({snapshot:JSON.stringify(data)});last=signature;}status.textContent='Dane widżetu odświeżone. Android może opóźniać aktualizację w tle.';return true;}catch{last='';try{await plugin.clearWidgetSnapshot();}catch{/* Source data stay intact if the native bridge is unavailable. */}status.textContent='Nie udało się odświeżyć widżetu. Dziennik i pomiary pozostają bez zmian. Spróbuj ponownie.';return false;}});}
 async function action(){if(document.hidden){pendingAction=true;return;}pendingAction=false;try{const event=await plugin.consumeWidgetAction();if(await openWidgetAction(event.action,{training}))await sync(true);}catch{status.textContent='Nie udało się otworzyć skrótu widżetu. Otwórz odpowiednią sekcję aplikacji.';}}
 await plugin.addListener('widgetAction',()=>void action());
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{void sync();},150);};
 for(const name of ['benger:diary','benger:training','benger:goals','storage'])window.addEventListener(name,schedule);
 const resume=()=>{if(document.hidden)return;if(pendingAction)void action();void sync(true);};window.addEventListener('benger:native-resume',resume);document.addEventListener('visibilitychange',resume);
 refresh.onclick=()=>{refresh.disabled=true;void sync(true).finally(()=>{refresh.disabled=false;});};
 add.onclick=async()=>{add.disabled=true;try{if(!await sync(true))return;const result=await plugin.requestWidgetPin();status.textContent=result.requested?'Potwierdź dodanie widżetu na ekranie telefonu.':'Dodaj widżet przez ekran główny → Widżety → Benger.';}catch{status.textContent='Dodaj widżet przez ekran główny → Widżety → Benger.';}finally{add.disabled=false;}};
 await sync();await action();return {flush:async()=>{clearTimeout(timer);await sync();await tail;}};
}
