let renderNavigation=null;
export const ROUTES={trening:'Trening',dziennik:'Dziennik',przepisy:'Przepisy',produkty:'Produkty',progres:'Progres',historia:'Historia',wiecej:'Więcej',cele:'Cele',dane:'Dane i backup',ustawienia:'Ustawienia','o-aplikacji':'O Bengerze'};
export function routeFromHash(hash){const key=hash.replace(/^#\/?/,'');return key==='trening/kalendarz'?'trening':Object.hasOwn(ROUTES,key)?key:'dziennik';}
export function navigate(route){if(!Object.hasOwn(ROUTES,route))route='dziennik';if(location.hash!==`#/${route}`)location.hash=`/${route}`;renderNavigation?.();}
export function initNavigation({startRoute='dziennik'}={}){
 if(!location.hash&&Object.hasOwn(ROUTES,startRoute))history.replaceState(null,'',`#/${startRoute}`);
 let current=null;
 function render(){const route=routeFromHash(location.hash);if(location.hash!==`#/${route}`&&location.hash!=='#/trening/kalendarz')history.replaceState(null,'',`#/${route}`);if(current===route)return;
  for(const section of document.querySelectorAll('[data-app-section]'))section.hidden=section.dataset.appSection!==route;
  for(const link of document.querySelectorAll('a[data-route]')){if(link.dataset.route===(link.closest('#app-nav')&&['cele','dane','ustawienia','o-aplikacji','produkty','historia'].includes(route)?'wiecej':route))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  document.title=`Benger · ${ROUTES[route]}`;
  if(current!==null&&current!==route)window.scrollTo(0,0);
  if(current!==null&&current!==route)document.querySelector(`[data-app-section="${route}"] [data-route-heading]`)?.focus({preventScroll:true});
  const previous=current;current=route;document.documentElement.dataset.route=route;window.dispatchEvent(new CustomEvent('benger:route',{detail:{route,previous}}));
 }
 renderNavigation=render;window.addEventListener('hashchange',render);render();return {navigate,current:()=>current};
}
