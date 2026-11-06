import {validLastPortions} from './manual-meal.js';
import {sourcePortions} from './product-providers/source-portions.js';
import { loadPortionReference } from './portion-references.js';
import { createProductStorage } from './product-cache.js';
import { createUsdaPortionProvider } from './product-providers/usda-portions.js';
import { copyPortionDefinition, isPortionDefinition, samePortionUnit } from './portion-model.js';
const keyFor=(productId,unit)=>`portion:${productId}:${unit}`;
export function validPortionSettings(value){return value&&typeof value==='object'&&Object.keys(value).every(key=>(key==='lastUsed'?validLastPortions(value[key]):['cupMl','mugMl'].includes(key)&&typeof value[key]==='number'&&Number.isFinite(value[key])&&value[key]>0&&value[key]<=2000));}
export function createPortionRepository({storage=createProductStorage(),usda=createUsdaPortionProvider()}={}) {
 return {
  async getReference(product){return loadPortionReference(product,usda).catch(()=>null);},
  async getPortions(product){
   const user=(await storage.read('meta')).filter(row=>row.key?.startsWith('portion:')&&row.definition?.productId===product.id&&row.definition.source==='USER'&&row.definition.normalizedUnit===product.unit&&isPortionDefinition(row.definition)).map(row=>row.definition);
   let source=product.source==='usda'?await usda.getPortions(product.id).catch(()=>[]):product.portions??[];if(product.source==='openfoodfacts'){const inferred=sourcePortions({quantity:product.quantity},product);source=[...source,...inferred.filter(d=>!source.some(s=>s.unit===d.unit&&s.amount===d.amount&&s.normalizedAmount===d.normalizedAmount))];}
   return [...user,...source.filter(d=>!user.some(u=>samePortionUnit(u.unit,d.unit)))].filter(d=>isPortionDefinition(d)&&d.productId===product.id).map(copyPortionDefinition);
  },
  async remember(definition){if(!isPortionDefinition(definition)||definition.source!=='USER')throw new TypeError('Nieprawidłowa porcja użytkownika.');if((await this.list()).length>=2000 && !(await storage.read('meta',keyFor(definition.productId,definition.unit))))throw new TypeError('Limit 2000 zapamiętanych porcji.');await storage.mutate('meta',keyFor(definition.productId,definition.unit),()=>({definition:copyPortionDefinition(definition)}));},
  async list(){return (await storage.read('meta')).filter(row=>row.key?.startsWith('portion:')&&row.definition?.source==='USER'&&isPortionDefinition(row.definition)).map(row=>copyPortionDefinition(row.definition));},
  async remove(productId,unit){await storage.mutate('meta',keyFor(productId,unit),()=>null);},
  async settings(){const row=await storage.read('meta','portion-settings');return validPortionSettings(row?.value)?{...row.value}:{};},
  async rememberUsage(productId,unit,amount){const row={productId,unit,amount};if(!validLastPortions([row]))throw new TypeError('Nieprawidłowa ostatnia ilość.');await storage.mutate('meta','portion-settings',old=>{const value=validPortionSettings(old?.value)?old.value:{};return {value:{...value,lastUsed:[row,...(value.lastUsed??[]).filter(r=>r.productId!==productId)].slice(0,2000)}};});},
  async saveSettings(value){if(!validPortionSettings(value))throw new TypeError('Objętość musi być dodatnią liczbą do 2000 ml.');await storage.mutate('meta','portion-settings',old=>({value:{...(validPortionSettings(old?.value)&&old.value.lastUsed?{lastUsed:old.value.lastUsed}:{}),...value}}));},
  close:storage.close,
 };
}
