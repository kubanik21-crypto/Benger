import {HOUSEHOLD_UNITS} from './portion-model.js';
import {parseProductQuery} from './product-query.js';
import {recipeId} from './recipe-id.js';
import {ingredientFromPortion} from './recipe-model.js';
import {loadItemPortions} from './meal-resolution.js';
export function parseRecipeScreenshot(text){
 if(typeof text!=='string'||text.length>20000)throw new Error('Odczyt jest zbyt długi (limit 20 000 znaków).');
 let lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const start=lines.findIndex(s=>/^składniki\s*:?.*$/iu.test(s));if(start>=0)lines=lines.slice(start+1);
 const rows=[];let preparation=false;
 for(const line of lines){
  if(/^składniki\s*:?.*$/iu.test(line)){preparation=false;continue;}
  if(/^spos[oó]b przygotowania|^przygotowanie\s*:|^wykonanie\s*:/iu.test(line)){preparation=true;continue;}
  if(preparation)continue;
  if(/^(?:plus\b|do (?:posypania|posmarowania|oprószenia)|pokruszon|miękkiego|\()/iu.test(line)){if(rows.length)rows.at(-1).note=(rows.at(-1).note+' '+line).trim().slice(0,500);continue;}
  if(/^(?:składniki|ugotuj dzisiaj|dla ciebie|odkrywaj|moje przepisy|mój tydzień|zakupy|wiadomość|\d{1,2}:\d{2})\b/iu.test(line)||!/[a-ząćęłńóśźż]/iu.test(line))continue;
  if(line.length>500||rows.length>=100)throw new Error('Za dużo tekstu. Wybierz screen z samą listą składników.');
  const input=line.replace(/(\d)\s*([½¼¾])/g,(_,n,f)=>String(Number(n)+({'½':.5,'¼':.25,'¾':.75})[f])).replace(/[½¼¾]/g,f=>String(({'½':.5,'¼':.25,'¾':.75})[f]));
  const parsed=parseProductQuery(input);
  if(!parsed.intent.query)continue;
  rows.push({id:recipeId(),originalText:line,name:parsed.intent.query,amount:parsed.parsedAmount,unit:parsed.parsedUnit,note:'',selected:true});
 }
 return rows;
}
export async function prepareScreenshotIngredients(rows,{resolver,repository}){
 const selected=rows.filter(r=>r.selected);if(!selected.length||selected.length>100)throw new Error('Zaznacz od 1 do 100 składników.');
 const ingredients=[];
 for(const row of selected){
  const query=String(row.name??'').trim(),amount=row.amount===''||row.amount===null?null:Number(String(row.amount).replace(',','.')),unit=row.unit||null;
  if(!query||query.length>120||amount!==null&&(!Number.isFinite(amount)||amount<=0||amount>100000))throw new Error('Sprawdź nazwy i dodatnie ilości składników.');
  if(unit!==null&&!['g','ml'].includes(unit)&&!Object.hasOwn(HOUSEHOLD_UNITS,unit))throw new Error('Wybierz poprawną jednostkę.');
  const match=await resolver.resolveProductQuery(query,{allowExternal:false});
  const confirmed=Boolean(match.bestMatch&&match.resolution.identityConfirmed),product=match.bestMatch;
  let ingredient={id:recipeId(),originalText:String(row.originalText||query).slice(0,1000),query,amount,unit,resolutionStatus:'UNRESOLVED',excludedFromNutrition:false,productId:null,productName:null,nutrition:null};
  if(confirmed&&amount!==null&&['g','ml'].includes(unit)&&unit===product.unit){const item=await loadItemPortions({intent:{query,amount,unit},resolution:match.resolution},repository);if(item.portion)ingredient={...ingredientFromPortion(item.portion,ingredient.originalText),query};}
  ingredient.quantityText=[amount??'',unit??'',row.note??''].filter(String).join(' ').slice(0,300);
  ingredient.catalogMatch={status:confirmed?'matched':match.candidates.length?'ambiguous':'unmatched',productId:confirmed?product.id:null,productName:confirmed?product.name:null};
  ingredients.push(ingredient);
 }
 return ingredients;
}
