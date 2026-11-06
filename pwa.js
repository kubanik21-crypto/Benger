import{isAndroidNative}from'./native-platform.js';
export async function initPwa(){
 const status=document.getElementById('pwa-status'),install=document.getElementById('install-app'),update=document.getElementById('update-app');
 const banner=document.createElement('aside');banner.id='app-update-banner';banner.className='global-status';banner.hidden=true;banner.setAttribute('role','status');const label=document.createElement('span');label.textContent='Dostępna aktualizacja Bengera';const apply=document.createElement('button');apply.type='button';apply.className='button-secondary';apply.textContent='Zaktualizuj';apply.onclick=()=>update.click();banner.append(label,apply);document.querySelector('.site-header').after(banner);document.querySelector('.site-header').after(document.getElementById('connection-status'));
 const check=document.createElement('button');check.id='check-app-update';check.type='button';check.className='button-secondary';check.textContent='Sprawdź aktualizacje';update.after(check);
 let prompt=null,reloadRequested=false;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();if(standalone())return;prompt=event;install.hidden=false;});
 install.addEventListener('click',async()=>{if(!prompt)return;await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;});
 window.addEventListener('appinstalled',()=>{install.hidden=true;status.textContent='Benger został zainstalowany.';});
 const connection=()=>{document.getElementById('connection-status').textContent=navigator.onLine?'':'Offline — dane lokalne są dostępne.';};
 window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
 if(isAndroidNative()||document.querySelector('meta[name="benger-native"]')?.content==='android'){check.hidden=true;install.hidden=true;update.hidden=true;banner.hidden=true;status.textContent='Benger Android — pliki aplikacji są na telefonie. Aktualizacje instalujemy z nowego APK, bez usuwania aplikacji.';return;}
 if(!('serviceWorker'in navigator)){check.hidden=true;status.textContent='Ta przeglądarka nie obsługuje trybu PWA. Dane dziennika nadal zapisujemy lokalnie.';return;}
 try{
  const registration=await navigator.serviceWorker.register(new URL('./service-worker.js',import.meta.url),{scope:'./',updateViaCache:'none'});
  const waiting=()=>{const available=Boolean(registration.waiting&&navigator.serviceWorker.controller);update.hidden=!available;banner.hidden=!available;if(available)status.textContent='Dostępna nowa wersja. Zapisz bieżący posiłek przed aktualizacją.';};
  let checking=false,lastCheck=0;
  const checkForUpdate=async(manual=false)=>{if(checking||!manual&&Date.now()-lastCheck<60000)return;if(!navigator.onLine){if(manual)status.textContent='Połącz się z internetem, aby sprawdzić aktualizacje.';return;}checking=true;check.disabled=true;lastCheck=Date.now();try{if(manual)status.textContent='Sprawdzam aktualizacje…';await registration.update();waiting();if(manual&&!registration.waiting)status.textContent=registration.installing?'Pobieram nową wersję. Nie musisz zamykać aplikacji.':'Masz aktualną wersję Bengera.';}catch{if(manual)status.textContent='Nie udało się sprawdzić aktualizacji. Spróbuj ponownie przy dostępnym połączeniu.';}finally{checking=false;check.disabled=false;}};
  check.onclick=()=>void checkForUpdate(true);
  window.addEventListener('focus',()=>void checkForUpdate());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkForUpdate();});
  update.addEventListener('click',async()=>{try{const current=await navigator.serviceWorker.getRegistration(new URL('./',import.meta.url));const worker=current?.waiting;if(!worker){status.textContent='Aktualizacja nie jest już oczekująca. Sprawdź ponownie po odświeżeniu.';return;}reloadRequested=true;worker.postMessage('ACTIVATE_UPDATE');}catch{reloadRequested=false;status.textContent='Nie udało się uruchomić aktualizacji. Spróbuj ponownie.';}});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{update.hidden=true;banner.hidden=true;if(reloadRequested)location.reload();});
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();if(worker.state==='redundant'&&!navigator.serviceWorker.controller)status.textContent='Nie udało się pobrać kompletu plików offline. Sprawdź połączenie i odśwież.';});});
  window.addEventListener('online',()=>void checkForUpdate(true));
  waiting();await navigator.serviceWorker.ready;await checkForUpdate();if(!registration.waiting)status.textContent='Gotowe offline — aplikacja i lokalny katalog zapisane na tym urządzeniu.';
 }catch{status.textContent='Nie udało się przygotować trybu offline. Sprawdź połączenie i odśwież stronę.';}
}
