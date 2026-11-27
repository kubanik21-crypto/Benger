# Dostęp Androida do istniejącego arkusza przepisów

**Dla obecnego wydania 1.0.18 bez terminala używamy wariantu [Actions bez podpisu → podpis lokalny](recipe-picker-actions-build.md). GitHub potrzebuje tylko już dodanego sekretu Pickera; nie trzeba dalej zmieniać sieci Codexa ani przesyłać podpisu do GitHuba.** Poniższe polecenia terminalowe pozostają alternatywą dla lokalnej kompilacji.

## Stan i architektura

Dotychczasowy OAuth Androida i zakres `https://www.googleapis.com/auth/drive.file` pozostają bez zmian. Samo ID arkusza nie udziela dostępu. Nowy czytnik źródła wykonuje wyłącznie GET, niezależnie od istniejącego eksportera Benger – RAW DATA. Nie tworzy arkusza i nie zmienia jego udostępniania.

Dla istniejącego pliku przewidziano oficjalny **Google Picker JavaScript SDK**, uruchamiany w osobnym WebView kontrolowanym przez kod natywny. Nie używamy wycofanego Android Drive API ani logowania OAuth w WebView: zgodę i token nadal obsługuje dotychczasowy natywny AuthorizationClient. Picker służy wyłącznie wskazaniu pliku i udzieleniu dostępu drive.file. Po wskazaniu czytnik potwierdza uprawnienie rzeczywistym GET metadanych Drive i wymaga dokładnego ID źródła oraz MIME arkusza Google.

Picker nie jest jeszcze zweryfikowany na telefonie. Integracja w buildzie domyślnym jest wyłączona do konfiguracji. Testy mocków nie potwierdzają zachowania SDK, ograniczeń klucza, origin ani cookies na konkretnym Android WebView.

## Konfiguracja Google Cloud krok po kroku

W tym samym projekcie Google Cloud, w którym jest działający klient OAuth Bengera:

1. API i usługi → Biblioteka: zachowaj aktywne Google Drive API i Google Sheets API, włącz **Google Picker API**. Nie włączaj płatnego planu ani triala na potrzeby tej funkcji.
2. Zachowaj obecnego klienta OAuth typu Android, applicationId `io.github.kubanik21crypto.benger`, dotychczasowy certyfikat podpisujący i użytkownika testowego. Nie generuj nowego klucza podpisującego ani sekretu OAuth. Nie dodawaj scopes drive/spreadsheets do całego konta.
3. API i usługi → Dane logowania → Utwórz dane logowania → Klucz interfejsu API. Utwórz osobny **klucz przeglądarkowy dla Pickera**, nie klucz OAuth ani konto usługi.
4. Ograniczenia aplikacji: Witryny / HTTP referrers. Dodaj `https://appassets.androidplatform.net/*`. To lokalny HTTPS origin Android WebViewAssetLoader, bez serwera i hostingu.
5. Ograniczenia API: wybierz Google Picker API i Google Drive API używane przez Picker. Nie pozostawiaj klucza bez ograniczeń. Jeśli konsola/API nie pozwoli na odpowiednią konfigurację, przerwij i zweryfikuj ją przed testem — nie rozszerzaj dostępu ani restrykcji automatycznie.
6. Zapisz **numer projektu** (cyfry), nie tekstowy Project ID ani OAuth Client ID. Google Picker wymaga App ID zgodnego z projektem OAuth.
7. Osoba budująca testową aplikację ustawia bezpiecznie zmienne środowiskowe:

```text
BENGER_GOOGLE_AUTH_ENABLED=true
BENGER_RECIPE_PICKER_ENABLED=true
BENGER_PICKER_API_KEY=<ograniczony klucz przeglądarkowy>
BENGER_PICKER_APP_ID=<numer tego samego projektu>
```

W repozytorium nie wpisuj prawdziwego klucza ani tokenu. Klucz przeglądarkowy z założenia znajdzie się w APK, nie jest sekretem serwerowym; jego ochroną są restrykcje API i origin. Nie przekazuj go czatowi Dieta ani do arkusza. Brak/nieprawidłowa konfiguracja kończy się komunikatem, nie obejściem ograniczeń.

Nie trzeba tworzyć backendu, nowego arkusza, publicznego udostępnienia ani klienta OAuth web z sekretem. Trzeba przeprowadzić próbę na urządzeniu: zgodność projektu/OAuth/klucza i akceptacja lokalnego origin przez Picker to nadal kryteria odbioru.

