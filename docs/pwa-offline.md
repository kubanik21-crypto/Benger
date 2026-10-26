# PWA i offline — Etap 6

## Instalacja i scope

Manifest używa względnych `id`, `start_url` i `scope` (`./`), display `standalone`, kolorów Bengera i prawdziwych PNG 192/512. Ikona 512 ma bezpieczny centralny znak i purpose maskable. `beforeinstallprompt` udostępnia mały przycisk, a nie popup przy wejściu. Wyświetlamy go tylko poza standalone. Dostępność instalacji zależy od HTTPS i przeglądarki. Prawdziwa instalacja z ikonki pozostaje testem na Samsungu.

`pwa.js` rejestruje `./service-worker.js` z `scope: './'`. Produkcyjny katalog `/Benger/` i preview `/Benger/previews/etap-6/` mają różne zakresy i nazwy cache. Preview nie może żądać szerszego scope; nie ustawiamy Service-Worker-Allowed. Nowy namespace `preview-etap-6` obejmuje localStorage i IndexedDB; wcześniejsze dane nie są kopiowane ani kasowane.

## Cache i wersjonowanie

`scripts/build-pwa-assets.mjs` generuje listę jawnych publicznych assetów i hash ich zawartości. Uruchamia się przed startem i testami; builder preview liczy hash ponownie po dodaniu SHA i namespace. Zmieniając publiczne pliki, trzeba zapisać wygenerowany `sw-assets.js` razem z kodem. Publikacja używa konkretnego czystego commita.

Worker precache'uje wyłącznie allowlistę: HTML, CSS, JS, manifest, ikony, lokalny bundle skanera z licencjami oraz USDA. Sześć równoległych pobrań; błąd dowolnego pliku unieważnia instalację nowego cache. Nie deklarujemy gotowości offline przed pomyślną aktywacją. Fetch cache-first obsługuje wyłącznie te same, znane pliki i główną nawigację; nie tworzymy dowolnych fallbacków dla nieznanych URL. Parametry SHA importów wskazują wersję z jednego artefaktu.

OFF, zdjęcia i dowolne odpowiedzi internetowe nie trafiają do Cache Storage. Produkty OFF nadal mają własny walidowany cache IndexedDB, TTL i limiter. Nie redystrybuujemy dumpa OFF razem z USDA.

Zmierzony precache: około 9,6 MB bez kompresji. Katalog 13 727 rekordów zajmuje około 8,82 MB, gzip plików sumarycznie około 0,95 MB; cały lokalny katalog jest więc dostępny offline. Nie wyodrębniono arbitralnego core 500–2000 pozycji: przy tym rozmiarze pełna baza jest praktyczna. Twardy limit builda to 20 MiB. Po jego przekroczeniu publikacja przerywa się; wtedy należy wydzielić core i rzadsze dane do pobierania na żądanie. HTTP kompresja zależy od hostingu.

## Aktualizacja

Nie wywołujemy skipWaiting automatycznie przy instalacji aktualizacji. Stary worker serwuje zgodny stary shell, nowy pobiera kompletny zestaw plików i czeka. UI pokazuje przycisk aktualizacji z przypomnieniem o zapisaniu edycji. Dopiero kliknięcie wysyła ACTIVATE_UPDATE; ta karta odświeża się przy controllerchange. Inne karty nie są automatycznie przeładowywane. Zalecamy zapisanie pracy i zamknięcie innych kart przed aktualizacją.

Aktywacja usuwa wyłącznie stare cache o dokładnym prefiksie własnego scope (`benger-shell:<pathname>:`). Nie dotyka IndexedDB, localStorage, notatek ani cache innego preview/produkcji. E2E utrzymuje sentinel cache produkcyjnego scope podczas aktualizacji preview.

## Co działa offline

Po zakończeniu instalacji: start i reload, dziennik, liczenie makro, tekstowy parser, pełny lokalny USDA, własne produkty, ulubione, ostatnie, aliasy i wcześniej zapisane produkty OFF. Kamera i lokalny ZXing potrafią odczytać kod bez sieci; nieznany kod wymaga OFF albo ręcznego dodania produktu. SpeechRecognition może używać sieci dostawcy: nie obiecujemy głosu offline i zachowujemy tekstowy fallback.

Przeglądarka może usunąć dane po ręcznym czyszczeniu pamięci lub wskutek polityki miejsca. Zmiana origin nie przenosi danych. Backup JSON jest sposobem przeniesienia własnych danych na inne urządzenie.

## Backup i import

`backup.js` eksportuje `app: Benger`, `schemaVersion: 1`, timestamp i dane: snapshoty dziennika, produkty referencyjne, własne produkty, ulubione, ostatnie, aliasy, pamięć wyborów. Notatnik starego prototypu pozostaje nietknięty; nie jest częścią tego eksportu. Historia diagnostyczna nie jest eksportowana jako dane żywieniowe.

Import ma limit 10 MiB, ograniczenia liczby rekordów, głębokości i długości; weryfikuje typy, makro, daty, kody, powiązania, duplikaty oraz niebezpieczne klucze prototypu. Nie wykonuje pobrań ani kodu z pliku. Domyślny merge zachowuje obecne rekordy przy zbieżnych ID; replace zastępuje dziennik i dane produktów. W obu trybach wymagane jest osobne zaznaczenie potwierdzenia. Przed importem zamknij inne karty: nie implementujemy rozproszonej blokady zapisu.

Wszystkie store'y IndexedDB są zapisywane jedną transakcją. Trwały journal zapisuje poprzedni snapshot i surowy dziennik localStorage. Przy błędzie cofamy dane; po przerwaniu procesu odzyskiwanie następuje przed uruchomieniem ekranu aplikacji. Przy trwale zablokowanym localStorage journal pozostaje do ponowienia, a częściowy import nie powinien być używany. To transakcyjne zachowanie z odtwarzaniem dla dwóch różnych mechanizmów przeglądarki, nie jedna natywna transakcja IDB+localStorage. Import wymaga dostępnego IndexedDB. Nie resetuje starych notatek ani limitów OFF.

## Testy

E2E: rejestracja, ograniczony scope, precache, offline reload, USDA, cache OFF, custom i alias, edycja snapshotów, import UI z potwierdzeniem, quota rollback, recovery po restarcie oraz aktualizacja bez samoczynnego przeładowania edycji. `pwa-diagnostics.html` pokazuje rzeczywiste scope'y, cache, tryb standalone, storage estimate i wersję katalogu.
