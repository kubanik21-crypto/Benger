# Etap 3B — opcjonalna autoryzacja Google na Androidzie

Dalszy etap: [ręczna synchronizacja Google Sheets (3C)](google-sheets-android.md).
Poniższy opis dokumentuje pierwotny zakres etapu 3B.

## Stan i zakres

Kod przygotowany na feature/local-sync-export, po ae8a893. Nie ma OAuth PWA,
back-endu, tworzenia arkusza, odczytu/zapisu danych Drive/Sheets, automatycznej
synchronizacji ani nowego formatu backupu. Nie opublikowano nowego APK.
Google Cloud pozostaje do ręcznej konfiguracji właściciela. Domyślny build ma
**BENGER_GOOGLE_AUTH_ENABLED=false**, przycisk połączenia jest zablokowany.

## Audyt Androida i wybór mechanizmu

- Capacitor core/android 8.6.0, Local Notifications 8.3.1; Java 21.
- AGP 8.13.0; minSdk 24; compile/target SDK 36; WebView minimum 110.
- Stałe applicationId/namespace: `io.github.kubanik21crypto.benger`.
- Stały origin `https://localhost`, bez server.url; BengerDB i benger.nutrition.v1.
- Dotychczasowy release signing: alias benger, istniejący prywatny keystore,
  fingerprint w android/signing-certificate.sha256. Żadnego nowego klucza.
- versionName z package.json (1.0.16); istniejący build-apk.mjs nadaje rosnący
  versionCode według czasu. Nie zmieniono tego mechanizmu.

Używamy Google Identity Services **AuthorizationClient**, artefakt
`com.google.android.gms:play-services-auth:22.0.0`, przypięty bez `+`.
22.0.0 potwierdzono w oficjalnym Google Maven (metadata release 2026-08-25).
Sygnatury użytych metod sprawdzono także w rzeczywistym AAR i przez kompilację.
Oficjalna strona developers.google.com jest blokowana przez politykę sieci tego
środowiska; nie potwierdzono online aktualnego wyglądu konsoli i reguł weryfikacji.

To autoryzacja dostępu do API, nie logowanie do konta Bengera. Nie używamy starego
GoogleSignIn.getClient, własnego formularza hasła, WebView OAuth, refresh tokenów,
serverAuthCode, requestOfflineAccess ani client_secret. Credential Manager jest
narzędziem uwierzytelniania; ten etap nie potrzebuje dodatkowego logowania tożsamości.

Jedyny żądany zakres:

```
https://www.googleapis.com/auth/drive.file
```

SDK ma setOptOutIncludingGrantedScopes(true), a wynik musi zawierać dokładnie
wymagany zakres. Szerszy lub niepełny wynik nie aktywuje sesji. Nie dodano openid,
email, profile ani szerokiego drive/spreadsheets. Email widoczny w interfejsie to
nazwa konta wybranego przez systemowy AccountManager picker, nie wynik People API.
Żądanie autoryzacji jest przypięte do tego konta przez setAccount. Jeśli SDK poda
inne konto w wyniku, sesja jest odrzucana. toGoogleSignInAccount służy tylko jako
opcjonalny hint spójności wyniku, nie jest starszym mechanizmem logowania.

Nie dodano GET_ACCOUNTS. Jedyna nowa normalna permission to ACCESS_NETWORK_STATE
(bez runtime promptu). Zestaw scalonych permissions sprawdzono po kompilacji.
Google Play services SDK podlega warunkom Google/Android SDK wskazanym w jego POM;
nie opisujemy tej zależności jako MIT. Link do warunków jest w panelu Androida.

## Przepływ i granica bezpieczeństwa

1. Samo otwarcie ustawień wywołuje tylko lokalny getStatus, bez authorize i promptów.
2. Po jawnej akcji użytkownika sprawdzamy flagę konfiguracji, sieć i Play services.
3. Systemowy picker pozwala wskazać konto Google. Aplikacja nie poznaje hasła.
4. AuthorizationClient.authorize zwraca zgodę albo PendingIntent do panelu Google.
5. Token pozostaje w prywatnym polu pamięci Java GoogleAuthSession.
6. Bridge BengerGoogleAuth udostępnia wyłącznie getStatus, connect i disconnect.
   Nie ma getToken ani metody zapisującej dane do Google.
7. JavaScript otrzymuje whitelistę: status/configured/connected/account,
   revocationPending/sessionExpiresAt/scope. Nie otrzymuje AuthorizationResult,
   Bundle, access tokena, refresh tokena czy auth code. Adapter JS ponownie ogranicza DTO.
8. Nie zapisujemy połączenia ani tokenów w localStorage, IndexedDB, prefs, backupie,
   plikach lub logach. Wyjątki SDK nie są przekazywane do JS/logów jako tekst.

