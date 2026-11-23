import {canonicalProductName,isKnownProductPhrase} from './product-matching.js';
import {FOOD_HEADS} from './food-language.js';
import {recipeHeading,isRecipePageNoise,ocrLineKey} from './recipe-ocr-regions.js';
import {HOUSEHOLD_UNITS} from './portion-model.js';
import {parseProductQuery} from './product-query.js';
import {recipeId} from './recipe-id.js';
import {ingredientFromPortion} from './recipe-model.js';
import {loadItemPortions} from './meal-resolution.js';
// OCR list marks and name/quantity separators are presentation, not product identity.
// Only trim edges: percentages and punctuation inside a real product name stay intact.
const cleanOcrName=name=>name.replace(/^[\s•●◦▪▫‣⁃·∙*«»‹›“”„"'|—–−\-→←↔➜➝⇒:;.,]+|[\s•●◦▪▫‣⁃·∙*«»‹›“”„"'|—–−\-→←↔➜➝⇒:;.,]+$/gu,'').trim();
export function parseRecipeScreenshot(text){
 if(typeof text!=='string'||text.length>20000)throw new Error('Odczyt jest zbyt długi (limit 20 000 znaków).');
 const rows=[];
 for(const page of text.split('\f')){
  let lines=page.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const start=lines.findIndex(s=>recipeHeading(s)==='ingredients');if(start>=0)lines=lines.slice(start+1);
  const pageStart=rows.length;let preparation=false,pending='';
  for(let line of lines){
   const heading=recipeHeading(line);if(heading==='ingredients'){preparation=false;pending='';continue;}if(heading==='preparation'){preparation=true;pending='';continue;}if(preparation)continue;if(isRecipePageNoise(line)){pending='';continue;}
   if(line.length>500)throw new Error('Za dużo tekstu. Wybierz screen z samą listą składników.');
   if(/^(?:plus\b|do (?:posypania|posmarowania|oprószenia)|pokruszon|miękkiego|\()/iu.test(line)){if(rows.length>pageStart)rows.at(-1).note=(rows.at(-1).note+' '+line).trim().slice(0,500);continue;}
   if(/^[\d.,½¼¾\s]+(?:g|kg|ml|l|szt\.?|łyżki|łyżka|łyżeczki|łyżeczka)?$/iu.test(line)){pending=line;continue;}
   if(pending){if(!/^\d/.test(line))line=pending+' '+line;pending='';}
   const key=ocrLineKey(line);
   if(/\b(?:wlozyc|dodac|wymieszac|nalozyc|nakladac|smazyc|rozprowadzic|zmniejszyc|rozgniesc|zachowac|polaczyc|podawac|ugotowac|piec|gotuj|smaz|wymieszaj|rozgrzac|ubic|ubij|wbij|wbic|nalezy|przelozyc|odstawic|ostudzic|minuty|minut|min|stopni)\b/.test(key)||line.split(/\s+/).length>18)continue;
   const modifier=line.match(/(?<!\p{L})(?:czubat(?:ą|a|e|y|ych|ej)|p[łl]ask(?:ą|a|ie|i|ich|iej))(?!\p{L})/iu)?.[0]??'';
   const input=line.replace(/(\d)\s*([½¼¾])/g,(_,n,f)=>String(Number(n)+({'½':.5,'¼':.25,'¾':.75})[f])).replace(/[½¼¾]/g,f=>String(({'½':.5,'¼':.25,'¾':.75})[f])).replace(/(?<!\p{L})(?:czubat(?:ą|a|e|y|ych|ej)|p[łl]ask(?:ą|a|ie|i|ich|iej))(?!\p{L})/giu,'').replace(/\s+/g,' ').trim();
   const parsed=parseProductQuery(input),name=cleanOcrName(parsed.intent.query),words=canonicalProductName(name).split(/[^a-z]+/).filter(Boolean);
   const meaningful=name.replace(/[^a-ząćęłńóśźż]/giu,'');
   const known=words.some(w=>FOOD_HEADS.has(w)||isKnownProductPhrase(w)||['mak','sezam','drozdze','ziarna','cynamon'].includes(w));
   if(!name||meaningful.length<3||name.length>120||!/[aeiouyąęó]/iu.test(name)||!(known||parsed.parsedAmount!==null&&parsed.parsedUnit!==null))continue;
   if(rows.length>=100)throw new Error('Za dużo tekstu. Wybierz screen z samą listą składników.');
   rows.push({id:recipeId(),originalText:line,name,amount:parsed.parsedAmount,unit:parsed.parsedUnit,note:modifier?modifier+' — masa miary do ustalenia':'',selected:true});
  }
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
