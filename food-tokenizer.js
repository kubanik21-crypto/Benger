import { HOUSEHOLD_UNITS } from './portion-model.js?v=56f5432cdd25ebff24308c097d37510bf606101a';
import { canonicalWord, FOOD_HEADS } from './food-language.js?v=56f5432cdd25ebff24308c097d37510bf606101a';
const units=new Set(['g','ml','piece','slice','tablespoon','teaspoon',...Object.keys(HOUSEHOLD_UNITS)]);
export function tokenizeFood(text){
 return [...text.matchAll(/[-+]?\d[\d.,]*%?|[a-z]+(?:-[a-z]+)*|[^\s]/g)].map(match=>{
 const value=match[0], normalized=canonicalWord(value);
 const type=/^\d+(?:[.,]\d+)?%$/.test(value)?'PERCENT':/^[-+]?\d[\d.,]*$/.test(value)?'NUMBER':units.has(value)?'UNIT':['i','oraz','plus',';',','].includes(value)?'CONNECTOR':['okolo','jakies'].includes(value)?'APPROXIMATION':FOOD_HEADS.has(normalized)?'PRODUCT':'WORD';
 return {text:value,normalized,type,start:match.index,end:match.index+value.length};
 });
}
