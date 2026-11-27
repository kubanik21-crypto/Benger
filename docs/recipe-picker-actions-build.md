# Testowy APK 1.0.18 — Actions bez podpisu, podpisanie lokalne

Źródło: feature/local-sync-export, etap 4B 759df23 + przygotowanie wydania 1.0.18. Nie scalaj z main i nie uruchamiaj wdrożenia produkcji.

## Obecny wariant — bez zmieniania ustawień sieci Codexa

GitHub Actions buduje **APK bez podpisu**, korzystając tylko z dodanego przez użytkownika sekretu `BENGER_PICKER_API_KEY`. Codex uruchamia pojedynczy build oznaczonym pushem; użytkownik pobiera artefakt ze zwykłej strony GitHuba. Codex podpisuje otrzymany plik lokalnie dotychczasowym kluczem. Nie wymaga to połączenia Codexa z api.github.com, odczytywania klucza API, nowego tokenu GitHuba ani przekazywania prywatnego podpisu do GitHuba.

Projekt: **Benger Personal / benger-personal / 481332161595**. Numer Pickera i dotychczasowego OAuth pozostaje ten sam. W tym wariancie **nie jest potrzebny BENGER_ANDROID_SIGNING_BUNDLE** i nie uruchamiamy upload-existing-signing-secret.mjs. Poprzednio przygotowane helpery CI podpisu nie są używane przez job importu przepisów.

Klucz Pickera znajduje się w skompilowanym APK tak jak w docelowej aplikacji — to ograniczony klucz przeglądarkowy, nie sekret serwerowy. Nie jest wypisywany w logach, dodawany do źródeł ani metadata.json. Ograniczenia API i referrera Google Cloud pozostają wymagane. Prywatnego podpisu nie ma w artefakcie.

## Uruchomienie i kroki użytkownika

W aktualnym main (41ae0a) nie ma .github/workflows/android.yml. Dlatego wcześniejsza instrukcja Run workflow wymagałaby pliku na domyślnej gałęzi i nie nadaje się do obecnego repozytorium. Nie zmieniamy main.

Codex uruchamia jedną kompilację zwykłym pushem commita oznaczonego **[picker-test-apk]** na **feature/local-sync-export**. Pozostałe pushe bez tego oznaczenia nie uruchamiają joba Pickera. Workflow_dispatch pozostaje alternatywą na przyszłość, gdy workflow będzie dostępny na domyślnej gałęzi; nie jest potrzebny teraz.

1. Otwórz https://github.com/kubanik21-crypto/Benger/actions?query=branch%3Afeature%2Flocal-sync-export .
2. Otwórz najnowszy przebieg **Android APK** z oznaczeniem **[picker-test-apk]**.
3. Zaczekaj na powodzenie joba **recipe-picker-test**. Drugi, stary job może być pominięty — to oczekiwane.
4. Na dole przebiegu, w **Artifacts**, pobierz **Benger-UNSIGNED-1.0.18-SHA**.
5. Prześlij cały pobrany ZIP do tego czatu. **Nie instaluj zawartego w nim APK** — przed instalacją wymaga podpisania.

Jeśli build się nie powiedzie, przekaż nazwę nieudanego kroku lub link do przebiegu, bez wartości sekretów. Nie trzeba zmieniać ustawień środowiska, dodawać kolejnego sekretu ani wklejać tokenów.

## Co robi CI

Job `recipe-picker-test` działa wyłącznie w kubanik21-crypto/Benger na feature/local-sync-export: przy jawnie oznaczonym pushem [picker-test-apk] lub workflow_dispatch. Nie uruchamia go nieoznaczony push ani PR. Ma tylko contents:read i nie zapisuje niczego do repozytorium ani produkcji.

