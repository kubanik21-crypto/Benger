# Testowa poprawka 1.0.21 — odczyt payload_json

Przyczyna: RecipeSourceProtocol.payload używał GoogleSheetsWire.value z limitem 5000 znaków właściwym dla RAW DATA, zamiast limitu fragmentu importera 20000 jednostek UTF-16. Wprowadzono osobną ścisłą walidację tekstowego payload_json (1–20000). Formuły, bool, liczby, puste i wielopolowe wartości są odrzucane. GoogleSheetsWire i jego limit nie zostały zmienione.

Audyt zgodności: metadane źródła mają własny walidator string/finite number, zgodny z JS (bez wartości logicznych i sztucznego limitu RAW DATA). Odczyt nadal ogranicza odpowiedź do 8 MiB. Poprawiono granicę indeksu wiersza: maksymalnie 3000 wierszy wraz z nagłówkiem. JS nadal weryfikuje pełny schemat manifestu, daty, namespace, liczbę przepisów i fragmentów, kompletność, SHA-256 oraz limity 2 MiB/pakiet, 4 MiB/źródło, 256 fragmentów i 20 pakietów. Native nadal pobiera tylko fragmenty jednoznacznie READY, z dozwolonych wierszy i kolumny M; metadane odczytuje przed i po pobraniu, zatrzymując zmieniające się źródło. Te warstwy są komplementarne; Android nie zastępuje pełnego walidatora importera.

Diagnostyka: stałe kody source-metadata-value / source-metadata-invalid / source-payload-type / source-payload-length / source-payload-invalid mapowane na polskie komunikaty etapu i przyczyny. Bez treści komórek, identyfikatorów pakietów w błędach natywnych, tokenów ani surowych wyjątków. Brak zmiany transportu OAuth, uprawnień, arkusza i zapisu RAW DATA.

Wspólna syntetyczna paczka fixtures/recipe-source-12.json zawiera 12 przepisów, ma 18095 znaków i służy natywnemu testowi odczytu oraz testowi JS z rzeczywistą walidacją SHA-256. Nie jest kopią prywatnego jadłospisu. Testy granic: 5000, 5001, 18095, 20000 i odrzucenie 20001; RAW DATA nadal odrzuca tekst powyżej 5000. Dodatkowo testy typów, diagnostyki, granicy wierszy i zmienionego SHA.

APK wymaga wersji 1.0.21, versionCode > 28557699, tego samego applicationId i zachowanego certyfikatu. Build z kluczem Pickera odbywa się w dotychczasowym Actions, artefakt unsigned jest następnie podpisywany lokalnie. Lokalny smoke build bez klucza nie jest plikiem do instalacji. Faktyczny odczyt prywatnego arkusza oraz aktualizacja na telefonie wymagają testu użytkownika. Nie scalono z main i nie wdrożono produkcji.

Weryfikacja lokalna: Node 1831/1831; ukierunkowane Chromium 10/10; Android JUnit 60/60; assembleRelease unsigned i lintRelease — BUILD SUCCESSFUL; git diff --check czysty. Pełny Chromium jest wymagany w Actions przed udostępnieniem artefaktu.
