# Walidacja Etapu 9

Node.js 22.23.4, lokalny headless Chromium, 2026-10-26. Standardowe testy używają mocków OFF/SpeechRecognition, nie prawdziwego mikrofonu ani płatnych usług.

- `npm test`: **1103/1103 PASS**, zachowane wcześniejsze 976 przypadków.
- `npm run test:browser`: **173/173 PASS**, zachowane wcześniejsze 154 przypadki.
- Końcowe testy nowych ścieżek Chromium: **19/19 PASS** po ostatnim hardeningu.
- Korpus: **113 różnych zdań** (porcje, ułamki, g/ml, formy polskie, posiłki, szyk, possessives, alias, mixed i ambiguity).
- Generative: **600 kombinacji** nazwa × ilość × jednostka × pozycja, z własnościami skalowania, zachowania wersji, immutability, braku density conversion i niejednoznaczności.
- `git diff --check`: PASS. Składnia workflow YAML: PASS.

## Pokrycie

Voice/text → lokalny Recipe → proposal → zapis; mixed Recipe+Product; jeden setItem i podwójny tap; unresolved/INCOMPLETE bez zapisu; półtorej, g, ml i alias; jawny wybór niejednoznacznego przepisu; quick add i dostępne tryby; wersja zmieniona podczas otwartego podglądu; edycja/usunięcie bez zmiany historycznego dziennika; offline reload/logging; backup/wipe/import wszystkich stores, produktów, porcji, przepisów, szkiców, historii i preferencji.

Kontrolowane QuotaExceededError: localStorage dziennika oraz rzeczywiste transakcje IndexedDB autosave/custom/import. Sprawdzamy poprzedni trwały stan, zachowany formularz, komunikat, brak częściowego zapisu i możliwość ponowienia.

Routing: Dziennik → Przepisy → Produkty → back → back → forward; dokładnie jedno benger:route, jeden native hashchange i jeden focus nagłówka na zmianę. Ponowne navigate do aktualnego route nie emituje zdarzenia.

Bezpieczeństwo: nazwa przepisu/alias z HTML pozostają tekstem, także w snapshotach dziennika. Dotychczasowe testy XSS OFF/custom/import, prototype pollution, limitów i malformed JSON nadal przechodzą. Nowy validator odrzuca mieszane tożsamości Product/Recipe, brak provenance, NaN/Infinity i brak właściwego yield.

PWA: zachowany model aktualizacji wyłącznie po kliknięciu, testy cache lifecycle/offline/scope/niezmienionego IndexedDB. Duży zbiór zgodny ze schematem Etapu 8 jest zachowany po reload nowego shell; nie ma destrukcyjnej migracji DB, nadal v3. Testowane snapshoty historyczne obejmują 2000 wersji, w tym referencje bez aktywnego przepisu. Testy etapów 6–8 nadal sprawdzają barcode, voice, custom i porcje.

Accessibility: nazwy pól i dialogu, role=status, focus-visible, Escape/Anuluj, cele dotykowe, kontrast istniejącej palety. Quick add sprawdzony na 320/360/390/430 px; zachowane wcześniejsze regresje desktop/mobile. Brak wykrytych wyjątków konsoli w nowych przepływach.

## Pomiary orientacyjne

Izolowany profil, bez danych użytkownika; `node scripts/measure-release.mjs /tmp/release.json`. Zbiór: 1000 wpisów dziennika, 200 przepisów, 50 szkiców, 2000 snapshotów historii i istniejące dane produktów/preferencji.

| Operacja | ms |
| --- | ---: |
| Cold load | 479.67 |
| Exact matching w pamięci (średnia ze 100) | 0.72 |
| Ambiguous matching w pamięci (średnia ze 100) | 0.95 |
| Odczyt/walidacja 200 przepisów | 11.90 |
| Wyszukiwanie w 200 przepisach | 20.20 |
| Render historii 1000 wpisów | 4.20 |
| Mixed proposal wraz z lokalnymi repozytoriami | 30.10 |
| Eksport, serializacja i walidacja backupu | 187.00 |
| Reload z dużym zbiorem | 252.44 |

Backup: 2,787,243 B (około 2,79 MB, poniżej limitu 10 MiB). To pojedyncze pomiary headless, nie wyniki Samsunga ani gwarancja czasu na urządzeniu.

## Poprawki z self-review

- Zachowanie dawnych possessive aliases produktów zamiast przechwytywania ich przez brakujący przepis.
- Konserwatywne dopasowanie „curry” przy kilku nazwach; recent/favorite nie zmieniają confidence.
- Ponowne sprawdzenie bieżącej wersji przed zapisem; wymóg ponownej akceptacji po zmianie.
- Synchronizacja eksportu z uczeniem wyborów i zapisami recent zamiast wyścigu backupu.
- Guard przed spóźnionymi wynikami lokalnego wyszukiwania przepisów.
- Brak wysłania prywatnej nierozpoznanej frazy do OFF po awarii magazynu przepisów.
- Liniowe grupowanie historii dni zamiast wielokrotnego filtrowania całego dziennika.
- Obsługa quota bez zamiany nieudanego trwałego zapisu w pozorny sukces pamięci awaryjnej.
- Brak NaN w opcjonalnym pomiarze navigator.storage; powiązane etykiety, czytelne błędy i mobilny dialog.

## Publikacja i akceptacja

Preview: https://kubanik21-crypto.github.io/Benger/previews/etap-9/

Lab: https://kubanik21-crypto.github.io/Benger/previews/etap-9/recipe-diary-test-lab.html

Diagnostics: https://kubanik21-crypto.github.io/Benger/previews/etap-9/recipe-diagnostics.html

Osobne dane preview-etap-9 i scope tylko tego podkatalogu. Root i Etap 8 pozostają bez zmian. Końcowe SHA i wyniki Actions podaje raport wykonania (dokument nie zawiera własnego SHA). Nie utworzono PR i nie wykonano merge.

[Ograniczenia i 10-punktowa checklista Samsunga](recipe-diary-and-release-hardening.md#samsung--real-device-acceptance). Prawdziwy mikrofon, aparat i aktualizacja zainstalowanej PWA wymagają real-device acceptance; testy headless nie są jej zamiennikiem.


## Doprecyzowanie testu aktualizacji z Etapu 8

Fixture zawiera oryginalne zmienione pliki klienta z 19db9d3 (w tym PWA/SW); nie jest publikowana jako asset. Test instaluje poprzedni shell w izolowanym profilu, zapisuje wszystkie typy danych, podmienia publiczne pliki i aktywuje aktualizację przez bieżącą rejestrację SW. Porównuje pełny backup przed/po, zachowanie szkiców oraz pozostawienie cache innych scope.

W tym scenariuszu stary interfejs potrafił pozostawić widoczny komunikat aktualizacji po pierwszej instalacji. Widoczny przycisk nie był dowodem, że następna wersja zakończyła instalację. Test czeka teraz na rzeczywisty waiting worker i używa przycisku starego klienta. Etap 9 pokazuje aktualizację tylko przy istniejącym kontrolerze i oczekującej wersji, czyści komunikat przy zmianie kontrolera oraz pobiera bieżącą rejestrację przy kliknięciu. Worker utrzymuje zdarzenie wiadomości przez waitUntil(skipWaiting()). Nie dodano automatycznego reload podczas edycji.
