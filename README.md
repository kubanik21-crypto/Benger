# Benger — Etap 2

Prosty lokalny dziennik żywieniowy w HTML, CSS i JavaScript, udostępniany przez mały serwer Node.js. Bez logowania, zewnętrznych API, AI i dodatkowych bibliotek.

## Uruchomienie

Wymaga Node.js 22 lub nowszego. Nie trzeba uruchamiać `npm install`.

```sh
npm start
```

Uruchamiaj z katalogu projektu. Domyślny port to 3000; zmienna `PORT` pozwala go zmienić. Nie skonfigurowano publicznego hostingu. Na telefonie używaj bezpiecznego połączenia HTTPS. Manifest pozwala przeglądarce korzystać z nazwy i kolorów aplikacji przy dodawaniu do ekranu głównego; nie ma service workera ani gwarancji uruchomienia offline.

Serwer automatycznie udostępnia zwykłe pliki `.html`, `.js`, `.css` i `.webmanifest` z katalogu projektu i podkatalogów. Nowy moduł JavaScript działa bez dopisywania trasy i bez restartu. `/` nadal zwraca `index.html`.

Pliki i katalogi zaczynające się od `.`, `server.js`, `package.json`, pliki `*.test.js`, dowiązania oraz próby wyjścia poza katalog są blokowane. Inne rozszerzenia nie są publiczne. Odpowiedzi wymagają ponownej weryfikacji przez przeglądarkę (`Cache-Control: no-cache`). Po zmianie samego kodu `server.js` nadal trzeba zatrzymać wcześniejszy proces (`Ctrl+C`) i ponownie uruchomić `npm start`.

## Hosting statyczny i przygotowanie PWA

Frontend działa również bez `server.js`: wystarczą `index.html`, `style.css`, `app.js`, `nutrition.js`, `meal-parser.js`, `legacy.js` i `manifest.webmanifest`. Względne ścieżki działają zarówno pod `/`, jak i pod `/Benger/`. Przy hostowaniu w katalogu adres powinien kończyć się ukośnikiem.

Lokalny `npm start` nadal serwuje aplikację pod `/`. Hosting pod `/Benger/` jest symulowany w testach jako osobny serwer statyczny; nie dodano takiej trasy do serwera deweloperskiego.

Nie publikuj całego repozytorium: zabezpieczenia lokalnego serwera nie obowiązują na hostingu statycznym. Przygotuj artefakt wyłącznie z plikami publicznymi. GitHub Pages jest rekomendowanym pierwszym wariantem; nie został jeszcze włączony i aplikacja nie została opublikowana.

Manifest ma względne `start_url` i `scope`, ale nadal brakuje ikon instalacyjnych, service workera i offline shella. Nie ma jeszcze gwarancji instalacji ani odświeżenia bez sieci. Zmiana domeny, protokołu lub portu tworzy inny origin i nie przenosi danych localStorage; zmiana samej ścieżki na tym samym origin nie oddziela danych.

- [Audyt gotowości webowej](docs/web-readiness-audit.md): wyniki hostingu, responsive layout, PWA, dane i porównanie hostów.
- [Projekt Etapu 3 — Web Experience](docs/stage-3-web-experience.md): konkretny układ desktop/mobile, dialog dodawania, offline i przyszły workflow publikacji. To plan, nie zaimplementowany Etap 3.

## Dziennik produktów

1. Wybierz dzień nad formularzem — dotyczy on dodawania, listy i podsumowania.
2. Wybierz posiłek i produkt z lokalnego katalogu.
3. Wpisz ilość w jednostce produktu: g albo ml. Działa kropka i polski przecinek, np. `50,5`.
4. Sprawdź kcal, białko, tłuszcz i węglowodany w podglądzie.
5. Dodaj pozycję do dziennika. Ilość zostanie wyczyszczona, a komunikat potwierdzi zapis.
6. Wpisy są podzielone na posiłki. Przycisk „Usuń” usuwa wyłącznie wskazany wpis i aktualizuje sumę dnia.

Wartości produktów w `nutrition.js` są **przykładowe, edukacyjne**. Nie opisują konkretnych marek i nie są podstawą zaleceń dietetycznych. Nie przeliczamy mililitrów na gramy. Obliczenia wykonują wyłącznie `calculatePortion()` i `sumNutrition()`. Dane są zaokrąglane dopiero na ekranie.

