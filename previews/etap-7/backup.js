import { validPortionSnapshot, copyPortionSnapshot, isPortionDefinition, copyPortionDefinition } from './portion-model.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { validPortionSettings } from './portion-repository.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { normalizeCustomProduct } from './product-providers/custom.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { createProductStorage, PRODUCT_CACHE_REVISION } from './product-cache.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { NUTRITION_STORAGE_KEY } from './app-storage.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { copyProduct, isProduct, normalizeText, barcodeKey } from './product-model.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { normalizeFoodQuery } from './food-query.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
import { LEGACY_PRODUCT_IDS } from './legacy-product-references.js?v=8f060d458260f8e7a191d5dff84b0d9f76d716a4';
const JOURNAL='backup-import-journal-v1';
export const BACKUP_LIMIT_BYTES=10*1024*1024;
function fail(message='Nieprawidłowy format backupu.'){throw new TypeError(message);}
function safeTree(value,depth=0){if(depth>30)fail('Backup ma zbyt złożoną strukturę.');if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key))fail('Niedozwolony klucz w backupie.');safeTree(value[key],depth+1);}}
const text=(value,max=240)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const list=(value,max)=>{if(!Array.isArray(value)||value.length>max)fail('Przekroczony limit elementów backupu.');return value;};
export function validDiaryEntry(row){
 return row&&validPortionSnapshot(row)&&text(row.id)&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&new Date(row.date+'T12:00:00Z').toISOString().slice(0,10)===row.date
 &&['breakfast','lunch','dinner','snack'].includes(row.meal)&&text(row.productId)&&text(row.productName)
 &&typeof row.createdAt==='string'&&Number.isFinite(Date.parse(row.createdAt))&&['g','ml'].includes(row.unit)
 &&typeof row.amount==='number'&&Number.isFinite(row.amount)&&row.amount>0&&row.amount<=1e7
 &&['kcal','protein','fat','carbs'].every(key=>typeof row.nutrition?.[key]==='number'&&Number.isFinite(row.nutrition[key])&&row.nutrition[key]>=0&&row.nutrition[key]<=1e10)
 &&['brand','source','sourceId','barcode'].every(key=>row[key]===undefined||row[key]===null||text(row[key]));
}
export function validateBackup(value){
 safeTree(value);if(value?.app!=='Benger'||value.schemaVersion!==1||!value.data)fail('Nieobsługiwana wersja backupu Bengera.');
 const data=value.data;
 const diary=list(data.diary,20000).map(row=>{try{if(!validDiaryEntry(row))fail();}catch{fail('Nieprawidłowy wpis dziennika.');}return {id:row.id,date:row.date,createdAt:row.createdAt,meal:row.meal,productId:row.productId,productName:row.productName,amount:row.amount,unit:row.unit,nutrition:{...row.nutrition},...copyPortionSnapshot(row),...Object.fromEntries(['brand','source','sourceId','barcode'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]))};});
 if(new Set(diary.map(row=>row.id)).size!==diary.length)fail('Powtórzone ID wpisów.');
 const products=list(data.products,5000).map(p=>{if(!['openfoodfacts','usda'].includes(p?.source)||!isProduct(p))fail('Nieprawidłowy produkt w backupie.');return copyProduct(p);});
 const customProducts=list(data.customProducts,2000).map(p=>{if(p?.source!=='custom'||!isProduct(p)||p.id!==`custom:${p.sourceId}`)fail('Nieprawidłowy własny produkt.');normalizeCustomProduct(p,p);return copyProduct(p);});
 if(new Set(customProducts.map(p=>p.id)).size!==customProducts.length || new Set(products.map(p=>p.id)).size!==products.length)fail('Powtórzone ID produktów.');
 const barcodes=customProducts.filter(p=>p.barcode).map(p=>barcodeKey(p.barcode));if(new Set(barcodes).size!==barcodes.length)fail('Powtórzone kody własnych produktów.');
 const ids=new Set([...products.map(p=>p.id),...customProducts.map(p=>p.id),...LEGACY_PRODUCT_IDS]);
 const favorites=list(data.favorites,5000).map(id=>{if(!ids.has(id))fail('Nieznany ulubiony produkt.');return id;});
 const recent=list(data.recent??[],20).map(id=>{if(!ids.has(id))fail('Nieznany ostatni produkt.');return id;});
 const aliases=list(data.aliases,1000).map(row=>{if(!text(row?.phrase,114)||normalizeFoodQuery(row.phrase).length<3||!ids.has(row.productId))fail('Nieprawidłowy alias.');return {phrase:normalizeFoodQuery(row.phrase),productId:row.productId};});
 const selections=list(data.selections,200).map(row=>{if(!text(row?.key,120)||normalizeText(row.key)!==row.key||row.key.startsWith('alias '))fail('Nieprawidłowa fraza pamięci.');const choices=list(row.choices,5).map(choice=>{if(!ids.has(choice.productId)||!Number.isSafeInteger(choice.count)||choice.count<=0||choice.count>1000000||!Number.isFinite(choice.lastUsedAt)||choice.lastUsedAt<0)fail('Nieprawidłowa pamięć wyborów.');return {productId:choice.productId,count:choice.count,lastUsedAt:choice.lastUsedAt};});return {key:row.key,choices};});
 const portionMemory=list(data.portionMemory??[],2000).map(d=>{if(!isPortionDefinition(d)||d.source!=='USER')fail('Nieprawidłowa zapamiętana porcja.');return copyPortionDefinition(d);});
 if(new Set(portionMemory.map(d=>`${d.productId}:${d.unit}`)).size!==portionMemory.length)fail('Powtórzone definicje porcji.');
 const portionSettings=data.portionSettings??{};if(!validPortionSettings(portionSettings))fail('Nieprawidłowe ustawienia naczyń.');
 return {app:'Benger',schemaVersion:1,exportedAt:value.exportedAt,data:{diary,products,customProducts,favorites,recent,aliases,selections,portionMemory,portionSettings:{...portionSettings}}};
}
export function parseBackup(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>BACKUP_LIMIT_BYTES)fail('Backup jest zbyt duży (limit 10 MiB).');try{return validateBackup(JSON.parse(raw));}catch(error){throw new TypeError(error instanceof SyntaxError?'Plik nie jest prawidłowym JSON.':error.message);}}
export async function exportBackup({storage=createProductStorage(),local=globalThis.localStorage}={}){
 try{const state=await storage.snapshot();const products=state.products.map(row=>row.product).filter(p=>isProduct(p)&&['openfoodfacts','usda'].includes(p.source)),customProducts=state.meta.filter(row=>row.key.startsWith('custom:')).map(row=>row.product).filter(isProduct);
 const ids=new Set([...products.map(p=>p.id),...customProducts.map(p=>p.id),...LEGACY_PRODUCT_IDS]);
 return validateBackup({app:'Benger',schemaVersion:1,exportedAt:new Date().toISOString(),data:{diary:JSON.parse(local.getItem(NUTRITION_STORAGE_KEY)??'[]'),products,customProducts,
 favorites:state.usage.filter(row=>row.favorite&&ids.has(row.key)).map(row=>row.key),recent:state.usage.filter(row=>row.lastUsedAt&&ids.has(row.key)).sort((a,b)=>b.lastUsedAt-a.lastUsedAt).slice(0,20).map(row=>row.key),
 aliases:state.meta.filter(row=>row.key.startsWith('alias:')&&ids.has(row.productId)).map(row=>({phrase:row.phrase,productId:row.productId})),
 portionMemory:state.meta.filter(row=>row.key.startsWith('portion:')).map(row=>row.definition),
 portionSettings:state.meta.find(row=>row.key==='portion-settings')?.value??{},
 selections:state.selections.filter(row=>!row.key.startsWith('alias ')).map(row=>({key:row.key,choices:row.choices.filter(choice=>ids.has(choice.productId))})).filter(row=>row.choices.length)}});
 }finally{await storage.close();}
}
export async function recoverPendingImport({storage=createProductStorage(),local=globalThis.localStorage,close=true}={}){
 try{const journal=await storage.read('meta',JOURNAL);if(!journal)return false;
  // If localStorage becomes unavailable, retain journal and refuse to show a partial import.
  let localError;try{if(journal.diary===null)local.removeItem(NUTRITION_STORAGE_KEY);else local.setItem(NUTRITION_STORAGE_KEY,journal.diary);}catch(error){localError=error;}
  const restored=structuredClone(journal.snapshot);if(localError)restored.meta.push(journal);
  await storage.replace(restored);if(localError)throw localError;return true;
 }finally{if(close)await storage.close();}
}
const keyed=(rows,key)=>new Map(rows.map(row=>[key(row),row]));
export async function importBackup(raw,{mode='merge',storage=createProductStorage(),local=globalThis.localStorage}={}){
 const backup=parseBackup(raw);if(!['merge','replace'].includes(mode))fail('Nieznany tryb importu.');
 try{
  await recoverPendingImport({storage,local,close:false});const previous=await storage.snapshot(),oldDiary=local.getItem(NUTRITION_STORAGE_KEY);
  const oldEntries=JSON.parse(oldDiary??'[]');if(!Array.isArray(oldEntries)||oldEntries.some(row=>!validDiaryEntry(row)))fail('Bieżący dziennik jest uszkodzony. Najpierw zabezpiecz jego kopię.');
  local.setItem(NUTRITION_STORAGE_KEY,oldDiary??'[]'); // quota/permission check before mutation
  const next=structuredClone(previous),now=Date.now();
  if(mode==='replace'){next.products=[];next.usage=[];next.selections=[];next.meta=next.meta.filter(row=>!row.key.startsWith('custom:')&&!row.key.startsWith('alias:')&&!row.key.startsWith('portion:')&&row.key!=='portion-settings');}
  const merge=(old,rows,key)=>[...keyed([...rows,...old],key).values()]; // existing values win in merge mode
  next.products=merge(next.products,backup.data.products.map(product=>({key:product.id,product,fetchedAt:0,revision:PRODUCT_CACHE_REVISION})),row=>row.key);
  const importedMeta=[...backup.data.portionMemory.map(definition=>({key:`portion:${definition.productId}:${definition.unit}`,definition})),{key:'portion-settings',value:backup.data.portionSettings},...backup.data.customProducts.map(product=>({key:product.id,product})),...backup.data.aliases.map(alias=>({key:`alias:${alias.phrase}`,...alias}))];
  next.meta=merge(next.meta,importedMeta,row=>row.key);
  const usage=keyed(next.usage,row=>row.key);for(const id of backup.data.favorites){const row=usage.get(id)??{key:id,lastUsedAt:null,order:0};usage.set(id,{...row,favorite:true,favoriteAt:now});}
  for(const [index,id]of backup.data.recent.entries()){const row=usage.get(id)??{key:id,favorite:false,order:0};usage.set(id,{...row,lastUsedAt:row.lastUsedAt??now-index,order:index});}next.usage=[...usage.values()];
  const pins=backup.data.aliases.map(alias=>({key:`alias ${alias.phrase}`,choices:[{productId:alias.productId,count:1,lastUsedAt:now}]}));
  next.selections=merge(next.selections,[...backup.data.selections,...pins],row=>row.key);
  next.meta.push({key:JOURNAL,snapshot:previous,diary:oldDiary});
  const diary=mode==='replace'?backup.data.diary:merge(oldEntries,backup.data.diary,row=>row.id);
  try{await storage.replace(next);local.setItem(NUTRITION_STORAGE_KEY,JSON.stringify(diary));await storage.mutate('meta',JOURNAL,()=>null);}
  catch(error){await recoverPendingImport({storage,local,close:false});throw error;}
  return {entries:diary.length,customProducts:backup.data.customProducts.length};
 }finally{await storage.close();}
}
