# Benger Android — pierwszy APK

## Zakres

Capacitor 8.6.0 (MIT), własny lokalny plugin Androida. Ta sama aplikacja HTML/CSS/JS i te same kontrakty danych; bez kont, LLM, płatnych API i zdalnego ładowania interfejsu. Produkcyjne WWW pozostaje oddzielnie. APK zawiera własny app shell i katalog USDA, nie rejestruje service workera i nie zależy od działającej strony GitHub Pages. Android System WebView jest komponentem renderującym, nie oknem Chrome. Minimum Android 7/API 24 i WebView 110. Samsung wymaga testu rzeczywistego mikrofonu/aparatu.

Stała tożsamość: `io.github.kubanik21crypto.benger`, origin `https://localhost`, `BengerDB`, `benger.nutrition.v1`. Nie zmieniać tych wartości między aktualizacjami. APK 1.0.5 korzysta z wersji kodu WWW; versionCode rośnie według sekund od początku 2026, a About pokazuje dokładny SHA.

## Dane z WWW/PWA

WebView ma osobny profil danych. Nie da się bezpiecznie odczytać IndexedDB Chrome z innej aplikacji. W działającej wersji WWW: Więcej → Dane i backup → Pełny backup ze zdjęciami. Nie odinstalowywać ani nie czyścić WWW/PWA. W APK wybrać ten plik, sprawdzić podsumowanie, jawnie zatwierdzić import. Schemat pozostaje v7, import v1–v7 działa bez zmian z istniejącym rollbackiem. Zdjęcia, treningi, plany i historia pochodzą z pełnej kopii; lekkie kopie nie obejmują fotografii. Po imporcie porównać dane, dopiero potem porządkować stare skróty.

Eksport APK korzysta z Android Storage Access Framework (systemowy wybór pliku). Dane są przesyłane do natywnego zapisu partiami 256 Ki znaków, bez dzielenia par Unicode. Maksymalnie 64 MiB UTF-8; błąd/cancel nie jest zgłaszany jako sukces. Nie trzeba uprawnień do całego dysku. Automatyczny backup Androida/cloud/device transfer są wyłączone — właściciel odpowiada za ręczne kopie. Odinstalowanie APK usuwa jego dane; kolejny APK instalować jako aktualizację.

## Natywne integracje

- BengerNative: Android SpeechRecognizer, polski język, częściowe wyniki jako zastępowane snapshoty, final raz, ID sesji odrzuca spóźnione eventy. Wspólny istniejący adapter Web Speech, parser i resolver pozostają. Usługa mowy może wymagać sieci lub dodatkowego komponentu Google/Samsunga. Nagrania nie są zapisywane. Uprawnienie mikrofonu wyłącznie po tapnięciu, cancel/background/destroy niszczy recognizer.
- Kamera: istniejący getUserMedia i native BarcodeDetector/ZXing fallback, z uprawnieniem CAMERA obsługiwanym przez Capacitor. Background zamyka scanner i zatrzymuje stream. Brak nagrywania wideo. Natychmiastowe prośby o aparat przy starcie są zabronione.
- OFF: natywny CapacitorHttp (bez globalnego patchowania fetch). Read-only HTTPS tylko do world.openfoodfacts.org i search.openfoodfacts.org, poprawny User-Agent Benger-Android, brak redirectów, timeouty. SAL bez przeglądarkowego CORS; nie podszywamy się pod Origin, nie zmieniamy Workera Cloudflare ani AI. Product API i normalizacja nutrition pozostają wspólne, g/ml bez zgadywania. Istniejące budżety zapytań, cache, recent i favorites nadal obowiązują.
- Systemowy Wstecz respektuje otwarty dialog/cancel, potem historię WebView. Insets chronią UI przed paskami Androida. Backupy nie są wysyłane na serwer.

## Budowanie

Wymagane Node >=22, Java JDK 21, Android SDK platform 36/build-tools 36.0.0 (AGP może również użyć 35.0.0). Zależności przypięte w package-lock, Gradle wrapper z SHA-256.

```
npm ci
npm test
npm run test:browser
npm run android:prepare
```

