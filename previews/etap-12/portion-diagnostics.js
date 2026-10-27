import { createProductRepository } from './product-repository.js?v=33c644743e722947b363d5bf044844ac22766ed2';
import { createProductResolver } from './product-resolver.js?v=33c644743e722947b363d5bf044844ac22766ed2';
import { understandMeal } from './meal-understanding.js?v=33c644743e722947b363d5bf044844ac22766ed2';
import { resolvePortion } from './portion-resolver.js?v=33c644743e722947b363d5bf044844ac22766ed2';
import { HOUSEHOLD_UNITS } from './portion-model.js?v=33c644743e722947b363d5bf044844ac22766ed2';
const repository=createProductRepository(),$=id=>document.getElementById(id);
const show=(id,value)=>{$(id).textContent=JSON.stringify(value,null,2);};
const options=(select,products)=>{select.replaceChildren();for(const product of products){const option=document.createElement('option');option.value=product.id;option.textContent=`${product.name} · ${product.id}`;select.append(option);}};
if($('portion-diagnostics-form')){
 for(const [value,label]of Object.entries(HOUSEHOLD_UNITS)){const o=document.createElement('option');o.value=value;o.textContent=label;$('portion-unit').append(o);}
 $('portion-product-search').onsubmit=async e=>{e.preventDefault();try{const result=await repository.searchProducts($('portion-query').value);options($('portion-product'),result.products);}catch(error){show('portion-report',{error:error.message});}};
 $('portion-diagnostics-form').onsubmit=async e=>{e.preventDefault();try{const product=await repository.getProductById($('portion-product').value);if(!product)throw new Error('Wyszukaj i wybierz konkretny produkt.');const definitions=await repository.portions.getPortions(product),settings=await repository.portions.settings(),reference=await repository.portions.getReference(product);const started=performance.now();const resolution=resolvePortion({product,definitions,settings,reference,amount:Number($('portion-amount').value.replace(',','.')),unit:$('portion-unit').value});show('portion-report',{input:{amount:resolution.inputAmount,unit:resolution.inputUnit},product,exactDefinitions:definitions,referenceFamily:reference?.family??null,referenceProduct:reference?.referenceProductId??null,referencePortions:reference?.definitions??[],source:resolution.source,confidence:resolution.confidence,estimated:resolution.estimated,definitions,settings,resolution,resolutionMs:performance.now()-started});}catch(error){show('portion-report',{error:error.message});}};
}
export const PORTION_LAB_SENTENCES=['2 łyżki oliwy','łyżeczka masła','2 jajka','3 kromki chleba','2 plastry sera','pół opakowania skyra','jedno opakowanie jogurtu','szklanka mleka','pół szklanki mleka','garść migdałów','1 banan','2 jabłka','jedna bułka','półtorej łyżki masła orzechowego','jedna miarka odżywki białkowej','3 łyżeczki cukru','2 łyżki mleka','2 kromki mojego chleba','pół opakowania produktu własnego','Na śniadanie 2 jajka 2 kromki chleba i łyżeczka masła'];
if($('run-portion-lab'))$('run-portion-lab').onclick=async()=>{
 $('run-portion-lab').disabled=true;const report=[];const resolver=createProductResolver({repository});
 try{for(const sentence of PORTION_LAB_SENTENCES){const understood=understandMeal(sentence,{defaultMeal:'breakfast'}),items=[];
  for(const intent of understood.intents){const identity=await resolver.resolve({query:intent.query},{allowExternal:false});const product=identity.product,definitions=product?await repository.portions.getPortions(product):[];
   items.push({intent,product:product?.id,productConfidence:identity.confidence,productChoices:identity.alternatives?.map(p=>({id:p.id,name:p.name})),portion:resolvePortion({product,definitions,reference:product?await repository.portions.getReference(product):null,settings:await repository.portions.settings(),amount:intent.amount,unit:intent.unit})});}
  report.push({sentence,items});show('portion-lab-report',report);
 }}finally{$('run-portion-lab').disabled=false;}
};
