/** BENGER_IMPORT read protocol. Payload remains exactly the existing recipe-package v1. */
import {parseRecipePackage,validateImportRecipe,RECIPE_IMPORT_LIMITS} from './recipe-import-format.js';
export const RECIPE_SOURCE_ID='1bDRXeGN8oYQS-U7bRgA_9FAPTcAqdvdUAFBwmbv1gzw';
export const RECIPE_IMPORT_TAB='BENGER_IMPORT';
export const RECIPE_SHEET_COLUMNS=Object.freeze(['schema_version','package_id','record_type','status','published_at','week_from','week_to','namespace','label','recipe_count','chunk_count','chunk_index','payload_json','content_sha256']);
export const RECIPE_CHUNK_SIZE=20000;
const fail=message=>{throw Object.assign(new Error(message),{code:'publication-invalid'});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export async function recipePayloadHash(raw){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function recipeSourceGrid(data){
 if(data?.spreadsheetId!==RECIPE_SOURCE_ID||!Array.isArray(data.sheets))fail('Inny arkusz źródłowy.');
 const sheets=data.sheets.filter(s=>s.properties?.title===RECIPE_IMPORT_TAB);if(sheets.length!==1||sheets[0].data?.length!==1)fail('Brak jednej kompletnej zakładki BENGER_IMPORT.');
 const block=sheets[0].data[0];if((block.startRow??0)!==0||(block.startColumn??0)!==0||!Array.isArray(block.rowData)||block.rowData.length>3000)fail('Niepełny lub zbyt duży odczyt źródła.');
 return block.rowData.map(row=>{const cells=row.values??[];if(!Array.isArray(cells))fail('Nieprawidłowe komórki.');return cells.map(c=>{const v=c.userEnteredValue;if(v===undefined)return '';if(!v||Object.keys(v).length!==1)fail('Nieprawidłowa wartość.');if(typeof v.stringValue==='string')return v.stringValue;if(typeof v.numberValue==='number'&&Number.isFinite(v.numberValue))return v.numberValue;fail('Formuły i wartości logiczne nie są publikacją JSON.');});});
}
export async function readRecipePublications(grid){
 if(!Array.isArray(grid)||!grid.length||grid.length>3000||JSON.stringify(grid[0])!==JSON.stringify(RECIPE_SHEET_COLUMNS))fail('Niezgodne nagłówki BENGER_IMPORT.');
 const groups=new Map();for(const source of grid.slice(1)){if(!Array.isArray(source)||source.length>14&&source.slice(14).some(v=>v!==''&&v!==null)||source.some(v=>!(v===null||typeof v==='string'||typeof v==='number'&&Number.isFinite(v))))fail('Nieprawidłowy wiersz publikacji.');if(source.every(v=>v===''||v===null))continue;
  const row=Array.from({length:14},(_,i)=>source[i]??'');if(row[0]!==1||!id(row[1])||!['MANIFEST','CHUNK'].includes(row[2]))fail('Nieprawidłowa wersja, ID albo typ wiersza.');if(!groups.has(row[1]))groups.set(row[1],[]);groups.get(row[1]).push(row);
 }if(groups.size>20)fail('Najwyżej 20 pakietów w zakładce.');
 const publications=[],issues=[];let totalBytes=0,totalChunks=0;
 for(const [packageId,rows]of groups){try{
  const manifests=rows.filter(r=>r[2]==='MANIFEST');if(manifests.length!==1)fail('Pakiet wymaga dokładnie jednego manifestu.');const m=manifests[0];if(!['DRAFT','READY'].includes(m[3]))fail('Nieprawidłowy status.');if(m[3]==='DRAFT')continue;
  if(!time(m[4])||!date(m[5])||!date(m[6])||m[5]>m[6]||Date.parse(m[6])-Date.parse(m[5])>6*86400000||!id(m[7])||typeof m[8]!=='string'||!m[8].trim()||m[8].length>200||!Number.isInteger(m[9])||m[9]<1||m[9]>50||!Number.isInteger(m[10])||m[10]<1||m[10]>210||m[11]!==''||m[12]!==''||m[13]!==''&&!/^[a-f0-9]{64}$/.test(m[13]))fail('Nieprawidłowy manifest READY.');
  const chunks=rows.filter(r=>r[2]==='CHUNK');totalChunks+=chunks.length;if(totalChunks>256)fail('Najwyżej 256 fragmentów READY w źródle.');if(chunks.length!==m[10])fail('Niekompletny pakiet: liczba fragmentów.');const byIndex=new Map();for(const c of chunks){if(c.slice(3,11).some(v=>v!=='')||c[13]!==''||!Number.isInteger(c[11])||c[11]<1||c[11]>m[10]||byIndex.has(c[11])||typeof c[12]!=='string'||!c[12].length||c[12].length>RECIPE_CHUNK_SIZE)fail('Błędny lub powtórzony fragment.');byIndex.set(c[11],c[12]);}
  const raw=Array.from({length:m[10]},(_,i)=>byIndex.get(i+1)).join('');const bytes=new TextEncoder().encode(raw).length;if(bytes>RECIPE_IMPORT_LIMITS.bytes)fail('Pakiet przekracza 2 MiB.');totalBytes+=bytes;if(totalBytes>4*1024*1024)fail('Łączny odczyt pakietów przekracza 4 MiB.');const digest=await recipePayloadHash(raw);if(m[13]&&digest!==m[13])fail('Niezgodny SHA-256 treści.');
  const pack=parseRecipePackage(raw);if(pack.namespace!==m[7]||pack.label!==m[8]||pack.recipes.length!==m[9])fail('Manifest nie zgadza się z JSON.');for(const recipe of pack.recipes)validateImportRecipe(recipe);
  publications.push({packageId,publishedAt:m[4],week:{from:m[5],to:m[6]},namespace:m[7],label:m[8],digest,hashVerified:!!m[13],raw,metaKey:JSON.stringify(m)});
 }catch(error){issues.push({packageId,message:error.message});}}
 if(totalBytes>4*1024*1024||totalChunks>256)fail('Zbyt dużo danych publikacji.');
 return {publications:publications.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.packageId.localeCompare(b.packageId)),issues};
}
export async function publishRecipeRows(raw,{packageId,publishedAt,from,to,hash=true,status='READY'}){
 const pack=parseRecipePackage(raw);for(const recipe of pack.recipes)validateImportRecipe(recipe);
 if(!id(packageId)||!time(publishedAt)||!date(from)||!date(to)||from>to||Date.parse(to)-Date.parse(from)>6*86400000||!['READY','DRAFT'].includes(status)||!pack.label)fail('Nieprawidłowe metadane publikacji.');
 const chunks=[];for(let i=0;i<raw.length;){let end=Math.min(raw.length,i+RECIPE_CHUNK_SIZE);if(end<raw.length&&/[\uD800-\uDBFF]/.test(raw[end-1]))end--;chunks.push(raw.slice(i,end));i=end;}
 const rows=[[...RECIPE_SHEET_COLUMNS],[1,packageId,'MANIFEST',status,publishedAt,from,to,pack.namespace,pack.label,pack.recipes.length,chunks.length,'','',hash?await recipePayloadHash(raw):'']];
 chunks.forEach((payload,i)=>rows.push([1,packageId,'CHUNK','','','','','','','','',i+1,payload,'']));return rows;
}
