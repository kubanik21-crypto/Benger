import { HOUSEHOLD_UNITS } from './portion-model.js?v=b5beacd427a1599d5871763248ff0efa67408024';
import { canonicalWord, FOOD_HEADS } from './food-language.js?v=b5beacd427a1599d5871763248ff0efa67408024';
const units=new Set(['g','ml','piece','slice','tablespoon','teaspoon',...Object.keys(HOUSEHOLD_UNITS)]);
export function tokenizeFood(text){
 return [...text.matchAll(/[-+]?\d[\d.,]*%?|[a-z]+(?:-[a-z]+)*|[^\s]/g)].map(match=>{
 const value=match[0], normalized=canonicalWord(value);
 const type=/^\d+(?:[.,]\d+)?%$/.test(value)?'PERCENT':/^[-+]?\d[\d.,]*$/.test(value)?'NUMBER':units.has(value)?'UNIT':['i','oraz','plus',';',','].includes(value)?'CONNECTOR':['okolo','jakies'].includes(value)?'APPROXIMATION':FOOD_HEADS.has(normalized)?'PRODUCT':'WORD';
 return {text:value,normalized,type,start:match.index,end:match.index+value.length};
 });
}
