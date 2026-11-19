import {ingredientImageRegion,normalizeOcrRegion,ocrGeometryLines} from './recipe-ocr-regions.js';
const local=name=>new URL('./vendor/ocr/'+name,import.meta.url).href;
let library;
function loadLibrary(){return library??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=local('tesseract.min.js');script.onload=()=>resolve(globalThis.Tesseract);script.onerror=()=>{library=null;script.remove();reject(new Error('Nie udało się uruchomić odczytu obrazu.'));};document.head.append(script);});}
export function validateRecipeImages(files){if(!files.length||files.length>4)throw new Error('Wybierz od 1 do 4 obrazów.');for(const file of files)if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('Wybierz PNG, JPG lub WebP do 12 MB.');}
export function recipeImageCanvas(image,region){
 if(image.width*image.height>24000000||image.width>10000||image.height>10000)throw new Error('Obraz jest zbyt duży. Przytnij go do listy składników.');
 const r=normalizeOcrRegion(region),width=image.width*r.width,height=image.height*r.height,scale=Math.min(3,2600/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,image.width*r.x,image.height*r.y,width,height,0,0,canvas.width,canvas.height);return canvas;
}
function cancellable(task,signal){if(!signal)return task;if(signal.aborted)return Promise.reject(new DOMException('Anulowano','AbortError'));return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Anulowano','AbortError'));signal.addEventListener('abort',abort,{once:true});Promise.resolve(task).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
export async function recognizeRecipeScreenshots(files,{signal,onProgress=()=>{},regions=[]}={}){
 validateRecipeImages(files);if(regions.length&&regions.length!==files.length)throw new Error('Sprawdź zaznaczenia obrazów.');for(const region of regions)normalizeOcrRegion(region);
 let worker;const abort=()=>{void worker?.terminate();};signal?.addEventListener('abort',abort,{once:true});const check=()=>{if(signal?.aborted)throw new DOMException('Anulowano','AbortError');};
 try{
  check();const T=await loadLibrary();check();worker=await T.createWorker('pol',1,{workerPath:local('worker.min.js'),corePath:local('tesseract-core-lstm.wasm.js'),langPath:new URL('./vendor/ocr/',import.meta.url).href,workerBlobURL:false,gzip:false,cacheMethod:'none',logger:event=>{if(!signal?.aborted&&event.status==='recognizing text')onProgress('Odczyt: '+Math.round(event.progress*100)+'%');}});check();
  const texts=[];
  for(const [index,file]of files.entries()){
   check();onProgress(`Szukam sekcji składników: obraz ${index+1} z ${files.length}…`);const image=await createImageBitmap(file);
   try{
    const canvas=recipeImageCanvas(image,regions[index]);await worker.setParameters({tessedit_pageseg_mode:'11'});
    let result=await cancellable(worker.recognize(canvas,{}, {text:true,blocks:true}),signal);check();
    const region=ingredientImageRegion(ocrGeometryLines(result.data),canvas.width,canvas.height);
    const manual=regions[index]&&(regions[index].x||regions[index].y||regions[index].width!==1||regions[index].height!==1);
    if(region||manual){onProgress(`Odczytuję znalezioną listę składników: obraz ${index+1}…`);await worker.setParameters({tessedit_pageseg_mode:'6'});const focused=recipeImageCanvas(canvas,region??{x:0,y:0,width:1,height:1});result=await cancellable(worker.recognize(focused),signal);check();texts.push((region?'SKŁADNIKI\n':'')+result.data.text);}
    else texts.push(result.data.text);
   }finally{image.close();}
  }
  return texts.join('\n\f\n');
 }finally{signal?.removeEventListener('abort',abort);await worker?.terminate().catch(()=>{});}
}
