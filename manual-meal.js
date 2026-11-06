import {normalizeText} from './product-model.js';
import {HOUSEHOLD_UNITS,isPortionDefinition} from './portion-model.js';
import {resolvePortion} from './portion-resolver.js';
import {portionFor} from './meal-resolution.js';
export function manualUnits(product,definitions=[],settings={}){
 const units=new Set([product.unit]);for(const d of definitions)if(isPortionDefinition(d)&&d.productId===product.id&&d.normalizedUnit===product.unit)units.add(d.unit);
 const name=normalizeText(product.name+' '+(product.description??''));
 if(/waf|rice cake|jaj|\begg\b|banana|banan|tortill/.test(name))units.add('piece');
 if(/chleb|bread|toast/.test(name))units.add('slice');
 if(/skyr|jogurt|yoghurt|yogurt|twarog|cheese|\bser\b/.test(name))units.add('package');
 if(/oliwa|olej|\boil\b|miod|honey|maslo|butter|\bsos\b|sauce|cukier|sugar/.test(name)){units.add('teaspoon');units.add('tablespoon');}
 if(product.unit==='ml'){units.add('teaspoon');units.add('tablespoon');if(settings.cupMl)units.add('cup');if(settings.mugMl)units.add('mug');}
 units.add('serving');return [...units].filter(u=>u===product.unit||Object.hasOwn(HOUSEHOLD_UNITS,u));
}
export async function manualContext(repository,product){const[definitions,settings,reference]=await Promise.all([repository.portions.getPortions(product),repository.portions.settings(),repository.portions.getReference(product)]);return {product,definitions,settings,reference};}
export function manualPortion(context,amount,unit,definitionId=null){const resolution={product:context.product,confidence:'HIGH'},intent={amount,unit};return {conversion:resolvePortion({product:context.product,amount,unit,definitions:context.definitions,settings:context.settings,reference:context.reference,definitionId}),portion:portionFor(intent,resolution,{portionDefinitions:context.definitions,portionSettings:context.settings,portionReference:context.reference,definitionId})};}
export function userUnit(product,unit,weight){const d={id:`${product.id}:USER:${unit}`,productId:product.id,unit,amount:1,normalizedAmount:weight,normalizedUnit:product.unit,source:'USER',description:`Moja miara: 1 ${HOUSEHOLD_UNITS[unit]??unit} = ${weight} ${product.unit}`};if(!isPortionDefinition(d))throw new Error('Podaj dodatnią masę lub objętość do 100 000.');return d;}
export function validLastPortions(rows){return Array.isArray(rows)&&rows.length<=2000&&new Set(rows.map(r=>r?.productId)).size===rows.length&&rows.every(r=>r&&typeof r.productId==='string'&&r.productId.length>0&&r.productId.length<=240&&(Object.hasOwn(HOUSEHOLD_UNITS,r.unit)||['g','ml'].includes(r.unit))&&Number.isFinite(r.amount)&&r.amount>0&&r.amount<=100000&&Object.keys(r).every(k=>['productId','unit','amount'].includes(k)));}