Google Play services zarządza własnym cache uprawnień/konta poza magazynem Bengera.
Nie obiecujemy, że Google/Android nigdy nie przechowują swoich poświadczeń.
Połączenie wymaga komunikacji autoryzacyjnej z Google; nie wysyła żywienia,
treningów, zdjęć, pomiarów i snapshotów. Nie ma połączenia między autoryzacją a
wykonaniem przygotowanego planu Sheets. Profile lokalnej symulacji z 3A nie są
profilami kont Google i nie mogą być użyte do rzeczywistego wysyłania danych.

## Odmowy, koniec sesji i odłączenie

- Anulowanie pickera/panelu i brak zgody nie aktywują konta. Google nie zawsze
  pozwala odróżnić odmowę od przycisku Wstecz; komunikat obejmuje oba przypadki.
- Zmiana konta zaczyna nową sesję, usuwa stary lokalny token. Anulowanie zmiany
  nie przywraca cicho starego konta. Nie cofa automatycznie starej zgody Google.
- Sesja ma limit lokalny maksymalnie 45 minut (monotoniczny elapsedRealtime),
  skrócony przez expires_in, jeśli SDK zwróci taką wartość. To konserwatywny limit
  Bengera, nie obietnica rzeczywistego czasu ważności tokena Google.
- Status i wznowienie aplikacji nie odświeżają tokena automatycznie. Ponowne
  połączenie wymaga akcji użytkownika. SDK może wykorzystać wcześniejszą zgodę.
- Po zniszczeniu procesu token i konto znikają z pamięci. Lokalne dane Bengera
  pozostają. Nowy proces wymaga ponownego połączenia.
- Offline nie otwieramy autoryzacji. Lokalny eksport i wszystkie moduły działają.
- Rozłączenie najpierw usuwa lokalny token, następnie próbuje revokeAccess.
  Cofnięcie zgody to operacja autoryzacyjna, nie zapis danych Drive/Sheets.
- Jeśli brak sieci lub revoke zawiedzie, stan to revoke-pending i można ponowić
  odłączenie online. W tym stanie nowe połączenie jest blokowane.
- Oczekujące cofnięcie jest tylko w RAM. Jeśli proces zniknie przed jego wykonaniem,
  użytkownik powinien usunąć dostęp Benger na https://myaccount.google.com/connections.
  Nie pokazujemy niepotwierdzonego cofnięcia jako sukcesu.
- Nie ma serwerowej kontroli zgody na bieżąco. Zewnętrzne cofnięcie w Google lub
  wcześniejsze wygaśnięcie tokena nie musi od razu zmienić lokalnego statusu SDK.
  Rzeczywiste 401/403 będą obsługiwane dopiero przy dodaniu natywnego transportu API.
- Procesy równoległe i spóźnione callbacki nie powinny przywracać starego tokena:
  generacja sesji, blokada równoległych akcji i stan outstanding ActivityResult.
- Bridge nie przyjmuje kont/scopes/tokenów od JS; te wartości ustala strona natywna.

PWA nie otrzymuje panelu, promptów, timera statusu ani web OAuth. Wspólne pliki
statyczne adaptera mogą być w app shell, ale nie uruchamiają autoryzacji w PWA.

## Google Cloud — instrukcja właściciela

### 1. Projekt

Otwórz https://console.cloud.google.com/ i zaloguj się na własne konto Google.
Wybierz projekt używany dla Bengera albo utwórz projekt **Benger Personal**.
Zanotuj nazwę/ID projektu. Nie włączaj płatnego planu ani rozliczeń dla tego etapu.
Jeżeli konsola wymaga płatności, przerwij i pokaż komunikat bez danych poufnych.

### 2. API

W **APIs & Services → Library** (API i usługi → Biblioteka) włącz:

- Google Drive API,
- Google Sheets API (potrzebne w kolejnym etapie; teraz nie będzie wywoływane).

Nie dodawaj Firebase, People API ani klucza konta usługowego.

### 3. Google Auth Platform / ekran zgody

W **Google Auth Platform** (starszy widok: OAuth consent screen):

- Branding/Marka: nazwa **Benger**, Twój adres wsparcia i kontakt dewelopera.
- Audience/Odbiorcy: dla zwykłego prywatnego Gmaila wybierz **External/Zewnętrzni**.
  Nie wybieraj Internal, jeśli nie masz odpowiedniej organizacji Workspace.
- Na początek pozostaw **Testing/Testowanie**. Nie publikuj aplikacji OAuth publicznie.
- Dodaj swój adres Google jako test user/użytkownika testowego.
- Data Access/Dostęp do danych: dodaj wyłącznie drive.file z pełnym adresem powyżej.
  Nie wybieraj zakresów „wszystkie pliki Drive” ani szerokiego spreadsheets.
