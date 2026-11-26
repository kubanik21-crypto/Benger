# Dostęp Androida do istniejącego arkusza przepisów

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
