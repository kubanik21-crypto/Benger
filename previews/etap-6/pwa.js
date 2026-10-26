export async function initPwa(){
 const status=document.getElementById('pwa-status'),install=document.getElementById('install-app'),update=document.getElementById('update-app');
 let prompt=null,reloadRequested=false;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();if(standalone())return;prompt=event;install.hidden=false;});
 install.addEventListener('click',async()=>{if(!prompt)return;await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;});
 window.addEventListener('appinstalled',()=>{install.hidden=true;status.textContent='Benger został zainstalowany.';});
 const connection=()=>{document.getElementById('connection-status').textContent=navigator.onLine?'':'Brak połączenia. Dziennik i zapisany katalog działają lokalnie; rozpoznawanie mowy może wymagać sieci.';};
 window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
 if(!('serviceWorker'in navigator)){status.textContent='Ta przeglądarka nie obsługuje trybu PWA. Dane dziennika nadal zapisujemy lokalnie.';return;}
 try{
  const registration=await navigator.serviceWorker.register(new URL('./service-worker.js',import.meta.url),{scope:'./',updateViaCache:'none'});
  const waiting=()=>{if(registration.waiting){update.hidden=false;status.textContent='Dostępna nowa wersja. Zapisz bieżący posiłek przed aktualizacją.';}};
  update.addEventListener('click',()=>{reloadRequested=true;registration.waiting?.postMessage('ACTIVATE_UPDATE');});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadRequested)location.reload();});
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();if(worker.state==='redundant'&&!navigator.serviceWorker.controller)status.textContent='Nie udało się pobrać kompletu plików offline. Sprawdź połączenie i odśwież.';});});
  waiting();await navigator.serviceWorker.ready;if(!registration.waiting)status.textContent='Gotowe offline — aplikacja i lokalny katalog zapisane na tym urządzeniu.';
 }catch{status.textContent='Nie udało się przygotować trybu offline. Sprawdź połączenie i odśwież stronę.';}
}
