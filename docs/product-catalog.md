# Katalog produktów — Etap 6

## Wspólny kontrakt

UI i dziennik nadal używają jednego Product i nutrition.js. ProductRepository agreguje USDA, własne produkty, cache i runtime OFF. Produkty mają stabilne id, source/sourceId, opcjonalny barcode, nazwę/markę, g/ml i per100 kcal/protein/fat/carbs. USDA dodatkowo zachowuje description, category i dataType; nazwa i opis są ograniczone do 240 znaków. To adaptery, a nie app.js, znają strukturę odpowiedzi zewnętrznej.

`nutritionCompleteness()` rozróżnia COMPLETE/PARTIAL/INSUFFICIENT na podstawie rzeczywistych wartości. Do obliczenia i dziennika dopuszczany jest tylko kompletny walidowany Product. Brak nutrientu nie jest zerem. Wszystkie historyczne wpisy nadal mają snapshot.

## USDA build

```sh
node scripts/build-generic-food-catalog.mjs --fixture tests/fixtures/example.json --output /tmp/catalog
npm run catalog:refresh
```

Fixture ma strukturę `{foods: [{fdcId, description, dataType, foodCategory, foodNutrients: [{nutrient: {id, unitName?}, amount}]}]}`. Pierwszy tryb nigdy nie pobiera sieci. Refresh jest jawny i pobiera trzy przypięte oficjalne ZIP-y; potrzebuje Node 22+, python3 (standardowa biblioteka csv/zipfile), bez npm dependencies. Workflow `Build USDA catalog` wykonuje taki kontrolowany refresh i zapisuje wynik tylko na gałęzi Etapu 6. Standardowe testy nie pobierają USDA.

CSV są czytane strumieniowo z ZIP. Potrzebujemy wyłącznie nutrient IDs 1008/1003/1004/1005. Energy 2048/2047 jest dozwoloną alternatywą kcal Atwater, 1062 kJ nie jest kcal. Starsze numery w tym eksporcie FNDDS (208/203/204/205) są jawnie mapowane. Podstawą jest 100 g, nigdy domniemane 100 ml ani porcja. Brakujące/błędne wartości, NaN, sprzeczne jednostki i niemożliwa masa makro są odrzucane.

## Indeks i pamięć

13 727 produktów, 108 chunków po najwyżej 128 rekordów. Indeks token→ID, prefiksy, ID→chunk i ranking są generowane build-time. Przy starcie moduł nie ładuje całej bazy do RAM. Pierwsze wyszukiwanie ładuje indeks; przecięcia posting lists wybierają najwyżej sześć chunków. LRU przechowuje najwyżej osiem. Użyte/ulubione produkty trafiają też do małego cache referencyjnego, więc działają nawet poza danym chunkiem w pamięci.

Polski słownik obejmuje ponad 100 typowych nazw, fleksję i określenia raw/cooked. Prefix lookup nie skanuje wszystkich rekordów. Dla nieznanej marki nie usuwamy słów, żeby wymusić generic match. Jasny wariant/smak/procent nadal jest chroniony przez ProductResolver. Brak dokładnego skyra Pilos nie staje się fałszywie dokładnym jogurtem.

Coverage zawiera 102 niezależne polskie zapytania, oczekiwaną angielską rodzinę żywności i fizyczną poprawność makro, dodatkowo progi dla mięsa/ryb/tłuszczów/wody/skrobi. Testy używają prawdziwego znormalizowanego katalogu. Ranking preferuje proste produkty i obniża przepisy mieszane; nie usuwa różnych stanów surowy/gotowany. Użytkownik sprawdza konkretny opis.

## Wyszukiwanie i źródła

Dla prostego lokalnego query (banan, ryż, pierś z kurczaka) wystarczają wyniki USDA i lokalne preferencje — bez OFF. Marka/wariant bez odpowiednika lokalnego korzysta z istniejącego OFF. Checkbox „Uwzględnij wyniki Open Food Facts” pozwala jawnie poprosić o sieć także dla query ogólnego. OFF wtedy nie ginie za dwudziestoma wynikami generic. Nie ma search-as-you-type do OFF. Dotychczasowy limit ≤1 automatycznego search na analizę głosową pozostaje; dalsze wyszukiwanie w wierszu jest świadomą akcją.