Konfiguracja Androida nie zawiera `server.url` ani dowolnego allowNavigation. CLI przygotowania może czyścić tylko wygenerowany android-web w repozytorium. Wszystkie wygenerowane pliki, SDK, APK i podpis są ignorowane przez źródłową gałąź Git.

## Podpis — prywatny i stały

Jednorazowo `node scripts/android/init-signing.mjs KATALOG_POZA_REPO`. Nigdy nie zastępować istniejącego klucza. Narzędzie tworzy prywatny benger.p12/password.txt/signing.json. Te pliki nie mogą trafić do publicznego repo ani artefaktu APK. Jedynie publiczny fingerprint certyfikatu jest zapisany w android/signing-certificate.sha256. Build weryfikuje rzeczywisty certyfikat i odrzuca inny podpis.

```
node scripts/android/build-apk.mjs PRYWATNY_KATALOG KATALOG_APK
```

Wymagane ANDROID_HOME i poprawne JAVA_HOME; podpis jest wstrzykiwany do procesu Gradle, nie do JS. Używamy release (nie debug). Apksigner weryfikuje wynik, metadata zawiera SHA kodu, hash APK i publicznego certyfikatu. Nie zawiera sekretów. Kolejna aktualizacja: ten sam packageId, origin i klucz, większy versionCode. Utrata klucza uniemożliwia zgodną aktualizację bez odinstalowania; właściciel musi zachować prywatną kopię.

GitHub Actions: sekret `BENGER_ANDROID_SIGNING_BUNDLE` zawiera base64 JSON z keystore/password/certificateSha256, dodany przez właściciela wyłącznie przez Settings → Secrets → Actions. Dostęp tylko przy zaufanym push na main/feature/android-apk; brak sekretów w PR. Najpierw pełne testy i lint/kompilacja debug, dopiero potem podpisany APK. Artefakt zawiera tylko APK i publiczną metadata; prywatny katalog RUNNER_TEMP jest usuwany zawsze. Bez sekretu CI kompiluje, lecz nie publikuje instalowalnego APK. APK pobieramy jako ZIP artefaktu Actions, rozpakowujemy na telefonie i instalujemy plik .apk. Zwykłe opublikowanie WWW nie aktualizuje zainstalowanego APK.

## Licencje

Istniejące OFF ODbL/DbCL, zdjęcia OFF CC BY-SA, USDA CC0/public domain i ZXing MIT/Apache/ts-custom-error MIT pozostają. Capacitor core/Android: MIT (tekst w android/licenses). AndroidX, Android SDK runtime libraries/Cordova/Kotlin, jeśli bundlowane zależnościami Androida: Apache-2.0; sprawdzić raport Gradle dependencies dla faktycznej wersji. Narzędzia JDK/Gradle/SDK nie są dołączane do aplikacji. Nowa ikona Androida jest własnym wektorem Bengera, bez cudzych grafik.

Runtime permissions: samo okno przyznawania dostępu do mikrofonu/aparatu może pauzować Activity. Pending speech bez utworzonego recognizera nie jest anulowane przez onPause; rzeczywiste nagrywanie jest zatrzymywane. Kamera jest dodatkowo zwalniana przy onStop i document.hidden, dzięki czemu pierwszy prompt uprawnień nie zamyka skanera.

## Pobranie pierwszego APK

Pierwszą podpisaną paczkę można udostępnić jako publiczny, gotowy plik na oddzielnej gałęzi `android-apk-downloads` (tylko `Benger.apk`, publiczna `metadata.json` i README). To dystrybucja artefaktu, nie kod źródłowy ani zmiana gh-pages/main. Przed publikacją sprawdzić apksigner, hash SHA-256, publiczny certyfikat i zgodność SHA źródeł. Nigdy nie kopiować tam podpisu, password.txt, pliku github-secret.txt ani backupów danych. Link do pliku APK powinien zawierać `?build=SHA`, żeby pobranie kolejnej wersji nie korzystało ze starego cache. Docelowa automatyzacja podpisanych buildów jest w GitHub Actions po dodaniu sekretu; bez niego pierwsze APK da się zbudować lokalnie z tą samą prywatną tożsamością.
