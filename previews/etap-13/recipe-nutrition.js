import { sumNutrition } from './nutrition.js?v=14a1afe0610a1577e79c4b611da805c03caeca0d';
export function calculateRecipeNutrition(ingredients,yieldInfo={}){
 const included=ingredients.filter(i=>!i.excludedFromNutrition),unresolvedCount=included.filter(i=>i.resolutionStatus!=='RESOLVED').length;
 const knownTotal=sumNutrition(included.filter(i=>i.resolutionStatus==='RESOLVED').map(i=>i.nutrition));
 const complete=ingredients.length>0&&unresolvedCount===0;
 const scale=divisor=>{if(!(complete&&typeof divisor==='number'&&Number.isFinite(divisor)&&divisor>0))return null;const result=Object.fromEntries(Object.entries(knownTotal).map(([key,value])=>[key,value/divisor]));if(Object.values(result).some(n=>!Number.isFinite(n)))throw new TypeError('Wydajność jest zbyt mała, aby obliczyć wartości.');return result;};
 return {complete,unresolvedCount,knownTotal,total:complete?{...knownTotal}:null,perServing:scale(yieldInfo.servings),per100g:scale(yieldInfo.finalWeight?yieldInfo.finalWeight/100:null),per100ml:scale(yieldInfo.finalVolume?yieldInfo.finalVolume/100:null)};
}
