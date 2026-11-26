# Etap 4B — raport implementacji

Gałąź: feature/local-sync-export. Punkt wyjścia: 11b7ba1 (APK 1.0.17), importer 4A: 8392501. Commit etapu można odczytać przez `git log -1`; nie zmieniono numeru aplikacji i nie przygotowano nowego APK.

## Co dodano

- recipe-sheets-contract.js: ścisły kontrakt BENGER_IMPORT, wersja 1, kompletność, fragmenty, dokładny SHA-256, publikacja DRAFT/READY.
- recipe-sheets-import.js: transport Androida, uzgadnianie z biblioteką przez importer 4A, trwałe metadane pobrań, ponowienia, kontrola konta, ręczny podgląd i opcjonalny automatyczny import wyłącznie nowych kompletnych przepisów.
- recipe-sheets-ui.js: osobna sekcja ustawień, wybór źródła, status, daty, liczniki, błędy, przełącznik i ręczne sprawdzenie; przycisk i informacja o nowych przepisach w bibliotece.
- BengerRecipeSheetsPlugin / RecipeSourceProtocol: osobny natywny transport GET, stałe ID źródła, metadata-first, pobieranie tylko payloadów READY, ponowna weryfikacja metadanych, niezależne prywatne powiązanie per konto. Żadnego zapisu źródła.
- Izolowany natywnie hostowany Google Picker SDK i konfiguracja domyślnie wyłączona. Oficjalny Picker wymaga dodatkowej konfiguracji Cloud oraz sprawdzenia na telefonie.
- Minimalne rozszerzenie istniejącego podglądu pliku: może otrzymać już pobrany JSON, zachowuje tę samą walidację, resolver, obliczenia i atomowy zapis IndexedDB. Zabezpieczenie przed spóźnionym odczytem poprzedniego pliku.

Istniejący RAW DATA writer, backup, zapis dziennika i treningów, applicationId, wersja, podpis oraz dotychczasowa konfiguracja OAuth pozostają bez zmian. Zależność AndroidX WebKit jest jawnie dodana do aplikacji w tej samej wersji, która była już zależnością Capacitor. PWA nie uruchamia nowego czytnika, OAuth ani UI importu Sheets. Lista zasobów offline uwzględnia nowe moduły; nie wdrożono jej produkcyjnie.

## Przepływ

Natywny OAuth → świadomy wybór istniejącego pliku przez Picker → potwierdzenie dostępu API → metadata BENGER_IMPORT → wyłącznie fragmenty READY → kontrola kompletności i SHA → istniejące prepare JSON v1 → podgląd lub atomowy commit.

Automatyczne sprawdzanie działa przy starcie, wznowieniu i co 30 minut na pierwszym planie. Wznowienia są ograniczone co najmniej minutą po sukcesie; błędy mają backoff od 1 do 30 minut. Ręczny przycisk umożliwia świadome ponowienie. Bez internetu nie ma żądań, lokalne dane są dostępne. Nie ma WorkManagera ani gwarancji działania po zabiciu procesu.

Automatyczny import jest domyślnie wyłączony. Po włączeniu wymaga hasha, kompletnego makro/ilości, braku ostrzeżeń i statusu nowego przepisu. Aktualizacje istniejących baz, konflikty, nieznane ilości/makro i publikacje bez hasha wymagają decyzji w istniejącym podglądzie JSON. Identyczne wersje pomijamy. Starsze przepisy z archiwalnych publikacji nie cofają nowszych wersji biblioteki.

Rejestr w osobnym kluczu localStorage ma wersję 1 i najwyżej 1000 potwierdzeń package_id/digest/metadane/czas. Nie zawiera payloadu ani tokenu; format istniejącego backupu się nie zmienia. Oczekujące plany są tylko w RAM i odtwarzane przy następnym sprawdzeniu. Biblioteka jest sprawdzana ponownie nawet dla znanej publikacji, dzięki czemu przerwanie lub odtworzenie starszej biblioteki nie zatruwa rejestru. Zmiana treści pod znanym package_id jest blokowana. Błąd trwałego zapisu rejestru wstrzymuje import. Nie usuwa się lokalnych przepisów na podstawie ich braku w źródle.

Powiadomienie o dostępnych/dodanych przepisach jest widoczne **wewnątrz aplikacji**, bez nowego powiadomienia systemowego Androida. Import nigdy nie dodaje posiłków do dziennika i nie zmienia historycznych snapshotów.

## Testy i ich granice

Wyniki końcowe: Node **1809/1809**, Chromium **387/387**, Android JUnit **39/39**. `testDebugUnitTest lintDebug`: BUILD SUCCESSFUL (kompilacja Java, testy i lint). Lint: 0 błędów, 36 ostrzeżeń; obejmują dotychczasowe ostrzeżenia projektu oraz wymagane przez Picker włączenie JavaScript w izolowanym WebView. `git diff --check` i `git diff --cached --check`: czyste. Sprawdzono też pomocnik Python: DRAFT → READY przechodzi ten sam parser, hash jest zgodny, CSV ma zakończenia LF.

Pierwszy pełny przebieg Chromium miał 385/387: jeden timeout w niezmienionym scenariuszu zmiany produktu/jednostki kromka oraz wynikającą z niego porażkę nadrzędnego zestawu. Oddzielne powtórzenie całego zestawu porcji przeszło 14/14. Następnie powtórzono **całe Chromium** bez zmiany scenariusza ani limitu czasu: 387/387. Timeout nie odtworzył się; jego przyczyny nie uznano za rozpoznaną. Node i Chromium korzystają z danych syntetycznych, mocków Google i lokalnego IndexedDB. Android JUnit sprawdza protokół natywny. Lint/kompilacja Java nie stanowią testu OAuth/Picker na fizycznym urządzeniu. Nie wykonano rzeczywistych odczytów ani zapisów na kontach Google użytkownika.

