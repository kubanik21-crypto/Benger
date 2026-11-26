import {isAndroidNative} from './native-platform.js';
import {createGoogleAuth,GOOGLE_AUTH_MESSAGES} from './google-auth.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function initGoogleAuthUi({container,auth=createGoogleAuth(),native=isAndroidNative(),sheets}={}){
 if(!native)return null; // PWA gets no controls, prompts, timers or Google calls.
 const panel=el('section');panel.id='google-authorization';panel.setAttribute('aria-labelledby','google-auth-title');
 const title=el('h3','Konto Google');title.id='google-auth-title';
 panel.append(title,el('p','Opcjonalna autoryzacja Androida. Dostęp tylko drive.file: pliki utworzone przez Bengera lub jawnie mu udostępnione. Samo połączenie nie tworzy arkusza i nie wysyła danych; wysyłanie wymaga ręcznego potwierdzenia lub świadomego włączenia automatyzacji.'),
 el('p','Wybór konta i zgoda odbywają się w systemowym panelu. Token pozostaje w pamięci natywnej. Po zamknięciu procesu aplikacji trzeba połączyć konto ponownie; zapisane lokalnie dane pozostają dostępne.'));
 const account=el('p');account.id='google-auth-account';
 const status=el('p');status.id='google-auth-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const connect=el('button','Połącz konto Google');connect.type='button';connect.id='google-auth-connect';connect.className='button-secondary';connect.disabled=true;
 const disconnect=el('button','Rozłącz konto Google');disconnect.type='button';disconnect.id='google-auth-disconnect';disconnect.className='button-secondary';disconnect.disabled=true;
 const check=el('button','Sprawdź status lokalny');check.type='button';check.id='google-auth-check';check.className='button-secondary';
 const terms=el('a','Warunki Google Play services SDK');terms.href='https://developer.android.com/studio/terms';terms.rel='noopener noreferrer';
 const help=el('p','Odłączenie nie usuwa plików Google ani danych Bengera. Bez internetu zgoda w Google może pozostać aktywna. Jeśli zamkniesz proces przed jej cofnięciem, usuń dostęp Benger na myaccount.google.com/connections. Status „połączono” oznacza wynik SDK, nie ciągłą kontrolę zgody na serwerze.');
 panel.append(account,status,connect,disconnect,check,help,terms);container.insertBefore(panel,container.querySelector('#sheets-plan-lab'));
 let busy=false,current=null;
 function render(value){current=value;account.textContent=value.account?`Wybrane konto: ${value.account}`:'Brak wybranego konta.';status.textContent=GOOGLE_AUTH_MESSAGES[value.status];connect.textContent=value.account?(value.connected?'Zmień konto Google':'Połącz ponownie konto Google'):'Połącz konto Google';disconnect.textContent=value.revocationPending?'Ponów cofnięcie dostępu':'Rozłącz konto Google';connect.disabled=busy||!value.configured||value.revocationPending||['authorizing','busy','services-unavailable'].includes(value.status);disconnect.disabled=busy||['authorizing','busy'].includes(value.status)||!value.account&&!value.revocationPending;check.disabled=busy;}
 async function run(method){if(busy)return;busy=true;connect.disabled=true;disconnect.disabled=true;check.disabled=true;status.textContent=method==='connect'?'Otwieram systemowy wybór konta…':method==='disconnect'?'Odłączam konto…':'Sprawdzam lokalny stan autoryzacji…';try{render(await auth[method]());if(method!=='status')window.dispatchEvent(new Event('benger:google-auth-state'));}catch{render({status:'unavailable',account:null,configured:false,connected:false,revocationPending:false});}finally{busy=false;if(current)render(current);}}
 connect.onclick=()=>void run('connect');disconnect.onclick=()=>void run('disconnect');check.onclick=()=>void run('status');
 function visibleRefresh(){if(!document.hidden)void run('status');}
 for(const event of ['benger:native-resume','online','offline'])window.addEventListener(event,visibleRefresh);
 const onRoute=()=>{if(document.documentElement.dataset.route==='ustawienia')visibleRefresh();};window.addEventListener('benger:route',onRoute);
 const timer=setInterval(()=>{if(!document.hidden&&document.documentElement.dataset.route==='ustawienia'&&current?.sessionExpiresAt&&Date.now()>=current.sessionExpiresAt)visibleRefresh();},30000);
 if(sheets)void import('./google-sheets-ui.js').then(({initGoogleSheetsUi})=>initGoogleSheetsUi({container:panel,...sheets})).catch(()=>{});
 void run('status');
 return {panel,dispose(){clearInterval(timer);window.removeEventListener('benger:route',onRoute);for(const event of ['benger:native-resume','online','offline'])window.removeEventListener(event,visibleRefresh);panel.remove();}};
}
