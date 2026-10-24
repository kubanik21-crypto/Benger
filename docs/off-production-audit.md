# Audyt produkcyjny OFF i preview PR #3

Weryfikacja: 2026-10-24. Kod pozostaje na `etap-3-katalog-produktow`. Nie scalono PR #3. Audyt rozróżnia zgodność ze źródłami, testy z mockami i wynik rzeczywistej sieci.

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

## Decyzje integracyjne

- Product API: `/api/v3.6/product/{barcode}`. Search: `/cgi/search.pl?...&api_version=3.6`, 20 wyników, bez search-as-you-type.
- Search-a-licious **istnieje**, a SDK obsługuje `GET /search` i `POST /search`. Zwraca inny schemat `hits`; dokumentacja Product Opener nadal wymienia legacy CGI jako dostępny full-text. Nie deklarujemy, że Search-a-licious jest niedostępny ani niestabilny. Nie ma potrzeby migracji przed potwierdzeniem kompletności nutrition i działania usługi na żywo.
- Pola: kod, nazwy, `brands_tags_pl`, ilość opakowania, mała miniaturka, data zmiany oraz tylko podstawa i cztery nutrimenty agregatu. Brak pełnego produktu i `input_sets`.
- Wartości `energy-kcal`, `proteins`, `fat`, `carbohydrates` pochodzą z `.value` i mają wymagane jednostki `kcal`/`g`. Używamy tylko `as_sold` i `100g`/`100ml`. Braki, NaN, nierówności i inne jednostki nie stają się zerami. Nie liczymy gęstości.
- Rewizja cache 2 nie uznaje dawnych rekordów/query za świeże. Zachowuje je jako fallback offline, podobnie jak ulubione i ostatnie. Wpisy dziennika nie są migrowane ani przeliczane.
- Rzeczywiste HTTP 403 ma osobny komunikat. Nie oznacza tego samego co brak odpowiedzi spowodowany blokadą proxy/CORS.

## Identyfikacja, CORS i proxy — zakres potwierdzenia

**Statyczna aplikacja może wykonywać bezpośrednie odczyty OFF:** oficjalny SDK dopuszcza `window.fetch`, a konfiguracja serwera obsługuje CORS dla zewnętrznych aplikacji. Nie ma technicznej przesłanki, by dodawać backend tylko z powodu GitHub Pages.

Pozostaje `X-User-Agent: Benger/0.3 (https://github.com/kubanik21-crypto/Benger)`, `credentials: omit`, standardowy preflight. Nie ma sekretu ani nadpisywania natywnego nagłówka `User-Agent`.

Trzeba rozróżnić dwie rzeczy:

1. **Oficjalnie obsługiwany:** tak, nagłówek jest w allowliście i w oficjalnym teście `options-api-v2-x-user-agent`. Nie opieramy tej decyzji wyłącznie na mockach Bengera. Nginx odczytuje go również w regule konkretnego klienta Intake24; nie twierdzimy, że każdy `X-User-Agent` jest w ten sposób priorytetyzowany lub traktowany jak custom `User-Agent`.
2. **Ogólnie rekomendowany zamiennik browserowego User-Agent w przewodniku READ:** nie znaleziono takiego zalecenia. Ogólny przewodnik rekomenduje custom `User-Agent`; parametr o tej nazwie opisano w metadanych operacji WRITE. Nie rozszerzamy go bez dowodu na GET product/search. SDK JS sam ustawia `User-Agent`, co nie gwarantuje wysłania go przez Chromium.

Dlatego utrzymujemy wspierany transport browser → OFF, z jawnym opisem tych ograniczeń i wymaganiem rejestracji zastosowania. **Nie potwierdzono jeszcze rzeczywistego CORS i akceptacji aplikacji na produkcji.** Brak potwierdzenia nie uzasadnia automatycznego stawiania proxy, które też wymagałoby wdrożenia, kontaktu i ograniczania współdzielonego IP. Jeśli OFF wyraźnie zażąda nagłówka HTTP `User-Agent` po stronie serwera lub zmieni CORS, adapter transportu można zastąpić małym Workerem z allowlistą dwóch endpointów, walidacją, limitami i bez arbitralnego URL klienta. Nie utworzono otwartego proxy ani dodatkowego backendu.

## Rzeczywisty test w tym środowisku

