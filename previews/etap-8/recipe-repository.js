import { createProductStorage } from './product-cache.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
import { createRecipeDraft, validateRecipe } from './recipe-model.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
import { calculateRecipeNutrition } from './recipe-nutrition.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
import { recipeId } from './recipe-id.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
import { normalizeText } from './product-model.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
const stores=['recipes','recipeDrafts','recipeHistory'];
export function createRecipeRepository({storage=createProductStorage()}={}){
 async function read(name,key){if(storage.ready&&!await storage.ready())throw new Error('Pamięć przepisów jest niedostępna. Sprawdź uprawnienia przeglądarki.');return storage.read(name,key);}
 const decode=(row,draft=false)=>validateRecipe(row.recipe,{draft});
 return {
  async list(query=''){const q=normalizeText(query).slice(0,200);return (await read('recipes')).map(row=>decode(row)).filter(r=>normalizeText([r.name,...r.ingredients.map(i=>i.productName??i.query)].join(' ')).includes(q)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
  async drafts(){return (await read('recipeDrafts')).map(row=>decode(row,true)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
  async get(id){const row=await read('recipes',id);return row?decode(row):null;},
  async getDraft(id){const row=await read('recipeDrafts',id);return row?decode(row,true):null;},
  async saveDraft(input){const draft=validateRecipe({...input,status:'DRAFT',nutrition:calculateRecipeNutrition(input.ingredients,input.yield)},{draft:true});return storage.transact(['recipeDrafts'],state=>{const row=state.recipeDrafts.find(r=>r.key===draft.id);if(!row&&draft.revision!==0)throw new Error('Szkic został usunięty. Zmiany nie zostały nadpisane.');if(row&&row.recipe.revision!==draft.revision)throw new Error('Ten szkic zmienił się w innej karcie. Otwórz go ponownie przed dalszą edycją.');if(!row&&state.recipeDrafts.length>=100)throw new Error('Limit 100 szkiców. Usuń niepotrzebne.');if(!Number.isSafeInteger(draft.revision+1))throw new Error('Nie można zwiększyć wersji szkicu.');const saved={...draft,revision:draft.revision+1,updatedAt:new Date().toISOString()};state.recipeDrafts=state.recipeDrafts.filter(r=>r.key!==saved.id);state.recipeDrafts.push({key:saved.id,recipe:saved});return saved;});},
  async finish(input){const draft=validateRecipe(input,{draft:true});return storage.transact(stores,state=>{const persisted=state.recipeDrafts.find(r=>r.key===draft.id);if(!persisted||persisted.recipe.revision!==draft.revision)throw new Error('Szkic jest nieaktualny. Otwórz go ponownie.');const previous=state.recipes.find(r=>r.key===draft.recipeId)?.recipe;if(draft.recipeId&&(!previous||previous.version!==draft.baseVersion))throw new Error('Przepis ma nowszą wersję. Zachowaj ten szkic i porównaj zmiany.');if(!previous&&state.recipes.length>=1000)throw new Error('Limit 1000 przepisów.');const nutrition=calculateRecipeNutrition(draft.ingredients,draft.yield);const recipe=validateRecipe({...draft,id:previous?.id??draft.id,createdAt:previous?.createdAt??draft.createdAt,updatedAt:new Date().toISOString(),version:previous?previous.version+1:1,status:nutrition.complete?'READY':'INCOMPLETE',nutrition});if(previous)state.recipeHistory.push({key:`${previous.id}:v${previous.version}`,recipe:previous});state.recipeHistory=state.recipeHistory.slice(-2000);state.recipes=state.recipes.filter(r=>r.key!==recipe.id);state.recipes.push({key:recipe.id,recipe});state.recipeDrafts=state.recipeDrafts.filter(r=>r.key!==draft.id);return recipe;});},
  async edit(id){const recipe=await this.get(id);if(!recipe)throw new Error('Nie znaleziono przepisu.');return this.saveDraft({...recipe,id:recipeId(),status:'DRAFT',recipeId:recipe.id,baseVersion:recipe.version,revision:0});},
  async duplicate(id){const r=await this.get(id);if(!r)throw new Error('Nie znaleziono przepisu.');const draft=createRecipeDraft(('Kopia: '+r.name).slice(0,200));Object.assign(draft,{ingredients:r.ingredients.map(i=>({...i,id:recipeId()})),steps:r.steps.map(s=>({...s,id:recipeId()})),yield:{...r.yield},notes:r.notes});return this.finish(await this.saveDraft(draft));},
  async remove(id){await storage.transact(['recipes'],s=>{s.recipes=s.recipes.filter(r=>r.key!==id);});},
  async removeDraft(id){await storage.transact(['recipeDrafts'],s=>{s.recipeDrafts=s.recipeDrafts.filter(r=>r.key!==id);});},
  async history(id){return (await read('recipeHistory')).filter(r=>r.recipe.id===id).map(r=>decode(r)).sort((a,b)=>b.version-a.version);},
  close:storage.close,
 };
}
