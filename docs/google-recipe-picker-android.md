# Google Picker Android — wersja testowa 1.0.22

Budowanie bez terminala: [Actions → podpis lokalny](recipe-picker-actions-build.md).

## Konfiguracja Google Cloud

Używamy wyłącznie **Benger Personal**, Project ID `benger-personal`, numer **481332161595**. Zachowaj działający klient OAuth Android, applicationId `io.github.kubanik21crypto.benger`, certyfikat i użytkownika testowego. Zakres pozostaje `https://www.googleapis.com/auth/drive.file`. Nie twórz klienta OAuth web, redirect URI ani nowego klucza podpisującego.

1. Zachowaj aktywne Sheets API, Drive API i Picker API.
2. API i usługi → Dane logowania → istniejący klucz Benger Recipe Picker.
3. Ograniczenia aplikacji → Witryny → dodaj **`http://*.localhost:48765/*`** i zapisz. Zachowaj pozostałe wpisy. Sam wpis `http://127.0.0.1:48765/*` nie wystarcza: każda sesja ma losową nazwę hosta localhost.
4. Ograniczenia API nadal tylko Google Picker API i Google Drive API. Nie wyłączaj ograniczeń w celu testowania.
5. Wartość klucza pozostaje w istniejącym sekrecie Actions `BENGER_PICKER_API_KEY`; nie wklejaj jej do czatu, repozytorium ani logów. Zmiana ograniczeń nie wymaga zmiany wartości sekretu.

Zmienne kompilacji: `BENGER_GOOGLE_AUTH_ENABLED=true`, `BENGER_RECIPE_PICKER_ENABLED=true`, `BENGER_PICKER_APP_ID=481332161595`, `BENGER_GOOGLE_OAUTH_PROJECT_NUMBER=481332161595`. Klucz przekazuje magazyn sekretów wyłącznie krokowi kompilacji. Jest to ograniczony klucz przeglądarkowy obecny w APK, nie sekret backendu.

## Architektura

Zgodę i token obsługuje natywny AuthorizationClient. Picker otwieramy w rzeczywistej przeglądarce (preferowany Chrome), ponieważ osadzony panel nie zapewnił działającego logowania konta. Nie odblokowujemy OAuth w WebView. Oficjalny JavaScript SDK potrzebuje krótkotrwałego tokenu w pamięci przeglądarki; token nie trafia do głównego JavaScript/mostu Capacitor.

Tymczasowy serwer wiąże tylko 127.0.0.1:48765 i udostępnia lokalny zasób pod losowym hostem `benger-<nonce>.localhost`. Losowy host ogranicza ryzyko wcześniejszego service workera na stałym origin. Dokładny Host, Origin, nonce, metoda i limity żądań są sprawdzane; brak CORS. Konfigurację wydaje jednokrotnie, szyfrowaną ECDH P-256 → SHA-256 → AES-256-GCM z kontekstem origin i nonce. Następnie serwer jest zamykany. Token i klucz nie są jawne w transmisji lokalnej ani URL, logach, localStorage czy backupie Bengera. Nie powstaje publiczny backend ani foreground service.

Po wyborze użytkownik naciska przycisk powrotu. Intent jest przypięty do pakietu Bengera i zawiera wyłącznie nonce oraz wskaźnik pliku. Natywna walidacja wymaga aktualnej sesji (maksymalnie 5 minut czasu elapsedRealtime), właściwego źródła i MIME oraz rzeczywistego GET metadanych Drive. Nieznane pola i niepoprawne wyniki są odrzucane. Zamknięcie procesu usuwa sesję; należy rozpocząć wybór ponownie. Nie zapisujemy tokenu na dysku.

Źródło pozostaje stałe: `1bDRXeGN8oYQS-U7bRgA_9FAPTcAqdvdUAFBwmbv1gzw`. Czytnik wykonuje tylko GET. Zakres drive.file technicznie pozwala edytować wybrane pliki, ale ten czytnik nie udostępnia operacji zapisu. Powiązanie i automatyczny eksport RAW DATA pozostają bez zmian.

## Próba na telefonie

Zachowaj backup i zainstaluj wyłącznie zgodnie podpisany APK jako aktualizację, bez odinstalowania. Połącz konto natywną funkcją Bengera. W imporcie przepisów wybierz „Wybierz arkusz w przeglądarce”. Zaloguj się w przeglądarce do właściwego konta, wybierz arkusz i użyj przycisku powrotu. Sprawdź dostęp oraz podgląd paczki BENGER_IMPORT. Nie włączaj automatycznego importu przed udaną próbą.

Testy z syntetycznym SDK nie dowodzą działania rzeczywistego Google Picker, restrykcji klucza ani powrotu na danym telefonie. Wymagany jest test fizycznego urządzenia. Prywatny tryb przeglądarki, brak internetu, brak obsługi localhost lub przekroczenie czasu mogą zakończyć próbę błędem; lokalne dane nadal działają offline. PWA pozostaje bez integracji Pickera.
