# Przygotowanie testowego APK 1.0.18

## Wynik końcowy — testowy APK podpisany i zweryfikowany

- Wersja **1.0.18**, versionCode **28546933** (1.0.17: 28496407).
- Źródło APK: **e5ab88806c1b0bb1ab8006fe85d35fac7384ca53**, baza 4B: 759df23.
- Artefakt unsigned pochodzi z przebiegu https://github.com/kubanik21-crypto/Benger/actions/runs/45975020611 i został przekazany przez użytkownika w ZIP.
- Sprawdzono hash unsigned, metadane, historię commita i tożsamość aplikacji. APK podpisano offline zachowanym kluczem, bez odczytu klucza API ani transferu podpisu do GitHuba.
- Podpis finalnego APK jest identyczny jak w zachowanym APK 1.0.17: certyfikat SHA-256 `56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2`.
- applicationId **io.github.kubanik21crypto.benger**, konfiguracja origin Capacitor i wszystkie pliki wejściowego APK pozostały bez zmian; dodano podpis i wyrównano ZIP.
- Nazwa: **Benger-1.0.18-e5ab888.apk**, rozmiar **9615142** bajty.
- SHA-256 finalnego APK: `4e7eea33c985575d2ceb5aaee745593f9a7e2f124aada65d6bd57b08964151cb`.
- OAuth oraz Picker włączone, projekt **481332161595**. Domyślne wyłączenie autoimportu, format backupu i mechanizm RAW DATA nie były zmieniane podczas podpisywania.
- Sprawdzono apksigner, zipalign, aapt, hash i zgodność z poprzednim APK. Pełne Node po poprawce helpera: **1826/1826**; git diff --check czysty.

W signerze poprawiono sposób podania hasła PKCS12: apksigner korzysta z hasła magazynu również dla klucza. Przekazanie tego samego pliku dwukrotnie próbowało czytać drugą, nieistniejącą linię. Nie modyfikowano pliku hasła ani klucza. Poprawka helpera nie zmienia skompilowanego kodu aplikacji e5ab888.

Pliki dostawy są poza repozytorium: /workspace/releases/benger-recipe-picker-1.0.18/ (APK, metadata.json, INSTRUKCJA.txt i ZIP SIGNED). Nie zawierają prywatnego podpisu. Nie scalano z main i nie wdrażano produkcji. To APK testowy; instalacja, Google Picker i zachowanie rzeczywistych danych na telefonie wymagają odbioru użytkownika. Należy wykonać backup, instalować jako aktualizację, bez odinstalowywania. Po aktualizacji może być konieczne ponowne połączenie konta Google, ponieważ sesja OAuth jest w RAM.

## Historia przygotowania (poniższe blokady zostały rozwiązane wariantem rozdzielonym)

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

## Aktualna droga bez terminala i bez zmiany sieci Codexa

Zastępujemy poprzedni plan instrukcją recipe-picker-actions-build.md: ręczny build unsigned w GitHub Actions z istniejącym sekretem Pickera, pobranie ZIP przez użytkownika i lokalne podpisanie tym samym kluczem. Nie potrzeba sekretu podpisu w GitHubie ani dostępu Codexa do api.github.com. Do właściwego wydania nadal potrzebny jest artefakt z udanego przebiegu Actions; nie wydajemy lokalnego buildu testowego bez klucza.
