import { recipeId } from './recipe-id.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
import { calculateRecipeNutrition } from './recipe-nutrition.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
import { copyPortionSnapshot, validPortionSnapshot, HOUSEHOLD_UNITS } from './portion-model.js?v=b98f657a88540d02b511d24f17f335a1f3b979f0';
export const RECIPE_LIMITS={ingredients:200,steps:300,events:300,recipes:1000,drafts:100,history:2000};
export const isUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const positive=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=max;
const fail=()=>{throw new TypeError('Nieprawidłowe dane przepisu.');};
function safe(value,depth=0){if(depth>25)fail();if(!value||typeof value!=='object')return;for(const k of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(k))fail();safe(value[k],depth+1);}}
const unique=rows=>new Set(rows.map(row=>row.id)).size===rows.length;
const macros=n=>n&&['kcal','protein','fat','carbs'].every(k=>typeof n[k]==='number'&&Number.isFinite(n[k])&&n[k]>=0&&n[k]<=1e10);
export function validateRecipe(value,{draft=false}={}){
 safe(value);if(!value||!isUuid(value.id)||!text(value.name,200,true)||!timestamp(value.createdAt)||!timestamp(value.updatedAt)||!Number.isSafeInteger(value.version)||value.version<1||value.version>1e6||!text(value.notes,5000))fail();
 if(!Array.isArray(value.ingredients)||value.ingredients.length>200||!Array.isArray(value.steps)||value.steps.length>300||!Array.isArray(value.events??[])||(value.events??[]).length>300)fail();
 const ingredients=value.ingredients.map(i=>{
  if(!i||!isUuid(i.id)||!text(i.originalText,1000)||!text(i.query??'',240)||!['RESOLVED','UNRESOLVED'].includes(i.resolutionStatus)||typeof i.excludedFromNutrition!=='boolean')fail();
  const result={id:i.id,originalText:i.originalText,query:i.query??'',resolutionStatus:i.resolutionStatus,excludedFromNutrition:i.excludedFromNutrition};
  if(i.resolutionStatus==='RESOLVED'){
   if(!text(i.productId,240,true)||!text(i.productName,240,true)||!positive(i.amount,1e7)||!['g','ml'].includes(i.unit)||!macros(i.nutrition)||!validPortionSnapshot(i))fail();
   Object.assign(result,{productId:i.productId,productName:i.productName,amount:i.amount,unit:i.unit,nutrition:Object.fromEntries(['kcal','protein','fat','carbs'].map(k=>[k,i.nutrition[k]])),...copyPortionSnapshot(i)});
   for(const key of ['brand','source','sourceId','barcode']){if(i[key]!==undefined&&i[key]!==null&&!text(i[key],240))fail();result[key]=i[key]??null;}
  }else{
   if(i.amount!==null&&!positive(i.amount,100000))fail();if(i.unit!==null&&!['g','ml',...Object.keys(HOUSEHOLD_UNITS)].includes(i.unit))fail();Object.assign(result,{amount:i.amount,unit:i.unit,productId:null,productName:null,nutrition:null});
  }return result;
 });
 const steps=value.steps.map((s,index)=>{if(!s||!isUuid(s.id)||!text(s.text,1000,true)||!timestamp(s.createdAt)||s.order!==index)fail();return {id:s.id,text:s.text,createdAt:s.createdAt,order:index};});
 const events=(value.events??[]).map(e=>{if(!e||!isUuid(e.id)||!text(e.raw,2000)||!timestamp(e.createdAt)||!['INGREDIENT','STEP','INGREDIENT_AND_STEP','YIELD','NAME','NOTE','UNKNOWN','MANUAL'].includes(e.type))fail();return {id:e.id,raw:e.raw,type:e.type,createdAt:e.createdAt};});
 if(!unique(ingredients)||!unique(steps)||!unique(events))fail();
 const yieldInfo={};if(!value.yield||typeof value.yield!=='object'||Array.isArray(value.yield))fail();for(const key of Object.keys(value.yield)){if(!['servings','finalWeight','finalVolume'].includes(key)||!positive(value.yield[key],key==='servings'?10000:1e7))fail();yieldInfo[key]=value.yield[key];}
 const nutrition=calculateRecipeNutrition(ingredients,yieldInfo);
 const status=draft?'DRAFT':nutrition.complete?'READY':'INCOMPLETE';
 if(value.status!==status)fail();
 if(!draft){const actual=value.nutrition;if(!actual||actual.complete!==nutrition.complete||actual.unresolvedCount!==nutrition.unresolvedCount)fail();for(const key of ['knownTotal','total','perServing','per100g','per100ml']){if(nutrition[key]===null){if(actual[key]!==null)fail();}else if(!actual[key]||!['kcal','protein','fat','carbs'].every(k=>Number.isFinite(actual[key][k])&&actual[key][k]===nutrition[key][k]))fail();}}
 const result={id:value.id,name:value.name,createdAt:value.createdAt,updatedAt:value.updatedAt,status,ingredients,steps,yield:yieldInfo,nutrition,notes:value.notes,version:value.version,events};
 if(draft){if(value.recipeId===null&&value.baseVersion!==0||value.recipeId!==null&&(!isUuid(value.recipeId)||value.baseVersion<1)||!Number.isSafeInteger(value.baseVersion)||value.baseVersion<0||!Number.isSafeInteger(value.revision)||value.revision<0)fail();Object.assign(result,{recipeId:value.recipeId,baseVersion:value.baseVersion,revision:value.revision});}
 return result;
}
export function createRecipeDraft(name='Nowy przepis'){
 const now=new Date().toISOString();return {id:recipeId(),name,createdAt:now,updatedAt:now,status:'DRAFT',ingredients:[],steps:[],yield:{},nutrition:calculateRecipeNutrition([]),notes:'',version:1,events:[],recipeId:null,baseVersion:0,revision:0};
}
export function ingredientFromPortion(portion,originalText=''){
 const p=portion.product;return {id:recipeId(),originalText,query:p.name,productId:p.id,productName:p.name,brand:p.brand,source:p.source,sourceId:p.sourceId,barcode:p.barcode,amount:portion.amount,unit:p.unit,nutrition:{...portion.nutrition},resolutionStatus:'RESOLVED',excludedFromNutrition:false,...copyPortionSnapshot({productId:p.id,amount:portion.amount,unit:p.unit,displayPortion:portion.displayPortion,portionConversion:portion.portionConversion})};
}
