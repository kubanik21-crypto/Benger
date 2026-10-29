import{isAndroidNative,getNativePlugin}from'./native-platform.js';
export async function nativeOffFetch(input,options={}){
 if(!isAndroidNative())throw new TypeError('Android HTTP unavailable');
 const url=new URL(String(input));
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['search.openfoodfacts.org','world.openfoodfacts.org'].includes(url.hostname))throw new TypeError('Niedozwolony adres OFF.');
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 const http=getNativePlugin('CapacitorHttp');
 const request=http.request({url:url.href,method:'GET',headers:{Accept:'application/json','User-Agent':'Benger-Android/1.0 (https://github.com/kubanik21-crypto/Benger; read-only)'},responseType:'json',connectTimeout:8000,readTimeout:8000,disableRedirects:true});
 let abort;
 try{
  const result=await(options.signal?Promise.race([request,new Promise((_,reject)=>{abort=()=>reject(new DOMException('Aborted','AbortError'));options.signal.addEventListener('abort',abort,{once:true});if(options.signal.aborted)abort();})]):request);
  return new Response(typeof result.data==='string'?result.data:JSON.stringify(result.data),{status:result.status,headers:result.headers});
 }finally{if(abort)options.signal.removeEventListener('abort',abort);}
}
