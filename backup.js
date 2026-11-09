import {TRAINING_PREFERENCES_KEY,ROUTINE_PREFERENCES_KEY,validateNotificationPreferences,notificationPreferencesFromRecords} from './reminder-preferences.js';
import {validateRecipeVariant,applyRecipeVariant} from './recipe-execution.js';
import {emptySchedule,validateSchedule,mergeSchedule} from './training-calendar.js';
import {SETTINGS_KEY,validateSettings,readSettings} from './settings.js';
import {validateTraining,trainingFromRecords,trainingRecords,mergeTraining,TRAINING_PREFIX} from './training-model.js';
import {validateGoals,GOALS_KEY} from './goals.js';
import {exportProgress,validateProgress,decodeProgress,createProgressStore} from './progress.js';
import {validDiaryEntry,copyDiaryEntry} from './diary-entry.js';
import {recipeQuery} from './recipe-resolver.js';
import { validateRecipe } from './recipe-model.js';
import { validPortionSnapshot, copyPortionSnapshot, isPortionDefinition, copyPortionDefinition } from './portion-model.js';
import { validPortionSettings } from './portion-repository.js';
import { normalizeCustomProduct } from './product-providers/custom.js';
import { createProductStorage, PRODUCT_CACHE_REVISION } from './product-cache.js';
import { NUTRITION_STORAGE_KEY } from './app-storage.js';
import { copyProduct, isProduct, normalizeText, barcodeKey } from './product-model.js';
import { normalizeFoodQuery } from './food-query.js';
import { LEGACY_PRODUCT_IDS } from './legacy-product-references.js';
const JOURNAL='backup-import-journal-v1';
export const BACKUP_LIMIT_BYTES=64*1024*1024;
function fail(message='Nieprawidłowy format backupu.'){throw new TypeError(message);}
function safeTree(value,depth=0){if(depth>30)fail('Backup ma zbyt złożoną strukturę.');if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key))fail('Niedozwolony klucz w backupie.');safeTree(value[key],depth+1);}}
const text=(value,max=240)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const list=(value,max)=>{if(!Array.isArray(value)||value.length>max)fail('Przekroczony limit elementów backupu.');return value;};
export { validDiaryEntry } from './diary-entry.js';
export function validateBackup(value){
 safeTree(value);if(value?.app!=='Benger'||![1,2,3,4,5,6,7,8].includes(value.schemaVersion)||!value.data)fail('Nieobsługiwana wersja backupu Bengera.');
 const data=value.data;const notificationPreferences=data.notificationPreferences==null?null:validateNotificationPreferences(data.notificationPreferences);const trainingSchedule=value.schemaVersion>=7?validateSchedule(data.trainingSchedule):null;const settings=value.schemaVersion>=6?validateSettings(data.settings):null;const training=validateTraining(data.training);if(training)delete training.schedule;const progress=validateProgress(data.progress);const goals=data.goals==null?null:validateGoals(data.goals);
 const diary=list(data.diary,20000).map(row=>{try{if(!validDiaryEntry(row))fail();}catch{fail('Nieprawidłowy wpis dziennika.');}return copyDiaryEntry(row);});
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
 const recipes=list(data.recipes??[],1000).map(r=>validateRecipe(r)),recipeDrafts=list(data.recipeDrafts??[],100).map(r=>validateRecipe(r,{draft:true})),recipeHistory=list(data.recipeHistory??[],2000).map(r=>validateRecipe(r));
 for(const rows of [recipes,recipeDrafts])if(new Set(rows.map(r=>r.id)).size!==rows.length)fail('Powtórzone ID przepisów.');
 if(new Set(recipeHistory.map(r=>`${r.id}:v${r.version}`)).size!==recipeHistory.length)fail('Powtórzone wersje przepisu.');
 const recipeIds=new Set(recipes.map(r=>r.id));
 const recipeVariants=list(data.recipeVariants??[],2000).map(validateRecipeVariant);
 if(new Set(recipeVariants.map(v=>v.id)).size!==recipeVariants.length)fail('Powtórzone warianty.');
 for(const v of recipeVariants){const base=[...recipes,...recipeHistory].find(r=>r.id===v.baseRecipeId&&r.version===v.baseVersion);if(!base)fail('Brak wersji bazowej wariantu.');applyRecipeVariant(base,v);}

 const recipeAliases=list(data.recipeAliases??[],1000).map(a=>{if(!text(a?.phrase,120)||recipeQuery(a.phrase)!==a.phrase||!recipeIds.has(a.recipeId))fail('Nieprawidłowy alias przepisu.');return {phrase:a.phrase,recipeId:a.recipeId};});
 const recipeUsage=list(data.recipeUsage??[],1000).map(u=>{if(!recipeIds.has(u?.recipeId)||typeof u.favorite!=='boolean'||u.lastUsedAt!==null&&(!Number.isFinite(u.lastUsedAt)||u.lastUsedAt<0))fail('Nieprawidłowe preferencje przepisu.');return {recipeId:u.recipeId,favorite:u.favorite,lastUsedAt:u.lastUsedAt};});
 if(new Set(recipeAliases.map(a=>a.phrase)).size!==recipeAliases.length||new Set(recipeUsage.map(u=>u.recipeId)).size!==recipeUsage.length)fail('Powtórzone preferencje przepisów.');
 return {app:'Benger',schemaVersion:value.schemaVersion,exportedAt:value.exportedAt,data:{notificationPreferences,settings,trainingSchedule,training,goals,progress,recipeVariants,recipeAliases,recipeUsage,recipes,recipeDrafts,recipeHistory,diary,products,customProducts,favorites,recent,aliases,selections,portionMemory,portionSettings:{...portionSettings}}};
}
export function parseBackup(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>BACKUP_LIMIT_BYTES)fail('Backup jest zbyt duży (limit 64 MiB).');try{return validateBackup(JSON.parse(raw));}catch(error){throw new TypeError(error instanceof SyntaxError?'Plik nie jest prawidłowym JSON.':error.message);}}
export async function exportBackup({storage=createProductStorage(),local=globalThis.localStorage,includePhotos=false}={}){
 try{const progress=await exportProgress(includePhotos);const state=await storage.snapshot();const training=trainingFromRecords(state.meta),trainingSchedule=training.schedule??emptySchedule();delete training.schedule;const goals=state.meta.find(r=>r.key===GOALS_KEY)?.periods??[];const products=state.products.map(row=>row.product).filter(p=>isProduct(p)&&['openfoodfacts','usda'].includes(p.source)),customProducts=state.meta.filter(row=>row.key.startsWith('custom:')).map(row=>row.product).filter(isProduct);
 const ids=new Set([...products.map(p=>p.id),...customProducts.map(p=>p.id),...LEGACY_PRODUCT_IDS]);
 return validateBackup({app:'Benger',schemaVersion:8,exportedAt:new Date().toISOString(),data:{notificationPreferences:notificationPreferencesFromRecords(state.meta,local),recipeVariants:state.meta.filter(r=>r.key.startsWith('recipe-variant:')).map(r=>r.variant),trainingSchedule,settings:readSettings(state.meta.find(r=>r.key===SETTINGS_KEY)?.value),training,goals,progress,recipeAliases:state.meta.filter(r=>r.key.startsWith('recipe-alias:')).map(({phrase,recipeId})=>({phrase,recipeId})),recipeUsage:state.meta.filter(r=>r.key.startsWith('recipe-usage:')).map(({recipeId,favorite,lastUsedAt})=>({recipeId,favorite:Boolean(favorite),lastUsedAt:lastUsedAt??null})),recipes:(state.recipes??[]).map(r=>r.recipe),recipeDrafts:(state.recipeDrafts??[]).map(r=>r.recipe),recipeHistory:(state.recipeHistory??[]).map(r=>r.recipe),diary:JSON.parse(local.getItem(NUTRITION_STORAGE_KEY)??'[]'),products,customProducts,
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
  if(journal.progress&&typeof indexedDB!=='undefined'){const progress=createProgressStore();try{await progress.replace(journal.progress);}finally{await progress.close();}}
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
  const progressStore=typeof indexedDB==='undefined'?{snapshot:async()=>({measurements:[],sessions:[],photos:[]}),replace:async()=>{},close:async()=>{}}:createProgressStore(),previousProgress=await progressStore.snapshot();const next=structuredClone(previous),now=Date.now();for(const name of ['recipes','recipeDrafts','recipeHistory'])next[name]??=[];
  if(mode==='replace'){next.recipes=[];next.recipeDrafts=[];next.recipeHistory=[];next.products=[];next.usage=[];next.selections=[];next.meta=next.meta.filter(row=>!row.key.startsWith('recipe-variant:')&&!row.key.startsWith('recipe-alias:')&&!row.key.startsWith('recipe-usage:')&&!row.key.startsWith('custom:')&&!row.key.startsWith('alias:')&&!row.key.startsWith('portion:')&&row.key!=='portion-settings');}
  const merge=(old,rows,key)=>[...keyed([...rows,...old],key).values()]; // existing values win in merge mode
  for(const name of ['recipes','recipeDrafts','recipeHistory'])next[name]=merge(next[name],backup.data[name].map(recipe=>({key:name==='recipeHistory'?`${recipe.id}:v${recipe.version}`:recipe.id,recipe})),row=>row.key);
  next.products=merge(next.products,backup.data.products.map(product=>({key:product.id,product,fetchedAt:0,revision:PRODUCT_CACHE_REVISION})),row=>row.key);
  if(backup.data.goals!==null){const old=mode==='replace'?[]:next.meta.find(r=>r.key===GOALS_KEY)?.periods??[];const merged=mode==='replace'?backup.data.goals:validateGoals([...old,...backup.data.goals.filter(r=>!old.some(o=>o.id===r.id||o.effectiveFrom===r.effectiveFrom))]);next.meta=next.meta.filter(r=>r.key!==GOALS_KEY);next.meta.push({key:GOALS_KEY,periods:merged});}
  if(backup.data.training!==null){const checked=mode==='replace'?backup.data.training:mergeTraining(trainingFromRecords(next.meta),backup.data.training);next.meta=next.meta.filter(r=>!r.key.startsWith(TRAINING_PREFIX));next.meta.push(...trainingRecords(checked));}
  {const current=trainingFromRecords(previous.meta).schedule,restored=trainingFromRecords(next.meta);const schedule=backup.data.trainingSchedule===null?current:mode==='replace'?backup.data.trainingSchedule:mergeSchedule(current??emptySchedule(),backup.data.trainingSchedule);if(schedule!==undefined){restored.schedule=schedule;next.meta=next.meta.filter(r=>!r.key.startsWith(TRAINING_PREFIX));next.meta.push(...trainingRecords(restored));}}
  if(backup.data.settings!==null){const existing=next.meta.find(r=>r.key===SETTINGS_KEY);if(mode==='replace'||!existing){next.meta=next.meta.filter(r=>r.key!==SETTINGS_KEY);next.meta.push({key:SETTINGS_KEY,value:backup.data.settings});}}
  if(backup.data.notificationPreferences!==null){for(const[key,value]of [[TRAINING_PREFERENCES_KEY,backup.data.notificationPreferences.training],[ROUTINE_PREFERENCES_KEY,backup.data.notificationPreferences.routine]]){if(mode==='replace'||!next.meta.some(r=>r.key===key)){next.meta=next.meta.filter(r=>r.key!==key);next.meta.push({key,value});}}}
  const importedMeta=[...backup.data.recipeVariants.map(variant=>({key:'recipe-variant:'+variant.id,variant})),...backup.data.recipeAliases.map(a=>({key:'recipe-alias:'+a.phrase,...a})),...backup.data.recipeUsage.map(u=>({key:'recipe-usage:'+u.recipeId,...u})),...backup.data.portionMemory.map(definition=>({key:`portion:${definition.productId}:${definition.unit}`,definition})),{key:'portion-settings',value:backup.data.portionSettings},...backup.data.customProducts.map(product=>({key:product.id,product})),...backup.data.aliases.map(alias=>({key:`alias:${alias.phrase}`,...alias}))];
  next.meta=merge(next.meta,importedMeta,row=>row.key);
  const variants=next.meta.filter(r=>r.key.startsWith('recipe-variant:')).map(r=>validateRecipeVariant(r.variant));
  if(variants.length>2000)fail('Limit 2000 wariantów po połączeniu kopii.');
  for(const variant of variants){let base=[...next.recipes,...next.recipeHistory].map(r=>r.recipe).find(r=>r.id===variant.baseRecipeId&&r.version===variant.baseVersion);
   if(!base){base=[...backup.data.recipes,...backup.data.recipeHistory].find(r=>r.id===variant.baseRecipeId&&r.version===variant.baseVersion);if(!base)fail('Brak bazowej wersji wariantu po imporcie.');next.recipeHistory.push({key:`${base.id}:v${base.version}`,recipe:base});}
   applyRecipeVariant(base,variant);
  }
  if(next.recipeHistory.length>2000)fail('Limit 2000 wersji historii po połączeniu kopii.');

  const usage=keyed(next.usage,row=>row.key);for(const id of backup.data.favorites){const row=usage.get(id)??{key:id,lastUsedAt:null,order:0};usage.set(id,{...row,favorite:true,favoriteAt:now});}
  for(const [index,id]of backup.data.recent.entries()){const row=usage.get(id)??{key:id,favorite:false,order:0};usage.set(id,{...row,lastUsedAt:row.lastUsedAt??now-index,order:index});}next.usage=[...usage.values()];
  const pins=backup.data.aliases.map(alias=>({key:`alias ${alias.phrase}`,choices:[{productId:alias.productId,count:1,lastUsedAt:now}]}));
  next.selections=merge(next.selections,[...backup.data.selections,...pins],row=>row.key);
  next.meta.push({key:JOURNAL,snapshot:previous,diary:oldDiary,progress:previousProgress});
  const diary=mode==='replace'?backup.data.diary:merge(oldEntries,backup.data.diary,row=>row.id);
  try{await storage.replace(next);local.setItem(NUTRITION_STORAGE_KEY,JSON.stringify(diary));const incoming=decodeProgress(backup.data.progress);if(typeof createImageBitmap==='function')for(const photo of incoming.photos)for(const key of ['blob','thumbnail']){let bitmap;try{bitmap=await createImageBitmap(photo[key]);if(Math.max(bitmap.width,bitmap.height)>(key==='blob'?1600:240))throw new Error('dimensions');}catch{throw new Error('Zdjęcie w kopii jest uszkodzone. Import nie został zatwierdzony.');}finally{bitmap?.close();}}const mergeProgress=(key)=>[...new Map([...incoming[key],...previousProgress[key]].map(x=>[x.id,x])).values()];const progressNext={measurements:!incoming.included?previousProgress.measurements:mode==='replace'?incoming.measurements:mergeProgress('measurements'),sessions:mode==='replace'&&incoming.includesPhotos?incoming.sessions:mergeProgress('sessions'),photos:mode==='replace'&&incoming.includesPhotos?incoming.photos:mergeProgress('photos')};if(new Set([...progressNext.measurements,...progressNext.sessions].map(x=>x.id)).size!==progressNext.measurements.length+progressNext.sessions.length)throw new Error('Kolizja ID pomiaru i sesji.');await progressStore.replace(progressNext);await storage.mutate('meta',JOURNAL,()=>null);await progressStore.close();}
  catch(error){await progressStore.replace(previousProgress);await progressStore.close();await recoverPendingImport({storage,local,close:false});throw error;}
  return {entries:diary.length,customProducts:backup.data.customProducts.length};
 }finally{await storage.close();}
}
