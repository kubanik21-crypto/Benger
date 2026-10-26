# Benger — Etap 6: PWA, offline, katalog USDA i skaner

Benger is a voice-first nutrition diary. Manual entry is a fallback, not the primary product experience.

Lokalny dziennik w HTML/CSS/JavaScript: głos lub tekst → intencje produktów → ProductResolver → edytowalna propozycja → jawne zatwierdzenie → dziennik. Web Speech API, Open Food Facts i lokalny cache, bez płatnych API, kont i AI; lokalny przypięty fallback ZXing.

## Uruchomienie

Wymaga Node.js 22 lub nowszego. Nie trzeba uruchamiać `npm install`.

```sh
npm start
```

Uruchamiaj z katalogu projektu. Domyślny port to 3000; zmienna `PORT` pozwala go zmienić. Dotychczasowa wersja jest dostępna na GitHub Pages; zmiany tej gałęzi wymagają osobnego wdrożenia po przeglądzie. Na telefonie używaj bezpiecznego połączenia HTTPS. Manifest, rzeczywiste ikony i service worker umożliwiają instalację PWA oraz start offline po zakończeniu pobierania plików. Rozpoznawanie mowy może nadal wymagać sieci.

Serwer automatycznie udostępnia zwykłe pliki `.html`, `.js`, `.css`, `.webmanifest`, ikony PNG, jawne JSON-y katalogu USDA i licencje skanera z katalogu projektu i podkatalogów. Nowy moduł JavaScript działa bez dopisywania trasy i bez restartu. `/` nadal zwraca `index.html`.

Pliki i katalogi zaczynające się od `.`, `server.js`, `package.json`, pliki `*.test.js`, dowiązania oraz próby wyjścia poza katalog są blokowane. Inne rozszerzenia nie są publiczne. Odpowiedzi wymagają ponownej weryfikacji przez przeglądarkę (`Cache-Control: no-cache`). Po zmianie samego kodu `server.js` nadal trzeba zatrzymać wcześniejszy proces (`Ctrl+C`) i ponownie uruchomić `npm start`.

## Hosting statyczny i przygotowanie PWA

Frontend działa również bez `server.js`. Komplet publicznych plików definiuje `PUBLIC_ASSETS` w `scripts/public-assets.mjs`; zachowaj strukturę podkatalogów. Builder `scripts/prepare-preview.mjs` przygotowuje gotowy artefakt z tej listy, bez serwera, testów i dokumentacji. Względne ścieżki działają zarówno pod `/`, jak i pod `/Benger/`. Przy hostowaniu w katalogu adres powinien kończyć się ukośnikiem.

Lokalny `npm start` nadal serwuje aplikację pod `/`. Hosting pod `/Benger/` jest symulowany w testach jako osobny serwer statyczny; nie dodano takiej trasy do serwera deweloperskiego.

Nie publikuj całego repozytorium: zabezpieczenia lokalnego serwera nie obowiązują na hostingu statycznym. Przygotuj artefakt wyłącznie z plikami publicznymi. GitHub Pages pozostaje prostym hostingiem. Workflow preview aktualizuje wyłącznie podkatalog `previews/etap-6/` istniejącej gałęzi `gh-pages`. Pliki głównej wersji pozostają niezmienione. Podgląd ma oddzielną pamięć danych.

Manifest ma względne `id`, `start_url` i `scope`, ikony PNG 192/512 i offline shell. Instalacja zależy od możliwości przeglądarki i HTTPS. Zmiana domeny, protokołu lub portu tworzy inny origin i nie przenosi danych localStorage; zmiana samej ścieżki na tym samym origin nie oddziela danych.

- [Audyt gotowości webowej](docs/web-readiness-audit.md): wyniki hostingu, responsive layout, PWA, dane i porównanie hostów.
- [Wcześniejszy projekt Web Experience](docs/stage-3-web-experience.md): archiwalny plan przebudowy UI/PWA. Pozostaje planem pełniejszej przebudowy UI/PWA, niezależnym od wdrożonego katalogu i głosu.
- [Architektura danych produktów](docs/product-data-architecture.md): model, OFF, cache, licencje, ograniczenia i przyszli dostawcy.

## Dziennik produktów

