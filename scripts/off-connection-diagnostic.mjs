import {startBrowser} from '../tests/browser-harness.mjs';
import {cgiSearchUrl} from '../product-providers/off-search.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),origin='https://kubanik21-crypto.github.io',query='Mięsne Specjały';
const fields='code,product_name,product_name_pl,brands,nutriments,nutrition';
const cgi=cgiSearchUrl(query),polish=new URL(cgi);polish.hostname='pl.openfoodfacts.org';
const sal=new URL('https://search.openfoodfacts.org/search');for(const [k,v]of Object.entries({q:query,langs:'pl,en',page:1,page_size:5,fields}))sal.searchParams.set(k,v);
const brand=new URL('https://world.openfoodfacts.org/api/v2/search');for(const[k,v]of Object.entries({brands_tags:'miesne-specjaly',page:1,page_size:5,fields}))brand.searchParams.set(k,v);
function payload(data){const list=data?.products??data?.hits;return{keys:data&&typeof data==='object'?Object.keys(data).slice(0,12):[],count:data?.count??data?.total??list?.length??null,products:Array.isArray(list)?list.slice(0,2).map(p=>({code:p.code,name:p.product_name_pl??p.product_name,brand:p.brands,keys:Object.keys(p),nutriments:p.nutriments??null,nutrition:p.nutrition??null})):[]};}
function annotation(row){console.log('::notice title=OFF connection evidence::'+JSON.stringify(row).replaceAll('%','%25').replaceAll('\n','%0A').replaceAll('\r','%0D'));}
const b=await startBrowser({staticPrefix:'/',respectProxy:true});
try{
 const p=await b.page('https://kubanik21-crypto.github.io/Benger/previews/off-commercial-search/');
 const cases=[['node-searchalicious',sal,'node'],['node-world-cgi',cgi,'node'],['browser-world-cgi',cgi,'browser'],['browser-pl-cgi',polish,'browser'],['browser-searchalicious',sal,'browser'],['browser-v2-brand',brand,'browser']];
 for(const[label,url,transport]of cases){
  let row={label,url:url.href};
  if(transport==='node'){
   try{const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Benger/1.0.5 (https://github.com/kubanik21-crypto/Benger)',Origin:origin},signal:AbortSignal.timeout(10000),cache:'no-store'});row={...row,http:r.status,allowOrigin:r.headers.get('access-control-allow-origin'),retryAfter:r.headers.get('retry-after'),contentType:r.headers.get('content-type')};try{row.data=payload(await r.json());}catch{row.json=false;}}
   catch(e){row.error=e.message;}
  }else{
   const first=b.networkRequests.length,failures=b.failures.length;
   row.result=await p.evaluate(`(async()=>{try{const r=await fetch(${JSON.stringify(url.href)},{mode:'cors',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});let data=null;try{data=await r.json()}catch{};return{http:r.status,type:r.type,data}}catch(e){return{error:e.message}}})()`);
   if(row.result.data)row.result.data=payload(row.result.data);
   const requests=b.networkRequests.slice(first);row.wire=b.wireResponses.filter(w=>requests.some(r=>r.requestId===w.requestId));row.failures=b.failures.slice(failures);
  }
  annotation(row);
  const limited=row.http===429||row.result?.http===429||row.wire?.some(w=>w.status===429);
  if(limited){annotation({stopped:'OFF rate limit 429; no more diagnostic requests'});break;}
  if(label!==cases.at(-1)[0])await pause(7000);
 }
}finally{await b.close();}
