import { normalizeScannedBarcode } from './barcode-utils.js?v=3237a7e4b07e427a84a0c5ceb0b38ee3e5cee08f';
export const SCANNER_FORMATS=['ean_13','ean_8','upc_a','upc_e'];
const zxingFormats={6:'ean_8',7:'ean_13',14:'upc_a',15:'upc_e'};
export async function loadZxing(){await import('./vendor/zxing/zxing-browser-0.2.1.min.js');return globalThis.ZXingBrowser;}
export function createBarcodeScanner({video,onCode,onError=()=>{},onMode=()=>{},media=globalThis.navigator?.mediaDevices,Detector=globalThis.BarcodeDetector,loadFallback=loadZxing,schedule=callback=>setTimeout(callback,120),cancel=clearTimeout,timeoutMs=45000}={}){
 let generation=0,stream=null,controls=null,timer=null,deadline=null;
 function stop(){generation++;clearTimeout(deadline);deadline=null;if(timer!==null)cancel(timer);timer=null;try{controls?.stop();}catch{/* Still stop every camera track. */}controls=null;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;}
 const fail=(error,version)=>{if(version!==generation)return;stop();onError(error?.name==='TimeoutError'?'Nie odczytano kodu. Spróbuj ponownie lub wpisz go ręcznie.':error?.name==='NotAllowedError'?'Nie udzielono dostępu do aparatu. Możesz wpisać kod ręcznie.':error?.name==='NotFoundError'?'Nie znaleziono aparatu. Wpisz kod ręcznie.':error?.name==='NotReadableError'?'Aparat jest zajęty. Zamknij inne aplikacje lub wpisz kod ręcznie.':'Nie udało się uruchomić skanera. Wpisz kod ręcznie.');};
 async function start(){stop();const version=generation;deadline=setTimeout(()=>fail({name:'TimeoutError'},version),timeoutMs);
  try{
   if(!media?.getUserMedia)throw new Error('Camera unavailable');
   const formats=typeof Detector?.getSupportedFormats==='function'?await Detector.getSupportedFormats().catch(()=>[]):[];
   const native=SCANNER_FORMATS.every(format=>formats.includes(format));
   onMode({engine:native?'native':'zxing',formats});
   const fallback=native?null:await loadFallback();if(version!==generation)return;
   const acquired=await media.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
   if(version!==generation){acquired.getTracks().forEach(track=>track.stop());return;}
   stream=acquired;video.srcObject=stream;
   const accept=(raw,format)=>{if(version!==generation)return;const code=normalizeScannedBarcode(raw,format);if(!code)return;stop();onCode(code);};
   if(native){const detector=new Detector({formats:SCANNER_FORMATS});await video.play();
    const scan=async()=>{if(version!==generation)return;try{const results=await detector.detect(video);if(version!==generation)return;for(const result of results){const code=normalizeScannedBarcode(result.rawValue,result.format);if(code){accept(result.rawValue,result.format);return;}}timer=schedule(scan);}catch(error){fail(error,version);}};
    timer=schedule(scan);
   }else{
    // DecodeHintType.POSSIBLE_FORMATS=2; BarcodeFormat enum verified in @zxing/library 0.23.0.
    const reader=new fallback.BrowserMultiFormatReader(new Map([[2,[6,7,14,15]]]));
    const acquiredControls=await reader.decodeFromStream(stream,video,(result,error)=>{
     if(result){const format=zxingFormats[result.getBarcodeFormat()];if(format)accept(result.getText(),format);}
     else if(error&&!['NotFoundException','ChecksumException','FormatException'].includes(error.getKind?.()??error.name??error.constructor?.name))fail(error,version);
    });
    if(version!==generation)acquiredControls.stop();else controls=acquiredControls;
   }
  }catch(error){fail(error,version);}
 }
 return {start,stop};
}
