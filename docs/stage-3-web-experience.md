# Etap 3 — Web Experience

Status: projekt implementacyjny, bez wdrożenia. Data: 24 października 2026.
Punkt wyjścia: [audyt gotowości webowej](web-readiness-audit.md), zawierający pomiary pięciu szerokości i testy hostingu.

## 1. Cel Etapu 3

Zmienić działający prototyp w wygodny dziennik do codziennego używania na desktopie i Androidzie. Po otwarciu najpierw widać wybrany dzień, kcal, makro i posiłki. Dodawanie jest łatwo dostępne, ale nie zajmuje stale większości ekranu.

Charakter: spokojny, nowoczesny, przestrzenny, z wyraźną hierarchią i czytelnymi liczbami. Zachować zielony akcent i ciepłe tło Bengera, bez kopiowania Fitatu. Wygląd SaaS nie oznacza kont ani sugerowania synchronizacji w chmurze.

Zakres: UI, dostępność, instalowalność, kontrolowany offline shell i przygotowanie publikacji. Bez AI, nowych produktów, celów kalorycznych, statystyk tygodniowych, nowych algorytmów żywieniowych i integracji mikrofonu z parserem. Zachować funkcje Etapów 1–2.

## 2. Architektura UI

Pozostać przy HTML, CSS i modułach JavaScript, bez frameworka i nowych zależności npm. Node jest narzędziem lokalnym i testowym; produkcyjny dziennik działa statycznie.

| Moduł | Odpowiedzialność |
| --- | --- |
| `index.html`, `style.css` | semantyczny shell, tokeny wizualne i responsywność |
| `app.js` | inicjalizacja, łączenie modułów i wspólny stan daty/widoku |
| `diary-store.js` | odczyt, walidacja, atomowy zapis zestawu, usuwanie, ID i zdarzenia innych kart |
| `ui/day-view.js` | renderowanie sum i posiłków dla daty |
| `ui/add-meal-dialog.js` | oba tryby dodawania, propozycja, akceptacja i focus |
| `ui/navigation.js` | skróty i historia otwarcia dialogu |
| `nutrition.js`, `meal-parser.js` | dotychczasowa logika domenowa, bez duplikowania |
| `legacy.js` | zachowany, oddzielny notatnik eksperymentalny |
| `sw.js`, `icons/` | offline shell i zasoby instalacyjne |

Wydzielać moduły razem z używającą ich zmianą. Nie tworzyć frameworka komponentów ani globalnego event busa. Store nie zna DOM; renderer nie zapisuje sam do localStorage.

Wspólny stan UI: `selectedDate`, aktywny widok, tryb dodawania, otwarcie dialogu i propozycja powiązana z tekstem/datą/posiłkiem. Zachować schemat wpisu i oba klucze v1. Odczyt przed zapisem i zdarzenie `storage` pozostają obowiązkowe; nie wprowadzać rozbudowanych blokad między kartami.

## 3. Desktop layout

Od 1024 px: lewy sidebar ok. 224 px i główny obszar z paddingiem 24–32 px, z treścią ograniczoną do ok. 1200 px. Wiersze i akapity nie rozciągają się bez ograniczenia na dużym monitorze.

```text
┌───────────────────┬────────────────────────────────────────────────┐
│ benger            │ Dziennik · wybrany dzień      [Dodaj posiłek]   │
│                   │ [wstecz] [data] [dalej] [Dzisiaj]               │
│ Dzisiaj (skrót)   ├────────────────────────────────────────────────┤
│ Dziennik          │ [kcal dnia] [Białko] [Tłuszcz] [Węglowodany]   │
│ Dodaj posiłek     ├────────────────────────────────────────────────┤
│ Ustawienia        │ Śniadanie · suma                    [Dodaj]    │
│   Wkrótce         │ produkt / ilość / makro / kcal / usuń          │
│                   │ Obiad · suma                         [Dodaj]    │
│ Dane na tym       │ Kolacja · suma                       [Dodaj]    │
│ urządzeniu        │ Przekąska · suma                     [Dodaj]    │
└───────────────────┴────────────────────────────────────────────────┘
```

Obecny duży hero zastąpić krótkim nagłówkiem aplikacji. Cztery karty danych mają być w pierwszym ekranie przy 1024×900 i 1440×900; formularze nie stoją nad nimi.

Wiersz wpisu: nazwa i ilość po lewej, kcal po prawej, makro w spokojnym drugim wierszu, oddzielny przycisk usunięcia. Użyć CSS Grid i semantycznych list zamiast ośmiu ciasnych kolumn. Dla 768–1023 px zastosować kompaktową górną nawigację zamiast wciskać sidebar w wąski ekran.

## 4. Mobile layout

