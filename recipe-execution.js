import {scaleNutrition} from './nutrition.js';
import {validateRecipe,isUuid,scaleRecipeIngredient} from './recipe-model.js';
import {calculateRecipeNutrition} from './recipe-nutrition.js';
import {recipePortionModes} from './recipe-portion-resolver.js';
import {recipeId} from './recipe-id.js';
const clone=value=>structuredClone(value);
const fail=()=>{throw new Error('Nieprawidłowe zmiany przepisu.');};
export function recipeWithIngredients(base,ingredients){
 if(!Array.isArray(ingredients)||ingredients.length>200)fail();const nutrition=calculateRecipeNutrition(ingredients,base.yield);
 return validateRecipe({...base,ingredients,nutrition,status:nutrition.complete?'READY':'INCOMPLETE'});
}
export function resizeIngredient(ingredient,amount){
 if(!Number.isFinite(amount)||amount<=0||amount>1e7||ingredient.resolutionStatus!=='RESOLVED')fail();
 const result={...clone(ingredient),amount,nutrition:scaleNutrition(ingredient.nutrition,amount/ingredient.amount)};
 // Explicit quantities supersede a previous household estimate.
 delete result.displayPortion;delete result.portionConversion;delete result.estimated;return result;
}
export function ingredientOverrides(base,ingredients){
 const old=new Map(base.ingredients.map(i=>[i.id,i])),next=new Map(ingredients.map(i=>[i.id,i]));const changes=[];
 for(const i of base.ingredients)if(!next.has(i.id))changes.push({type:'REMOVE',ingredientId:i.id});
 for(const i of ingredients){const previous=old.get(i.id);if(!previous)changes.push({type:'ADD',ingredient:clone(i)});
 else if(previous.resolutionStatus==='RESOLVED'&&i.resolutionStatus==='RESOLVED'&&previous.productId===i.productId&&previous.unit===i.unit&&JSON.stringify(resizeIngredient(previous,i.amount))===JSON.stringify(i)){
 if(previous.amount!==i.amount)changes.push({type:'UPDATE_AMOUNT',ingredientId:i.id,amount:i.amount});
 }else if(JSON.stringify(previous)!==JSON.stringify(i))changes.push({type:'REPLACE',ingredientId:i.id,ingredient:clone(i)});}
 return changes;
}
export function applyIngredientOverrides(base,overrides){
 if(!Array.isArray(overrides)||overrides.length>400)fail();let ingredients=clone(base.ingredients);const touched=new Set();
 for(const op of overrides){if(!op||!['UPDATE_AMOUNT','REMOVE','REPLACE','ADD'].includes(op.type))fail();
 const id=op.type==='ADD'?op.ingredient?.id:op.ingredientId;if(!isUuid(id)||touched.has(id))fail();touched.add(id);const index=ingredients.findIndex(i=>i.id===id);
 if(op.type==='ADD'){if(index>=0)fail();ingredients.push(clone(op.ingredient));}
 else{if(index<0)fail();if(op.type==='REMOVE')ingredients.splice(index,1);else if(op.type==='UPDATE_AMOUNT')ingredients[index]=resizeIngredient(ingredients[index],op.amount);else{if(op.ingredient?.id!==id)fail();ingredients[index]=clone(op.ingredient);}}
 }return recipeWithIngredients(base,ingredients);
}
export function validateRecipeVariant(value){
 if(!value||!isUuid(value.id)||!isUuid(value.baseRecipeId)||!Number.isSafeInteger(value.baseVersion)||value.baseVersion<1||value.baseVersion>1e6||typeof value.name!=='string'||!value.name.trim()||value.name.length>200||!Array.isArray(value.overrides)||value.overrides.length>400)fail();
 for(const key of ['createdAt','updatedAt'])if(typeof value[key]!=='string'||!Number.isFinite(Date.parse(value[key]))||new Date(value[key]).toISOString()!==value[key])fail();
 // Validate operations against the pinned base at repository/backup boundaries.
 return {id:value.id,baseRecipeId:value.baseRecipeId,baseVersion:value.baseVersion,name:value.name,overrides:clone(value.overrides),createdAt:value.createdAt,updatedAt:value.updatedAt};
}
export function applyRecipeVariant(base,variant){variant=validateRecipeVariant(variant);if(base.id!==variant.baseRecipeId||base.version!==variant.baseVersion)throw new Error('Baza przepisu zmieniła się. Sprawdź i zapisz wariant ponownie przed użyciem.');return applyIngredientOverrides(base,variant.overrides);}