1. Wybierz dzień nad formularzem — dotyczy on dodawania, listy i podsumowania.
2. Wyszukaj produkt po nazwie/marce i kliknij „Szukaj” (lub Enter). Możesz też użyć kodu kreskowego, ostatnich, ulubionych lub własnych produktów. Wybierz wynik, a następnie posiłek.
3. Wpisz ilość w jednostce produktu: g albo ml. Działa kropka i polski przecinek, np. `50,5`.
4. Sprawdź kcal, białko, tłuszcz i węglowodany w podglądzie.
5. Dodaj pozycję do dziennika. Ilość zostanie wyczyszczona, a komunikat potwierdzi zapis.
6. Wpisy są podzielone na posiłki. Przycisk „Usuń” usuwa wyłącznie wskazany wpis i aktualizuje sumę dnia.

`nutrition.js` zawiera wyłącznie funkcje obliczeniowe. Produkty pochodzą z USDA, OFF, własnych danych i cache. Katalog demonstracyjny został usunięty. Nie przeliczamy mililitrów na gramy. Obliczenia wykonują wyłącznie `calculatePortion()` i `sumNutrition()`. Dane są zaokrąglane dopiero na ekranie.

## Wyszukiwarka, ostatnie i ulubione

- Minimum 3 znaki, maksymalnie 20 wyników. Nie ma requestów przy wpisywaniu każdego znaku. Wyniki łączą USDA, własne produkty, cache i Open Food Facts, pokazują nazwę, markę, miniaturkę, wartości na 100 g/ml i źródło.
- Pole „Kod kreskowy” obsługuje ręczne EAN-8, UPC-A, EAN-13, GTIN-14 z poprawną cyfrą kontrolną. Nie uruchamia kamery.
- „Ostatnio używane” zawiera 20 unikalnych produktów z udanych zapisów dziennika. Gwiazdka zapisuje ulubione niezależnie od dziennika. Sekcja pokazuje 20 ostatnio oznaczonych; inne zapisane produkty można wyszukać lokalnie.
- Cache IndexedDB `BengerDB` zawiera znormalizowane produkty OFF (7 dni świeżości), wyniki wyszukiwań (15 minut), referencje ostatnich/ulubionych, pamięć jawnych wyborów produktów oraz limiter współdzielony między kartami. Wersja bazy 2 dodaje store `selections`, zachowując istniejące dane. Nie przechowujemy pełnych odpowiedzi API ani zdjęć base64. Ulubienie/użycie nie odnawia wieku danych.
- Bez internetu lub podczas awarii OFF dostępne pozostają dane zapisane lokalnie. Niedostępny IndexedDB uruchamia pamięć tylko na czas działania karty z ostrzeżeniem. Dziennik ma własną pamięć i nie jest kasowany.
- Limity: minimum 6,5 s między wyszukiwaniami, 4,5 s między odczytami kodów. 429 daje co najmniej minutę przerwy. Nie ma automatycznych ponowień. Request ma timeout 10 s; błędy są przedstawiane zwykłym komunikatem.
- Jedynie jawne dane OFF na **100 ml** pozwalają wybrać ml. Dane na 100 g pozostają w g; starsze odpowiedzi bez jednoznacznej podstawy dostają ostrzeżenie. Wielkość opakowania nie służy do zgadywania gęstości. Zawsze porównaj wynik z etykietą.

Bezpośredni frontend → OFF nie potrzebuje klucza ani proxy. Osobny adapter `off-search.js` wykonuje CGI GET ze schematem 3.6 i **samym `Accept: application/json`**, bez custom headerów. Provider barcode nadal używa `/api/v3.6/product/{barcode}` i `X-User-Agent: Benger/0.3 (https://github.com/kubanik21-crypto/Benger)`. Nie nadpisujemy browserowego `User-Agent` ani nie wymyślamy parametru identyfikacyjnego GET. Search ma standardowy UA przeglądarki i Origin/Referer; nie wysyła własnego identyfikatora Benger. Oficjalny przewodnik rekomenduje identyfikację aplikacji: właściciel powinien zgłosić integrację i jej browserowe ograniczenia przez formularz OFF. Szczegóły w [audycie](docs/off-production-audit.md).

