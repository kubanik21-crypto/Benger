// Native features are installed only by the Android build. The web app stays unchanged.
export const isAndroidNative=(scope=globalThis)=>scope.Capacitor?.isNativePlatform?.()===true&&scope.Capacitor?.getPlatform?.()==='android';
export function getNativePlugin(name){return globalThis.Capacitor.Plugins?.[name]??globalThis.Capacitor.registerPlugin(name);}
export async function initNativePlatform(){
 if(!isAndroidNative())return;
 const {installNativeSpeech}=await import('./native-speech.js');
 const bridge=getNativePlugin('BengerNative');
 installNativeSpeech(bridge);
 await bridge.addListener('background',()=>globalThis.dispatchEvent(new Event('benger:native-pause')));
}
export async function saveNativeBackup(raw,filename){
 if(!isAndroidNative())return null;
 const bridge=getNativePlugin('BengerNative');
 if(typeof raw!=='string'||raw.length>64*1024*1024)throw new Error('Backup przekracza limit 64 MiB.');
 const opened=await bridge.beginBackup({filename});if(opened.saved===false)return opened;
 try{
  for(let start=0;start<raw.length;){let end=Math.min(raw.length,start+256*1024);const last=raw.charCodeAt(end-1);if(end<raw.length&&last>=0xD800&&last<=0xDBFF)end--;await bridge.writeBackup({id:opened.id,data:raw.slice(start,end)});start=end;}
  return await bridge.finishBackup({id:opened.id});
 }catch(error){await bridge.abortBackup({id:opened.id}).catch(()=>{});throw error;}
}
