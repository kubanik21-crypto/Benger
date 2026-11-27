# Poprawka testowa 1.0.20 — wybór arkusza w przeglądarce

Problem: Google Picker w osadzonym WebView wyświetlał Sign in, którego celowo nie dopuszczał filtr bezpieczeństwa. Rozwiązanie przenosi interfejs do systemowej przeglądarki bez obchodzenia zasad logowania Google.

Dodano BrowserPickerSession, BrowserPickerReturn i PickerHandoffCrypto oraz testy prawdziwych lokalnych socketów, kryptografii i Chromium/WebCrypto z syntetycznym SDK. Usunięto osadzony WebView Pickera i jego starą politykę. MainActivity obsługuje ograniczony powrót intent; czytnik nadal weryfikuje plik przez Drive GET. UI opisuje przejście do przeglądarki.

Node: 1827/1827. Ukierunkowany Chromium: 15/15. assembleRelease unsigned, lintRelease i Android JUnit: BUILD SUCCESSFUL. Pełny Chromium wykonywany w Actions przed artefaktem. Lokalny APK bez konfiguracji klucza nie jest wydaniem do instalacji. Nie przeprowadzono jeszcze rzeczywistego logowania Google ani aktualizacji tej wersji na telefonie.

Wersja 1.0.20 wymaga versionCode powyżej 28551134; signer sprawdza dotychczasową tożsamość i certyfikat. Nie zmieniono danych, backupu, klienta OAuth, RAW DATA ani main; nie wdrożono produkcji. Po pobraniu unsigned artefaktu wymagane jest podpisanie zachowanym kluczem i porównanie z poprzednim APK.

Instrukcja konfiguracji i ograniczenia: [Google Picker Android](google-recipe-picker-android.md). Wymagany wzorzec witryn istniejącego klucza: `http://*.localhost:48765/*`. Bez rzeczywistego testu nie deklarujemy rozwiązania problemu na urządzeniu.
