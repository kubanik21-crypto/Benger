import { loadPortionReference } from './portion-references.js?v=a08b97addfa97de6ba55d056af5656a433dba897';
import { createProductStorage } from './product-cache.js?v=a08b97addfa97de6ba55d056af5656a433dba897';
import { createUsdaPortionProvider } from './product-providers/usda-portions.js?v=a08b97addfa97de6ba55d056af5656a433dba897';
import { copyPortionDefinition, isPortionDefinition, samePortionUnit } from './portion-model.js?v=a08b97addfa97de6ba55d056af5656a433dba897';
const keyFor=(productId,unit)=>`portion:${productId}:${unit}`;
export function validPortionSettings(value){return value&&typeof value==='object'&&Object.keys(value).every(key=>['cupMl','mugMl'].includes(key)&&typeof value[key]==='number'&&Number.isFinite(value[key])&&value[key]>0&&value[key]<=2000);}
export function createPortionRepository({storage=createProductStorage(),usda=createUsdaPortionProvider()}={}) {
 return {
  async getReference(product){return loadPortionReference(product,usda).catch(()=>null);},
  async getPortions(product){
   const user=(await storage.read('meta')).filter(row=>row.key?.startsWith('portion:')&&row.definition?.productId===product.id&&row.definition.source==='USER'&&row.definition.normalizedUnit===product.unit&&isPortionDefinition(row.definition)).map(row=>row.definition);
   const source=product.source==='usda'?await usda.getPortions(product.id).catch(()=>[]):product.portions??[];
   return [...user,...source.filter(d=>!user.some(u=>samePortionUnit(u.unit,d.unit)))].filter(d=>isPortionDefinition(d)&&d.productId===product.id).map(copyPortionDefinition);
  },
  async remember(definition){if(!isPortionDefinition(definition)||definition.source!=='USER')throw new TypeError('Nieprawidłowa porcja użytkownika.');if((await this.list()).length>=2000 && !(await storage.read('meta',keyFor(definition.productId,definition.unit))))throw new TypeError('Limit 2000 zapamiętanych porcji.');await storage.mutate('meta',keyFor(definition.productId,definition.unit),()=>({definition:copyPortionDefinition(definition)}));},
  async list(){return (await storage.read('meta')).filter(row=>row.key?.startsWith('portion:')&&row.definition?.source==='USER'&&isPortionDefinition(row.definition)).map(row=>copyPortionDefinition(row.definition));},
  async remove(productId,unit){await storage.mutate('meta',keyFor(productId,unit),()=>null);},
  async settings(){const row=await storage.read('meta','portion-settings');return validPortionSettings(row?.value)?{...row.value}:{};},
  async saveSettings(value){if(!validPortionSettings(value))throw new TypeError('Objętość musi być dodatnią liczbą do 2000 ml.');await storage.mutate('meta','portion-settings',()=>({value:{...value}}));},
  close:storage.close,
 };
}