## Obsługa na telefonie po przygotowaniu zaakceptowanego APK

1. Zachowaj backup. Zaktualizuj zgodnie podpisanym APK, bez odinstalowania. Ten etap nie publikuje APK.
2. Połącz właściwe konto Google dotychczasową funkcją Bengera.
3. Ustawienia → Synchronizacja danych → Import przepisów → **Wybierz arkusz w Google Picker**. Wskaż istniejący arkusz żywieniowy. Inny plik, w tym RAW DATA, jest odrzucany.
4. Jeżeli plik ma już rzeczywiste uprawnienie drive.file, można użyć **Sprawdź już przyznany dostęp**. To weryfikacja API, nie nadanie uprawnień z samego ID.
5. Po przygotowaniu zakładki BENGER_IMPORT wybierz **Sprawdź nowe przepisy**, potem podgląd paczki. Automatyczny import pozostaw wyłączony podczas pierwszych prób.
6. Dopiero po pomyślnej weryfikacji włącz automatyczne dodawanie nowych kompletnych przepisów. Aktualizacje nadal wymagają potwierdzenia.

## Granice bezpieczeństwa i ograniczenia

Token nie przechodzi przez most Capacitor ani główny JavaScript aplikacji, localStorage, backup, logi czy arkusz. **Wyjątek niezbędny dla oficjalnego JavaScript Pickera:** krótkotrwały token jest przekazany natywnie do SDK w izolowanym WebView i pozostaje tam w pamięci podczas wyboru pliku. To należy odróżnić od całkowitego braku tokenu w jakimkolwiek JavaScript. Po zamknięciu WebView jest niszczony.

Osobny WebView nie ma mostu Capacitor/addJavascriptInterface, DOM storage, dostępu plikowego ani nawigacji głównej do dowolnego hosta. Wiadomości akceptowane są tylko z głównej ramki lokalnego origin z nonce; zawierają wyłącznie wynik wyboru. Zasoby zewnętrzne ograniczono do HTTPS hostów Google, konsolę wyciszono, cookies third-party są wyłączone. Jeśli restrykcje uniemożliwią działanie SDK na urządzeniu, trzeba najpierw zbadać problem; nie osłabiamy ich w ciemno.

drive.file pozwala technicznie edytować wybrany plik, ale aplikacyjny czytnik przepisu udostępnia tylko GET. Nie jest to osobny scope OAuth read-only (Google nie oferuje drive.file.readonly). Źródło jest na stałe wskazane w kodzie.

Powiązanie per konto zapisane jest w osobnych prywatnych preferencjach Androida. Nie zawiera tokenu. Dotychczasowy token OAuth jest sesyjny: po restarcie procesu/wygaśnięciu może być potrzebne ponowne połączenie. Brak internetu/uprawnienia nie blokuje lokalnej biblioteki ani backupu. Nie ma WorkManagera, synchronizacji w tle zamkniętej aplikacji ani nowej płatnej usługi.

## Bezpieczne przygotowanie testowego APK 1.0.18

Punktem wyjścia jest etap 4B, commit 759df23, na feature/local-sync-export. Wersję aplikacji zwiększono do 1.0.18. versionCode nadal nadaje istniejący build-apk.mjs według czasu budowania; musi przekroczyć 28496407 z zachowanego APK 1.0.17. applicationId, origin, baza, mechanizm podpisu, OAuth i ustawienia synchronizacji pozostają bez zmian.

### Najpierw zgodność projektów

Klient Android OAuth, Picker App ID i API key muszą pochodzić z tego samego projektu. Prefiks Client ID wskazuje numer projektu. Użytkownik potwierdził właściwy projekt: **Benger Personal**, Project ID `benger-personal`, Project number **481332161595**, istniejący klient `Benger Android` z tym samym prefiksem. Wcześniej zgłoszony projekt Benger – Dieta Integration jest niewłaściwy; nie używamy jego konfiguracji ani klucza. Nie usuwaj klienta i nie zmieniaj dotychczasowej autoryzacji.

W projekcie **Benger Personal** włącz Picker API i utwórz ograniczony klucz, używając numeru 481332161595 jako BENGER_PICKER_APP_ID. Sam klucz z innego projektu nie zapewni zgodnego dostępu drive.file. Nie próbujemy migrować klienta ani powiązania RAW DATA w ramach wydania APK.

