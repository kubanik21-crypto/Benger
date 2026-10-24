# Audyt gotowości Bengera do wersji webowej

Data: 24 października 2026. Gałąź: `etap-2-tekst-posilku`.
Zakres: domknięcie Etapu 2 i przygotowanie techniczne, bez publikacji i przebudowy UI.
Projekt kolejnego etapu: [stage-3-web-experience.md](stage-3-web-experience.md).

## Wynik

Frontend może działać bez `server.js` na hostingu statycznym. Po zmianie odwołań do root domeny działa pod `/` i `/Benger/`. Nie wymaga bundlera, backendu ani instalowania zależności npm.

To nadal lokalny dziennik z podstawowym manifestem, a nie kompletna aplikacja PWA. Brakuje ikon instalacyjnych, offline shella, service workera i układu stawiającego dziennik przed formularzem dodawania.

## CI

Poprawka `2786db0` (`Make Chromium startup tests CI resilient`) była już na gałęzi przed audytem. Nie tworzono drugiego identycznego commita.

- `CHROMIUM_STARTUP_TIMEOUT_MS = 45_000` zastępuje wcześniejsze 15 sekund.
- Zdarzenia `error` i `exit` procesu Chrome nadal odrzucają uruchomienie. Przekroczenie limitu również kończy test błędem.
- Nie ma bezwarunkowego opóźnienia po starcie ani wyciszania prawdziwych błędów.
- Ostrzeżenie DBus w stderr nie jest traktowane jako wyjątek aplikacji.
- Workflow używa Node.js 22, `npm test` i Chrome przez `CHROMIUM_PATH`.

## Ścieżki i hosting

| Miejsce | Przed audytem | Po zmianie |
| --- | --- | --- |
| HTML: manifest | `/manifest.webmanifest` | `./manifest.webmanifest` |
| HTML: CSS | `/style.css` | `./style.css` |
| HTML: logo / strona główna | `/` | `./` |
| HTML: moduł startowy | `/app.js` | `./app.js` |
| Manifest: start_url | `/` | `./` |
| Manifest: scope | domyślny | jawne `./` |

Importy `./nutrition.js`, `./meal-parser.js` i `./legacy.js` były poprawne. Moduły ES rozwiązują import względem pliku importującego: pod `/Benger/app.js` import prowadzi do `/Benger/nutrition.js`.

CSS nie pobiera zewnętrznych fontów ani innych plików. Favicon jest osadzonym SVG. Kod aplikacji nie korzysta z endpointów Node ani zewnętrznych API. Rootowe ścieżki pozostałe w serwerze i jego testach dotyczą narzędzia deweloperskiego, nie adresów frontendu. `server.js` nie był zmieniany podczas audytu.

Host powinien przekierować `/Benger` do `/Benger/`. Końcowy ukośnik jest potrzebny do poprawnego rozwiązywania względnych adresów. Działa też `/Benger/index.html`.

## Dowody z testów statycznych

Test kopiuje wyłącznie siedem plików publicznych: HTML, CSS, manifest i cztery moduły JS do katalogu tymczasowego. Nie uruchamia wtedy `server.js`. Osobny serwer testowy udostępnia je pod `/` albo `/Benger/`.

W wariancie `/Benger/` adresy `/app.js`, `/style.css` i `/manifest.webmanifest` celowo zwracają 404, więc pliki w root domeny nie mogą zamaskować błędnych ścieżek.

Sprawdzono zasoby i MIME, CSS, importy, oba formularze, brak zapisu przed zatwierdzeniem, sumę dnia, odświeżenie, `index.html`, logo, manifest i jego scope, konsolę, sieć, pięć szerokości oraz localStorage. Nie ma żądań do zewnętrznych API.

Wyniki lokalne na Node.js 22.23.4: **99/99 testów Node i 54/54 testy Chromium**, obejmujące Etapy 1–2 oraz dwa warianty statyczne. `git diff --check` bez błędów.

Odtworzenie audytu bez danych użytkownika:

```sh
npm test
BENGER_AUDIT_DIR=/tmp/benger-web-audit npm run test:browser
```

Katalog audytu zawiera JSON z pomiarami i zrzuty. Nie jest częścią publikowanej aplikacji.

## Responsywność i desktop UX

Pomiar: viewport wysokości 900 px, trzy zapisane produkty, bez otwartej propozycji, strona przewinięta na początek. Wyniki pod obiema ścieżkami były takie same. Oceniono także zrzuty, nie tylko szerokość dokumentu.

| Viewport | Poziomy scroll | Szerokość main | Kolumny formularz / dziennik | Początek podsumowania od góry strony |
| --- | --- | --- | --- | --- |
| 320 px | brak | 320 px | jedna | ok. 1759 px |
| 390 px | brak | 390 px | jedna | ok. 1657 px |
| 768 px | brak | 753 px | ok. 311 / 358 px | ok. 986 px |
| 1024 px | brak | 1009 px | ok. 430 / 495 px | ok. 999 px |
| 1440 px | brak | 1100 px | ok. 473 / 543 px | ok. 985 px |

Różnica 15 px na desktopie wynika z pionowego paska przewijania w testowanej przeglądarce.

Od 721 px obecny layout ma dwie kolumny, więc nie jest wyłącznie rozciągniętym widokiem telefonu. Jednak duży hero i formularz tekstowy zajmują pierwszy ekran. Nawet przy 1440 px trzeba przewinąć stronę, żeby zobaczyć sumę dnia. Przy 768 px kolumny są już dość wąskie. Dwa stale otwarte formularze konkurują z dziennikiem.

