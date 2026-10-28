import { HOUSEHOLD_UNITS } from './portion-model.js?v=ae06bc5eefd7d232fb6a8b9cf658d6a28d2331bb';
import { canonicalWord, FOOD_HEADS } from './food-language.js?v=ae06bc5eefd7d232fb6a8b9cf658d6a28d2331bb';
const units=new Set(['g','ml','piece','slice','tablespoon','teaspoon',...Object.keys(HOUSEHOLD_UNITS)]);
export function tokenizeFood(text){
 return [...text.matchAll(/[-+]?\d[\d.,]*%?|[a-z]+(?:-[a-z]+)*|[^\s]/g)].map(match=>{
 const value=match[0], normalized=canonicalWord(value);
 const type=/^\d+(?:[.,]\d+)?%$/.test(value)?'PERCENT':/^[-+]?\d[\d.,]*$/.test(value)?'NUMBER':units.has(value)?'UNIT':['i','oraz','plus',';',','].includes(value)?'CONNECTOR':['okolo','jakies'].includes(value)?'APPROXIMATION':FOOD_HEADS.has(normalized)?'PRODUCT':'WORD';
 return {text:value,normalized,type,start:match.index,end:match.index+value.length};
 });
}
