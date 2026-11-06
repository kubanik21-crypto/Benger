import {EXERCISES} from './training-library.js';
import {dosage, validateExercise, validateTraining} from './training-model.js';
import {weekday} from './training-calendar.js';

export const NOVEMBER_PLAN_NAME = 'Listopad 2026 — Nogi + Core + Mobility';
export const NOVEMBER_PLAN_PREFIX = 'nov2026:';
const stamp = '2026-10-29T00:00:00.000Z';
const builtin = name => 'builtin:' + name;
const custom = name => 'custom:nov2026-' + name;
const tolerance = 'Jeżeli następnego ranka schylanie jest wyraźnie gorsze, zmniejszyć ciężar/zakres RDL albo tymczasowo usunąć ćwiczenie.';
const painNote = 'Ból pod łopatką pojawił się po ___ minutach. Wpisz czas w notatce po sesji.';
const oneSide = 'Na każdą stronę; wykonaj obie strony przed zaliczeniem serii.';

// Only movements missing from the current library become editable custom exercises.
// These are user-supplied plan descriptions, not generated Exercise Guides.
const extra = [
 ['pallof-press','Pallof press z gumą','bodyweight',0,['band'],oneSide],
 ['pallof-hold','Pallof hold z gumą','time',0,['band'],oneSide],
 ['supported-row','Chest-supported DB row','strength',2,['dumbbell','bench'],'Klatka oparta na ławce.'],
 ['supported-press','DB shoulder press z oparciem','strength',2,['dumbbell','bench'],'Plecy oparte na ławce.'],
 ['face-pull','Face pull z gumą','bodyweight',0,['band'],'Wymaga gumy i odpowiedniego mocowania.'],
 ['pull-apart','Band pull-apart','mobility',0,['band'],'Wymaga gumy.'],
 ['mob-face-pull','Face pull z gumą — mobility','mobility',0,['band'],'Lekko; wymaga gumy i odpowiedniego mocowania.'],
 ['sliders','Hamstring sliders','bodyweight',0,['bodyweight'],'Wymaga ślizgaczy lub ręcznika i odpowiedniego podłoża.'],
 ['supported-split','Supported split squat','bodyweight',0,['bodyweight'],oneSide+' Z podparciem.'],
 ['supported-lunge','Reverse lunge z podparciem','bodyweight',0,['bodyweight'],oneSide+' Z podparciem.'],
 ['single-thrust','Single-leg hip thrust','bodyweight',0,['bench'],oneSide],
 ['trx-lunge','TRX assisted reverse lunge','bodyweight',0,['trx'],oneSide],
 ['suitcase','Suitcase carry','time',0,['dumbbell'],oneSide+' Ciężar wpisz w notatce po treningu.'],
 ['farmer','Farmer carry','time',0,['dumbbell'],'Dwa hantle; ciężar wpisz w notatce po treningu.'],
 ['core-dead-bug','Dead bug — core','bodyweight',0,['bodyweight'],oneSide],
 ['core-bird-dog','Bird dog — core','bodyweight',0,['bodyweight'],oneSide+' Zatrzymanie 5 s.'],
 ['core-side-plank','Side plank — core','time',0,['bodyweight'],oneSide],
 ['knee-wall','Knee-to-wall','mobility',0,['bodyweight'],oneSide],
 ['lat-reach','Child’s pose lat reach','mobility',0,['bodyweight'],'Komfortowy zakres.'],
 ['hinge','Spokojny hip hinge bez obciążenia','mobility',0,['bodyweight'],'Kilka spokojnych ruchów, bez obciążenia.'],
 ['walk','Spacer','cardio',0,['bodyweight'],'Spokojny spacer; czas i dystans wpisz po wykonaniu.'],
 ['review','Podsumowanie listopada — własna ocena','mobility',0,['bodyweight'],'Przegląd notatek i wyników miesiąca. To nie jest trening siłowy.']
];
export function novemberExercises() {
 return extra.map(([key,name,mode,dumbbells,equipment,note]) => validateExercise({id:custom(key),name,mode,dumbbells,equipment,category:'Listopad 2026',note,defaults:{rest:0}}));
}
const item = (id,sets,repsMin=null,repsMax=repsMin,note='',duration=null) => ({exerciseId:id,dosage:dosage({sets,repsMin,repsMax,duration,rest:0,note})});
const b = (id,...args) => item(builtin(id),...args);
const c = (id,...args) => item(custom(id),...args);
const timed = (id,sets,low,high=low,note='') => item(id,sets,null,null,`${low}${high!==low?'–'+high:''} s. ${note}`.trim(),low);
const m = (id,sets,reps=null,note='',duration=null) => b('mob-'+id,sets,reps,reps,note,duration);
const rounds = items => [1,2].flatMap(round => items.map(i => ({...i,dosage:dosage({...i.dosage,sets:1,frequency:`Runda ${round} z 2`})})));
const warmup = () => [b('treadmill',1,null,null,'Rozgrzewka: 3–4 min.',180),m('cat-cow',1,6),m('mob-bridge',1,10),m('dead-bug',1,5,oneSide),m('90-90',1,6)];
const recovery = () => [m('cat-cow',1),m('open-book',1),m('90-90',1),m('hip-flexor',1),m('adductor',1),c('lat-reach',1),c('hinge',1)];

