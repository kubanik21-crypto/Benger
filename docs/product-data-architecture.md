# Dane produktów Bengera — Etap 3

Ten etap dotyczy katalogu i integracji danych, nie wcześniejszego projektu przebudowy „Web Experience”. Aplikacja pozostaje statycznym HTML/CSS/JS, bez sekretów, kont i backendu żywieniowego.

## Przepływ i odpowiedzialności

```text
index.html + app.js (porcja i dziennik)
        ↓
product-search-ui.js (wyszukiwanie, wybór, gwiazdki)
        ↓
product-repository.js (łączenie wyników, offline, limity)
        ├── product-providers/usda.js → statyczny katalog USDA
        ├── product-providers/custom.js → własne produkty
        ├── product-providers/open-food-facts.js → lookup OFF API v3.6
        ├── product-providers/off-search.js → full-text CGI, wymienny adapter
        └── product-cache.js → IndexedDB BengerDB v2
```

`product-model.js` waliduje i kopiuje produkty oraz deduplikuje wyniki. `product-errors.js` przekłada błędy na komunikaty. Wyłącznie adaptery OFF używają wspólnego klienta `off-http.js` do zewnętrznego `fetch`. UI nie zna formatu odpowiedzi OFF, a dziennik nie pobiera produktu przy renderowaniu historii.

Lookup provider udostępnia `getProductByBarcode(barcode, {signal})`. Niezależny search provider ma `{id, searchProducts(query, {signal})}`. Oba zwracają wyłącznie model Bengera i można je osobno wstrzyknąć do fabryki repozytorium. UI korzysta z `repository.searchProducts()` / `getProductByBarcode()`, nie z endpointu. Klucz cache zapytania zawiera ID adaptera, więc przyszła zmiana wyszukiwarki nie użyje świeżych wyników innego backendu.

Lokalny provider ma `list()` i `getById(id)`. Repozytorium zwraca `{products, status, error}` lub `{product, status, error}`; `status`: `online`, `cached`, `offline`, `fallback`. Udostępnia także ostatnie, ulubione, odczyt produktu po ID i pamięć jawnych wyborów. Błąd internetu nie usuwa lokalnych wyników. Nowe źródło wymaga adaptera i analizy licencji, bez mieszania surowych baz.

## Kanoniczny produkt

```js
{
  id: 'off:05901234123457', // przykład testowy, GTIN dopełniony do 14 cyfr
  source: 'openfoodfacts', // albo benger
  sourceId: '5901234123457',
  barcode: '5901234123457', // null, gdy kod nie jest prawidłowym GTIN
  name: 'Nazwa produktu',
  brand: null,
  unit: 'ml', // wyłącznie g albo ml
  basis: 'declared', // albo legacy: brak jawnej podstawy ml
  estimated: false,
  per100: { kcal: 50, protein: 3.4, fat: 2, carbs: 4.8 },
  imageUrl: null,
  quantity: null, // opis opakowania, nigdy mnożnik obliczeń
  updatedAt: null // data zmiany w źródle, niezależna od fetchedAt
}
```

Wartości muszą być skończonymi nieujemnymi liczbami; komplet czterech pól jest obowiązkowy. Brak danych nie jest zerem. Wartości na 100 g mają kontrolę zakresu: makro do 100 g, ich suma do 101 g (tolerancja zaokrąglenia etykiety), kcal do 1000. Limit masy nie jest stosowany do 100 ml: bez znajomości gęstości byłby nieuprawniony. Nie weryfikujemy prawdziwości etykiety ani nie wyliczamy kcal z makro.

ID lokalnych produktów pozostają niezmienione. OFF ma stabilny prefiks `off:` i znormalizowany GTIN; produkty ze źródłowym kodem niebędącym GTIN zachowują `sourceId` i mają `barcode: null`. EAN-8, UPC-A, EAN-13 i GTIN-14 są przyjmowane jako tekst z zachowaniem zer oraz sprawdzaną cyfrą kontrolną. EAN-13 i równoważny UPC są deduplikowane. Różne kody o tej samej nazwie nie są scalane.

