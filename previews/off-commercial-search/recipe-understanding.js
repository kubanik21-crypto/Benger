import {isKnownProductPhrase} from './product-matching.js?v=4b08409364df21d546782bfb81ac63458f986959';
import {parseProductQuery,normalizeProductInput} from './product-query.js?v=4b08409364df21d546782bfb81ac63458f986959';
import { normalizeFoodQuery } from './food-query.js?v=4b08409364df21d546782bfb81ac63458f986959';
import { understandMeal } from './meal-understanding.js?v=4b08409364df21d546782bfb81ac63458f986959';
export const RECIPE_EVENT_TYPES=['INGREDIENT','STEP','INGREDIENT_AND_STEP','YIELD','NAME','NOTE','UNKNOWN'];
const addition=/^(?:daje|dodaje|wrzucam|wlewam|wsypuje|dokladam|uzywam)\s+/;
const action=/\b(?:kroje|siekam|mieszam|blenduje|gotuje|smaze|podsmazam|pieke|dusze|doprawiam|odstawiam)\b/;
export function normalizeRecipeText(raw){return normalizeProductInput(raw);}
function readYield(normalized){const result={};for(const[key,pattern]of [['servings',/(?<![a-z\d.,+\-])(\d+(?:[.,]\d+)?)(?![\d.,])\s*(?:porcji|porcje|porcja|serving)\b/],['finalWeight',/(?<![a-z\d.,+\-])(\d+(?:[.,]\d+)?)(?![\d.,])\s*g\b/],['finalVolume',/(?<![a-z\d.,+\-])(\d+(?:[.,]\d+)?)(?![\d.,])\s*ml\b/]]){const match=normalized.match(pattern);if(match)result[key]=Number(match[1].replace(',','.'));}return result;}
export function understandRecipe(raw,{type,knownIngredients=[]}={}){
 if(typeof raw!=='string'||!raw.trim()||raw.length>2000)throw new TypeError('Wpisz krótką wypowiedź do 2000 znaków.');
 const normalized=normalizeRecipeText(raw),base={raw,normalized,type:'UNKNOWN',intents:[],steps:[],yield:{},name:null,notes:null,issues:[]};
 const name=normalized.match(/^(?:nazwij przepis|to bedzie)\s+(.+)$/);
 if(name){base.type='NAME';base.name=raw.replace(/^(?:nazwij przepis|to będzie)\s+/i,'').trim();}
 else if(/^(?:uwaga|notatka|zapamietaj)\b/.test(normalized)){base.type='NOTE';base.notes=raw;}
 else if(/^(?:wyszlo|mam|calosc wazy|po ugotowaniu (?:wazy|zostalo))\b/.test(normalized)){
  base.yield=readYield(normalized);
  if(Object.keys(base.yield).length)base.type='YIELD';
 }
 if(base.type==='UNKNOWN'){
  const hasAmount=/\b\d+(?:[.,]\d+)?\s*(?:g|ml|piece|slice|slab|tablespoon|teaspoon|cup|mug|package|serving|handful|scoop)\b/.test(normalized);
  const spices=/\bsol\b.*\bpieprz\b.*\bdo smaku\b/.test(normalized);
  const add=addition.test(normalized),act=normalized.match(action);
  if(spices){base.type='STEP';base.steps=[raw];}
  else if(act){base.type=hasAmount?'INGREDIENT_AND_STEP':'STEP';base.steps=[raw];}
  else if(hasAmount||add)base.type=add&&!hasAmount&&knownIngredients.some(i=>normalizeFoodQuery(i.query??i.productName??'').includes(normalizeFoodQuery(normalized.replace(addition,''))))?'STEP':'INGREDIENT';
 }
 if(base.type==='UNKNOWN'&&/[a-z]/.test(normalized)){const parsed=parseProductQuery(normalized,{normalized:true});if(isKnownProductPhrase(parsed.normalizedQuery))base.type='INGREDIENT';}
 if(type){if(!RECIPE_EVENT_TYPES.includes(type))throw new TypeError('Nieznany rodzaj wypowiedzi.');base.type=type;}
 if(type==='YIELD')base.yield=readYield(normalized);
 if(!['STEP','INGREDIENT_AND_STEP'].includes(base.type))base.steps=[];
 if(base.type!=='NAME')base.name=null;
 if(base.type!=='YIELD')base.yield={};
 if(!['NOTE','UNKNOWN'].includes(base.type))base.notes=null;
 if(['INGREDIENT','INGREDIENT_AND_STEP'].includes(base.type)){
  let food=normalized.replace(addition,'').replace(/^na\s+/,'');const match=food.match(action);
  if(match){food=match.index>0?food.slice(0,match.index):food.slice(match[0].length);food=food.replace(/\b(?:przez|w temperaturze)\b.*$/,'');}
  food=food.replace(/\s+(?:i|oraz)\s*$/,'');
  base.intents=understandMeal(food,{defaultMeal:'snack'}).intents;
 }
 if(['STEP','INGREDIENT_AND_STEP'].includes(base.type)&&!base.steps.length)base.steps=[raw];
 if(base.type==='NOTE'||base.type==='UNKNOWN')base.notes=raw;
 if(base.type==='NAME'&&!base.name)base.name=raw.trim();
 return base;
}
