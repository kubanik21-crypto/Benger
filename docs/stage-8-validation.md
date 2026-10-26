# Walidacja Etapu 8

Środowisko: Node.js 22.23.4, lokalny headless Chromium, 2026-10-26. Testy OFF i SpeechRecognition są mockowane, bez zależności standardowego CI od zewnętrznej usługi. Nie wykonano akceptacji rzeczywistego mikrofonu/aparatu Samsunga.

## Wyniki

- `npm test`: 976/976 PASS; zachowane poprzednie 790 przypadków.
- `npm run test:browser`: 154/154 PASS; zachowane poprzednie 140 przypadków.
- Korpus: 165 polskich wypowiedzi, w tym składniki, kroki, połączone zdarzenia, nazwy, notatki, wydajność, czas/temperatura i ułamki.
- `git diff --check`: PASS.
- Migracja realnego IndexedDB v2 → v3 zachowuje custom, aliasy, porcje, preferencje i lokalny dziennik.
- E2E obejmuje pięć route, back/forward/reload, focus i zachowanie formularzy, głos/propozycję/akceptację, oliwę bez zgadywania cebuli, wznowienie szkicu, snapshoty i yield, wersje, duplikację, usuwanie, incomplete/wykluczenie, wspólny katalog, zmianę typu zdarzenia, XSS, backup2 oraz offline.
- Pełne scenariusze rosół/curry używają rzeczywistego lokalnego ProductRepository/USDA i resolverów; braki pozostają unresolved zamiast wymyślonych makro.
- Layout sprawdzony dla 320/360/390/430/1024/1440 px; brak poziomego przepełnienia i błędów konsoli w kontrolowanych przepływach.

## Pomiary techniczne

Izolowany lokalny profil, bez danych użytkownika. `node scripts/measure-recipes.mjs /tmp/recipes.json`:

| Operacja | Czas |
| --- | ---: |
| Przejście nawigacji | 12,3 ms |
| Lista 100 przepisów | 33,9 ms |
| Szczegóły 50 składników / 100 kroków | 17,2 ms |
| Autosave edycji nazwy | 33,7 ms |

To pojedynczy pomiar headless, nie benchmark Samsunga ani gwarancja SLA. Nie pobieramy całej nowej bazy danych ani bibliotek; istniejący katalog jest zachowany.

## Poprawki z self-review

- Synchronizacja route przed ustawieniem focus; selektory ograniczone do właściwej nawigacji.
- Osobny widok sesji zamiast edytora poniżej długiej listy; powrót bez utraty szkicu i ostatnia zaakceptowana zmiana obok mikrofonu.
- Kolejka autosave i kontrola revision/baseVersion, ochrona przed odtworzeniem usuniętego szkicu oraz spóźnionymi wynikami resolvera.
- Blokada finalizacji podczas operacji i niezapisanych propozycji; flush przed backupem/importem.
- Walidacja timestamp/order/ID, porównywanie makro bez zależności od kolejności kluczy JSON, przepełnienia i nieprawidłowe ujemne/złożone formaty wydajności.
- Zmiana typu zdarzenia usuwa niepasujący payload; poprawiona normalizacja kg/l, ułamków i istniejących składników.
- Historyczne snapshoty są niezależne od zmian produktu; schema1 merge i schema2 roundtrip pozostają wspierane.

## Publikacja i bramki

Preview: https://kubanik21-crypto.github.io/Benger/previews/etap-8/

Recipe Test Lab: https://kubanik21-crypto.github.io/Benger/previews/etap-8/recipe-test-lab.html

Recipe Diagnostics: https://kubanik21-crypto.github.io/Benger/previews/etap-8/recipe-diagnostics.html

Workflow Tests oraz Stage 8 preview muszą przejść dla opublikowanego SHA. Publikacja zmienia tylko katalog previews/etap-8, nie root ani wcześniejsze preview. Dane i service worker są izolowane. Nie utworzono PR ani nie wykonano merge. Końcowy SHA/status Actions podaje raport wykonania, nie ten samoreferencyjny dokument.

Przed dalszym etapem wymagane jest [14 testów na Samsungu](recipes-and-navigation.md#samsung-akceptacja-na-prawdziwym-urządzeniu). Regułowe rozumienie nie obejmuje dowolnego języka; nie zapisujemy niezaakceptowanych propozycji jako składników, a rozpoznawanie mowy może wymagać sieci. Dane pozostają lokalne bez synchronizacji urządzeń. Limity magazynu i historii są opisane w dokumencie architektury.
