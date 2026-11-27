# Przygotowanie testowego APK 1.0.18

Gałąź: feature/local-sync-export. Baza funkcjonalna: 759df23 (etap 4B).

## Potwierdzone przed budową

- Zachowany APK 1.0.17 ma applicationId io.github.kubanik21crypto.benger i versionCode 28496407.
- SHA-256 zachowanego pliku zgadza się z jego metadata.json.
- Istniejący prywatny klucz podpisujący jest dostępny; jego certyfikat zgadza się z repozytorium i rzeczywistym podpisem APK 1.0.17: `56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2`.
- Nie wygenerowano nowego klucza i nie zmieniono applicationId, OAuth, magazynów danych, backupu ani automatycznej synchronizacji RAW DATA.

## Przygotowane zmiany

- package.json / package-lock.json: 1.0.18; app-version.js i lista zasobów offline wygenerowane istniejącym narzędziem.
- Istniejący skrypt build-apk.mjs korzysta z walidatora recipe-picker-build-config.mjs. Włączony Picker wymaga klucza prywatnym kanałem, włączonego OAuth i potwierdzenia zgodnych numerów projektów przed wywołaniem Gradle.
- Obsługiwany jest plik klucza poza checkoutem z uprawnieniami 600 lub zmienna środowiskowa. Klucz nie jest argumentem polecenia, nie jest wypisywany ani dodawany do metadanych APK.
- Poza repozytorium przygotowano build.env z trzema flagami zgłoszonymi przez użytkownika. Nie ma w nim klucza; potwierdzone numery Pickera i OAuth to 481332161595 (Benger Personal).
- Instrukcja ustawienia klucza i przygotowania APK: google-recipe-picker-android.md.

## Blokada przed zbudowaniem APK z aktywnym Pickerem

1. Klucz BENGER_PICKER_API_KEY nie jest dostępny w środowisku budowania. Nie używamy atrapy ani wyłączonego Pickera jako zastępstwa za żądany APK.
Zgodność projektu została wyjaśniona przez użytkownika: Benger Personal / benger-personal / 481332161595. Wcześniejszy nowy projekt i jego klucz nie będą używane. Klucz musi pochodzić z Benger Personal.

Nie zbudowano ani nie udostępniono skonfigurowanego APK 1.0.18. Nie zmieniono main ani produkcji. Numer versionCode zostanie nadany zgodnie z istniejącą konwencją przy właściwej kompilacji i sprawdzony względem 28496407. Nie wykonano testu aktualizacji na fizycznym telefonie.

## Weryfikacja przygotowania

- Pełne Node: **1813/1813** po aktualizacji testu przypiętej wersji do 1.0.18.
- Chromium: **12/12** testów ukierunkowanych na wydanie, OAuth, autoeksport RAW DATA i import Sheets. Nie był to ponowny pełny zestaw 387 testów; pełny zestaw etapu 4B jest opisany w jego raporcie.
- Android: **39/39** JUnit; `testDebugUnitTest lintRelease`: BUILD SUCCESSFUL. Kompilacja testowa/lint bez klucza Pickera, z domyślnie wyłączoną jego konfiguracją; nie jest to skonfigurowany release APK ani test Google na telefonie.
- `git diff --check`: czysty.
- Testy nowego walidatora: zgodne/niezgodne projekty, brak klucza, OAuth, prywatny plik, odmowa pliku wewnątrz repozytorium, szerokie uprawnienia i podwójne źródło klucza. Dane kluczy w testach są syntetyczne.