Poniżej 768 px: jedna kolumna, boczne odstępy 16 px, bez poziomego scrolla. Kolejność: data, karty danych, posiłki. Przy 320/390 px siatka danych 2×2, kcal wyróżnione typografią. Etykiety mogą się zawijać; nie ucinać „Węglowodany” wielokropkiem.

Dolna nawigacja: „Dziennik”, wyróżnione „Dodaj”, „Dzisiaj”. Ostatnia pozycja jest skrótem daty, a nie pustym osobnym ekranem. Uwzględnić `env(safe-area-inset-bottom)` oraz dolny padding treści, żeby nie zasłaniać wpisów.

Pola i przyciski: minimum 48 px obszaru dotykowego, font formularzy minimum 16 px, focus-visible, kontrast tekstu minimum 4.5:1. Sprawdzić klawiaturę ekranową, orientację telefonu i powiększenie 200%. Funkcje nie mogą zależeć od hover.

## 5. Nawigacja

„Dziennik” pokazuje wybraną datę. „Dzisiaj” ustawia lokalny dzień użytkownika i wraca do dziennika. „Dodaj posiłek” otwiera dialog; akcja przy grupie od razu wybiera jej kod posiłku.

„Ustawienia” pozostają wyraźnie nieaktywne z etykietą „Wkrótce”, dopóki nie ma rzeczywistej zawartości. Nie tworzyć ekranu udającego gotową funkcję. Status „Dane na tym urządzeniu” nie sugeruje synchronizacji.

Nie dodawać routera wymagającego konfiguracji serwera. Użyć stanu UI i fragmentów URL, np. `#dziennik`, `#dodaj`. Przycisk Wstecz zamyka otwarty dialog bez opuszczania aplikacji. Logo wraca do katalogu aplikacji, nie root domeny.

## 6. Dashboard dnia

Data po polsku, poprzedni/następny dzień i „Dzisiaj”. `date` w danych pozostaje `YYYY-MM-DD`, a `createdAt` ISO UTC. Nie przesuwać wybranego dnia konwersją daty przez UTC.

Sumować wyłącznie snapshoty wybranego dnia przez `sumNutrition()`. Zmiana dnia aktualizuje karty i grupy jednocześnie. Usunięcie przelicza całość i przenosi focus do sąsiedniego elementu.

Grupy w stałej kolejności: śniadanie, obiad, kolacja, przekąska. Pusta grupa: nazwa, „Brak wpisów”, „Dodaj”, bez dużej pustej karty. Pusty dzień pokazuje zera i krótkie zaproszenie do dodania, a nie dane demonstracyjne. Zachować czytelne błędy pamięci i niemożliwych sum.

## 7. Dodawanie posiłku

Jeden natywny `<dialog>` z nazwą oraz trybami „Z tekstu” i „Ręcznie”. Na desktopie modal do ok. 680 px i 90dvh wysokości, na telefonie pełny widok. Modal zamiast stale otwartego trzeciego panelu zachowuje szerokość dziennika przy 1024 px i upraszcza focus.

Wspólna data i wybór posiłku są widoczne w dialogu; tekstowy tryb nie odsyła do innego formularza niżej. Zachować analizę → propozycję z sumą i problemami → zatwierdzenie. Ręczny tryb zachowuje produkt, ilość, jednostkę i podgląd.

Zmiana tekstu, daty lub posiłku unieważnia propozycję. Przełączenie trybu niczego nie zapisuje. Niedokończony tekst może zostać w pamięci podczas zamknięcia i ponownego otwarcia, bez wpisu do dziennika i bez nowego klucza localStorage. Przed zapisem ponownie sprawdzić kontekst.

Przygotować wszystkie ID i snapshoty, następnie dopisać zestaw jedną operacją do aktualnej listy. Brak miejsca albo błąd drugiego ID oznacza zero zapisanych pozycji i zachowany tekst. Po sukcesie wyczyścić właściwy formularz, odświeżyć dzień, ogłosić liczbę pozycji przez `role=status` i zamknąć dialog z powrotem focusa do akcji otwierającej.

Fokus zaczyna w polu, Tab zostaje wewnątrz, Escape i Wstecz zamykają, tło jest nieaktywne. Przyciski nie znikają pod klawiaturą. Zachować label i błędy przy polach. Jeśli tryby są zakładkami ARIA, zapewnić także ich klawiaturę; prostsze przyciski wyboru trybu są dopuszczalne.

## 8. Makro i styl

Cztery karty: kcal, białko/tłuszcz/węglowodany w g. Wartości zaokrąglać dopiero w rendererze przez `Intl.NumberFormat('pl-PL')`. Nie kopiować wzorów ani nie przeliczać historii ze zmienionego katalogu.

