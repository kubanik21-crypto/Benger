# Testowy APK 1.0.18 — kompilacja GitHub Actions

Źródło: feature/local-sync-export, etap 4B 759df23 + przygotowanie wydania a9ef7ab. Nie scalaj z main i nie uruchamiaj wdrożenia produkcji.

## Sekrety i zakres

Użytkownik potwierdził dodanie repozytoryjnego sekretu `BENGER_PICKER_API_KEY`, pochodzącego z **Benger Personal / benger-personal / 481332161595**. Nie trzeba i nie można odczytać jego wartości przez API GitHub. Nie kopiujemy go do Codexa, źródeł, metadanych ani logów.

Do podpisanego APK potrzebny jest również zaszyfrowany sekret Actions `BENGER_ANDROID_SIGNING_BUNDLE`, odtworzony z **istniejącego** prywatnego podpisu. Nie generujemy nowego klucza. Lokalny helper `scripts/android/upload-existing-signing-secret.mjs PRIVATE_SIGNING_DIR` najpierw weryfikuje rzeczywisty certyfikat względem repozytorium, następnie przekazuje pakiet przez stdin do `gh secret set`. Nie wypisuje ani nie zapisuje dodatkowej kopii prywatnego pakietu. Wywołanie wymaga dostępu do api.github.com oraz odpowiednich uprawnień GitHub do zapisu sekretów repozytorium. Nie uruchamiaj go z tracingiem/dumpem zmiennych.

API key jest przeglądarkowym kluczem ograniczonym do właściwych API/origin. Z konieczności znajduje się w APK i tymczasowych wygenerowanych plikach Gradle. Nie stanowi sekretu serwerowego. Ograniczenia Google Cloud muszą pozostać włączone. Sekret podpisujący nie trafia do APK ani artefaktu.

## Ręczne uruchomienie

Istniejący workflow **Android APK** ma osobny job `recipe-picker-test`, aktywny wyłącznie przy `workflow_dispatch` na `feature/local-sync-export` w `kubanik21-crypto/Benger`. Zwykły push, PR lub uruchomienie na innej gałęzi nie uruchamiają tego joba. Dotychczasowy job i produkcyjne workflow pozostają oddzielne.

Po potwierdzeniu dostępu API i zapisaniu istniejącego podpisu:

```sh
gh workflow run android.yml --repo kubanik21-crypto/Benger --ref feature/local-sync-export
```

Alternatywa w interfejsie GitHuba: Actions → Android APK → Run workflow → branch **feature/local-sync-export** → Run workflow. Samo uruchomienie bez podpisu zakończy się bez APK; nie zastępuj podpisu nowym kluczem. Plik workflow już istnieje na domyślnej gałęzi, więc nie wymaga scalania nowych zmian do main.

Job:

1. Sprawdza wersję 1.0.18, pochodzenie od 759df23 i obecność obu sekretów (bez ich wartości).
2. Uruchamia pełne Node i Chromium, bez przekazywania im klucza Pickera.
3. Odtwarza istniejący podpis do prywatnego katalogu RUNNER_TEMP (700, pliki 600).
4. W kroku kompilacji ustawia OAuth i Picker true oraz oba numery projektów **481332161595**. Jedynie ten krok otrzymuje klucz API.
5. Buduje release, uruchamia lintRelease i Android JUnit, sprawdza podpis, applicationId, wersję, versionCode wyższy niż **28496407** oraz wygenerowane natywne flagi i klucz bez wypisywania ich treści.
6. Udostępnia tylko APK i bezpieczne metadata.json w artefakcie **Benger-Recipe-Picker-1.0.18-SHA**, ważnym 14 dni. Nie tworzy GitHub Release, nie zapisuje plików w main ani gałęzi produkcyjnej.
7. Zawsze usuwa prywatne materiały i katalog wygenerowanego buildu. Sekrety pozostają wyłącznie w szyfrowanym magazynie Actions.

Repozytorium jest publiczne; używany jest standardowy runner ubuntu-latest, bez nowego hostingu i płatnej usługi.

## Odbiór APK

Po sukcesie joba należy pobrać artefakt, ponownie porównać hash pliku, rzeczywisty podpis oraz applicationId/versionCode z zachowanym APK 1.0.17. Wydanie wymaga tego samego certyfikatu `56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2` i applicationId `io.github.kubanik21crypto.benger`.

Na telefonie: zachowaj backup → instaluj jako aktualizację bez odinstalowania → sprawdź historię i ustawienia → dotychczasowe konto Google i automatyczny eksport RAW DATA → ręczny podgląd importu przepisów i wybór źródła Pickerem. Nie zmieniaj powiązania RAW DATA. Automatyczny import nowych przepisów pozostaje domyślnie wyłączony. Rzeczywisty test Google Picker i aktualizacji na telefonie nie jest zastępowany testami CI.

## Stan bieżącego środowiska

Git HTTPS do repozytorium działa. Żądanie HTTPS do `api.github.com` kończy się **CONNECT 403** — blokadą polityki sieci przed połączeniem z API. Z tego środowiska nie potwierdzono jeszcze sekretów przez API, nie podłączono podpisu jako sekretu i nie uruchomiono kompilacji Actions. To nie jest potwierdzenie błędnego klucza ani wyniku autoryzacji GitHuba.

W ustawieniach bieżącego środowiska Codexa trzeba dopuścić domenę **api.github.com**, zachowując pozostałe ustawienia. Po zastosowaniu zmiany sprawdzamy API normalnym klientem, bez obchodzenia polityki i bez przekazywania tokenów do czatu. Sam dostęp sieciowy nie gwarantuje uprawnień do zapisu sekretów; te sprawdzimy dopiero po skutecznym połączeniu. Jeśli pobranie artefaktu przekieruje na dodatkową blokowaną domenę, należy dopuścić tylko faktycznie wskazany host, bez szerokich wildcardów.

Nie zbudowano jeszcze testowego APK z rzeczywistym kluczem Pickera; nie udostępniamy starego ani niekompletnego APK jako nowej wersji.

## Testy przygotowania workflow

Pełne Node: **1820/1820**. Nowe testy obejmują odrzucenie złej tożsamości/podpisu/wersji APK, sprawdzenie flag i konfiguracji Pickera bez ujawniania klucza, prywatne uprawnienia odtworzonego podpisu i błędy bez treści sekretów. Zweryfikowano YAML workflow i ograniczenia joba. Nowy walidator sprawdzono też na rzeczywistym zachowanym APK 1.0.17: format aapt i certyfikat są akceptowane. `git diff --check`: czysty. Nie uruchomiono jeszcze tego workflow na GitHubie — to testy lokalne i syntetyczne oraz kontrola poprzedniego APK, nie wynik nowej kompilacji CI.
