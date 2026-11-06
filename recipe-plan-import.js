import {RECIPE_PLAN,RECIPE_PLAN_ID,RECIPE_PLAN_LABEL} from './recipe-plan-2026-data.js';
import {createProductResolver} from './product-resolver.js';
import {validateRecipe,ingredientFromPortion} from './recipe-model.js';
import {calculateRecipeNutrition} from './recipe-nutrition.js';
import {loadItemPortions} from './meal-resolution.js';

export async function prepareRecipePlan({repository,resolver=createProductResolver({repository}),now=new Date().toISOString()}={}){
 const recipes=[],report=[];const identities=new Map();
 for(const source of RECIPE_PLAN){
  const ingredients=[];
  for(const input of source.ingredients){
   const query=input.query+(input.quantityText.includes('suchy')?' suchy':'');
   let match;try{if(!identities.has(query))identities.set(query,await resolver.resolveProductQuery(query,{allowExternal:false}));match=identities.get(query);}catch(error){throw new Error('Nie można odczytać katalogu produktów. Paczka nie została zapisana.',{cause:error});}
   const product=match.bestMatch,confirmed=Boolean(product&&match.resolution.identityConfirmed);
   // Alternatives, food preparation, egg size and g/ml are never guessed by an import.
   const status=confirmed?'matched':match.candidates.length?'ambiguous':'unmatched';
   let ingredient={id:input.id,originalText:`${input.query} — ${input.quantityText}`,query:input.query,amount:input.amount,unit:input.unit,resolutionStatus:'UNRESOLVED',excludedFromNutrition:false,productId:null,productName:null,nutrition:null};
   if(confirmed&&input.amount!==null&&['g','ml'].includes(input.unit)&&input.unit===product.unit){
    const item=await loadItemPortions({intent:{query:input.query,amount:input.amount,unit:input.unit},resolution:match.resolution},repository);
    if(item.portion)ingredient={...ingredientFromPortion(item.portion,ingredient.originalText),id:input.id,query:input.query};
   }
   ingredient.quantityText=input.quantityText;
   ingredient.catalogMatch={status,productId:confirmed?product.id:null,productName:confirmed?product.name:null};
   ingredients.push(ingredient);
   report.push({recipeKey:source.key,query:input.query,status,productId:confirmed?product.id:null,productName:confirmed?product.name:null,quantityText:input.quantityText,nutritionReady:ingredient.resolutionStatus==='RESOLVED'});
  }
  const nutrition=calculateRecipeNutrition(ingredients,source.servings?{servings:source.servings}:{});
  recipes.push(validateRecipe({id:source.id,name:source.name,version:1,createdAt:now,updatedAt:now,notes:[RECIPE_PLAN_LABEL,source.notes,'Niejasne produkty i ilości uzupełnij przed dodaniem do dziennika. Przyprawy można pominąć w obliczeniach wyłącznie świadomie.'].filter(Boolean).join('\n'),ingredients,steps:source.steps.map((s,order)=>({...s,order,createdAt:now})),yield:source.servings?{servings:source.servings}:{},nutrition,status:nutrition.complete?'READY':'INCOMPLETE',events:[],pack:{id:RECIPE_PLAN_ID,recipeId:source.key,label:RECIPE_PLAN_LABEL,meal:source.meal}}));
 }
 return {recipes,report};
}
export async function importRecipePlan({recipes,repository,resolver}={}){
 const prepared=await prepareRecipePlan({repository,resolver});
 const result=await recipes.importRecipes(prepared.recipes);
 return {...result,report:prepared.report};
}