Nie dodawać pierścieni postępu, procentów „do celu” ani domyślnego limitu 2000 kcal: aplikacja nie ma modelu celu. Kolor nie jest jedyną informacją. Jednostki i etykiety są dostępne dla czytnika ekranu.

Niewielki zestaw tokenów CSS: ciepłe tło, jasne powierzchnie, ciemna zieleń tekstu/akcentu, jeden kolor focusa i błąd. Odstępy 4/8/12/16/24/32 px, tekst bazowy 16 px, pomocniczy zwykle 13–14 px, liczby ok. 28–36 px. Zachować lokalne fonty. Delikatne obramowania i cienie zamiast gradientów i wielu konkurujących kolorowych wykresów.

## 9. PWA

W Etapie 3 dodać stabilne `id: "./"`, ikony PNG 192×192 i 512×512, osobną maskable z bezpieczną strefą i Apple touch icon 180×180. Zachować względne start_url/scope i display standalone.

Przy dodawaniu tych plików rozszerzyć mapę MIME lokalnego `server.js` i hosta testowego o `image/png` (oraz `image/svg+xml`, jeśli favicon stanie się osobnym SVG). Dziś serwer celowo obsługuje tylko cztery używane typy. Zaktualizować też listę artefaktu i kopiowanie podkatalogów `icons/` oraz `ui/` w teście statycznym, zachowując blokadę plików prywatnych i traversal.

`sw.js` umieścić w katalogu aplikacji. Rejestracja z głównego `app.js`:

```js
const appBase = new URL('./', import.meta.url);
await navigator.serviceWorker.register(new URL('sw.js', appBase), {
  scope: appBase.pathname,
});
```

Scope to `/Benger/` na Pages i `/` w root. Przechwytywać tylko GET z własnego origin i scope. HTML fallback tylko dla nawigacji, nigdy dla brakującego JS.

Zastosować jawny, wersjonowany precache całego shella: HTML, CSS, wszystkie moduły, manifest i ikony. Cache-first dla znanych zasobów zachowuje spójność wersji. Każda nowa wersja shella zmienia wersję w `sw.js`; instalacja pobiera cały zestaw i dopiero po sukcesie pozwala go aktywować. Klucz cache obejmuje Benger, scope i wersję. Usuwać tylko stare cache tego scope.

Nie stosować automatycznego skipWaiting i przeładowania w trakcie wpisywania. Zaproponować aktualizację i odłożyć ją do zakończenia pracy z niezapisanym formularzem. Cache API przechowuje shell, nie dziennik; aktualizacja nie czyści localStorage. Eksperymentalne dyktowanie może wymagać sieci mimo działających offline formularzy.

Sprawdzić instalację na Androidzie przez HTTPS oraz start i odświeżenie offline po wcześniejszej wizycie online. Sam service worker nie jest uniwersalnym warunkiem instalacji w przeglądarkach, ale kontrolowany offline shell jest kryterium tego etapu.

## 10. Hosting

Pierwszy wybór: GitHub Pages jako project site `https://kubanik21-crypto.github.io/Benger/`. Przed aktywacją potwierdzić dostępność dla planu konta i widoczności repo. API podczas audytu zwracało Forbidden, więc ustawienia nie są potwierdzone.

Cloudflare Pages to dobra alternatywa, jeśli warunki konta GitHub nie pasują. Vercel też obsłuży statyczny projekt, ale obecnie nie dostarcza potrzebnej dodatkowej funkcji. Nie dodawać backendu tylko z powodu hostingu.

**Workflow poniżej jest tylko projektem. Nie tworzyć aktywnego pliku ani nie włączać Pages bez osobnego polecenia publikacji.** Przykład publikuje siedem obecnych plików. W commicie wdrażającym PWA rozszerzyć listę o `diary-store.js`, `ui/`, `sw.js`, `icons/`; test hostingu musi dostać ten sam zestaw.

```yaml
name: Deploy Benger to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          package-manager-cache: false
      - run: npm test
      - run: npm run test:browser
        env:
          CHROMIUM_PATH: /usr/bin/google-chrome
      - name: Prepare public artifact
        run: |
          mkdir -p _site
          cp index.html style.css app.js nutrition.js meal-parser.js legacy.js manifest.webmanifest _site/
          touch _site/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/configure-pages@v5
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v5
```

Dopiero po zgodzie ustawić w repo źródło Pages na GitHub Actions. Nie publikować `.` ani artefaktów z PR. Testy są zależnością deploymentu, a ochrona `main` powinna wymagać ich sukcesu przed merge. Sam workflow testowy nie blokuje automatycznie merge bez reguły ochrony.

## 11. Migracja ścieżek i danych

W audycie zmieniono HTML na `./app.js`, `./style.css`, `./manifest.webmanifest` i logo `./`. Manifest ma `start_url: "./"`, `scope: "./"`. Importy już były względne. Nie dodawać `<base href="/">` ani twardego `/Benger/`.

