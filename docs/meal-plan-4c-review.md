# Etap 4C — raport i odbiór

## Punkt wyjścia

Zweryfikowano czyste feature/local-sync-export na d5e7837 oraz zgodność HEAD z FETCH_HEAD po odczycie zdalnej gałęzi. Zachowano dotychczasowe prace. Moduł 4B zapisuje przepisy, ich historię, produkty i warianty w jednej transakcji IndexedDB, z kontrolą zmienionej biblioteki. Rejestr pobrań jest osobno w localStorage, ale sam w sobie nie oznacza zapisania przepisów; ponowienie uzgadnia bibliotekę i nie dodaje identycznych rekordów. Nie wykryto krytycznej blokady rozszerzenia.

Istniejący dziennik przechowuje rzeczywiste wpisy w localStorage; biblioteka przepisów, wersje, warianty i pozostałe metadane są w IndexedDB. Recipe Base → Variant → Meal Snapshot jest wykorzystywany przez nowe potwierdzenie, bez przeliczania historii z aktualnej bazy. Istniejące Recipe Pack i statyczny import październikowego planu grupują przepisy, ale nie zapewniają osobnego tygodniowego harmonogramu spożycia. Nie użyto ich jako dziennika.

## Architektura i zmienione pliki

- meal-plan-contract.js: ścisły kontrakt v1, fragmenty, kompletność, manifesty i SHA-256; plan oddzielny od publikacji przepisów.
- meal-plan.js: repozytorium nad istniejącym meta IndexedDB, przypięcie niezmienionych wersji źródłowych i wariantów, atomowy zapis planu/historii/rejestru, kontrola aktualnego podglądu i konflikty spożycia.
- meal-plan-import.js: niezależny przełącznik auto (wyłączony), ręczne sprawdzanie, start/resume/online/visibility/30 minut, ograniczone ponowienia, obsługa busy dotychczasowego mostu.
- meal-plan-ui.js i app.js: ustawienia, podgląd publikacji i konfliktów, plan w wybranym dniu dziennika, gramatury/makro/przepis, ilość/jednostka (odświeżenie statusu bez zmiany danych nie resetuje wpisywanej porcji), potwierdzenie, cofnięcie, pominięcie i zamiana. Istniejące metody ręcznego wpisu i edycji pozostają dostępne.
- RecipeSourceProtocol.java: ten sam odczyt z zamkniętym wyborem BENGER_IMPORT lub BENGER_MEAL_PLAN. Dotychczasowe sygnatury i zakresy przepisów zachowane.
- BengerRecipeSheetsPlugin.java: nowa metoda readMealPlans, wspólna implementacja GET-only odczytu obu zakładek, to samo powiązanie pliku i natywny token. Bez nowego Pickera, OAuth, zakresów ani transmisji tokenów do aplikacyjnego JS.
- backup.js: opcjonalne mealPlans, eksport v9 przy obecności stanu planistycznego (w przeciwnym razie v8), zgodność 1–8, ostrożne scalanie i odzyskiwanie przez istniejący journal.
- scripts/public-assets.mjs, sw-assets.js: dołączenie modułów do istniejącej paczki offline. PWA nie uruchamia nowego UI ani odczytów źródła; format backupu rozpoznaje nowe dane dla przenośności.
- style.css: układ kart planu w jednej kolumnie, bez dziedziczenia siatki kompaktowego dziennika.
- recipe-file-import.browser.test.js: test czeka na zakończenie asynchronicznego odczytu pliku i odświeżania po zapisie (odblokowanie Anuluj), zanim próbuje zamknąć dialog; wcześniej mógł klikać w nadal zablokowany przycisk. Asercje aktualizacji i historii pozostają bez zmian.
- package.json: nowe testy w standardowych pełnych zestawach. Wersji APK nie zmieniono, niczego nie opublikowano.
- meal-plan.test.js, meal-plan.browser.test.js, fixtures/meal-plan.mjs, RecipeSourceProtocolTest.java: syntetyczne przypadki i rzeczywiste IndexedDB/Chromium.
- docs/meal-plan-import-spec.md, docs/meal-plan-import.schema.json, examples/meal-plan/*: instrukcja Dieta, schemat i pełne przykłady DRAFT/READY/korekty dnia z sumami kontrolnymi.

## Granice bezpieczeństwa

Plan nigdy nie zapisuje kalorii sam. Tylko jawne potwierdzenie tworzy zwykły Meal Snapshot przepisu przez istniejący silnik createRecipeExecution/executionPortion i ten sam zapis dziennika. UUID jest stały dla namespace/plan.id/meal.id; przed zapisem odczytuje się aktualny dziennik, a potwierdzenia korzystają z Web Locks, gdy są dostępne. W głównym Android WebView operacje są dodatkowo chronione blokadą interfejsu. Awaria zapisu nie tworzy potwierdzenia w osobnej bazie, ponieważ status zjedzenia wynika ze zwykłego wpisu dziennika.

Nowa wersja planu nigdy nie usuwa ani nie poprawia rzeczywistego wpisu. Zmiana/usunięcie zrealizowanego slotu wymaga dodatkowej zgody na zachowanie spożycia. Lokalne zamiany/pominięcia zostają, usunięcie ręcznie zmienionego slotu jest blokowane. Wymagane wersje receptur są sprawdzane ponownie w transakcji; lokalnie zmienione źródło, nieznana masa, wariant lub brak makro wstrzymują import. SHA-256 jest obowiązkowy.

Sync export i mapper RAW DATA nie były zmieniane. Test potwierdza brak niezjedzonych planów w eksporcie. Żaden test nie używał rzeczywistych prywatnych danych ani nie zapisywał do Google. Nie zmieniono arkusza, Google Cloud, uprawnień, podpisu ani applicationId. Nie scalono main i nie wdrożono produkcji. Nie budowano dystrybucyjnego APK z kluczem Pickera; lokalny unsigned smoke build nie nadaje się do instalacji.

## Ograniczenia

- Odbiór na fizycznym telefonie i rzeczywistym BENGER_MEAL_PLAN pozostaje otwarty; mock mostu w Chromium i test Java nie potwierdzają działania Google na urządzeniu.
- Przepisy i plan nie są zapisywane jedną transakcją: istniejący importer zatwierdza przepisy, a kompletny plan jest później niezależnie uzgadniany i atomowo zapisywany. Awaria może pozostawić nowe przepisy bez planu, nigdy częściowy plan lub spożycie.
- Android jest priorytetem; PWA nie ma nowego panelu. Bez WorkManagera nie ma gwarancji importu po zamknięciu procesu. Wygasła natywna sesja OAuth może wymagać ponownego połączenia.
- Dziennik zachowuje dotychczasowy localStorage. Web Locks koordynuje nowe potwierdzenia; nie stanowi migracji wszystkich starych zapisów ręcznych do wielokartowej transakcyjnej bazy. Równoczesne stare operacje ręczne w różnych kartach nadal podlegają istniejącym ograniczeniom aplikacji.
- Starszy APK 1.0.21 nie odczyta backupu v9 z planami. Przygotuj v8 na obecnym telefonie przed przyszłą aktualizacją i zachowaj go oddzielnie. Odtwarzanie nowych planów wymaga przyszłego APK z 4C.
- Limity historii i tygodni są jawne; nie ma automatycznej destrukcyjnej archiwizacji. Po osiągnięciu limitu import zatrzymuje się.

## Instrukcja odbioru na telefonie po akceptacji i osobnym przygotowaniu APK

1. Na aktualnym Bengerze wyeksportuj backup i zachowaj obecny podpisany APK. Nie odinstalowuj i nie czyść danych.
2. Przekaż czatowi Dieta specyfikację, schemat oraz przykłady. Nie kopiuj syntetycznych kalorii do rzeczywistego planu. Czat przygotowuje nową zakładkę w istniejącym arkuszu dopiero po uzgodnieniu z właścicielem.
3. Po osobnym zatwierdzeniu wydania zainstaluj zgodnie podpisany APK z wyższym versionCode. Obecny etap nie udostępnia takiego APK.
4. Pozostaw automatyczne importy wyłączone. Sprawdź dziennik, treningi, przepisy, OAuth i RAW DATA. W razie wygaśnięcia połącz konto ponownie, bez ponownego wybierania źródła, jeśli powiązanie nadal istnieje.
5. Najpierw przejrzyj i zatwierdź wymagane przepisy przez istniejący importer. Potem „Sprawdź nowy jadłospis”, obejrzyj daty, ilości i referencje, zatwierdź plan. Dzienne kcal spożycia muszą pozostać bez zmian.
6. W dniu z planu potwierdź jeden posiłek, także powtórnym kliknięciem. Sprawdź jeden zwykły wpis i prawidłowe kcal. Zmień ilość w zwykłym wpisie, pomiń/zamień inne pozycje i cofnij potwierdzenie. Porównaj RAW DATA: tylko rzeczywiste wpisy.
7. Włącz tryb samolotowy i uruchom aplikację ponownie: plan, przepis i makro muszą się otworzyć. Sprawdzenie źródła ma zgłaszać brak sieci, bez utraty lokalnego planu.
8. Opublikuj nową wersję jednego dnia pełnego tygodnia. Aktualizacja ma czekać na podgląd; zrealizowany posiłek wymaga osobnego potwierdzenia zachowania spożycia. Ręczne zamiany i pominięcia mają pozostać.
9. Dopiero po tych próbach włącz „Automatyczny import jadłospisu”. Nowy kompletny tydzień może zostać zapisany automatycznie przy używaniu aplikacji, bez kalorii w dzienniku. Aktualizacje nadal czekają.
10. Wyeksportuj nowy backup v9, sprawdź plik i wykonaj restore na izolowanej instalacji testowej, bez usuwania danych z telefonu podstawowego.

## Weryfikacja lokalna

- Pełny Node: 1851/1851, bez błędów.
- Android JUnit: 61/61, bez błędów; assembleRelease unsigned i lintRelease: BUILD SUCCESSFUL.
- Formalny JSON Schema: poprawny pełny tydzień i obie publikacje READY (pierwsza i korekta dnia).
- Pełny Chromium: 393/393, bez błędów; dodatkowy ponowny test modułu jadłospisu po zabezpieczeniu pola porcji: 3/3. Testy korzystają z prawdziwego IndexedDB, a most Google jest symulowany.
- git diff --check: czysty przed commitem.

Podgląd interfejsu: `/workspace/exports/meal-plan-4c-390.png`, wyłącznie dane syntetyczne. Paczka dla Dieta: `/workspace/exports/Benger-Meal-Plan-v1-spec.zip`.
