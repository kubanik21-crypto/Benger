import { normalizeText } from './product-model.js';
const possessive=/\b(?:moj|moja|moje|mojego|mojej|moich|moim)\b/g;
const inflections={mojego:'moj',mojej:'moj',moja:'moj',moje:'moj',moich:'moj',moim:'moj',dania:'danie',rosolu:'rosol',bigosu:'bigos',carbonary:'carbonara',kurczaka:'kurczak',zupy:'zupa',zupie:'zupa',zapiekanki:'zapiekanka',salatki:'salatka',owsianki:'owsianka',gulaszu:'gulasz'};
export const recipeQuery=value=>normalizeText(value).split(' ').map(w=>inflections[w]??w).join(' ');
const withoutPossessive=value=>value.replace(possessive,' ').replace(/\s+/g,' ').trim();
export function matchRecipes(query,recipes,{aliases=[],usage=[]}={}){
 const q=recipeQuery(query);if(!q||q.length>240)return {recipe:null,confidence:'LOW',alternatives:[],reason:'not-found'};
 const explicitPossessive=/\b(?:moj|moja|moje|mojego|mojej|moich|moim)\b/.test(q),bare=withoutPossessive(q);
 const alias=aliases.find(a=>recipeQuery(a.phrase)===q),pinned=alias&&recipes.find(r=>r.id===alias.recipeId);
 if(pinned)return {recipe:pinned,confidence:'HIGH',alternatives:[],reason:'explicit-recipe-alias'};
 const exact=recipes.filter(r=>recipeQuery(r.name)===q),plain=recipes.filter(r=>withoutPossessive(recipeQuery(r.name))===bare);
 const candidates=exact.length?exact:explicitPossessive?plain:[];
 if(candidates.length===1)return {recipe:candidates[0],confidence:'HIGH',alternatives:[],reason:'exact-recipe-name'};
 const tokens=bare.split(' ').filter(Boolean),matches=candidates.length?candidates:recipes.filter(r=>{const name=withoutPossessive(recipeQuery(r.name)).split(' ');return tokens.length&&tokens.every(t=>name.includes(t));});
 const score=r=>{const u=usage.find(u=>u.recipeId===r.id);return (u?.favorite?1:0)*1e15+(u?.lastUsedAt??0);};
 const alternatives=[...matches].sort((a,b)=>score(b)-score(a));
 if(alternatives.length===1)return {recipe:null,confidence:'MEDIUM',alternatives,reason:'confirm-recipe-match'};
 return {recipe:null,confidence:'LOW',alternatives,reason:alternatives.length?'ambiguous-recipes':explicitPossessive?'personal-recipe-not-found':'not-found'};
}
export function createRecipeResolver({repository}){return {async resolve(query){const [recipes,preferences]=await Promise.all([repository.list(),repository.preferences()]);return matchRecipes(query,recipes,preferences);}};}