Deduplikacja dotyczy barcode lub source/sourceId, nie samego podobieństwa nazwy między USDA a OFF. Własny produkt ma pierwszeństwo w exact barcode lookup. W nazwach i szczegółach wyraźnie pokazujemy źródło; generic nie udaje marki.

OFF zachowuje API 3.6 dla produktu i działającą ścieżkę CGI Accept-only dla full text. Nie zmieniono identyfikacji ani endpointów z działającej integracji. Nadal obowiązują TTL 7 dni produktów / 15 minut search i współdzielony między kartami limiter: 6500 ms search, 4500 ms produkt, Retry-After/429, bez automatycznych serii retry.

## Własne produkty

Pełny formularz: nazwa, opcjonalna marka/barcode, jednostka g/ml, cztery wartości na 100. Brak pola, NaN, liczba ujemna, błędny barcode lub przekroczenie rozsądnych limitów blokuje zapis. Custom UUID nie zależy od barcode. Edycja zachowuje ID; usuwanie nie rusza snapshotów dziennika. Dostępne są voice, barcode, ulubione, aliasy i pełny backup. Osobny eksport własnych produktów również pozostaje dostępny. Nie ma kont, synchronizacji ani wysyłania własnych danych do USDA/OFF.

## Diagnostyka i pomiary

`catalog-diagnostics.html` pokazuje alias, generic, cache i końcowy ranking. Przycisk marek wykonuje rzeczywiste OFF, a nie mocki. `node scripts/brand-coverage.mjs` uruchamia osobny browserowy pomiar dwunastu marek z odstępami respektującymi limiter; nie jest częścią CI. Sieć tego środowiska blokuje OFF, więc realne pokrycie marek wymaga uruchomienia w dostępnej sieci.

`node scripts/catalog-benchmark.mjs` mierzy rozmiary, gzip, pierwsze i kolejne lokalne wyszukiwania oraz przybliżony przyrost heap. Pomiar jest lokalny, nie benchmarkiem telefonu ani internetu. W testach Chromium mierzony jest cold/warm/offline start, a skaner jest sprawdzany osobno na prawdziwych pikselach EAN-13.

## Pomiary i przegląd końcowy

Lokalnie, Node 22 z wymuszonym GC: indeks i LRU po wyszukiwaniu zajęły około 8,4 MB dodatkowego heap. Wyszukanie pierwsze ok. 52 ms; mediana 100 kolejnych ok. 2,9 ms, p95 ok. 5 ms. Katalog po uwzględnieniu kategorii i indeksu głównych nazw: ok. 8,82 MB, suma gzip ok. 0,95 MB. Cały precache ok. 9,6 MB, shell bez danych i vendora ok. 263 KB. To pomiar localhost, nie gwarancja czasu na telefonie.

Self-review naprawił: stare numery nutrientów FNDDS, osobną tabelę kategorii WWEIA, dopasowanie `raw` wewnątrz `strawberry`, zbyt wysoką pozycję produktów pochodnych (np. rice milk zamiast ryżu), błędne utożsamianie 100 ml ze 100 g w walidacji custom, porównywanie barcode z zerami, stare dane USDA w ponownie wybieranym produkcie i zbyt szeroką publikację plików JSON. `data/usda` nie jest dowolnym publicznym katalogiem JSON: serwer i allowlista obsługują konkretne nazwy katalogu.

## Zgodność po usunięciu demo

Cztery produkty demonstracyjne nie istnieją w katalogu ani rankingu. `nutrition.js` nie eksportuje listy produktów. Historyczne snapshoty i source benger pozostają w dzienniku bez przeliczania. `legacy-product-references.js` zawiera jedynie cztery stare ID potrzebne do zachowania referencji w backupie — bez nazw i wartości odżywczych. Stare preferencje mogą być nierozwiązywalne, ale nie są kasowane; nie generujemy dla nich ponownie demonstracyjnego produktu.