Nowe zasoby adresować względem ich modułu. Katalog wymaga końcowego `/`. Fragmenty URL nie wymagają fallbacku serwerowego dla ścieżek typu `/dziennik/2026-10-24`.

Migracja domeny jest osobna od ścieżek. Zachować klucze v1; nowy origin nie odczyta danych localhost. Przed przeniesieniem realnego dziennika przygotować i sprawdzić kopię/odtworzenie obu kluczy z walidacją i bez nadpisania przy błędzie. Obecny eksport dotyczy tylko notatek. Import ma być świadomą operacją techniczną; nie obiecywać automatycznej migracji ani synchronizacji urządzeń.

## 12. Ryzyka i kontrola

| Ryzyko | Kontrola |
| --- | --- |
| Refaktoryzacja psuje obliczenia lub ręczny formularz | zachowane moduły domenowe i regresja obu ścieżek |
| Inny dzień przy potwierdzeniu niż w podglądzie | wspólna data, snapshot kontekstu, unieważnienie starej propozycji |
| Zmiana domeny odcina poprzednie dane | ustalić stały origin, sprawdzić kopię/import przed migracją |
| Dokładnie równoczesne zapisy kart | utrzymać zaakceptowane ograniczenie; odczyt przed zapisem i storage event |
| Quota / uszkodzone dane | zero częściowego zapisu, formularz zachowany, czytelny błąd |
| Instalacja nie działa na telefonie | prawdziwe ikony, HTTPS, test fizycznego Androida |
| SW miesza wersje lub zwraca HTML zamiast JS | spójny shell, MIME, ograniczony fallback i test aktualizacji |
| SW ingeruje w inne projekty origin | scope oraz nazwy cache ograniczone do katalogu aplikacji |
| Nowy moduł nie trafia do artefaktu | zgodna jawna lista plików publikacji i testu statycznego |
| Klawiatura / nawigacja zasłania wpisy | safe-area, widoczny focus, test 320/390 px i telefonu |
| Konto nie ma dostępu do Pages | sprawdzenie ustawień przed zgodą na publikację; alternatywa Cloudflare Pages |

## 13. Kryteria ukończenia

- Dzień i sumy widoczne od razu na desktopie, bez formularzy stale zajmujących pierwszy ekran.
- 320, 390, 768, 1024, 1440 px, brak poziomego scrolla, obsługa klawiaturą i zoom 200%.
- Jeden dostępny dialog, focus/Escape/Wstecz, obie istniejące ścieżki i brak zapisu analizy.
- Daty, snapshoty, usuwanie, odświeżenie, dwie karty, quota, uszkodzenia i UUID przechodzą regresję.
- Sam publiczny artefakt działa pod `/` i `/Benger/`; logo, moduły, CSS, ikony, manifest i SW zostają w scope.
- Instalacja przez HTTPS na rzeczywistym Androidzie, poprawne ikony i standalone; po pierwszej wizycie online działa odświeżenie offline.
- Aktualizacja shella nie kasuje dziennika, nie przerywa propozycji i nie usuwa cache innych projektów.
- Wszystkie testy Node, Chromium, nowe offline/update i `git diff --check` przechodzą; brak błędów konsoli i sieci.
- Dokumentacja i zasady migracji gotowe. Publikacja wymaga oddzielnej zgody, nie jest domyślną częścią zakończenia implementacji.

## 14. Logiczne commity

| Kolejność | Proponowany commit | Odbiór |
| --- | --- | --- |
| 1 | `Extract diary store without changing data format` | schemat v1 i regresja zapisu bez zmian |
| 2 | `Build responsive diary shell and navigation` | sidebar / mobile, prawidłowy dzień i suma w pierwszym ekranie |
| 3 | `Move meal entry into accessible dialog` | oba formularze, potwierdzenie, focus/Escape/Wstecz |
| 4 | `Polish meal rows and macro cards` | czytelne listy i cztery karty bez fikcyjnych celów |
| 5 | `Add PWA icons and scoped offline shell` | ikony, SW, cache i scope pod obiema ścieżkami |
| 6 | `Verify offline updates and local data migration` | offline, aktualizacja i uzgodniona kopia/odtworzenie przed zmianą origin |
| 7 | `Document web release and complete browser review` | pięć szerokości, Android, dokumentacja i testy |
| 8 | `Add approved GitHub Pages deployment` | tylko po zgodzie; jawny artefakt, testy i potwierdzone ustawienia Pages |

Etap 3 rozpocząć dopiero po zgodzie, na nowej gałęzi z uzgodnionego aktualnego `main`. Ten dokument nie scala PR #2, nie tworzy tej gałęzi i nie uruchamia publikacji.
