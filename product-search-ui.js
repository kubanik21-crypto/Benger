import { navigate } from './navigation.js';
import { createBarcodeScanner } from './barcode-scanner.js';
import { initCustomProducts } from './custom-product-ui.js';
import { copyProduct, productSourceLabel } from './product-model.js';
import { createProductRepository } from './product-repository.js';
import { productErrorMessage } from './product-errors.js';
import { createProductResolver } from './product-resolver.js';

const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
const sourceName = productSourceLabel;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function thumbnail(product) {
  const box = element('span', 'product-thumbnail');
  box.setAttribute('aria-hidden', 'true');
  box.textContent = '◻';
  // Offline nie inicjujemy nowych żądań obrazków przy odświeżaniu list.
  if (product.imageUrl && navigator.onLine !== false) {
    const image = document.createElement('img');
    image.alt = ''; image.width = 56; image.height = 64;
    image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = product.imageUrl;
    box.append(image);
  }
  return box;
}

function details(product) {
  const box = element('span', 'product-details');
  const macros = product.per100;
  box.append(
    element('strong', 'product-name', product.name),
    element('span', 'product-brand', [product.brand, product.quantity].filter(Boolean).join(' · ') || 'Bez podanej marki'),
    element('span', 'product-macros', `${number.format(macros.kcal)} kcal · B ${number.format(macros.protein)} · T ${number.format(macros.fat)} · W ${number.format(macros.carbs)} g / 100 ${product.unit}`),
    element('span', 'product-source', sourceName(product)),
  );
  return box;
}

