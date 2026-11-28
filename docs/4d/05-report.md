# 4D — raport zmian i odbiór

Wersja docelowa testowa: **1.0.23**, gałąź feature/local-sync-export. Baza 04d9892 / APK 1.0.22. Bez scalania z main, produkcji, zmiany OAuth, arkuszy i dodatkowych usług.

## Architektura i pliki

- `more-shell.js`, `navigation.js`: kompaktowe Więcej, dedykowane adresy Synchronizacji, Diety i Zaawansowanych, istniejące kontrolery przenoszone bez klonowania. Zapamiętanie scrolla, poprawna główna zakładka i Wstecz. Import planów treningowych nie został dodany.
- `daily-shell.js`, `meal-plan-ui.js`, `app.js`, `style.css`: podsumowanie wybranego dnia i wspólne grupy posiłków planowanych/rzeczywistych wraz z dodatkowymi produktami. Wpis rzeczywisty korzysta z dotychczasowego edytora. Szczegóły planu są zwinięte po potwierdzeniu; rzeczywiste składniki pochodzą ze snapshotu. Plan nie nalicza spożycia.
- `diary-origins.js`: BUG-01. Zmiana porcji już zachowywała createdAt; problem występował przy cofnięciu i ponownym potwierdzeniu tego samego deterministycznego ID. Zachowujemy znany pierwotny czas zapisanej pozycji, bez przepisywania historycznych wpisów.
- `sync-intents.js`, `sync-intent-proof.js`, `sync-change-summary.js`, `google-sheets*.js`, `sheets-auto.js`, `sheets-reconcile.js`: trwały rejestr świadomych operacji i prostszy interfejs. Szczegóły i ograniczenia: [04-smart-sync.md](04-smart-sync.md).
- `training-repository.js`, `progress.js`, `backup.js`: rejestr zmian przy rzeczywistym zapisie oraz blokada po przywróceniu kopii. Nie zmieniono formatu backupów v8/v9 ani planowanych danych na spożycie.
- `GoogleSheetsWire.java` i testy: natywna weryfikacja dokładnych dowodów usunięć. Bez zmian certyfikatu, applicationId i zakresów uprawnień.
- `training-ui.js`, `progress-ui.js`, `dashboard-ui.js`: niewidoczny moduł nie pobiera pełnego snapshotu. Jawny zapis celów nadal odświeża dane. Przeglądanie dat nie emituje zdarzenia zmiany żywienia.
- Testy: `smart-sync.test.js`, współdzielone fixtures JS/Java, `diary-unified.browser.test.js`, `more-shell.browser.test.js` i istniejące pełne regresje. Publiczne assets nie zawierają fixtures, raportów ani prywatnego materiału.

## Wydajność — pomiar rzeczywistego kodu, dane syntetyczne

Porównanie bazowego worktree 04d9892 i bieżącego kodu, ta sama sześciopunktowa nawigacja. Ukryte odczyty całego repozytorium treningowego: **6 → 0**. Zdarzenia zmiany dziennika po samym obejrzeniu dwóch dat: **2 → 0**. Pliki wynikowe: `/workspace/exports/4d-performance/before.json` i `after.json`.

Pomiar obejmuje sztuczne oczekiwanie 180 ms po przejściu; czasy routeMs nie są dowodem przyspieszenia telefonu. Nie deklarujemy wyniku FPS ani oszczędności baterii bez pomiaru fizycznego urządzenia. Ograniczono pracę i liczbę odczytów, bez zmiany obliczeń.

## Dowody wizualne

Audyt: [01-audit.md](01-audit.md). Przed: `/workspace/exports/4d-before/`. Po: `/workspace/exports/4d-after-native/`. Obrazy powstały w prawdziwym Chrome, na danych syntetycznych z symulowaną platformą Android. Nie są zdjęciami fizycznego telefonu. Stan błędu transportu Google w zrzucie wynika z braku rzeczywistej usługi w mocku. Testy obejmują szerokości 320/390/430 px oraz oba motywy.

## Dystrybucja i odbiór

APK musi mieć `io.github.kubanik21crypto.benger`, certyfikat o SHA-256 zapisanym w `android/signing-certificate.sha256` i versionCode większy niż **28575272**. Wersja **1.0.23**. Istniejący klucz Picker dostępny jest wyłącznie w zatwierdzonym kroku GitHub Actions; kompilacja lokalna bez niego służy kontroli kodu i nie jest wersją do instalacji. Artefakt CI unsigned nie nadaje się do instalacji. Po przekazaniu ZIP z CI zostanie podpisany dotychczasowym kluczem i zweryfikowany względem 1.0.22. Nie odinstalowywać istniejącej aplikacji ani czyścić danych.

Krótki odbiór nowych funkcji po aktualizacji:

1. Więcej → Synchronizacja/Dieta/Zaawansowane, Wstecz i powrót do przewiniętego dziennika.
2. W dniu z planem zmienić rzeczywistą porcję z tej samej karty. Sprawdzić zachowanie daty oraz obecność dodatkowych ręcznych produktów; plan i spożycie mają różne statusy.
3. Przy już włączonej automatyzacji poprawić jeden posiłek, potem usunąć pojedynczy wpis. Sprawdzić potwierdzony status i wynik arkusza. Zwykła udokumentowana operacja nie wymaga dodatkowych checkboxów. Nie włączać automatyzacji tylko na potrzeby instalacji, jeśli była wyłączona.
4. Sprawdzić, że szczegóły wyjątkowej blokady są czytelne. Nie zatwierdzać nieznanych ani masowych zmian bez przeglądu.

Nie jest wymagane powtórzenie wszystkich wcześniej zaakceptowanych ręcznych testów offline, importów i backupu. Ich regresje pozostają automatyczne. Nowe rzeczywiste działanie Smart Sync i ergonomię należy potwierdzić na telefonie; testy symulowane tego nie zastępują.

## Wyniki weryfikacji

- Node: **1861/1861**, bez pominiętych testów.
- Android JUnit: **64/64**, zero błędów, porażek i pominięć.
- Android `assembleRelease` oraz `lintRelease`: **BUILD SUCCESSFUL**, 0 błędów i 35 ostrzeżeń lint (atrybuty/zasoby/teksty/układ); lokalny build kontrolny ma wyłączoną konfigurację Pickera i nie jest udostępniany do instalacji.
- Końcowe testy układu/nawigacji/edycji: **12/12**, dodatkowy sprawdzian przewijania i późnej inicjalizacji panelu **2/2**.
- Pełna regresja Chromium: **396/396**, zero porażek i pominięć. Po końcowej korekcie CSS i zapamiętywania scrolla powtórzono celowane testy UI/nawigacji (wyniki powyżej); CI uruchamia cały zestaw ponownie z czystego commita.
- Zgodność istniejącego klucza z przypiętym certyfikatem: potwierdzona. Bazowy podpisany APK 1.0.22 ma applicationId i versionCode wskazane wyżej. Nowy binarny APK wymaga osobnej weryfikacji po kompilacji CI i podpisaniu.

Brak testu tej aktualizacji na fizycznym telefonie. Testy JS/Chromium/Java nie potwierdzają rzeczywistej zgody Google ani faktycznego zapisu w prywatnym arkuszu.
