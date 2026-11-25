// Native status DTO only. No access/refresh tokens, OAuth URLs or persistent account cache.
import {isAndroidNative,getNativePlugin} from './native-platform.js';
export const GOOGLE_DRIVE_FILE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const GOOGLE_AUTH_MESSAGES=Object.freeze({
 'configuration-required':'Autoryzacja Google wymaga konfiguracji projektu Google Cloud i testowego buildu Androida.',
 disconnected:'Konto Google nie jest połączone.',
 authorized:'Google udzielił zgody. Dane Bengera nie zostały wysłane; stan zgody nie jest sprawdzany zdalnie w tle.',
 expired:'Lokalna sesja wygasła. Połącz konto ponownie; zgoda Google może nadal obowiązywać.',
 offline:'Brak połączenia z internetem. Lokalne dane i eksport działają nadal.',
 authorizing:'Dokończ wybór konta i zgodę w panelu Google.',
 cancelled:'Anulowano lub nie udzielono zgody. Konto nie zostało połączone.',
 'permission-denied':'Nie udzielono dokładnie wymaganego dostępu drive.file. Konto nie zostało połączone.',
 'account-mismatch':'Google zwrócił inne konto niż wybrane. Połącz właściwe konto ponownie.',
 'services-unavailable':'Potrzebne są dostępne i aktualne Usługi Google Play.',
 'authorization-required':'Nie udało się potwierdzić autoryzacji. Spróbuj ponownie; sprawdź konfigurację Google Cloud.',
 'revoke-pending':'Odłączono lokalnie. Zgoda w Google nie została jeszcze cofnięta. Ponów odłączenie online lub usuń dostęp w ustawieniach konta Google.',
 busy:'Trwa inna operacja. Dokończ lub zamknij panel Google.',
 unavailable:'Ten build nie udostępnia natywnej autoryzacji Google.',
});
export function cleanGoogleAuthStatus(value){
 if(!Object.hasOwn(GOOGLE_AUTH_MESSAGES,value?.status)||value?.scope!==GOOGLE_DRIVE_FILE_SCOPE)value={status:'unavailable'};
 const dto={status:value.status,configured:value?.configured===true,connected:value?.connected===true,
  account:typeof value?.account==='string'&&value.account.length>0&&value.account.length<=320?value.account:null,
  revocationPending:value?.revocationPending===true,
  sessionExpiresAt:Number.isSafeInteger(value?.sessionExpiresAt)&&value.sessionExpiresAt>0?value.sessionExpiresAt:0,
  scope:GOOGLE_DRIVE_FILE_SCOPE};
 if(dto.connected&&(!dto.configured||!dto.account||!['authorized','offline','services-unavailable','busy'].includes(dto.status))||dto.status==='authorized'&&!dto.connected)return cleanGoogleAuthStatus({status:'unavailable'});
 return Object.freeze(dto);
}
export function createGoogleAuth({native=isAndroidNative(),bridge}={}){
 async function invoke(method){
  if(!native)return cleanGoogleAuthStatus({status:'unavailable'});
  try{const plugin=bridge??getNativePlugin('BengerGoogleAuth');return cleanGoogleAuthStatus(await plugin[method]());}
  catch{return cleanGoogleAuthStatus({status:'unavailable'});} // Never echo potentially sensitive native exceptions.
 }
 return {status:()=>invoke('getStatus'),connect:()=>invoke('connect'),disconnect:()=>invoke('disconnect')};
}