`calculatePortion(product, amount)` obsługiwało już `{unit, per100}`. Nie zmieniono `nutrition.js` ani jego testów. Wzór i zaokrąglenia nie są kopiowane do repozytorium/UI. Podsumowanie dnia nadal używa `sumNutrition()`.

## API i zweryfikowany schemat

Weryfikacja: 2026-10-24, oficjalny `openfoodfacts/openfoodfacts-server`, commit [`54ea7c917eca14077b907ac7ad0cbbd63b5e3d02`](https://github.com/openfoodfacts/openfoodfacts-server/tree/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02).

- [Dokumentacja API i limity](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/).
- [Oficjalne docs/api/index.md](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/docs/api/index.md).
- [Różnice wyszukiwania](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/docs/api/ref-cheatsheet.md).
- [Schemat nutrition v3](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/docs/api/ref/schemas/product_nutrition_v3.yaml).

Wyszukiwanie po nazwie używa oficjalnego `/cgi/search.pl`, parametrów `search_terms`, `search_simple=1`, `action=process`, `json=1`, `api_version=3.6`, `lc=pl`, `page=1`, `page_size=20`. CGI nadal obsługuje pełny tekst i wybór schematu `api_version`; `/api/v2/search` i `/api/v3/search` nie zastępują go jako wyszukiwarka pełnotekstowa. Nie używamy nieudokumentowanego `search_terms` na tych endpointach. CGI jest nadal udokumentowaną drogą pełnotekstową. Search-a-licious ma endpoint `/search` i inny schemat `hits`. W pomiarze właściciela nie zwrócił czytelnej odpowiedzi; otwarte zgłoszenia #427 (CORS) i #469 (aktualność indeksu) dodatkowo przemawiają za pozostawieniem CGI. Źródła i zakres potwierdzenia opisuje audyt produkcyjny.

Pojedynczy kod: `GET /api/v3.6/product/{barcode}`. Wersja 3.6 jest bieżącą rekomendacją OFF dla nowych integracji. Używamy `brands_tags_pl` generowanego przez serwer dla nazw marek; nie wymagamy usuniętych `brands_hierarchy`/`brands_lc` ani technicznego pola `brands`. Stare odpowiedzi z `brands` są tolerowane jedynie przez adapter kompatybilności. Nie zakładamy automatycznej zgodności przyszłych zmian API.

Oba endpointy ograniczają `fields` do:

- `code`, `product_name`, `product_name_pl`, `brands_tags_pl`, `quantity`;
- `image_front_small_url`, `last_modified_t`;
- `nutrition.aggregated_set.per`, `nutrition.aggregated_set.preparation`;
- `nutrition.aggregated_set.nutrients.energy-kcal`, `.proteins`, `.fat`, `.carbohydrates`.

Serwer OFF obsługuje zagnieżdżone pola przez notację kropkową. Nie pobieramy `input_sets`, wszystkich składników ani pełnych danych produktu. Nie potrzebujemy `serving_size`, ponieważ użytkownik jawnie wpisuje porcję.

Dla v3 wymagamy `per: 100g | 100ml`, `preparation: as_sold`, wartości `.value` i jednostek `.unit` (`kcal` / `g`). Przybliżenie `~` jest oznaczane w UI, a nierówności `<`, `>` są odrzucane. Stare odpowiedzi/fixture można normalizować z `nutriments.energy-kcal_100g`, `proteins_100g`, `fat_100g`, `carbohydrates_100g`; nie są one domyślnie żądane w API v3.6.

**Jednostki:** tylko jawne `100ml` oznacza ml. Starsza odpowiedź bez tej informacji oznacza g i dostaje ostrzeżenie `legacy`. Opakowanie „1 l”, nazwa „mleko” i `nutrition_data_per` nie stanowią dowodu gęstości. Nie przyjmujemy 100 ml = 100 g i nie mieszamy danych `prepared` z `as_sold`.

Pomiar w przeglądarce właściciela z GitHub Pages, 24.10.2026: CGI Accept-only zwróciło 19 znormalizowanych produktów, HTTP 200 i czytelny CORS. Odczyt kodu `3017620422003` także zadziałał. To rzeczywiste dane z raportu użytkownika, oddzielne od fikcyjnych fixture CI. Środowisko Codexa nadal otrzymuje CONNECT 403 przed połączeniem z OFF; nie może samodzielnie potwierdzić pełnego przepływu produkcyjnego.

## CORS i identyfikacja aplikacji

Bezpośredni browser → OFF, bez kluczy, proxy i płatnych usług. Każdy fetch ma `mode: cors`, `credentials: omit`, `Accept: application/json`.

- **CGI search:** tylko Accept, bez custom headera. To CORS-safelisted request, który sam nie wymaga preflight. W produkcyjnym porównaniu A/B/C/D jedynie ten wariant zwrócił produkty. Nie jest to gwarancja dostępności legacy usługi.
- **Barcode v3.6:** dodatkowo `X-User-Agent: Benger/0.3 (https://github.com/kubanik21-crypto/Benger)`, z preflight. Ten transport był udany w realnym teście właściciela i pozostaje bez zmian.

Oficjalna [konfiguracja CORS](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/conf/nginx/snippets/cors-headers.include) dopuszcza X-User-Agent, a oficjalny test sprawdza OPTIONS na API v2. Kod CGI także ma obsługę OPTIONS. Nie dowodzi to sprawności każdego wdrożenia/endpointu. Wariant bez żadnych dodatkowych nagłówków również zawiódł, więc nie przypisujemy awarii wyłącznie preflightowi bez pomiaru OPTIONS.

Ogólny przewodnik OFF rekomenduje custom User-Agent; nie znaleziono ogólnego zalecenia, że X-User-Agent go zastępuje w browserowym READ. Parametr User-Agent opisany dla WRITE nie jest przenoszony na GET. Search korzysta ze standardowego UA przeglądarki oraz Origin/Referer; nie zawiera osobnego identyfikatora Benger. Nie nazywamy samego Accept identyfikacją aplikacji. Właściciel powinien zgłosić integrację przez formularz OFF i opisać to ograniczenie. Nie wysłano formularza w jego imieniu. Jeżeli dostawca zażąda custom UA serwera, niezależny adapter search umożliwi mały ograniczony proxy; obecny udany odczyt nie uzasadnia nowego backendu.

Mocki Chromium używają natywnego fetch i kontrolowanych odpowiedzi CORS przez CDP. Sprawdzają zachowanie aplikacji, nie bieżący CORS produkcyjnego OFF. Pełny raport, źródła i status Search-a-licious: [off-production-audit.md](off-production-audit.md).

## Cache, ostatnie i ulubione

IndexedDB `BengerDB`, wersja 2. Upgrade dodaje store, bez usuwania rekordów wersji 1:

| Store | Zawartość |
| --- | --- |
| `products` | Wyłącznie OFF: `{key: product.id, product, fetchedAt}`. Bez surowego JSON. |
| `usage` | Referencja `key` do produktu, `favorite`, `favoriteAt`, `lastUsedAt`, `order`. Nie drugi katalog. |
| `searches` | Znormalizowany query, ID produktów OFF, `fetchedAt`. Pusta lista też jest wynikiem. |
| `meta` | Rezerwacje limitów zapytań i licznik kolejności użycia. |
| `selections` | Znormalizowana fraza → lista `{productId, count, lastUsedAt}`, bez dziennika i surowych odpowiedzi API. |

Rewizja cache 2 unieważnia świeżość kopii z poprzedniego providera 3.5 i wcześniejszych zapytań, bez usuwania produktów, referencji ani historii. Produkty są świeże przez **7 dni**, wyniki zapytania przez **15 minut**. Kod kreskowy korzysta ze świeżego produktu także wtedy, gdy pochodzi on z wcześniejszego wyszukiwania. Ulubienie i użycie **nie odnawiają** daty pobrania. Przeterminowane kopie są nadal użyteczne w trybie offline i podczas błędów; nowy odczyt kodu online próbuje je odświeżyć. Czas z przyszłości nie jest uznawany za świeży.

Maksymalnie 300 zwykłych produktów OFF, 50 zapytań; ulubione, ostatnie 20 oraz produkty z pamięci wyborów są chronione przed usunięciem przez limit cache. Ulubione mogą zwiększać rozmiar pamięci. UI pokazuje do 20 ostatnich i 20 ostatnio oznaczonych ulubionych; pozostałe ulubione można odnaleźć przez wyszukiwanie lokalne. Nie pobieramy pełnych obrazów ani base64: tylko URL miniaturki.

Ostatnie są aktualizowane dopiero po udanym zapisie do dziennika. Kolejność rozstrzyga czas i transakcyjny licznik (także przy dwóch wpisach w tej samej milisekundzie). Starszy dziennik może jednorazowo zasilić referencje ostatnich lokalnymi produktami, bez przepisywania historii. Gwiazdki nie dodają wpisów do dziennika. Po odświeżeniu i po powrocie do karty odczytywane są bieżące preferencje.

Produkty Bengera pozostają wyłącznie w oddzielnym providerze kodowym, a zbiór OFF w `products`. Połączona lista UI jest tworzona w pamięci. Nie zapisujemy mieszanej bazy katalogowej. Deduplikacja wykorzystuje równoważny GTIN albo parę `source + sourceId`; samo podobieństwo nazwy nie wystarcza do scalenia marek/wariantów.

Niedostępne/zablokowane IndexedDB daje pamięć awaryjną tylko w bieżącej karcie i jawne ostrzeżenie. Limiter w takim trybie działa tylko dla tej instancji. Dziennik nadal niezależnie używa localStorage. Uszkodzone rekordy cache są pomijane, nie kasujemy całej bazy. Brak miejsca nie usuwa dziennika.

## Pamięć wyborów i ProductResolver

`normalizeFoodQuery()` ujednolica wielkość liter, polskie znaki, odstępy i `2 procent` / `2,0%` → `2%`. Dopasowanie bez pamięci używa pełnych tokenów nazwy i marki: `Pilos` nie pasuje do `Superpilos`, a `2%` do `12%`. Nie wnioskuje procentu z makro.

`createProductResolver({repository}).resolve(intent, {allowExternal: false})` zwraca `{product, confidence, alternatives, reason, requiresConfirmation}`. Najpierw sprawdza barcode, potem wcześniejszy wybór frazy, ostatnie, ulubione i katalog/cache. Dopiero jawne `allowExternal: true` może użyć repozytorium search. Jednostka musi się zgadzać. HIGH oznacza dokładny kod lub dominujący wybór (co najmniej 2 wybory i 75% zgodnej historii); MEDIUM to jeden wcześniejszy wybór albo jedyny zgodny wynik; LOW pozostawia produkt pusty i zwraca do 5 alternatyw. Każdy wynik wymaga zatwierdzenia. To reguły priorytetu, nie statystyczna pewność etykiety.

Wyszukiwarka promuje wskazany produkt na liście bez automatycznego wyboru. `rememberUserChoice(query, productId)` odczytuje prawdziwy Product i dopiero wtedy zapisuje pamięć. UI uczy po jawnym kliknięciu wyniku; `resolve()` nie uczy i nie zmienia dziennika. Pamięć obejmuje najwyżej 200 fraz po 5 produktów. Liczniki są transakcyjne w IndexedDB także między kartami. Powiązany produkt jest chroniony przed czyszczeniem zwykłego cache; nauczenie frazy nie odnawia jego TTL.

`meal-resolution.js` przetwarza do 20 gotowych intencji, zachowuje osobne wiersze i pozwala potwierdzić tylko jeden. Domyślnie nie łączy się z siecią; opcjonalny budżet to najwyżej jeden zewnętrzny search na propozycję. Makro pochodzi wyłącznie z Product i `calculatePortion()` / `sumNutrition()`. Nie przyjmuje makro parsera. Moduł nie jest jeszcze nowym interfejsem tekstowym ani mikrofonem. Kontrakty: [voice-first-architecture.md](voice-first-architecture.md).

## Rate limits i błędy

Zweryfikowana dokumentacja OFF podaje obecnie 10 wyszukiwań/min/IP i 15 odczytów produktów/min/IP. Dlatego przerwy wynoszą odpowiednio **6500 ms** i **4500 ms**. Rezerwacje IndexedDB są transakcyjne i współdzielone między kartami na tym samym origin. Ten sam aktywny query współdzieli request, świeży wynik nie wykonuje ponownego fetch, a przycisk jest zablokowany na czas operacji. Nie ma zapytań przy pisaniu, automatycznych retry ani obchodzenia limitów.

HTTP 429 blokuje kolejne zapytania obu typów na co najmniej 60 s, dłużej gdy dostępny jest `Retry-After`. Oficjalny CORS nie eksponuje tego nagłówka: w takim środowisku frontend stosuje bezpieczne minimum 60 s, a dalsze 429 ponownie blokuje zapytania. IP może być wspólny z innymi aplikacjami/urządzeniami, więc lokalny limiter nie gwarantuje uniknięcia 429.

Każdy odczyt ma deadline **10 s**, obejmujący JSON; `AbortController` kończy request. Błędy rozróżniają 429, 5xx, timeout, sieć, niepoprawny JSON, niekompletny produkt i brak wyników. Użytkownik widzi komunikat, nie stack trace. Gdy query zmieni się podczas pobierania, poprzednia odpowiedź nie zastępuje wyników nowego query. Nie zapisujemy niekompletnych produktów.

## Snapshot dziennika i parser

Klucz `benger.nutrition.v1` bez zmiany. Nowe wpisy rozszerzają dotychczasowy model o `brand`, `source`, `sourceId`, `barcode` (null jest dozwolone). Zawierają też `id`, `date`, `createdAt`, `meal`, `productId`, `productName`, `amount`, `unit`, kopię `nutrition`. Nie zawierają surowego OFF ani zdjęć. Historyczne wpisy bez nowych metadanych nadal działają. Renderowanie i sumowanie historii nie zagląda do katalogu.

Notatki `benger.meals.v1` pozostają oddzielne. Świadomie pozostaje wcześniej zaakceptowany race condition przy dokładnie jednoczesnym odczycie i zapisie całego dziennika localStorage. Transakcje cache nie zmieniają tego ograniczenia dziennika.

Parser Etapu 2 przyjmuje opcję `products`, ale zachowuje dotychczasowe cztery aliasy/ID. Aplikacja przekazuje kanoniczny katalog lokalny; parser nie wyszukuje w OFF i nie próbuje zgadywać marek z dowolnego tekstu. Brak AI i brak integracji nowego dziennika z mikrofonem.

## Offline i hosting

Aplikacja już załadowana działa bez OFF: dziennik, podstawowe produkty, cache, ostatnie i ulubione. Komunikat: „Brak połączenia. Pokazuję produkty zapisane lokalnie.” Awaria internetu przy `navigator.onLine === true` jest również przechwytywana. To nie gwarantuje świeżości danych ani dostępności zdjęć; brak zdjęcia pokazuje placeholder.

**Nie dodano service workera.** Uruchomienie/odświeżenie całej aplikacji bez sieci nie jest gwarantowane. Cache produktów nie jest offline shellem PWA. Dane są przypisane do origin, nie konta. Zmiana domeny/protokołu/portu nie przenosi danych. Czyszczenie danych przeglądarki usuwa je.

Wszystkie importy i odwołania frontendowe są względne; provider ma absolutny adres zewnętrznego OFF. Hosting statyczny pod `/` i `/Benger/` nie potrzebuje `server.js`. Listę publicznych plików definiuje `scripts/public-assets.mjs`, wspólny dla buildera i testów. Zachowujemy strukturę `product-providers` i dołączamy `app-storage.js`. Pliki `*.test.js`, fixture, docs i konfiguracja serwera nie są potrzebne. Preview jest publikowane wyłącznie do `gh-pages/previews/etap-3/`. Root hostingu zachowuje poprzednie pliki. Preview ma osobne localStorage i IndexedDB poprzez metadane dokumentu; nie udaje, że podkatalog sam izoluje pamięć przeglądarki.

## Licencja i prywatność

Dane pochodzą od **Open Food Facts i współtwórców**:

- baza: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/);
- poszczególna zawartość: [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1-0/);
- zdjęcia: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), autorzy powiązani z kartą produktu; mogą zawierać chronione oznaczenia opakowań.

