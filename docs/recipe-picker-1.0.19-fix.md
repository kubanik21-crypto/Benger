# Benger 1.0.19 — poprawka panelu wyboru arkusza

Gałąź feature/local-sync-export. Poprzedni podpisany APK: 1.0.18 / e5ab888 / versionCode 28546933. Bez scalania z main i wdrożenia produkcji.

## Zgłoszenie i ustalenia

Na rzeczywistym telefonie w 1.0.18 otwiera się Picker Google, ale pokazuje „Can't access your Google Account… Try signing into your Google account or allowing cookie access”. To nie potwierdza błędu klucza API ani braku zgody OAuth.

W kodzie 1.0.18 znaleziono dwie blokady zgodne z objawem: setAcceptThirdPartyCookies(view,false) dla samego Pickera oraz filtr odrzucający wszystkie żądania accounts.google.com, w tym sondy cookies. Poprawka usuwa te konkretne blokady; nie jest jeszcze potwierdzeniem działania Google na fizycznym telefonie.

## Zmiany i granice

- Cookies firm trzecich są dozwolone tylko w WebView Pickera, bez zmiany globalnego CookieManager.setAcceptCookie i głównego WebView Bengera.
- Nowa RecipePickerWebPolicy dopuszcza z accounts.google.com tylko /CheckCookie i /RotateCookiesPage przez GET oraz /ListAccounts przez GET/POST. OAuth i formularze logowania, m.in. /o/oauth2/*, /ServiceLogin i /signin/*, nie są dozwolone. Logowanie nadal obsługuje natywny AuthorizationClient.
- CSP strony uwzględnia accounts.google.com do tych zasobów; faktyczny dostęp nadal zawęża natywny filtr ścieżek.
- DOM storage pozostaje wyłączone. Most Capacitor, dostęp plikowy, mieszana zawartość i dowolna nawigacja głównej ramki nadal są wyłączone; odbiór wyniku nadal wymaga main-frame, właściwego origin i nonce.
- Nie zmieniono scopes drive.file, klienta OAuth, projektu 481332161595, applicationId, certyfikatu, zapisu danych, historii, backupu ani eksportu RAW DATA. Nie odczytuje się klucza API z poprzedniego APK.
- Wersja 1.0.19 pozwala odróżnić poprawkę; CI i signer wymagają versionCode > 28546933. Domyślna autoimportu nadal jest false.

## Budowa i odbiór

Przyjęty wcześniej wariant: pojedynczy oznaczony push [picker-test-apk] uruchamia testy i kompilację unsigned z istniejącym sekretem GitHub Actions. Użytkownik pobiera ZIP z Benger-UNSIGNED-1.0.19-SHA i przekazuje do lokalnego podpisania. Nie potrzeba zmiany sieci Codexa ani dodawania podpisu do sekretów GitHuba. Po otrzymaniu pliku podpisujemy go zachowanym kluczem i sprawdzamy hash, aapt, apksigner i zipalign względem APK 1.0.18.

Na telefonie: backup → instalacja podpisanej aktualizacji bez odinstalowania → ponowne połączenie konta Google (sesja jest tylko w RAM) → wybór arkusza. Oczekiwany wynik: normalny widok plików zamiast komunikatu o koncie/cookies. Sprawdzić anulowanie, wybór właściwego arkusza, ręczny podgląd paczki, zachowanie historii i istniejący RAW DATA. Autoimport pozostawić wyłączony podczas pierwszej próby.

Jeżeli komunikat wróci, nie rozszerzać scopes ani nie logować się przez osadzony WebView. Wtedy potrzebna jest dalsza diagnostyka zachowania oficjalnego SDK w tym WebView; ta wersja nie obiecuje zastępować testu rzeczywistych cookies/konta mockiem.

## Wyniki przed uruchomieniem CI

- Pełne Node: **1827/1827**.
- Chromium: **12/12** ukierunkowanych testów importu, OAuth, autoeksportu i wydania (symulowana warstwa Androida/Google). Pełny Chromium uruchamia także CI przed artefaktem.
- Android JUnit: **43/43**, w tym 4 nowe testy dozwolonych sond cookies, blokady logowania OAuth oraz fałszywych hostów i zachowania dotychczasowych zasobów.
- assembleRelease unsigned, lintRelease i testDebugUnitTest: **BUILD SUCCESSFUL**. Lokalna kompilacja bez klucza Pickera to tylko kontrola kompilatora; plik testowy usunięto.
- git diff --check: czysty.

Nie wykonano rzeczywistego testu konta/cookies na telefonie ani nie uznano symulowanych testów za jego zastępstwo. Testowy APK z kluczem zostanie zbudowany w Actions i podpisany lokalnie dopiero po otrzymaniu ZIP-a.

## Podpisany artefakt otrzymany z Actions

Użytkownik przekazał ZIP z kompilacji 5fbf9be7d7dc863077a41001855af97728f98d18. Zweryfikowano jego strukturę, deklarowany commit, wersję, SHA-256 i brak podpisu. APK podpisano offline istniejącym kluczem; klucz API nie był odczytywany ani wypisywany.

- APK: **Benger-1.0.19-5fbf9be.apk**, **9615142** bajty.
- versionCode: **28551134**, wyższy od **28546933** z 1.0.18.
- applicationId: **io.github.kubanik21crypto.benger**.
- Certyfikat SHA-256: **56ab7cec22d03e1a368ec28aa4d01c67e15973675f0fdf28bb8f4d4ba1f3ecf2**, zgodny z rzeczywistym poprzednim podpisanym APK.
- SHA-256 podpisanego APK: **9d3b973a276d9281269446e118d708928cc474a1e92c4219c67762d49d2a72cf**.
- Potwierdzono integralność, poprawność podpisu i wyrównania ZIP, niezmienioną konfigurację origin Capacitor i zachowanie bajtów wszystkich plików wejściowego APK po podpisaniu.
- Dostawa poza Git: /workspace/releases/benger-recipe-picker-1.0.19/ — APK, metadata.json, INSTRUKCJA.txt i Benger-1.0.19-SIGNED-5fbf9be.zip. ZIP został odczytany ponownie i sprawdzony.

Nie przebudowywano artefaktu, nie zmieniano magazynów użytkownika, main ani produkcji. Test instalacji i zachowania Google Picker na fizycznym telefonie pozostaje wymagany; zgodności podpisu nie przedstawiamy jako potwierdzenia działania konta/cookies w Google.