export function initProductSearch({ onSelect, repository = createProductRepository() }) {
  let favoriteIds = new Set();
  let results = [];
  let chosen = null;
  let resultsPhrase = null;
  const resolver = createProductResolver({ repository });
  let busy = false;
  let revision = 0;
  let refreshRevision = 0;
  const favoritePending = new Set();

  function favoriteButton(product) {
    const button = element('button', 'favorite-product button-secondary', favoriteIds.has(product.id) ? '★' : '☆');
    button.type = 'button';
    button.dataset.favoriteId = product.id;
    button.setAttribute('aria-pressed', String(favoriteIds.has(product.id)));
    button.setAttribute('aria-label', `${favoriteIds.has(product.id) ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}: ${product.name}`);
    button.disabled = favoritePending.has(product.id);
    button.addEventListener('click', async () => {
      if (favoritePending.has(product.id)) return;
      const origin = button.closest('ul')?.id ?? 'product';
      favoritePending.add(product.id); button.disabled = true;
      try {
        await repository.setFavorite(product, !favoriteIds.has(product.id));
        await refresh();
      } catch { $('catalog-message').textContent = 'Nie udało się zmienić ulubionych. Spróbuj ponownie.'; }
      finally {
        favoritePending.delete(product.id); renderAll();
        const replacement = [...$(origin).querySelectorAll('[data-favorite-id]')].find(item => item.dataset.favoriteId === product.id)
          ?? $(origin).querySelector('button') ?? $('product-search');
        replacement.focus({ preventScroll: true });
      }
    });
    return button;
  }

  function select(product, focus = true, phrase = null) {
    chosen = copyProduct(product);
    renderSelected();
    onSelect(copyProduct(chosen));
    // Uczymy wyłącznie jawnego kliknięcia użytkownika; resolve() nigdy sam nie uczy.
    if (phrase) void resolver.rememberUserChoice(phrase, chosen.id).catch(() => {
      $('catalog-storage-message').textContent = 'Nie udało się zapamiętać dopasowania. Wybrany produkt nadal można dodać do dziennika.';
    });
    if (focus) $('amount').focus();
  }

  function renderList(id, products, emptyMessage) {
    const container = $(id);
    container.replaceChildren();
    if (!products.length) container.append(element('li', 'field-help', emptyMessage));
    for (const product of products.slice(0, 20)) {
      const row = element('li', 'product-row');
      const choose = element('button', 'choose-product');
      choose.type = 'button'; choose.dataset.productId = product.id;
      choose.setAttribute('aria-label', `Wybierz ${product.name}${product.brand ? `, ${product.brand}` : ''}`);
      choose.append(thumbnail(product), details(product));
      choose.addEventListener('click', () => select(product, true, id === 'search-results' ? resultsPhrase : null));
      row.append(choose, favoriteButton(product));
      container.append(row);
    }
  }

  function renderSelected() {
    const container = $('product');
    container.replaceChildren();
    if (!chosen) { container.append(element('p', 'field-help', 'Wyszukaj lub wybierz produkt z katalogu powyżej.')); return; }
    const info = element('div', 'selected-product-info');
    info.append(thumbnail(chosen), details(chosen), favoriteButton(chosen));
    container.append(info);
    if (chosen.source === 'openfoodfacts') {
      const link = element('a', 'product-credit', 'Karta produktu i autorzy zdjęcia w Open Food Facts ↗');
      link.href = `https://world.openfoodfacts.org/product/${encodeURIComponent(chosen.sourceId)}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      container.append(link);
    }
    if (chosen.basis === 'legacy') container.append(element('p', 'field-help', 'Brak jednoznacznej podstawy ml. Używamy gramów, bez przeliczania gęstości.'));
    if (chosen.estimated) container.append(element('p', 'field-help', 'Źródło oznacza część wartości jako przybliżone.'));
  }

  let recent = [], favorites = [];
  function renderAll() {
    renderList('search-results', results, 'Wyniki pojawią się po wyszukaniu.');
    renderList('recent-products', recent, 'Dodane produkty znajdziesz tutaj.');
    renderList('favorite-products', favorites, 'Gwiazdka zapisuje produkt w ulubionych.');
    renderSelected();
    $('catalog-storage-message').textContent = repository.persistent() ? '' : 'Pamięć produktów jest niedostępna. Katalog, własne produkty, skróty, ostatnie i ulubione działają tylko do zamknięcia tej karty. Dziennik korzysta z oddzielnej pamięci.';
  }
  async function refresh() {
    const version = ++refreshRevision;
    const [used, starred, ids] = await Promise.all([repository.recentProducts(), repository.favoriteProducts(), repository.favoriteIds()]);
    if (version !== refreshRevision) return;
    recent = used; favorites = starred; favoriteIds = new Set(ids);
    renderAll();
  }

  function updateConnection() {
    $('catalog-connection').textContent = navigator.onLine === false ? productErrorMessage({ code: 'offline' }) : '';
  }
  async function lookup(event, byBarcode) {
    event.preventDefault();
    navigate('produkty');
    if (busy) return;
    const input = $(byBarcode ? 'barcode' : 'product-search');
    const value = input.value;
    const version = ++revision;
    busy = true;
    $('search-products').disabled = $('find-barcode').disabled = $('scan-barcode').disabled = true;
    $('create-from-barcode').hidden=true;
    searchByName.hidden=true;
    $('search-results').setAttribute('aria-busy', 'true');
    $('catalog-message').textContent = 'Szukam produktów…';
    try {
      const result = byBarcode ? await repository.getProductByBarcode(value) : await repository.searchProducts(value,{forceExternal:$('search-internet').checked,allowExternal:$('search-internet').checked,refreshExternal:$('search-internet').checked});
      if (version !== revision) return;
      results = byBarcode ? (result.product ? [result.product] : []) : result.products;
      if(byBarcode && !result.product) { $('create-from-barcode').hidden=false;searchByName.hidden=false; }
      resultsPhrase = byBarcode ? null : value.trim();
      if (!byBarcode) {
        const {resolution}=await resolver.resolveProductQuery(value,{allowExternal:false});
        if (version !== revision) return;
        if (resolution.product) results = [resolution.product, ...results.filter(product => product.id !== resolution.product.id)].slice(0, 20);
      }
      renderList('search-results', results, 'Brak pasujących produktów z kompletem wartości odżywczych. Spróbuj innej nazwy lub kodu.');
      if(result.error) {
        const reason=productErrorMessage(result.error);
        $('catalog-message').textContent=byBarcode&&!result.product&&result.status==='offline'
          ? 'Kod odczytany, ale do pobrania produktu potrzebne jest połączenie.'
          : `Nie udało się pobrać wyników z Open Food Facts. ${reason}`;
      } else if(byBarcode&&!result.product) {
        $('catalog-message').textContent='Nie znaleziono produktu o tym kodzie w Open Food Facts. Wyszukaj po nazwie lub utwórz własny produkt.';
      } else if(!byBarcode&&result.status==='online') {
        $('catalog-message').textContent=`${results.length} wyników: katalog + Open Food Facts. ${result.remoteCount===0?'Open Food Facts nie zwróciło pasujących produktów z kompletem wartości odżywczych. Spróbuj innej nazwy.':'Wybierz produkt i sprawdź porcję.'}${result.rejectedCount?` Pominięto ${result.rejectedCount} produktów z niepełnymi lub nieprawidłowymi danymi.`:''}`;
      } else {
        $('catalog-message').textContent=results.length ? `Znalezione produkty: ${results.length}. ${result.status==='cached'?'Wyniki Open Food Facts z pamięci wcześniejszego zapytania.':'Wyniki zapisane na urządzeniu.'} Wybierz produkt i sprawdź porcję.` : 'Brak wyników lokalnych. Zmień nazwę lub włącz wyszukiwanie Open Food Facts.';
      }
    } catch (error) {
      if (version === revision) { results = []; renderList('search-results', [], 'Zmień zapytanie i spróbuj ponownie.'); $('catalog-message').textContent = productErrorMessage(error); }
    } finally {
      busy = false;
      $('search-products').disabled = $('find-barcode').disabled = $('scan-barcode').disabled = false;
      $('search-results').setAttribute('aria-busy', 'false');
      updateConnection();
    }
  }
  const customUi=initCustomProducts({repository,onChanged:refresh,onSelect:product=>select(product)});
  const searchByName=element('button','button-secondary','Wyszukaj po nazwie');searchByName.id='search-by-name';searchByName.type='button';searchByName.hidden=true;
  $('create-from-barcode').after(searchByName);
  searchByName.onclick=()=>{$('product-search').focus();$('product-search').scrollIntoView({block:'center'});};
  $('create-from-barcode').onclick=()=>customUi.open(null,$('barcode').value);
  const scanner=createBarcodeScanner({video:$('scanner-video'),onCode:code=>{
    $('scanner-dialog').close();$('barcode').value=code;void lookup({preventDefault(){}},true);
    $('product-catalog').scrollIntoView({behavior:'smooth',block:'start'});
  },onError:message=>{$('scanner-status').textContent=message;}});
  $('scan-barcode').onclick=()=>{$('scanner-status').textContent='Umieść kod w ramce.';$('scanner-dialog').showModal();void scanner.start();};
  $('cancel-scanner').onclick=()=>{scanner.stop();$('scanner-dialog').close();};
  $('scanner-dialog').addEventListener('close',()=>{if(!$('scanner-dialog').open)scanner.stop();});
  $('scanner-dialog').addEventListener('cancel',()=>scanner.stop());
  window.addEventListener('pagehide',()=>scanner.stop());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){scanner.stop();if($('scanner-dialog').open)$('scanner-dialog').close();}});
  for (const id of ['product-search', 'barcode']) $(id).addEventListener('input', () => {
    revision++;
    if (busy) $('catalog-message').textContent = 'Zapytanie zmienione. Po zakończeniu kliknij „Szukaj” lub „Znajdź”.';
  });
  $('product-search-form').addEventListener('submit', event => lookup(event, false));
  $('barcode-form').addEventListener('submit', event => lookup(event, true));
  window.addEventListener('offline', updateConnection);
  window.addEventListener('online', updateConnection);
  window.addEventListener('benger:route',event=>{if(event.detail.route==='produkty')void refresh();});
  window.addEventListener('focus', () => { void refresh(); });
  updateConnection();
  const ready = (async () => { await repository.ready(); await refresh(); $('product-catalog').dataset.ready = 'true'; })();
  return {
    ready,
    async recordUsed(products) { await repository.markUsed(products); await refresh(); },
    async seedRecent(entries) { await ready; await repository.seedRecentFromDiary(entries); await refresh(); },
  };
}
