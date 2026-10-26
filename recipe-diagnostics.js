import{recipePortionModes}from'./recipe-portion-resolver.js';
import{NUTRITION_STORAGE_KEY}from'./app-storage.js';
import { createProductRepository } from './product-repository.js';
import { createProductResolver } from './product-resolver.js';
import { createRecipeRepository } from './recipe-repository.js';
import { createRecipeDraft } from './recipe-model.js';
import { analyzeCookingEvent, applyCookingEvent } from './recipe-session.js';
import { createSpeechRecognitionAdapter } from './speech-recognition.js';
import { STORAGE_NAMESPACE } from './app-storage.js';
const $=id=>document.getElementById(id),show=(id,value)=>{$(id).textContent=JSON.stringify(value,null,2);};
if($('recipe-lab-raw')){const repository=createProductRepository(),resolver=createProductResolver({repository});let draft=createRecipeDraft('Przepis laboratorium'),pending=null;
 async function analyze(){try{pending=await analyzeCookingEvent($('recipe-lab-raw').value,{repository,resolver,knownIngredients:draft.ingredients});show('recipe-lab-report',{raw:pending.event.raw,normalized:pending.event.normalized,type:pending.event.type,ingredientIntents:pending.event.intents,steps:pending.event.steps,yield:pending.event.yield,productAndPortionResolution:pending.proposal.items});$('recipe-lab-status').textContent='Analiza gotowa. Sprawdź przed zaakceptowaniem.';}catch(e){$('recipe-lab-status').textContent=e.message;}}
 $('recipe-lab-analyze').onclick=()=>void analyze();$('recipe-lab-accept').onclick=()=>{try{if(!pending)return;draft=applyCookingEvent(draft,pending);pending=null;show('recipe-lab-draft',draft);}catch(e){$('recipe-lab-status').textContent=e.message;}};
 const speech=createSpeechRecognitionAdapter({onState({state,message}){$('recipe-lab-status').textContent=message;$('recipe-lab-mic').textContent=state==='listening'?'Zakończ':'Powiedz składnik lub krok';},onTranscript({text}){$('recipe-lab-raw').value=text;},onComplete(text){$('recipe-lab-raw').value=text;void analyze();}});$('recipe-lab-mic').disabled=!speech.supported;$('recipe-lab-mic').onclick=()=>speech.getState()==='listening'?speech.stop():speech.start();window.addEventListener('pagehide',()=>speech.abort());show('recipe-lab-draft',draft);
}
if($('recipe-diagnostics-run'))$('recipe-diagnostics-run').onclick=async()=>{const r=createRecipeRepository();try{const recipes=await r.list(),drafts=await r.drafts();show('recipe-diagnostics-report',{namespace:STORAGE_NAMESPACE||'production',databases:await indexedDB.databases(),recipes:recipes.length,drafts:drafts.length,preferences:await r.preferences(),diaryReferences:JSON.parse(localStorage.getItem(NUTRITION_STORAGE_KEY)??'[]').filter(e=>e.kind==='RECIPE'),portionModes:recipes.map(r=>({id:r.id,version:r.version,modes:recipePortionModes(r)})),versions:await Promise.all(recipes.map(async recipe=>({id:recipe.id,version:recipe.version,history:(await r.history(recipe.id)).length}))),statuses:recipes.map(r=>({name:r.name,status:r.status,nutritionComplete:r.nutrition.complete}))});}catch(e){show('recipe-diagnostics-report',{error:e.message});}finally{await r.close();}};
document.documentElement.dataset.diagnosticsReady='true';
