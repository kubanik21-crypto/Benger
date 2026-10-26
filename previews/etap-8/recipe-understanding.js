import { normalizeFoodQuery } from './food-query.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
import { normalizeTranscript } from './transcript-normalizer.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
import { normalizeText } from './product-model.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
import { readPolishNumber } from './polish-numbers.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
import { understandMeal } from './meal-understanding.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
export const RECIPE_EVENT_TYPES=['INGREDIENT','STEP','INGREDIENT_AND_STEP','YIELD','NAME','NOTE','UNKNOWN'];
const addition=/^(?:daje|dodaje|wrzucam|wlewam|wsypuje|dokladam|uzywam)\s+/;
const action=/\b(?:kroje|siekam|mieszam|blenduje|gotuje|smaze|podsmazam|pieke|dusze|doprawiam|odstawiam)\b/;
const forms={dwoch:'dwa',dwiema:'dwie',trzech:'trzy',lyzkach:'lyzki',lyzeczkach:'lyzeczki',cebule:'cebula',cebuli:'cebula',marchewki:'marchew',marchewek:'marchew',pietruszki:'pietruszka',selera:'seler',udek:'udko',udka:'udko'};
function readNumber(text){if(/^\d+(?:[.,]\d+)?$/.test(text))return Number(text.replace(',','.'));const half=text.match(/^(.*?) i pol$/);if(half){const n=readPolishNumber(half[1]);return n!==null?n+.5:null;}return readPolishNumber(text);}
export function normalizeRecipeText(raw){
 let text=normalizeText(raw).split(' ').map(w=>forms[w]??w).join(' ');
 const words=text.split(' '),endUnit=/^(?:kg|kilogram(?:y|ow|a)?|kilo|l|litr(?:y|ow|a)?|g|gram(?:y|ow|a)?|ml|mililitr(?:y|ow|a)?|lyzk\w*|lyzeczk\w*|szklank\w*|kub\w*|opakowan\w*|porcj\w*|gars\w*|miark\w*|krom\w*|sztuk\w*|cebula|marchew|pietruszka|seler|jajk\w*|banan\w*|minut\w*|godzin\w*|stopni\w*)$/;
 for(let i=0;i<words.length;i++){for(let n=Math.min(8,words.length-i-1);n>=1;n--){if(!endUnit.test(words[i+n]??''))continue;const number=readNumber(words.slice(i,i+n).join(' '));if(number!==null){words.splice(i,n,String(number));break;}}}
 text=words.join(' ').replace(/\b(?:kilogramy|kilogramow|kilograma|kilogram|kilo)\b/g,'kg').replace(/\b(?:litrow|litry|litra|litr)\b/g,'l');
 text=text.replace(/\b(?:kg|l)\b/g,(unit,offset,whole)=>/\d[\d.,]*\s*$/.test(whole.slice(0,offset))?unit:`1 ${unit}`);
 text=text.replace(/\b(\d+(?:[.,]\d+)?)\s*(kg|l)\b/g,(_,number,unit)=>`${Number(number.replace(',','.'))*1000} ${unit==='kg'?'g':'ml'}`);
 text=text.replace(/\b(\d+(?:[.,]\d+)?)\s+(cebula|marchew|pietruszka|seler)\b/g,'$1 piece $2');
 return normalizeTranscript(text).normalizedTranscript;
}
export function understandRecipe(raw,{type,knownIngredients=[]}={}){
 if(typeof raw!=='string'||!raw.trim()||raw.length>2000)throw new TypeError('Wpisz krótką wypowiedź do 2000 znaków.');
 const normalized=normalizeRecipeText(raw),base={raw,normalized,type:'UNKNOWN',intents:[],steps:[],yield:{},name:null,notes:null,issues:[]};
 const name=normalized.match(/^(?:nazwij przepis|to bedzie)\s+(.+)$/);
 if(name){base.type='NAME';base.name=raw.replace(/^(?:nazwij przepis|to będzie)\s+/i,'').trim();}
 else if(/^(?:uwaga|notatka|zapamietaj)\b/.test(normalized)){base.type='NOTE';base.notes=raw;}
 else if(/^(?:wyszlo|mam|calosc wazy|po ugotowaniu (?:wazy|zostalo))\b/.test(normalized)){
  const serving=normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:porcji|porcje|porcja|serving)\b/),mass=normalized.match(/(\d+(?:[.,]\d+)?)\s*g\b/),volume=normalized.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
  for(const [key,m]of [['servings',serving],['finalWeight',mass],['finalVolume',volume]])if(m)base.yield[key]=Number(m[1].replace(',','.'));
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
 if(type){if(!RECIPE_EVENT_TYPES.includes(type))throw new TypeError('Nieznany rodzaj wypowiedzi.');base.type=type;}
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
