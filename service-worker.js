/* Scope-local application shell. OFF responses never enter this cache. */
importScripts('./sw-assets.js');
const base=new URL('./',self.location.href);
const prefix=`benger-shell:${base.pathname}:`;
const cacheName=prefix+self.BENGER_VERSION;
const urls=new Set(self.BENGER_ASSETS.map(file=>new URL(file,base).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(cacheName),queue=[...urls];
 try{
  await Promise.all(Array.from({length:6},async()=>{while(queue.length){const url=queue.shift();const response=await fetch(url,{cache:'reload'});if(!response.ok)throw new Error('Offline shell HTTP '+response.status);await cache.put(url,response);}}));
 }catch(error){await caches.delete(cacheName);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==cacheName)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
 const canonical=new URL(url.pathname,base).href;
 const target=request.mode==='navigate' && (url.pathname===base.pathname||url.pathname===base.pathname+'index.html')?new URL('index.html',base).href:canonical;
 if(!urls.has(target))return;
 event.respondWith((async()=>{const cache=await caches.open(cacheName);return await cache.match(target)??fetch(request);})());
});