Weryfikowane scenariusze: pierwszy i powtórny pakiet, nowy tydzień, aktualizacja, brakujące ilości/nutrition, niekompletność, DRAFT, hash, schemat, formuły, limity, Unicode, brak uprawnień, offline/ukryta aplikacja, wygaśnięcie zgody, zmiana konta, przerwany zapis i ponowienie, współbieżne sprawdzenia, ręczny podgląd kontra automatyzacja, brak duplikatów, brak usuwania przez nieobecność, rejestr po restarcie i odtworzeniu starszej biblioteki, nieujawnianie błędów/tokenów, zachowanie dziennika oraz regresje dotychczasowego eksportu/backupów/PWA. Chromium obejmuje szerokości 360, 430 i 1024 px.

## Odbiór na fizycznym telefonie — nadal wymagany

Nie publikujemy APK w tym etapie. Po osobnej akceptacji builda z konfiguracją Pickera:

1. Zachowaj pełny backup, zainstaluj zgodnie podpisaną aktualizację bez odinstalowywania. Sprawdź historię i ustawienia.
2. **Kryterium 4A:** ponownie zaimportuj ten sam wcześniej użyty JSON na Androidzie. Oczekuj identycznych przepisów/pominięcia, braku duplikatów i niezmienionej historii.
3. Po konfiguracji według google-recipe-picker-android.md połącz konto, wybierz istniejący arkusz. Zweryfikuj rzeczywiste nadanie drive.file, anulowanie, błędne konto i brak zgody. Nie poszerzaj scopes przy błędzie.
4. Czat Dieta przygotowuje wyłącznie BENGER_IMPORT według recipe-sheets-import-spec.md. Pierwszą publikację sprawdź ręcznie, obejrzyj trzy przepisy i porównaj składniki/makro. Szablony z repo mają nieznane nutrition: wymagają świadomego zaznaczenia i uzupełnienia, nigdy automatycznego dodania.
5. Powtórz sprawdzenie i restart — brak duplikatów. Publikacja następnego tygodnia z tymi samymi wersjami także nie duplikuje.
6. Nową kompletną paczkę z rzeczywistymi zweryfikowanymi danymi odżywczymi przetestuj przy włączonym autoimporcie. Zmieniona wyższa wersja istniejącego przepisu ma pozostać do potwierdzenia. Bieżące lokalne edycje/konflikty wymagają ostrzeżenia.
7. Przetestuj DRAFT, brak fragmentu, błędny hash wyłącznie na uzgodnionej testowej publikacji. Nie uszkadzaj gotowych paczek ani istniejących zakładek użytkownika.
8. Włącz tryb samolotowy: biblioteka, dziennik i backup nadal działają. Po powrocie sieci możliwe ponowienie.
9. Sprawdź istniejącą ręczną/automatyczną synchronizację RAW DATA oraz że jej arkusz docelowy nie zmienił się. Porównaj dziennik i historyczne wartości sprzed importu.

## Ograniczenia i następny krok

Wymagana dodatkowa konfiguracja Google Cloud: Picker API, ograniczony browser API key i numer tego samego projektu OAuth. Domyślna konfiguracja nie potrafi nadać dostępu do istniejącego pliku bez tych danych. Oficjalny Picker JS potrzebuje tokenu w pamięci swojego izolowanego WebView — nie w głównym JS/Capacitor; szczegóły i ograniczenia opisano w instrukcji. Origin, ograniczenia klucza i wyłączone cookies mogą wymagać diagnostyki na urządzeniu. Nie uznajemy integracji za odebraną na Androidzie przed takim testem.

Nie skonfigurowano Google Cloud za użytkownika, nie utworzono zakładki/arkusza, nie zmieniono udostępniania. Brak nowych płatnych usług, hostingu i backendu. Nie zmieniono main, produkcji ani dystrybucji APK.

## Lista plików etapu

- `android/app/build.gradle`
- `android/app/src/main/assets/google-recipe-picker.html`
- `android/app/src/main/java/io/github/kubanik21crypto/benger/BengerRecipeSheetsPlugin.java`
- `android/app/src/main/java/io/github/kubanik21crypto/benger/MainActivity.java`
- `android/app/src/main/java/io/github/kubanik21crypto/benger/RecipeSourceProtocol.java`
- `android/app/src/test/java/io/github/kubanik21crypto/benger/RecipeSourceProtocolTest.java`
- `docs/examples/recipe-sheets/BENGER_IMPORT-template.csv`
- `docs/examples/recipe-sheets/draft-three.json`
- `docs/examples/recipe-sheets/invalid-checksum.json`
- `docs/examples/recipe-sheets/invalid-missing-chunk.json`
- `docs/examples/recipe-sheets/invalid-schema.json`
- `docs/examples/recipe-sheets/next-week.json`
- `docs/examples/recipe-sheets/publish.py`
- `docs/examples/recipe-sheets/ready-three.json`
- `docs/examples/recipe-sheets/three-recipes.json`
- `docs/google-recipe-picker-android.md`
- `docs/recipe-sheets-import-report.md`
- `docs/recipe-sheets-import-spec.md`
- `fixtures/recipe-sheets.mjs`
- `package.json`
- `recipe-file-import-ui.js`
- `recipe-file-import.browser.test.js`
- `recipe-file-import.js`
- `recipe-sheets-contract.js`
- `recipe-sheets-import.js`
- `recipe-sheets-ui.js`
- `recipe-sheets.browser.test.js`
- `recipe-sheets.test.js`
- `recipe-ui.js`
- `scripts/public-assets.mjs`
- `sw-assets.js`
