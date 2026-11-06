# Odtworzenie Bengera poza Codexem

Backup kodu to historia Git i pliki źródłowe, a nie obraz całej maszyny. Narzędzia trzeba zainstalować ponownie. To uniezależnia projekt od jednego środowiska i hostingu.

## Kod i frontend

1. Zweryfikuj SHA256 pobranej paczki backupu.
2. Rozpakuj ZIP. `git clone --mirror Benger-all-branches.bundle Benger.git` tworzy kopię wszystkich zapisanych referencji. `git clone Benger-all-branches.bundle Benger` tworzy checkout; wskaż potem właściwą gałąź.
3. Główna wersja odzyskanego kodu to main 1.0.5. Android jest na `feature/android-apk`. Dokładne SHA i ograniczenia zawiera spis odzyskania.
4. Zainstaluj Node.js 22 i Git. Uruchom `npm ci` tylko na gałęzi posiadającej package-lock/dependencies; bazowy frontend bez zależności nie wymaga instalowania npm packages.
5. `npm test`, `CHROMIUM_PATH=/ścieżka/do/chrome npm run test:browser`, `git diff --check`.
6. `npm start` uruchamia lokalny serwer. Statyczny artifact: `BENGER_OFF_SEARCH_URL=https://benger-off-search-preview.kubanik-21.workers.dev/search npm run build:web -- /tmp/benger-web` (świeży pusty katalog). Sprawdź aktualną konfigurację endpointu przed publikacją. Worker AI nie jest wymagany.

## Android

Checkout `feature/android-apk`; Node 22, Java JDK 21, Android SDK platform 36/build-tools 36.0.0 (AGP może użyć również 35.0.0). Zależności npm i Gradle są przypięte w source/lockfiles. Zainstaluj SDK zgodnie z jego warunkami; nie pobieraj go przy każdym teście frontendu. Źródłowe instrukcje `docs/android-apk.md` opisują budowanie i licencje.

Dla debug: `npm ci`, `npm run android:prepare`, Gradle `:app:assembleDebug`. Podpisana aktualizacja wymaga oryginalnego prywatnego keystore oraz hasła, dostarczonych poza repozytorium do istniejącego skryptu budowania. Nie wypisuj ich w logach.

Niezmienne: applicationId `io.github.kubanik21crypto.benger`, origin `https://localhost`, `BengerDB`, `benger.nutrition.v1`, certyfikat SHA256 `015487cda5f2738abb6e814780f37a6271da720df5284e8a50f4bbb1f5bc7531`. Nie generować nowego klucza pod tym samym identyfikatorem jako zamiennika utraconego podpisu. VersionCode aktualizacji musi wzrosnąć.

## Co przechowywać osobno, prywatnie

- Pełny eksport danych aplikacji z telefonu (w tym zdjęcia, jeśli potrzebne).
- Oryginalny klucz podpisu APK i hasło, np. wcześniej pobrany `Benger-podpis-PRYWATNE.zip`; nie należy do archiwum źródeł.
- Ewentualne klucze dostępu do dostawców hostingu — w mechanizmie sekretów właściwej platformy, nie w kodzie, ZIP źródeł ani rozmowie.

Repozytorium nie zastępuje tych kopii. Zmiana hostingu PWA zmienia origin i wymaga jawnego przeniesienia danych przez backup. Zmiana hostingu Git nie zmienia danych istniejącej APK.

## Zasady utrzymywania kopii

Jedna zwykła operacja Git fetch/push na potrzebne zmiany, bez force-push i bez pętli ponawiania logowania. Nie kopiujemy całego `/workspace` ani credential/config plików maszyny. Archiwum zawiera wyłącznie wersjonowany kod, historię Git i instrukcje. `git bundle verify` i odtworzenie w pustym katalogu sprawdzają jego przenośność. Pobierz paczkę również poza Codexa i zachowaj drugą kopię u innego dostawcy — sam link w rozmowie nie jest trwałym magazynem.

Każdy kolejny zaakceptowany etap należy pushować oraz okresowo tworzyć bundle. Przed użyciem CI sprawdzić plan/limity dostawcy, uruchamiać testy dla potrzebnych zmian i nie uruchamiać automatycznie usług płatnych. Licencje źródeł danych i bundlowanych bibliotek pozostają w repozytorium. Nieznane przyczyny poprzedniej blokady konta nie stanowią dowodu naruszenia przez kod.

Jednorazowe paczki do pobierania mogą być udostępnione na osobnej gałęzi `backup-downloads-*`. Skrypt pomija te gałęzie podczas kolejnych eksportów, aby nie kopiować ZIP-a do następnego ZIP-a. Ta gałąź nie jest produkcją ani źródłem nowych zmian aplikacji.
