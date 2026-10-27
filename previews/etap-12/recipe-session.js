import { understandRecipe } from './recipe-understanding.js?v=da43694aa0e945596b60a6c60b611939356d178b';
import { resolveMealIntents } from './meal-resolution.js?v=da43694aa0e945596b60a6c60b611939356d178b';
import { ingredientFromPortion, validateRecipe } from './recipe-model.js?v=da43694aa0e945596b60a6c60b611939356d178b';
import { recipeId } from './recipe-id.js?v=da43694aa0e945596b60a6c60b611939356d178b';
import { calculateRecipeNutrition } from './recipe-nutrition.js?v=da43694aa0e945596b60a6c60b611939356d178b';
export async function analyzeCookingEvent(raw,{repository,resolver,type,knownIngredients=[],signal}={}){
 const event=understandRecipe(raw,{type,knownIngredients});
 const proposal=await resolveMealIntents(event.intents,{repository,resolver,allowExternal:true,signal});
 return {event,proposal};
}
export function applyCookingEvent(draft,{event,proposal}){
 const next=structuredClone(draft),now=new Date().toISOString();
 if(['INGREDIENT','INGREDIENT_AND_STEP'].includes(event.type))for(const item of proposal.items){
  const ingredient=item.portion?{...ingredientFromPortion(item.portion,event.raw.slice(0,1000)),query:item.intent.query}:{id:recipeId(),originalText:event.raw.slice(0,1000),query:item.intent.query,amount:item.intent.amount??null,unit:item.intent.unit??null,productId:null,productName:null,nutrition:null,resolutionStatus:'UNRESOLVED',excludedFromNutrition:false};
  next.ingredients.push(ingredient);
 }
 if(['STEP','INGREDIENT_AND_STEP'].includes(event.type))for(const text of event.steps)next.steps.push({id:recipeId(),text,createdAt:now,order:next.steps.length});
 if(event.type==='NAME')next.name=event.name;
 if(event.type==='YIELD'){if(!Object.keys(event.yield).length)throw new Error('Nie rozpoznano wydajności. Wpisz ją w polach poniżej.');next.yield={...next.yield,...event.yield};}
 if(['NOTE','UNKNOWN'].includes(event.type))next.notes=[next.notes,event.notes].filter(Boolean).join('\n');
 next.events.push({id:recipeId(),raw:event.raw,type:event.type,createdAt:now});next.updatedAt=now;next.nutrition=calculateRecipeNutrition(next.ingredients,next.yield);
 return validateRecipe(next,{draft:true});
}