Warto zachować spokojną paletę, lokalne fonty, karty, kontrast głównych przycisków, focus i przyciski 48 px. Brak poziomego scrolla nie oznacza ukończonego desktop UX. Etap 3 powinien wyeksponować dzień i liczby, a dodawanie przenieść do otwieranego dialogu.

## Stan PWA

| Element | Stan |
| --- | --- |
| Manifest | poprawny JSON, pobrany w obu lokalizacjach |
| name / short_name / lang | obecne |
| start_url / scope | względne, wskazują katalog aplikacji |
| display | `standalone` |
| theme-color | HTML i manifest: `#174d3c` |
| background-color | manifest i strona: `#f5f4ec` |
| Ikony manifestu | brak; favicon SVG nie zastępuje ikon instalacyjnych |
| Service worker / cache aplikacji | brak |
| Offline shell / odświeżenie offline | brak implementacji i gwarancji |

Chromium zgłosił `manifest-missing-suitable-icon` i `no-acceptable-icon`. Nie ma podstaw do obiecywania pełnej instalowalności. Niektóre przeglądarki pozwalają ręcznie instalować strony niezależnie od pełnych kryteriów. Sam brak service workera nie jest uniwersalną blokadą instalacji, ale nie pozwala obiecać kontrolowanego startu offline.

Docelowo potrzebne są PNG 192×192 i 512×512, osobna ikona maskable, Apple touch icon 180×180, HTTPS i przetestowany offline shell. W tej zmianie ich nie wdrażano.

Lokalny serwer obsługuje obecnie tylko HTML, JS, CSS i webmanifest. Dodanie ikon w Etapie 3 wymaga również rozszerzenia jego mapy MIME oraz hosta testowego i artefaktu publikacji. Nie poszerzano teraz serwera o nieużywane formaty.

## localStorage i zmiana hostingu

localStorage działa na normalnej domenie HTTPS, o ile przeglądarka go nie blokuje. Klucze `benger.nutrition.v1`, `benger.meals.v1` i format wpisów pozostały bez zmian.

Dane zależą od **origin: protokół + host + port**, nie od ścieżki. `/` i `/Benger/` na tym samym origin widzą te same klucze. Natomiast localhost:3000, localhost:3001, domena Pages i własna domena mają oddzielne dane. Inne urządzenie, profil czy przeglądarka nie otrzymają ich automatycznie.

Test w jednym profilu Chromium potwierdził zachowanie danych po zmianie ścieżki i pusty, niezależny dziennik na innym porcie. Stare dane nie są przez zmianę domeny usuwane: nowa domena nie ma do nich dostępu. Pamięć może też zostać wyczyszczona przez użytkownika lub przeglądarkę; nie jest kopią zapasową.

Obecny eksport obejmuje tylko stare notatki tekstowe, **nie dziennik produktów**. Przed przeniesieniem realnych danych potrzebny jest uzgodniony mechanizm kopii i importu obu kluczy. Nie wdrażano go w tym zadaniu. Warto ustalić stałą domenę przed regularnym używaniem; różne adresy preview zwykle oznaczają oddzielne dzienniki.

## Hosting

| Wariant | Ocena dla Bengera | Przygotowanie |
| --- | --- | --- |
| GitHub Pages | rekomendowany pierwszy wariant; ten sam GitHub, HTTPS, bez backendu | względne ścieżki, publiczny artefakt, testy przed deploymentem; potwierdzenie dostępności dla planu i widoczności repo |
| Cloudflare Pages | dobra alternatywa, gdy warunki konta GitHub nie pasują | integracja konta, katalog publiczny, stała domena i zasady preview |
| Vercel | obsłuży statyczny projekt; obecnie więcej możliwości niż potrzeba | konfiguracja statycznego katalogu wynikowego, kontrola domen preview; bez produkcyjnego Node |

API GitHuba zwracało `Forbidden`, więc nie potwierdzono widoczności repozytorium, planu konta ani ustawień Pages. Nie włączano Pages, nie tworzono workflow publikującego i nie wykonano deploymentu. Przed publikacją trzeba sprawdzić dostępność usługi i docelowy URL; nie zmieniać widoczności repozytorium bez osobnej zgody.

Nie publikować całego katalogu repozytorium. Reguły ochrony `server.js` nie działają na hostingu statycznym. Artefakt powinien zawierać wyłącznie pliki publiczne, bez serwera, testów, package.json, dokumentacji i konfiguracji. Konkretny przyszły workflow opisano w projekcie Etapu 3.

## Źródła i granice weryfikacji

- [Oficjalny przykład workflow statycznego Pages](https://github.com/actions/starter-workflows/blob/main/pages/static.yml) — sprawdzony podczas audytu; w planie zamiast publikacji `.` jest jawny zestaw plików.
- [MDN: instalowalność PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — ikony, HTTPS i rozróżnienie instalacji od pracy offline.
- [Dokumentacja GitHub Pages](https://docs.github.com/en/pages) — ustawienia konkretnego konta wymagają sprawdzenia przed publikacją.

Lokalne testy nie potwierdzają wyniku zdalnego Actions ani instalacji na fizycznym Androidzie. To bramki odbioru kolejnego etapu, nie wykonany deployment.