## Dodawanie z tekstu

Zasada działania: **parser rozpoznaje → użytkownik sprawdza → aplikacja zapisuje**.

1. Wybierz datę dziennika.
2. W sekcji „Dodaj z tekstu” opisz jeden posiłek. Jeśli nie podasz jego nazwy, zostanie użyty aktualny wybór posiłku z formularza ręcznego.
3. Kliknij „Analizuj posiłek”. Sama analiza niczego nie zapisuje.
4. Sprawdź datę, posiłek, nazwy, porcje, kcal, makro i sumę propozycji.
5. Dopiero „Dodaj wszystko do dziennika” zapisuje osobny wpis dla każdego produktu i odświeża dziennik oraz sumę dnia.

Przykłady:

```text
Na śniadanie zjadłem 50 g płatków owsianych i 200 ml mleka 2%
Obiad: banan 120 g i 150 g jogurtu naturalnego
Na śniadanie 50 g płatków owsianych, 200 ml mleka 2% i banan 120 g
50,5 g płatków oraz mleko 2% 200ml
```

`meal-parser.js` to deterministyczny parser, bez AI, bibliotek NLP i połączeń z zewnętrznymi usługami. `parseMealText(text, { defaultMeal })` zwraca kod posiłku, pozycje (`productId`, `amount`, `unit`, `status`, `source`) oraz listę `issues`. Problemy z `itemIndex` dotyczą konkretnej pozycji. Parser nie oblicza wartości odżywczych i nie zapisuje danych; interfejs pobiera produkty z `PRODUCTS` i używa `calculatePortion()` oraz `sumNutrition()`. AI pozostaje na późniejszy etap.

Obsługiwane są cztery produkty i określone aliasy: płatki owsiane / płatków owsianych / płatki / płatków, banan / banana / banany, jogurt naturalny / jogurtu naturalnego / jogurt, mleko 2% / mleka 2% / mleko / mleka. Ilość może stać przed lub po produkcie. Działają `g`, `gram`, `gramów`, `ml`, `mililitrów`, zapis bez spacji (`50g`) i przecinek dziesiętny (`50,5`). Produkty oddzielaj przecinkami, średnikami albo słowami „i” lub „oraz”.

Parser rozpoznaje śniadanie, obiad, kolację i przekąskę, także we frazach „na kolację” i „na przekąskę”. Jeden opis dotyczy jednego posiłku. Dwa sprzeczne posiłki, niedokończona lista lub nieobsługiwane fragmenty wymagają poprawienia tekstu.

Przykładowe problemy:

- `zjadłem banana` — brakuje ilości i jednostki; nie przyjmujemy domyślnej porcji.
- `100 g czegoś` — nieznany produkt.
- `200 g mleka` — wymagana jest jednostka ml; nie konwertujemy g na ml.
- `jogurt truskawkowy 150 g` — nie zastępujemy go jogurtem naturalnym.

Jeśli choć jedna pozycja jest niepoprawna, **cały zapis jest zablokowany**. Popraw tekst i ponów analizę; nie ma automatycznego pomijania problematycznych pozycji ani edytora propozycji. Zmiana tekstu, daty lub wyboru domyślnego posiłku unieważnia poprzedni podgląd. Ręczne dodawanie nadal działa niezależnie.

To ograniczony parser reguł, nie pełne rozumienie języka polskiego. Nie obsługuje dowolnej odmiany nazw, marek, kilogramów, sztuk ani opisów typu „garść” czy „pół banana”. Nowe aliasy muszą wskazywać na istniejący produkt w `PRODUCTS`.

## Pamięć i model danych

Nowy dziennik używa klucza `benger.nutrition.v1` w localStorage. Każdy wpis zawiera:

- `id`: UUID wpisu; natywne `crypto.randomUUID()` lub UUID v4 z `crypto.getRandomValues()`;
- `date`: wybrany dzień posiłku, `YYYY-MM-DD`;
- `createdAt`: moment utworzenia w ISO 8601, UTC;
- `meal`: `breakfast`, `lunch`, `dinner` albo `snack`;
- `productId`, `productName`, `amount`, `unit`;
- `nutrition`: kopia niezaokrąglonych wartości porcji (`kcal`, `protein`, `fat`, `carbs`).