Skrypt budowania przy włączonym Pickerze wymaga dodatkowego, niepoufnego potwierdzenia `BENGER_GOOGLE_OAUTH_PROJECT_NUMBER`. Musi ono być równe BENGER_PICKER_APP_ID. To zabezpieczenie przed pomyłką konfiguracyjną, nie zdalne sprawdzenie projektu Google; numer musi potwierdzić właściciel w konsoli.

### Klucz przez prywatny plik — Bash na komputerze budującym APK

Te polecenia wykonuje się w terminalu **tego samego środowiska, w którym powstaje APK**. Ustawienie ich na innym komputerze nie przekazuje klucza do środowiska Cloud. Nie wklejaj klucza do czatu, komendy, pliku w repozytorium ani zrzutu ekranu.

```bash
set +x
umask 077
mkdir -p /workspace/private/benger-recipe-picker
chmod 700 /workspace/private/benger-recipe-picker
IFS= read -r -s -p 'Klucz Benger Recipe Picker (ukryty): ' BENGER_PICKER_KEY_INPUT
printf '\n'
printf '%s' "$BENGER_PICKER_KEY_INPUT" > /workspace/private/benger-recipe-picker/api-key.txt
unset BENGER_PICKER_KEY_INPUT
chmod 600 /workspace/private/benger-recipe-picker/api-key.txt
```

Klucz jest wpisywany do ukrytego promptu; nie jest częścią historii poleceń. Nie uruchamiaj tego w sesji z nagrywaniem wejścia terminala ani nie pokazuj zawartości pliku. Uprawnienia pliku ograniczają innych użytkowników systemu, lecz nie szyfrują dysku.

W bieżącym Cloud przygotowano poza repozytorium prywatny plik `/workspace/private/benger-recipe-picker/build.env` zawierający flagi oraz potwierdzony numer 481332161595 dla Pickera i OAuth. **Nie ma w nim klucza API.**

Dla potwierdzonego projektu ustaw:

```bash
export BENGER_GOOGLE_AUTH_ENABLED=true
export BENGER_RECIPE_PICKER_ENABLED=true
export BENGER_PICKER_APP_ID=481332161595
export BENGER_GOOGLE_OAUTH_PROJECT_NUMBER=481332161595
export BENGER_PICKER_API_KEY_FILE=/workspace/private/benger-recipe-picker/api-key.txt
unset BENGER_PICKER_API_KEY
```

Alternatywnie skrypt przyjmuje klucz wyłącznie ze zmiennej środowiskowej BENGER_PICKER_API_KEY ustawionej przez ukryty prompt lub bezpieczny magazyn sekretów; nie ustawiaj obu źródeł jednocześnie. Przy pliku wymaga lokalizacji poza repozytorium, rozmiaru do 256 bajtów i uprawnień 600. Klucza nie dodaje do metadata.json ani nie wypisuje. Błędy walidacji nie zawierają jego wartości.

Następnie użyj istniejącego skryptu budującego i **zachowanego** katalogu podpisu:

```bash
node scripts/android/build-apk.mjs \
  /workspace/private/benger-signing-2026-11 \
  /workspace/releases/benger-recipe-picker-1.0.18
```

Skrypt sprawdza certyfikat przed kompilacją, przygotowuje zasoby Androida, uruchamia assembleRelease oraz lintRelease i weryfikuje podpisany APK. Oryginalny klucz nie jest generowany ponownie. Nie używaj `--debug`, `--info`, `--scan`, dumpowania środowiska ani cat BuildConfig do obsługi klucza. API key z konieczności znajdzie się w APK i ignorowanych przez Git wynikach Gradle; nie jest sekretem serwerowym. Nie publikuj tych źródeł wygenerowanych ani diagnostyki z jego wartością. Ograniczenia referrera i API są niezbędne.

Przed udostępnieniem porównaj rzeczywisty applicationId, certyfikat, versionName/versionCode i konfigurację flag w APK z zachowaną wersją 1.0.17. Jeśli którekolwiek sprawdzenie zawiedzie, nie udostępniaj APK jako aktualizacji. Test na telefonie: backup, instalacja jako aktualizacja bez odinstalowania, sprawdzenie historii/ustawień/RAW DATA, wybór źródła Pickerem i ręczny podgląd paczki. Automatycznego importu nie włączaj przed pierwszym udanym testem. Nie zmieniaj istniejącego ustawienia automatycznego eksportu RAW DATA.
