import {parseRecipePackage,validateImportRecipe,canonicalImport,importHash,importUuid} from './recipe-import-format.js';
import {validateRecipe,ingredientFromPortion} from './recipe-model.js';
import {calculateRecipeNutrition} from './recipe-nutrition.js';
import {calculatePortion} from './nutrition.js';
import {normalizeCustomProduct} from './product-providers/custom.js';
import {createProductStorage} from './product-cache.js';
import {createProductResolver} from './product-resolver.js';
import {validateRecipeVariant,applyRecipeVariant} from './recipe-execution.js';
import {normalizeText,isProduct} from './product-model.js';
const clone=v=>structuredClone(v);
const localContent=r=>{const {importInfo,createdAt,updatedAt,version,...content}=r;return content;};
export function createRecipeFileImporter({storage=createProductStorage(),repository,resolver=createProductResolver({repository})}={}){
 async function prepare(raw){
  const pack=parseRecipePackage(raw),lookups=new Map(),existing=(await storage.read('recipes')).map(row=>validateRecipe(row.recipe)),rows=[];
  for(const input of pack.recipes){try{
   const source=validateImportRecipe(input),id=await importUuid('recipe-package',pack.namespace,source.externalId),old=existing.find(r=>r.id===id),warnings=[],products=[],ingredients=[],now=new Date().toISOString(),contentHash=await importHash({label:pack.label??null,source});
   let status=old?'update':'new';
   if(old){if(old.importInfo?.namespace!==pack.namespace||old.importInfo?.externalId!==source.externalId)throw Error('Konflikt lokalnego identyfikatora.');if(source.version<old.importInfo.externalVersion)throw Error('Starsza wersja źródła: cofnięcie przepisu zablokowane.');if(source.version===old.importInfo.externalVersion){if(contentHash!==old.importInfo.contentHash)throw Error('Ta sama wersja ma inną treść. Zwiększ version w pliku.');rows.push({id,name:source.name,status:'identical',warnings:['Identyczne źródło — zachowuję także późniejsze lokalne edycje.'],expected:canonicalImport(old)});continue;}if(await importHash(localContent(old))!==old.importInfo.localHash)warnings.push('Baza była edytowana lokalnie. Aktualizacja zastąpi bieżącą bazę, zachowując ją w historii.');}
   if(existing.some(r=>r.id!==id&&normalizeText(r.name)===normalizeText(source.name)))warnings.push('Podobna nazwa, inny identyfikator — nie scalam przepisów.');
   for(const i of source.ingredients){
    const ingredientId=await importUuid('ingredient',pack.namespace,source.externalId,i.id),amount=i.baseAmount??i.amount,unit=i.baseUnit??i.unit;let product=i.productId?await repository.getProductById(i.productId):null;
    if(product&&i.nutrition&&(product.unit!==i.nutrition.unit||canonicalImport(product.per100)!==canonicalImport(i.nutrition.per100))){warnings.push(`${i.name}: konflikt danych produktu — użyję nowego produktu z deklaracji pliku; istniejący pozostanie bez zmian.`);product=null;}
    if(!product&&i.nutrition){const sourceId=await importUuid('product-package',pack.namespace,i.name,i.nutrition.unit,i.nutrition.per100);product=normalizeCustomProduct({name:i.name,unit:i.nutrition.unit,per100:i.nutrition.per100},{sourceId});products.push(product);}
    let ingredient={id:ingredientId,query:i.name,originalText:i.name,amount,unit,resolutionStatus:'UNRESOLVED',excludedFromNutrition:false,productId:null,productName:null,nutrition:null};
    if(product&&amount!==null&&unit===product.unit)ingredient={...ingredientFromPortion({product,amount,nutrition:calculatePortion(product,amount)},i.name),id:ingredientId,query:i.name};
    else{if(!i.productId&&!i.nutrition){if(!lookups.has(i.name))lookups.set(i.name,await resolver.resolveProductQuery(i.name,{allowExternal:false}));const match=lookups.get(i.name);if(match.candidates?.length)warnings.push(`${i.name}: znaleziono lokalne propozycje; nazwa sama nie potwierdza produktu.`);}warnings.push(`${i.name}: nieznana ilość, konwersja lub makro — składnik pozostaje do uzupełnienia.`);}
    ingredient.quantityText=`${i.amount??'?'} ${i.unit}${i.baseAmount!==undefined?` = ${i.baseAmount} ${i.baseUnit}`:''} · ${i.massState??'unspecified'}`;
    ingredient.massState=i.massState??'unspecified';if(i.nutrition){ingredient.nutritionSource=i.nutrition.source.label;if(i.nutrition.source.url)ingredient.nutritionSourceUrl=i.nutrition.source.url;}ingredients.push(ingredient);
   }
   const yieldInfo={servings:source.servings,...(source.finalWeight!==undefined?{finalWeight:source.finalWeight}:{}),...(source.finalVolume!==undefined?{finalVolume:source.finalVolume}:{})},nutrition=calculateRecipeNutrition(ingredients,yieldInfo),localVersion=(old?.version??0)+1;
   if(source.expectedNutrition)for(const type of ['total','perServing']){const expected=source.expectedNutrition[type],actual=nutrition[type];if(expected&&(!actual||Object.keys(expected).some(k=>Math.abs(expected[k]-actual[k])>(k==='kcal'?1:0.1))))warnings.push(`Deklaracja ${type} różni się od obliczeń lub brakuje danych. Obowiązuje silnik Bengera.`);}
   let recipe={id,name:source.name,createdAt:old?.createdAt??now,updatedAt:now,version:localVersion,notes:[source.source?`Źródło: ${source.source.label}${source.source.url?' '+source.source.url:''}`:'',source.preparationMinutes?`Czas przygotowania: ${source.preparationMinutes} min`:'',...(source.tags??[]).map(t=>'#'+t)].filter(Boolean).join('\n'),ingredients,steps:await Promise.all(source.steps.map(async(s,order)=>({...(typeof s==='string'?{text:s}:s),id:await importUuid('step',pack.namespace,source.externalId,order),order,createdAt:now}))),yield:yieldInfo,nutrition,status:nutrition.complete?'READY':'INCOMPLETE',events:[],pack:{id:pack.namespace,recipeId:source.externalId,label:pack.label??pack.namespace,meal:source.meal}};
   recipe=validateRecipe(recipe);recipe.importInfo={namespace:pack.namespace,externalId:source.externalId,externalVersion:source.version,contentHash,localHash:await importHash(localContent(recipe))};recipe=validateRecipe(recipe);
   const variants=[];for(const v of source.variants??[]){const variant=validateRecipeVariant({id:await importUuid('variant',pack.namespace,source.externalId,source.version,v.id),baseRecipeId:id,baseVersion:localVersion,name:v.name,createdAt:now,updatedAt:now,overrides:await Promise.all(v.overrides.map(async op=>({...op,ingredientId:await importUuid('ingredient',pack.namespace,source.externalId,op.ingredientId)})))});applyRecipeVariant(recipe,variant);variants.push(variant);}
   rows.push({id,name:source.name,status,warnings,recipe,products,variants,expected:old?canonicalImport(old):null});
  }catch(error){rows.push({id:null,name:typeof input?.name==='string'?input.name.slice(0,200):'Nieprawidłowy przepis',status:'invalid',warnings:[],error:error.message});}}
  const plan={schemaVersion:1,namespace:pack.namespace,rows};return {...plan,integrity:await importHash(plan)};
 }
 async function commit(input,{selected=[],updates=[]}={}){
  const plan=clone(input),{integrity,...body}=plan;if(integrity!==await importHash(body)||plan.schemaVersion!==1||!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(id=>!plan.rows.some(r=>r.id===id&&!['invalid','identical'].includes(r.status))))throw Error('Nieaktualny lub zmieniony podgląd. Wybierz przepisy ponownie.');
  const chosen=plan.rows.filter(r=>selected.includes(r.id));for(const row of chosen){if(row.id!==row.recipe.id||row.recipe.importInfo?.namespace!==plan.namespace)throw Error('Niespójna tożsamość przepisu.');for(const p of row.products)if(!isProduct(p)||p.source!=='custom'||p.id!=='custom:'+p.sourceId)throw Error('Nieprawidłowy produkt w podglądzie.');validateRecipe(row.recipe);for(const v of row.variants){validateRecipeVariant(v);applyRecipeVariant(row.recipe,v);}if(row.status==='update'&&!updates.includes(row.id))throw Error('Aktualizacja wymaga jawnego potwierdzenia.');}
  return storage.transact(['recipes','recipeHistory','meta'],state=>{
   const added=[],updated=[];for(const row of chosen){const current=state.recipes.find(r=>r.key===row.id);if((current?canonicalImport(current.recipe):null)!==row.expected)throw Error('Biblioteka zmieniła się po podglądzie. Nic nie zapisano.');
    if(current){if(state.recipeHistory.some(r=>r.key===`${row.id}:v${current.recipe.version}`))throw Error('Konflikt wersji historycznej.');state.recipeHistory.push({key:`${row.id}:v${current.recipe.version}`,recipe:current.recipe});current.recipe=clone(row.recipe);updated.push(row.id);}else{state.recipes.push({key:row.id,recipe:clone(row.recipe)});added.push(row.id);}
    for(const product of row.products){const prior=state.meta.find(r=>r.key===product.id);if(prior){if(prior.product?.name!==product.name||prior.product?.unit!==product.unit||canonicalImport(prior.product?.per100??null)!==canonicalImport(product.per100))throw Error('Konflikt produktu. Istniejących danych nie nadpisano.');}else state.meta.push({key:product.id,product:clone(product)});}
    for(const variant of row.variants){const key='recipe-variant:'+variant.id;if(state.meta.some(r=>r.key===key))throw Error('Konflikt wariantu.');state.meta.push({key,variant:clone(variant)});}
   }
   if(state.recipes.length>1000||state.recipeHistory.length>2000||state.meta.filter(r=>r.key.startsWith('recipe-variant:')).length>2000||state.meta.filter(r=>r.key.startsWith('custom:')).length>1000)throw Error('Import przekroczył limit biblioteki. Nic nie zapisano.');
   return {added,updated,skipped:plan.rows.filter(r=>r.status==='identical').length};
  });
 }
 return {prepare,commit,close:storage.close};
}