**Pomiar produkcyjny z przeglądarki właściciela, 24.10.2026:** dla `mleko 2%` wariant z samym Accept zwrócił HTTP 200, czytelny CORS i 19 poprawnych produktów. Warianty z X-User-Agent i bez Accept zawiodły; bez statusu OPTIONS nie dowodzi to samego błędu preflight. Barcode Nutelli także działał w tej przeglądarce. Search-a-licious nie zwrócił czytelnej odpowiedzi; jego otwarte problemy CORS i indeksu opisano w audycie. Środowisko Codexa nadal blokuje połączenia do OFF/Pages na etapie CONNECT. Testy automatyczne mockują OFF; nie zastępują końcowego testu całego przepływu na HTTPS.

Aplikacja już załadowana działa bez sieci; nie ma jeszcze service workera gwarantującego uruchomienie/odświeżenie offline. Wyszukiwane frazy/kody i żądania miniatur są wysyłane do OFF. Dziennik i notatki nie są wysyłane.

## Źródło danych i licencje

Dane: **[Open Food Facts i współtwórcy](https://world.openfoodfacts.org/)**. Baza: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), zawartość: [DbCL 1.0](https://opendatacommons.org/licenses/dbcl/1-0/). Zdjęcia: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), autorzy na karcie produktu dostępnej przy jego wyborze. Miniaturki są wyświetlane bez zmian ze źródła; nie kopiujemy ich do repozytorium. Zawierają też oznaczenia opakowań podlegające własnym prawom.

Cache OFF, statyczny katalog USDA i własne produkty są oddzielnymi zbiorami. Ich połączenie odbywa się w pamięci na potrzeby wyników. Przyszła redystrybucja/łączenie baz wymaga uwzględnienia ODbL i share-alike. Przykłady w `tests/fixtures` są fikcyjne i służą wyłącznie testom.

## Dodawanie głosem i tekstem

1. Wybierz datę i domyślny posiłek. Posiłek wypowiedziany w opisie ma pierwszeństwo; zegarek nie służy do zgadywania.
2. Naciśnij duży mikrofon, zezwól przeglądarce na jego użycie i powiedz produkty z ilościami. Naciśnij „Zakończ”. Możesz też wpisać tekst bez mikrofonu.
3. Transkrypcja pojawia się na żywo. Analiza zaczyna się dopiero po końcu sesji, wyłącznie z finalnego tekstu. „Anuluj” niczego nie analizuje ani nie zapisuje.
4. Sprawdź propozycję. Popraw tylko brakującą ilość lub niepewny produkt, zamiast powtarzać cały posiłek. Możesz zmienić posiłek w pojedynczym wierszu.
5. „Dodaj cały posiłek” tworzy wszystkie snapshoty jednym zapisem. Brakujące pozycje blokują przycisk; częściowa suma ich nie obejmuje.

Przykłady:

```text
Na śniadanie zjadłem 80 gram płatków owsianych i 250 ml mleka 2%
Kolacja: skyr Pilos 150 g i banan 120 g
Zjadłem banana 120 gram i jogurt naturalny 200 gram
80g płatków, mleko 250ml i banan 120g
Płatki owsiane osiemdziesiąt gramów
```

`meal-understanding.js` rozdziela normalizację, posiłek, segmenty, ilość, jednostkę i query. Zna ograniczony słownik odmian i liczby zapisane słownie 0–2000 oraz pół/półtora i słowne ułamki dziesiętne (`polish-numbers.js`). Obsługuje przecinek dziesiętny w cyfrach i flagę „około/jakieś/mniej więcej”. Nie zgaduje gramatury, makro, gęstości ani typowych porcji. Nie każdy produkt da się od razu rozstrzygnąć; UI zachowuje niepewną pozycję do wyboru.

Istniejący ProductResolver używa jawnych aliasów, dokładnej i podobnej pamięci potwierdzeń, ulubionych, ostatnich i cache. Po lokalnym dopasowaniu analiza może wykonać najwyżej **jeden** zewnętrzny search; pozostałe wyszukujesz przyciskiem w konkretnym wierszu. Wpisywanie i interim nie odpytują OFF. Wybór produktu oraz końcowe zatwierdzenie propozycji uczą lokalnego dopasowania bez podwójnego liczenia tego samego wyboru.

Wszystkie obliczenia nadal wykonują `calculatePortion()` i `sumNutrition()`. Zmiana produktu między g i ml wymaga ponownego podania ilości, zamiast automatycznego przeliczenia. Stary `meal-parser.js` zachowano i testujemy jako zgodny moduł Etapu 2; nowy ekran korzysta z `understandMeal()`.

## Rozpoznawanie mowy i prywatność

`speech-recognition.js` używa `SpeechRecognition` lub `webkitSpeechRecognition`, domyślnie `pl-PL`, wyłącznie po kliknięciu. Dostępność sprawdzamy w uruchomionej przeglądarce, na HTTPS/localhost. Najlepszy pierwszy wybór dla telefonu: aktualny Chrome na Androidzie. Safari/iOS może udostępniać wariant webkit; Firefox stabilny nie jest zakładanym środowiskiem mowy. Sama obecność API nie gwarantuje dostępności usługi ani języka.

MDN Browser Compatibility Data zweryfikowano 25.10.2026: Chrome ma standardowy interfejs od 139 i starszy webkit od 33; Safari webkit od 14.1; Firefox jest oznaczony jako preview. Wsparcie mobilne, dostawca usługi, uprawnienia i polityki systemu mogą się różnić. [Źródło MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

**Benger nie nagrywa plików audio i ich nie przechowuje.** Browserowy silnik może wysyłać dźwięk do swojego dostawcy. Krótka informacja jest widoczna przed mikrofonem. Nie gwarantujemy rozpoznawania offline ani działania każdego Chromium. Odmowa zgody, brak mowy, timeout (45 s / 10 s po stop), błąd usługi i brak API mają komunikaty oraz pełny fallback tekstowy. Zmiana adaptera nie wymaga przebudowania parsera, produktów ani dziennika.

Szczegóły: [voice-entry.md](docs/voice-entry.md); pierwotne kontrakty: [voice-first-architecture.md](docs/voice-first-architecture.md).

## Pamięć i model danych

Nowy dziennik używa klucza `benger.nutrition.v1` w localStorage. Każdy wpis zawiera:

- `id`: UUID wpisu; natywne `crypto.randomUUID()` lub UUID v4 z `crypto.getRandomValues()`;
- `date`: wybrany dzień posiłku, `YYYY-MM-DD`;
- `createdAt`: moment utworzenia w ISO 8601, UTC;
- `meal`: `breakfast`, `lunch`, `dinner` albo `snack`;
- `productId`, `productName`, `brand`, `source`, `sourceId`, `barcode`, `amount`, `unit`; starsze wpisy bez nowych metadanych również są odczytywane;
- `nutrition`: kopia niezaokrąglonych wartości porcji (`kcal`, `protein`, `fat`, `carbs`).

Historyczne wpisy korzystają z zapisanej kopii, więc aktualizacja katalogu nie zmienia historii. Przed dodawaniem i usuwaniem aplikacja ponownie odczytuje aktualną listę. Zdarzenie `storage` odświeża pozostałe karty. Nadal istnieje zaakceptowane ograniczenie: odczyt i zapis nie tworzą transakcji, więc dokładnie równoczesne zmiany w kartach mogą się nadpisać.

Zatwierdzenie propozycji głosowej/tekstowej korzysta z tego samego dziennika i klucza pamięci co formularz ręczny. Zestaw ma wspólną datę, ale posiłek można zmienić w pojedynczej pozycji. Każdy wpis ma własne ID oraz kopię metadanych i makro pokazanych do akceptacji. Wykonywana jest jedna operacja `localStorage.setItem`. Błąd tworzenia dowolnego wpisu albo zapisu oznacza brak zapisu całego zestawu i brak komunikatu sukcesu. Tekst i propozycja pozostają dostępne do ponowienia.

Uszkodzone dane blokują zapis i nie są zastępowane pustą listą. Nieudany zapis pozostawia formularz i dane bez pozornego sukcesu. Gdy przeglądarka blokuje pamięć, dziennik może być niedostępny. Dane pozostają tylko w tej przeglądarce i pod tym adresem strony; wyczyszczenie pamięci je usuwa. Nie ma synchronizacji między urządzeniami, importu ani eksportu wpisów żywieniowych.

## Archiwalne notatki prototypu

Eksperymentalny notatnik, jego mikrofon i moduł zostały usunięte z aplikacji. Nie odczytujemy, nie migrujemy i nie kasujemy istniejących kluczy `benger.meals.v1` ani ich odpowiedników preview. Dane pozostają w przeglądarce, ale nie mają już interfejsu notatnika. Główne dodawanie posiłków głosem działa nadal przez `speech-recognition.js` i `voice-entry.js`. Backup dziennika produktów nie obejmuje dawnych notatek.

## Testy

Obliczenia, parser i bezpieczeństwo serwera, bez dodatkowych bibliotek:

```sh
npm test
```

Polecenie uruchamia testy obliczeń, parsera, serwera oraz `product-model.test.js`, `product-cache.test.js`, `product-repository.test.js`, `product-providers/*.test.js`. Testy parsera obejmują aliasy, szyk nazw i ilości, posiłki, kilka produktów, polski przecinek, niejasności, niezgodne jednostki i nieprawidłowe ilości. Testy serwera sprawdzają nowe pliki dodane po uruchomieniu procesu, typy odpowiedzi, blokadę plików prywatnych i testowych, path traversal, dowiązania oraz błędne adresy. Używają tymczasowego katalogu i nie zmieniają plików aplikacji.

Testy interfejsu wymagają zainstalowanego Chromium i także nie wymagają pakietów npm:

```sh
npm run test:browser
```

Domyślnie uruchamiany jest program `chromium`. Zmienna `CHROMIUM_PATH` może wskazać inną ścieżkę. Test korzysta z lokalnego serwera na wolnym porcie oraz tymczasowego profilu przeglądarki. Nie używa danych użytkownika; po zakończeniu zatrzymuje swoje procesy i usuwa profil. Chromium jest uruchamiane z `--no-sandbox` na potrzeby izolowanego środowiska testowego.

Workflow GitHub Actions uruchamia oba zestawy na Node.js 22. Korzysta z Chrome dostępnego na runnerze przez `CHROMIUM_PATH=/usr/bin/google-chrome`, bez instalowania pakietów npm.

Opcjonalny zrzut ekranu po dodaniu czterech posiłków:

```sh
BENGER_SCREENSHOT_PATH=/tmp/benger.png npm run test:browser
```

Testy sprawdzają porcje, walidację i fokus, posiłki i dwa dni, sumowanie, usuwanie, odświeżenie, dwie karty, awarie pamięci, UUID zastępcze, historyczne wartości, kontrast, szerokości 320/390/768/1024/1440 px, zachowanie archiwalnych danych notatek i konsolę.

Regresje wcześniejszego dziennika sprawdzają także podgląd dwóch i trzech produktów, brak zapisu przed akceptacją, pojedynczy zapis całego zestawu, poprawianie tekstu, blokadę starego podglądu, brak częściowego sukcesu przy awarii pamięci lub ID, snapshot propozycji, współpracę z formularzem ręcznym i widoki 320/390 px. Opcjonalny zrzut propozycji: `BENGER_TEXT_SCREENSHOT_PATH=/tmp/benger-text.png npm run test:browser`.

Dwa dodatkowe zestawy uruchamiają sam publiczny frontend na osobnym hostingu statycznym pod `/` i `/Benger/`, bez produkcyjnego serwera Node. Podkatalog nie ma zasobów zastępczych pod root domeny. Testy obejmują importy, CSS, manifest, oba formularze, zapis, odświeżenie, logo i rozdzielenie localStorage między origin.

Dodatkowy zestaw `voice-entry.browser.test.js` mockuje wyłącznie Speech API i OFF, sprawdza interim/final, mikrofon → tekst → propozycję → atomowy zapis → reload, pamięć wyborów, niepewny skyr, edycję jednej pozycji, brak gramatury, g/ml, offline, błędy mowy i limity. Układ sprawdzamy na 320/390/430/1024/1440 px. Mikrofon urządzenia sprawdź dodatkowo ręcznie na HTTPS.

Opcjonalne zrzuty panelu głosowego: `BENGER_VOICE_SCREENSHOTS=/tmp/voice npm run test:browser`.

Opcjonalne pomiary i zrzuty pięciu szerokości:

```sh
BENGER_AUDIT_DIR=/tmp/benger-web-audit npm run test:browser
```

Start Chromium ma limit 45 sekund dla wolniejszego CI; rzeczywisty błąd lub przedwczesne zakończenie procesu nadal przerywa test. Nie dodano opóźnienia po poprawnym starcie.


Testy katalogu obejmują mapowanie OFF, brak nazwy/kcal/makro, nieprawidłowe liczby, g/ml bez gęstości, barcode, deduplikację, cache/TTL, ostatnie, ulubione, 429, timeout, offline, uszkodzony JSON i puste wyniki. API jest mockowane; CI nie odpytuje produkcyjnego OFF.

Test Chromium Etapu 3 używa natywnego `fetch`, przechwytuje ruch OFF przez CDP z kontrolowanym CORS i działa na rzeczywistym IndexedDB pod `/Benger/`. Sprawdza pełny zapis produktu OFF, trwałość, offline, usuwanie ulubionego, barcode, limity także w dwóch kartach, awarie API, XSS, uszkodzony cache oraz zablokowany IndexedDB. Opcjonalny zrzut: `BENGER_CATALOG_SCREENSHOT_PATH=/tmp/benger-catalog.png npm run test:browser`.

GitHub Actions uruchamia testy także po push do `etap-6-pwa-catalog-scanner` (bez tworzenia PR). To workflow testowy, bez deploymentu.


## Aktualny preview i ręczny test produkcyjnego OFF

Preview: **https://kubanik21-crypto.github.io/Benger/previews/etap-8/**

Jest przygotowywane po push gałęzi `etap-8-recipes-navigation` przez workflow `Stage 8 preview`: testy → artefakt publicznych plików → zmiana tylko podkatalogu na istniejącym `gh-pages` → jawne żądanie przebudowy Pages. Token GitHub Actions sam nie wyzwala kolejnego builda Pages. Workflow sprawdza źródło `gh-pages`/`/`; nie zmienia konfiguracji hostingu i zatrzyma się, jeśli jest inna. Istniejące pliki root pozostają bez zmian. Udostępnia też pobieralny artefakt.

Pasek podglądu pokazuje SHA. Odwołania do CSS, JS, manifestu i importy modułów w artefakcie zawierają ten sam parametr wersji SHA, aby nowy index nie mieszał się ze starszymi modułami z cache hostingu. Preview używa `benger.preview-etap-8.nutrition.v1` oraz IndexedDB `BengerDB-preview-etap-8`. Dane wersji głównej nie są kopiowane ani zmieniane.

Ręczna publikacja z czystej gałęzi Etapu 8: `npm run preview:publish`. Skrypt tworzy tymczasowy detached worktree istniejącej gałęzi `gh-pages`, sprawdza zakres zmiany i wykonuje zwykły push bez force. Nie tworzy nowej gałęzi i nie przełącza roboczego checkoutu.

W preview kliknij „Sprawdź połączenie OFF”. Strona diagnostyczna uruchamia prawdziwe wyszukiwanie i barcode, zapisuje statusy HTTP, informację o czytelnej odpowiedzi CORS, znormalizowany produkt/makro i wynik ładowania zdjęcia. Nie dodaje wpisów do dziennika. Raport można pobrać jako JSON. Na tej stronie nic nie jest mockowane.

Pełny test rzeczywistego przepływu w Chromium z tymczasowym profilem, poza standardowym CI:

```sh
npm run test:off:live -- --url https://kubanik21-crypto.github.io/Benger/previews/etap-8/ --report /tmp/benger-off-live.json
```

Test lokalnego artefaktu z rzeczywistym OFF: `npm run test:off:live -- --local`. Respektuje proxy środowiska, nie wyłącza TLS i nie omija blokad sieci. Brak odpowiedzi lub niekompletny przepływ kończy test błędem. Zwykłe `npm test` i `npm run test:browser` nadal używają mocków dla OFF.

Diagnostyka zawiera też porównanie A/B/C/D: CGI z X-User-Agent, CGI bez dodatkowych nagłówków, CGI z samym Accept oraz Search-a-licious. Pokazuje rzeczywiste wyniki fetch; status OPTIONS wymaga DevTools Network/CDP. Respektuje odstępy i blokadę 429. Szczegóły pomiaru, aktualny formularz rejestracji i bramki przed merge: [audyt produkcyjny](docs/off-production-audit.md).

## Smart Voice Understanding — Etap 5

Wspólny pipeline głosu i tekstu zachowuje raw/normalized, rozpoznaje liczby słowne, procenty i kilka produktów bez przecinków. Nie zgaduje brakującej masy ani wariantu. Jawne skróty użytkownika są oddzielone od pamięci potwierdzonych wyborów.

- [Implementacja, testy i ograniczenia](docs/smart-voice-understanding.md)
- [Preview Etapu 7](https://kubanik21-crypto.github.io/Benger/previews/etap-7/)
- [Voice Test Lab](https://kubanik21-crypto.github.io/Benger/previews/etap-7/voice-test-lab.html) — lokalna historia maks. 20 analiz, eksport JSON, aliasy; bez audio i telemetrii.
- Benchmark części językowej: `node scripts/benchmark-voice.mjs`.

Testy CI korzystają z mocków OFF i SpeechRecognition. Mikrofon na prawdziwym Androidzie pozostaje osobnym testem akceptacyjnym. Etap 5 nie dodawał AI ani backendu; service worker i offline shell zostały dodane w Etapie 6.

## PWA, katalog i aparat — Etap 6

Mikrofon pozostaje głównym działaniem. Obok niego jest „Skanuj kod”; ręczne wyszukiwanie i pełnoprawny własny produkt są dostępne bez konta. Po ukończeniu instalacji offline działa cały statyczny katalog USDA, dziennik, tekstowy parser, custom, ulubione, aliasy oraz zapisane produkty OFF. ZXing jest vendored/lazy, bez CDN. Kamera nie zapisuje obrazu i zatrzymuje się po sukcesie, anulowaniu, błędzie lub opuszczeniu strony.

Katalog: 13 727 kompletnych produktów z oficjalnych Foundation/FNDDS/SR Legacy. Bez USDA API key. Wyszukiwanie po polsku korzysta z lokalnego indeksu i chunków; wartości per100 g nie są przeliczane na ml. `source: openfoodfacts/benger` zachowano dla zgodności wcześniejszych danych; nowe źródła to usda/custom.

- [PWA, scope, aktualizacja, backup/import](docs/pwa-offline.md)
- [Skaner, prywatność i fallback](docs/barcode-scanner.md)
- [Katalog, indeks, budowanie USDA i pomiary](docs/product-catalog.md)
- [Źródła danych i licencje](docs/data-sources-and-licenses.md)

```sh
npm test
npm run test:browser
node scripts/catalog-benchmark.mjs
# Wyłącznie ręczna diagnostyka prawdziwej sieci, poza CI:
node scripts/brand-coverage.mjs
```

Standardowe testy nie pobierają USDA ani produkcyjnego OFF. Refresh jest osobnym, jawnym `npm run catalog:refresh`; wymaga python3 wyłącznie w pipeline danych. `npm start` i testy generują manifest assetów PWA. Zapisuj `sw-assets.js` razem ze zmianami publicznych plików.

Preview: https://kubanik21-crypto.github.io/Benger/previews/etap-6/ — własny scope i namespace. Strony developerskie: [Barcode Test Lab](https://kubanik21-crypto.github.io/Benger/previews/etap-6/barcode-test-lab.html), [Catalog Diagnostics](https://kubanik21-crypto.github.io/Benger/previews/etap-6/catalog-diagnostics.html), [PWA Diagnostics](https://kubanik21-crypto.github.io/Benger/previews/etap-6/pwa-diagnostics.html). Publikacja nie zmienia root ani wcześniejszych preview.

Backup w sekcji „Dane i kopia zapasowa” zawiera także własne produkty, ulubione, aliasy i pamięć wyborów. Domyślnie import łączy dane i wymaga potwierdzenia. Przed importem zamknij inne karty. Dane są lokalne; nie ma synchronizacji urządzeń.

### Akceptacja na Samsungu

1. Zainstaluj PWA i uruchom z ikonki.
2. Odczytaj realny EAN aparatem; sprawdź silnik w Barcode Test Lab, wynik OFF oraz zatrzymanie kamery.
3. Po komunikacie gotowości offline wyłącz sieć, zamknij i otwórz PWA; sprawdź dziennik i zapytania „banan”, „ryż”, „pierś z kurczaka”.
4. Sprawdź cached barcode i własny produkt z kodem; nieznany kod powinien wyjaśnić potrzebę sieci.
5. Włącz sieć i sprawdź głos, zatwierdzenie posiłku oraz odświeżenie.
6. Wyeksportuj backup, zaimportuj po potwierdzeniu, sprawdź snapshoty i ulubione.
7. Przy kolejnej wersji zapisz edycję, zaakceptuj aktualizację i sprawdź, że dane pozostały.

Testy syntetycznej kamery i headless Chromium nie zastępują instalacji ani prawdziwego aparatu na Samsungu. Nie utworzono PR ani nie scalono Etapu 6.

### Usunięcie katalogu demonstracyjnego

Nie publikujemy czterech przykładowych produktów ani providera lokalnego. Wyszukiwanie i resolver korzystają tylko z USDA/OFF/custom/cache. Historyczne wpisy nadal pokazują zapisane nazwy i snapshoty makro; stare ID są zachowane wyłącznie jako referencje zgodności backupów i preferencji, bez odtwarzania produktów. Źródło dawnych wpisów jest oznaczone jako archiwalne. Testowe produkty custom są wyłącznie w niepublikowanych fixtures.


## Naturalne porcje domowe — Etap 7

Możesz powiedzieć lub wpisać np. „2 jajka”, „3 kromki chleba”, „2 łyżki oliwy” albo „pół opakowania skyra”. Najpierw wybieramy konkretny produkt, następnie jego porcję. Brak wiarygodnej masy wymaga wyboru rozmiaru lub wpisania wagi jednej porcji — nie zgadujemy gęstości ani uniwersalnej kromki.

- Osobny PortionResolver i lazy-loaded porcje USDA z oficjalnych food_portion / measure_unit.
- Porcje i opakowania OFF w tym samym requestcie; brak dodatkowych odpytań API.
- Inline **Użyj raz** / **Zapamiętaj dla tego produktu**, edycja i usuwanie w **Moje porcje i naczynia**.
- Opcjonalne porcje i wielkość opakowania własnego produktu.
- Szklanka/kubek bez domyślnej pojemności; można zapisać swoje ml. Łyżka 15 ml i łyżeczka 5 ml wyłącznie dla podstawy ml.
- Snapshot oryginalnej porcji i konwersji w dzienniku, zgodność dawnych wpisów i rozszerzony backup.
- Pełny katalog porcji offline po przygotowaniu PWA, osobny preview/scope Etapu 7.

[Opis architektury, diagnostyka i checklista Samsunga](docs/household-portions.md).

[Preview Etapu 7](https://kubanik21-crypto.github.io/Benger/previews/etap-7/) · [Portion Test Lab](https://kubanik21-crypto.github.io/Benger/previews/etap-7/portion-test-lab.html) · [Portion Diagnostics](https://kubanik21-crypto.github.io/Benger/previews/etap-7/portion-diagnostics.html).

Testy: `npm test`, `npm run test:browser`, `git diff --check`. Pomiar bez zewnętrznego API: `node scripts/measure-household-portions.mjs /tmp/portions.json`.

Dogrywka Etapu 7 dodaje ostrożny fallback **REFERENCE/MEDIUM** dla dziewięciu rodzin żywności. Typowa porcja jest oznaczona „ok.” / „typowa wartość”, nie zastępuje makro wybranego produktu i nie uczy USER automatycznie. Dokładna definicja oraz jawna porcja użytkownika mają pierwszeństwo. Szczegóły źródeł i ograniczeń: [household-portions.md](docs/household-portions.md#dogrywka-etapu-7--exact-reference-estimate-unresolved).

## Przepisy i pięć sekcji — Etap 8

Nawigacja: Dziennik, Przepisy, Produkty, Historia, Więcej. Przełączanie sekcji zachowuje formularze. „Gotuj z Bengerem” przyjmuje krótkie wypowiedzi lub tekst, pokazuje propozycję i zapisuje dopiero zaakceptowaną zmianę. Składniki używają istniejącego resolvera produktów i porcji; brak wagi pozostaje do uzupełnienia.

Przepisy, szkice i historia wersji są lokalne w IndexedDB. Makro jest snapshotem; wartości na porcję/100 g/100 ml wymagają jawnej wydajności. Backup v2 obejmuje przepisy i nadal przyjmuje backup v1. Bez AI, kont ani zapisu audio.

- [Architektura i checklista Samsunga](docs/recipes-and-navigation.md)
- [Walidacja i pomiary](docs/stage-8-validation.md)
- [Preview Etapu 8](https://kubanik21-crypto.github.io/Benger/previews/etap-8/)
- [Recipe Test Lab](https://kubanik21-crypto.github.io/Benger/previews/etap-8/recipe-test-lab.html)
- [Recipe Diagnostics](https://kubanik21-crypto.github.io/Benger/previews/etap-8/recipe-diagnostics.html)

Pomiar na izolowanym profilu Chromium, bez danych użytkownika: `node scripts/measure-recipes.mjs /tmp/recipes.json`.