Historyczne wpisy korzystają z zapisanej kopii, więc aktualizacja katalogu nie zmienia historii. Przed dodawaniem i usuwaniem aplikacja ponownie odczytuje aktualną listę. Zdarzenie `storage` odświeża pozostałe karty. Nadal istnieje zaakceptowane ograniczenie: odczyt i zapis nie tworzą transakcji, więc dokładnie równoczesne zmiany w kartach mogą się nadpisać.

Zatwierdzenie propozycji tekstowej korzysta z tego samego dziennika i klucza pamięci co ręczny formularz. Cały zestaw ma wspólną datę i posiłek, własne ID poszczególnych wpisów oraz kopie metadanych i makro pokazanych do akceptacji. Wykonywana jest jedna operacja `localStorage.setItem`. Błąd tworzenia dowolnego wpisu albo zapisu oznacza brak zapisu całego zestawu i brak komunikatu sukcesu. Tekst i propozycja pozostają dostępne do ponowienia.

Uszkodzone dane blokują zapis i nie są zastępowane pustą listą. Nieudany zapis pozostawia formularz i dane bez pozornego sukcesu. Gdy przeglądarka blokuje pamięć, dziennik może być niedostępny. Dane pozostają tylko w tej przeglądarce i pod tym adresem strony; wyczyszczenie pamięci je usuwa. Nie ma synchronizacji między urządzeniami, importu ani eksportu wpisów żywieniowych.

## Notatnik eksperymentalny

Zwijana sekcja zachowuje stary notatnik i jego klucz `benger.meals.v1`. Nowy dziennik nie przepisuje ani nie usuwa tych danych. Kod notatnika jest w `legacy.js`; można pisać, usuwać i eksportować notatki. Eksport obejmuje **wyłącznie notatki tekstowe**, nie produkty.

Dyktowanie nie jest połączone z dziennikiem produktów. Wymaga obsługi Web Speech API, bezpiecznego połączenia i zgody na mikrofon. Może wysyłać dźwięk do dostawcy przeglądarki. Automatyczne testy symulują jego zdarzenia; rzeczywisty mikrofon telefonu wymaga osobnego sprawdzenia.

## Testy

Obliczenia, parser i bezpieczeństwo serwera, bez dodatkowych bibliotek:

```sh
npm test
```

Polecenie uruchamia `node --test nutrition.test.js meal-parser.test.js server.test.js`. Testy parsera obejmują aliasy, szyk nazw i ilości, posiłki, kilka produktów, polski przecinek, niejasności, niezgodne jednostki i nieprawidłowe ilości. Testy serwera sprawdzają nowe pliki dodane po uruchomieniu procesu, typy odpowiedzi, blokadę plików prywatnych i testowych, path traversal, dowiązania oraz błędne adresy. Używają tymczasowego katalogu i nie zmieniają plików aplikacji.

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

Testy sprawdzają porcje, walidację i fokus, posiłki i dwa dni, sumowanie, usuwanie, odświeżenie, dwie karty, awarie pamięci, UUID zastępcze, historyczne wartości, kontrast, szerokości 320/390/768/1024/1440 px, notatnik i konsolę.

Dla Etapu 2 sprawdzają także podgląd dwóch i trzech produktów, brak zapisu przed akceptacją, pojedynczy zapis całego zestawu, poprawianie tekstu, blokadę starego podglądu, brak częściowego sukcesu przy awarii pamięci lub ID, snapshot propozycji, współpracę z formularzem ręcznym i widoki 320/390 px. Opcjonalny zrzut propozycji: `BENGER_TEXT_SCREENSHOT_PATH=/tmp/benger-text.png npm run test:browser`.

Dwa dodatkowe zestawy uruchamiają sam publiczny frontend na osobnym hostingu statycznym pod `/` i `/Benger/`, bez produkcyjnego serwera Node. Podkatalog nie ma zasobów zastępczych pod root domeny. Testy obejmują importy, CSS, manifest, oba formularze, zapis, odświeżenie, logo i rozdzielenie localStorage między origin.

Opcjonalne pomiary i zrzuty pięciu szerokości:

```sh
BENGER_AUDIT_DIR=/tmp/benger-web-audit npm run test:browser
```

Start Chromium ma limit 45 sekund dla wolniejszego CI; rzeczywisty błąd lub przedwczesne zakończenie procesu nadal przerywa test. Nie dodano opóźnienia po poprawnym starcie.