export function novemberPhase(date) {
 if(!/^2026-11-(?:0[1-9]|[12]\d|30)$/.test(date))throw new Error('Plan dotyczy wyłącznie listopada 2026.');
 const day=Number(date.slice(-2));
 if(day===30)return {key:'review',note:'Podsumowanie listopada, bez ciężkiego NOGI A.'};
 if(day===1)return {key:'intro',note:'Regeneracja + około 15 min Mobility.'};
 if(day<=8)return {key:'week1',note:'Tydzień 1: wejście w objętość, RPE około 6. Ostrożnie z RDL i Bulgarian split squat. Bez agresywnego dokładania ciężaru.'};
 if(day<=15)return {key:'week2',note:'Tydzień 2: najpierw zwiększaj powtórzenia (np. 4×8 → 4×9 → 4×10). Ciężar rozważ dopiero po osiągnięciu góry zakresu z zapasem.'};
 if(day<=22)return {key:'week3',note:'Tydzień 3: najmocniejszy tydzień. Po osiągnięciu góry zakresu z zapasem rozważ zwiększenie ciężaru. Maksymalne RPE 7–8; bez upadku.'};
 return {key:'deload',note:'Tydzień 4: deload, około 60–70% normalnej objętości. Trening wyraźnie łatwiejszy; bez dokładania ciężaru.'};
}
function workout(day) {
 if(day===0)return {name:'NOGI A + CORE A',items:[
  b('goblet',4,8,10,'Do ławki. RPE 6–7.'),b('bulgarian',3,8,8,oneSide+' RPE 6–7.'),b('step-up',3,8,8,oneSide+' RPE 6. Tylko stabilne podwyższenie przeznaczone do wchodzenia.'),b('hip-thrust',3,10,12,'RPE 7.'),b('calf',4,12,20,'RPE 7.'),
  c('core-dead-bug',3,6,6,oneSide),timed(custom('core-side-plank'),3,20,30,oneSide),c('pallof-press',3,8,8,oneSide)
 ]};
 if(day===2)return {name:'GÓRA + CORE B',items:[
  b('db-bench',3,6,10),b('pull-up',3,4,8,'Opcjonalnie z gumą; nie zapisuj jej jako dodatkowego ciężaru.'),c('supported-row',3,8,12),c('supported-press',3,8,10),b('lateral',2,12,15),c('face-pull',2,15,20),
  c('core-bird-dog',3,6,6,oneSide+' Zatrzymaj 5 s.'),timed(custom('suitcase'),3,30,45,oneSide),timed(custom('pallof-hold'),3,20,30,oneSide)
 ]};
 if(day===3)return {name:'NOGI B + CORE C',items:[
  b('hip-thrust',4,8,12),c('supported-lunge',3,8,8,oneSide),c('sliders',4,8,12),c('supported-split',3,10,10,oneSide),b('rdl',3,8,8,'2–3 serie; lekko z podwyższenia. Ćwiczenie tolerancji, nie rekordów. '+tolerance),b('calf',3,15,20),
  timed(builtin('plank'),3,30,45),c('core-dead-bug',2,8,8,oneSide),timed(custom('farmer'),3,40,60)
 ],note:tolerance};
 return {name:'NOGI C + CORE D',items:[
  b('bulgarian',3,10,10,oneSide),b('goblet',3,10,12),c('single-thrust',3,10,10,oneSide),c('trx-lunge',3,10,10,oneSide),c('sliders',3,12),timed(custom('farmer'),4,40,60),
  timed(custom('core-side-plank'),2,30,30,oneSide),c('pallof-press',3,10,10,oneSide),c('core-bird-dog',2,6,6,oneSide)
 ],note:'Opcjonalny finisher: podciąganie 2 serie + dipy ALBO pompki 2 serie. Dodaj z biblioteki tylko jeśli chcesz go wykonać; nie jest częścią obowiązkowej listy.'};
}

