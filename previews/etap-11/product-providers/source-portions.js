import { normalizeText } from '../product-model.js?v=a2669fe54677df19bb74c89ad1496548a3cba87d';
import { isPortionDefinition } from '../portion-model.js?v=a2669fe54677df19bb74c89ad1496548a3cba87d';
const positive=value=>(typeof value==='number'||typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value.trim()))&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
function quantity(text){
 if(typeof text!=='string'||text.length>120)return null;
 const normalized=normalizeText(text).replace(/,/g,'.');
 let m=normalized.match(/^\s*(\d+(?:\.\d+)?)\s*(g|ml|kg|l)\s*$/);
 if(m)return {amount:Number(m[1])*(['kg','l'].includes(m[2])?1000:1),unit:['ml','l'].includes(m[2])?'ml':'g'};
 m=normalized.match(/^\s*(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|ml)\s*$/);
 return m?{amount:Number(m[1])*Number(m[2]),unit:m[3],multipack:true}:null;
}
export function sourcePortions(raw,product,{source='OFF'}={}) {
 const definitions=[];
 const add=(unit,amount,value,description,kind=source)=>{const d={id:`${product.id}:${kind}:${unit}:${definitions.length}`,productId:product.id,unit,amount,normalizedAmount:value.amount,normalizedUnit:value.unit,source:kind,description:description.slice(0,240)};if(isPortionDefinition(d)&&d.normalizedUnit===product.unit)definitions.push(d);};
 const serving=positive(raw.serving_quantity)&&['g','ml'].includes(raw.serving_quantity_unit)?{amount:Number(raw.serving_quantity),unit:raw.serving_quantity_unit}:null;
 // A free-form declaration must explicitly state the count and mass/volume together.
 const label=typeof raw.serving_size==='string'?normalizeText(raw.serving_size):'';
 const match=label.match(/^(\d+(?:[.,]\d+)?)\s+(slice|slices|piece|pieces|cookie|cookies|tablespoon|tbsp|teaspoon|tsp|scoop|serving|kromka|kromki|plaster|lyzka|lyzeczka|miarka)\s*\(\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\s*\)$/);
 if(match){const word=match[2],unit=/slice|krom/.test(word)?'slice':word==='plaster'?'slab':/tablespoon|tbsp|lyzka/.test(word)?'tablespoon':/teaspoon|tsp|lyzeczka/.test(word)?'teaspoon':/scoop|miarka/.test(word)?'scoop':word==='serving'?'serving':'piece';add(unit,Number(match[1].replace(',','.')),serving??{amount:Number(match[3].replace(',','.')),unit:match[4]},raw.serving_size);}
 else {const exact=serving??quantity(raw.serving_size);if(exact)add('serving',1,exact,`Porcja: ${exact.amount} ${exact.unit}`);}
 const declaredPack=positive(raw.product_quantity)&&['g','ml'].includes(raw.product_quantity_unit)?{amount:Number(raw.product_quantity),unit:raw.product_quantity_unit}:null;
 const parsedPack=quantity(raw.quantity);
 // A contradictory per-item structured quantity cannot stand for the whole multipack.
 const pack=declaredPack&&parsedPack?.multipack&&(declaredPack.unit!==parsedPack.unit||declaredPack.amount!==parsedPack.amount)?null:declaredPack??parsedPack;
 if(pack)add('package',1,pack,`Całe opakowanie: ${pack.amount} ${pack.unit}`,'PACKAGE');
 return definitions;
}
