// Live preview diagnostic: use deployed bridge when configured; otherwise execute it in Node.
// Both modes use real OFF, but only configured mode verifies the deployed service.
import{createOffSearchBridge}from'../workers/off-search/worker.js';
import{createOffSearchBridgeProvider}from'../product-providers/off-search-bridge.js';
const endpoint=process.env.BENGER_OFF_SEARCH_PREVIEW_URL;
const origin='https://kubanik21-crypto.github.io',worker=createOffSearchBridge();let response;
const provider=createOffSearchBridgeProvider({endpoint:endpoint??'https://benger-off-search-preview.example.workers.dev/search',fetchImpl:async url=>{response=endpoint?await fetch(url,{headers:{Origin:origin,Accept:'application/json'},signal:AbortSignal.timeout(15000)}):await worker.fetch(new Request(url,{headers:{Origin:origin}}));return response;}});
let report={deployed:Boolean(endpoint),upstreamMocked:false};
try{const products=await provider.searchProducts('Mięsne Specjały');report={...report,http:response.status,cors:response.headers.get('Access-Control-Allow-Origin'),count:products.length,products:products.slice(0,3).map(p=>({name:p.name,brand:p.brand,barcode:p.barcode,unit:p.unit,per100:p.per100}))};if(!products.length||report.cors!==origin)throw new Error('No valid products or incorrect CORS');}
catch(error){report={...report,http:response?.status??null,error:error.code??error.message};console.log('::warning title=OFF proposed bridge::Real upstream did not provide usable results; see diagnostics.');if(endpoint)process.exitCode=1;}
console.log('::notice title=OFF proposed bridge evidence::'+JSON.stringify(report).replaceAll('%','%25').replaceAll('\n','%0A'));console.log(JSON.stringify(report,null,2));
