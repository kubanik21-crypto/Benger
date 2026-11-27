# Benger 1.0.22 — testowy APK etapu 4C

Baza zaakceptowana: feature/local-sync-export, 58bfd99. Nie scalać z main i nie wdrażać produkcji. Wydanie zmienia numer wersji i zabezpieczenia kompilacji, zachowując wdrożenie 4C.

## Tożsamość i migracja

- applicationId: io.github.kubanik21crypto.benger, bez zmiany.
- Zachowany certyfikat SHA-256: 56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2. Rzeczywisty keystore porównano z podpisanym APK 1.0.21, bez ujawniania haseł.
- versionName 1.0.22. CI nadaje rosnący versionCode według czasu, wymagając wartości > 28567213 z ostatniej dystrybucji 1.0.21. Dokładny kod zostaje zapisany w metadata.json artefaktu.
- Nie zmieniono origin https://localhost, wersji/struktury istniejących object stores IndexedDB, klucza dziennika localStorage ani plików prywatnych preferencji Androida. Nowe planowanie korzysta z osobnego wpisu meta. Nie ma operacji czyszczenia ani migracji przepisującej historię.
- Powiązania źródła przepisów i celu RAW DATA, ustawienia autoeksportu i autoimportu przepisów pozostają w istniejących magazynach; build nie ustawia ich ponownie. Autoimport jadłospisu pozostaje domyślnie false. Nie zerujemy wcześniej zapisanych preferencji użytkownika.
- OAuth i Picker są włączone w CI z dotychczasowym projektem Benger Personal 481332161595 i tym samym sekretem Pickera. Nie zmieniono Google Cloud ani zakresów uprawnień. Po aktualizacji procesu może być potrzebne ponowne połączenie sesji Google; nie oznacza to utraty powiązań lub danych.
- Backup v8 bez stanu planowania zachowuje dotychczasową strukturę; nowy v9 zawiera data.mealPlans. Import v8/v9 jest testowany, włącznie z zachowaniem starych danych, historią, przerwaniem zapisu i wyłączeniem autoimportu przy restore v9.

## Kompilacja i dystrybucja

W tym środowisku nie ma lokalnej wartości klucza Pickera. Używamy istniejącego GitHub Actions z sekretem BENGER_PICKER_API_KEY. Oznaczony commit [picker-test-apk] uruchamia jeden testowy build na gałęzi feature/local-sync-export, bez main lub produkcji.

Actions uruchamia pełne Node i Chromium, następnie assembleRelease unsigned, lintRelease i Android JUnit. Artefakt ZIP Benger-UNSIGNED-1.0.22-SHA zawiera APK bez podpisu i metadata.json z SHA-256 jego bajtów, source SHA, wersją, versionCode i oczekiwanym certyfikatem. Po pobraniu właściciel przesyła ZIP do czatu; zostanie sprawdzony, podpisany istniejącym kluczem i porównany z poprzednim APK. Wynik podpisania ma inną sumę SHA-256, podawaną z gotowym APK i metadanymi. Nie instaluj unsigned APK.

Lokalna kompilacja bez klucza Pickera służy tylko sprawdzeniu kodu i nie jest przekazywana do instalacji. Nie wolno zastąpić istniejącego podpisu nowym ani proponować odinstalowania w przypadku niezgodności. Instrukcja pobierania: [Actions i podpisanie lokalne](recipe-picker-actions-build.md).

## Test odbiorczy na fizycznym telefonie

1. W 1.0.21 pobierz pełny backup v8 i zachowaj go osobno. Nie odinstalowuj Bengera i nie czyść pamięci aplikacji.
2. Po otrzymaniu podpisanego 1.0.22 zainstaluj jako aktualizację. Jeżeli Android odmawia, zatrzymaj się i prześlij komunikat.
3. Sprawdź wersję, kilka starych dni dziennika i ich makro, treningi, przepisy/warianty oraz ustawienia. Sprawdź widoczność dotychczasowych powiązań Google i automatycznej synchronizacji RAW DATA. Nie wybieraj ponownie plików, jeśli powiązania są poprawne. W razie wygaśnięcia połącz ponownie konto.
4. Sprawdź dotychczasowy import przepisów i jego przełącznik. Przełącznik „Automatyczny import jadłospisu” ma pozostać wyłączony na pierwszą próbę.
5. Czat Dieta musi wcześniej przygotować kompletną publikację READY w BENGER_MEAL_PLAN według docs/meal-plan-import-spec.md oraz wymagane przepisy w BENGER_IMPORT. Bez nowej zakładki/publikacji nie da się przeprowadzić odbioru importu planu. Nie zmieniaj Google Cloud ani zakresu OAuth.
6. Zaimportuj wymagane przepisy, potem wybierz „Sprawdź nowy jadłospis”. Przejrzyj plan i zatwierdź. Sam import nie może zmienić dziennych kalorii spożycia ani dopisać pozycji do RAW DATA.
7. Na dniu planu zmień porcję, sprawdź makro i potwierdź jeden posiłek (także szybkim podwójnym kliknięciem). Ma powstać jeden zwykły wpis. Sprawdź jego edycję w dzienniku, cofnięcie, pominięcie oraz lokalną zamianę innej pozycji.
8. W trybie samolotowym uruchom aplikację ponownie i otwórz plan, składniki oraz makro. Brak sieci nie może usuwać zapisanych danych.
9. Aktualizacja zrealizowanego dnia ma wymagać podglądu i osobnego potwierdzenia zachowania spożycia. Nie może zmieniać starego wpisu ani pominięć/zamian.
10. Dopiero po ręcznym odbiorze włącz autoimport jadłospisu. Nowy kompletny tydzień może importować się przy uruchomieniu/powrocie oraz w trakcie używania; aktualizacje nadal wymagają przeglądu. Nie ma WorkManagera.
11. Pobierz backup v9 z planem. Odtwarzanie v8/v9 testuj na izolowanej instalacji testowej, nie przez kasowanie danych podstawowego telefonu. v9 wymaga nowego APK obsługującego 4C.

Testy z atrapą Google i lokalne sprawdzenie certyfikatu nie zastępują rzeczywistej instalacji i weryfikacji Google Sheets na telefonie.

## Wyniki przygotowania

Node 1851/1851; ukierunkowane Chromium 7/7 (jadłospis i importer przepisów); Android JUnit 61/61; assembleRelease unsigned i lintRelease — BUILD SUCCESSFUL. Pełny Chromium uruchamia Actions przed artefaktem. Czysty git diff --check. Lokalny APK bez konfiguracji Pickera usunięto, aby nie pomylić go z właściwą dystrybucją. Fizyczna instalacja, zachowanie uprawnień Google i import rzeczywistego planu wymagają odbioru na urządzeniu. SHA-256 właściwego unsigned APK będzie w metadata.json; hash podpisanego pliku powstanie po dostarczeniu artefaktu do podpisania.
