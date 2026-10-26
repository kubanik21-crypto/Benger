// Manual local benchmark, never contacts OFF or changes application/user data.
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { PUBLIC_ASSETS } from './public-assets.mjs';
import { startBrowser } from '../tests/browser-harness.mjs';
const files=PUBLIC_ASSETS.filter(f=>/^data\/usda\/portion-/.test(f));
const contents=await Promise.all(files.map(f=>readFile(new URL('../'+f,import.meta.url))));
const sizes=await Promise.all(PUBLIC_ASSETS.filter(file=>file!=='sw-assets.js').map(f=>readFile(new URL('../'+f,import.meta.url)).then(b=>b.length)));
const metadata=JSON.parse(await readFile(new URL('../data/usda/metadata.json',import.meta.url)));
const browser=await startBrowser({staticPrefix:'/Benger/previews/etap-7/',previewBuild:true});
try {
 const started=performance.now(),page=await browser.page(browser.base);
 const coldAppMs=performance.now()-started;
 const heapBefore=await page.send('Runtime.getHeapUsage');
 const metrics=await page.evaluate(`(async()=>{const {createUsdaPortionProvider}=await import('./product-providers/usda-portions.js');const provider=createUsdaPortionProvider();window.__portionBenchmark=provider;const start=performance.now();const definitions=await provider.getPortions('usda:171413');const coldLookupMs=performance.now()-start;const times=[];for(let i=0;i<30;i++){const t=performance.now();await provider.getPortions('usda:171413');times.push(performance.now()-t);}return {coldLookupMs,warmLookupMs:times.reduce((a,b)=>a+b,0)/times.length,definitions:definitions.length,loadedChunks:provider.stats().loadedChunks};})()`);
 const heapAfter=await page.send('Runtime.getHeapUsage');
 const result={heapUsedBefore:heapBefore.usedSize,heapUsedAfter:heapAfter.usedSize,heapDeltaBytes:heapAfter.usedSize-heapBefore.usedSize,environment:'Local headless Chromium; not a Samsung measurement',productsWithPortions:metadata.portions.products,portionDefinitions:metadata.portions.definitions,portionFiles:files.length,portionBytes:contents.reduce((n,b)=>n+b.length,0),portionGzipBytes:contents.reduce((n,b)=>n+gzipSync(b).length,0),precacheBytes:sizes.reduce((n,b)=>n+b,0),coldAppMs,...metrics};
 console.log(JSON.stringify(result,null,2));
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
}finally{await browser.close();}
