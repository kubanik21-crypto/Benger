# Benger

**Benger 1.0** to lokalna aplikacja PWA do żywienia, przepisów, progresu i treningu. Dodawaj jedzenie głosem, tekstem, skanerem lub ręcznie. Korzystaj na telefonie i komputerze, także offline w zakresie zapisanych danych.

## Co potrafi

- Dziennik z posiłkami, kalkulatorem porcji, kcal/B/T/W i historycznymi kopiami wartości.
- Głos i tekst z propozycją do sprawdzenia — nic nie zapisuje się bez zatwierdzenia. Produkty z Open Food Facts, lokalnego USDA i własnego katalogu; ulubione, ostatnie produkty, kody kreskowe oraz domowe porcje.
- Przepisy z automatycznie zapisywanymi szkicami, składnikami, krokami i wydajnością; dodawanie porcji przepisu do dziennika.
- Cele z historią obowiązywania, Dashboard dnia i podsumowania.
- Masa, ciśnienie/tętno, obwody, lokalne zdjęcia progresu i porównania — bez diagnoz.
- Trening siłowy, cardio, Mobility, plany/rutyny, serie i timery. Kalendarz raz/w tygodniu, wyjątki i oddzielne wykonania.
- **Exercise Guide dla wszystkich 60 wbudowanych ćwiczeń**: polskie instrukcje oraz własne schematy SVG dostępne offline podczas treningu, z planu i biblioteki. Własne ćwiczenia pokazują własną notatkę, bez zgadywania techniki.
- Motyw systemowy/jasny/ciemny, ustawienia ekranu startowego oraz kopie zapasowe.

## Local-first / dane

Nie ma kont, naszego backendu ani synchronizacji urządzeń. Dziennik, przepisy, plany, pomiary i zdjęcia progresu pozostają w pamięci przeglądarki na danym urządzeniu. Instalacja PWA korzysta z danych tej samej witryny. Wyczyszczenie danych witryny lub automatyczne usunięcie przez przeglądarkę może spowodować ich utratę — regularnie eksportuj backup.

To nie oznacza braku całej komunikacji z internetem: Web Speech może przesyłać dźwięk do usługi przeglądarki; zewnętrzne wyszukiwanie/barcode wysyła zapytania do Open Food Facts, a zdjęcia produktów są pobierane ze źródła. Mikrofon i aparat uruchamiasz jawnie. Benger nie zapisuje nagrań i nie wysyła własnych przepisów ani pomiarów. Dane lokalne nie są szyfrowane przez Bengera.

Produkcyjny adres i magazyn pozostają stałe: **https://kubanik21-crypto.github.io/Benger/**. Nie ma migracji do nowego namespace w wersji 1.0. Dane oddzielnych wcześniejszych preview nie są automatycznie scalane z produkcją; przenosi się je przez backup.

## Instalacja PWA

Otwórz adres produkcyjny przez HTTPS w aktualnym Chrome na Androidzie. W Ustawieniach wybierz „Zainstaluj Benger”, jeśli przeglądarka udostępnia tę akcję, albo użyj jej menu instalacji. Po przygotowaniu trybu offline aplikacja otwiera się bez internetu. Zewnętrzne produkty bez cache i rozpoznawanie mowy mogą wymagać sieci.

Aktualizacja pojawia się jako niewielki banner. Zapisz bieżące dane i wybierz „Zaktualizuj”. Nie wymuszamy automatycznego przeładowania podczas treningu lub edycji.

## Development

Node.js 22 lub nowszy. Bez frameworków i bez instalowania zależności npm:

```sh
npm start
```

Domyślnie http://localhost:3000/ (`PORT` zmienia port). Serwer udostępnia statyczne zasoby z kontrolą ścieżek, blokując `.git`, pliki ukryte, konfigurację i testy. Kod działa również na hostingu statycznym pod `/` i `/Benger/`. Uprawnienia kamery/głosu wymagają bezpiecznego kontekstu przeglądarki.

