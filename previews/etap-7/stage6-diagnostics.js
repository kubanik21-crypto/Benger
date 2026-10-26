import { createProductRepository } from './product-repository.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
import { createBarcodeScanner } from './barcode-scanner.js?v=4e08d35fe8de2037413f03bda22e46f3659598e8';
const $=id=>document.getElementById(id),repository=createProductRepository(),mode=document.body.dataset.lab;
const report=value=>{$('report').textContent=JSON.stringify(value,null,2);};
const brands=['Pilos','Łaciate','Piątnica','Mlekovita','Danone','Coca-Cola','Pepsi','Nutella','Sante','Lubella','Winiary','Kielecki'];let brandIndex=0;
async function catalog(forceExternal=false){const query=$('query').value,started=performance.now();try{const [alias,generic,cached]=await Promise.all([repository.resolveAlias(query),repository.genericMatches(query),repository.allCachedProducts()]);const final=await repository.searchProducts(query,{forceExternal});report({query,alias,generic,cache:cached.filter(p=>p.source==='openfoodfacts'),final,timingMs:performance.now()-started});}catch(error){report({error:error.message});}}
if(mode==='catalog'){
 $('run').onclick=()=>void catalog();$('brand').onclick=()=>{$('query').value=brands[brandIndex++%brands.length];void catalog(true);};
 $('presets').onchange=()=>{$('query').value=$('presets').value;};
}else if(mode==='barcode'){
 let details={},started;
 const scanner=createBarcodeScanner({video:$('video'),onMode:info=>{details={...details,...info};report(details);},onError:message=>{report({...details,error:message,cameraPermission:'denied or unavailable'});},onCode:async barcode=>{try{const found=await repository.getProductByBarcode(barcode);report({...details,barcode,found,source:found.product?.source??null,status:found.status,timingMs:performance.now()-started});}catch(error){report({...details,barcode,error:error.message});}}});
 $('run').onclick=()=>{started=performance.now();details={nativeAvailable:typeof BarcodeDetector!=='undefined',online:navigator.onLine,cameraPermission:'requested by user'};void scanner.start();};
 $('cancel').onclick=()=>{scanner.stop();report({...details,cancelled:true});};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)scanner.stop();});window.addEventListener('pagehide',()=>scanner.stop());
 report({nativeAvailable:typeof BarcodeDetector!=='undefined',supportedFormats:typeof BarcodeDetector!=='undefined'?await BarcodeDetector.getSupportedFormats().catch(()=>[]):[],cameraPermission:await navigator.permissions?.query({name:'camera'}).then(p=>p.state).catch(()=> 'unknown'),online:navigator.onLine});
}else{
 async function pwa(){const registrations='serviceWorker'in navigator?await navigator.serviceWorker.getRegistrations():[];report({online:navigator.onLine,standalone:matchMedia('(display-mode:standalone)').matches,controller:navigator.serviceWorker?.controller?.scriptURL,registrations:registrations.map(r=>({scope:r.scope,active:r.active?.scriptURL,waiting:r.waiting?.scriptURL})),ownScope:new URL('./',location.href).href,caches:await caches.keys(),storage:await navigator.storage?.estimate(),catalog:await fetch('./data/usda/metadata.json').then(r=>r.json()).catch(()=>null)});}
 $('run').onclick=()=>void pwa();void pwa();
}
window.addEventListener('pagehide',()=>void repository.close());document.documentElement.dataset.diagnosticsReady='true';
