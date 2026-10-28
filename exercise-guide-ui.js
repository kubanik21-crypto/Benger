import {EXERCISE_GUIDES} from './exercise-guides.js?v=448eca0f48fddfb95c9fc7cebc13e5ff58754feb';
import {renderExerciseVisuals} from './exercise-visuals.js?v=448eca0f48fddfb95c9fc7cebc13e5ff58754feb';
import {EQUIPMENT} from './training-library.js?v=448eca0f48fddfb95c9fc7cebc13e5ff58754feb';
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function createExerciseGuide(){
 const dialog=el('dialog');dialog.id='exercise-guide';dialog.className='exercise-guide';dialog.setAttribute('aria-labelledby','exercise-guide-title');document.body.append(dialog);let trigger=null,scroll=null,restoreFocus=true;
 function close(){dialog.close();}
 dialog.addEventListener('close',()=>{if(restoreFocus&&trigger?.isConnected&&trigger.getClientRects().length){trigger.focus({preventScroll:true});if(scroll)window.scrollTo(scroll.x,scroll.y);}else if(restoreFocus){const heading=document.querySelector('[data-current-exercise]');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}trigger=null;scroll=null;});
 window.addEventListener('benger:route',()=>{if(dialog.open){restoreFocus=false;close();}});window.addEventListener('pagehide',()=>{if(dialog.open){restoreFocus=false;close();}});
 function open(exercise,{dosage=null,prescription='',opener=document.activeElement}={}){
  restoreFocus=true;trigger=opener;scroll={x:window.scrollX,y:window.scrollY};dialog.replaceChildren();const header=el('header'),title=el('h2',exercise.name);title.id='exercise-guide-title';const dismiss=el('button','Zamknij instrukcję');dismiss.type='button';dismiss.id='close-exercise-guide';dismiss.className='button-secondary';dismiss.onclick=close;header.append(title,dismiss);dialog.append(header);
  const labels={strength:'Powtórzenia z obciążeniem',bodyweight:'Powtórzenia z masą ciała',time:'Utrzymanie pozycji na czas',cardio:'Czas i dystans',mobility:'Ruch / utrzymanie według Twojego planu'};
  dialog.append(el('p',exercise.equipment.map(k=>EQUIPMENT[k]??k).join(' · ')),el('p',labels[exercise.mode]??'Według Twojego planu'));if(prescription)dialog.append(el('p','Twój plan: '+prescription));
  const guide=EXERCISE_GUIDES[exercise.id];if(guide){dialog.append(renderExerciseVisuals(guide.visualKey,exercise.name,{dumbbells:exercise.dumbbells}),el('p','Schemat pomaga zrozumieć ruch; nie przedstawia dokładnej anatomii ani indywidualnie dobranego zakresu.'));
   for(const[key,name]of [['setup','Ustawienie'],['execution','Wykonanie'],['cues','Zwróć uwagę'],['mistakes','Typowe błędy']]){const section=el('section'),list=el(key==='execution'?'ol':'ul');section.append(el('h3',name));for(const text of guide[key])list.append(el('li',text));section.append(list);dialog.append(section);}dialog.append(el('h3','Oddech'),el('p',guide.breathing));
  }else{dialog.append(el('p','To ćwiczenie nie ma wbudowanej instrukcji Bengera.'));}
  const notes=[...new Set([...(guide?[]:[exercise.note]),dosage?.note,dosage?.physioNote].filter(v=>typeof v==='string'&&v.length>0))];if(notes.length){const section=el('section');section.className='exercise-user-note';section.append(el('h3','Twoja notatka'));for(const text of notes){const p=el('p',text);p.className='verbatim-note';section.append(p);}dialog.append(section);}
  dialog.append(el('p','Wykonuj ruch w komfortowym zakresie. Przerwij, jeśli powoduje ostry lub narastający ból. Instrukcja nie zastępuje indywidualnej porady trenerskiej lub medycznej.'));dialog.showModal();dialog.scrollTop=0;dismiss.focus({preventScroll:true});
 }
 function button(exercise,context={},label='Instrukcja'){const b=el('button',label);b.type='button';b.className='button-secondary';b.dataset.guideExercise=exercise.id;b.setAttribute('aria-haspopup','dialog');b.onclick=()=>open(exercise,{...context,opener:b});return b;}
 return {open,button};
}