export function executionScale(base,amount,unit){const key={serving:'servings',g:'finalWeight',ml:'finalVolume'}[unit];if(!Number.isFinite(amount)||amount<=0||amount>1e7||!recipePortionModes(base).includes(unit))throw new Error('Podaj ilość i jednostkę zgodną z wydajnością przepisu.');return amount/base.yield[key];}
export function scaleExecutionIngredient(ingredient,factor){const result=scaleRecipeIngredient(ingredient,factor);if(ingredient.resolutionStatus!=='RESOLVED'&&ingredient.amount!==null)result.amount=ingredient.amount*factor;return result;}
export function createRecipeExecution(recipe,amount,unit,variant=null){
 const base=validateRecipe(recipe),effective=variant?applyRecipeVariant(base,variant):base,factor=executionScale(effective,amount,unit);
 return {base,variantId:variant?.id??null,variantName:variant?.name??null,amount,unit,ingredients:effective.ingredients.map(i=>scaleExecutionIngredient(i,factor))};
}
export function executionPortion(execution){
 const {base,amount,unit,variantId,variantName}=execution;
 const ingredients=recipeWithIngredients(base,execution.ingredients).ingredients,n=calculateRecipeNutrition(ingredients);
 if(!n.complete)throw new Error('Uzupełnij składniki przed dodaniem do dziennika.');if(Object.values(n.total).some(value=>!Number.isFinite(value)||value<0||value>1e10))throw new Error('Wartości porcji są zbyt duże.');
 executionScale(base,amount,unit);
 const mealSnapshot={version:1,ingredients:clone(ingredients),consumedServings:unit==='serving'?amount:base.yield.servings?amount/base.yield[{g:'finalWeight',ml:'finalVolume'}[unit]]*base.yield.servings:null,variantId,variantName};
 return {kind:'RECIPE',recipeId:base.id,recipeVersion:base.version,recipeName:base.name,recipeYieldSnapshot:{...base.yield},amount,unit,nutrition:clone(n.total),mealSnapshot};
}
export function executionAsRecipe(execution){
 const factor=execution.amount/execution.base.yield[{serving:'servings',g:'finalWeight',ml:'finalVolume'}[execution.unit]];
 return recipeWithIngredients(execution.base,execution.ingredients.map(i=>scaleExecutionIngredient(i,1/factor)));
}
export function newRecipeVariant(execution,name){const now=new Date().toISOString(),edited=executionAsRecipe(execution);return validateRecipeVariant({id:recipeId(),baseRecipeId:execution.base.id,baseVersion:execution.base.version,name,overrides:ingredientOverrides(execution.base,edited.ingredients),createdAt:now,updatedAt:now});}
export function validateMealSnapshot(snapshot,row){
 if(!snapshot||snapshot.version!==1||snapshot.variantId!==null&&!isUuid(snapshot.variantId)||snapshot.variantName!==null&&(typeof snapshot.variantName!=='string'||snapshot.variantName.length>200)||snapshot.consumedServings!==null&&(!Number.isFinite(snapshot.consumedServings)||snapshot.consumedServings<=0||snapshot.consumedServings>1e7))fail();
 const now='2026-01-01T00:00:00.000Z';const recipe=recipeWithIngredients({id:row.recipeId,name:row.recipeName,createdAt:now,updatedAt:now,version:row.recipeVersion,notes:'',yield:{},steps:[],events:[]},snapshot.ingredients);
 if(!recipe.nutrition.complete||!['kcal','protein','fat','carbs'].every(k=>Math.abs(recipe.nutrition.total[k]-row.nutrition[k])<=1e-7*Math.max(1,row.nutrition[k])))fail();
 return {version:1,ingredients:recipe.ingredients,variantId:snapshot.variantId,variantName:snapshot.variantName,consumedServings:snapshot.consumedServings};
}
