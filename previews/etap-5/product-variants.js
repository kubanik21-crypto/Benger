import { normalizeFoodQuery } from './food-query.js?v=9ced9ffbe1b6f10152fb33d5432ccc0a4b8aed43';
export function variantFeatures(text){
 const value=normalizeFoodQuery(text);
 return {percent:[...value.matchAll(/\b\d+(?:\.\d+)?%/g)].map(x=>x[0]),flavor:['waniliowy','truskawkowy','czekoladowy','naturalny','bananowy'].filter(word=>value.includes(word)),zero:/\bzero\b/.test(value)};
}
export function variantCompatible(product,query){
 const wanted=variantFeatures(query), actual=variantFeatures(product.name);
 return (!wanted.percent.length || wanted.percent.every(value=>actual.percent.includes(value)))
 && (!wanted.flavor.length || wanted.flavor.every(value=>actual.flavor.includes(value)))
 && (!wanted.zero || actual.zero);
}
export function phraseSimilarity(a,b){
 const words=text=>new Set(normalizeFoodQuery(text).match(/[a-z0-9]+(?:\.\d+)?%?/g)??[]);
 const left=words(a),right=words(b), common=[...left].filter(x=>right.has(x)).length;
 return common/Math.max(left.size,right.size,1);
}
