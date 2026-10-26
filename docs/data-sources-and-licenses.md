# Źródła danych i licencje

## Open Food Facts

OFF jest runtime'owym źródłem konkretnych marek i barcode. Baza: ODbL; zdjęcia: CC BY-SA, z odnośnikiem do karty produktu/autorów. Aktualne oficjalne zasady: https://world.openfoodfacts.org/terms-of-use i https://openfoodfacts.github.io/documentation/. Nie kopiujemy zdjęć ani dumpa OFF do katalogu USDA. Zachowujemy istniejące atrybucje aplikacji i rozdzielenie cache OFF od statycznych danych.

Dotychczasowe `source: openfoodfacts` i `source: benger` pozostają dla zgodności historycznych wpisów; nie zmieniamy ich na krótsze przykładowe off/builtin. Nowe źródła mają source usda/custom i odrębny sourceId. ID produktu nie jest z definicji kodem kreskowym.

## USDA FoodData Central

Oficjalne pobieranie: https://fdc.nal.usda.gov/download-datasets ; dokumentacja: https://fdc.nal.usda.gov/data-documentation ; polityka: https://fdc.nal.usda.gov/api-guide . Dane USDA są public domain; USDA udostępnia je jako CC0. Podajemy źródło i wersje, choć nie wprowadzamy licencji ODbL do tego odrębnego katalogu.

Przypięte oficjalne wydania CSV:

- Foundation Foods 2024-04-18: 310 kompletnych rekordów wykorzystanych przez Bengera.
- FNDDS 2019–2020, publikacja 2022-10-28: 5624 rekordy.
- SR Legacy 2018-04: 7793 rekordy.

Wszystkie trzy archiwa pobrano z fdc.nal.usda.gov podczas kontrolowanego builda na GitHub Actions. `data/usda/metadata.json` przechowuje oryginalne URL, SHA-256 archiwów, liczbę wejściowych/zaakceptowanych rekordów i diagnostykę schematu. Liczba odrzuconych rekordów Foundation obejmuje też wejściowe/eksperymentalne opisy bez wymaganego kompletu nutrientów; nie uzupełniamy ich zerami. Katalog nie jest zbiorem USDA Branded. Wydania są jawnie przypięte, nie deklarujemy, że są najnowszymi wydaniami z 2026 r.

Pobranie archiwów nie wymaga data.gov API key. Przeglądarka korzysta wyłącznie ze statycznego wyniku builda; nie ma żadnego klucza USDA w JS ani storage. Tłumaczenia wyszukiwanych pojęć są deterministycznym słownikiem, nie tłumaczeniem płatnym ani AI. Nazwy angielskie pozostają nazwami źródłowymi; np. cottage cheese nie jest deklaracją identyczności z każdym polskim twarogiem. Specyficzną polską kiełbasę, skyr marki lub regionalny produkt wybieramy przez OFF/custom.

## Własne produkty

Backup użytkownika może zawierać kopie użytych danych z różnych źródeł z zachowanym provenance; nie jest publicznym dumpem bazy ani zmianą licencji źródłowej. Dane przepisane przez użytkownika są lokalne, oznaczone source custom. Eksport należy do użytkownika i nie jest publikowany w repo ani łączony hurtowo z OFF. Historyczne wpisy zawierają snapshot, więc edycja/usunięcie katalogowego produktu nie zmienia starego posiłku.

## Skaner

`@zxing/browser` 0.2.1 — MIT, https://github.com/zxing-js/browser . Bundled ZXing Library — Apache-2.0, ts-custom-error — MIT. Teksty licencji w vendor/zxing są uwzględnione w opublikowanym artefakcie i dostępne w sekcji źródeł aplikacji. Bez runtime CDN, płatnych API, backendu i LLM.
