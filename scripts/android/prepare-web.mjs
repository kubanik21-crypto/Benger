import{preparePreview}from'../prepare-preview.mjs';
import{readFile,writeFile,rm,mkdir,copyFile}from'node:fs/promises';
import{resolve}from'node:path';
import{execFileSync}from'node:child_process';
import{fileURLToPath}from'node:url';
export async function prepareAndroidWeb(destination,sha){
 await preparePreview(destination,sha,{preview:false});
 await mkdir(resolve(destination,'native-licenses'));
 await copyFile(new URL('../../android/licenses/Capacitor-MIT.txt',import.meta.url),resolve(destination,'native-licenses/Capacitor-MIT.txt'));
 await copyFile(new URL('../../vendor/zxing/LICENSE-library.txt',import.meta.url),resolve(destination,'native-licenses/Apache-2.0.txt'));
 await writeFile(resolve(destination,'android-error.html'),'<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benger Android</title><body style="font:18px/1.6 system-ui;padding:24px;background:#102019;color:#e7f1e9"><h1>Zaktualizuj Android System WebView</h1><p>Benger potrzebuje aktualnego składnika wyświetlania stron Androida. Twoje dane nie zostały usunięte.</p><p><a style="color:#a0ddbb" href="https://play.google.com/store/apps/details?id=com.google.android.webview">Otwórz Android System WebView w Google Play</a></p><p>Po aktualizacji zamknij i otwórz Bengera ponownie.</p></body></html>');
 const html=await readFile(resolve(destination,'index.html'),'utf8');
 await writeFile(resolve(destination,'index.html'),html.replace('<head>','<head>\n<meta name="benger-native" content="android">').replace(/<meta name="benger-off-search-endpoint"[^>]*>/g,''));
 const metadata=JSON.parse(await readFile(resolve(destination,'release-metadata.json'),'utf8'));
 await writeFile(resolve(destination,'release-metadata.json'),JSON.stringify({...metadata,url:'https://localhost/',platform:'android',applicationId:'io.github.kubanik21crypto.benger'},null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const output=resolve(process.argv[2]??'android-web');if(output!==fileURLToPath(new URL('../../android-web',import.meta.url)))throw new Error('CLI może czyścić tylko android-web w repozytorium.');
 await rm(output,{recursive:true,force:true});
 await prepareAndroidWeb(output,sha);console.log('Android local assets: '+sha);
}
