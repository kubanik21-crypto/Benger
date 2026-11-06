import {HOUSEHOLD_UNITS} from './portion-model.js';
import {canonicalWord} from './food-language.js';
import {canonicalProductName,isKnownProductPhrase} from './product-matching.js';
import {normalizeTranscript} from './transcript-normalizer.js';
import {readPolishNumber,replaceSpokenNumbers} from './polish-numbers.js';
const unitNames = { ...Object.fromEntries(Object.keys(HOUSEHOLD_UNITS).map(unit=>[unit,unit])), piece:'piece',slice:'slice',tablespoon:'tablespoon',teaspoon:'teaspoon', g: 'g', gram: 'g', grama: 'g', gramy: 'g', gramow: 'g', ml: 'ml', mililitr: 'ml', mililitra: 'ml', mililitry: 'ml', mililitrow: 'ml' };
const quantityPattern = () => /(?<![\d.,+\-])([+\-]?[\d.,]+)\s*(piece|slice|slab|tablespoon|teaspoon|cup|mug|package|serving|handful|scoop|mililitrow|mililitry|mililitra|mililitr|ml|gramow|gramy|grama|gram|g)(?![a-z])/g;
const helpers = /\b(?:zjadlem|zjadlam|jadlem|jadlam|wypilem|wypilam|pije|jem|dzisiaj|dzis|potem|nastepnie|takze|mialem|mialam|jeszcze|chyba|do tego|na koniec)\b/g;
const approximation = /\b(?:okolo|jakies|mniej wiecej(?: tak)?)\b/g;

function productQuery(text) {
  let query = text.replace(/^[\s:.,!?]+|[\s:.,!?]+$/g, '').replace(/\s+/g, ' ').trim();
  query = query.split(' ').map(canonicalWord).join(' ');
  if (query === 'platki') query = 'platki owsiane';
  if (query === 'jogurt') query = 'jogurt naturalny';
  return query;
}
function readFoodIntent(source, index, meal) {
  const issues = [];
  const quantities = [...source.matchAll(quantityPattern())];
  let amount = null, unit = null;
  const hedgedNumber = source.match(/\bchyba z ([a-z ]+)$/);
  const hedgedAmount = hedgedNumber ? readPolishNumber(hedgedNumber[1]) : null;
  const amountApproximate = hedgedAmount !== null || approximation.test(source); approximation.lastIndex = 0;
  let rest = source.replace(approximation, ' ').replace(helpers, ' ');
  if (quantities.length === 1) {
    const quantity = quantities[0];
    unit = unitNames[quantity[2]];
    if (/^\d+(?:[.,]\d+)?$/.test(quantity[1])) amount = Number(quantity[1].replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { amount = null; issues.push({ code: 'invalid-amount', message: 'Podaj dodatnią ilość, np. 100 lub 50,5.' }); }
    rest = rest.replace(quantity[0], ' ');
  } else if (quantities.length > 1) issues.push({ code: 'ambiguous-amount', message: 'Oddziel produkty słowem „i” lub przecinkiem; podaj jedną ilość dla pozycji.' });
  else {
    // Sama liczba przy nazwie nie daje prawa do zgadywania jednostki. Procent zostaje nazwą.
    if (hedgedAmount !== null && hedgedAmount > 0) {
      amount = hedgedAmount;
      rest = rest.replace(/\bz [a-z ]+$/, ' ');
    }
    const bare = [...rest.matchAll(/(?<![\d.,+\-])([+\-]?[\d.,]+)(?![\d.,%])(?!\s*%)/g)];
    if (bare.length === 1 && /^\d+(?:[.,]\d+)?$/.test(bare[0][1])) {
      const value = Number(bare[0][1].replace(',', '.'));
      if (Number.isFinite(value) && value > 0) { amount = value; rest = rest.replace(bare[0][0], ' '); }
    }
    issues.push({ code: amount === null ? 'missing-amount' : 'missing-unit', message: amount === null ? 'Podaj ilość i jednostkę. Nie zgadujemy porcji.' : 'Wybierz jednostkę ilości: g albo ml.' });
  }
  const query = productQuery(rest);
  if(amount!==null&&unit===null&&COUNTABLE_FOODS.has(canonicalProductName(query))){unit='piece';const i=issues.findIndex(issue=>issue.code==='missing-unit');if(i>=0)issues.splice(i,1);}
  if (!query || !/[a-z]/.test(query)) issues.push({ code: 'missing-product', message: 'Podaj nazwę produktu.' });
  if (query.length > 120) issues.push({ code: 'long-query', message: 'Skróć nazwę produktu do 120 znaków.' });
  return { id: `food-${index + 1}`, raw: source, source, query, amount, unit, amountApproximate, meal, issues, structureConfidence: issues.some(issue => !['missing-unit', 'mass-required'].includes(issue.code)) ? 'LOW' : amountApproximate || !unit ? 'MEDIUM' : 'HIGH', metadata: {} };
}


export const COUNTABLE_FOODS=new Set(['marchew','ziemniaki','cebula','pietruszka','seler','wafle ryzowa','wafel ryzowy']);
export function normalizeProductInput(rawText,{normalized=false}={}){
 if(typeof rawText!=='string'||rawText.length>2000)throw new TypeError('Podaj nazwę produktu do 2000 znaków.');
 let text=normalized?rawText:normalizeTranscript(rawText.replace(/(?<![a-z])szt\.?(?=\s|$)/gi,'piece').replace(/\btbsp\b/gi,'tablespoon').replace(/\btsp\b/gi,'teaspoon')).normalizedTranscript;
 text=replaceSpokenNumbers(text,{isQuantityContext:word=>isKnownProductPhrase(word)||/^(?:kg|kilo|kilogram(?:a|y|ow)?|l|litr(?:a|y|ow)?)$/.test(word)});
 text=text.replace(/\b(?:kg|kilo|kilogram(?:a|y|ow)?|l|litr(?:a|y|ow)?)\b/g,(unit,offset,whole)=>/\d[\d.,]*\s*$/.test(whole.slice(0,offset))?unit:`1 ${unit}`);
 // Mass/volume prefixes are exact metric conversions, never density assumptions.
 text=text.replace(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram(?:a|y|ow)?|l|litr(?:a|y|ow)?)(?![a-z])/g,(_,n,u)=>`${Number(n.replace(',','.'))*1000} ${u.startsWith('k')?'g':'ml'}`);
 text=text.replace(/\b(\d+(?:[.,]\d+)?)\s+([a-z]+)\b/g,(whole,n,word)=>COUNTABLE_FOODS.has(canonicalProductName(word))?`${n} piece ${word}`:whole);
 return text;
}
export function parseProductQuery(rawText,{normalized=false}={}){
 if(typeof rawText!=='string'||rawText.length>2000)throw new TypeError('Podaj nazwę produktu do 2000 znaków.');
 const text=normalizeProductInput(rawText,{normalized});
 const intent=readFoodIntent(text,0,null);
 return {query:rawText,rawText,normalizedQuery:canonicalProductName(intent.query),canonicalName:canonicalProductName(intent.query),parsedAmount:intent.amount,parsedUnit:intent.unit,intent};
}
