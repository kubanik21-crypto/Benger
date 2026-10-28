import {validateRecipe} from './recipe-model.js?v=4ec45dff6c12283d10ab94890f11e8bac8c5eb07';
// Pure manual operations, shared by UI and tests. No language model or network.
export function reorderRecipeStep(draft,id,direction){
 if(![-1,1].includes(direction))throw new TypeError('Nieprawidłowy kierunek.');
 const next=structuredClone(draft),index=next.steps.findIndex(s=>s.id===id),target=index+direction;
 if(index<0)throw new Error('Krok nie istnieje.');
 if(target<0||target>=next.steps.length)return next;
 [next.steps[index],next.steps[target]]=[next.steps[target],next.steps[index]];
 next.steps.forEach((s,order)=>s.order=order);return validateRecipe(next,{draft:true});
}
export function updateStepMeasure(draft,id,key,raw){
 if(!['durationMinutes','temperatureC'].includes(key))throw new TypeError('Nieprawidłowe pole.');
 const next=structuredClone(draft),step=next.steps.find(s=>s.id===id);if(!step)throw new Error('Krok nie istnieje.');
 const text=String(raw).trim();if(!text){delete step[key];return next;}
 if(!/^\d+(?:[.,]\d+)?$/.test(text))throw new Error('Wpisz prawidłową liczbę.');
 const value=Number(text.replace(',','.'));
 if(!Number.isFinite(value)||value<(key==='temperatureC'?0:Number.MIN_VALUE)||value>(key==='temperatureC'?350:10080))throw new Error(key==='temperatureC'?'Podaj temperaturę od 0 do 350°C.':'Podaj dodatni czas do 10 080 minut.');
 step[key]=value;return validateRecipe(next,{draft:true});
}