- Jeżeli konsola wymaga dodatkowych informacji/polityki prywatności, uzupełnij je
  zgodnie z prawdą: lokalna aplikacja, opcjonalna zgoda Google, w tej fazie bez
  wysyłania danych Bengera. Nie zaznaczaj nieistniejących zabezpieczeń/weryfikacji.

Nie zakładamy konkretnych limitów lub długości grantów trybu testowego — mogą
zależeć od aktualnych zasad i typu projektu. Testowanie może wymagać ponownej zgody.

### 4. Klient OAuth Android

W **Clients/Klienci → Create client/Utwórz klienta OAuth** (lub API i usługi →
Credentials/Dane logowania → Create credentials → OAuth client ID):

- Typ: **Android**.
- Nazwa: **Benger Android — podpis release**.
- Package name / nazwa pakietu:

```
io.github.kubanik21crypto.benger
```

- SHA-1 certyfikatu podpisującego:

```
DD:61:EF:A6:76:D9:4F:DF:14:B2:34:E7:F3:DD:32:D0:C9:AC:93:17
```

To publiczny odcisk istniejącego klucza i poprzedniego APK 1.0.16 build cc4b90b,
a nie sekret. Nie używaj losowego debug SHA-1. Nie zmieniaj package ani podpisu.
Jeśli para jest już zajęta, znajdź istniejący projekt/klienta; nie generuj nowego klucza.
Zapisz klienta i poczekaj na propagację zmian po stronie Google.

Nie potrzebujemy klienta Web, redirect URI, client_secret, API key ani
`google-services.json`. Ten przepływ jest identyfikowany przez Android package i
certyfikat. Web/server client ID jest potrzebny w innych przepływach, np. wymianie
serverAuthCode — tutaj ich nie używamy.

### 5. Co przekazać dalej

Napisz, że klient Android został utworzony i Twój adres jest użytkownikiem testowym.
Możesz podać nazwę/ID projektu lub publiczny identyfikator klienta do kontroli,
ale **nie przesyłaj hasła Google, tokena, klucza P12 ani sekretu klienta**.
Nie musisz teraz ręcznie tworzyć ani udostępniać arkusza.

### 6. Dopiero po konfiguracji: osobny test urządzenia

W kolejnym uzgodnionym kroku przygotujemy zgodnie podpisany APK z flagą:
`BENGER_GOOGLE_AUTH_ENABLED=true` lub Gradle `-PbengerGoogleAuthEnabled=true`.
Istniejący build-apk.mjs dziedziczy tę niesekretną zmienną. W tym etapie APK nie
został opublikowany ani przekazany do instalacji.

Sprawdzić na Samsungu: połączenie konta testowego, zgodę drive.file, anulowanie,
odmowę, zmianę konta, tryb samolotowy, lokalne wygaśnięcie, rozłączenie online,
rozłączenie offline i cofnięcie dostępu przez Google. Zmiana konta nie może wysłać
ani przenieść danych. Liczba plików arkusza i dane Google mają pozostać bez zmian.

## Zgodność aktualizacji APK

Porównano istniejący prywatny certyfikat, publiczny fingerprint repo i rzeczywisty
poprzedni podpisany APK cc4b90b. Zgodne SHA-256 certyfikatu:
`56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2`.
ApplicationId, origin i produkcyjne klucze danych nie są zmieniane.
Poprzedni versionCode: 28409509; istniejący algorytm nada przyszłemu buildowi większy.
Nie instalowano niczego na telefonie i nie sprawdzano podpisu nieistniejącego nowego APK.
Warunki zgodności są potwierdzone konfiguracją/kluczem; finalny artefakt trzeba
ponownie zweryfikować apksigner przed przyszłym udostępnieniem. Nigdy nie odinstalowywać
aplikacji ani nie czyścić jej danych w celu obejścia konfliktu podpisu.

## Weryfikacja i ograniczenia

- Node: testy adaptera, whitelisty DTO, brak wycieku syntetycznych tokenów/wyjątków,
  PWA bez autoryzacji, obsługiwane stany i granica trzech metod bridge.
- Chromium: **symulowany** native bridge, panel, konto, konfiguracja, anulowanie,
  odmowa, wygaśnięcie, offline, pending revoke, double-tap i lokalny eksport.
- JUnit: rzeczywiste wykonanie lokalnego modelu pamięci Java, TTL, zmiana konta,
  odrzucanie starych wyników, odłączenie, niszczenie i usuwanie referencji tokena.
- Android: kompilacja Java i lint przeciwko prawdziwemu SDK Google 22.0.0.
  To nie jest rzeczywista autoryzacja w Google ani test systemowego panelu na Samsungu.
- Brak Google Cloud config blokuje dalszy test end-to-end. Nie próbowano zastępować
  brakującej konfiguracji atrapą klienta OAuth w produkcyjnym kodzie.