Aplikacja ma atrybucję, odnośniki do licencji i kartę wybranego produktu. Miniaturki są wyświetlane bez modyfikacji z HTTPS `images.openfoodfacts.org`, z `referrerPolicy=no-referrer`; nie kopiujemy zdjęć do repozytorium. Dane zewnętrzne wstawiane są przez `textContent`; URL zdjęć ma allowlistę hosta i ścieżki. Niedostępne obrazki są zastępowane placeholderem.

Separacja zbiorów nie znosi obowiązków licencyjnych. Przyszłe publiczne eksporty, redystrybucja/zmodyfikowane bazy i mieszanie źródeł wymagają ponownej oceny atrybucji, ODbL i share-alike. Ten etap nie publikuje nowej zbiorczej bazy. Oficjalny [poradnik cache](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/creating-a-local-cache-of-the-open-food-facts-database/) omawia oddzielne przechowywanie OFF.

OFF otrzymuje wyszukiwaną frazę/kod i standardowe dane połączenia; odczyt barcode zawiera ponadto X-User-Agent Bengera; serwer zdjęć otrzymuje zapytania o miniaturki. Nie przesyłamy dziennika ani notatek. Brak sekretów i płatnych usług; pozostają koszty/ograniczenia ewentualnego przyszłego hostingu.

