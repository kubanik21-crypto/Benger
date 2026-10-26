import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeUsdaProduct, buildCatalog } from '../product-providers/usda.js';

import { buildPortionCatalog } from '../product-providers/usda-portions.js';

const args=process.argv.slice(2), fixture=args.indexOf('--fixture'), output=args.indexOf('--output');
const destination=output>=0?args[output+1]:'data/usda';
if(fixture<0 && !args.includes('--refresh'))throw new Error('Użyj --fixture plik.json albo jawnego --refresh (pobiera oficjalne dane USDA).');
let foods=[],sources=[];
if(fixture>=0){const source=JSON.parse(await readFile(args[fixture+1],'utf8'));foods=source.foods;sources=[{type:'fixture',educational:true}];}
else {
 const directory=await mkdtemp(join(tmpdir(),'benger-usda-'));
 try{
  const sets=[['Foundation','FoodData_Central_foundation_food_csv_2024-04-18.zip'],['FNDDS','FoodData_Central_survey_food_csv_2022-10-28.zip'],['SR Legacy','FoodData_Central_sr_legacy_food_csv_2018-04.zip']];
  for(const [type,file] of sets){
   const url=`https://fdc.nal.usda.gov/fdc-datasets/${file}`;
   const response=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw new Error(`${type}: HTTP ${response.status} ${url}`);
   const bytes=Buffer.from(await response.arrayBuffer()),zip=join(directory,file);await writeFile(zip,bytes);
   const output=execFileSync('python3',[new URL('./read-usda-csv.py',import.meta.url).pathname,zip],{encoding:'utf8',maxBuffer:100*1024*1024});
   const rows=JSON.parse(output);foods.push(...rows);
   sources.push({type,url,sha256:createHash('sha256').update(bytes).digest('hex'),records:rows.length,accepted:rows.map(normalizeUsdaProduct).filter(Boolean).length,diagnostics:rows[0]?.importDiagnostics});
  }
 }finally{await rm(directory,{recursive:true,force:true});}
}
const products=foods.map(normalizeUsdaProduct).filter(Boolean);
if(!products.length)throw new Error('Brak prawidłowych rekordów — nic nie publikuję.');
const catalog=buildCatalog(products);
const portions=buildPortionCatalog(foods,new Set(products.map(p=>p.id)));
Object.assign(catalog.files,portions.files);
catalog.metadata.portions=portions.metadata;
await mkdir(destination,{recursive:true});
for(const [file,value] of Object.entries(catalog.files))await writeFile(join(destination,file),JSON.stringify(value));
await writeFile(join(destination,'metadata.json'),JSON.stringify({version:1,builtAt:new Date().toISOString(),license:'USDA public domain / CC0',sources,input:foods.length,accepted:products.length,...catalog.metadata},null,2)+'\n');
console.log(JSON.stringify({input:foods.length,accepted:products.length,...catalog.metadata,sources},null,2));
