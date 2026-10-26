import { normalizeText } from '../product-model.js';
import { isPortionDefinition } from '../portion-model.js';
// Match descriptions, not dataset-specific measure_unit IDs. Unrecognized measures remain diagnostics only.
export function usdaPortionUnit(description) {
 const text=normalizeText(description);
 if(/\b(?:tablespoon|tbsp)\b/.test(text))return 'tablespoon';
 if(/\b(?:teaspoon|tsp)\b/.test(text))return 'teaspoon';
 if(/\bcup\b/.test(text))return 'cup';
 if(/\bslice\b/.test(text))return 'slice';
 if(/\b(?:package|packet|container)\b/.test(text))return 'package';
 if(/\bserving\b/.test(text))return 'serving';
 if(/\bscoop\b/.test(text))return 'scoop';
 if(/\b(?:piece|large|medium|small|extra large|jumbo|fruit|egg|roll|cookie|whole|unit)\b/.test(text))return 'piece';
 return null;
}
export function normalizeUsdaPortion(row,productId,index=0) {
 const description=[row.measure_unit_name,row.portion_description,row.modifier].filter(Boolean).join(' · ').slice(0,240);
 const unit=usdaPortionUnit(description);
 const value={id:`${productId}:portion:${row.id??index}`,productId,unit,amount:Number(row.amount),normalizedAmount:Number(row.gram_weight),normalizedUnit:'g',source:'USDA',description};
 return isPortionDefinition(value)?value:null;
}
export function buildPortionCatalog(foods,acceptedIds) {
 const files={},byId={},unknown=[],rows=[];
 for(const food of foods){const productId=`usda:${food.fdcId}`;if(!acceptedIds.has(productId))continue;
  const portions=(food.foodPortions??[]).map((row,index)=>normalizeUsdaPortion(row,productId,index)).filter(Boolean);
  for(const row of food.foodPortions??[])if(!normalizeUsdaPortion(row,productId)) {if(unknown.length<30)unknown.push({productId,...row});}
  if(portions.length)rows.push([productId,portions]);
 }
 for(let i=0;i<rows.length;i+=128){const file=`portion-${String(i/128).padStart(4,'0')}.json`;files[file]=Object.fromEntries(rows.slice(i,i+128));for(const [id]of rows.slice(i,i+128))byId[id]=file;}
 files['portion-index.json']={version:1,byId};
 return {files,metadata:{products:rows.length,definitions:rows.reduce((n,[,p])=>n+p.length,0),bytes:Object.values(files).reduce((n,v)=>n+Buffer.byteLength(JSON.stringify(v)),0),unknownExamples:unknown}};
}
export function createUsdaPortionProvider({base=new URL('../data/usda/',import.meta.url),fetchImpl=(...args)=>fetch(...args)}={}) {
 let pending;const chunks=new Map();
 async function json(file){const r=await fetchImpl(new URL(file,base));if(!r.ok)throw new Error('Porcje USDA chwilowo niedostępne.');return r.json();}
 return {async getPortions(productId){if(!/^usda:\d+$/.test(productId))return[];
  pending??=json('portion-index.json').catch(error=>{pending=null;throw error;});const index=await pending,file=index.byId[productId];if(!/^portion-\d{4}\.json$/.test(file??''))return[];
  if(!chunks.has(file)){chunks.set(file,await json(file));if(chunks.size>4)chunks.delete(chunks.keys().next().value);}
  return (chunks.get(file)[productId]??[]).filter(p=>isPortionDefinition(p)&&p.productId===productId).map(p=>({...p}));
 },stats:()=>({loadedChunks:chunks.size})};
}
