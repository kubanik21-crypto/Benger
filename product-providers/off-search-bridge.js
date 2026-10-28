import{createOffJsonClient}from'./off-http.js';
import{normalizeOffProduct}from'./open-food-facts.js';
import{validateSearchQuery}from'./off-search-query.js';
import{ProductError}from'../product-errors.js';
export function validateOffSearchEndpoint(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||(!url.hostname.startsWith('benger-off-search-preview.')||!url.hostname.endsWith('.workers.dev'))||url.port||url.username||url.password||url.pathname!=='/search'||url.search||url.hash||url.href.length>512)throw new TypeError('Nieprawidłowy adres adaptera OFF.');
 return url.href;
}
export function createOffSearchBridgeProvider({endpoint,fetchImpl=globalThis.fetch,timeoutMs=12000}={}){
 const base=validateOffSearchEndpoint(endpoint),getJson=createOffJsonClient({fetchImpl,timeoutMs,cacheMode:'no-store',headers:{Accept:'application/json'}});
 return{id:'off-bridge-v1:'+base,async searchProducts(query,{signal,onDiagnostics}={}){
  const url=new URL(base);url.searchParams.set('q',validateSearchQuery(query));
  const data=await getJson(url,signal);if(!data||!Array.isArray(data.products))throw new ProductError('response');
  const products=data.products.slice(0,20).map(normalizeOffProduct).filter(Boolean);
  onDiagnostics?.({received:Math.min(20,data.products.length),rejected:Math.min(20,data.products.length)-products.length});
  return products;
 }};
}
