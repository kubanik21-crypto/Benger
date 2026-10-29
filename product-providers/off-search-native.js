import{createOffJsonClient}from'./off-http.js';
import{normalizeOffProduct}from'./open-food-facts.js';
import{validateSearchQuery}from'./off-search-query.js';
import{ProductError}from'../product-errors.js';
export function createNativeSearchProvider(options={}){
 const getJson=createOffJsonClient({...options,cacheMode:'no-store'});
 return{id:'off-native-search-v1',async searchProducts(query,{signal,onDiagnostics}={}){
  const url=new URL('https://search.openfoodfacts.org/search');
  const literal=validateSearchQuery(query).replace(/([+\-=!(){}\[\]^"~*?:\\/|&<>])/g,'\\$1');
  for(const[k,v]of Object.entries({q:literal,langs:'pl,en',page:1,page_size:20,fields:'code,product_name,product_name_pl,brands,quantity,image_front_small_url,last_modified_t,nutriments,nutrition'}))url.searchParams.set(k,v);
  const data=await getJson(url,signal);if(!data||!Array.isArray(data.hits))throw new ProductError('response');
  const received=data.hits.slice(0,20);const products=received.map(p=>normalizeOffProduct({...p,brands:Array.isArray(p?.brands)?p.brands.filter(v=>typeof v==='string').join(', '):p?.brands})).filter(Boolean);
  onDiagnostics?.({received:received.length,rejected:received.length-products.length});return products;
 }};
}
