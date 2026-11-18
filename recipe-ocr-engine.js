const local=name=>new URL('./vendor/ocr/'+name,import.meta.url).href;
let library;
function loadLibrary(){return library??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=local('tesseract.min.js');script.onload=()=>resolve(globalThis.Tesseract);script.onerror=()=>{library=null;script.remove();reject(new Error('Nie udało się uruchomić odczytu obrazu.'));};document.head.append(script);});}
export async function recognizeRecipeScreenshots(files,{signal,onProgress=()=>{}}={}){
 if(!files.length||files.length>4)throw new Error('Wybierz od 1 do 4 obrazów.');
 for(const file of files)if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12*1024*1024)throw new Error('Wybierz PNG, JPG lub WebP do 12 MB.');
 let worker;const abort=()=>{void worker?.terminate();};signal?.addEventListener('abort',abort,{once:true});
 const check=()=>{if(signal?.aborted)throw new DOMException('Anulowano','AbortError');};
 try{
  check();const T=await loadLibrary();check();
  worker=await T.createWorker('pol',1,{workerPath:local('worker.min.js'),corePath:local('tesseract-core-lstm.wasm.js'),langPath:new URL('./vendor/ocr/',import.meta.url).href,workerBlobURL:false,gzip:false,cacheMethod:'none',logger:event=>{if(!signal?.aborted&&event.status==='recognizing text')onProgress('Odczyt: '+Math.round(event.progress*100)+'%');}});check();
  await worker.setParameters({tessedit_pageseg_mode:'11'});
  const texts=[];
  for(const [index,file]of files.entries()){
   check();onProgress(`Odczytuję obraz ${index+1} z ${files.length}…`);
   const image=await createImageBitmap(file);
   try{if(image.width*image.height>24000000||image.width>10000||image.height>10000)throw new Error('Obraz jest zbyt duży. Przytnij go do listy składników.');const scale=Math.min(2,2600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);const result=await worker.recognize(canvas);check();texts.push(result.data.text);}finally{image.close();}
  }
  return texts.map(text=>'Składniki\n'+text).join('\n');
 }finally{signal?.removeEventListener('abort',abort);await worker?.terminate().catch(()=>{});}
}