`package.json` jest źródłem wersji. Build generuje z niego `app-version.js`; nie edytuj tego pliku ręcznie. `scripts/public-assets.mjs` odróżnia narzędzia developerskie od zasobów produkcyjnych. Dawne narzędzia i przypięte wersje w testach pozostają w repo dla regresji, ale nie są publikowane w produkcie.

## Testy

```sh
npm test
npm run test:browser
git diff --check
```

Testy wykorzystują Node.js i lokalny Chrome/Chromium (opcjonalnie `CHROMIUM_PATH`). API OFF jest mockowane w CI; testy jednostkowe nie pobierają rzeczywistego katalogu USDA. Pełny zestaw obejmuje dane, backup/rollback, PWA/offline, aparat/głos, historię i aktualizacje rzeczywistych starych wersji, Guide oraz czysty artefakt produkcyjny.

## Produkcja

```sh
npm run build:web -- /tmp/benger-production
```

Polecenie **tylko buduje**, bez publikowania. Artefakt zawiera wersję, dokładny SHA checkoutu i `release-metadata.json`; nie zawiera bannerów/namespace preview, testów ani laboratoriów diagnostycznych. Schematy Guide są lokalnym kodem SVG, nie pobierają mediów z sieci.

Po merge do `main` workflow **Tests** sprawdza dokładny commit. Dopiero jego sukces uruchamia **Deploy production**. Checkout dotyczy przetestowanego SHA; aktualny `origin/main` jest weryfikowany przed buildem i bezpośrednio przed publikacją. Starszy przebieg jest pomijany; wdrożenia są serializowane i nie używają force push.

Pierwsze wdrożenie 1.0 zastępuje opublikowane pliki `gh-pages` czystym ROOT-em i usuwa stare statyczne `/previews/etap-*`. Nie usuwa danych przeglądarki, repozytorium źródłowego ani historii Git. Starsza zainstalowana kopia preview może zachować swój własny cache offline; nie ingerujemy w cudze profile przeglądarki. Workflow preview jest wyłączony. Szczegóły: [przygotowanie wydania](docs/release-1.0.0.md).

## Dane i źródła

Open Food Facts służy do produktów markowych i barcode; lokalny katalog USDA do żywności ogólnej. Zapytania zewnętrzne są jawne, ograniczone i cache’owane. Nie zgadujemy brakującego makro, gęstości ani niejednoznacznego produktu. Dane źródłowe mogą zawierać błędy — wynik należy sprawdzić. Własne produkty i porcje zapisują się lokalnie. Historia zachowuje wartości z chwili zapisu.

[Architektura produktów](docs/product-data-architecture.md) · [Źródła i licencje](docs/data-sources-and-licenses.md) · [PWA](docs/pwa-offline.md) · [Kalendarz](docs/training-calendar.md)

## Licencje

- Open Food Facts i współtwórcy: baza **ODbL 1.0**, zawartość **DbCL 1.0**, zdjęcia **CC BY-SA 3.0** z odnośnikiem do źródła/autorów. Nie kopiujemy zdjęć ani dumpa OFF do katalogu USDA.
- USDA FoodData Central: public domain / **CC0**, z zachowaniem źródła i wersji danych.
- Lokalny fallback **@zxing/browser 0.2.1 — MIT**, ZXing Library — **Apache-2.0**, ts-custom-error — **MIT**. Ich rzeczywiste notices są w `vendor/zxing/` i artefakcie produkcyjnym. Brak CDN runtime.
- Instrukcje i prymitywy SVG Guide są własną treścią Bengera. Nie wykorzystują cudzych GIF-ów, zdjęć ani bibliotek ilustracji. Nie dodano nowych zewnętrznych zależności.

Benger i Guide nie są narzędziem diagnostycznym ani indywidualnym planem trenerskim/rehabilitacyjnym.

## Backup

W **Dane i backup** pobierz kopię standardową lub pełną ze zdjęciami. Backup pozostaje w schemacie **v7** — Guide nie dodaje trwałych danych użytkownika. Import obsługuje v1–v7, walidację, limity, merge/replace i rollback. Starsze formaty bez ustawień/kalendarza nie kasują tych danych. Przechowuj kopię bezpiecznie: zawiera prywatne informacje.