- Sprawdza 1.0.18, pochodzenie od 759df23 i obecność sekretu Pickera, bez jego wartości.
- Wykonuje pełne Node i Chromium bez przekazywania im klucza.
- Instaluje wskazany Android SDK.
- Tylko krok budowania otrzymuje klucz API. Włącza dotychczasowy OAuth i Picker z numerem projektu 481332161595.
- Jawny parametr `bengerUnsignedApk=true` wyłącza podpis release wyłącznie dla tej kompilacji. Normalne buildy bez tego parametru nadal wymagają starego klucza.
- Buduje release bez podpisu, wykonuje lint i Android JUnit, sprawdza applicationId, wersję, versionCode wyższy niż 28496407, natywne flagi i konfigurację Pickera bez wypisywania klucza oraz obecność zasobów offline.
- Oczekuje, że apksigner odrzuci brak podpisu. Nie akceptuje debug APK jako artefaktu.
- Udostępnia wyłącznie APK i bezpieczne metadata.json na 14 dni pod nazwą UNSIGNED. Metadane zawierają signingState:unsigned-do-not-install i oczekiwany certyfikat, a nie twierdzenie, że plik już został podpisany.
- Usuwa pliki robocze i wygenerowany build po zakończeniu.

Repozytorium jest publiczne, używany jest standardowy runner ubuntu-latest. Nie dodajemy hostingu, własnego backendu ani płatnej usługi.

## Podpisanie i sprawdzenie po otrzymaniu ZIP

Codex rozpakowuje wyłącznie oczekiwane APK i metadata.json, sprawdza sumę pliku i commit źródła, następnie używa:

```sh
node scripts/android/sign-imported-apk.mjs \
  /workspace/private/benger-signing-2026-11 \
  /sciezka/do/unsigned.apk /sciezka/do/metadata.json \
  /workspace/releases/benger-recipe-picker-1.0.18
```

Signer odrzuca złą wersję, tożsamość, projekt, deklarowane flagi, certyfikat, obcy/nieznany commit, plik o zmienionym hashu i już podpisany input. Nie wymaga klucza API. Weryfikuje rzeczywisty certyfikat istniejącego keystore, wyrównuje APK zipalign, podpisuje starym kluczem przez plik hasła (bez wartości hasła w argumentach), weryfikuje wynik i tworzy nowe metadane. Nie generuje nowego klucza. Dodatkowe pola wejściowych metadanych nie są kopiowane do wyniku.

Wymagany certyfikat SHA-256: `56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2`.
ApplicationId: `io.github.kubanik21crypto.benger`. VersionName: **1.0.18**, versionCode musi być większy od **28496407** z zachowanego APK 1.0.17. Dopiero zweryfikowany, podpisany plik jest udostępniany do instalacji.

## Odbiór na telefonie

Backup → instalacja podpisanego APK jako aktualizacji bez odinstalowania → kontrola historii/ustawień → istniejące konto Google i automatyczny eksport RAW DATA → ręczny wybór źródła i podgląd importu przepisów. Nie zmieniamy powiązania RAW DATA. Autoimport przepisów pozostaje domyślnie wyłączony. Testy CI nie zastępują testu Google Picker i aktualizacji na telefonie.

## Stan i testy

Ta instrukcja zastępuje poprzedni plan wymagający od Codexa dostępu do API GitHuba i dodania podpisu do sekretów Actions. Ustawienia zablokowanego konfiguratora można zostawić bez dalszych prób. Nie obchodzimy polityki sieci: uruchomienie wykorzystuje dozwolony Git push, a pobranie artefaktu wykonuje właściciel w swoim interfejsie GitHuba.

Na tym etapie nie ma jeszcze gotowego podpisanego APK 1.0.18 z rzeczywistym kluczem Pickera. Lokalny test mechanizmu unsigned bez klucza nie jest wydaniem do instalacji. Wyniki przygotowania są poniżej.

Weryfikacja wariantu rozdzielonego: pełne Node **1826/1826**, Android **39/39**, assembleRelease unsigned i lintRelease — BUILD SUCCESSFUL. Na rzeczywistym lokalnym pliku testowym potwierdzono applicationId/wersję, brak podpisu (apksigner status 1) i poprawne wyrównanie ZIP. Test kompilacji odbył się bez klucza Pickera, z jego konfiguracją wyłączoną; plik testowy usunięto i nie jest udostępniany do instalacji. Testy sprawdzają też odrzucanie wadliwych metadanych/hashy przed odczytem keystore i brak prywatnych danych w metadanych wynikowych. Właściwa kompilacja Actions z sekretem użytkownika i późniejsze podpisanie artefaktu pozostają następnymi krokami.
