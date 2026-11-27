import {canonicalImport,importHash} from './recipe-import-format.js';
import {recipePayloadHash,RECIPE_CHUNK_SIZE,RECIPE_SOURCE_ID} from './recipe-sheets-contract.js';
export const MEAL_PLAN_TAB='BENGER_MEAL_PLAN';
export const MEAL_PLAN_COLUMNS=['schema_version','publication_id','record_type','status','published_at','week_from','week_to','plan_id','label','meal_count','chunk_count','chunk_index','payload_json','content_sha256'];
export const fail=message=>{throw new Error(message);};
const object=(o,keys)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('Niezgodny schemat jadłospisu.');};
export const planId=v=>typeof v==='string'&&!['constructor','prototype','__proto__'].includes(v)&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(v);
export const planDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const positive=v=>Number.isFinite(v)&&v>0&&v<=1e7;
export function validateMealPlan(v){
 object(v,['format','schemaVersion','namespace','id','version','label','from','to','meals']);
 if(v.format!=='benger.meal-plan'||v.schemaVersion!==1||!planId(v.namespace)||!planId(v.id)||!Number.isSafeInteger(v.version)||v.version<1||v.version>1e6||typeof v.label!=='string'||!v.label.trim()||v.label.length>200||!planDate(v.from)||!planDate(v.to)||Date.parse(v.to)-Date.parse(v.from)!==6*86400000||!Array.isArray(v.meals)||!v.meals.length||v.meals.length>56)fail('Nieprawidłowy pełny tydzień jadłospisu.');
 const ids=new Set(),slots=new Set(),days=new Set();
 for(const m of v.meals){object(m,['id','date','meal','order','recipe','amount','unit','notes']);object(m.recipe,['namespace','id','version','variant']);
  if(!planId(m.id)||ids.has(m.id)||!planDate(m.date)||m.date<v.from||m.date>v.to||!['breakfast','lunch','dinner','snack'].includes(m.meal)||!Number.isSafeInteger(m.order)||m.order<0||m.order>55||slots.has(`${m.date}:${m.order}`)||!planId(m.recipe.namespace)||!planId(m.recipe.id)||!Number.isSafeInteger(m.recipe.version)||m.recipe.version<1||m.recipe.version>1e6||m.recipe.variant!==undefined&&m.recipe.variant!==null&&!planId(m.recipe.variant)||!positive(m.amount)||!['serving','g','ml'].includes(m.unit)||m.notes!==undefined&&(typeof m.notes!=='string'||m.notes.length>1000))fail('Nieprawidłowa pozycja jadłospisu.');
  ids.add(m.id);slots.add(`${m.date}:${m.order}`);days.add(m.date);
 }
 if(days.size!==7)fail('Plan nie zawiera wszystkich siedmiu dni.');return structuredClone(v);
}
export function parseMealPlan(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2*1024*1024)fail('Plan przekracza 2 MiB.');return validateMealPlan(JSON.parse(raw));}
export function mealPlanGrid(data){
 if(data?.spreadsheetId!==RECIPE_SOURCE_ID||data.sheets?.length!==1||data.sheets[0].properties?.title!==MEAL_PLAN_TAB||data.sheets[0].data?.length!==1)fail('Niepełny odczyt BENGER_MEAL_PLAN.');const b=data.sheets[0].data[0];
 if((b.startRow??0)!==0||(b.startColumn??0)!==0||!Array.isArray(b.rowData)||b.rowData.length>3000)fail('Nieprawidłowy zakres jadłospisu.');
 return b.rowData.map(r=>(r.values??[]).map(c=>{if(c.userEnteredValue===undefined)return '';const v=c.userEnteredValue;if(!v||Object.keys(v).length!==1)fail('Niedozwolona komórka jadłospisu.');if(typeof v.stringValue==='string')return v.stringValue;if(typeof v.numberValue==='number'&&Number.isFinite(v.numberValue))return v.numberValue;fail('Formuły i wartości logiczne są niedozwolone.');}));
}
export async function readMealPlans(grid){
 if(!Array.isArray(grid)||grid.length>3000||canonicalImport(grid[0])!==canonicalImport(MEAL_PLAN_COLUMNS))fail('Niezgodne nagłówki BENGER_MEAL_PLAN.');
 const groups=new Map();for(const row of grid.slice(1)){if(!Array.isArray(row)||row.length>14||row.some(v=>!(typeof v==='string'||typeof v==='number'&&Number.isFinite(v)||v===null)))fail('Nieprawidłowy wiersz planu.');if(row.every(v=>v===''||v===null))continue;const r=Array.from({length:14},(_,i)=>row[i]??'');if(r[0]!==1||!planId(r[1])||!['MANIFEST','CHUNK'].includes(r[2]))fail('Nieprawidłowa tożsamość publikacji.');if(!groups.has(r[1]))groups.set(r[1],[]);groups.get(r[1]).push(r);}
 if(groups.size>20)fail('Najwyżej 20 publikacji planu.');const publications=[],issues=[];let bytes=0,chunks=0;
 for(const [publicationId,rows]of groups){try{const manifests=rows.filter(r=>r[2]==='MANIFEST');if(manifests.length!==1)fail('Wymagany jeden manifest.');const m=manifests[0];if(m[3]==='DRAFT')continue;if(m[3]!=='READY'||typeof m[4]!=='string'||!Number.isFinite(Date.parse(m[4]))||new Date(m[4]).toISOString()!==m[4]||!planDate(m[5])||!planDate(m[6])||!planId(m[7])||typeof m[8]!=='string'||!m[8].trim()||m[8].length>200||!Number.isInteger(m[9])||m[9]<1||m[9]>56||!Number.isInteger(m[10])||m[10]<1||m[10]>210||m[11]!==''||m[12]!==''||typeof m[13]!=='string'||!/^[a-f0-9]{64}$/.test(m[13]))fail('Nieprawidłowy manifest READY lub brak SHA-256.');
 const parts=rows.filter(r=>r[2]==='CHUNK');chunks+=parts.length;if(chunks>256)fail('Za dużo fragmentów.');if(parts.length!==m[10])fail('Niekompletna publikacja planu.');const indexed=new Map();for(const c of parts){if(c.slice(3,11).some(v=>v!=='')||c[13]!==''||!Number.isInteger(c[11])||c[11]<1||c[11]>m[10]||indexed.has(c[11])||typeof c[12]!=='string'||!c[12].length||c[12].length>RECIPE_CHUNK_SIZE)fail('Nieprawidłowy fragment planu.');indexed.set(c[11],c[12]);}
 const raw=Array.from({length:m[10]},(_,i)=>indexed.get(i+1)).join('');bytes+=new TextEncoder().encode(raw).length;if(bytes>4*1024*1024)fail('Odczyt planów przekracza 4 MiB.');const digest=await recipePayloadHash(raw);if(digest!==m[13])fail('Niezgodny SHA-256 planu.');const plan=parseMealPlan(raw);if(plan.id!==m[7]||plan.from!==m[5]||plan.to!==m[6]||plan.label!==m[8]||plan.meals.length!==m[9])fail('Manifest nie zgadza się z planem.');publications.push({publicationId,digest,plan,publishedAt:m[4],manifestHash:await importHash(m)});
 }catch{issues.push('Publikacja jadłospisu odrzucona: sprawdź kompletność, schemat i SHA-256.');}}
 if(bytes>4*1024*1024||chunks>256)fail('Przekroczono limit odczytu planów.');return{publications:publications.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)),issues};
}
export async function publishMealPlanRows(plan,{publicationId,publishedAt,status='READY'}={}){
 plan=validateMealPlan(plan);if(!planId(publicationId)||!['DRAFT','READY'].includes(status)||typeof publishedAt!=='string'||!Number.isFinite(Date.parse(publishedAt))||new Date(publishedAt).toISOString()!==publishedAt)fail('Nieprawidłowa publikacja.');const raw=JSON.stringify(plan),chunks=[];for(let i=0;i<raw.length;){let end=Math.min(i+RECIPE_CHUNK_SIZE,raw.length);if(end<raw.length&&/[\uD800-\uDBFF]/.test(raw[end-1]))end--;chunks.push(raw.slice(i,end));i=end;}
 return[[...MEAL_PLAN_COLUMNS],[1,publicationId,'MANIFEST',status,publishedAt,plan.from,plan.to,plan.id,plan.label,plan.meals.length,chunks.length,'','',await recipePayloadHash(raw)],...chunks.map((c,i)=>[1,publicationId,'CHUNK','','','','','','','','',i+1,c,''])];
}