Uruchomiono `node scripts/off-live-test.mjs --local --report /tmp/benger-off-live-local.json` w prawdziwym Chromium z natywnym fetch, **bez mocków**, z proxy skonfigurowanym przez środowisko. Test dotyczył wyszukania `mleko 2%` i znanego kodu Nutelli `3017620422003`.

Wynik: **FAIL na warstwie sieci**. Chrome zgłosił `net::ERR_TUNNEL_CONNECTION_FAILED`; `corsErrorStatus` było puste, nie otrzymano odpowiedzi HTTP z OFF. Osobny curl pokazał `CONNECT tunnel failed, response 403`. Ponowne udzielenie narzędziu dostępu sieciowego nie usunęło blokady proxy. API GitHub, GitHub Pages i formularz Google również są blokowane w tym środowisku.

Nie można na tej podstawie podać prawdziwych makro, marki lub zdjęcia ani ogłosić poprawnego CORS. Nie wyłączano proxy, TLS, nie stosowano alternatywnych hostów ani tuneli. Nie przedstawiamy testów z mockami jako udanego testu produkcyjnego.

Po odblokowaniu sieci pełny test:

```sh
npm run test:off:live -- --url https://kubanik21-crypto.github.io/Benger/previews/etap-3/ --report /tmp/benger-off-live-preview.json
```

Powinien sprawdzić wybrany produkt, obrazek, porcję 200 w jawnej jednostce, snapshot, sumę, reload, ostatnie, ulubione, barcode i przejście offline. Używa jednorazowego profilu Chromium, więc nie dotyka danych właściciela. Nie jest uruchamiany w standardowym CI. Przerywa lub raportuje FAIL przy rzeczywistym problemie.

Alternatywa ręczna dostępna na tym samym preview: [diagnostyka OFF](https://kubanik21-crypto.github.io/Benger/previews/etap-3/off-diagnostics.html). Nie wykonuje requestów przy wejściu. Kliknięcie przycisku uruchamia dwa odczyty z normalnym CORS, raportuje HTTP/normalizację/zdjęcia i pozwala pobrać JSON; nie zapisuje posiłków.

## Preview i aktualizowanie postępu

Adres: **https://kubanik21-crypto.github.io/Benger/previews/etap-3/**.

`scripts/prepare-preview.mjs` kopiuje allowlistę publicznych assetów i dodaje SHA oraz namespace pamięci. Manifest, CSS i wszystkie importy pozostają względne. Nie ma service workera. Podgląd ma własne klucze localStorage i bazę `BengerDB-preview-etap-3`; root nadal korzysta ze starych kluczy.

`scripts/publish-preview.mjs` wymaga czystej gałęzi Etapu 3, używa tymczasowego detached worktree istniejącego `gh-pages`, czyści wyłącznie `previews/etap-3`, sprawdza zmienione ścieżki i wykonuje zwykły push. Nie tworzy branchy, nie scala, nie zmienia root i nie stosuje force. Wyścig z inną publikacją powoduje odrzucenie push zamiast nadpisania zmian.

Workflow `Stage 3 preview` działa tylko po push zaufanej gałęzi tego repozytorium. Uruchamia testy, zachowuje pobieralny artefakt, weryfikuje istniejącą konfigurację Pages `legacy` / `gh-pages` / `/`, publikuje podkatalog i jawnie zleca build przez API Pages. To ostatnie jest konieczne: commit wykonany przez `GITHUB_TOKEN` sam nie uruchamia kolejnego builda. Nie zmienia ustawień Pages ani nie publikuje z forkowych PR.

Publikacja plików przez Git nie potwierdza sama w sobie statusu HTTP wdrożenia. Dopóki dostęp do Pages/API jest blokowany, nie deklarujemy sprawdzenia gotowego zdalnego adresu ani zielonego workflow.

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

## Bramki przed merge

Testy mockowane są podstawą CI i nie wymagają dostępności OFF. Obejmują również API 3.6, marki, 403, zachowanie starego cache, artefakt preview i brak dostępu preview do produkcyjnych danych. Self-review obejmuje cały diff względem main.

Do produkcyjnej akceptacji pozostają wymagane: udane realne wyszukanie i kod, brak błędów sieci/konsoli na zdalnym preview oraz zielone Actions. **Nie należy oznaczać PR #3 jako gotowego do merge wyłącznie na podstawie lokalnych mocków.**
