// Optional preview diagnostics: execute the exact standalone Worker with real server-side OFF fetch.
// This verifies the proposed adapter, not a deployed Cloudflare URL or phone acceptance.
import{createOffSearchBridge}from'../workers/off-search/worker.js';
import{createOffSearchBridgeProvider}from'../product-providers/off-search-bridge.js';
const origin='https://kubanik21-crypto.github.io',worker=createOffSearchBridge();let response;
const provider=createOffSearchBridgeProvider({endpoint:'https://benger-off-search-preview.example.workers.dev/search',fetchImpl:async url=>{response=await worker.fetch(new Request(url,{headers:{Origin:origin}}));return response;}});
let report={deployed:false,upstreamMocked:false};
try{const products=await provider.searchProducts('Mięsne Specjały');report={...report,http:response.status,cors:response.headers.get('Access-Control-Allow-Origin'),count:products.length,products:products.slice(0,3).map(p=>({name:p.name,brand:p.brand,barcode:p.barcode,unit:p.unit,per100:p.per100}))};if(!products.length||report.cors!==origin)throw new Error('No valid products or incorrect CORS');}
catch(error){report={...report,http:response?.status??null,error:error.code??error.message};console.log('::warning title=OFF proposed bridge::Real upstream did not provide usable results; see diagnostics.');}
console.log('::notice title=OFF proposed bridge evidence::'+JSON.stringify(report).replaceAll('%','%25').replaceAll('\n','%0A'));console.log(JSON.stringify(report,null,2));
