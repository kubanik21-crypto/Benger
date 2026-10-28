// Standalone Cloudflare Worker. No AI, bindings, API keys or arbitrary proxy URLs.
const UPSTREAM='https://search.openfoodfacts.org/search';
const USER_AGENT='Benger/1.0.5 (https://github.com/kubanik21-crypto/Benger; read-only food search)';
const ORIGIN='https://kubanik21-crypto.github.io';
const MAX_BODY=512*1024;
const FIELDS='code,product_name,product_name_pl,brands,quantity,image_front_small_url,last_modified_t,nutriments,nutrition';
const MACROS=['energy-kcal_100g','proteins_100g','fat_100g','carbohydrates_100g'];
const text=(v,max=240)=>typeof v==='string'?v.trim().slice(0,max):undefined;
function thinProduct(p){
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 const out={};for(const key of ['code','product_name','product_name_pl','quantity','image_front_small_url']){const v=text(p[key],key==='image_front_small_url'?2048:240);if(v!==undefined)out[key]=v;}
 out.brands=Array.isArray(p.brands)?p.brands.filter(v=>typeof v==='string').slice(0,10).map(v=>v.slice(0,240)).join(', ').slice(0,240):text(p.brands);
 if(typeof p.last_modified_t==='number'&&Number.isFinite(p.last_modified_t))out.last_modified_t=p.last_modified_t;
 if(p.nutriments&&typeof p.nutriments==='object'){out.nutriments={};for(const k of MACROS){const v=p.nutriments[k];if(typeof v==='number'||typeof v==='string'&&v.length<32)out.nutriments[k]=v;}}
 const set=p.nutrition?.aggregated_set;
 if(set&&typeof set==='object'){const nutrients={};for(const k of ['energy-kcal','proteins','fat','carbohydrates']){const n=set.nutrients?.[k];if(n&&typeof n==='object'){nutrients[k]={};for(const f of ['value','unit','modifier','source'])if(typeof n[f]==='number'||typeof n[f]==='string'&&n[f].length<40)nutrients[k][f]=n[f];}}out.nutrition={aggregated_set:{per:text(set.per,20),preparation:text(set.preparation,30),nutrients}};}
 return out;
}
async function boundedJson(response){
 if(Number(response.headers.get('Content-Length'))>MAX_BODY)throw new Error('oversize');
 const reader=response.body?.getReader();if(!reader)throw new Error('body');
 const chunks=[];let size=0;
 try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw new Error('oversize');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function createOffSearchBridge({fetchImpl=globalThis.fetch,now=Date.now,timeoutMs=8000}={}){
 const clients=new Map();let upstreamCalls=[],blockedUntil=0;
 return {async fetch(request,env={}){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=(env.OFF_ALLOWED_ORIGINS??ORIGIN).split(',').map(s=>s.trim()).filter(Boolean);
  const cors=allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  const json=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
  if(url.pathname==='/health'&&request.method==='GET')return json(200,{service:'Benger OFF search',ok:true});
  if(url.pathname!=='/search')return json(404,{error:'not-found'});
  if(!allowed.includes(origin))return json(403,{error:'origin'});
  if(request.method==='OPTIONS'){
   const headers=(request.headers.get('Access-Control-Request-Headers')??'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
   if(request.headers.get('Access-Control-Request-Method')!=='GET'||headers.some(h=>h!=='accept'))return json(403,{error:'preflight'});
   return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Accept','Access-Control-Max-Age':'600'}});
  }
  if(request.method!=='GET')return json(405,{error:'method'},{Allow:'GET, OPTIONS'});
  const raw=url.searchParams.get('q'),q=typeof raw==='string'?raw.trim().replace(/\s+/g,' '):'';
  if(q.length<3||q.length>120||/[\u0000-\u001f\u007f]/u.test(raw??'')||url.searchParams.getAll('q').length!==1||[...url.searchParams.keys()].some(k=>k!=='q'))return json(400,{error:'query'});
  const time=now(),ip=request.headers.get('CF-Connecting-IP')??'unknown';
  for(const[k,v]of clients)if(time-v.last>=60000)clients.delete(k);
  const previous=clients.get(ip);
  if(time<blockedUntil||previous&&time-previous.last<6000)return json(429,{error:'rate-limit'},{'Retry-After':String(Math.max(1,Math.ceil((blockedUntil>time?blockedUntil-time:6000-(time-previous.last))/1000)))});
  upstreamCalls=upstreamCalls.filter(t=>time-t<60000);
  if(upstreamCalls.length>=10)return json(429,{error:'rate-limit'},{'Retry-After':'60'});
  if(!previous&&clients.size>=512)return json(503,{error:'busy'});
  clients.set(ip,{last:time});upstreamCalls.push(time);
  const upstream=new URL(UPSTREAM);
  // Escape query-language operators; no arbitrary fields, wildcard/regex queries or DSL.
  const literal=q.replace(/([+\-=!(){}\[\]^"~*?:\\/|&<>])/g,'\\$1');
  for(const[k,v]of Object.entries({q:literal,langs:'pl,en',page:1,page_size:20,fields:FIELDS}))upstream.searchParams.set(k,v);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(upstream.href,{method:'GET',redirect:'manual',cache:'no-store',headers:{Accept:'application/json','User-Agent':USER_AGENT},signal:controller.signal});
   if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));const delay=Number.isFinite(seconds)&&seconds>0?Math.max(60,Math.min(3600,seconds)):60;blockedUntil=now()+delay*1000;return json(429,{error:'rate-limit'},{'Retry-After':String(delay)});}
   if(!response.ok)return json(response.status>=500?503:502,{error:'upstream'});
   const data=await boundedJson(response);
   if(!data||!Array.isArray(data.hits))return json(502,{error:'response'});
   return json(200,{products:data.hits.slice(0,20).map(thinProduct).filter(Boolean),source:'Open Food Facts',searchBackend:'Search-a-licious'});
  }catch(error){return json(controller.signal.aborted?504:502,{error:controller.signal.aborted?'timeout':'upstream'});}
  finally{clearTimeout(timer);}
 }};
}
export default createOffSearchBridge();
