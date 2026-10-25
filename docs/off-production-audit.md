# Audyt produkcyjny OFF i preview PR #3

Aktualizacja: 2026-10-25. Gałąź `etap-3-katalog-produktow`, PR #3 bez merge. Oddzielamy źródła oficjalne, pomiar użytkownika na Pages oraz mockowane testy aplikacji.

## Ponownie sprawdzone źródła oficjalne

Pobrano aktualny `main` serwera OFF: [54ea7c917eca14077b907ac7ad0cbbd63b5e3d02](https://github.com/openfoodfacts/openfoodfacts-server/tree/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02). Źródła i odnośniki:

| Temat | Oficjalne źródło | Wniosek |
| --- | --- | --- |
| Wersja, limity, rejestracja | [docs/api/index.md](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/docs/api/index.md) | v3.6 dla nowych integracji; 10 search/min/IP i 15 product read/min/IP. |
| Zmiany 3.6 | [changelog](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/docs/api/ref-api-and-product-schema-change-log.md) | `tags_sources`; usunięte `*_hierarchy`/`*_lc`; nie jest to zmiana jednostek nutrition. |
| Nutrition | [schema v3](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/docs/api/ref/schemas/product_nutrition_v3.yaml), `product_nutrition_properties.yaml`, `nutrients_v3_with_source.yaml` | `nutrition.aggregated_set`, jawne `per`, `preparation`, nutrient `value`/`unit`. |
| Nazwy marek | [API.pm](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/lib/ProductOpener/API.pm), `product_base_tags.yaml` | Serwer obsługuje pola lokalizowane `*_tags_[lc]`; żądamy `brands_tags_pl`. Surowe `brands` ma w schemacie ostrzeżenie przed użyciem do wyświetlania. |
| Full-text CGI | [cgi/search.pl](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/cgi/search.pl), `ref-cheatsheet.md` | Obsługuje `search_terms`, `fields`, `json`, `api_version`. |
| CORS | [cors-headers.include](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/conf/nginx/snippets/cors-headers.include), [cors.t](https://github.com/openfoodfacts/openfoodfacts-server/blob/54ea7c917eca14077b907ac7ad0cbbd63b5e3d02/tests/integration/cors.t) | `X-User-Agent` jest dopuszczony i ma oficjalny test OPTIONS. Zewnętrzny origin bez credentials otrzymuje `*`. |

Sprawdzono także oficjalny [SDK JS, commit 9abd3cb](https://github.com/openfoodfacts/openfoodfacts-js/tree/9abd3cb5961e3ff5954c884e850d805c128126be) oraz [Search-a-licious, commit 1fd2494](https://github.com/openfoodfacts/search-a-licious/tree/1fd2494f307e03a66294500a62a38fd4c31d4745).

Źródła odczytano przez Git. Dokumentacja/API po HTTP są objęte blokadą proxy tego środowiska. Zapisana odpowiedź integracyjna OFF v3.6 potwierdza strukturę agregatu; nie jest dowodem aktualnej odpowiedzi produkcyjnej.

## Produkcyjny pomiar A/B/C/D

Źródło: raport przekazany przez właściciela po uruchomieniu diagnostyki na GitHub Pages; `checkedAt: 2026-10-24T17:15:20.754Z`. Zapytanie: `mleko 2%`. A/B/C mają identyczny URL CGI, te same pola i schemat 3.6; zmieniają nagłówki.

| Wariant | Nagłówki aplikacji | HTTP dostępne dla JS | Czytelny CORS | Preflight wymagany przez nagłówki |
| --- | --- | --- | --- | --- |
| A, CGI | Accept + X-User-Agent | brak | nie | tak |
| B, CGI | brak dodatkowych | brak | nie | nie |
| C, CGI | tylko Accept: application/json | **200, 19 produktów** | **tak** | nie |
| D, Search-a-licious | brak dodatkowych | brak | nie | nie |

Raport nie zawiera statusu OPTIONS. Brak HTTP oznacza odrzucony fetch, nie dowodzi konkretnego statusu serwera. **Nie ma podstaw, by uznać sam preflight za udowodnioną przyczynę**, ponieważ B także zawiódł. Standardowy Accept zmienia negocjację treści; pomiar wskazuje skuteczny wariant transportu, ale pojedyncza sekwencja nie wyklucza chwilowej awarii, filtrowania lub różnic cache serwera. Nie deklarujemy potwierdzenia takich hipotez bez dodatkowego pomiaru.

Oficjalny `cgi/search.pl` obsługuje OPTIONS; Nginx dodaje CORS także w `/cgi/`. Dlatego zdanie „legacy CGI nie implementuje OPTIONS” byłoby niezgodne z kodem źródłowym. Kod źródłowy nie gwarantuje aktualnej konfiguracji produkcji.

Wcześniejszy raport tego samego właściciela potwierdził `/api/v3.6/product/3017620422003`: **HTTP 200, czytelny CORS, znormalizowana Nutella, makro i działające zdjęcie**. W obecnym raporcie A/B/C/D nie podano ponownie jej wartości odżywczych, więc ich nie dopisujemy.

### Rzeczywiste produkty z raportu C

Dane poniżej pochodzą z OFF i jego współtwórców, nie z fikcyjnych fixture CI ani z nowego lokalnego katalogu. Wartości: kcal / białko / tłuszcz / węglowodany na 100 wskazanej jednostki.

| Produkt | Marka | Barcode | Jednostka | kcal / B / T / W | Miniaturka OFF |
| --- | --- | --- | --- | --- | --- |
| ALPSKO mleko | LJUBLJANSKE MLEKARNE | 3838800040578 | ml | 64 / 3,3 / 3,5 / 4,7 | [zdjęcie](https://images.openfoodfacts.org/images/products/383/880/004/0578/front_en.35.200.jpg) |
| Mleko wiejskie świeże 2% | Piątnica | 5901939000770 | ml | 50 / 3,2 / 2 / 4,8 | [zdjęcie](https://images.openfoodfacts.org/images/products/590/193/900/0770/front_pl.15.200.jpg) |
| Müller Müllermilch Bananowy Napój Mleczny 400 G | Müller | 4025500135614 | g | 74 / 3,1 / 1,4 / 12,2 | [zdjęcie](https://images.openfoodfacts.org/images/products/402/550/013/5614/front_pl.6.200.jpg) |

Raport dowodzi obecności URL zdjęć, nie testuje osobno pobrania każdej z tych trzech miniaturek. Wyniki full-text są szerokie: ALPSKO nie ma 2% w nazwie, a napój bananowy jest innym produktem. Resolver nie wylicza wariantu z zawartości tłuszczu ani nie traktuje wszystkich wyników search jako równoważnych.

Dla wybranego mleka Piątnica **200 ml = 100 kcal, B 6,4 g, T 4 g, W 9,6 g**. To oczekiwane wartości do końcowego testu interfejsu, nie oświadczenie o wykonaniu zapisu na produkcji przez Codexa.

## Search-a-licious: stan i decyzja

Sprawdzany endpoint: `GET https://search.openfoodfacts.org/search?q=mleko+2%25&langs=pl,en&page=1&page_size=5&fields=...`. Schemat odpowiedzi to `hits`, odmienny od `products` CGI. Wariant D w przeglądarce właściciela zakończył się błędem sieci bez czytelnej odpowiedzi. Nie można z tego odczytać jego struktury produktów ani świeżości indeksu.

Zweryfikowano publiczne, oficjalne zgłoszenia projektu (stan odczytu 24.10.2026):

- [#427: CORS przy dostępie do /search](https://github.com/openfoodfacts/search-a-licious/issues/427), otwarte. Zgłaszający opisuje GET 200 bez Access-Control-Allow-Origin oraz OPTIONS 400 „Disallowed CORS origin”. To jego pomiary, nie nasz własny status OPTIONS. Kod `main` ma middleware CORS, co nie dowodzi wdrożenia tej wersji w produkcji.
- [#469: produkcyjny indeks zatrzymał aktualizacje po 2024-12-18](https://github.com/openfoodfacts/search-a-licious/issues/469), otwarte. Zgłaszający porównuje produkcję/staging/Product API i podaje przykłady brakujących nowych produktów. Nie potwierdzamy samodzielnie dokładnej daty zatrzymania; zgłoszenie wskazuje nierozwiązane ryzyko świeżości.
- [#465: CORS blokuje autocomplete Hunger Games](https://github.com/openfoodfacts/search-a-licious/issues/465), otwarte, dodatkowe zgłoszenie integracyjne.

Nie uznajemy obecnego produkcyjnego Search-a-licious za potwierdzone rozwiązanie dla Bengera. Nie migrujemy do niego ani nie obchodzimy problemu przez publiczny CORS proxy. Data `last_modified_t` produktu nie jest datą odświeżenia indeksu.

## Wybór transportu i identyfikacja

**Wybrano bezpośredni CGI GET z samym Accept dla search. Proxy nie jest obecnie potrzebny.** Odczyt barcode pozostaje na sprawdzonym API v3.6 z X-User-Agent. Koszt usług integracji: brak płatnego API/nowego backendu, z zastrzeżeniem limitów OFF i hostingu.

Search i lookup są niezależnymi adapterami repozytorium. CGI ma `searchProducts(query, {signal})`, identyfikator `off-cgi-v3.6-accept` i limit 20. Lookup ma `getProductByBarcode(barcode, {signal})`. Klucze cache wyszukiwań zawierają identyfikator backendu. Zmiana search nie dotyka UI, parsera ani historycznych wpisów.

Oba endpointy mają `credentials: omit`, CORS i deadline 10 s obejmujący JSON. Rezerwacje IndexedDB ograniczają ruch między kartami, 429 blokuje kolejne zapytania, błędy pozostawiają katalog/cache lokalny. Nie dodano automatycznych retry, search-as-you-type ani zapytań dla każdej części zdania.

**X-User-Agent nie jest przedstawiany jako ogólnie rekomendowany browserowy zamiennik User-Agent.** Oficjalna konfiguracja i testy pozwalają go wysłać; ogólna instrukcja rekomenduje custom User-Agent, którego browser nie może niezawodnie nadpisać. W search brak teraz dodatkowej identyfikacji Benger: pozostają natywny UA przeglądarki i standardowe Origin/Referer. Accept nie identyfikuje aplikacji. Nie znaleziono podstaw, by dopisywać do READ parametr User-Agent opisany dla WRITE. Właściciel powinien zgłosić integrację i browserowe ograniczenia formularzem poniżej. Nie deklarujemy formalnej akceptacji przez OFF.

Jeżeli OFF zażąda własnego User-Agent po stronie serwera albo zablokuje browserowy CGI, osobny adapter umożliwi minimalny proxy wyłącznie search: stały host/endpoint upstream, walidacja query i rozmiaru strony, limity, brak arbitralnego URL oraz sekretów w kliencie. Nie utworzono takiego backendu, bo produkcyjny wariant C działa.

## Normalizacja i ochrona danych

API 3.6: tylko `nutrition.aggregated_set`, `preparation: as_sold`, jawne `100g` / `100ml`, nutrient `.value` i wymagane jednostki. Nazwy marek z `brands_tags_pl`. Pobierane są tylko potrzebne pola. Nie przyjmujemy niepełnych makro, NaN, nierówności ani przypadkowej podstawy ml; nie liczymy gęstości. Legacy ma osobno oznaczoną podstawę g.

Rewizja cache 2 zachowuje stare dane jako fallback, bez uznawania ich za świeże. Wersja bazy IndexedDB 2 dodaje pamięć wyborów bez czyszczenia starych store. Snapshot dziennika nadal zawiera historyczne wartości i nie jest przeliczany po zmianie OFF. Nazwy produktów są tekstem, adres zdjęcia ma allowlistę, brak obrazka oznacza placeholder. OFF nie otrzymuje dziennika ani pamięci dopasowań.

## Testy, preview i zakres potwierdzenia

Testy automatyczne 25.10.2026 na Node 22: **164/164 Node, 73/73 Chromium**, plus `git diff --check`. Testy OFF są mockowane: obejmują header Accept-only, v3.6, błędy, IndexedDB, pamięć, migrację v1→v2, dwie karty, flow dziennika i artefakt pod `/Benger/previews/etap-3/`. Nie odtwarzają statusu produkcyjnego OFF.

Actions dla poprawki `0dd26ac` zakończyły się sukcesem: [Tests — push](https://github.com/kubanik21-crypto/Benger/actions/runs/40171269329), [Tests — PR #3](https://github.com/kubanik21-crypto/Benger/actions/runs/40171271486), [Stage 3 preview](https://github.com/kubanik21-crypto/Benger/actions/runs/40171269303). Po kolejnych commitach wymagany jest wynik dla najnowszego SHA.

Ponowny curl z tego środowiska: OFF i Pages blokowane przez proxy na CONNECT, HTTP 403 proxy przed dotarciem do usługi. Poprzednia próba w prawdziwym Chromium z proxy: `ERR_TUNNEL_CONNECTION_FAILED`. Nie jest to dowód błędu CORS OFF. Publiczne strony github.com (PR, Actions, issues) można odczytać po HTML; api.github.com pozostaje zablokowane. Nie obchodzimy ograniczeń sieci.

Preview: **https://kubanik21-crypto.github.io/Benger/previews/etap-3/**. Diagnostyka: [off-diagnostics.html](https://kubanik21-crypto.github.io/Benger/previews/etap-3/off-diagnostics.html). Porównanie A/B/C/D nie startuje samoczynnie i respektuje limity. HTTP OPTIONS sprawdzamy w DevTools/CDP, nie zgadujemy go z wyjątku fetch.

Builder kopiuje allowlistę assetów i nadaje jeden SHA odwołaniom HTML oraz importom ES modules. Nie miesza świeżego indexu ze starymi modułami Pages. Preview ma oddzielne klucze localStorage i `BengerDB-preview-etap-3`; sam podkatalog nie izoluje pamięci. Publikacja dotyka wyłącznie `gh-pages/previews/etap-3/`, bez zmiany root, nowego brancha lub force push. Workflow uruchamia testy, zachowuje artefakt, sprawdza aktualną konfigurację Pages i w razie zmiany zleca build.

Pełny test z normalnej sieci, poza CI:

```sh
npm run test:off:live -- --url https://kubanik21-crypto.github.io/Benger/previews/etap-3/ --report /tmp/benger-off-live-preview.json
```

Ręcznie: wyszukaj mleko 2%, wybierz OFF Piątnica, wpisz 200 ml, dodaj, sprawdź sumę, reload i ostatnie; zaznacz gwiazdkę i ponów reload; sprawdź barcode Nutelli. Następnie w już otwartej aplikacji przełącz offline i sprawdź cache, ostatnie, ulubione oraz dziennik. **Nie ma service workera ani gwarancji zimnego startu/reload offline.**

Pomiar użytkownika potwierdził produkcyjne wyszukiwanie i barcode. Po publikacji poprawki `0dd26ac` właściciel otrzymał instrukcję sprawdzenia porcji/zapisu/reload/ostatnich/ulubionych i odpowiedział „wygląda okej”. To ogólna akceptacja preview, bez szczegółowego logu poszczególnych kroków lub offline. Pełny zestaw tych scenariuszy sprawdzono lokalnie z mockami; nie przedstawiamy go jako pomiaru sieci produkcyjnej. Przed scaleniem należy sprawdzić zielone Actions dla aktualnego SHA. Nie wykonujemy merge.

## Rejestracja API

Aktualny link z oficjalnego `docs/api/index.md`: [formularz zastosowania API](https://docs.google.com/forms/d/e/1FAIpQLSdIE3D8qvjC_zRJw1W8OmuHhsWJ_NSckiiniAHlfaVwUZCziQ/viewform). **Nie wysłano formularza.** Sam formularz nie był dostępny przez proxy; poniżej są informacje do przygotowania, nie deklaracja dokładnych nazw jego pól.

- Nazwa: Benger; wersja: 0.3, prototyp.
- Projekt: https://github.com/kubanik21-crypto/Benger; witryna/preview jak wyżej.
- Kontakt: własny adres email właściciela; nie wymyślamy adresu i nie rejestrujemy konta w jego imieniu.
- Zastosowanie: osobisty dziennik żywieniowy, wyłącznie odczyty, nazwy/makro/miniaturki/barcode, dane lokalne, brak bulk download i search-as-you-type.
- Ruch: podać własną realistyczną prognozę liczby użytkowników/zapytań. Aplikacja ogranicza odczyty do 10 search i 15 product/min/IP oraz używa cache.
- Atrybucja: OFF i współtwórcy; ODbL/DbCL i CC BY-SA 3.0 dla zdjęć.

Przykładowy opis:

> Benger is a local-first personal nutrition diary built with static HTML, CSS and JavaScript. It uses read-only Open Food Facts API v3.6 product lookup and explicit full-text searches to display product names, brands, nutrition per 100 g/ml and thumbnails. There are no writes, bulk downloads or search-as-you-type requests. Normalized data is cached locally for seven days and search results for fifteen minutes. The interface credits Open Food Facts contributors and links to ODbL, DbCL and image licenses. The project is currently a small personal prototype without user accounts or cloud storage.
