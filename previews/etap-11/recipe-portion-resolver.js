import { validateRecipe } from './recipe-model.js?v=e5e2683694aa22c2d2bf65ce0625b1d2de834970';
const fields={serving:'servings',g:'finalWeight',ml:'finalVolume'};
export function recipePortionModes(recipe){return Object.keys(fields).filter(unit=>Number.isFinite(recipe.yield?.[fields[unit]])&&recipe.yield[fields[unit]]>0);}
export function resolveRecipePortion(recipe,amount,unit){
 const unresolved=reason=>({kind:'RECIPE',recipe:null,confidence:'LOW',reason,portion:null});
 try{recipe=validateRecipe(recipe);}catch{return unresolved('Nieprawidłowe dane przepisu.');}
 if(recipe.status!=='READY'||!recipe.nutrition.complete)return unresolved('Ten przepis ma niekompletne wartości. Uzupełnij składniki przed dodaniem do dziennika.');
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>1e7)return unresolved('Podaj dodatnią ilość do 10 000 000.');
 if(!Object.hasOwn(fields,unit)||!recipePortionModes(recipe).includes(unit))return unresolved('Przepis nie ma wydajności dla tej jednostki. Uzupełnij ją w przepisie.');
 const factor=amount/recipe.yield[fields[unit]],nutrition=Object.fromEntries(Object.entries(recipe.nutrition.total).map(([key,value])=>[key,value*factor]));
 if(Object.values(nutrition).some(n=>!Number.isFinite(n)||n<0||n>1e10))return unresolved('Wartości porcji są zbyt duże.');
 const portion={kind:'RECIPE',recipeId:recipe.id,recipeVersion:recipe.version,recipeName:recipe.name,recipeYieldSnapshot:{...recipe.yield},amount,unit,nutrition};
 return {kind:'RECIPE',recipe,confidence:'HIGH',reason:'recipe-yield',portion};
}