## Weryfikacja i następne źródła

`npm test`: model, walidacja/nazwy/liczby, g/ml, normalizacja, barkody, deduplikacja, TTL, ostatnie, ulubione, limity i typy błędów oraz regresje obliczeń/parsera/serwera. API jest mockowane.

`npm run test:browser`: prawdziwy Chromium, natywny fetch z odpowiedziami CDP, rzeczywiste IndexedDB, / i /Benger/, wybór/porcja/dziennik, reload/offline, gwiazdki, barcode, timeout/429/5xx/bad JSON, brak IndexedDB, dwie karty, uszkodzony cache, XSS i layout 320–1440 px. Nie używa produkcyjnego OFF ani danych użytkownika.

Kolejne źródła (USDA, polska baza, katalog użytkownika) powinny mieć własną przestrzeń ID, adapter, testy jednostek i analizę licencji. Kamera może korzystać z istniejącego `getProductByBarcode`, a przyszła interpretacja tekstu z ProductResolver i modułu propozycji. Żadnej z tych funkcji nie implementuje Etap 3.


Ponowny audyt produkcyjny, źródła dotyczące identyfikacji i procedura preview/live: [off-production-audit.md](off-production-audit.md).

Aktualizacja Etapu 6: dawny provider i cztery produkty demonstracyjne zostały usunięte. Aktualny opis: [product-catalog.md](product-catalog.md). Dawne ID pozostają tylko referencjami zgodności; dziennik korzysta z własnych snapshotów.
