import { canonicalWord, FOOD_HEADS } from './food-language.js?v=9e26c1f421e7fc013b91689d569c79990cbf8daa';
const units=new Set(['g','ml','piece','slice','tablespoon','teaspoon']);
export function tokenizeFood(text){
 return [...text.matchAll(/[-+]?\d[\d.,]*%?|[a-z]+(?:-[a-z]+)*|[^\s]/g)].map(match=>{
 const value=match[0], normalized=canonicalWord(value);
 const type=/^\d+(?:[.,]\d+)?%$/.test(value)?'PERCENT':/^[-+]?\d[\d.,]*$/.test(value)?'NUMBER':units.has(value)?'UNIT':['i','oraz','plus',';',','].includes(value)?'CONNECTOR':['okolo','jakies'].includes(value)?'APPROXIMATION':FOOD_HEADS.has(normalized)?'PRODUCT':'WORD';
 return {text:value,normalized,type,start:match.index,end:match.index+value.length};
 });
}