/** Produces ordinary templates and exact-date rules; never reads/writes user data. */
export function buildNovember2026() {
 const result={exercises:novemberExercises(),workoutTemplates:[],mobilityRoutines:[],rules:[]};
 function add(date,suffix,kind,title,items,note='') {
  const phase=novemberPhase(date),id=NOVEMBER_PLAN_PREFIX+date+':'+suffix;
  const template={id,kind,name:`${date.slice(8)}.11 · ${title}`,note:`${NOVEMBER_PLAN_NAME}\n${phase.note}\nBez treningu do upadku. ${note}`.trim(),items};
  if(kind==='workout'&&['week1','week2','week3','deload'].includes(phase.key))for(const i of items){
   if(phase.key==='deload'&&i.dosage.sets>1)i.dosage.sets=Math.max(1,Math.round(i.dosage.sets*2/3));
   if(['strength','bodyweight'].includes([...EXERCISES,...result.exercises].find(e=>e.id===i.exerciseId)?.mode))i.dosage.rest=90;
   if(phase.key==='week1')i.dosage.note+=' W tym tygodniu RPE około 6.';
   if(phase.key==='deload')i.dosage.note+=' Deload: łatwiej, bez forsowania.';
  }
  result[kind==='workout'?'workoutTemplates':'mobilityRoutines'].push(template);
  result.rules.push({id:id+':calendar',kind,templateId:id,title:template.name,startDate:date,time:null,recurrence:{type:'once',weekdays:[],until:null},note:template.note,createdAt:stamp,updatedAt:stamp});
 }
 for(let d=1;d<=30;d++) {
  const date=`2026-11-${String(d).padStart(2,'0')}`,day=weekday(date);
  if(d===30){add(date,'review','mobility','PODSUMOWANIE LISTOPADA',[c('review',1)],'W notatce po sesji zapisz: tolerancja schylania; reakcja lędźwi dzień po nogach; czas spaceru do bólu pod łopatką; stabilność Bulgarian i Goblet squat; siła core; najlepsze ciężary; samopoczucie; uwagi na kolejny blok.');continue;}
  if([0,2,3,5].includes(day)) {
   // Cardio warmup must be a workout item; Mobility items remain in their existing session type.
   const w=workout(day);
   add(date,'warmup','mobility','Rozgrzewka / Mobility',warmup().slice(1),'Przed siłowym: bieżnia 3–4 min (pierwsza pozycja treningu). W pozostałe dni siłowe krótka Mobility w komfortowym zakresie.');
   add(date,'strength','workout',w.name,[warmup()[0],...w.items],`RPE około 6–7, chyba że opis tygodnia wskazuje inaczej. ${w.note??''}`);
  } else if(day===1) {
   add(date,'mobility','mobility','Mobility + odcinek piersiowy',rounds([
    m('open-book',2,8,oneSide),m('90-90',2,8),m('adductor',2,8,oneSide),m('hip-flexor',2,null,'30–40 s/strona, z reach. '+oneSide,30),c('knee-wall',2,10,10,oneSide),m('wall-slides',2,10),c('pull-apart',2,15),c('mob-face-pull',2,15)
   ]),'Dwie rundy całego zestawu. Po zaliczeniu ruchu przechodzisz do następnego; druga runda jest już ułożona w kolejności.');
   add(date,'cardio','workout','Lekkie cardio',[b('treadmill',1,null,null,'20–30 min; lekko szybszy marsz lub nachylenie 3–5%.',1200)],painNote);
  } else if(day===4) {
   add(date,'mobility','mobility','Recovery Mobility',recovery(),'15–20 min spokojnej Mobility.');
   add(date,'walk','workout','Spacer / test tolerancji',[c('walk',1,null,null,'15–25 min spokojnego spaceru.',900)],painNote);
  } else add(date,'recovery','mobility','Regeneracja + Mobility',recovery(),'Około 15 min Mobility; normalny ruch w ciągu dnia. Opcjonalne spokojne cardio tylko przy dobrej regeneracji. To nie jest obowiązkowy trening siłowy.');
 }
 return result;
}

export function hasNovember2026(state) {
 return [...state.workoutTemplates,...state.mobilityRoutines,...(state.schedule?.rules??[])].some(row=>row.id.startsWith(NOVEMBER_PLAN_PREFIX));
}

/** One-time additive install. A retry cannot resurrect deleted dates or overwrite edits. */
export function installNovember2026(state) {
 if(hasNovember2026(state))throw new Error('Plan listopadowy jest już dodany. Edytuj zapisane sesje w zakładce Plan lub w Kalendarzu.');
 const preset=buildNovember2026();
 if(preset.exercises.some(e=>state.exercises.some(old=>old.id===e.id)))throw new Error('Istnieje już ćwiczenie planu listopadowego. Niczego nie nadpisano.');
 return validateTraining({...state,exercises:[...state.exercises,...preset.exercises],workoutTemplates:[...state.workoutTemplates,...preset.workoutTemplates],mobilityRoutines:[...state.mobilityRoutines,...preset.mobilityRoutines],schedule:{rules:[...(state.schedule?.rules??[]),...preset.rules],exceptions:state.schedule?.exceptions??[]}});
}
